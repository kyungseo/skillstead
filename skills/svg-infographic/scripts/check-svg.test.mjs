// check-svg.test.mjs — dependency-free fixture tests for the source lint gate.
// Run with: node --test skills/svg-infographic/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { lintSvg } from "./check-svg.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");
const lint = (name) => lintSvg(fixture(name), name);
const rulesOf = (findings) => findings.map((f) => f.rule);

test("valid fixture passes with no errors and no warnings", () => {
  const { errors, warnings } = lint("valid.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("dangling attribute and CSS references are hard errors", () => {
  const { errors } = lint("dangling-ref.svg");
  const dangling = errors.filter((f) => f.rule === "E-REF");
  const targets = dangling.map((f) => f.message);
  assert.ok(targets.some((m) => m.includes("#missing-grad")), "fill url(#…) reference");
  assert.ok(targets.some((m) => m.includes("#missing-symbol")), "use href reference");
  assert.ok(targets.some((m) => m.includes("#missing-marker")), "CSS marker-end reference");
});

test("CSS dangling reference reports the real source line of its <style> content (R1-F2)", () => {
  const { errors } = lint("dangling-ref.svg");
  const cssRef = errors.find((f) => f.rule === "E-REF" && f.message.includes("#missing-marker"));
  assert.equal(cssRef.line, 2, "the CSS marker-end reference sits on line 2 of the fixture");
});

test("referenced marker without markerUnits=userSpaceOnUse is a hard error with a migration fix", () => {
  const { errors } = lint("missing-marker-units.svg");
  const marker = errors.filter((f) => f.rule === "E-MARKER");
  assert.equal(marker.length, 1);
  assert.match(marker[0].message, /effective head ≈ 30px at stroke-width 3/);
  assert.match(marker[0].fix, /multiply markerWidth\/markerHeight by 3/);
});

test("explicit user-space head far beyond the contract is a hard error", () => {
  const { errors } = lint("oversized-head.svg");
  assert.ok(rulesOf(errors).includes("E-HEADSIZE"));
});

test("clear Latin overflow is a hard error with measured values", () => {
  const { errors } = lint("latin-overflow.svg");
  const overflow = errors.filter((f) => f.rule === "E-TEXT");
  assert.equal(overflow.length, 1);
  assert.match(overflow[0].message, /overflows its box right edge/);
  assert.match(overflow[0].message, /est\. width/);
});

test("CJK weighting catches Korean overflow that a Latin-width estimate would miss", () => {
  const { errors } = lint("korean-overflow.svg");
  assert.ok(rulesOf(errors).includes("E-TEXT"));
  // Same character count in Latin at the same size would fit the 220px box:
  const text = "근거와 종료 조건이 남는 검토 워크플로";
  const latinEquivalent = "a".repeat([...text].length);
  const swapped = fixture("korean-overflow.svg").replace(text, latinEquivalent);
  const { errors: latinErrors } = lintSvg(swapped, "korean-as-latin.svg");
  assert.ok(!rulesOf(latinErrors).includes("E-TEXT"), "latin-width estimate alone must not trip the error");
});

test("non-translate transform degrades to a warning, never an error", () => {
  const { errors, warnings } = lint("warning-transform.svg");
  assert.deepEqual(errors, []);
  assert.ok(rulesOf(warnings).includes("W-TEXT"));
});

test("CLI exits 0 on the valid fixture and 1 on a hard-error fixture", () => {
  const cli = join(here, "check-svg.mjs");
  const ok = spawnSync(process.execPath, [cli, join(here, "fixtures", "valid.svg")], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [cli, join(here, "fixtures", "missing-marker-units.svg")], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /E-MARKER/);
});
