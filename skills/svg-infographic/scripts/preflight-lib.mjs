// preflight-lib.mjs — repo-local 소비 강제와 provenance의 기계 계약 (Wave 1 CP0).
//
// 방어 대상: 설치된 구버전 package(개인 설치본·복사본)를 조용히 소비하는 것.
// 핵심 규칙은 두 가지다.
//
//  1) expected skill root는 **실행 중인 entrypoint에서 파생하지 않는다**. entrypoint가
//     자기 위치로 root를 정하면 stale 설치본도 "자기 내부에서는 일관된 package"로
//     통과한다. canonical 기준은 현재 작업 cwd의 git repository root이며, 실행 중인
//     entrypoint 자신도 그 아래에 있어야 한다.
//  2) preflight receipt를 만들어 넘기지 않는다. production entrypoint가 매 실행마다
//     이 라이브러리를 직접 호출해 현재 표면을 재검증한다(receipt replay 불가).
//
// digest는 목적별로 분리하며 membership은 references/package-surface.yaml이 SSoT다.
import { readFileSync, readdirSync, realpathSync, lstatSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PREFLIGHT_EXIT = 7;
export const SKILL_LOCATOR = "skills/svg-infographic";
export const EXPECTED_ROOT_ENV = "SVGINFO_EXPECTED_SKILL_ROOT";
// production 실행에서 거부되는 override — fixture 전용 진입점에서만 허용한다.
export const FIXTURE_ONLY_ENV = ["SKIN_SKINS_DIR", "COMPOSE_TEXT_MEASURE_CLI"];

// ---------- fixture mode (test harness dependency injection) ----------
// production CLI에 사용자 옵션으로 노출하지 않는다. scripts/testing/run-cli.mjs만
// 이 스위치를 켜고 production 모듈을 import한다.
let fixtureMode = false;
export function enableFixtureMode() { fixtureMode = true; }
export function isFixtureMode() { return fixtureMode; }

export class PreflightError extends Error {}

function fail(msg) { throw new PreflightError(msg); }

const toPosix = (p) => p.split(path.sep).join("/");

export function isUnder(target, root) {
  return target === root || target.startsWith(root + path.sep);
}

// ---------- minimal YAML subset (package-surface manifest 전용) ----------
// 이 manifest는 검증의 근거이므로 관대한 파싱을 하지 않는다 — 예상 밖 문법은 오류다.
export function parseSurfaceManifest(text, label = "package-surface.yaml") {
  const doc = { entries: [] };
  let section = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!m) fail(`${label}:${i + 1}: unparsable top-level line "${line}"`);
      section = m[1];
      if (m[2] === "") { doc[section] = section === "entries" ? [] : {}; continue; }
      doc[section] = /^\d+$/.test(m[2]) ? Number(m[2]) : m[2];
      section = null;
      continue;
    }
    if (section === "entries") {
      const m = line.match(/^-\s*\{\s*(path|tree):\s*([^,}]+?)\s*,\s*kind:\s*([a-z-]+)\s*\}$/);
      if (!m) fail(`${label}:${i + 1}: entry must be "- { path|tree: <p>, kind: <k> }" (got "${line}")`);
      doc.entries.push({ [m[1]]: m[2].trim(), kind: m[3] });
      continue;
    }
    if (!section) fail(`${label}:${i + 1}: indented line outside a section`);
    const m = line.match(/^([a-zA-Z_]+):\s*(.+)$/);
    if (!m) fail(`${label}:${i + 1}: unparsable mapping "${line}"`);
    const v = m[2].trim();
    doc[section][m[1]] = v.startsWith("[")
      ? v.replace(/^\[|\]$/g, "").split(",").map((x) => x.trim()).filter(Boolean)
      : /^\d+$/.test(v) ? Number(v) : v;
  }
  return doc;
}

export function loadSurfaceManifest(skillRoot) {
  const p = path.join(skillRoot, "references", "package-surface.yaml");
  if (!existsSync(p)) fail(`package-surface manifest not found at ${SKILL_LOCATOR}/references/package-surface.yaml`);
  const doc = parseSurfaceManifest(readFileSync(p, "utf8"));
  if (doc.schema_version !== 1) fail(`package-surface schema_version must be 1 (got ${doc.schema_version})`);
  if (!Number.isFinite(Number(doc.surface_revision))) fail("package-surface surface_revision must be a number");
  if (Number(doc.canonicalization?.version) !== 1 || doc.canonicalization?.digest !== "sha256")
    fail("package-surface canonicalization must declare version 1 + sha256");
  if (!doc.entries.length) fail("package-surface declares no entries");
  return doc;
}

// ---------- package tree walk + classification ----------
// symlink는 tree 안에서 허용하지 않는다: 내부 symlink는 escape(외부 참조)와
// 중복 hashing 중 하나로 귀결되므로 정책을 하나로 고정한다(fail-closed).
export function walkPackage(skillRoot) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        let target = "unresolvable";
        try { target = realpathSync(abs); } catch { /* dangling */ }
        fail(`package tree contains a symlink: ${toPosix(path.relative(skillRoot, abs))} -> ${target} — package files must be regular files (symlink escape and duplicate hashing are both rejected)`);
      }
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.push(toPosix(path.relative(skillRoot, abs)));
      else fail(`package tree contains a non-regular file: ${toPosix(path.relative(skillRoot, abs))}`);
    }
  };
  walk(skillRoot);
  return out.sort();
}

export function classify(files, manifest) {
  const exact = new Map(), trees = [];
  for (const e of manifest.entries) {
    if (e.path) {
      if (exact.has(e.path)) fail(`package-surface declares "${e.path}" twice`);
      exact.set(e.path, e.kind);
    } else trees.push({ prefix: e.tree.replace(/\/+$/, "") + "/", kind: e.kind });
  }
  const kinds = new Map();
  const unclassified = [], ambiguous = [];
  for (const f of files) {
    const hits = [];
    if (exact.has(f)) hits.push(exact.get(f));
    for (const t of trees) if (f.startsWith(t.prefix)) hits.push(t.kind);
    if (hits.length === 0) unclassified.push(f);
    else if (hits.length > 1) ambiguous.push(f);
    else kinds.set(f, hits[0]);
  }
  const present = new Set(files);
  const missing = [...exact.keys()].filter((p) => !present.has(p));
  return { kinds, unclassified, ambiguous, missing };
}

// ---------- digests ----------
// framing: path + NUL + byteLength + NUL + bytes (충돌 없는 경계), 상대경로 정렬.
// 절대경로·mtime·mode는 포함하지 않는다.
export function digestFiles(skillRoot, relFiles) {
  const h = createHash("sha256");
  for (const rel of [...relFiles].sort()) {
    const bytes = readFileSync(path.join(skillRoot, rel));
    h.update(Buffer.from(rel, "utf8"));
    h.update(Buffer.from([0]));
    h.update(Buffer.from(String(bytes.length), "utf8"));
    h.update(Buffer.from([0]));
    h.update(bytes);
  }
  return `sha256:${h.digest("hex")}`;
}

export function digestSets(skillRoot, kinds, manifest) {
  const sets = manifest.digest_sets ?? {};
  const byKind = (wanted) => [...kinds.entries()].filter(([, k]) => wanted.includes(k)).map(([f]) => f);
  const out = {};
  for (const [name, wanted] of Object.entries(sets)) out[name] = digestFiles(skillRoot, byKind(wanted));
  return out;
}

// ---------- import closure ----------
// production 코드는 node: builtin과 package 내부 relative import만 사용한다.
// (bare import는 외부 설치 트리를 끌어들이는 경로가 되므로 금지.)
const PRODUCTION_KINDS = ["production-entrypoint", "production-lib"];
export function importClosure(skillRoot, kinds) {
  const problems = [];
  for (const [rel, kind] of kinds) {
    if (!PRODUCTION_KINDS.includes(kind) || !rel.endsWith(".mjs")) continue;
    const src = readFileSync(path.join(skillRoot, rel), "utf8");
    const specs = [...src.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g)].map((m) => m[1]);
    specs.push(...[...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
    for (const spec of specs) {
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".")) { problems.push(`${rel}: bare import "${spec}" — production code may import node: builtins and package-relative paths only`); continue; }
      const target = path.resolve(path.dirname(path.join(skillRoot, rel)), spec);
      if (!isUnder(target, skillRoot)) problems.push(`${rel}: relative import "${spec}" escapes the package`);
    }
  }
  return problems;
}

// ---------- expected skill root ----------
export function resolveExpectedSkillRoot({ cwd = process.cwd(), explicit = process.env[EXPECTED_ROOT_ENV] } = {}) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim())
    fail(`the working directory is not inside a git repository (${cwd}) — the expected skill root is derived from the repository you are working in, never from the running script`);
  const repoRoot = realpathSync(r.stdout.trim());
  const expected = path.join(repoRoot, ...SKILL_LOCATOR.split("/"));
  if (!existsSync(expected)) fail(`the working repository has no ${SKILL_LOCATOR} (looked in ${repoRoot})`);
  const skillRoot = realpathSync(expected);
  if (explicit) {
    // 상속받은 expected root는 신뢰가 아니라 대조 대상이다 — env로 root를 바꿀 수 없다.
    let inherited;
    try { inherited = realpathSync(explicit); } catch { fail(`${EXPECTED_ROOT_ENV} points at a missing path`); }
    if (inherited !== skillRoot)
      fail(`${EXPECTED_ROOT_ENV} disagrees with the working repository (inherited ${inherited}, expected ${path.join(repoRoot, SKILL_LOCATOR)})`);
  }
  return { repoRoot, skillRoot };
}

// ---------- main entry: 매 실행 재검증 ----------
let current = null;

export function runPreflight({ entrypointUrl, cwd = process.cwd(), consumes = [] } = {}) {
  const { repoRoot, skillRoot } = resolveExpectedSkillRoot({ cwd });
  if (entrypointUrl) {
    const entry = realpathSync(fileURLToPath(entrypointUrl));
    if (!isUnder(entry, skillRoot))
      fail(`the running entrypoint is outside the expected skill root — entrypoint ${entry}, expected ${skillRoot} (a stale or copied installation cannot validate itself)`);
  }
  // fixture 전용 override는 **그 값을 실제로 소비하는 entrypoint**가 선언해 거부한다.
  // 무관한 자식 프로세스까지 일괄 거부하면 오탐이 생기고(부모의 fixture 주입이 자식의
  // production 실행을 깨뜨린다), 실제 우회는 소비 지점의 fixtureOverride()가 막는다.
  if (!fixtureMode) {
    for (const name of consumes) {
      if (!FIXTURE_ONLY_ENV.includes(name)) fail(`preflight: "${name}" is not a declared fixture-only override`);
      if (process.env[name] !== undefined)
        fail(`${name} is set — package-owned lookups may not be redirected in a production run (fixture-only injection lives in scripts/testing/run-cli.mjs)`);
    }
  }
  const manifest = loadSurfaceManifest(skillRoot);
  const files = walkPackage(skillRoot);
  const { kinds, unclassified, ambiguous, missing } = classify(files, manifest);
  if (unclassified.length) fail(`package-surface does not classify ${unclassified.length} file(s): ${unclassified.slice(0, 5).join(", ")}${unclassified.length > 5 ? " ..." : ""}`);
  if (ambiguous.length) fail(`package-surface classifies ${ambiguous.length} file(s) more than once: ${ambiguous.slice(0, 5).join(", ")}`);
  if (missing.length) fail(`package-surface declares missing file(s): ${missing.join(", ")}`);
  const runtimeKinds = manifest.digest_sets?.runtimeSurfaceDigest ?? [];
  const runtimeFiles = [...kinds.entries()].filter(([, k]) => runtimeKinds.includes(k)).map(([f]) => f);
  const runtimeSurfaceDigest = digestFiles(skillRoot, runtimeFiles);
  // 자식 프로세스도 같은 expected root로 재검증한다(신뢰가 아니라 대조).
  process.env[EXPECTED_ROOT_ENV] = skillRoot;
  current = { repoRoot, skillRoot, manifest, kinds, files, runtimeSurfaceDigest };
  return current;
}

// production entrypoint가 부르는 형태: 위반이면 진단 후 non-zero 종료.
export function preflight(opts = {}) {
  try {
    return runPreflight(opts);
  } catch (e) {
    if (!(e instanceof PreflightError)) throw e;
    console.error(`preflight: ${e.message}`);
    console.error("preflight: run from the repository that owns the skill package; do not consume an installed copy.");
    process.exit(PREFLIGHT_EXIT);
  }
}

export function state() { return current; }

// ---------- 간접 경로 containment ----------
// registry가 고른 profile, manifest의 spec/verifier/fixtures, CLI로 전달된
// package-owned 경로는 resolve 시점에 검사한다. 사용자 입력(SVG/plan/출력
// 디렉터리)과 browser 실행 파일은 대상이 아니다.
export function assertPackagePath(target, label) {
  // fixture 진입점은 package-owned lookup을 의도적으로 임시 트리로 돌린다 —
  // 이 모드에서는 containment를 적용하지 않는다(production 경로는 그대로 강제).
  if (fixtureMode) return path.resolve(target);
  const st = current ?? runPreflight({});
  let real;
  try { real = realpathSync(target); } catch { fail(`${label} does not exist: ${target}`); }
  if (!isUnder(real, st.skillRoot))
    fail(`${label} resolves outside the skill package (${real}) — package-owned lookups must stay inside ${SKILL_LOCATOR}`);
  return real;
}

export function guardPackagePath(target, label) {
  try {
    return assertPackagePath(target, label);
  } catch (e) {
    if (!(e instanceof PreflightError)) throw e;
    console.error(`preflight: ${e.message}`);
    process.exit(PREFLIGHT_EXIT);
  }
}

// fixture 전용 override 읽기: production 실행에서 값이 있으면 실패한다.
export function fixtureOverride(name) {
  const v = process.env[name];
  if (v === undefined) return undefined;
  if (!fixtureMode) {
    console.error(`preflight: ${name} is set — package-owned lookups may not be redirected in a production run`);
    process.exit(PREFLIGHT_EXIT);
  }
  return v;
}

// ---------- provenance ----------
// repository에 commit되는 artifact receipt는 자신의 commit SHA를 담지 않는다.
// 실제 testedCommit은 repository 밖 clean CI acceptance receipt가 기록한다.
export const PROVENANCE_SCHEMA = { name: "svg-infographic-provenance", version: 1, canonicalization: 1 };

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function provenance({ producer, inputs = [], browser = null, cwd = process.cwd() } = {}) {
  const st = current ?? runPreflight({ cwd });
  const head = git(["rev-parse", "HEAD"], st.repoRoot);
  const repoStatus = git(["status", "--porcelain"], st.repoRoot);
  const runtimeKinds = st.manifest.digest_sets?.runtimeSurfaceDigest ?? [];
  const runtimeRel = [...st.kinds.entries()].filter(([, k]) => runtimeKinds.includes(k)).map(([f]) => f);
  const runtimeStatus = git(["status", "--porcelain", "--", ...runtimeRel.map((f) => `${SKILL_LOCATOR}/${f}`)], st.repoRoot);
  if (!producer || !["generator", "agent-authored"].includes(producer.kind))
    fail('provenance requires producer.kind "generator" or "agent-authored"');
  if (producer.kind === "generator" && !producer.generatorDigest) fail("generator provenance requires generatorDigest");
  if (producer.kind === "agent-authored") {
    if (!producer.authoringContract) fail("agent-authored provenance requires an authoringContract identity");
    if (!producer.promptDigest && !inputs.length) fail("agent-authored provenance requires a promptDigest or input digests");
    if (producer.generatorDigest) fail("agent-authored provenance must not carry a generatorDigest");
  }
  return {
    schema: PROVENANCE_SCHEMA,
    skillRoot: SKILL_LOCATOR,
    package: { id: "svg-infographic", surfaceRevision: Number(st.manifest.surface_revision) },
    sourceHeadCommit: head,
    repoDirty: repoStatus === null ? null : repoStatus.length > 0,
    runtimeSurfaceDirty: runtimeStatus === null ? null : runtimeStatus.length > 0,
    runtimeSurfaceDigest: st.runtimeSurfaceDigest,
    producer,
    inputs,
    browser,
  };
}

// receipt는 값을 신뢰하지 않고 현재 파일에서 재계산해 대조한다.
export function verifyProvenance(receiptProv, { cwd = process.cwd() } = {}) {
  const st = current ?? runPreflight({ cwd });
  const errors = [];
  if (receiptProv?.schema?.name !== PROVENANCE_SCHEMA.name || receiptProv?.schema?.version !== PROVENANCE_SCHEMA.version)
    errors.push("E-PROV-SCHEMA provenance schema identity mismatch");
  if (receiptProv?.skillRoot !== SKILL_LOCATOR) errors.push(`E-PROV-LOCATOR skillRoot must be the logical locator "${SKILL_LOCATOR}"`);
  if (typeof receiptProv?.runtimeSurfaceDigest !== "string" || !receiptProv.runtimeSurfaceDigest.startsWith("sha256:"))
    errors.push("E-PROV-DIGEST runtimeSurfaceDigest must be a full sha256 digest");
  else if (receiptProv.runtimeSurfaceDigest !== st.runtimeSurfaceDigest)
    errors.push(`E-PROV-DIGEST runtimeSurfaceDigest ${receiptProv.runtimeSurfaceDigest.slice(0, 20)}… != recomputed ${st.runtimeSurfaceDigest.slice(0, 20)}…`);
  if (JSON.stringify(receiptProv ?? {}).includes(st.skillRoot)) errors.push("E-PROV-PATH provenance leaks an absolute local path");
  if (receiptProv?.producer?.kind === "agent-authored" && receiptProv.producer.generatorDigest)
    errors.push("E-PROV-PRODUCER agent-authored provenance must not claim a generatorDigest");
  return errors;
}
