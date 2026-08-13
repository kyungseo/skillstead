// preflight-lib.mjs — package 소비 경계와 provenance의 기계 계약 (Wave 1 CP0).
//
// 두 실행 문맥은 요구가 다르므로 **모드를 분리**한다. 하나로 묶으면 개발용 규칙이
// 설치된 skill의 정상 실행까지 막는다(CP0-R1-F1).
//
//   source-development  이 package를 소유한 repository 안에서 작업할 때.
//                       expected root는 작업 repository(cwd의 git root +
//                       skills/svg-infographic)가 정하고, 실행 중인 entrypoint가 그
//                       아래가 아니면 거부한다 — stale 설치본이 자기 자신을 정당화하지
//                       못한다. Wave acceptance artifact는 이 모드의 provenance만 인정.
//   installed-runtime   설치된 package를 사용자 프로젝트에서 실행할 때.
//                       package root는 실행 entrypoint에서 찾고 사용자 cwd나 git 유무에
//                       의존하지 않는다. source commit 동일성은 주장하지 않고 installed
//                       package identity만 기록한다.
//
// 모드는 느슨한 쪽으로 선택할 수 없다: 작업 repository가 이 package를 소유하면 항상
// source-development이며, 그 상태에서 외부 entrypoint 실행은 오류다.
import { readFileSync, readdirSync, realpathSync, lstatSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PREFLIGHT_EXIT = 7;
export const SKILL_LOCATOR = "skills/svg-infographic";
export const PACKAGE_ID = "svg-infographic";
export const EXPECTED_ROOT_ENV = "SVGINFO_EXPECTED_SKILL_ROOT";
export const EXECUTION_MODE_ENV = "SVGINFO_EXECUTION_MODE";
export const EXPECTED_REPO_ENV = "SVGINFO_EXPECTED_REPO_ROOT";
export const MODES = ["source-development", "installed-runtime"];
const SURFACE_MANIFEST = ["references", "package-surface.yaml"];
export const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export class PreflightError extends Error {}
function fail(msg) { throw new PreflightError(msg); }

const toPosix = (p) => p.split(path.sep).join("/");
export function isUnder(target, root) {
  return target === root || target.startsWith(root + path.sep);
}

// ---------- minimal YAML subset (package-surface manifest 전용) ----------
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
  const p = path.join(skillRoot, ...SURFACE_MANIFEST);
  if (!existsSync(p)) fail(`package-surface manifest not found at ${SURFACE_MANIFEST.join("/")}`);
  const doc = parseSurfaceManifest(readFileSync(p, "utf8"));
  if (doc.schema_version !== 1) fail(`package-surface schema_version must be 1 (got ${doc.schema_version})`);
  if (!Number.isFinite(Number(doc.surface_revision))) fail("package-surface surface_revision must be a number");
  if (Number(doc.canonicalization?.version) !== 1 || doc.canonicalization?.digest !== "sha256")
    fail("package-surface canonicalization must declare version 1 + sha256");
  if (!doc.entries.length) fail("package-surface declares no entries");
  return doc;
}

// ---------- package tree walk + classification ----------
export function walkPackage(skillRoot) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        let target = "unresolvable";
        try { target = realpathSync(abs); } catch { /* dangling */ }
        fail(`package tree contains a symlink: ${toPosix(path.relative(skillRoot, abs))} -> ${target} — package files must be regular files`);
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
// framing: path + NUL + byteLength + NUL + bytes, 상대경로 정렬. 절대경로·mtime 제외.
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
  const out = {};
  for (const [name, wanted] of Object.entries(sets))
    out[name] = digestFiles(skillRoot, [...kinds.entries()].filter(([, k]) => wanted.includes(k)).map(([f]) => f));
  return out;
}

// ---------- import closure ----------
// side-effect import와 export-from까지 포함하고, 비정적 dynamic import는 fail-closed다.
// relative import는 실제 resolved 파일의 존재와 containment까지 확인한다(CP0-R1-F4).
const PRODUCTION_KINDS = ["production-entrypoint", "production-lib"];
export function importClosure(skillRoot, kinds) {
  const problems = [];
  // block comment·전용 주석 줄·template literal은 코드가 아니다 — 스캐너 자신의
  // 진단 문자열까지 import로 오탐하지 않도록 먼저 마스킹한다. backtick은 문자 코드로
  // 만든다: 정규식 소스에 backtick을 두면 그 자신이 template 경계를 어긋나게 한다.
  const BT = String.fromCharCode(96);
  const TEMPLATE = new RegExp(BT + "(?:\\\\.|[^" + BT + "\\\\])*" + BT, "g");
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n")
    .replace(TEMPLATE, '""');
  for (const [rel, kind] of kinds) {
    if (!PRODUCTION_KINDS.includes(kind) || !rel.endsWith(".mjs")) continue;
    const abs = path.join(skillRoot, rel);
    const src = strip(readFileSync(abs, "utf8"));
    const specs = [];
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g)) specs.push(m[1]);
    for (const m of src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']\s*;?/g)) specs.push(m[1]);   // side-effect import
    // `import (x)`·`import/*c*/(x)`·줄바꿈 변형까지 잡는다(주석은 앞서 공백으로 치환됨).
    for (const m of src.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)) {
      const arg = m[1].trim();
      const lit = arg.match(/^["']([^"']+)["']$/);
      if (lit) specs.push(lit[1]);
      else problems.push(`${rel}: non-literal dynamic import(${arg.slice(0, 40)}) — production code may not compute module specifiers`);
    }
    for (const spec of specs) {
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".")) { problems.push(`${rel}: bare import "${spec}" — production code may import node: builtins and package-relative paths only`); continue; }
      const target = path.resolve(path.dirname(abs), spec);
      if (!isUnder(target, skillRoot)) { problems.push(`${rel}: relative import "${spec}" escapes the package`); continue; }
      if (!existsSync(target)) problems.push(`${rel}: relative import "${spec}" does not resolve to a file in the package`);
    }
  }
  return problems;
}

// ---------- execution context ----------
function gitRoot(cwd) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) return null;
  try { return realpathSync(r.stdout.trim()); } catch { return null; }
}

// 설치 문맥의 package root: 실행 entrypoint에서 위로 올라가며 surface manifest를 찾는다.
export function findPackageRoot(entryReal) {
  let dir = path.dirname(entryReal);
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, ...SURFACE_MANIFEST))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

// 기본값은 항상 installed-runtime이다. source-development는 **명시적 opt-in**이며
// (canonical Wave runner의 --require-mode 또는 자식에게 전달된 mode), opt-in이라도
// 아래 소유 증거를 모두 만족할 때만 성립한다 — 디렉터리에 package를 복사해 둔 임의
// repository가 Wave acceptance 모드를 주장하지 못하게 한다(CP0-R1B-F1).
export function resolveExecution({ entrypointUrl, cwd = process.cwd(), requireMode = null } = {}) {
  const requested = requireMode ?? process.env[EXECUTION_MODE_ENV] ?? null;
  if (requested && !MODES.includes(requested)) fail(`unknown execution mode "${requested}"`);
  // entrypoint를 주지 않은 라이브러리 호출(생성 script가 provenance를 만드는 경우 등)에는
  // 이 파일 자신이 기준이다 — 실행 중인 코드가 어느 package의 것인지는 그것으로 정해진다.
  const entry = realpathSync(fileURLToPath(entrypointUrl ?? import.meta.url));
  const installedRoot = findPackageRoot(entry);
  if (!installedRoot) fail(`cannot locate the package root from the running entrypoint — a package must contain ${SURFACE_MANIFEST.join("/")}`);

  let ctx = { mode: "installed-runtime", skillRoot: installedRoot, repoRoot: null };
  if (requested === "source-development") {
    const repoRoot = gitRoot(cwd);
    if (!repoRoot) fail(`source-development was requested but the working directory is not inside a git repository (cwd ${cwd})`);
    const candidate = path.join(repoRoot, ...SKILL_LOCATOR.split("/"));
    if (!existsSync(path.join(candidate, ...SURFACE_MANIFEST)))
      fail(`source-development was requested but the working repository does not carry ${SKILL_LOCATOR} (repo ${repoRoot})`);
    const sourceRoot = realpathSync(candidate);
    if (!isUnder(entry, sourceRoot))
      fail(`the running entrypoint is outside the package owned by this working repository — entrypoint ${entry}, expected under ${sourceRoot} (a stale or copied installation cannot validate itself)`);
    if (sourceRoot !== installedRoot)
      fail(`the running package (${installedRoot}) is not the package owned by this working repository (${sourceRoot})`);
    // 소유 증거: package identity 파일이 이 repository에 **추적되고 있어야** 한다.
    // 단순히 복사해 둔 디렉터리는 source-development를 주장할 수 없다.
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", `${SKILL_LOCATOR}/${SURFACE_MANIFEST.join("/")}`],
      { cwd: repoRoot, encoding: "utf8" });
    if (tracked.status !== 0)
      fail(`source-development requires ${SKILL_LOCATOR} to be tracked source of this repository — ${SURFACE_MANIFEST.join("/")} is not in the git index of ${repoRoot}`);
    const expectedRepo = process.env[EXPECTED_REPO_ENV];
    if (expectedRepo) {
      let real;
      try { real = realpathSync(expectedRepo); } catch { fail(`${EXPECTED_REPO_ENV} points at a missing path`); }
      if (real !== repoRoot) fail(`${EXPECTED_REPO_ENV} disagrees with the working repository (expected ${real}, resolved ${repoRoot})`);
    }
    ctx = { mode: "source-development", skillRoot: sourceRoot, repoRoot };
  }
  if (requireMode && ctx.mode !== requireMode)
    fail(`this operation requires ${requireMode} execution but resolved ${ctx.mode}`);

  // 상속된 expected root는 신뢰가 아니라 대조 대상이다.
  const inheritedRoot = process.env[EXPECTED_ROOT_ENV];
  if (inheritedRoot) {
    let real;
    try { real = realpathSync(inheritedRoot); } catch { fail(`${EXPECTED_ROOT_ENV} points at a missing path`); }
    if (real !== ctx.skillRoot) fail(`${EXPECTED_ROOT_ENV} disagrees with the resolved package (inherited ${real}, resolved ${ctx.skillRoot})`);
  }
  return { ...ctx, requestedMode: requested };
}

// ---------- main entry: 매 실행 재검증 ----------
let current = null;

export function runPreflight({ entrypointUrl, cwd = process.cwd(), requireMode = null } = {}) {
  const { mode, skillRoot, repoRoot, requestedMode } = resolveExecution({ entrypointUrl, cwd, requireMode });
  const manifest = loadSurfaceManifest(skillRoot);
  const files = walkPackage(skillRoot);
  const { kinds, unclassified, ambiguous, missing } = classify(files, manifest);
  if (unclassified.length) fail(`package-surface does not classify ${unclassified.length} file(s): ${unclassified.slice(0, 5).join(", ")}${unclassified.length > 5 ? " ..." : ""}`);
  if (ambiguous.length) fail(`package-surface classifies ${ambiguous.length} file(s) more than once: ${ambiguous.slice(0, 5).join(", ")}`);
  if (missing.length) fail(`package-surface declares missing file(s): ${missing.join(", ")}`);
  const runtimeKinds = manifest.digest_sets?.runtimeSurfaceDigest ?? [];
  const runtimeSurfaceDigest = digestFiles(skillRoot, [...kinds.entries()].filter(([, k]) => runtimeKinds.includes(k)).map(([f]) => f));
  process.env[EXPECTED_ROOT_ENV] = skillRoot;
  process.env[EXECUTION_MODE_ENV] = mode;
  current = { mode, requestedMode, repoRoot, skillRoot, manifest, kinds, files, runtimeSurfaceDigest };
  return current;
}

export function preflight(opts = {}) {
  try {
    return runPreflight(opts);
  } catch (e) {
    if (!(e instanceof PreflightError)) throw e;
    console.error(`preflight: ${e.message}`);
    process.exit(PREFLIGHT_EXIT);
  }
}

export function state() { return current; }

// ---------- 간접 경로 containment ----------
// registry가 고른 profile, manifest 간접 경로, CLI로 전달된 package-owned 경로는
// resolve 시점에 검사한다. 사용자 입력(SVG·plan·출력)과 browser 실행 파일은 대상이 아니다.
export function assertPackagePath(target, label) {
  const st = current ?? runPreflight({});
  let real;
  try { real = realpathSync(target); } catch { fail(`${label} does not exist: ${target}`); }
  if (!isUnder(real, st.skillRoot))
    fail(`${label} resolves outside the skill package (${real}) — package-owned lookups must stay inside the package`);
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

// ---------- provenance ----------
// 재계산 가능한 값(verified)과 실행 시점 기록(informational)을 구분한다. informational은
// 검증된 주장이 아니라 증거이며, 실제 testedCommit은 package 밖 clean CI acceptance
// receipt가 기록한다.
export const PROVENANCE_SCHEMA = { name: "svg-infographic-provenance", version: 1, canonicalization: 1 };
export const RECEIPT_SCHEMA = { name: "svg-infographic-preflight-receipt", version: 1 };
export const PROVENANCE_FIELDS = ["schema", "executionMode", "skillRoot", "package", "runtimeSurfaceDigest", "source", "producer", "inputs", "browser"];
// 검증 수준을 실제 검사에 맞춰 3단으로 나눈다 — verifier가 형식만 본 값을
// "verified"로 부르지 않는다(CP0-R1B-F3).
export const PROVENANCE_EVIDENCE = {
  // 현재 package에서 다시 계산해 대조한 값
  recomputed: ["executionMode", "skillRoot", "package", "runtimeSurfaceDigest"],
  // 형태·union 규칙만 확인한 값 (원본 locator를 받은 artifact verifier가 digest를
  // 재계산할 때만 recomputed로 승격된다)
  shapeValidated: ["schema", "producer", "inputs", "browser"],
  // 실행 시점 기록 — 재계산 불가능하며 검증된 주장이 아니다
  informational: ["source"],
};

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function validateProducer(producer, report) {
  if (!producer || !["generator", "agent-authored"].includes(producer.kind))
    return report('provenance requires producer.kind "generator" or "agent-authored"');
  const allowed = producer.kind === "generator"
    ? ["kind", "generatorDigest"]
    : ["kind", "promptDigest", "inputDigest", "authoringContract"];
  for (const k of Object.keys(producer)) if (!allowed.includes(k)) report(`producer(${producer.kind}) has unknown field "${k}"`);
  if (producer.kind === "generator") {
    if (!DIGEST_RE.test(String(producer.generatorDigest))) report("generator provenance requires generatorDigest as sha256:<64 hex>");
  } else {
    if (!producer.authoringContract) report("agent-authored provenance requires an authoringContract identity");
    if (!producer.promptDigest && !producer.inputDigest) report("agent-authored provenance requires a promptDigest or inputDigest");
    for (const k of ["promptDigest", "inputDigest"])
      if (producer[k] !== undefined && !DIGEST_RE.test(String(producer[k]))) report(`agent-authored ${k} must be sha256:<64 hex>`);
  }
}

export function provenance({ producer, inputs = [], browser = null, cwd = process.cwd() } = {}) {
  const st = current ?? runPreflight({ cwd });
  validateProducer(producer, fail);
  for (const i of inputs) {
    if (!i || typeof i.role !== "string" || !DIGEST_RE.test(String(i.digest)))
      fail("each provenance input requires { role, digest: sha256:<64 hex> }");
    for (const k of Object.keys(i)) if (!["role", "digest"].includes(k)) fail(`provenance input has unknown field "${k}"`);
  }
  let source = null;
  if (st.mode === "source-development") {
    const runtimeKinds = st.manifest.digest_sets?.runtimeSurfaceDigest ?? [];
    const runtimeRel = [...st.kinds.entries()].filter(([, k]) => runtimeKinds.includes(k)).map(([f]) => f);
    const repoStatus = git(["status", "--porcelain"], st.repoRoot);
    const runtimeStatus = git(["status", "--porcelain", "--", ...runtimeRel.map((f) => `${SKILL_LOCATOR}/${f}`)], st.repoRoot);
    source = {
      headCommit: git(["rev-parse", "HEAD"], st.repoRoot),
      repoDirty: repoStatus === null ? null : repoStatus.length > 0,
      runtimeSurfaceDirty: runtimeStatus === null ? null : runtimeStatus.length > 0,
    };
  }
  return {
    schema: { ...PROVENANCE_SCHEMA },
    executionMode: st.mode,
    skillRoot: SKILL_LOCATOR,
    package: { id: PACKAGE_ID, surfaceRevision: Number(st.manifest.surface_revision) },
    runtimeSurfaceDigest: st.runtimeSurfaceDigest,
    source,
    producer,
    inputs,
    browser,
  };
}

// receipt 값은 신뢰하지 않고 현재 package에서 재계산·재검증한다.
export function verifyProvenance(prov, { cwd = process.cwd() } = {}) {
  const st = current ?? runPreflight({ cwd });
  const errors = [];
  const push = (m) => errors.push(`E-PROV-SHAPE ${m}`);
  if (!prov || typeof prov !== "object") return ["E-PROV-SHAPE provenance is not an object"];
  for (const k of Object.keys(prov)) if (!PROVENANCE_FIELDS.includes(k)) push(`provenance has unknown field "${k}"`);
  for (const k of PROVENANCE_FIELDS) if (!(k in prov)) push(`provenance is missing field "${k}"`);
  if (prov.schema?.name !== PROVENANCE_SCHEMA.name || prov.schema?.version !== PROVENANCE_SCHEMA.version
      || prov.schema?.canonicalization !== PROVENANCE_SCHEMA.canonicalization)
    errors.push("E-PROV-SCHEMA provenance schema identity mismatch");
  if (!MODES.includes(prov.executionMode)) errors.push(`E-PROV-MODE unknown executionMode "${prov.executionMode}"`);
  else if (prov.executionMode !== st.mode) errors.push(`E-PROV-MODE receipt executionMode "${prov.executionMode}" != current "${st.mode}"`);
  if (prov.skillRoot !== SKILL_LOCATOR) errors.push(`E-PROV-LOCATOR skillRoot must be the logical locator "${SKILL_LOCATOR}"`);
  if (prov.package?.id !== PACKAGE_ID) errors.push(`E-PROV-PACKAGE package.id "${prov.package?.id}" != "${PACKAGE_ID}"`);
  if (Number(prov.package?.surfaceRevision) !== Number(st.manifest.surface_revision))
    errors.push(`E-PROV-PACKAGE surfaceRevision ${prov.package?.surfaceRevision} != current ${st.manifest.surface_revision}`);
  for (const k of Object.keys(prov.package ?? {})) if (!["id", "surfaceRevision"].includes(k)) push(`package has unknown field "${k}"`);
  if (!DIGEST_RE.test(String(prov.runtimeSurfaceDigest))) errors.push("E-PROV-DIGEST runtimeSurfaceDigest must be sha256:<64 hex>");
  else if (prov.runtimeSurfaceDigest !== st.runtimeSurfaceDigest)
    errors.push(`E-PROV-DIGEST runtimeSurfaceDigest ${prov.runtimeSurfaceDigest.slice(0, 20)}… != recomputed ${st.runtimeSurfaceDigest.slice(0, 20)}…`);
  validateProducer(prov.producer, (m) => errors.push(`E-PROV-PRODUCER ${m}`));
  if (!Array.isArray(prov.inputs)) push("inputs must be an array");
  else for (const i of prov.inputs) {
    if (!DIGEST_RE.test(String(i?.digest))) errors.push("E-PROV-DIGEST every input digest must be sha256:<64 hex>");
    for (const k of Object.keys(i ?? {})) if (!["role", "digest"].includes(k)) push(`input has unknown field "${k}"`);
  }
  // source는 재계산 불가능한 실행 시점 증거다 — 존재 규칙과 형태만 검증하며
  // "검증된 주장"으로 취급하지 않는다(PROVENANCE_EVIDENCE.informational).
  if (prov.executionMode === "source-development") {
    if (!prov.source || typeof prov.source !== "object")
      errors.push("E-PROV-SOURCE source-development provenance requires a source block (informational evidence)");
    else {
      for (const k of Object.keys(prov.source)) if (!["headCommit", "repoDirty", "runtimeSurfaceDirty"].includes(k)) push(`source has unknown field "${k}"`);
      if (prov.source.headCommit !== null && !/^[0-9a-f]{40}$/.test(String(prov.source.headCommit)))
        errors.push("E-PROV-SOURCE source.headCommit must be a 40-hex commit id or null");
      for (const k of ["repoDirty", "runtimeSurfaceDirty"])
        if (!(typeof prov.source[k] === "boolean" || prov.source[k] === null))
          errors.push(`E-PROV-SOURCE source.${k} must be boolean or null`);
    }
  } else if (prov.source !== null) {
    errors.push("E-PROV-SOURCE installed-runtime provenance must not claim source identity (source: null)");
  }
  if (prov.browser !== null && (typeof prov.browser !== "object" || !prov.browser?.name || !prov.browser?.version))
    push("browser must be null or { name, version, ... }");
  if (JSON.stringify(prov).includes(st.skillRoot)) errors.push("E-PROV-PATH provenance leaks an absolute local path");
  return errors;
}

// preflight identity receipt(세 digest 증명)의 strict schema 검증.
export function verifyIdentityReceipt(doc, { cwd = process.cwd() } = {}) {
  const st = current ?? runPreflight({ cwd });
  const errors = [];
  const FIELDS = ["schema", "executionMode", "skillRoot", "package", "canonicalization", "digests", "fileCount"];
  if (doc?.schema?.name !== RECEIPT_SCHEMA.name || doc?.schema?.version !== RECEIPT_SCHEMA.version)
    return [`E-RCPT-SCHEMA receipt schema identity mismatch (expected ${RECEIPT_SCHEMA.name} v${RECEIPT_SCHEMA.version})`];
  for (const k of Object.keys(doc)) if (!FIELDS.includes(k)) errors.push(`E-RCPT-SHAPE receipt has unknown field "${k}"`);
  for (const k of FIELDS) if (!(k in doc)) errors.push(`E-RCPT-SHAPE receipt is missing field "${k}"`);
  if (doc.skillRoot !== SKILL_LOCATOR) errors.push(`E-RCPT-LOCATOR skillRoot must be "${SKILL_LOCATOR}"`);
  if (doc.package?.id !== PACKAGE_ID) errors.push(`E-RCPT-PACKAGE package.id "${doc.package?.id}" != "${PACKAGE_ID}"`);
  if (Number(doc.package?.surfaceRevision) !== Number(st.manifest.surface_revision))
    errors.push(`E-RCPT-PACKAGE surfaceRevision ${doc.package?.surfaceRevision} != current ${st.manifest.surface_revision}`);
  if (!MODES.includes(doc.executionMode)) errors.push(`E-RCPT-MODE unknown executionMode "${doc.executionMode}"`);
  else if (doc.executionMode !== st.mode)
    errors.push(`E-RCPT-MODE receipt executionMode "${doc.executionMode}" != current "${st.mode}" — a valid-but-different mode is still a different claim`);
  if (JSON.stringify(doc.canonicalization ?? {}) !== JSON.stringify(st.manifest.canonicalization))
    errors.push("E-RCPT-CANON canonicalization differs from the current package-surface manifest");
  const expected = digestSets(st.skillRoot, st.kinds, st.manifest);
  const want = Object.keys(expected).sort(), got = Object.keys(doc.digests ?? {}).sort();
  if (JSON.stringify(want) !== JSON.stringify(got))
    errors.push(`E-RCPT-DIGEST receipt must carry exactly [${want.join(", ")}] (got [${got.join(", ")}])`);
  for (const [name, v] of Object.entries(doc.digests ?? {})) {
    if (!DIGEST_RE.test(String(v))) errors.push(`E-RCPT-DIGEST ${name} must be sha256:<64 hex>`);
    else if (expected[name] !== undefined && expected[name] !== v)
      errors.push(`E-RCPT-DIGEST ${name} ${String(v).slice(0, 20)}… != recomputed ${expected[name].slice(0, 20)}…`);
  }
  if (Number(doc.fileCount) !== st.files.length) errors.push(`E-RCPT-FILES fileCount ${doc.fileCount} != current ${st.files.length}`);
  return errors;
}
