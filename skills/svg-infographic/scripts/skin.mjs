#!/usr/bin/env node
// skin.mjs — single resolver for svg-infographic skin profiles (Node 18+, stdlib only).
//
//   node scripts/skin.mjs validate <profile.yaml|current> [--json]
//   node scripts/skin.mjs resolve  <profile.yaml|current> [--mode light|dark] [--treatment flat|sketch] [--json]
//   node scripts/skin.mjs registry [--json]
//   node scripts/skin.mjs materialize <file.svg> [--profile <yaml|current>] [--mode ..]
//                         [--treatment ..] [--check] [--json]
//
// materialize fills/updates direct fill/stroke attributes from data-fill-role /
// data-stroke-role annotations IN PLACE (same SVG — no second artifact) and
// verifies role/value parity. --check verifies only (no write): unknown role or
// paint/value mismatch exits 1; hand-typed canonical hex without an annotation is
// reported as a warning (palette lint escalates it in CP3C). data-paint-static
// marks allowed non-token paint; fill="none" is always preserved.
//
// "current" resolves the registry-selected palette. Derivation/overlay are ALWAYS
// loaded through registry.yaml — the registry is the selection SSoT; switching an
// approved candidate edits registry.yaml only.
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

import { readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
const await_import_fs = () => ({ writeFileSync });
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
      const rest = trimmed.slice(2).trim();
      const km = rest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (km) { // list of maps: "- key: value" starts a new item
        const item = {};
        parent.holder[parent.key].push(item);
        stack.push({ indent: indent + 1, obj: item, holder: null, key: null });
        let v = km[2].trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        else if (v === "null") v = null;
        else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        item[km[1]] = v;
      } else {
        let v = rest;
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        parent.holder[parent.key].push(v);
      }
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
      else if (v === "[]") v = [];
      else if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x);
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
// SKIN_SKINS_DIR: test override for negative-fixture isolation (never set in production)
const skinsDir = process.env.SKIN_SKINS_DIR
  ? path.resolve(process.env.SKIN_SKINS_DIR)
  : path.resolve(here, "..", "references", "skins");
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

function readYaml(p) {
  const text = readFileSync(p, "utf8");
  return { doc: parseYaml(text, p), digest: sha(text) };
}

const REGISTRY_SLOTS = [
  ["current.palette", "palette", "current", null],
  ["current.derivation", "derivation", "current", null],
  ["current.typography", "typography", "current", "typography"],
  ["overlays.sketch", "surface-treatment", "current", null],
  ["frozen.legacy", "frozen-allowlist", "frozen", null],
];
const TYPO_TREATMENTS = ["flat", "sketch"];
const TYPO_LOCALES = ["ko", "en"];
function loadTypography(errors, overridePath = null) {
  const p = overridePath ? path.resolve(overridePath) : path.resolve(skinsDir, "..", "typography", "typography-v1.yaml");
  let doc, digest;
  try { ({ doc, digest } = readYaml(p)); } catch { errors.push("typography: typography-v1.yaml not found in references/typography/"); return null; }
  validateIdentity(doc, "typography", "typography-v1", errors);
  if (doc["remote-fonts"] !== "forbidden") errors.push('typography: remote-fonts must be "forbidden"');
  const ROOT = ["schema_version", "id", "kind", "extends", "status", "remote-fonts", "treatments"];
  for (const k of Object.keys(doc)) if (!ROOT.includes(k)) errors.push(`typography: unknown field "${k}"`);
  const T = doc.treatments ?? {};
  for (const t of TYPO_TREATMENTS) if (!(t in T)) errors.push(`typography: missing treatment "${t}"`);
  for (const [t, cfg] of Object.entries(T)) {
    if (!TYPO_TREATMENTS.includes(t)) { errors.push(`typography: unknown treatment "${t}"`); continue; }
    const TK = ["locales", "fallback", "synthetic", "weight-policy", "asset", "license"];
    for (const k of Object.keys(cfg)) if (!TK.includes(k)) errors.push(`typography: ${t}: unknown field "${k}"`);
    if (cfg.synthetic !== "forbidden") errors.push(`typography: ${t}: synthetic must be "forbidden" (synthetic bold/italic is never allowed)`);
    if ("weight-policy" in cfg && cfg["weight-policy"] !== "normalize-400") errors.push(`typography: ${t}: unknown weight-policy "${cfg["weight-policy"]}"`);
    if (!Array.isArray(cfg.fallback) || cfg.fallback.length === 0 || cfg.fallback.some((f) => typeof f !== "string" || !f.trim()))
      errors.push(`typography: ${t}: fallback must be a non-empty family list`);
    for (const loc of TYPO_LOCALES) {
      const L = cfg.locales?.[loc];
      if (!L) { errors.push(`typography: ${t}: missing locale "${loc}"`); continue; }
      for (const k of Object.keys(L)) if (!["face", "weights", "styles"].includes(k)) errors.push(`typography: ${t}.${loc}: unknown field "${k}"`);
      if (typeof L.face !== "string" || !L.face.trim()) errors.push(`typography: ${t}.${loc}: face must be a non-empty string`);
      if (!Array.isArray(L.weights) || L.weights.length === 0 || L.weights.some((w) => !Number.isFinite(Number(w)) || Number(w) < 1 || Number(w) > 1000))
        errors.push(`typography: ${t}.${loc}: weights must be a non-empty list of numeric weights`);
      if (!Array.isArray(L.styles) || L.styles.some((st) => !["normal", "italic"].includes(st)))
        errors.push(`typography: ${t}.${loc}: styles must be within normal/italic`);
    }
    const A = cfg.asset ?? {};
    if (!["system", "bundled", "bundled-on-selection"].includes(A.policy)) errors.push(`typography: ${t}: asset.policy must be system|bundled|bundled-on-selection`);
    if (!["none", "subset"].includes(A.embed)) errors.push(`typography: ${t}: asset.embed must be none|subset`);
    for (const k of Object.keys(A)) if (!["policy", "embed", "path", "source", "digest"].includes(k)) errors.push(`typography: ${t}: asset unknown field "${k}"`);
    if (A.policy === "bundled") {
      const ap = A.path ? path.resolve(skinsDir, "..", "..", String(A.path)) : null;
      if (!ap) errors.push(`typography: ${t}: bundled asset requires path`);
      else {
        try {
          const buf = readFileSync(ap);
          const d = createHash("sha256").update(buf).digest("hex");
          if (A.digest && d !== A.digest) errors.push(`typography: ${t}: asset digest mismatch — file ${d.slice(0, 16)}…, declared ${String(A.digest).slice(0, 16)}…`);
        } catch { errors.push(`typography: ${t}: bundled asset not found at ${A.path}`); }
        if (!A.digest) errors.push(`typography: ${t}: bundled asset requires digest`);
      }
    }
    const Li = cfg.license ?? {};
    if (typeof Li.id !== "string" || !Li.id.trim()) errors.push(`typography: ${t}: license.id required`);
    if (!Array.isArray(Li.rfn)) errors.push(`typography: ${t}: license.rfn must be a list (empty when no Reserved Font Name is declared)`);
  }
  return { doc, digest };
}
// 결정적 stack 직렬화 — face + fallback을 CSS 규칙(공백 포함 family만 quote)으로
function serializeStack(face, fallback) {
  return [face, ...fallback].map((f) => /[ ]/.test(f) && !f.startsWith("-") ? `"${f}"` : f).join(", ");
}
function loadRegistry(errors) {
  let reg = null, digest = null;
  try { const r = readYaml(path.join(skinsDir, "registry.yaml")); reg = r.doc; digest = r.digest; }
  catch { errors.push("registry.yaml not found in references/skins/"); return null; }
  const get = (dotted) => dotted.split(".").reduce((o, k) => o?.[k], reg);
  const selected = {};
  for (const [slot, kind, status, sub] of REGISTRY_SLOTS) {
    const id = get(slot);
    if (!id) { errors.push(`registry: missing ${slot} selection`); continue; }
    const dir = sub ? path.resolve(skinsDir, "..", sub) : skinsDir;
    try {
      const { doc } = readYaml(path.join(dir, `${id}.yaml`));
      if (doc.id !== id) errors.push(`registry: ${slot} -> ${id}.yaml has id "${doc.id}"`);
      if (doc.kind !== kind) errors.push(`registry: ${slot} -> ${id} kind "${doc.kind}" (expected ${kind})`);
      if (doc.status !== status) errors.push(`registry: ${slot} -> ${id} status "${doc.status}" (expected ${status})`);
      selected[slot] = id;
    } catch { errors.push(`registry: ${slot} -> ${id}.yaml not found`); }
  }
  return { reg, digest, selected };
}

function loadPalette(p, errors) {
  const { doc: prof, digest } = readYaml(p);
  const digestChain = [{ id: prof.id ?? path.basename(p), digest }];
  if (prof.extends) {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(String(prof.extends))) { errors.push(`extends: invalid id "${prof.extends}" (kebab-case id within references/skins/ only)`); return { prof, digestChain }; }
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
  if (!doc.status) errors.push(`${label}: missing status`);
  else if (!STATUSES.includes(doc.status)) errors.push(`${label}: invalid status ${doc.status}`);
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
  const ANCHOR_KEYS = ["secondary-light", "secondary-dark"];
  for (const k of ANCHOR_KEYS) {
    if (!a[k]) errors.push(`anchors: missing "${k}"`);
    else if (!hexRe.test(a[k])) errors.push(`anchors.${k}: not a #RRGGBB hex (${a[k]})`);
  }
  for (const k of Object.keys(a)) if (!ANCHOR_KEYS.includes(k)) errors.push(`anchors: unknown key "${k}"`);
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
  const ALIAS_KEYS = ["edge", "api", "compute", "data", "external", "icon"];
  for (const k of ALIAS_KEYS) if (!(k in srcs)) errors.push(`derivation: missing alias "${k}"`);
  for (const [alias, src] of Object.entries(srcs)) {
    if (!ALIAS_KEYS.includes(alias)) errors.push(`derivation: unknown alias "${alias}" (exact set: ${ALIAS_KEYS.join("/")})`);
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
  for (const k of Object.keys(t)) if (!OVERLAY_TOKENS.includes(k)) errors.push(`overlay: unexpected token "${k}"`);
  const tr = overlay.treatment;
  if (!tr) errors.push("overlay: missing treatment");
  else for (const k of ["rough-box", "rough-line", "handwriting-font"]) if (!tr[k]) errors.push(`overlay: missing treatment "${k}"`);
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
  // derivation/overlay are ALWAYS selected through the registry (selection SSoT)
  const registry = loadRegistry(errors);
  if (registry?.selected["current.derivation"]) {
    try {
      const d = readYaml(path.join(skinsDir, `${registry.selected["current.derivation"]}.yaml`));
      deriv = d.doc; derivDigest = d.digest;
      validateDerivation(deriv, errors);
    } catch (e) { errors.push(`derivation: ${e.message}`); }
  }
  if (needOverlay) {
    if (registry?.selected["overlays.sketch"]) {
      try {
        const o = readYaml(path.join(skinsDir, `${registry.selected["overlays.sketch"]}.yaml`));
        overlay = o.doc; overlayDigest = o.digest;
        validateOverlay(overlay, errors);
      } catch (e) { errors.push(`overlay: ${e.message}`); }
    } else errors.push("overlay: registry has no overlays.sketch selection");
  }
  return { prof, digestChain, deriv, derivDigest, overlay, overlayDigest, registry, errors, warnings };
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
  materialize: { "--profile": true, "--mode": true, "--treatment": true, "--check": false, "--json": false },
  manifest: { "--json": false },
  typography: { "--json": false },
  "typography-check": { "--json": false },
  pageframe: { "--h1-lines": true, "--eyebrow": true, "--subtitle": true, "--support": true, "--footer": true, "--content-height": true, "--json": false },
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

const TAG_RE = /<[A-Za-z][^>]*?\/?>(?!<)/g;
function materializeSvg(text, tokens) {
  const findings = { updated: 0, verified: 0, mismatches: [], unknownRoles: [], unannotated: [], staticKept: 0 };
  const tokenValues = new Set(Object.values(tokens).map((v) => v.toUpperCase()));
  const out = text.replace(/<[A-Za-z][^>]*>/g, (tag) => {
    if (tag.startsWith("<!") || tag.startsWith("<?")) return tag;
    let t = tag;
    const isStatic = /data-paint-static\s*=\s*[\"'](true|1)[\"']/.test(t);
    for (const [attr, roleAttr] of [["fill", "data-fill-role"], ["stroke", "data-stroke-role"]]) {
      const rm = t.match(new RegExp(`${roleAttr}\\s*=\\s*([\"'])([A-Za-z0-9-]+)\\1`));
      const pm = t.match(new RegExp(`\\b${attr}\\s*=\\s*([\"'])([^\"']*)\\1`));
      if (rm) {
        const role = rm[2];
        const want = tokens[role];
        if (want === undefined) { findings.unknownRoles.push(role); continue; }
        if (pm) {
          if (pm[2].toUpperCase() === want.toUpperCase()) findings.verified++;
          else {
            findings.mismatches.push({ role, have: pm[2], want });
            t = t.replace(pm[0], `${attr}="${want}"`);
            findings.updated++;
          }
        } else {
          t = t.replace(rm[0], `${rm[0]} ${attr}="${want}"`);
          findings.updated++;
        }
      } else if (pm && !isStatic) {
        const v = pm[2].trim();
        if (v !== "none" && /^#[0-9A-Fa-f]{6}$/.test(v) && tokenValues.has(v.toUpperCase())) {
          findings.unannotated.push({ attr, value: v });
        }
      } else if (pm && isStatic) findings.staticKept++;
    }
    return t;
  });
  return { out, findings };
}

const PF_HEADER = ["eyebrow", "h1", "subtitle"];
const PF_HI = ["ascent-mult", "eyebrow-row-mult", "eyebrow-gap", "collapsed-top-mult",
  "h1-line-mult", "h1-descent-mult", "subtitle-gap-mult", "subtitle-descent-mult"];
const PF_GAPS = ["breathing", "content-gap", "content-footer-gap", "footer-safe"];
const PF_SUPPORT = ["bottom-height", "side-width", "side-gap"];
const PF_ARROW = ["primary-shaft", "secondary-shaft", "min-shaft", "min-visible-head"];
function validatePageFrame(doc, preset, P, errors) {
  validateIdentity(doc, "pageframe", doc.id ?? "pageframe", errors);
  const band = doc["scale-band"];
  if (!band || typeof band.min !== "number" || typeof band.max !== "number" || !(band.min < band.max))
    errors.push("scale-band: min/max must be numbers with min < max");
  const num = (obj, keys, label, positive = true) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v !== "number" || Number.isNaN(v) || (positive && v <= 0))
        errors.push(`preset ${preset}: ${label}.${k} must be a positive number (got ${v})`);
    }
  };
  if (!["portrait", "landscape", "square"].includes(P.orientation)) errors.push(`preset ${preset}: invalid orientation ${P.orientation}`);
  if (typeof P["canvas-width"] !== "number" || P["canvas-width"] <= 0) errors.push(`preset ${preset}: canvas-width must be positive`);
  if (P["canvas-height"] !== "fluid" && (typeof P["canvas-height"] !== "number" || P["canvas-height"] <= 0))
    errors.push(`preset ${preset}: canvas-height must be positive or "fluid"`);
  if (typeof P["outer-margin"] !== "number" || P["outer-margin"] <= 0) errors.push(`preset ${preset}: outer-margin must be positive`);
  num(P.header, PF_HEADER, "header");
  const hi = P["header-internal"];
  if (!hi) errors.push(`preset ${preset}: missing "header-internal"`);
  else {
    for (const k of PF_HI) {
      const v = hi[k];
      if (typeof v !== "number" || Number.isNaN(v) || v < 0) errors.push(`preset ${preset}: header-internal.${k} must be a non-negative number (got ${v})`);
    }
    for (const k of Object.keys(hi)) if (!PF_HI.includes(k)) errors.push(`preset ${preset}: header-internal unknown field "${k}"`);
  }
  num(P.gaps, PF_GAPS.slice(0, 3), "gaps");
  if (typeof P.gaps?.["footer-safe"] !== "number" || P.gaps["footer-safe"] < 0) errors.push(`preset ${preset}: gaps.footer-safe must be a non-negative number`);
  num(P.support, PF_SUPPORT, "support");
  if (typeof P["footer-height"] !== "number" || P["footer-height"] <= 0) errors.push(`preset ${preset}: footer-height must be positive`);
  num(P.arrow, PF_ARROW, "arrow");
  const a = P.arrow ?? {};
  if (!(a["min-shaft"] <= a["secondary-shaft"] && a["secondary-shaft"] <= a["primary-shaft"]))
    errors.push(`preset ${preset}: arrow relation must hold min-shaft <= secondary-shaft <= primary-shaft`);
  for (const k of Object.keys(P)) if (!["orientation", "canvas-width", "canvas-height", "outer-margin", "header", "header-internal", "gaps", "support", "footer-height", "arrow"].includes(k))
    errors.push(`preset ${preset}: unknown field "${k}"`);
}

function computePageFrame(P, opts) {
  const H = P.header, G = P.gaps;
  const lines = opts.h1Lines, ey = opts.eyebrow, sub = opts.subtitle;
  // header cluster (top-relative): absent elements collapse with their gaps
  const HI = P["header-internal"];
  let h = 0;
  h += ey ? Math.round(H.eyebrow * HI["ascent-mult"]) + Math.round(H.h1 * HI["eyebrow-row-mult"]) + HI["eyebrow-gap"]
          : Math.round(H.h1 * HI["ascent-mult"]) + Math.round(H.h1 * HI["collapsed-top-mult"]);
  h += Math.round(H.h1 * HI["h1-line-mult"]) * (lines - 1);
  h += sub ? Math.round(H.subtitle * HI["subtitle-gap-mult"]) + Math.round(H.subtitle * HI["subtitle-descent-mult"])
           : Math.round(H.h1 * HI["h1-descent-mult"]);
  const m = P["outer-margin"];
  const headerTop = m;
  const headerBottom = m + h;
  const contentTop = headerBottom + G.breathing;
  const fluid = P["canvas-height"] === "fluid";
  const W = P["canvas-width"];
  let contentBox = { x: m, y: contentTop, w: W - 2 * m, h: null };
  let supportBox = null, footerBox = null, supportBottom = null;
  if (opts.support === "side") {
    contentBox.w -= P.support["side-width"] + P.support["side-gap"];
    supportBox = { x: m + contentBox.w + P.support["side-gap"], y: contentTop, w: P.support["side-width"], h: null };
  }
  if (fluid && opts.contentHeight != null) {
    let cy = contentTop + opts.contentHeight;
    contentBox.h = opts.contentHeight;
    if (supportBox) supportBox.h = contentBox.h;
    if (opts.support === "bottom") {
      supportBottom = { x: m, y: cy + G["content-gap"], w: W - 2 * m, h: P.support["bottom-height"] };
      cy = supportBottom.y + supportBottom.h;
    }
    if (opts.footer) {
      footerBox = { x: m, y: cy + G["content-footer-gap"], w: W - 2 * m, h: P["footer-height"] };
      cy = footerBox.y + footerBox.h;
    }
    return { headerRegion: { x: m, y: headerTop, w: W - 2 * m, h }, breathing: G.breathing,
             contentBox, supportBox, supportBottom, footerBox, fluid,
             documentHeight: cy + m, footerRule: "flows-after-content" };
  }
  if (!fluid) {
    const Hc = P["canvas-height"];
    let bottom = Hc - m;
    if (opts.footer) {
      footerBox = { x: m, y: Hc - G["footer-safe"] - P["footer-height"], w: W - 2 * m, h: P["footer-height"] };
      bottom = footerBox.y - G["content-footer-gap"];
    }
    if (opts.support === "bottom") {
      supportBottom = { x: m, y: bottom - P.support["bottom-height"], w: W - 2 * m, h: P.support["bottom-height"] };
      bottom = supportBottom.y - G["content-gap"];
    }
    contentBox.h = bottom - contentTop;
    if (supportBox) supportBox.h = contentBox.h;
  }
  return { headerRegion: { x: m, y: headerTop, w: W - 2 * m, h }, breathing: G.breathing,
           contentBox, supportBox, supportBottom, footerBox, fluid,
           footerRule: fluid ? "flows-after-content" : "bottom-safe-aligned" };
}

function main() {
  const [cmd, ...restAll] = process.argv.slice(2);
  if (!cmd || !(cmd in OPTION_SPEC)) fail(2, "usage: skin.mjs validate|resolve <profile.yaml> [options] | registry [--json]");
  let profileArg = null, rest = restAll, selectionBasis = "explicit-path", svgArg = null;
  if (cmd === "pageframe") {
    const preset = restAll[0];
    if (!preset || preset.startsWith("--")) fail(2, "pageframe requires a preset id");
    const po = parseOptions("pageframe", restAll.slice(1));
    const pfPath = path.join(skinsDir, "pageframe-v1.yaml");
    let pf;
    try { pf = readYaml(pfPath); } catch { fail(1, "pageframe-v1.yaml not found"); }
    const errors = [];
    const P = pf.doc.presets?.[preset];
    if (!P) fail(1, `unknown preset "${preset}" (registry: ${Object.keys(pf.doc.presets || {}).join(", ")})`);
    validatePageFrame(pf.doc, preset, P, errors);
    if (errors.length) { for (const e of errors) console.error(`ERROR ${e}`); process.exit(1); }
    const b = (v, d) => v === undefined ? d : (["on", "true", "1"].includes(v) ? true : ["off", "false", "0"].includes(v) ? false : fail(2, `invalid boolean ${v}`));
    const h1Lines = Number(po["--h1-lines"] ?? 1);
    if (![1, 2].includes(h1Lines)) fail(2, "--h1-lines must be 1 or 2");
    const support = po["--support"] ?? "none";
    if (!["none", "bottom", "side"].includes(support)) fail(2, `invalid --support ${support}`);
    let contentHeight = null;
    if (po["--content-height"] !== undefined) {
      if (P["canvas-height"] !== "fluid") fail(2, "--content-height applies to fluid presets only (fixed canvases compute content height)");
      contentHeight = Number(po["--content-height"]);
      if (!Number.isFinite(contentHeight) || contentHeight <= 0) fail(2, "--content-height must be a positive number");
    }
    const opts = { h1Lines, eyebrow: b(po["--eyebrow"], true), subtitle: b(po["--subtitle"], true), support, footer: b(po["--footer"], false), contentHeight };
    const out = computePageFrame(P, opts);
    if (!out.fluid && (out.contentBox.h == null || out.contentBox.h <= 0)) fail(1, `preset ${preset}: computed contentBox height is not positive (${out.contentBox.h}) — canvas too small for the requested regions`);
    if (out.contentBox.w <= 0) fail(1, `preset ${preset}: computed contentBox width is not positive (${out.contentBox.w})`);
    const receipt = { schemaVersion: 1, command: "pageframe", kernelVersion: "wave0-cp2",
      profile: { id: pf.doc.id, digest: pf.digest }, preset, orientation: P.orientation,
      canvas: { width: P["canvas-width"], height: P["canvas-height"] },
      options: opts, arrow: P.arrow, "scale-band": pf.doc["scale-band"], regions: out, errors: [], warnings: [] };
    if (po["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`pageframe ${preset} (${P.orientation}) — header ${out.headerRegion.y}..${out.headerRegion.y + out.headerRegion.h} (${out.headerRegion.h}px), contentBox ${JSON.stringify(out.contentBox)}, footer: ${out.footerRule}`);
    }
    process.exit(0);
  }
  if (cmd === "typography") {
    const tArg = restAll[0] && !restAll[0].startsWith("--") ? restAll[0] : null;
    const to = parseOptions("typography", tArg ? restAll.slice(1) : restAll);
    const errors = [];
    const typo = loadTypography(errors, tArg);
    const receipt = { schemaVersion: 1, command: "typography", kernelVersion: "wave0-cp2",
      profileDigest: typo?.digest ?? null,
      treatments: typo && !errors.length ? Object.fromEntries(Object.entries(typo.doc.treatments).map(([t, cfg]) => [t, {
        ko: cfg.locales.ko.face, en: cfg.locales.en.face,
        weights: cfg.locales.ko.weights, weightPolicy: cfg["weight-policy"] ?? null,
        stack: serializeStack(cfg.locales.ko.face, cfg.fallback),
        asset: cfg.asset, rfn: cfg.license.rfn }])) : null,
      errors, warnings: [] };
    if (to["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`typography — ${errors.length} error(s)` + (receipt.treatments ? ` · flat=${receipt.treatments.flat.ko} sketch=${receipt.treatments.sketch.ko}` : ""));
      for (const e of errors) console.log(`  ERROR ${e}`);
    }
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "typography-check") {
    // 정적 effective-font 검증 (CP3 must-fix — composite wrapper font 유실 차단).
    // 규칙: sketch scope(root data-treatment="sketch" 또는 wrapper data-typography-scope)
    // 안의 모든 text/tspan은 (a) scope family로 해석되거나 (b) 명시적 secondary
    // annotation을 가져야 한다. 단독 pre-gate 결과로 composite 검사를 대체할 수 없다 —
    // 이 명령은 최종 파일 자체를 검사한다. 증거 수준: computed cascade (rendered-face
    // proof 아님 — runtime 확인은 font-probe.mjs가 별도 수준으로 기록).
    const files = restAll.filter((a) => !a.startsWith("--"));
    const tco = parseOptions("typography-check", restAll.filter((a) => a.startsWith("--")));
    if (!files.length) fail(2, "typography-check requires at least one SVG path");
    const perrs = [];
    const typo = loadTypography(perrs);
    if (perrs.length) fail(1, perrs[0]);
    const sk = typo.doc.treatments.sketch;
    const allowedWeights = new Set(sk.locales.ko.weights.map(Number));
    const secondaryHead = sk.fallback[0];
    let total = 0;
    const receipts = [];
    for (const file of files) {
      const src = readFileSync(path.resolve(file), "utf8");
      const errors = [];
      const embedded = [];
      for (const m of src.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const fam = m[1].match(/font-family:\s*'([^']+)'/)?.[1];
        if (!fam) { errors.push("E-TYPO-FACE @font-face without a quoted font-family"); continue; }
        if (!/src:\s*url\(data:/.test(m[1])) errors.push(`E-TYPO-REMOTE @font-face "${fam}" src is not a data: URI — remote fonts are forbidden`);
        embedded.push(fam);
      }
      const rootSketch = /<svg[^>]*data-treatment\s*=\s*"sketch"/.test(src);
      const firstFam = (v) => String(v).split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      const famOf = (tag) => {
        const a = tag.match(/font-family\s*=\s*("([^"]*)"|'([^']*)')/);
        if (a) return a[2] ?? a[3];
        const st = tag.match(/style\s*=\s*("([^"]*)"|'([^']*)')/);
        const inStyle = (st?.[2] ?? st?.[3])?.match(/font-family:\s*([^;"}]+)/);
        return inStyle ? inStyle[1] : null;
      };
      // stack: [ {scope, family} ] — g/svg 진입 시 push
      const stack = [];
      let texts = 0;
      for (const m of src.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
        const [, close, name, attrs, self] = m;
        if (close) { if (["g", "svg", "text"].includes(name)) stack.pop(); continue; }
        const fam = famOf(m[0]);
        const scopeAttr = m[0].match(/data-typography-scope\s*=\s*"([^"]+)"/)?.[1]
          ?? (name === "svg" && rootSketch ? (embedded[0] ?? sk.locales.ko.face) : null);
        const frame = { scope: scopeAttr ?? stack.at(-1)?.scope ?? null, family: fam ? firstFam(fam) : stack.at(-1)?.family ?? null };
        if (!self && ["g", "svg", "text"].includes(name)) stack.push(frame);
        if (name !== "text" && name !== "tspan") continue;
        const inScope = frame.scope != null;
        if (!inScope) continue;
        texts++;
        const secondary = /data-typography-role\s*=\s*"secondary"/.test(m[0]);
        const eff = frame.family;
        if (secondary) {
          if (!eff || firstFam(eff) !== firstFam(secondaryHead))
            errors.push(`E-TYPO-SECONDARY <${name}> annotated secondary must resolve to "${secondaryHead}" (got "${eff}")`);
        } else if (!eff || eff !== frame.scope) {
          errors.push(`E-TYPO-LOST <${name}> in scope "${frame.scope}" resolves to "${eff ?? "(document default)"}" — the wrapper lost the typography alias (silent fallback)`);
        } else {
          const w = m[0].match(/font-weight\s*=\s*"(\d+)"/)?.[1];
          if (w && !allowedWeights.has(Number(w)))
            errors.push(`E-TYPO-WEIGHT <${name}> uses weight ${w} but the sketch face supports [${[...allowedWeights].join(", ")}] — synthetic weights are forbidden`);
        }
      }
      total += errors.length;
      receipts.push({ file: path.basename(file), embeddedFamilies: embedded, rootSketchScope: rootSketch,
        textsChecked: texts, evidenceLevel: "computed-cascade (static) — not rendered-face proof", errors });
      if (!tco["--json"]) {
        console.log(`${path.basename(file)} — scope texts ${texts}, embedded [${embedded.join(", ")}], ${errors.length} error(s)`);
        for (const e of errors) console.log(`  ERROR ${e}`);
      }
    }
    if (tco["--json"]) console.log(JSON.stringify({ schemaVersion: 1, command: "typography-check", profileDigest: typo.digest, files: receipts, errors: total }, null, 1));
    process.exit(total ? 1 : 0);
  }
  if (cmd === "manifest") {
    const arg = restAll[0] && !restAll[0].startsWith("--") ? restAll[0] : null;
    const mo = parseOptions("manifest", arg ? restAll.slice(1) : restAll);
    const mPath = arg ? path.resolve(arg) : path.resolve(here, "..", "references", "types", "manifest.yaml");
    const errors = [];
    let doc, digest;
    try { ({ doc, digest } = readYaml(mPath)); } catch (e) { fail(1, `manifest: ${e.message}`); }
    if (doc.schema_version !== 1) errors.push(`manifest: schema_version must be 1 (got ${doc.schema_version})`);
    const packs = doc.typepacks;
    if (!Array.isArray(packs)) errors.push("manifest: typepacks must be an array");
    const ids = new Set();
    const PROFILES = ["exact-parametric", "constrained-layout", "editorial-composition"];
    const SUPPORTS = ["core", "experimental", "gated"];
    for (const p of packs || []) {
      if (typeof p !== "object") { errors.push(`manifest: non-map typepack entry ${JSON.stringify(p)}`); continue; }
      const id = p.id;
      if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(String(id))) errors.push(`manifest: invalid typepack id "${id}"`);
      else if (ids.has(id)) errors.push(`manifest: duplicate typepack id "${id}"`);
      else ids.add(id);
      if (!PROFILES.includes(p.profile)) errors.push(`manifest: ${id}: invalid profile "${p.profile}"`);
      if (!SUPPORTS.includes(p.support)) errors.push(`manifest: ${id}: invalid support "${p.support}"`);
      if (!p.spec) errors.push(`manifest: ${id}: missing spec`);
      else {
        const specPath = path.resolve(path.dirname(mPath), "..", String(p.spec));
        try { readFileSync(specPath); } catch { errors.push(`manifest: ${id}: spec path not found (${p.spec})`); }
      }
      if (!p.selection_signal) errors.push(`manifest: ${id}: missing selection_signal`);
      // full locked-schema validation (Wave 0 CP2 계약 전체 — CP5-R1B)
      const FIELDS = ["id", "selection_signal", "profile", "support", "spec", "presets",
        "orientations", "verifier", "fixtures", "examples", "required_roles",
        "optional_aliases", "canonical_prompt"];
      for (const k of Object.keys(p)) if (!FIELDS.includes(k)) errors.push(`manifest: ${id}: unknown field "${k}" (locked schema: ${FIELDS.join("/")})`);
      for (const k of FIELDS) if (!(k in p)) errors.push(`manifest: ${id}: missing field "${k}"`);
      let pfPresets = [];
      try { pfPresets = Object.keys(readYaml(path.resolve(here, "..", "references", "skins", "pageframe-v1.yaml")).doc.presets || {}); } catch { errors.push("manifest: cannot load pageframe registry for preset validation"); }
      if ("presets" in p) {
        if (!Array.isArray(p.presets) || p.presets.length === 0) errors.push(`manifest: ${id}: presets must be a non-empty array of PageFrame preset ids`);
        else for (const pr of p.presets) if (!pfPresets.includes(pr)) errors.push(`manifest: ${id}: unknown preset "${pr}" (pageframe registry: ${pfPresets.join("/")})`);
      }
      const ORIENT = ["portrait", "landscape", "square"];
      if ("orientations" in p) {
        if (!Array.isArray(p.orientations) || p.orientations.length === 0) errors.push(`manifest: ${id}: orientations must be a non-empty array`);
        else for (const o of p.orientations) if (!ORIENT.includes(o)) errors.push(`manifest: ${id}: invalid orientation "${o}"`);
      }
      if ("verifier" in p && p.verifier !== null) {
        try { readFileSync(path.resolve(path.dirname(mPath), "..", String(p.verifier))); } catch { errors.push(`manifest: ${id}: verifier path not found (${p.verifier})`); }
      }
      if ("fixtures" in p) {
        if (!Array.isArray(p.fixtures)) errors.push(`manifest: ${id}: fixtures must be an array`);
        else for (const f of p.fixtures) { try { readFileSync(path.resolve(path.dirname(mPath), "..", String(f))); } catch { errors.push(`manifest: ${id}: fixture path not found (${f})`); } }
      }
      if ("examples" in p && (!Array.isArray(p.examples) || p.examples.some((e) => !/^[a-z0-9][a-z0-9-]*$/.test(String(e)))))
        errors.push(`manifest: ${id}: examples must be an array of kebab-case gallery ids`);
      if ("required_roles" in p) {
        if (!Array.isArray(p.required_roles) || p.required_roles.length === 0) errors.push(`manifest: ${id}: required_roles must be a non-empty array`);
        else for (const r of p.required_roles) if (!ROLES.includes(r)) errors.push(`manifest: ${id}: unknown role "${r}" (Foundation roles: ${ROLES.join("/")})`);
      }
      const MANIFEST_ALIASES = ["edge", "api", "compute", "data", "external", "icon"];
      if ("optional_aliases" in p && (!Array.isArray(p.optional_aliases) || p.optional_aliases.some((a) => !MANIFEST_ALIASES.includes(a))))
        errors.push(`manifest: ${id}: optional_aliases must be an array within ${MANIFEST_ALIASES.join("/")}`);
      if ("canonical_prompt" in p && !/^PROMPT-GALLERY\.md#[a-z0-9][a-z0-9-]*$/.test(String(p.canonical_prompt)))
        errors.push(`manifest: ${id}: canonical_prompt must match PROMPT-GALLERY.md#<kebab-anchor> (semantics reserved)`);
    }
    const receipt = { schemaVersion: 1, command: "manifest", digest, count: (packs || []).length, errors, warnings: [] };
    if (mo["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`manifest — ${receipt.count} typepack(s), ${errors.length} error(s)`);
      for (const e of errors) console.log(`  ERROR ${e}`);
    }
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "materialize") {
    svgArg = restAll[0];
    if (!svgArg || svgArg.startsWith("--")) fail(2, "materialize requires an SVG path");
    rest = restAll.slice(1);
    const mo = parseOptions("materialize", rest);
    profileArg = mo["--profile"] ?? "current";
    const mode = mo["--mode"] ?? "light";
    const treatment = mo["--treatment"] ?? "flat";
    if (!MODES.includes(mode)) fail(2, `invalid --mode ${mode} (light|dark)`);
    if (!TREATMENTS.includes(treatment)) fail(2, `invalid --treatment ${treatment} (flat|sketch)`);
    if (!SUPPORTED[treatment].includes(mode)) fail(1, `unsupported combination: ${mode} + ${treatment}`);
    if (profileArg === "current") {
      const regErrors = [];
      const registry = loadRegistry(regErrors);
      if (regErrors.length || !registry?.selected["current.palette"]) fail(1, regErrors[0] ?? "registry has no current.palette selection");
      profileArg = path.join(skinsDir, `${registry.selected["current.palette"]}.yaml`);
      selectionBasis = "registry-current";
    }
    const ctx = buildContext(path.resolve(profileArg), treatment === "sketch");
    if (ctx.errors.length) { for (const e of ctx.errors) console.error(`ERROR ${e}`); process.exit(1); }
    const tokens = resolveTokens(ctx.prof, ctx.deriv, mode);
    if (treatment === "sketch") Object.assign(tokens, { paper: ctx.overlay.tokens.paper, "sketch-ink": ctx.overlay.tokens["sketch-ink"], highlight: ctx.overlay.tokens.highlight });
    const svgPath = path.resolve(svgArg);
    const text = readFileSync(svgPath, "utf8");
    const { out, findings } = materializeSvg(text, tokens);
    const check = !!mo["--check"];
    const errors = [];
    const recognized = findings.verified + findings.updated + findings.unknownRoles.length;
    if (check && recognized === 0) errors.push("zero recognized annotations — not a canonical portable SVG (annotate data-fill-role/data-stroke-role, or this file is the rejected variable-paint form)");
    for (const r of new Set(findings.unknownRoles)) errors.push(`unknown role annotation "${r}" (not in resolver output)`);
    if (check && findings.mismatches.length) for (const m of findings.mismatches) errors.push(`paint mismatch: ${m.role} has ${m.have}, profile resolves ${m.want}`);
    const receipt = {
      schemaVersion: 1, command: "materialize", check,
      profile: { id: ctx.prof.id, digests: ctx.digestChain },
      ...(ctx.registry ? { registry: { digest: ctx.registry.digest, selectionBasis } } : {}),
      mode, treatment, updated: findings.updated, verified: findings.verified,
      staticKept: findings.staticKept,
      kernelVersion: "wave0-cp2",
      sourceDigest: sha(text),
      warnings: findings.unannotated.map((u) => `unannotated canonical hex ${u.value} on ${u.attr} (add a role annotation or data-paint-static)`),
      errors,
      resolvedDigest: sha(JSON.stringify(tokens)),
    };
    if (!check && !errors.length && findings.updated > 0) {
      const { writeFileSync } = await_import_fs();
      writeFileSync(svgPath, out);
    }
    if (mo["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`materialize${check ? " --check" : ""} ${path.basename(svgPath)} — updated ${findings.updated}, verified ${findings.verified}, warnings ${receipt.warnings.length}, errors ${errors.length}`);
      for (const e of errors) console.log(`  ERROR ${e}`);
      for (const w of receipt.warnings) console.log(`  warn  ${w}`);
    }
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd !== "registry") {
    profileArg = restAll[0];
    if (!profileArg || profileArg.startsWith("--")) fail(2, `${cmd} requires a profile path or "current"`);
    rest = restAll.slice(1);
    if (profileArg === "current") {
      const regErrors = [];
      const registry = loadRegistry(regErrors);
      if (regErrors.length || !registry?.selected["current.palette"]) fail(1, regErrors[0] ?? "registry has no current.palette selection");
      profileArg = path.join(skinsDir, `${registry.selected["current.palette"]}.yaml`);
      selectionBasis = "registry-current";
    }
  }
  const opts = parseOptions(cmd, rest);

  if (cmd === "registry") {
    const errors = [];
    const registry = loadRegistry(errors);
    if (!registry) fail(1, errors[0]);
    const { reg, digest: regDigest } = registry;
    const ids = { palette: reg.current?.palette, derivation: reg.current?.derivation, sketch: reg.overlays?.sketch, legacy: reg.frozen?.legacy };
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
    ...(ctx.registry ? { registry: { digest: ctx.registry.digest, selected: ctx.registry.selected, selectionBasis } } : {}),
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
  // typography는 독립 축이지만 소비자가 한 번에 받도록 resolve receipt에 동봉한다
  const typoErrors = [];
  const typo = loadTypography(typoErrors);
  if (typoErrors.length) { receipt.errors.push(...typoErrors); printReceipt(receipt, opts["--json"]); process.exit(1); }
  const tcfg = typo.doc.treatments[treatment];
  receipt.typography = { profileDigest: typo.digest, treatment,
    locales: { ko: tcfg.locales.ko, en: tcfg.locales.en },
    fallback: tcfg.fallback, weightPolicy: tcfg["weight-policy"] ?? null,
    synthetic: tcfg.synthetic,
    stack: serializeStack(tcfg.locales.ko.face, tcfg.fallback) };
  printReceipt(receipt, opts["--json"]);
  process.exit(0);
}

// Exported for the palette lint (check-svg.mjs) — the resolver stays the only
// interpreter of profiles. Returns { allowed:Set<hex-upper>, kind, id } or throws.
export function allowedPaintSet(profileId) {
  if (profileId === "legacy-v0.8") {
    const { doc } = readYaml(path.join(skinsDir, "legacy-v0.8.yaml"));
    return { allowed: new Set((doc.allowed || []).map((h) => h.toUpperCase())), kind: "frozen-allowlist", id: doc.id };
  }
  if (profileId === "sketch") {
    const { doc } = readYaml(path.join(skinsDir, "sketch-overlay-v1.yaml"));
    const base = allowedPaintSet("current").allowed;
    for (const v of Object.values(doc.tokens || {})) base.add(String(v).toUpperCase());
    return { allowed: base, kind: "surface-treatment", id: doc.id };
  }
  if (profileId === "current") {
    const errs = [];
    const registry = loadRegistry(errs);
    if (errs.length) throw new Error(errs[0]);
    const p = path.join(skinsDir, `${registry.selected["current.palette"]}.yaml`);
    const ctx = buildContext(p, false);
    if (ctx.errors.length) throw new Error(ctx.errors[0]);
    const allowed = new Set();
    for (const mode of MODES) for (const v of Object.values(resolveTokens(ctx.prof, ctx.deriv, mode))) allowed.add(String(v).toUpperCase());
    allowed.add("#FFFFFF"); allowed.add("#000000");
    return { allowed, kind: "palette", id: ctx.prof.id };
  }
  throw new Error(`unknown palette profile "${profileId}" (current | legacy-v0.8 | sketch)`);
}

// entrypoint guard: run main() based on real paths so symlinked installs still execute
// (silent-pass hardening for all scripts completes in CP3).
try {
  const argvReal = realpathSync(process.argv[1]);
  const selfReal = realpathSync(fileURLToPath(import.meta.url));
  if (argvReal === selfReal) main();
} catch { main(); }
