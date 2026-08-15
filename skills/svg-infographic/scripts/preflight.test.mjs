// preflight.test.mjs — whether the package consumption boundary actually holds (Wave 1 CP0).
//
// The negatives do not pin a personal install path (~/.claude/skills and the like) as a fixture
// — they reproduce the same structure with a temporary external root, an installed copy and a
// nested symlink (host-independent). The static checks (import closure, binding coverage) are
// supporting evidence; the acceptance evidence is the **executed** negatives below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  provenance, verifyProvenance, PREFLIGHT_EXIT, digestFiles, runPreflight, RECEIPT_SCHEMA,
  PROVENANCE_EVIDENCE,
} from "./preflight-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");            // skills/svg-infographic
const CLI = path.join(here, "preflight.mjs");

const run = (args, opts = {}) => {
  // Each spawn is an independent call — the expected-root and mode inheritance this test process
  // would hand down to a child (a path meant only for the normal pipeline) is cleared so it
  // cannot mask the verdict. opts.env carries **only what this test sets explicitly** (passing
  // process.env wholesale would defeat the inheritance block below and let another test's state
  // contaminate the verdict).
  const env = { ...process.env, ...(opts.env ?? {}) };
  for (const k of ["SVGINFO_EXPECTED_SKILL_ROOT", "SVGINFO_EXECUTION_MODE"])
    if (!(opts.env && k in opts.env)) delete env[k];
  const r = spawnSync(process.execPath, args, { encoding: "utf8", cwd: here, ...opts, env });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};
const copyPackage = (dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  assert.equal(spawnSync("cp", ["-R", ROOT, dst], { encoding: "utf8" }).status, 0);
  return dst;
};
const tmp = (tag) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `w1-${tag}-`)));

// A temporary repository that owns this package (reproducing the source-development context)
function sourceRepo() {
  const repo = tmp("srcrepo");
  spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  return { repo, pkg: copyPackage(path.join(repo, "skills", "svg-infographic")) };
}
// An installed package plus a consumer working directory that does not own it (the installed-runtime context)
function installed({ git = true, staged = false } = {}) {
  const base = tmp("consumer");
  const project = path.join(base, "project");
  fs.mkdirSync(project, { recursive: true });
  if (git) spawnSync("git", ["init", "-q", project], { encoding: "utf8" });
  const pkg = staged
    ? copyPackage(path.join(project, ".claude", "skills", "svg-infographic"))
    : copyPackage(path.join(base, "vendor", "svg-infographic"));
  return { project, pkg };
}

// ---- positive: the two execution modes ------------------------------------------------
test("positive(source-development): development mode happens only on the canonical runner's explicit opt-in", () => {
  assert.equal(JSON.parse(run([CLI, "--json"]).out).executionMode, "installed-runtime",
    "the default must always be installed-runtime");
  const r = run([CLI, "--require-mode", "source-development", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.executionMode, "source-development");
  for (const k of ["runtimeSurfaceDigest", "packageTreeDigest", "verificationSurfaceDigest"])
    assert.match(j.digests[k], /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(j.digests.runtimeSurfaceDigest, j.digests.packageTreeDigest);
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
});

test("positive(installed-runtime): an installed package runs normally in an ordinary consumer repository", () => {
  const { project, pkg } = installed();
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.executionMode, "installed-runtime");
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
  // the real consumption path (registry resolution) must work too
  const s = run([path.join(pkg, "scripts", "skin.mjs"), "registry"], { cwd: project });
  assert.equal(s.code, 0, s.out);
  assert.match(s.out, /palette=current-v1/);
});

test("positive(installed-runtime): running a project-scope .claude/skills staged package", () => {
  const { project, pkg } = installed({ staged: true });
  const r = run([path.join(pkg, "scripts", "skin.mjs"), "pageframe", "social-4x5", "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(r.out).preset, "social-4x5");
});

test("positive(installed-runtime): it also runs in a working directory that is not a git repository", () => {
  const { project, pkg } = installed({ git: false });
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(r.out).executionMode, "installed-runtime");
});

test("F1: forcing source-development in an installed context is refused (the Wave acceptance boundary)", () => {
  const { project, pkg } = installed();
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd: project });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /does not carry skills\/svg-infographic|not inside a git repository/);
  assert.equal(run([CLI, "--require-mode", "source-development"]).code, 0, "it passes in the owning repository");
});

test("F1: a consumer repo that merely happens to contain skills/svg-infographic cannot claim development mode", () => {
  // an arbitrary repository with the package copied in — the directory existing is not proof of ownership
  const { repo, pkg } = sourceRepo();
  const cwd = path.join(pkg, "scripts");
  const dflt = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd });
  assert.equal(dflt.code, 0, dflt.out);
  assert.equal(JSON.parse(dflt.out).executionMode, "installed-runtime", "the default is the installed runtime");
  const forced = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd });
  assert.equal(forced.code, PREFLIGHT_EXIT, forced.out);
  assert.match(forced.out, /not in the git index/);
  // requesting it through env demands the same ownership proof
  const viaEnv = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd, env: { SVGINFO_EXECUTION_MODE: "source-development" } });
  assert.equal(viaEnv.code, PREFLIGHT_EXIT, viaEnv.out);
  assert.ok(fs.existsSync(path.join(repo, ".git")));
});

test("F1: a mismatched expected repository identity makes development mode refused", () => {
  const other = tmp("otherrepo");
  const r = run([CLI, "--require-mode", "source-development"], { env: { SVGINFO_EXPECTED_REPO_ROOT: other } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /SVGINFO_EXPECTED_REPO_ROOT disagrees/);
});

// ---- stale entrypoint: refusing an external copy in a development context --------------------------
test("N1: in development mode an external or stale entrypoint cannot vouch for itself with its own package", () => {
  const { pkg } = installed();   // a properly assembled external copy
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd: here });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /running entrypoint is outside the package owned by this working repository/);
});

test("N1b: an inherited env cannot swap out the root or the mode", () => {
  const { pkg } = installed();
  const r = run([CLI], { env: { SVGINFO_EXPECTED_SKILL_ROOT: pkg } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /disagrees with the resolved package/);
  // the mode env is a "request", and a requested mode must clear the ownership proof again
  const m = run([CLI], { env: { SVGINFO_EXECUTION_MODE: "nonsense" } });
  assert.equal(m.code, PREFLIGHT_EXIT, m.out);
  assert.match(m.out, /unknown execution mode/);
});

test("N1c: a run that cannot find the package root fails closed", () => {
  const dir = tmp("bare");
  fs.copyFileSync(path.join(here, "preflight.mjs"), path.join(dir, "preflight.mjs"));
  fs.copyFileSync(path.join(here, "preflight-lib.mjs"), path.join(dir, "preflight-lib.mjs"));
  const r = run([path.join(dir, "preflight.mjs")], { cwd: dir });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /cannot locate the package root/);
});

// ---- CP0-R1-F4: execution-based entrypoint coverage -------------------------------
test("F4: an external copy of every production entrypoint the manifest declares is refused before usage parsing", () => {
  const st = runPreflight({ cwd: here });
  const entrypoints = [...st.kinds.entries()]
    .filter(([f, k]) => k === "production-entrypoint" && f.endsWith(".mjs")).map(([f]) => f);
  assert.ok(entrypoints.length >= 8, `only ${entrypoints.length} production entrypoint(s) declared`);
  const { pkg } = installed();
  for (const rel of entrypoints) {
    // the canonical runner context (a development-mode request) plus an external copy — it must be stopped before argument parsing
    const r = run([path.join(pkg, rel)], { cwd: here, env: { SVGINFO_EXECUTION_MODE: "source-development" } });
    assert.equal(r.code, PREFLIGHT_EXIT, `${rel}: ${r.out}`);
    assert.match(r.out, /entrypoint is outside the package/, rel);
  }
  // control: running the same entrypoint inside its own repository is not killed by preflight
  for (const rel of entrypoints) {
    const r = run([path.join(ROOT, rel)]);
    assert.ok(!r.out.includes("preflight:"), `${rel}: ${r.out}`);
  }
});

test("F4: an external copy of a production shim also reaches the bound entrypoint and is refused", () => {
  const { pkg } = installed();
  const env = { ...process.env, SVGINFO_EXECUTION_MODE: "source-development" };
  delete env.SVGINFO_EXPECTED_SKILL_ROOT;
  const r = spawnSync("bash", [path.join(pkg, "scripts", "render.sh"), "x.svg"], { encoding: "utf8", cwd: here, env });
  assert.equal(r.status, PREFLIGHT_EXIT, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /entrypoint is outside the package/);
});

test("F4: the import closure catches side-effect imports, export-from and non-static dynamic imports", () => {
  const cases = [
    ['import "left-pad";\n', /bare import "left-pad"/],
    ['export { x } from "left-pad";\n', /bare import "left-pad"/],
    ['const n = "x"; await import(n);\n', /non-literal dynamic import/],
    ['const n = "x"; await import (n);\n', /non-literal dynamic import/],
    ['const n = "x"; await import/*gap*/(n);\n', /non-literal dynamic import/],
    ['const n = "x"; await import\n  (n);\n', /non-literal dynamic import/],
    ['await import ("left-pad");\n', /bare import "left-pad"/],
    ['import y from "../../../../outside.mjs";\n', /escapes the package/],
    ['import z from "./no-such-module.mjs";\n', /does not resolve to a file/],
  ];
  for (const [snippet, re] of cases) {
    const { repo, pkg } = sourceRepo();
    const victim = path.join(pkg, "scripts", "check-layout.mjs");
    fs.writeFileSync(victim, snippet + fs.readFileSync(victim, "utf8"));
    const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
    assert.equal(r.code, PREFLIGHT_EXIT, `${snippet}: ${r.out}`);
    assert.match(r.out, re, snippet);
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---- CP0-R1-F2: the shipped surface has no fixture bypass entrypoint --------------------
test("F2: the package contains no fixture runner that turns containment off", () => {
  assert.ok(!fs.existsSync(path.join(here, "testing")), "a shipped package must not contain a fixture runner");
  const lib = fs.readFileSync(path.join(here, "preflight-lib.mjs"), "utf8");
  for (const sym of ["enableFixtureMode", "isFixtureMode", "fixtureOverride"])
    assert.ok(!lib.includes(sym), `preflight-lib must not expose ${sym}`);
});

test("F2: pointing at a profile directory outside the package is refused in both modes", () => {
  const outside = tmp("skins");
  for (const f of fs.readdirSync(path.join(ROOT, "references", "skins")))
    fs.copyFileSync(path.join(ROOT, "references", "skins", f), path.join(outside, f));
  const dev = run([path.join(here, "skin.mjs"), "registry"], { env: { SKIN_SKINS_DIR: outside } });
  assert.equal(dev.code, PREFLIGHT_EXIT, dev.out);
  assert.match(dev.out, /resolves outside the skill package/);

  const { project, pkg } = installed();
  const inst = run([path.join(pkg, "scripts", "skin.mjs"), "registry"],
    { cwd: project, env: { SKIN_SKINS_DIR: outside } });
  assert.equal(inst.code, PREFLIGHT_EXIT, inst.out);
  assert.match(inst.out, /resolves outside the skill package/);
});

// ---- package integrity ---------------------------------------------------------
test("N2: a symlink out of the package is refused", () => {
  const { repo, pkg } = sourceRepo();
  const outside = path.join(repo, "outside-design-kernel.md");
  fs.writeFileSync(outside, "# outside\n");
  const victim = path.join(pkg, "references", "design-kernel.md");
  fs.rmSync(victim);
  fs.symlinkSync(outside, victim);
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /package tree contains a symlink: references\/design-kernel\.md/);
});

test("N3: a registry-referenced profile that leaves the package is refused", () => {
  const { repo, pkg } = sourceRepo();
  fs.writeFileSync(path.join(repo, "evil.yaml"), "schema_version: 1\nid: evil\nkind: palette\n");
  const regP = path.join(pkg, "references", "skins", "registry.yaml");
  fs.writeFileSync(regP, fs.readFileSync(regP, "utf8").replace(/current-v1/g, "../../../../evil"));
  const r = run([path.join(pkg, "scripts", "skin.mjs"), "registry"], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /resolves outside the skill package/);
});

test("N4: a production file the package-surface does not classify fails closed", () => {
  const { pkg } = sourceRepo();
  fs.writeFileSync(path.join(pkg, "scripts", "rogue.mjs"), "export const x = 1;\n");
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /does not classify 1 file\(s\): scripts\/rogue\.mjs/);
});

// ---- staging identity ---------------------------------------------------------
test("N5: an omission, addition, tamper or internal symlink in a staging copy blocks the identity claim", () => {
  const ok = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  assert.equal(run([CLI, "--staging", ok]).code, 0, "an identical copy must pass");

  const missing = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  fs.rmSync(path.join(missing, "references", "sketch.md"));
  let r = run([CLI, "--staging", missing]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /staging copy .*differs|declares missing file/);

  const extra = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  fs.writeFileSync(path.join(extra, "references", "extra.md"), "x\n");
  r = run([CLI, "--staging", extra]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /staging copy|does not classify/);

  const altered = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  fs.appendFileSync(path.join(altered, "SKILL.md"), "\n<!-- drift -->\n");
  r = run([CLI, "--staging", altered]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /packageTreeDigest differs/);

  const linked = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  const target = path.join(linked, "references", "authoring.md");
  fs.rmSync(target);
  fs.symlinkSync(path.join(ROOT, "references", "authoring.md"), target);
  r = run([CLI, "--staging", linked]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /symlink/);
});

// ---- CP0-R1-F3: forging a receipt or provenance -------------------------------------
const receiptOf = (extra = []) => {
  const p = path.join(tmp("rcpt"), "preflight.receipt.json");
  assert.equal(run([CLI, "--receipt", p, ...extra]).code, 0);
  return p;
};

test("F3: an identity receipt is decided by schema identity, and a relabel cannot skip the check", () => {
  const p = receiptOf();
  assert.equal(run([CLI, "--verify-receipt", p]).code, 0, "it passes against the same package");
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  assert.equal(doc.schema.name, RECEIPT_SCHEMA.name);

  // relabelling an artifact receipt as preflight is refused on the schema identity mismatch
  const relabeled = path.join(tmp("rcpt"), "relabeled.json");
  fs.writeFileSync(relabeled, JSON.stringify({ command: "preflight", digests: { runtimeSurfaceDigest: doc.digests.runtimeSurfaceDigest } }));
  const r = run([CLI, "--verify-receipt", relabeled]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-RCPT-SCHEMA receipt carries neither/);
});

test("F3: forging an identity receipt's package, revision, digest count or digest length is caught", () => {
  const base = JSON.parse(fs.readFileSync(receiptOf(), "utf8"));
  const cases = [
    [(d) => { d.package.id = "other"; }, /E-RCPT-PACKAGE package\.id/],
    [(d) => { d.package.surfaceRevision = 999; }, /E-RCPT-PACKAGE surfaceRevision/],
    [(d) => { d.digests.runtimeSurfaceDigest = "sha256:abc"; }, /must be sha256:<64 hex>/],
    [(d) => { delete d.digests.packageTreeDigest; }, /must carry exactly/],
    [(d) => { d.errors = []; }, /unknown field "errors"/],
    [(d) => { d.fileCount = 1; }, /E-RCPT-FILES/],
    [(d) => { d.canonicalization.framing = "concat"; }, /E-RCPT-CANON/],
    [(d) => { d.executionMode = "whatever"; }, /E-RCPT-MODE unknown/],
  ];
  for (const [mutate, re] of cases) {
    const doc = JSON.parse(JSON.stringify(base));
    mutate(doc);
    const p = path.join(tmp("rcpt"), "m.json");
    fs.writeFileSync(p, JSON.stringify(doc));
    const r = run([CLI, "--verify-receipt", p]);
    assert.equal(r.code, PREFLIGHT_EXIT, `${re}: ${r.out}`);
    assert.match(r.out, re);
  }
});

test("F2: a receipt switched to another execution mode from the same enum is refused too", () => {
  // Switching a receipt made under source-development to installed-runtime leaves both values
  // valid but changes the claim itself — it must be checked against the current execution mode.
  const p = receiptOf(["--require-mode", "source-development"]);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  assert.equal(doc.executionMode, "source-development");
  assert.equal(run([CLI, "--verify-receipt", p, "--require-mode", "source-development"]).code, 0, "it passes in the same mode");
  doc.executionMode = "installed-runtime";
  const swapped = path.join(tmp("rcpt"), "swapped.json");
  fs.writeFileSync(swapped, JSON.stringify(doc));
  const r = run([CLI, "--verify-receipt", swapped, "--require-mode", "source-development"]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-RCPT-MODE receipt executionMode .*!= current/);
});

test("F3: the provenance evidence level matches what is actually verified", () => {
  // producer, inputs and browser are only shape-checked, so they are not classified as recomputed.
  assert.deepEqual(PROVENANCE_EVIDENCE.recomputed,
    ["executionMode", "skillRoot", "package", "runtimeSurfaceDigest"]);
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("producer"));
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("inputs"));
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("browser"));
  assert.deepEqual(PROVENANCE_EVIDENCE.informational, ["source.values"]);
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("source.structure"),
    "the source block's structure is checked; only its values are informational");
  // another well-formed digest passes — that is what shapeValidated means
  const p = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "a".repeat(64) }, cwd: here });
  const swapped = { ...p, producer: { kind: "generator", generatorDigest: "sha256:" + "e".repeat(64) } };
  assert.deepEqual(verifyProvenance(swapped, { cwd: here }), [],
    "without the original locator the generator digest cannot be recomputed (shapeValidated)");
});

test("F3: forging provenance commit format, producer, mode or input is caught", () => {
  // the source block exists only in development mode — this check uses the canonical runner context
  runPreflight({ cwd: here, requireMode: "source-development" });
  const good = provenance({
    producer: { kind: "generator", generatorDigest: "sha256:" + "a".repeat(64) },
    inputs: [{ role: "source", digest: "sha256:" + "b".repeat(64) }], cwd: here,
  });
  assert.deepEqual(verifyProvenance(good, { cwd: here }), []);
  const bad = (mutate, re) => {
    const doc = JSON.parse(JSON.stringify(good));
    mutate(doc);
    const errs = verifyProvenance(doc, { cwd: here });
    assert.ok(errs.some((e) => re.test(e)), `${re} not raised: ${JSON.stringify(errs)}`);
  };
  // source is informational, so "a different 40-hex commit" is not a subject of detection — what
  // is caught here is a violation of the commit **format** (consistent with the contract).
  bad((d) => { d.source.headCommit = "forged"; }, /E-PROV-SOURCE source\.headCommit/);
  bad((d) => { d.package.id = "other"; }, /E-PROV-PACKAGE/);
  bad((d) => { d.package.surfaceRevision = 99; }, /E-PROV-PACKAGE surfaceRevision/);
  bad((d) => { d.producer.generatorDigest = "not-a-digest"; }, /E-PROV-PRODUCER/);
  bad((d) => { d.producer.kind = "agent-authored"; }, /E-PROV-PRODUCER/);
  bad((d) => { d.inputs[0].digest = "sha256:short"; }, /E-PROV-DIGEST every input digest/);
  bad((d) => { d.runtimeSurfaceDigest = "sha256:" + "0".repeat(64); }, /E-PROV-DIGEST runtimeSurfaceDigest/);
  bad((d) => { d.executionMode = "installed-runtime"; }, /E-PROV-MODE/);
  bad((d) => { d.schema.version = 2; }, /E-PROV-SCHEMA/);
  bad((d) => { delete d.source; }, /missing field "source"/);
  bad((d) => { d.extra = 1; }, /unknown field "extra"/);
  bad((d) => { d.inputs[0].path = ROOT; }, /unknown field "path"|E-PROV-PATH/);
});

test("F3: the provenance producer union — every required and forbidden field", () => {
  runPreflight({ cwd: here, requireMode: "source-development" });
  assert.throws(() => provenance({ producer: { kind: "hand-wave" }, cwd: here }), /producer\.kind/);
  assert.throws(() => provenance({ producer: { kind: "generator" }, cwd: here }), /generatorDigest as sha256/);
  assert.throws(() => provenance({ producer: { kind: "agent-authored", authoringContract: "x" }, cwd: here }), /promptDigest or inputDigest/);
  assert.throws(() => provenance({ producer: { kind: "agent-authored", promptDigest: "sha256:" + "c".repeat(64), authoringContract: "x", generatorDigest: "g" }, cwd: here }), /unknown field "generatorDigest"/);
  const authored = provenance({ producer: { kind: "agent-authored", promptDigest: "sha256:" + "c".repeat(64), authoringContract: "svg-infographic/authoring@kernel-v1" }, cwd: here });
  assert.deepEqual(verifyProvenance(authored, { cwd: here }), []);
  assert.equal(typeof authored.source, "object");
  assert.ok(!("testedCommit" in authored), "testedCommit belongs to a clean CI acceptance receipt alone");
});

test("F3: no receipt is written while a check is failing", () => {
  runPreflight({ cwd: here });   // put the module state back into the default mode
  const { pkg } = sourceRepo();
  fs.writeFileSync(path.join(pkg, "scripts", "rogue.mjs"), "export const x = 1;\n");
  const out = path.join(tmp("rcpt"), "should-not-exist.json");
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--receipt", out], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.ok(!fs.existsSync(out), "a receipt left from a failed state is later misused as evidence of a pass");
});

test("a digest receipt cannot be written inside the hashed package (no self-reference)", () => {
  const inside = path.join(ROOT, "references", "preflight.receipt.json");
  const r = run([CLI, "--receipt", inside]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /refusing to write a digest receipt inside the hashed package/);
  assert.ok(!fs.existsSync(inside));
});

test("the digest framing is not vulnerable to path-boundary confusion", () => {
  const dir = tmp("frame");
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "a", "b"), "x");
  fs.writeFileSync(path.join(dir, "ab"), "x");
  assert.notEqual(digestFiles(dir, ["a/b"]), digestFiles(dir, ["ab"]));
});

test("installed-runtime provenance makes no source identity claim", () => {
  const { project, pkg } = installed();
  const script = path.join(project, "prov.mjs");
  fs.writeFileSync(script, `
import { provenance, verifyProvenance } from ${JSON.stringify(path.join(pkg, "scripts", "preflight-lib.mjs"))};
const p = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "a".repeat(64) } });
console.log(JSON.stringify({ mode: p.executionMode, source: p.source, errors: verifyProvenance(p) }));
`);
  const r = run([script], { cwd: project });
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.mode, "installed-runtime");
  assert.equal(j.source, null);
  assert.deepEqual(j.errors, []);
});
