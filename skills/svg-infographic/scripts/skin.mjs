#!/usr/bin/env node
// skin.mjs — single resolver for svg-infographic skin profiles (Node 18+, stdlib only).
//
//   node scripts/skin.mjs validate <profile.yaml> [--json]
//   node scripts/skin.mjs resolve  <profile.yaml> [--mode light|dark] [--treatment flat|sketch] [--json]
//   node scripts/skin.mjs registry [--json]
//
// The resolver is the only component that interprets profile inheritance, alias
// mapping and derivation ratios. `validate` and `resolve` share one validation
// context covering palette, derivation and (when used) overlay. Receipts carry
// profile digests, the resolved-token digest and the contrast matrix of the
// selected mode. Fail-closed: any validation error, unknown/duplicate/valueless
// option, or unsupported combination (dark + sketch in Wave 0) exits non-zero.
// Exit codes: 0 ok · 1 validation/combination failure · 2 usage.
//
// Deliberately NOT a theme engine: single resolver, versioned profiles, one shallow
// `extends`, bounded overrides. No DSL, plugins or runtime editing.

import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- minimal YAML subset parser (nested maps, scalars, "- item" lists, comments) ---
function parseYaml(text, file) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const noComment = lines[i].replace(/(^|\s)#.*$/, "");
    if (!noComment.trim()) continue;
    const indent = noComment.match(/^ */)[0].length;
    const trimmed = noComment.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (trimmed.startsWith("- ")) {
      if (!parent.holder || !parent.key) throw new Error(`${file}:${i + 1} list item without a preceding key`);
      if (!Array.isArray(parent.holder[parent.key])) parent.holder[parent.key] = [];
      let v = trimmed.slice(2).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      parent.holder[parent.key].push(v);
      continue;
    }
    const m = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) throw new Error(`${file}:${i + 1} unsupported YAML line: ${trimmed}`);
    const [, key, valRaw] = m;
    if (valRaw === "") {
      // may become a nested map or a list ("- item" lines at deeper indent)
      const obj = {};
      parent.obj[key] = obj;
      stack.push({ indent, obj, holder: parent.obj, key });
    } else {
      let v = valRaw.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v === "null") v = null;
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      parent.obj[key] = v;
    }
  }
  return root;
}

// --- color math ---------------------------------------------------------------
const hexRe = /^#[0-9A-F]{6}$/i;
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (r) => "#" + r.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0").toUpperCase()).join("");
const mix = (a, b, t) => toHex(toRgb(a).map((x, i) => x + (toRgb(b)[i] - x) * t));
function relLum(h) {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = toRgb(h).map((c) => f(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
};
function hueDeg(h) {
  const [r, g, b] = toRgb(h).map((c) => c / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return null;
  const d = mx - mn;
  let deg;
  if (mx === r) deg = ((g - b) / d) % 6;
  else if (mx === g) deg = (b - r) / d + 2;
  else deg = (r - g) / d + 4;
  return ((deg * 60) + 360) % 360;
}

// --- contracts ----------------------------------------------------------------
const ROLES = ["canvas", "surface", "surface-tint", "ink", "muted", "rule",
  "focus", "positive", "warning", "danger", "on-focus"];
const MODES = ["light", "dark"];
const TREATMENTS = ["flat", "sketch"];
// Wave 0 supported combinations. dark × sketch is explicitly unsupported until a
// mode-aware overlay is designed and visually approved via contact-sheet review.
const SUPPORTED = { flat: ["light", "dark"], sketch: ["light"] };
const GATES = [
  ["ink", "canvas", 7.0, "text"], ["ink", "surface", 7.0, "text"],
  ["ink", "surface-tint", 4.5, "text"],
  ["muted", "canvas", 4.5, "text"], ["muted", "surface", 4.5, "text"],
  ["on-focus", "focus", 4.5, "text"],
  ["positive", "surface", 3.0, "icon-line"], ["warning", "surface", 3.0, "icon-line"],
  ["danger", "surface", 3.0, "icon-line"],
];
const STATUS_MIN_HUE_GAP = 30;
const ALIAS_SOURCES = ["focus", "positive", "muted", "secondary"];
const DERIVE_FIELDS = {
  light: ["fill-mix-toward-white", "ink-mix-toward-black", "band-mix-toward-white",
    "strip-mix-toward-white", "data-fill-mix-toward-white",
    "container-fill-mix-toward-white", "container-line-mix-toward-white"],
  dark: ["fill-mix-toward-canvas", "ink-mix-toward-white", "band-mix-toward-canvas",
    "strip-mix-toward-canvas", "data-fill-mix-toward-canvas",
    "container-fill-mix-toward-canvas", "container-line-mix-toward-canvas"],
};
const OVERLAY_TOKENS = ["paper", "sketch-ink", "highlight"];
const STATUSES = ["candidate", "current", "frozen", "deprecated"];

const here = path.dirname(fileURLToPath(import.meta.url));
const skinsDir = path.resolve(here, "..", "references", "skins");
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

function readYaml(p) {
  const text = readFileSync(p, "utf8");
  return { doc: parseYaml(text, p), digest: sha(text) };
}

function loadPalette(p, errors) {
  const { doc: prof, digest } = readYaml(p);
  const digestChain = [{ id: prof.id ?? path.basename(p), digest }];
  if (prof.extends) {
    const basePath = path.join(skinsDir, `${prof.extends}.yaml`);
    let base;
    try { base = readYaml(basePath); } catch { errors.push(`extends target not found: ${prof.extends}`); return { prof, digestChain }; }
    if (base.doc.extends) { errors.push(`extends chain too deep: ${prof.extends} extends ${base.doc.extends} (only one shallow extends is allowed)`); return { prof, digestChain }; }
    digestChain.unshift({ id: base.doc.id, digest: base.digest });
    for (const mode of MODES) prof[mode] = { ...(base.doc[mode] || {}), ...(prof[mode] || {}) };
    prof.anchors = { ...(base.doc.anchors || {}), ...(prof.anchors || {}) };
    for (const k of ["kind", "schema_version"]) prof[k] = prof[k] ?? base.doc[k];
  }
  return { prof, digestChain };
}

function validateIdentity(doc, expectKind, label, errors) {
  if (doc.schema_version !== 1) errors.push(`${label}: schema_version must be 1 (got ${doc.schema_version})`);
  if (!doc.id) errors.push(`${label}: missing id`);
  if (doc.kind !== expectKind) errors.push(`${label}: kind must be "${expectKind}" (got ${doc.kind})`);
  if (doc.status && !STATUSES.includes(doc.status)) errors.push(`${label}: invalid status ${doc.status}`);
}

function validatePalette(prof, errors, warnings) {
  validateIdentity(prof, "palette", prof.id ?? "palette", errors);
  for (const mode of MODES) {
    const t = prof[mode];
    if (!t) { errors.push(`missing ${mode} token map`); continue; }
    for (const r of ROLES) {
      if (!t[r]) errors.push(`${mode}: missing required role "${r}"`);
      else if (!hexRe.test(t[r])) errors.push(`${mode}.${r}: not a #RRGGBB hex (${t[r]})`);
    }
    for (const k of Object.keys(t)) if (!ROLES.includes(k)) errors.push(`${mode}: unknown role "${k}" (role add/remove is a kernel migration)`);
  }
  const a = prof.anchors || {};
  for (const k of ["secondary-light", "secondary-dark"]) {
    if (!a[k]) errors.push(`anchors: missing "${k}"`);
    else if (!hexRe.test(a[k])) errors.push(`anchors.${k}: not a #RRGGBB hex (${a[k]})`);
  }
  if (errors.length) return;
  for (const mode of MODES) {
    const t = prof[mode];
    for (const [fg, bg, min, kind] of GATES) {
      const v = contrast(t[fg], t[bg]);
      if (v < min) errors.push(`${mode}: contrast ${fg}/${bg} = ${v} < ${min} (${kind})`);
    }
    const hues = ["positive", "warning", "danger"].map((k) => hueDeg(t[k]));
    if (hues.some((h) => h === null)) warnings.push(`${mode}: neutral status color — hue-gap check skipped`);
    else {
      const s = [...hues].sort((x, y) => x - y);
      const minGap = Math.min(s[1] - s[0], s[2] - s[1], 360 - (s[2] - s[0]));
      if (minGap < STATUS_MIN_HUE_GAP) errors.push(`${mode}: status hue gap ${minGap.toFixed(0)}° < ${STATUS_MIN_HUE_GAP}°`);
    }
  }
}

function validateDerivation(deriv, errors) {
  validateIdentity(deriv, "derivation", deriv.id ?? "derivation", errors);
  const srcs = deriv["alias-sources"];
  if (!srcs || typeof srcs !== "object") { errors.push("derivation: missing alias-sources"); return; }
  for (const [alias, src] of Object.entries(srcs)) {
    if (!ALIAS_SOURCES.includes(src)) errors.push(`derivation: alias "${alias}" has invalid source "${src}" (allowed: ${ALIAS_SOURCES.join(", ")})`);
  }
  for (const mode of MODES) {
    const d = deriv.derive?.[mode];
    if (!d) { errors.push(`derivation: missing derive.${mode}`); continue; }
    for (const f of DERIVE_FIELDS[mode]) {
      const v = d[f];
      if (v === undefined) errors.push(`derivation: derive.${mode} missing "${f}"`);
      else if (typeof v !== "number" || v < 0 || v > 1) errors.push(`derivation: derive.${mode}.${f} out of range [0,1] (${v})`);
    }
  }
  if (deriv.extends) errors.push("derivation: extends is not supported for derivation contracts");
}

function validateOverlay(overlay, errors) {
  validateIdentity(overlay, "surface-treatment", overlay.id ?? "overlay", errors);
  const t = overlay.tokens;
  if (!t) { errors.push("overlay: missing tokens"); return; }
  for (const k of OVERLAY_TOKENS) {
    if (!t[k]) errors.push(`overlay: missing token "${k}"`);
    else if (!hexRe.test(t[k])) errors.push(`overlay.tokens.${k}: not a #RRGGBB hex (${t[k]})`);
  }
}

function validateAllowlist(doc, errors) {
  validateIdentity(doc, "frozen-allowlist", doc.id ?? "allowlist", errors);
  if (!Array.isArray(doc.allowed) || doc.allowed.length === 0) errors.push("frozen-allowlist: missing allowed hex list");
  else for (const h of doc.allowed) if (!hexRe.test(h)) errors.push(`frozen-allowlist: invalid hex ${h}`);
}

// shared validation context for validate & resolve
function buildContext(profilePath, needOverlay) {
  const errors = [], warnings = [];
  const { prof, digestChain } = loadPalette(profilePath, errors);
  let deriv = null, derivDigest = null, overlay = null, overlayDigest = null;
  if (prof.kind === "frozen-allowlist") {
    validateAllowlist(prof, errors);
    return { prof, digestChain, deriv, derivDigest, overlay, overlayDigest, errors, warnings };
  }
  if (prof.kind === "derivation") { validateDerivation(prof, errors); return { prof, digestChain, errors, warnings }; }
  if (prof.kind === "surface-treatment") { validateOverlay(prof, errors); return { prof, digestChain, errors, warnings }; }
  validatePalette(prof, errors, warnings);
  try {
    const d = readYaml(path.join(skinsDir, "derivation-v1.yaml"));
    deriv = d.doc; derivDigest = d.digest;
    validateDerivation(deriv, errors);
  } catch (e) { errors.push(`derivation: ${e.message}`); }
  if (needOverlay) {
    try {
      const o = readYaml(path.join(skinsDir, "sketch-overlay-v1.yaml"));
      overlay = o.doc; overlayDigest = o.digest;
      validateOverlay(overlay, errors);
    } catch (e) { errors.push(`overlay: ${e.message}`); }
  }
  return { prof, digestChain, deriv, derivDigest, overlay, overlayDigest, errors, warnings };
}

function resolveTokens(prof, deriv, mode) {
  const t = prof[mode];
  const d = deriv.derive[mode];
  const W = "#FFFFFF", B = "#000000";
  const bgRef = mode === "light" ? W : t["canvas"];
  const inkRef = mode === "light" ? B : W;
  const secondary = prof.anchors[mode === "light" ? "secondary-light" : "secondary-dark"];
  const lineFor = { focus: t.focus, positive: t.positive, muted: t.muted, secondary };
  const out = {};
  for (const r of ROLES) out[r] = t[r];
  const fillT = mode === "light" ? d["fill-mix-toward-white"] : d["fill-mix-toward-canvas"];
  const inkT = mode === "light" ? d["ink-mix-toward-black"] : d["ink-mix-toward-white"];
  for (const [alias, src] of Object.entries(deriv["alias-sources"])) {
    const line = lineFor[src];
    if (alias === "icon") { out["icon-tint"] = mix(line, bgRef, fillT); continue; }
    if (alias === "external") {
      out["external-fill"] = mix(line, bgRef, mode === "light" ? d["container-fill-mix-toward-white"] : d["container-fill-mix-toward-canvas"]);
      out["external-line"] = mix(line, bgRef, mode === "light" ? d["container-line-mix-toward-white"] : d["container-line-mix-toward-canvas"]);
      continue;
    }
    const ft = alias === "data" ? (mode === "light" ? d["data-fill-mix-toward-white"] : d["data-fill-mix-toward-canvas"]) : fillT;
    out[`${alias}-fill`] = mix(line, bgRef, ft);
    out[`${alias}-line`] = line;
    out[`${alias}-ink`] = mix(line, inkRef, inkT);
  }
  out["compute-band"] = mix(t.positive, bgRef, mode === "light" ? d["band-mix-toward-white"] : d["band-mix-toward-canvas"]);
  out["strip"] = mix(t.focus, bgRef, mode === "light" ? d["strip-mix-toward-white"] : d["strip-mix-toward-canvas"]);
  return out;
}

// --- strict CLI parsing -------------------------------------------------------
const OPTION_SPEC = {
  validate: { "--json": false },
  resolve: { "--mode": true, "--treatment": true, "--json": false },
  registry: { "--json": false },
};
function parseOptions(cmd, rest) {
  const spec = OPTION_SPEC[cmd];
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (!(flag in spec)) fail(2, `unknown option for ${cmd}: ${flag}`);
    if (flag in opts) fail(2, `duplicate option: ${flag}`);
    if (spec[flag]) {
      const val = rest[i + 1];
      if (val === undefined || val.startsWith("--")) fail(2, `option ${flag} requires a value`);
      opts[flag] = val;
      i++;
    } else opts[flag] = true;
  }
  return opts;
}
function fail(code, msg) {
  console.error(`ERROR ${msg}`);
  process.exit(code);
}

function printReceipt(receipt, asJson) {
  if (asJson) { console.log(JSON.stringify(receipt, null, 1)); return; }
  const p = receipt.profile;
  console.log(`profile ${p.id} [${p.status ?? "-"}] — ${receipt.errors.length} error(s), ${receipt.warnings.length} warning(s)`);
  for (const e of receipt.errors) console.log(`  ERROR ${e}`);
  for (const w of receipt.warnings) console.log(`  warn  ${w}`);
  if (receipt.contrast) {
    for (const [mode, rows] of Object.entries(receipt.contrast)) {
      console.log(`  ${mode}: ` + rows.map((c) => `${c.pair}=${c.value}`).join(" "));
    }
  }
  if (receipt.tokens) {
    console.log(`resolved ${p.id} + ${receipt.mode} + ${receipt.treatment} — digest ${receipt.resolvedDigest}`);
    for (const [k, v] of Object.entries(receipt.tokens)) console.log(`  --${k}: ${v}`);
  }
}

function contrastMatrix(prof, modes) {
  const m = {};
  for (const mode of modes) {
    m[mode] = GATES.map(([fg, bg, min]) => ({ pair: `${fg}/${bg}`, value: contrast(prof[mode][fg], prof[mode][bg]), min }));
  }
  return m;
}

function main() {
  const [cmd, ...restAll] = process.argv.slice(2);
  if (!cmd || !(cmd in OPTION_SPEC)) fail(2, "usage: skin.mjs validate|resolve <profile.yaml> [options] | registry [--json]");
  let profileArg = null, rest = restAll;
  if (cmd !== "registry") {
    profileArg = restAll[0];
    if (!profileArg || profileArg.startsWith("--")) fail(2, `${cmd} requires a profile path`);
    rest = restAll.slice(1);
  }
  const opts = parseOptions(cmd, rest);

  if (cmd === "registry") {
    const errors = [];
    let reg = null, regDigest = null;
    try { const r = readYaml(path.join(skinsDir, "registry.yaml")); reg = r.doc; regDigest = r.digest; }
    catch { fail(1, "registry.yaml not found in references/skins/"); }
    const ids = { palette: reg.current?.palette, derivation: reg.current?.derivation, sketch: reg.overlays?.sketch };
    for (const [slot, id] of Object.entries(ids)) {
      if (!id) { errors.push(`registry: missing ${slot} selection`); continue; }
      try { readYaml(path.join(skinsDir, `${id}.yaml`)); } catch { errors.push(`registry: ${slot} -> ${id}.yaml not found`); }
    }
    // current-uniqueness: at most one status:current per kind, and it must be the registry selection
    const byKind = {};
    for (const f of readdirSync(skinsDir).filter((f) => f.endsWith(".yaml") && f !== "registry.yaml")) {
      try {
        const { doc } = readYaml(path.join(skinsDir, f));
        if (doc.status === "current") (byKind[doc.kind] ??= []).push(doc.id);
      } catch { errors.push(`registry scan: unparseable ${f}`); }
    }
    for (const [kind, list] of Object.entries(byKind)) {
      if (list.length > 1) errors.push(`registry: multiple status:current ${kind} profiles: ${list.join(", ")}`);
    }
    if (byKind.palette && ids.palette && !byKind.palette.includes(ids.palette)) errors.push(`registry: current palette ${ids.palette} does not carry status:current`);
    const receipt = { schemaVersion: 1, command: "registry", registryDigest: regDigest, current: ids, errors, warnings: [] };
    if (opts["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`registry — ${errors.length} error(s): palette=${ids.palette} derivation=${ids.derivation} sketch=${ids.sketch}`);
      for (const e of errors) console.log(`  ERROR ${e}`);
    }
    process.exit(errors.length ? 1 : 0);
  }

  const mode = opts["--mode"] ?? "light";
  const treatment = opts["--treatment"] ?? "flat";
  if (cmd === "resolve") {
    if (!MODES.includes(mode)) fail(2, `invalid --mode ${mode} (light|dark)`);
    if (!TREATMENTS.includes(treatment)) fail(2, `invalid --treatment ${treatment} (flat|sketch)`);
    if (!SUPPORTED[treatment].includes(mode)) fail(1, `unsupported combination: ${mode} + ${treatment} (Wave 0 supports flat:light|dark, sketch:light only; dark-sketch needs a mode-aware overlay and contact-sheet approval)`);
  }
  const ctx = buildContext(path.resolve(profileArg), cmd === "resolve" && treatment === "sketch");
  const receipt = {
    schemaVersion: 1,
    command: cmd,
    profile: { id: ctx.prof.id, kind: ctx.prof.kind, status: ctx.prof.status, digests: ctx.digestChain },
    ...(ctx.derivDigest ? { derivation: { id: ctx.deriv.id, digest: ctx.derivDigest } } : {}),
    ...(ctx.overlayDigest ? { overlay: { id: ctx.overlay.id, digest: ctx.overlayDigest } } : {}),
    errors: ctx.errors,
    warnings: ctx.warnings,
    provenance: { kernel: "wave0-cp2", palette: ctx.prof.id, extension_point: null },
  };
  if (cmd === "validate") {
    if (!ctx.errors.length && ctx.prof.kind === "palette") receipt.contrast = contrastMatrix(ctx.prof, MODES);
    printReceipt(receipt, opts["--json"]);
    process.exit(ctx.errors.length ? 1 : 0);
  }
  // resolve
  if (ctx.prof.kind !== "palette") fail(1, `resolve requires a palette profile (got kind=${ctx.prof.kind})`);
  if (ctx.errors.length) { printReceipt(receipt, opts["--json"]); process.exit(1); }
  const tokens = resolveTokens(ctx.prof, ctx.deriv, mode);
  if (treatment === "sketch") {
    Object.assign(tokens, { paper: ctx.overlay.tokens.paper, "sketch-ink": ctx.overlay.tokens["sketch-ink"], highlight: ctx.overlay.tokens.highlight });
  }
  receipt.mode = mode;
  receipt.treatment = treatment;
  receipt.contrast = contrastMatrix(ctx.prof, [mode]); // always in the resolve receipt
  receipt.tokens = tokens;
  receipt.resolvedDigest = sha(JSON.stringify(tokens));
  printReceipt(receipt, opts["--json"]);
  process.exit(0);
}

// entrypoint guard: run main() based on real paths so symlinked installs still execute
// (silent-pass hardening for all scripts completes in CP3).
try {
  const argvReal = realpathSync(process.argv[1]);
  const selfReal = realpathSync(fileURLToPath(import.meta.url));
  if (argvReal === selfReal) main();
} catch { main(); }
