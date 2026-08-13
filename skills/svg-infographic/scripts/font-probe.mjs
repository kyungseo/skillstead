#!/usr/bin/env node
// font-probe.mjs — browser runtime font receipt (CP3 must-fix, FEAT-20260812-002).
//
// document.fonts.ready 이후 각 embedded @font-face alias에 대해:
//   - FontFaceSet.check(alias) — 선택 asset의 load 상태
//   - 대표 KO/EN text node의 getComputedStyle fontFamily / fontWeight
// 를 수집해 receipt로 남긴다.
//
// 증거 수준(과장 금지 계약): 이 receipt는 "computed family + FontFaceSet load check"다.
// 브라우저가 실제로 어떤 face로 글리프를 그렸는지(actual rendered face)는 이 방법으로
// 증명되지 않는다 — glyph 수준 증명은 subset cmap(정적) + 시각 검수가 담당한다.
//
// usage: node font-probe.mjs <svg> [--json]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolveBrowser } from "./render.mjs";

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
// expected weight는 profile SSoT에서 (sketch)
const skinCli = new URL("./skin.mjs", import.meta.url).pathname;
const tp = spawnSync(process.execPath, [skinCli, "typography", "--json"], { encoding: "utf8" });
let expectedWeights = [400];
try { expectedWeights = JSON.parse(tp.stdout).treatments.sketch.weights.map(Number); } catch {}
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
      out.checks[fam] = { loadCheckKo: document.fonts.check("15px '" + fam + "'", "한글확인"),
                          loadCheckEn: document.fonts.check("15px '" + fam + "'", "sample") };
    }
    // scope 내부에서만 대표 표본 선택 — 시트 chrome(제목 등)을 표본으로 잡지 않는다
    const scopeRoots = [...document.querySelectorAll("[data-typography-scope]")];
    const rootSvg = document.querySelector("svg[data-treatment='sketch']");
    if (rootSvg) scopeRoots.push(rootSvg);
    const texts = scopeRoots.flatMap((r) => [...r.querySelectorAll("text")])
      .filter((t) => !t.closest("[data-typography-role='secondary']") && !t.querySelector("[data-typography-role='secondary']") || true);
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
const r = spawnSync(browser.path, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--user-data-dir=${path.join(dir, "profile")}`,
  "--no-first-run", "--no-default-browser-check",
  "--dump-dom", "--virtual-time-budget=4000", "--timeout=8000", pathToFileURL(htmlPath).href,
], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
rmSync(dir, { recursive: true, force: true });
const m = (r.stdout || "").match(/<pre id="probe-out">([\s\S]*?)<\/pre>/);
if (!m || !m[1].trim()) { console.error("font-probe: probe output not found (browser JS did not run)"); process.exit(1); }
let probe;
try { probe = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); }
catch { console.error("font-probe: unparseable probe output"); process.exit(1); }
const receipt = { schemaVersion: 1, command: "font-probe", file: path.basename(svgPath),
  embeddedFamilies: families,
  evidenceLevel: "computed-family + FontFaceSet.check(load) — NOT actual-rendered-face proof; glyph 증명은 subset cmap(정적) + 시각 검수",
  probe };
// 실패 조건 전건(F3): error·ready·check 누락/false·scoped 표본 0·표본 family/weight mismatch
const firstFam = (v) => String(v).split(",")[0].trim().replace(/^["']|["']$/g, "");
const problems = [];
if (probe.error) problems.push(`probe error: ${probe.error}`);
if (!probe.fontsReady) problems.push("document.fonts.ready did not resolve");
for (const f of families) {
  const c = probe.checks[f];
  if (!c) problems.push(`missing FontFaceSet.check result for "${f}"`);
  else if (!(c.loadCheckKo && c.loadCheckEn)) problems.push(`FontFaceSet.check failed for "${f}" (ko=${c?.loadCheckKo}, en=${c?.loadCheckEn})`);
}
if (hasMarkers && !probe.scopedTextCount) problems.push("no scoped text found — samples must come from typography scopes, not sheet chrome");
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
