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
const families = [...svg.matchAll(/@font-face\s*{[^}]*font-family:\s*'([^']+)'/g)].map((m) => m[1]);
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
    const texts = [...document.querySelectorAll("text, text tspan")];
    const ko = texts.find((t) => /[\\uAC00-\\uD7A3]/.test(t.textContent));
    const en = texts.find((t) => /[A-Za-z]{3,}/.test(t.textContent));
    for (const [tag, el] of [["ko", ko], ["en", en]]) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      out.samples.push({ locale: tag, textHead: el.textContent.trim().slice(0, 24),
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
const failed = !probe.fontsReady || families.some((f) => probe.checks[f] && !(probe.checks[f].loadCheckKo && probe.checks[f].loadCheckEn));
if (json) console.log(JSON.stringify(receipt, null, 1));
else {
  console.log(`font-probe ${receipt.file} — fontsReady=${probe.fontsReady}, families=[${families.join(", ")}], ${failed ? "FAIL" : "ok"}`);
  for (const s of probe.samples) console.log(`  ${s.locale}: "${s.textHead}" → ${s.computedFamily} (w ${s.computedWeight})`);
}
process.exit(failed ? 1 : 0);
