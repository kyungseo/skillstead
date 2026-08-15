#!/usr/bin/env node
// Fragment receipt regenerator — produces receipts from the measurer (measuredBoundsStrict)
// and the live SSoT digests. When a profile changes, fixture receipts are refreshed through
// this script (the same maintenance rule as the digest-comparison fixtures).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { measuredBoundsStrict, textDigestOf, textMarkupDigestOf } from "../compose.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skinCli = path.join(here, "..", "skin.mjs");
const sha16 = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

const rj = JSON.parse(spawnSync(process.execPath, [skinCli, "resolve", "current", "--mode", "light", "--json"], { encoding: "utf8" }).stdout);
const pj = JSON.parse(spawnSync(process.execPath, [skinCli, "pageframe", "social-4x5", "--json"], { encoding: "utf8" }).stdout);
const identity = {
  skinProfileDigest: rj.profile.digests[0].digest,
  typographyProfileDigest: rj.typography.profileDigest,
  pageFrameDigest: pj.profile.digest,
  kernelVersion: rj.provenance.kernel,
  iconSetId: "line-icons-v1",
};

for (const [dir, stem] of [["fragments", "summary-cards"], ["fragments", "tree"], ["fragments", "tree.spacious"], ["fragments", "icon-band"], ["fragments-en", "summary-cards"], ["fragments-en", "tree"], ["fragments-en", "tree.spacious"]]) {
  const svgP = path.join(here, dir, `${stem}.svg`);
  const rcpP = path.join(here, dir, `${stem}.receipt.json`);
  const frag = readFileSync(svgP, "utf8");
  const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
  // Text bounds: measured in the browser (a static parser cannot do this)
  const hasText = /<text[\s>]/.test(body);
  let textBoxes = [];
  let tm = { texts: [] };
  if (hasText) {
    const mt = spawnSync(process.execPath, [path.join(here, "..", "measure-text.mjs"), svgP], { encoding: "utf8" });
    if (mt.status !== 0) { console.error(`${stem}: text measure failed:\n${mt.stdout}${mt.stderr}`); process.exit(1); }
    tm = JSON.parse(mt.stdout);
    textBoxes = tm.texts.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  }
  const meas = measuredBoundsStrict(body, { textBoxes });
  if (meas.errors.length) { console.error(`${stem}: geometry errors:\n  ` + meas.errors.join("\n  ")); process.exit(1); }
  const rcp = JSON.parse(readFileSync(rcpP, "utf8"));
  rcp.usedBounds = { x: meas.bounds.x, y: meas.bounds.y, w: meas.bounds.w, h: meas.bounds.h };
  rcp.identity = identity;
  rcp.sourceDigest = sha16(frag);
  rcp.verifier = "compose-fragment-measure-v1";
  rcp.textBounds = textBoxes;
  rcp.textDigest = hasText ? textDigestOf(body) : null;
  rcp.textMarkupDigest = hasText ? textMarkupDigestOf(body) : null;
  rcp.textMeasure = hasText ? { method: "browser-getBBox", inputDigest: sha16(frag), texts: tm.texts.length } : null;
  writeFileSync(rcpP, JSON.stringify(rcp, null, 1));
  console.log(`${dir}/${stem}: usedBounds ${JSON.stringify(rcp.usedBounds)} sourceDigest ${rcp.sourceDigest}`);
}
