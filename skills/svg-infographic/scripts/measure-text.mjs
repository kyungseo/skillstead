#!/usr/bin/env node
// measure-text.mjs — measured bounds per text element of a fragment (browser getBBox).
// A static parser cannot prove text bounds, so the fragment receipt carries this
// measurement evidence (method and input digest included) for compose to check against.
// usage: node measure-text.mjs <svg> [--json]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolveBrowser, dumpDom } from "./render.mjs";
import { preflight } from "./preflight-lib.mjs";

preflight({ entrypointUrl: import.meta.url });


const PROBE_NAME = "measure-text";
const args = process.argv.slice(2);
const svgPath = args.find((a) => !a.startsWith("--"));
if (!svgPath) { console.error("usage: measure-text.mjs <svg> [--json]"); process.exit(2); }
const svg = readFileSync(path.resolve(svgPath), "utf8");
const browser = resolveBrowser();
if (!browser) { console.error("measure-text: no Chromium-based browser found"); process.exit(6); }

const dir = mkdtempSync(path.join(tmpdir(), "measure-text-"));
const html = `<!doctype html><meta charset="utf-8"><body>
${svg}
<pre id="mt-out"></pre>
<script>
(async () => {
  const out = { texts: [] };
  try {
    await document.fonts.ready;
    const svgRoot = document.querySelector("svg");
    for (const t of document.querySelectorAll("svg text")) {
      const b = t.getBBox();
      // Global bounds with the ancestor CTM applied (root coordinate system)
      const m = t.getCTM();
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
        .map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
      const gx = Math.min(...pts.map((p) => p[0])), gy = Math.min(...pts.map((p) => p[1]));
      const gx2 = Math.max(...pts.map((p) => p[0])), gy2 = Math.max(...pts.map((p) => p[1]));
      const inst = t.closest("[data-comp-instance]");
      out.texts.push({ content: t.textContent,
                       instance: inst ? inst.getAttribute("data-comp-instance") : null,
                       x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10,
                       w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
                       gx: Math.round(gx * 10) / 10, gy: Math.round(gy * 10) / 10,
                       gw: Math.round((gx2 - gx) * 10) / 10, gh: Math.round((gy2 - gy) * 10) / 10 });
    }
  } catch (e) { out.error = String(e); }
  document.getElementById("mt-out").textContent = JSON.stringify(out);
})();
</script>`;
const htmlPath = path.join(dir, "m.html");
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
const m = (r.stdout || "").match(/<pre id="mt-out">([\s\S]*?)<\/pre>/);
if (!m || !m[1].trim()) { console.error("measure-text: probe output not found"); process.exit(1); }
let probe;
try { probe = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); }
catch { console.error("measure-text: unparseable output"); process.exit(1); }
if (probe.error) { console.error(`measure-text: ${probe.error}`); process.exit(1); }
const receipt = {
  schemaVersion: 1, command: "measure-text", file: path.basename(svgPath),
  method: "browser-getBBox", inputDigest: createHash("sha256").update(svg).digest("hex").slice(0, 16),
  texts: probe.texts,
};
console.log(JSON.stringify(receipt, null, 1));
