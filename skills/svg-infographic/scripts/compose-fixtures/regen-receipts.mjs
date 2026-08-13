#!/usr/bin/env node
// fragment receipt 재생성기 — 측정기(measuredBoundsStrict)와 live SSoT digest로
// receipt를 산출한다. profile이 바뀌면 이 스크립트로 fixture receipt를 갱신한다
// (digest 대조 fixture와 동일한 유지 규칙).
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
  // text bounds: browser 실측 (정적 파서로 불가)
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
