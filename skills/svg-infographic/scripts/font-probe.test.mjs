// font-probe contract tests — needs a browser (same environment premise as the render suite)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const run = (f) => spawnSync(process.execPath, [join(here, "font-probe.mjs"), join(here, "skin-fixtures", "typography", f)],
  { encoding: "utf8", timeout: 60000 });

test("probe positive: a real embedded subset passes with load + computed = alias + weight", () => {
  const r = run("tf-probe-positive.svg");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /HiMelody-Subset \(w 400/);
});
test("probe: KO-only fails for want of an EN sample (R1B2-2)", () => {
  const r = run("tf-probe-ko-only.svg");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /no scoped EN sample/);
});
test("probe: EN-only fails for want of a KO sample (R1B2-2)", () => {
  const r = run("tf-probe-en-only.svg");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /no scoped KO sample/);
});
test("probe: a secondary-only scope is not evidence for the primary (R1B2-2)", () => {
  const r = run("tf-probe-secondary-only.svg");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /no scoped primary text/);
});
test("probe: a corrupt profile JSON fails immediately (R1B2-2)", () => {
  const r = spawnSync(process.execPath, [join(here, "font-probe.mjs"),
    join(here, "skin-fixtures", "typography", "tf-probe-positive.svg"),
    "--profile-json", join(here, "skin-fixtures", "typography", "tf-probe-profile-broken.json")],
    { encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /profile unusable/);
});
test("probe negative: a missing wrapper fails closed with a load failure and a family mismatch", () => {
  const r = run("tf-wrapper-lost.svg");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /PROBLEM/);
});
