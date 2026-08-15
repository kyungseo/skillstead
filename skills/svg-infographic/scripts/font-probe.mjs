#!/usr/bin/env node
// font-probe.mjs — browser runtime font receipt (typography contract).
//
// After document.fonts.ready, for each embedded @font-face alias it collects:
//   - FontFaceSet.check(alias) — the load state of the selected asset
//   - getComputedStyle fontFamily / fontWeight on representative KO and EN text nodes
// and records them as a receipt.
//
// Evidence level (the no-overclaiming contract): this receipt is "computed family plus a
// FontFaceSet load check". Which face the browser actually drew the glyphs with (the actual
// rendered face) is not proven this way — glyph-level proof is the job of the subset cmap
// (static) plus visual inspection.
//
// usage: node font-probe.mjs <svg> [--json]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolveBrowser, dumpDom } from "./render.mjs";
import { preflight } from "./preflight-lib.mjs";


preflight({ entrypointUrl: import.meta.url });

const PROBE_NAME = "font-probe";
const args = process.argv.slice(2);
const json = args.includes("--json");
const svgPath = args.find((a) => !a.startsWith("--"));
if (!svgPath) { console.error("usage: font-probe.mjs <svg> [--json]"); process.exit(2); }

const svg = readFileSync(path.resolve(svgPath), "utf8");
const families = [...new Set([...svg.matchAll(/@font-face\s*{[^}]*font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
const hasMarkers = /data-treatment\s*=\s*["']sketch["']|data-typography-(scope|role)\s*=/.test(svg);
if (hasMarkers && families.length === 0) {
  console.error("font-probe: typography markers present but no embedded @font-face — fail-closed");
  process.exit(1);
}
// The expected weight comes from the profile SSoT (sketch)
const skinCli = fileURLToPath(new URL("./skin.mjs", import.meta.url));
// Loading the profile SSoT is fail-closed — a failed command, corrupt JSON or a missing
// required field fails immediately
const profileJsonArgIdx = args.indexOf("--profile-json");
let profileRaw;
if (profileJsonArgIdx >= 0) {
  try { profileRaw = readFileSync(path.resolve(args[profileJsonArgIdx + 1]), "utf8"); }
  catch { console.error("font-probe: --profile-json path unreadable"); process.exit(1); }
} else {
  const tp = spawnSync(process.execPath, [skinCli, "typography", "--json"], { encoding: "utf8" });
  if (tp.status !== 0) { console.error(`font-probe: typography profile command failed (exit ${tp.status})`); process.exit(1); }
  profileRaw = tp.stdout;
}
let expectedWeights;
try {
  const w = JSON.parse(profileRaw).treatments.sketch.weights;
  if (!Array.isArray(w) || !w.length) throw new Error("weights missing");
  expectedWeights = w.map(Number);
} catch (e) { console.error(`font-probe: typography profile unusable (${e.message ?? e}) — fail-closed`); process.exit(1); }
const browser = resolveBrowser();
if (!browser) { console.error("font-probe: no Chromium-based browser found"); process.exit(6); }

const dir = mkdtempSync(path.join(tmpdir(), "font-probe-"));
const html = `<!doctype html><meta charset="utf-8"><body>
${svg}
<pre id="probe-out"></pre>
<script>
(async () => {
  const out = { fontsReady: false, checks: {}, samples: [] };
  try {
    await document.fonts.ready;
    out.fontsReady = true;
    for (const fam of ${JSON.stringify(families)}) {
      out.checks[fam] = { loadCheckKo: document.fonts.check("15px '" + fam + "'", "\ud55c\uae00\ud655\uc778" /* KO probe sample, escaped: production code, not a fixture */),
                          loadCheckEn: document.fonts.check("15px '" + fam + "'", "sample") };
    }
    // Pick representative samples only inside the scope — never sample the sheet chrome (its title and the like)
    const scopeRoots = [...document.querySelectorAll("[data-typography-scope]")];
    const rootSvg = document.querySelector("svg[data-treatment='sketch']");
    if (rootSvg) scopeRoots.push(rootSvg);
    // Primary samples: exclude text in a secondary role (its own or an ancestor's) — text that
    // merely contains a secondary tspan is still a valid primary sample (computed is read on
    // the text element)
    const texts = scopeRoots.flatMap((r) => [...r.querySelectorAll("text")])
      .filter((t) => !t.closest("[data-typography-role='secondary']"));
    const scoped = texts.filter((t) => t.textContent.trim());
    const ko = scoped.find((t) => /[\\uAC00-\\uD7A3]/.test(t.textContent));
    const en = scoped.find((t) => /[A-Za-z]{3,}/.test(t.textContent) && !/[\\uAC00-\\uD7A3]/.test(t.textContent));
    out.scopedTextCount = scoped.length;
    for (const [tag, el] of [["ko", ko], ["en", en]]) {
      if (!el) continue;
      const sc = el.closest("[data-typography-scope]");
      const cs = getComputedStyle(el);
      out.samples.push({ locale: tag, textHead: el.textContent.trim().slice(0, 24),
                         expectedAlias: sc ? sc.getAttribute("data-typography-scope") : ${JSON.stringify("")} || null,
                         computedFamily: cs.fontFamily, computedWeight: cs.fontWeight });
    }
  } catch (e) { out.error = String(e); }
  document.getElementById("probe-out").textContent = JSON.stringify(out);
})();
</script>`;
const htmlPath = path.join(dir, "probe.html");
writeFileSync(htmlPath, html);
const r = await dumpDom(browser.path, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--user-data-dir=${path.join(dir, "profile")}`,
  "--no-first-run", "--no-default-browser-check",
  "--dump-dom", "--virtual-time-budget=4000", "--timeout=8000", pathToFileURL(htmlPath).href,
], { timeoutMs: 30000 });
if (r.reason === "timeout" || r.reason === "spawn-error") {
  rmSync(dir, { recursive: true, force: true });
  console.error(`${PROBE_NAME}: browser probe did not finish (${r.reason}) — fail-closed`);
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
const m = (r.stdout || "").match(/<pre id="probe-out">([\s\S]*?)<\/pre>/);
if (!m || !m[1].trim()) { console.error("font-probe: probe output not found (browser JS did not run)"); process.exit(1); }
let probe;
try { probe = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); }
catch { console.error("font-probe: unparseable probe output"); process.exit(1); }
const receipt = { schemaVersion: 1, command: "font-probe", file: path.basename(svgPath),
  embeddedFamilies: families,
  evidenceLevel: "computed-family + FontFaceSet.check(load) — NOT actual-rendered-face proof; glyph-level proof is the subset cmap (static) plus visual inspection",
  probe };
// Every failure condition (F3): error, missing or false ready/check, zero scoped samples, a sample family/weight mismatch
const firstFam = (v) => String(v).split(",")[0].trim().replace(/^["']|["']$/g, "");
const problems = [];
if (probe.error) problems.push(`probe error: ${probe.error}`);
if (!probe.fontsReady) problems.push("document.fonts.ready did not resolve");
for (const f of families) {
  const c = probe.checks[f];
  if (!c) problems.push(`missing FontFaceSet.check result for "${f}"`);
  else if (!(c.loadCheckKo && c.loadCheckEn)) problems.push(`FontFaceSet.check failed for "${f}" (ko=${c?.loadCheckKo}, en=${c?.loadCheckEn})`);
}
if (hasMarkers && !probe.scopedTextCount) problems.push("no scoped primary text found — samples must come from typography scopes, not sheet chrome (secondary-only scope is not evidence)");
// Contract: at least one representative sample each for KO and EN (KO-only or EN-only is half the evidence)
if (hasMarkers && probe.scopedTextCount) {
  for (const loc of ["ko", "en"]) {
    if (!(probe.samples ?? []).some((smp) => smp.locale === loc))
      problems.push(`no scoped ${loc.toUpperCase()} sample — the receipt requires one KO and one EN representative`);
  }
}
for (const smp of probe.samples ?? []) {
  const expected = smp.expectedAlias || families[0];
  if (expected && firstFam(smp.computedFamily) !== expected)
    problems.push(`${smp.locale} sample computed family "${firstFam(smp.computedFamily)}" != expected alias "${expected}"`);
  if (!expectedWeights.includes(Number(smp.computedWeight)))
    problems.push(`${smp.locale} sample weight ${smp.computedWeight} not in profile weights [${expectedWeights.join(", ")}]`);
}
const failed = problems.length > 0;
receipt.problems = problems;
if (json) console.log(JSON.stringify(receipt, null, 1));
else {
  console.log(`font-probe ${receipt.file} — fontsReady=${probe.fontsReady}, families=[${families.join(", ")}], scopedTexts=${probe.scopedTextCount ?? 0}, ${failed ? "FAIL" : "ok"}`);
  for (const smp of probe.samples ?? []) console.log(`  ${smp.locale}: "${smp.textHead}" → ${smp.computedFamily} (w ${smp.computedWeight}, expected ${smp.expectedAlias ?? families[0]})`);
  for (const p of problems) console.log(`  PROBLEM ${p}`);
}
process.exit(failed ? 1 : 0);
