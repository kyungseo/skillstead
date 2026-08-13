// preflight.test.mjs — package 소비 경계의 실효성 (Wave 1 CP0).
//
// negative는 개인 설치 경로(~/.claude/skills 등)를 fixture로 고정하지 않는다 —
// 임시 외부 root·설치 사본·nested symlink로 동일한 구조를 재현한다(호스트 독립).
// 정적 검사(import closure·binding coverage)는 보조 증거이고, acceptance 증거는
// 아래의 **실행** negative다.
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
  // 각 spawn은 독립 호출이다 — 이 테스트 프로세스가 자식에게 물려주는 expected root·
  // mode 상속(정상 pipeline 전용 경로)이 판정을 가리지 않도록 지운다.
  // opts.env에는 이 테스트가 **명시적으로 세운 값만** 넣는다(process.env를 통째로
  // 넘기면 아래 상속 차단이 무력화되어 다른 테스트의 상태가 판정을 오염시킨다).
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

// 이 package를 소유하는 임시 repository (source-development 문맥 재현)
function sourceRepo() {
  const repo = tmp("srcrepo");
  spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  return { repo, pkg: copyPackage(path.join(repo, "skills", "svg-infographic")) };
}
// 설치된 package + 이를 소유하지 않는 consumer 작업 디렉터리 (installed-runtime 문맥)
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

// ---- positive: 두 실행 모드 ------------------------------------------------
test("positive(source-development): canonical runner의 명시 opt-in에서만 개발 모드가 된다", () => {
  assert.equal(JSON.parse(run([CLI, "--json"]).out).executionMode, "installed-runtime",
    "기본값은 언제나 installed-runtime이어야 한다");
  const r = run([CLI, "--require-mode", "source-development", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.executionMode, "source-development");
  for (const k of ["runtimeSurfaceDigest", "packageTreeDigest", "verificationSurfaceDigest"])
    assert.match(j.digests[k], /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(j.digests.runtimeSurfaceDigest, j.digests.packageTreeDigest);
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
});

test("positive(installed-runtime): 일반 consumer repository에서 설치 package가 정상 실행된다", () => {
  const { project, pkg } = installed();
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.executionMode, "installed-runtime");
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
  // 실제 소비 경로(registry 해석)도 동작해야 한다
  const s = run([path.join(pkg, "scripts", "skin.mjs"), "registry"], { cwd: project });
  assert.equal(s.code, 0, s.out);
  assert.match(s.out, /palette=current-v1/);
});

test("positive(installed-runtime): project-scope .claude/skills staged package 실행", () => {
  const { project, pkg } = installed({ staged: true });
  const r = run([path.join(pkg, "scripts", "skin.mjs"), "pageframe", "social-4x5", "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(r.out).preset, "social-4x5");
});

test("positive(installed-runtime): git repository가 아닌 작업 디렉터리에서도 실행된다", () => {
  const { project, pkg } = installed({ git: false });
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd: project });
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(r.out).executionMode, "installed-runtime");
});

test("F1: 설치 문맥에서 source-development 강제는 거부된다(Wave acceptance 경계)", () => {
  const { project, pkg } = installed();
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd: project });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /does not carry skills\/svg-infographic|not inside a git repository/);
  assert.equal(run([CLI, "--require-mode", "source-development"]).code, 0, "소유 repository에서는 통과");
});

test("F1: 우연히 skills/svg-infographic을 가진 consumer repo는 개발 모드를 주장할 수 없다", () => {
  // package를 그대로 복사해 둔 임의 repository — 디렉터리 존재만으로는 소유 증거가 아니다
  const { repo, pkg } = sourceRepo();
  const cwd = path.join(pkg, "scripts");
  const dflt = run([path.join(pkg, "scripts", "preflight.mjs"), "--json"], { cwd });
  assert.equal(dflt.code, 0, dflt.out);
  assert.equal(JSON.parse(dflt.out).executionMode, "installed-runtime", "기본값은 설치 런타임");
  const forced = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd });
  assert.equal(forced.code, PREFLIGHT_EXIT, forced.out);
  assert.match(forced.out, /not in the git index/);
  // env로 요청해도 같은 소유 증거를 요구한다
  const viaEnv = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd, env: { SVGINFO_EXECUTION_MODE: "source-development" } });
  assert.equal(viaEnv.code, PREFLIGHT_EXIT, viaEnv.out);
  assert.ok(fs.existsSync(path.join(repo, ".git")));
});

test("F1: expected repository identity가 어긋나면 개발 모드는 거부된다", () => {
  const other = tmp("otherrepo");
  const r = run([CLI, "--require-mode", "source-development"], { env: { SVGINFO_EXPECTED_REPO_ROOT: other } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /SVGINFO_EXPECTED_REPO_ROOT disagrees/);
});

// ---- stale entrypoint: 개발 문맥에서 외부 사본 거부 --------------------------
test("N1: 개발 모드에서 외부/stale entrypoint는 자기 package로 자기 자신을 정당화하지 못한다", () => {
  const { pkg } = installed();   // 정상적으로 구성된 외부 사본
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--require-mode", "source-development"], { cwd: here });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /running entrypoint is outside the package owned by this working repository/);
});

test("N1b: 상속 env로 root·mode를 바꿔칠 수 없다", () => {
  const { pkg } = installed();
  const r = run([CLI], { env: { SVGINFO_EXPECTED_SKILL_ROOT: pkg } });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /disagrees with the resolved package/);
  // mode env는 "요청"이며 요청된 모드도 소유 증거를 다시 통과해야 한다
  const m = run([CLI], { env: { SVGINFO_EXECUTION_MODE: "nonsense" } });
  assert.equal(m.code, PREFLIGHT_EXIT, m.out);
  assert.match(m.out, /unknown execution mode/);
});

test("N1c: package root를 찾을 수 없는 실행은 fail-closed", () => {
  const dir = tmp("bare");
  fs.copyFileSync(path.join(here, "preflight.mjs"), path.join(dir, "preflight.mjs"));
  fs.copyFileSync(path.join(here, "preflight-lib.mjs"), path.join(dir, "preflight-lib.mjs"));
  const r = run([path.join(dir, "preflight.mjs")], { cwd: dir });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /cannot locate the package root/);
});

// ---- CP0-R1-F4: 실행 기반 entrypoint coverage -------------------------------
test("F4: manifest가 선언한 모든 production entrypoint의 외부 사본은 usage 파싱 전에 거부된다", () => {
  const st = runPreflight({ cwd: here });
  const entrypoints = [...st.kinds.entries()]
    .filter(([f, k]) => k === "production-entrypoint" && f.endsWith(".mjs")).map(([f]) => f);
  assert.ok(entrypoints.length >= 8, `production entrypoint ${entrypoints.length}개만 선언됨`);
  const { pkg } = installed();
  for (const rel of entrypoints) {
    // canonical runner 문맥(개발 모드 요청) + 외부 사본 — 인자 파싱 전에 막아야 한다
    const r = run([path.join(pkg, rel)], { cwd: here, env: { SVGINFO_EXECUTION_MODE: "source-development" } });
    assert.equal(r.code, PREFLIGHT_EXIT, `${rel}: ${r.out}`);
    assert.match(r.out, /entrypoint is outside the package/, rel);
  }
  // 대조군: 같은 entrypoint를 자기 repository에서 실행하면 preflight로 죽지 않는다
  for (const rel of entrypoints) {
    const r = run([path.join(ROOT, rel)]);
    assert.ok(!r.out.includes("preflight:"), `${rel}: ${r.out}`);
  }
});

test("F4: production shim의 외부 사본도 bound entrypoint까지 도달해 거부된다", () => {
  const { pkg } = installed();
  const env = { ...process.env, SVGINFO_EXECUTION_MODE: "source-development" };
  delete env.SVGINFO_EXPECTED_SKILL_ROOT;
  const r = spawnSync("bash", [path.join(pkg, "scripts", "render.sh"), "x.svg"], { encoding: "utf8", cwd: here, env });
  assert.equal(r.status, PREFLIGHT_EXIT, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /entrypoint is outside the package/);
});

test("F4: import closure는 side-effect·export-from·비정적 dynamic import를 잡는다", () => {
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

// ---- CP0-R1-F2: shipped 표면에 fixture 우회 진입점이 없다 --------------------
test("F2: package에는 containment를 끄는 fixture runner가 존재하지 않는다", () => {
  assert.ok(!fs.existsSync(path.join(here, "testing")), "shipped package에 fixture runner가 있으면 안 된다");
  const lib = fs.readFileSync(path.join(here, "preflight-lib.mjs"), "utf8");
  for (const sym of ["enableFixtureMode", "isFixtureMode", "fixtureOverride"])
    assert.ok(!lib.includes(sym), `preflight-lib은 ${sym}을 노출하면 안 된다`);
});

test("F2: package 밖 profile 디렉터리 지정은 두 모드 모두에서 거부된다", () => {
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

// ---- package 무결성 ---------------------------------------------------------
test("N2: package 내부의 외부 symlink는 거부된다", () => {
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

test("N3: registry가 가리키는 profile이 package를 벗어나면 거부된다", () => {
  const { repo, pkg } = sourceRepo();
  fs.writeFileSync(path.join(repo, "evil.yaml"), "schema_version: 1\nid: evil\nkind: palette\n");
  const regP = path.join(pkg, "references", "skins", "registry.yaml");
  fs.writeFileSync(regP, fs.readFileSync(regP, "utf8").replace(/current-v1/g, "../../../../evil"));
  const r = run([path.join(pkg, "scripts", "skin.mjs"), "registry"], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /resolves outside the skill package/);
});

test("N4: package-surface가 분류하지 않은 production 파일은 fail-closed", () => {
  const { pkg } = sourceRepo();
  fs.writeFileSync(path.join(pkg, "scripts", "rogue.mjs"), "export const x = 1;\n");
  const r = run([path.join(pkg, "scripts", "preflight.mjs")], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /does not classify 1 file\(s\): scripts\/rogue\.mjs/);
});

// ---- staging 동일성 ---------------------------------------------------------
test("N5: staging 사본의 누락·추가·변조·내부 symlink는 동일성 주장을 막는다", () => {
  const ok = copyPackage(path.join(tmp("stg"), "svg-infographic"));
  assert.equal(run([CLI, "--staging", ok]).code, 0, "동일한 사본은 통과해야 한다");

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

// ---- CP0-R1-F3: receipt/provenance 위조 -------------------------------------
const receiptOf = (extra = []) => {
  const p = path.join(tmp("rcpt"), "preflight.receipt.json");
  assert.equal(run([CLI, "--receipt", p, ...extra]).code, 0);
  return p;
};

test("F3: identity receipt는 schema identity로 판별되고 relabel로 검사를 건너뛸 수 없다", () => {
  const p = receiptOf();
  assert.equal(run([CLI, "--verify-receipt", p]).code, 0, "동일 package에서는 통과");
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  assert.equal(doc.schema.name, RECEIPT_SCHEMA.name);

  // artifact receipt를 preflight로 relabel → schema identity 불일치로 거부
  const relabeled = path.join(tmp("rcpt"), "relabeled.json");
  fs.writeFileSync(relabeled, JSON.stringify({ command: "preflight", digests: { runtimeSurfaceDigest: doc.digests.runtimeSurfaceDigest } }));
  const r = run([CLI, "--verify-receipt", relabeled]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-RCPT-SCHEMA receipt carries neither/);
});

test("F3: identity receipt의 package·revision·digest 개수·길이 위조를 잡는다", () => {
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

test("F2: enum에 속하는 다른 execution mode로 바꾼 receipt도 거부된다", () => {
  // source-development에서 만든 receipt를 installed-runtime으로 바꾸면 두 값 모두
  // 유효하지만 주장 자체가 달라진다 — 현재 실행 모드와 대조해야 한다.
  const p = receiptOf(["--require-mode", "source-development"]);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  assert.equal(doc.executionMode, "source-development");
  assert.equal(run([CLI, "--verify-receipt", p, "--require-mode", "source-development"]).code, 0, "같은 모드에서는 통과");
  doc.executionMode = "installed-runtime";
  const swapped = path.join(tmp("rcpt"), "swapped.json");
  fs.writeFileSync(swapped, JSON.stringify(doc));
  const r = run([CLI, "--verify-receipt", swapped, "--require-mode", "source-development"]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /E-RCPT-MODE receipt executionMode .*!= current/);
});

test("F3: provenance evidence level은 실제 검증 수준과 일치한다", () => {
  // producer·inputs·browser는 형식만 확인하므로 recomputed로 분류하지 않는다.
  assert.deepEqual(PROVENANCE_EVIDENCE.recomputed,
    ["executionMode", "skillRoot", "package", "runtimeSurfaceDigest"]);
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("producer"));
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("inputs"));
  assert.ok(PROVENANCE_EVIDENCE.shapeValidated.includes("browser"));
  assert.deepEqual(PROVENANCE_EVIDENCE.informational, ["source"]);
  // 형식이 올바른 다른 digest는 통과한다 — 이것이 shapeValidated의 의미다
  const p = provenance({ producer: { kind: "generator", generatorDigest: "sha256:" + "a".repeat(64) }, cwd: here });
  const swapped = { ...p, producer: { kind: "generator", generatorDigest: "sha256:" + "e".repeat(64) } };
  assert.deepEqual(verifyProvenance(swapped, { cwd: here }), [],
    "원본 locator 없이는 generator digest를 재계산할 수 없다(shapeValidated)");
});

test("F3: provenance의 commit 형식·producer·mode·input 위조를 잡는다", () => {
  // source 블록은 개발 모드에서만 존재한다 — 이 검사는 canonical runner 문맥을 쓴다
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
  // source는 informational이므로 "다른 40-hex commit"은 검출 대상이 아니다 —
  // 여기서 잡는 것은 commit **형식** 위반이다(계약과 일치).
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

test("F3: provenance producer union — 필수·금지 필드 전건", () => {
  runPreflight({ cwd: here, requireMode: "source-development" });
  assert.throws(() => provenance({ producer: { kind: "hand-wave" }, cwd: here }), /producer\.kind/);
  assert.throws(() => provenance({ producer: { kind: "generator" }, cwd: here }), /generatorDigest as sha256/);
  assert.throws(() => provenance({ producer: { kind: "agent-authored", authoringContract: "x" }, cwd: here }), /promptDigest or inputDigest/);
  assert.throws(() => provenance({ producer: { kind: "agent-authored", promptDigest: "sha256:" + "c".repeat(64), authoringContract: "x", generatorDigest: "g" }, cwd: here }), /unknown field "generatorDigest"/);
  const authored = provenance({ producer: { kind: "agent-authored", promptDigest: "sha256:" + "c".repeat(64), authoringContract: "svg-infographic/authoring@kernel-v1" }, cwd: here });
  assert.deepEqual(verifyProvenance(authored, { cwd: here }), []);
  assert.equal(typeof authored.source, "object");
  assert.ok(!("testedCommit" in authored), "testedCommit은 clean CI acceptance receipt 전용");
});

test("F3: 검사 실패 상태에서는 receipt를 만들지 않는다", () => {
  runPreflight({ cwd: here });   // 모듈 상태를 기본 모드로 되돌린다
  const { pkg } = sourceRepo();
  fs.writeFileSync(path.join(pkg, "scripts", "rogue.mjs"), "export const x = 1;\n");
  const out = path.join(tmp("rcpt"), "should-not-exist.json");
  const r = run([path.join(pkg, "scripts", "preflight.mjs"), "--receipt", out], { cwd: path.join(pkg, "scripts") });
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.ok(!fs.existsSync(out), "실패 상태의 receipt가 남으면 나중에 통과 증거로 오용된다");
});

test("digest receipt는 hashed package 안에 쓰지 못한다(자기참조 금지)", () => {
  const inside = path.join(ROOT, "references", "preflight.receipt.json");
  const r = run([CLI, "--receipt", inside]);
  assert.equal(r.code, PREFLIGHT_EXIT, r.out);
  assert.match(r.out, /refusing to write a digest receipt inside the hashed package/);
  assert.ok(!fs.existsSync(inside));
});

test("digest framing은 경로 경계 혼동에 취약하지 않다", () => {
  const dir = tmp("frame");
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "a", "b"), "x");
  fs.writeFileSync(path.join(dir, "ab"), "x");
  assert.notEqual(digestFiles(dir, ["a/b"]), digestFiles(dir, ["ab"]));
});

test("installed-runtime provenance는 source identity를 주장하지 않는다", () => {
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
