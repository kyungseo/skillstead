// preflight.test.mjs — repo-local 소비 계약의 negative 실효성 (Wave 1 CP0).
//
// negative는 개인 설치 경로(~/.claude/skills 등)를 fixture로 고정하지 않는다 —
// 임시 외부 root와 nested symlink로 동일한 구조를 재현한다(사용자·호스트 독립).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { provenance, verifyProvenance, PREFLIGHT_EXIT, digestFiles, runPreflight } from "./preflight-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");            // skills/svg-infographic
const CLI = path.join(here, "preflight.mjs");
const RUNCLI = path.join(here, "testing", "run-cli.mjs");

const run = (args, opts = {}) => {
  // 각 spawn은 독립 호출이다 — 이 테스트 프로세스가 자식에게 물려주는 expected root
  // 상속(정상 pipeline 전용 경로)이 negative 판정을 가리지 않도록 명시적으로 지운다.
  const env = { ...process.env, ...(opts.env ?? {}) };
  if (!(opts.env && "SVGINFO_EXPECTED_SKILL_ROOT" in opts.env)) delete env.SVGINFO_EXPECTED_SKILL_ROOT;
  const r = spawnSync(process.execPath, args, { encoding: "utf8", cwd: here, ...opts, env });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};

// 임시 git repository에 package 사본을 만든다 — "정상처럼 보이지만 다른 root"를
// 재현하기 위한 도구이며, 사본을 변조해 각 negative를 만든다.
function tempPackage() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "w1-repo-")));
  spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  const skills = path.join(repo, "skills");
  fs.mkdirSync(skills, { recursive: true });
  const pkg = path.join(skills, "svg-infographic");
  const cp = spawnSync("cp", ["-R", ROOT, pkg], { encoding: "utf8" });
  assert.equal(cp.status, 0, cp.stderr);
  return { repo, pkg };
}
const inPkg = (pkg, ...rel) => path.join(pkg, ...rel);

// ---- positive ----------------------------------------------------------
test("positive: 정상 worktree에서 preflight가 통과하고 세 digest를 산출한다", () => {
  const r = run([CLI, "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  for (const k of ["runtimeSurfaceDigest", "packageTreeDigest", "verificationSurfaceDigest"])
    assert.match(j.digests[k], /^sha256:[0-9a-f]{64}$/, `${k} must be a full sha256`);
  assert.notEqual(j.digests.runtimeSurfaceDigest, j.digests.packageTreeDigest, "digest 경계가 분리되어야 한다");
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
});

test("positive: manifest에서 파생한 전 production entrypoint가 preflight 위반 없이 기동한다", () => {
  const st = runPreflight({ cwd: here });
  const entrypoints = [...st.kinds.entries()]
    .filter(([f, k]) => k === "production-entrypoint" && f.endsWith(".mjs")).map(([f]) => f);
  assert.ok(entrypoints.length >= 8, `manifest가 production entrypoint를 ${entrypoints.length}개만 선언한다`);
  for (const rel of entrypoints) {
    const r = run([path.join(ROOT, rel)]);
    assert.ok(!r.out.includes("preflight:"), `${rel}: ${r.out}`);
    assert.notEqual(r.code, PREFLIGHT_EXIT, `${rel} must not fail preflight in its own worktree`);
  }
});

// ---- N1 / N6: expected root는 실행 파일이 아니라 작업 repository가 정한다 -----
test("N1: 외부 root의 stale entrypoint는 자기 package로 자기 자신을 정당화하지 못한다", () => {
  const { pkg } = tempPackage();
  // cwd는 정상 Wave 1 worktree, 실행 파일만 외부 사본 — 자기 내부 일관성으로 통과하면 안 된다
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: here });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /running entrypoint is outside the expected skill root/);
});

test("N1b: 외부 사본은 자기 repository에서 실행할 때만 통과한다(대조군)", () => {
  const { repo, pkg } = tempPackage();
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(repo, ".git")));
});

test("N1c: SVGINFO_EXPECTED_SKILL_ROOT로 expected root를 바꿔칠 수 없다", () => {
  const { pkg } = tempPackage();
  const r = run([CLI], { env: { ...process.env, SVGINFO_EXPECTED_SKILL_ROOT: pkg } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /disagrees with the working repository/);
});

test("N1d: git repository 밖에서는 fail-closed", () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "w1-norepo-")));
  const r = run([CLI], { cwd: dir });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /not inside a git repository/);
});

// ---- N2: package 내부 파일이 외부 symlink ---------------------------------
test("N2: package 내부의 외부 symlink는 거부된다", () => {
  const { pkg } = tempPackage();
  const outside = path.join(path.dirname(path.dirname(pkg)), "outside-design-kernel.md");
  fs.writeFileSync(outside, "# outside\n");
  const victim = inPkg(pkg, "references", "design-kernel.md");
  fs.rmSync(victim);
  fs.symlinkSync(outside, victim);
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /package tree contains a symlink: references\/design-kernel\.md/);
});

// ---- N3: registry indirect pointer escape ---------------------------------
test("N3: registry가 가리키는 profile이 package를 벗어나면 거부된다", () => {
  const { repo, pkg } = tempPackage();
  fs.writeFileSync(path.join(repo, "evil.yaml"), "schema_version: 1\nid: evil\nkind: palette\n");
  const regP = inPkg(pkg, "references", "skins", "registry.yaml");
  const reg = fs.readFileSync(regP, "utf8").replace(/current-v1/g, "../../../../evil");
  fs.writeFileSync(regP, reg);
  const r = run([path.join(pkg, "scripts", "skin.mjs"), "registry"], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /resolves outside the skill package/);
});

// ---- N4 / N5: production override 거부 ------------------------------------
test("N4: production 실행에서 SKIN_SKINS_DIR override는 거부된다", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-skins-"));
  const r = run([path.join(here, "skin.mjs"), "registry"], { env: { ...process.env, SKIN_SKINS_DIR: dir } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /SKIN_SKINS_DIR is set/);
});

test("N5: production 실행에서 COMPOSE_TEXT_MEASURE_CLI override는 거부된다", () => {
  const r = run([path.join(here, "compose.mjs"), "plan", path.join(here, "compose-fixtures", "plan-cards-tree.yaml")],
    { env: { ...process.env, COMPOSE_TEXT_MEASURE_CLI: "/bin/echo" } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /COMPOSE_TEXT_MEASURE_CLI is set/);
});

test("N4b: 같은 override가 fixture 진입점에서는 주입된다(대조군)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-skins-"));
  for (const f of ["registry.yaml", "current-v1.yaml", "derivation-v1.yaml", "sketch-overlay-v1.yaml", "legacy-v0.8.yaml"])
    fs.copyFileSync(path.join(ROOT, "references", "skins", f), path.join(dir, f));
  const r = run([RUNCLI, path.join(here, "skin.mjs"), "registry"], { env: { ...process.env, SKIN_SKINS_DIR: dir } });
  assert.notEqual(r.code, PREFLIGHT_EXIT, r.out);
});

// ---- N7: staging 사본 동일성 ----------------------------------------------
function staging() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "w1-staging-")));
  const dst = path.join(dir, "svg-infographic");
  assert.equal(spawnSync("cp", ["-R", ROOT, dst], { encoding: "utf8" }).status, 0);
  return dst;
}
test("N7: staging 사본의 누락·추가·변조·내부 symlink는 동일성 주장을 막는다", () => {
  const ok = staging();
  assert.equal(run([CLI, "--staging", ok]).code, 0, "동일한 사본은 통과해야 한다");

  const missing = staging();
  fs.rmSync(path.join(missing, "references", "sketch.md"));
  let r = run([CLI, "--staging", missing]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /staging copy .*differs|declares missing file/);

  const extra = staging();
  fs.writeFileSync(path.join(extra, "references", "extra.md"), "x\n");
  r = run([CLI, "--staging", extra]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /staging copy|does not classify/);

  const altered = staging();
  fs.appendFileSync(path.join(altered, "SKILL.md"), "\n<!-- drift -->\n");
  r = run([CLI, "--staging", altered]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /packageTreeDigest differs/);

  const linked = staging();
  const target = path.join(linked, "references", "authoring.md");
  fs.rmSync(target);
  fs.symlinkSync(path.join(ROOT, "references", "authoring.md"), target);
  r = run([CLI, "--staging", linked]);
  assert.equal(r.code, PREFLIGHT_EXIT);
  assert.match(r.out, /symlink/);
});

// ---- N8 / N9: 분류 누락과 import closure ----------------------------------
test("N8: package-surface가 분류하지 않은 production 파일은 fail-closed", () => {
  const { pkg } = tempPackage();
  fs.writeFileSync(inPkg(pkg, "scripts", "rogue.mjs"), "export const x = 1;\n");
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /does not classify 1 file\(s\): scripts\/rogue\.mjs/);
});

test("N9: production 코드의 bare import와 package 밖 relative import는 거부된다", () => {
  const { pkg } = tempPackage();
  const victim = inPkg(pkg, "scripts", "check-layout.mjs");
  fs.writeFileSync(victim, 'import pad from "left-pad";\n' + fs.readFileSync(victim, "utf8"));
  let r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /bare import "left-pad"/);

  const { pkg: pkg2 } = tempPackage();
  const victim2 = inPkg(pkg2, "scripts", "check-layout.mjs");
  fs.writeFileSync(victim2, 'import x from "../../../../outside.mjs";\n' + fs.readFileSync(victim2, "utf8"));
  r = run([path.join(pkg2, "scripts", "preflight.mjs")], { cwd: path.join(pkg2, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /escapes the package/);
});

// ---- N10: provenance 위조 --------------------------------------------------
test("N10: 위조된 provenance/digest는 재계산으로 거부된다", () => {
  const rec = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "w1-rec-")), "preflight.receipt.json");
  assert.equal(run([CLI, "--receipt", rec]).code, 0);
  const doc = JSON.parse(fs.readFileSync(rec, "utf8"));
  doc.digests.runtimeSurfaceDigest = "sha256:" + "0".repeat(64);
  doc.provenance = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "a".repeat(64) }, cwd: here });
  fs.writeFileSync(rec, JSON.stringify(doc));
  const r = run([CLI, "--verify-receipt", rec]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-PROV-DIGEST runtimeSurfaceDigest/);
});

test("N10b: provenance 없는 artifact receipt는 거부된다(삭제로 우회 불가)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-rec2-"));
  const rec = path.join(dir, "artifact.receipt.json");
  fs.writeFileSync(rec, JSON.stringify({ command: "compose", digests: {} }));
  const r = run([CLI, "--verify-receipt", rec]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-PROV-MISSING artifact receipt has no provenance block/);
});

test("preflight identity receipt는 provenance 없이도 digest 재계산으로 검증된다", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-rec3-"));
  const rec = path.join(dir, "preflight.receipt.json");
  assert.equal(run([CLI, "--receipt", rec]).code, 0);
  assert.equal(run([CLI, "--verify-receipt", rec]).code, 0, "동일 트리에서는 통과");
  const doc = JSON.parse(fs.readFileSync(rec, "utf8"));
  doc.digests.packageTreeDigest = "sha256:" + "1".repeat(64);
  fs.writeFileSync(rec, JSON.stringify(doc));
  const r = run([CLI, "--verify-receipt", rec]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /packageTreeDigest/);
});

test("digest receipt는 hashed package 안에 쓰지 못한다(자기참조 금지)", () => {
  const r = run([CLI, "--receipt", path.join(ROOT, "references", "preflight.receipt.json")]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /refusing to write a digest receipt inside the hashed package/);
  assert.ok(!fs.existsSync(path.join(ROOT, "references", "preflight.receipt.json")));
});

// ---- provenance schema -----------------------------------------------------
test("provenance: generator/agent-authored union과 logical locator", () => {
  const gen = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "b".repeat(64) }, cwd: here });
  assert.equal(gen.skillRoot, "skills/svg-infographic");
  assert.equal(gen.sourceHeadCommit?.length, 40);
  assert.match(gen.runtimeSurfaceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(typeof gen.repoDirty, "boolean");
  assert.equal(typeof gen.runtimeSurfaceDirty, "boolean");
  assert.ok(!("testedCommit" in gen), "testedCommit은 clean CI acceptance receipt 전용");
  assert.equal(verifyProvenance(gen, { cwd: here }).length, 0);

  const authored = provenance({ producer: { kind: "agent-authored", promptDigest: "sha256:" + "c".repeat(64), authoringContract: "svg-infographic/authoring@kernel-v1" }, cwd: here });
  assert.equal(verifyProvenance(authored, { cwd: here }).length, 0);

  assert.throws(() => provenance({ producer: { kind: "agent-authored", authoringContract: "x" }, cwd: here }), /promptDigest or input digests/);
  assert.throws(() => provenance({ producer: { kind: "agent-authored", promptDigest: "p", authoringContract: "x", generatorDigest: "g" }, cwd: here }), /must not carry a generatorDigest/);
  assert.throws(() => provenance({ producer: { kind: "hand-wave" }, cwd: here }), /producer\.kind/);
});

test("provenance verifier는 절대 local path 유출을 잡는다", () => {
  const p = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "d".repeat(64) }, cwd: here });
  const leaked = { ...p, inputs: [{ role: "source", path: ROOT }] };
  assert.ok(verifyProvenance(leaked, { cwd: here }).some((e) => e.startsWith("E-PROV-PATH")));
});

// ---- digest canonicalization ----------------------------------------------
test("digest framing은 경로 경계 혼동에 취약하지 않다", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-frame-"));
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "a", "b"), "x");
  fs.writeFileSync(path.join(dir, "ab"), "x");
  const one = digestFiles(dir, ["a/b"]);
  const two = digestFiles(dir, ["ab"]);
  assert.notEqual(one, two, "path와 내용 경계가 섞이면 안 된다");
});
