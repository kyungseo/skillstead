// preflight-lib.mjs — the machine contract for the package consumption boundary and provenance (Wave 1 CP0).
//
// The two execution contexts have different requirements, so the **modes are separate**.
// Merging them would let a development-only rule block the normal execution of an installed
// skill (CP0-R1-F1).
//
//   source-development  when working inside the repository that owns this package.
//                       The expected root is set by the working repository (the git root of
//                       cwd plus skills/svg-infographic), and an entrypoint running outside
//                       it is refused — a stale installed copy cannot vouch for itself. Wave
//                       acceptance artifacts accept provenance from this mode only.
//   installed-runtime   when running an installed package inside a user project.
//                       The package root is found from the running entrypoint and does not
//                       depend on the user's cwd or on git being present. It claims no source
//                       commit identity and records only the installed package identity.
//
// The mode cannot be chosen in the looser direction: if the working repository owns this
// package the mode is always source-development, and running an outside entrypoint in that
// state is an error.
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

// ---------- minimal YAML subset (for the package-surface manifest only) ----------
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
  if (Number(doc.canonicalization?.version) !== 2 || doc.canonicalization?.digest !== "sha256"
      || doc.canonicalization?.runtime_normalization !== "SKILL.md-frontmatter-metadata.version-to-@VERSION@")
    fail("package-surface canonicalization must declare version 2 + sha256 + the exact SKILL.md metadata.version normalization");
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
// Runtime canonicalization has one deliberately narrow exception: release bookkeeping changes the
// package tree identity, but `SKILL.md` frontmatter metadata.version does not change generation
// behaviour. This is a semantic port of tools/skillstead_validate/normalize.py; the body and every
// other frontmatter scalar stay byte-sensitive.
export function normalizeSkillMetadataVersion(text) {
  const lines = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter((line, i, all) =>
    !(i === all.length - 1 && line === "")) ?? [];
  const out = [];
  let delimiters = 0;
  let currentTop = null;
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === "---" && delimiters < 2) {
      delimiters += 1;
      out.push(line);
      continue;
    }
    if (delimiters === 1) {
      if (line && !/^\s/u.test(line[0])) currentTop = line.split(":", 1)[0].trim();
      else if (currentTop === "metadata") {
        const withoutLf = line.replace(/\n+$/, "");
        const m = withoutLf.match(/^(\s+version:\s*)\S+(\s*)$/u);
        if (m) {
          out.push(`${m[1]}@VERSION@${m[2]}\n`);
          continue;
        }
      }
    }
    out.push(line);
  }
  return out.join("");
}

// framing: path + NUL + byteLength + NUL + bytes, sorted by relative path. Absolute paths and mtime excluded.
export function digestFiles(skillRoot, relFiles, { normalizeRuntime = false } = {}) {
  const h = createHash("sha256");
  for (const rel of [...relFiles].sort()) {
    const raw = readFileSync(path.join(skillRoot, rel));
    const bytes = normalizeRuntime && rel === "SKILL.md"
      ? Buffer.from(normalizeSkillMetadataVersion(raw.toString("utf8")), "utf8")
      : raw;
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
    out[name] = digestFiles(
      skillRoot,
      [...kinds.entries()].filter(([, k]) => wanted.includes(k)).map(([f]) => f),
      { normalizeRuntime: name === "runtimeSurfaceDigest" },
    );
  return out;
}

// ---------- import closure ----------
// It covers side-effect imports and export-from as well, and a non-static dynamic import is
// fail-closed. For a relative import it also checks that the resolved file exists and is
// contained (CP0-R1-F4).
const PRODUCTION_KINDS = ["production-entrypoint", "production-lib"];
export function importClosure(skillRoot, kinds) {
  const problems = [];
  // Block comments, comment-only lines and template literals are not code — they are masked
  // first so the scanner does not misread even its own diagnostic strings as imports. The
  // backtick is built from a character code: putting one in the regex source would itself
  // throw off the template boundaries.
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
    // Catches `import (x)`, `import/*c*/(x)` and newline variants too (comments were already replaced with spaces).
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

// The package root in an installed context: walk up from the running entrypoint looking for the surface manifest.
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

// The default is always installed-runtime. source-development is an **explicit opt-in**
// (the canonical Wave runner's --require-mode, or a mode handed down to a child), and even
// then it holds only when every ownership proof below is satisfied — so an arbitrary
// repository that merely copied the package into a directory cannot claim the Wave
// acceptance mode (CP0-R1B-F1).
export function resolveExecution({ entrypointUrl, cwd = process.cwd(), requireMode = null } = {}) {
  const requested = requireMode ?? process.env[EXECUTION_MODE_ENV] ?? null;
  if (requested && !MODES.includes(requested)) fail(`unknown execution mode "${requested}"`);
  // For a library call with no entrypoint given (a generator script producing provenance, for
  // instance) this file itself is the reference — that is what settles which package the
  // running code belongs to.
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
    // Ownership proof: the package identity file must be **tracked** in this repository.
    // A directory that was merely copied in cannot claim source-development.
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

  // An inherited expected root is something to check against, not something to trust.
  const inheritedRoot = process.env[EXPECTED_ROOT_ENV];
  if (inheritedRoot) {
    let real;
    try { real = realpathSync(inheritedRoot); } catch { fail(`${EXPECTED_ROOT_ENV} points at a missing path`); }
    if (real !== ctx.skillRoot) fail(`${EXPECTED_ROOT_ENV} disagrees with the resolved package (inherited ${real}, resolved ${ctx.skillRoot})`);
  }
  return { ...ctx, requestedMode: requested };
}

// ---------- main entry: re-verified on every run ----------
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
  const runtimeSurfaceDigest = digestFiles(
    skillRoot,
    [...kinds.entries()].filter(([, k]) => runtimeKinds.includes(k)).map(([f]) => f),
    { normalizeRuntime: true },
  );
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

// ---------- containment of indirect paths ----------
// A profile chosen by the registry, an indirect path from the manifest and a package-owned
// path passed on the CLI are all checked at resolve time. User input (SVG, plan, output) and
// the browser executable are not subjects of this check.
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
// Recomputable values (verified) are kept apart from run-time records (informational).
// Informational values are evidence, not verified claims; the real testedCommit is recorded by
// a clean CI acceptance receipt outside the package.
export const PROVENANCE_SCHEMA = { name: "svg-infographic-provenance", version: 1, canonicalization: 2 };
export const RECEIPT_SCHEMA = { name: "svg-infographic-preflight-receipt", version: 1 };
export const PROVENANCE_FIELDS = ["schema", "executionMode", "skillRoot", "package", "runtimeSurfaceDigest", "source", "producer", "inputs", "browser"];
// The verification level is split three ways to match what is actually checked — a verifier
// never calls a value it only shape-checked "verified" (CP0-R1B-F3).
export const PROVENANCE_EVIDENCE = {
  // Values recomputed from the current package and compared
  recomputed: ["executionMode", "skillRoot", "package", "runtimeSurfaceDigest"],
  // Values checked only for shape and union rules (promoted to recomputed only when an
  // artifact verifier holding the original locator recomputes the digest). The source block
  // has its **structure** checked too.
  shapeValidated: ["schema", "producer", "inputs", "browser", "source.structure"],
  // Run-time records — not recomputable, and not an authenticity claim
  informational: ["source.values"],
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

// Receipt values are not trusted: they are recomputed and re-verified against the current package.
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
  // source is run-time evidence that cannot be recomputed — only its presence rules and shape
  // are verified, and it is not treated as a "verified claim"
  // (PROVENANCE_EVIDENCE.informational).
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

// Strict schema verification of the preflight identity receipt (the three-digest proof).
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
