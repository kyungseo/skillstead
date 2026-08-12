// skin.mjs test suite — CP3A: materializer parity + schema/profile negative fixtures.
// Durable fixtures live in scripts/skin-fixtures/ (skins-negative/ mirrors the real
// profiles plus deliberate defects and is consumed via the SKIN_SKINS_DIR override).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKIN = path.join(here, "skin.mjs");
const FIX = path.join(here, "skin-fixtures");
const NEG = path.join(FIX, "skins-negative");
const CUR = path.join(here, "..", "references", "skins", "current-v1.yaml");

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [SKIN, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}

// --- CLI strictness -----------------------------------------------------------
test("option typo is rejected non-zero", () => {
  const r = run(["resolve", CUR, "--mdoe", "dark"]);
  assert.equal(r.code, 2);
  assert.match(r.out, /unknown option/);
});
test("duplicate option is rejected", () => {
  const r = run(["resolve", CUR, "--mode", "light", "--mode", "dark"]);
  assert.equal(r.code, 2);
});
test("valueless option is rejected", () => {
  const r = run(["resolve", CUR, "--mode"]);
  assert.equal(r.code, 2);
});
test("dark + sketch is an unsupported combination", () => {
  const r = run(["resolve", CUR, "--mode", "dark", "--treatment", "sketch"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unsupported combination/);
});

// --- profile negatives (SKIN_SKINS_DIR isolation) ------------------------------
const neg = (file, re, extraEnv = {}) => {
  const r = run(["validate", path.join(NEG, file)], { SKIN_SKINS_DIR: NEG, ...extraEnv });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, re);
};
test("candidate palette failing a contrast gate is rejected", () => neg("bad-contrast.yaml", /contrast on-focus\/focus/));
test("missing required role is rejected", () => neg("missing-role.yaml", /missing required role "canvas"/));
test("unknown anchor key is rejected", () => neg("anchors-unknown.yaml", /anchors: unknown key "tertiary"/));
test("extends with a non-kebab id is rejected", () => neg("extends-bad-id.yaml", /extends: invalid id/));
test("derivation with an invalid alias target is rejected", () => neg("bad-alias-target.yaml", /invalid source "rainbow"/));
test("derivation ratio out of [0,1] is rejected", () => neg("ratio-oob.yaml", /out of range/));
test("overlay missing a required token is rejected", () => neg("overlay-missing-token.yaml", /missing token "highlight"/));
test("overlay with an unexpected token is rejected", () => neg("overlay-unexpected-token.yaml", /unexpected token "glitter"/));
test("palette validation fails when the sibling derivation is defective", () => {
  // registry in NEG selects derivation-v1 (valid); point a copy at the broken one
  const dir = mkdtempSync(path.join(tmpdir(), "skins-"));
  for (const f of ["current-v1.yaml", "sketch-overlay-v1.yaml", "legacy-v0.8.yaml"]) copyFileSync(path.join(NEG, f), path.join(dir, f));
  copyFileSync(path.join(NEG, "bad-alias-target.yaml"), path.join(dir, "derivation-v1.yaml"));
  writeFileSync(path.join(dir, "derivation-v1.yaml"),
    readFileSync(path.join(NEG, "bad-alias-target.yaml"), "utf8").replace("id: bad-alias-target", "id: derivation-v1"));
  writeFileSync(path.join(dir, "registry.yaml"), readFileSync(path.join(NEG, "registry.yaml"), "utf8"));
  const r = run(["validate", path.join(dir, "current-v1.yaml")], { SKIN_SKINS_DIR: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /invalid source/);
});

// --- registry ------------------------------------------------------------------
test("registry validates slots and current uniqueness", () => {
  const r = run(["registry"]);
  assert.equal(r.code, 0, r.out);
});
test("resolve current uses the registry selection and reports it", () => {
  const r = run(["resolve", "current", "--mode", "light", "--json"]);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.registry.selectionBasis, "registry-current");
  assert.ok(j.contrast.light.length > 0, "resolve receipt must include the selected-mode contrast matrix");
  assert.ok(j.resolvedDigest);
});

// --- materializer --------------------------------------------------------------
test("portable positive fixture verifies with zero updates", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive.svg"), "--check", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.errors.length, 0);
  assert.ok(j.verified >= 5);
  assert.equal(j.staticKept, 1); // data-paint-static preserved, not flagged
});
test("check mode fails closed on annotated paint mismatch", () => {
  const r = run(["materialize", path.join(FIX, "materialize-mismatch.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /paint mismatch: surface/);
});
test("unknown role annotation fails closed", () => {
  const r = run(["materialize", path.join(FIX, "materialize-unknown-role.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown role annotation/);
});
test("hand-typed canonical hex without annotation is warned", () => {
  const r = run(["materialize", path.join(FIX, "unannotated-canonical-hex.svg"), "--check", "--json"]);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.warnings.length, 1);
  assert.match(j.warnings[0], /unannotated canonical hex #2E6DA4/);
});
test("materialize rewrites mismatched paint deterministically (write path, temp copy)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mat-"));
  const f = path.join(dir, "m.svg");
  copyFileSync(path.join(FIX, "materialize-mismatch.svg"), f);
  const r = run(["materialize", f, "--json"]);
  assert.equal(r.code, 0, r.out);
  const after = readFileSync(f, "utf8");
  assert.match(after, /data-fill-role="surface" fill="#FFFFFF"/);
  const r2 = run(["materialize", f, "--check"]);
  assert.equal(r2.code, 0, "after materialize, check must pass (deterministic roundtrip)");
});
test("baseline-red CSS-variable fixture fails closed under --check (zero annotations)", () => {
  const r = run(["materialize", path.join(FIX, "baseline-red-cssvar.svg"), "--check", "--json"]);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.verified, 0);
  assert.match(j.errors[0], /zero recognized annotations/);
});
test("single-quoted annotations are recognized (positive)", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive-sq.svg"), "--check", "--json"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(JSON.parse(r.out).verified >= 2);
});
test("single-quoted annotated mismatch fails closed", () => {
  const r = run(["materialize", path.join(FIX, "materialize-mismatch-sq.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /paint mismatch: surface/);
});
test("materialize receipt carries kernelVersion and sourceDigest", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive.svg"), "--check", "--json"]);
  const j = JSON.parse(r.out);
  assert.equal(j.kernelVersion, "wave0-cp2");
  assert.match(j.sourceDigest, /^[0-9a-f]{16}$/);
});
