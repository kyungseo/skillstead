#!/usr/bin/env node
// preflight.mjs — the CLI surface at the package consumption boundary (Wave 1 CP0).
//
// usage:
//   node preflight.mjs [--json]                      verify the execution context, summarise digests
//   node preflight.mjs --require-mode <mode>          require source-development (Wave runner)
//   node preflight.mjs --receipt <path>               write a detached identity receipt
//   node preflight.mjs --staging <dir>                check a staging copy's packageTreeDigest
//   node preflight.mjs --verify-receipt <path>        recompute and verify a receipt against this package
//
// exit: 0 ok / 2 usage / 7 preflight violation or mismatch
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  preflight, PREFLIGHT_EXIT, SKILL_LOCATOR, PACKAGE_ID, digestSets, digestFiles,
  walkPackage, classify, loadSurfaceManifest, importClosure, isUnder,
  verifyProvenance, verifyIdentityReceipt, RECEIPT_SCHEMA, PROVENANCE_SCHEMA, MODES,
} from "./preflight-lib.mjs";

const argv = process.argv.slice(2);
const KNOWN = ["--json", "--receipt", "--staging", "--verify-receipt", "--require-mode"];
const opt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) { console.error(`usage: ${name} requires a value`); process.exit(2); }
  return v;
};
for (const a of argv) if (a.startsWith("--") && !KNOWN.includes(a)) { console.error(`preflight: unknown option ${a}`); process.exit(2); }

const requireMode = opt("--require-mode");
if (requireMode !== undefined && !MODES.includes(requireMode)) {
  console.error(`preflight: --require-mode must be one of ${MODES.join("|")}`); process.exit(2);
}

const st = preflight({ entrypointUrl: import.meta.url, requireMode: requireMode ?? null });
const sets = digestSets(st.skillRoot, st.kinds, st.manifest);
const errors = [...importClosure(st.skillRoot, st.kinds)];

// The manifest is the SSoT for the production entrypoint list. This static check is
// supporting evidence; the acceptance evidence is the executed negative in preflight.test.mjs
// (running an external copy exits 7).
function bindingCoverage(skillRoot, kinds) {
  const problems = [];
  for (const [rel, kind] of kinds) {
    if (kind === "production-entrypoint" && rel.endsWith(".mjs")) {
      const src = readFileSync(path.join(skillRoot, rel), "utf8");
      if (!/from\s+["']\.\/preflight-lib\.mjs["']/.test(src) || !/\bpreflight\s*\(\s*\{/.test(src))
        problems.push(`${rel}: production entrypoint does not call preflight() from preflight-lib.mjs`);
    }
    if (kind === "production-shim") {
      const src = readFileSync(path.join(skillRoot, rel), "utf8");
      const bound = [...kinds.entries()].some(([r, k]) => k === "production-entrypoint" && src.includes(path.basename(r)));
      if (!bound) problems.push(`${rel}: production shim does not delegate to a preflight-bound entrypoint`);
    }
  }
  return problems;
}
errors.push(...bindingCoverage(st.skillRoot, st.kinds));

const staging = opt("--staging");
let stagingReport = null;
if (staging) {
  const dir = path.resolve(staging);
  if (!existsSync(dir)) { console.error(`preflight: staging directory not found: ${staging}`); process.exit(PREFLIGHT_EXIT); }
  try {
    const manifest = loadSurfaceManifest(dir);
    const files = walkPackage(dir);
    const c = classify(files, manifest);
    const originFiles = new Set(st.files), copyFiles = new Set(files);
    const missing = [...originFiles].filter((f) => !copyFiles.has(f));
    const extra = [...copyFiles].filter((f) => !originFiles.has(f));
    const treeKinds = manifest.digest_sets?.packageTreeDigest ?? [];
    const stagingDigest = c.unclassified.length || c.ambiguous.length || c.missing.length
      ? null
      : digestFiles(dir, [...c.kinds.entries()].filter(([, k]) => treeKinds.includes(k)).map(([f]) => f));
    stagingReport = { origin: sets.packageTreeDigest, staging: stagingDigest, missing, extra,
      unclassified: c.unclassified, identical: stagingDigest === sets.packageTreeDigest };
    if (!stagingReport.identical)
      errors.push(`staging copy packageTreeDigest differs from the origin package (${missing.length} missing, ${extra.length} extra${stagingDigest ? "" : ", classification failed"}) — a discovery check may only claim equivalence on an identical tree`);
  } catch (e) {
    errors.push(`staging copy rejected: ${e.message}`);
    stagingReport = { origin: sets.packageTreeDigest, staging: null, identical: false };
  }
}

const verifyPath = opt("--verify-receipt");
let verifyReport = null;
if (verifyPath) {
  let doc;
  try { doc = JSON.parse(readFileSync(path.resolve(verifyPath), "utf8")); }
  catch (e) { console.error(`preflight: unreadable receipt: ${e.message}`); process.exit(PREFLIGHT_EXIT); }
  // The receipt kind is decided by **schema identity** — this blocks the relabel bypass of
  // skipping verification by changing the command label (CP0-R1-F3).
  let verrs;
  if (doc?.schema?.name === RECEIPT_SCHEMA.name) verrs = verifyIdentityReceipt(doc);
  else if (doc?.provenance?.schema?.name === PROVENANCE_SCHEMA.name) {
    verrs = verifyProvenance(doc.provenance);
    for (const [name, want] of Object.entries(doc.digests ?? {})) {
      if (sets[name] === undefined) verrs.push(`E-PROV-DIGEST unknown digest set "${name}"`);
      else if (sets[name] !== want) verrs.push(`E-PROV-DIGEST ${name} ${String(want).slice(0, 20)}… != recomputed ${sets[name].slice(0, 20)}…`);
    }
  } else {
    verrs = [`E-RCPT-SCHEMA receipt carries neither a ${RECEIPT_SCHEMA.name} schema nor a ${PROVENANCE_SCHEMA.name} provenance block — unverifiable receipts are rejected`];
  }
  verifyReport = { file: path.basename(verifyPath), errors: verrs };
  errors.push(...verrs);
}

const receipt = {
  schema: { ...RECEIPT_SCHEMA },
  executionMode: st.mode,
  skillRoot: SKILL_LOCATOR,
  package: { id: PACKAGE_ID, surfaceRevision: Number(st.manifest.surface_revision) },
  canonicalization: st.manifest.canonicalization,
  digests: sets,
  fileCount: st.files.length,
};

const receiptPath = opt("--receipt");
if (receiptPath) {
  const abs = path.resolve(receiptPath);
  // No self-reference: a digest receipt is never written inside the hashed package.
  if (isUnder(abs, st.skillRoot)) {
    console.error(`preflight: refusing to write a digest receipt inside the hashed package (${SKILL_LOCATOR}) — receipts are detached evidence or CI artifacts`);
    process.exit(PREFLIGHT_EXIT);
  }
  // If there is even one violation no receipt is written — this removes the path where
  // evidence of a failed state is later read as evidence of a pass.
  if (errors.length) {
    console.error("preflight: refusing to write a receipt while checks are failing:");
    for (const e of errors) console.error(`  ERROR ${e}`);
    process.exit(PREFLIGHT_EXIT);
  }
  writeFileSync(abs, JSON.stringify(receipt, null, 1) + "\n");
}

const out = { ...receipt, staging: stagingReport, verify: verifyReport, errors };
if (argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`preflight ${SKILL_LOCATOR} [${st.mode}] (surface rev ${receipt.package.surfaceRevision}) — ${st.files.length} file(s), ${errors.length} error(s)`);
  for (const [k, v] of Object.entries(sets)) console.log(`  ${k} ${v}`);
  if (stagingReport) console.log(`  staging ${stagingReport.identical ? "identical" : "DIFFERENT"}`);
  for (const e of errors) console.error(`  ERROR ${e}`);
}
process.exit(errors.length ? PREFLIGHT_EXIT : 0);
