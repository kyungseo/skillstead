#!/usr/bin/env node
// preflight.mjs — repo-local 소비 계약의 CLI 표면 (Wave 1 CP0).
//
// usage:
//   node preflight.mjs [--json]                 현재 실행 문맥 검증 + digest 요약
//   node preflight.mjs --receipt <path>         detached digest receipt 기록
//   node preflight.mjs --staging <dir>          staging 사본의 packageTreeDigest 대조
//   node preflight.mjs --verify-receipt <path>  receipt를 현재 파일에서 재계산해 검증
//
// exit: 0 ok · 2 usage · 7 preflight 위반/불일치
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  preflight, PREFLIGHT_EXIT, SKILL_LOCATOR, digestSets, digestFiles,
  walkPackage, classify, loadSurfaceManifest, importClosure, isUnder,
  verifyProvenance, PROVENANCE_SCHEMA,
} from "./preflight-lib.mjs";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) { console.error(`usage: ${name} requires a value`); process.exit(2); }
  return v;
};
for (const a of argv) {
  if (a.startsWith("--") && !["--json", "--receipt", "--staging", "--verify-receipt"].includes(a)) {
    console.error(`preflight: unknown option ${a}`); process.exit(2);
  }
}

const st = preflight({ entrypointUrl: import.meta.url });
const sets = digestSets(st.skillRoot, st.kinds, st.manifest);
const importProblems = importClosure(st.skillRoot, st.kinds);
const errors = [...importProblems];

// production entrypoint는 전부 preflight binding을 가져야 한다 — 목록은 manifest가
// SSoT이므로 새 entrypoint가 추가돼도 guard를 빠뜨릴 수 없다.
export function bindingCoverage(skillRoot, kinds) {
  const problems = [];
  for (const [rel, kind] of kinds) {
    if (kind === "production-entrypoint" && rel.endsWith(".mjs")) {
      const src = readFileSync(path.join(skillRoot, rel), "utf8");
      if (!/from\s+["']\.\/preflight-lib\.mjs["']/.test(src) || !/\bpreflight\s*\(/.test(src))
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
    const originFiles = new Set(st.files);
    const copyFiles = new Set(files);
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
  // preflight identity receipt는 package digest만 증명한다(provenance 없음).
  // 그 밖의 artifact receipt는 provenance를 반드시 담아야 한다 — 삭제로 검사를
  // 무력화할 수 없다.
  const isIdentityReceipt = doc.command === "preflight";
  const provErrors = doc.provenance
    ? verifyProvenance(doc.provenance)
    : isIdentityReceipt ? [] : ["E-PROV-MISSING artifact receipt has no provenance block"];
  if (isIdentityReceipt && !Object.keys(doc.digests ?? {}).length)
    provErrors.push("E-PROV-DIGEST preflight receipt carries no digests to verify");
  for (const [name, want] of Object.entries(doc.digests ?? {})) {
    if (sets[name] === undefined) provErrors.push(`E-PROV-DIGEST unknown digest set "${name}"`);
    else if (sets[name] !== want) provErrors.push(`E-PROV-DIGEST ${name} ${String(want).slice(0, 20)}… != recomputed ${sets[name].slice(0, 20)}…`);
  }
  verifyReport = { file: path.basename(verifyPath), errors: provErrors };
  errors.push(...provErrors);
}

const receiptPath = opt("--receipt");
if (receiptPath) {
  const abs = path.resolve(receiptPath);
  // 자기참조 금지: digest receipt는 hashed package 안에 만들지 않는다.
  if (isUnder(abs, st.skillRoot)) {
    console.error(`preflight: refusing to write a digest receipt inside the hashed package (${SKILL_LOCATOR}) — receipts are detached evidence or CI artifacts`);
    process.exit(PREFLIGHT_EXIT);
  }
  writeFileSync(abs, JSON.stringify({
    schemaVersion: 1, command: "preflight",
    provenanceSchema: PROVENANCE_SCHEMA,
    skillRoot: SKILL_LOCATOR,
    surfaceRevision: Number(st.manifest.surface_revision),
    canonicalization: st.manifest.canonicalization,
    digests: sets, fileCount: st.files.length, errors,
  }, null, 1) + "\n");
}

const out = {
  schemaVersion: 1, command: "preflight", skillRoot: SKILL_LOCATOR,
  surfaceRevision: Number(st.manifest.surface_revision),
  canonicalization: st.manifest.canonicalization,
  digests: sets, fileCount: st.files.length,
  staging: stagingReport, verify: verifyReport, errors,
};
if (argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`preflight ${SKILL_LOCATOR} (surface rev ${out.surfaceRevision}) — ${st.files.length} file(s), ${errors.length} error(s)`);
  for (const [k, v] of Object.entries(sets)) console.log(`  ${k} ${v}`);
  if (stagingReport) console.log(`  staging ${stagingReport.identical ? "identical" : "DIFFERENT"}`);
  for (const e of errors) console.error(`  ERROR ${e}`);
}
process.exit(errors.length ? PREFLIGHT_EXIT : 0);
