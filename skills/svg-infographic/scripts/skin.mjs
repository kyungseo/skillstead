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
// reported as a warning (palette lint escalation is a later gate). data-paint-static
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
import { ICON_IDS, ICON_PATHS, hasIcon } from "./icon-registry.mjs";
import { EDGE_KINDS, KIND_ICONS, NODE_KINDS, NODE_KIND_ALIASES, TOPOLOGY_LIMITS,
  TOPOLOGY_VARIANTS, canonicalNodeKind, edgeDirection, isIconAllowedForKind, isNodeKind } from "./topology-contract.mjs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { preflight, guardPackagePath, state, isUnder } from "./preflight-lib.mjs";

// --- minimal YAML subset parser (nested maps, scalars, "- item" lists, comments) ---
function parseInlineMap(v, file, line) {
  // flat scalar inline map: { k: v, k2: v2 } — no nesting
  const out = {};
  const body = v.slice(1, -1).trim();
  if (!body) return out;
  for (const part of body.split(",")) {
    const m = part.match(/^\s*([A-Za-z0-9_.-]+):\s*(.+?)\s*$/);
    if (!m) throw new Error(`${file}:${line + 1} unsupported inline map entry: ${part}`);
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
    else if (val === "true") val = true;
    else if (val === "false") val = false;
    out[m[1]] = val;
  }
  return out;
}
export function parseYaml(text, file) {
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
      } else if (rest.startsWith("{") && rest.endsWith("}")) {
        parent.holder[parent.key].push(parseInlineMap(rest, file, i));
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
    // A key appearing twice in one mapping is not silently overwritten — if the later declaration
    // erased the earlier one, what the validator passed and what a person read would differ.
    if (Object.prototype.hasOwnProperty.call(parent.obj, key))
      throw new Error(`${file}:${i + 1} duplicate key "${key}" in the same mapping`);
    if (valRaw === "") {
      // may become a nested map or a list ("- item" lines at deeper indent)
      const obj = {};
      parent.obj[key] = obj;
      stack.push({ indent, obj, holder: parent.obj, key });
    } else {
      let v = valRaw.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v === "null") v = null;
      // Inline maps already convert to boolean — leaving only the block form as a string would
      // make the same value take different types by notation, splitting the validator quietly.
      else if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (v === "[]") v = [];
      else if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x);
      else if (v.startsWith("{") && v.endsWith("}")) v = parseInlineMap(v, file, i);
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
// SKIN_SKINS_DIR: an alternative profile directory (for negative fixtures and the like). Whatever
// its value, it must clear the containment check when the file is read, so it cannot point outside
// the package — the boundary is enforced by the gate, not by this comment.
const skinsDir = process.env.SKIN_SKINS_DIR
  ? path.resolve(process.env.SKIN_SKINS_DIR)
  : path.resolve(here, "..", "references", "skins");
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

function readYaml(p) {
  // Profiles, the registry and the manifest are package-owned surfaces — containment is checked at
  // resolve time (blocking the path where a registry indirect pointer or an extends leaks outside
  // the package).
  guardPackagePath(p, "profile/registry/manifest");
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
    const TK = ["locales", "fallback", "synthetic", "weight-policy", "optical_calibration", "asset", "license"];
    for (const k of Object.keys(cfg)) if (!TK.includes(k)) errors.push(`typography: ${t}: unknown field "${k}"`);
    if (cfg.synthetic !== "forbidden") errors.push(`typography: ${t}: synthetic must be "forbidden" (synthetic bold/italic is never allowed)`);
    if ("weight-policy" in cfg && cfg["weight-policy"] !== "normalize-400") errors.push(`typography: ${t}: unknown weight-policy "${cfg["weight-policy"]}"`);
    // optical_calibration: a named token that corrects only the **optical size of the face**
    // without changing the base type scale. The band is the smallest unit of correction; per-file
    // or per-string correction cannot be expressed.
    if ("optical_calibration" in cfg) {
      const oc = cfg.optical_calibration;
      if (!oc || typeof oc !== "object") errors.push(`typography: ${t}: optical_calibration must be a map`);
      else {
        for (const k of Object.keys(oc)) if (!["id", "basis", "bands"].includes(k)) errors.push(`typography: ${t}: optical_calibration unknown field "${k}"`);
        if (!oc.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(oc.id))) errors.push(`typography: ${t}: optical_calibration.id must be a kebab-case token (a calibration is named, not anonymous)`);
        if (!oc.basis) errors.push(`typography: ${t}: optical_calibration.basis must record what the value was judged against`);
        const bands = oc.bands ?? {};
        const known = ["display", "body"];
        if (!Object.keys(bands).length) errors.push(`typography: ${t}: optical_calibration.bands must declare at least one band`);
        for (const [b, v] of Object.entries(bands)) {
          if (!known.includes(b)) errors.push(`typography: ${t}: optical_calibration unknown band "${b}" (${known.join("|")})`);
          const n = Number(v);
          if (!Number.isFinite(n) || n < 1 || n > 3) errors.push(`typography: ${t}: optical_calibration.bands.${b} must be a factor between 1 and 3 (got ${v})`);
        }
      }
    }
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
    for (const k of Object.keys(A)) if (!["policy", "embed", "path", "source", "digest", "faces"].includes(k)) errors.push(`typography: ${t}: asset unknown field "${k}"`);
    const checkAsset = (rel, declared, label) => {
      if (!rel) { errors.push(`typography: ${t}: ${label} requires path`); return; }
      if (!declared) { errors.push(`typography: ${t}: ${label} requires digest`); return; }
      try {
        const d = createHash("sha256").update(readFileSync(path.resolve(skinsDir, "..", "..", String(rel)))).digest("hex");
        if (d !== declared) errors.push(`typography: ${t}: ${label} digest mismatch — file ${d.slice(0, 16)}…, declared ${String(declared).slice(0, 16)}…`);
      } catch { errors.push(`typography: ${t}: ${label} not found at ${rel}`); }
    };
    if (A.policy === "bundled") {
      // With several faces, each weight is pinned separately — the contract is "these bytes", not "this font".
      if (Array.isArray(A.faces)) {
        const declaredWeights = new Set();
        for (const [i, f] of A.faces.entries()) {
          for (const k of Object.keys(f)) if (!["weight", "path", "original_filename", "digest"].includes(k))
            errors.push(`typography: ${t}: asset.faces[${i}] unknown field "${k}"`);
          if (!Number.isFinite(Number(f.weight))) errors.push(`typography: ${t}: asset.faces[${i}] requires a numeric weight`);
          else declaredWeights.add(Number(f.weight));
          if (typeof f.original_filename !== "string" || !f.original_filename.trim())
            errors.push(`typography: ${t}: asset.faces[${i}] requires original_filename (upstream provenance)`);
          checkAsset(f.path, f.digest, `asset.faces[${i}]`);
        }
        // Every declared weight needs its asset — with synthetic forbidden, a missing weight cannot be drawn.
        for (const loc of TYPO_LOCALES)
          for (const w of (cfg.locales?.[loc]?.weights ?? []))
            if (!declaredWeights.has(Number(w)))
              errors.push(`typography: ${t}.${loc}: weight ${w} has no bundled face (synthetic is forbidden, so it cannot be drawn)`);
      } else checkAsset(A.path, A.digest, "bundled asset");
      const S = A.source;
      if (S && typeof S === "object") {
        for (const k of ["upstream", "release", "commit", "archive", "archive_digest"])
          if (typeof S[k] !== "string" || !S[k].trim()) errors.push(`typography: ${t}: asset.source requires "${k}" (release provenance)`);
      } else if (typeof S !== "string" || !S.trim()) errors.push(`typography: ${t}: bundled asset requires source provenance`);
    }
    const Li = cfg.license ?? {};
    for (const k of Object.keys(Li)) if (!["id", "evidence", "evidence_digest", "rfn"].includes(k)) errors.push(`typography: ${t}: license unknown field "${k}"`);
    if (typeof Li.id !== "string" || !Li.id.trim()) errors.push(`typography: ${t}: license.id required`);
    if (!Array.isArray(Li.rfn)) errors.push(`typography: ${t}: license.rfn must be a list (empty when no Reserved Font Name is declared)`);
    if (A.policy === "bundled") {
      if (typeof Li.evidence !== "string" || !Li.evidence.trim()) errors.push(`typography: ${t}: bundled asset requires license.evidence path`);
      else {
        try {
          const lbuf = readFileSync(path.resolve(skinsDir, "..", "..", Li.evidence));
          if (Li.evidence_digest) {
            const ld = createHash("sha256").update(lbuf).digest("hex");
            if (ld !== Li.evidence_digest) errors.push(`typography: ${t}: license.evidence digest mismatch`);
          }
          // If the RFN declaration and the actual licence text disagree, one of them is wrong either way.
          const hasRfn = /with Reserved Font Name/i.test(lbuf.toString("utf8"));
          if (hasRfn && (Li.rfn ?? []).length === 0)
            errors.push(`typography: ${t}: license text declares a Reserved Font Name but license.rfn is empty`);
          if (!hasRfn && (Li.rfn ?? []).length > 0)
            errors.push(`typography: ${t}: license.rfn declares names the license text does not reserve`);
        } catch { errors.push(`typography: ${t}: license.evidence not found at ${Li.evidence}`); }
      }
    }
  }
  return { doc, digest };
}


// --- derived geometry floors -------------------------------------------------
// The SSoT for the numbers is the manifest params, and **this one helper owns the formula**.
// The spec explains only the symbolic form; the validator and the renderer both call this function.
export const PANEL_FLOOR_COMPONENTS = ["panelPad", "panelHeaderH", "slotMinH", "slotGap", "minSlots"];
export function derivePanelFloor(params = {}) {
  if (!PANEL_FLOOR_COMPONENTS.some((k) => params[k] !== undefined)) return { declared: false };
  const missing = PANEL_FLOOR_COMPONENTS.filter((k) => !Number.isFinite(Number(params[k])));
  if (missing.length) return { declared: true, missing };
  const n = Number(params.minSlots);
  const value = 2 * Number(params.panelPad) + Number(params.panelHeaderH)
    + n * Number(params.slotMinH) + (n - 1) * Number(params.slotGap);
  return { declared: true, missing: [], value,
    formula: "2×panelPad + panelHeaderH + minSlots×slotMinH + (minSlots−1)×slotGap" };
}


// --- alignment inventory -----------------------------------------------------
// When an alignment group goes missing **in its entirety**, participant annotations alone cannot
// tell. So the expected group list is derived separately from the input cardinality, and the
// artifact is made to declare it.
// The rule: an axis with fewer than two participants has no alignment relation and so **forms no
// group** (incomplete grids are supported, but a singleton group simply does not exist — no
// contradiction is left behind).
// decision-matrix: position is fixed by the **axis values**, not by array order.
// x tiers run low-to-high left-to-right and y tiers low-to-high bottom-to-top, so rows count in reverse.
export function deriveMatrixPlacement(input) {
  const xt = input.axes?.x?.tiers ?? [], yt = input.axes?.y?.tiers ?? [];
  const cols = xt.length, rows = yt.length;
  const cells = (input.cells ?? []).map((c) => {
    const col = xt.findIndex((t) => t.id === c.x), yi = yt.findIndex((t) => t.id === c.y);
    return { id: c.id, x: c.x, y: c.y, col, row: yi < 0 ? -1 : rows - 1 - yi };
  });
  return { cols, rows, xTiers: xt, yTiers: yt, cells };
}
export function deriveAlignInventory(typepack, input, scenario = {}) {
  const out = [];
  if (typepack === "before-after") {
    const n = (input.panels ?? []).length;
    for (const st of input.slots ?? []) if (n >= 2) out.push({ axis: "row", id: `slot-${st.id}`, count: n });
  } else if (typepack === "decision-matrix") {
    const pl = deriveMatrixPlacement(input);
    for (let r = 0; r < pl.rows; r++) {
      const n = pl.cells.filter((c) => c.row === r).length;
      if (n >= 2) out.push({ axis: "row", id: `matrix-r${r}`, count: n });
    }
    for (let c = 0; c < pl.cols; c++) {
      const n = pl.cells.filter((x) => x.col === c).length;
      if (n >= 2) out.push({ axis: "col", id: `matrix-c${c}`, count: n });
    }
    void scenario;
  }
  return out.sort((a, b) => (a.axis + a.id < b.axis + b.id ? -1 : 1));
}
export const serializeAlignInventory = (inv) =>
  inv.map((g) => `${g.axis}:${g.id}=${g.count}`).join(";");

// --- font delivery policy ------------------------------------------------------
// Font identity belongs to the typography SSoT; **how it is delivered** belongs to this profile.
export function loadDelivery(errors, typo = null) {
  const p = path.resolve(skinsDir, "..", "delivery", "font-delivery-v1.yaml");
  let doc, digest;
  try { ({ doc, digest } = readYaml(p)); }
  catch { errors.push("delivery: font-delivery-v1.yaml not found in references/delivery/"); return null; }
  validateIdentity(doc, "font-delivery", "font-delivery-v1", errors);
  const ROOT = ["schema_version", "id", "kind", "extends", "status", "default_mode", "modes"];
  for (const k of Object.keys(doc)) if (!ROOT.includes(k)) errors.push(`delivery: unknown field "${k}"`);
  const M = doc.modes ?? {};
  for (const need of ["portable", "system"]) if (!(need in M)) errors.push(`delivery: missing mode "${need}"`);
  if (!(doc.default_mode in M)) errors.push(`delivery: default_mode "${doc.default_mode}" is not a declared mode`);
  const rfn = [];
  for (const [, cfg] of Object.entries(typo?.treatments ?? {})) for (const n of (cfg.license?.rfn ?? [])) rfn.push(String(n));
  for (const [id, m] of Object.entries(M)) {
    const MK = ["grade", "embed", "format", "alias", "editable", "tool", "on_tool_missing", "on_glyph_missing",
      "requires_installed_family", "identity_rewrite", "preserve_legal_names"];
    for (const k of Object.keys(m)) if (!MK.includes(k)) errors.push(`delivery: ${id}: unknown field "${k}"`);
    if (!["acceptance", "environment-dependent"].includes(m.grade))
      errors.push(`delivery: ${id}: grade must be acceptance|environment-dependent`);
    if (!["subset", "none"].includes(m.embed)) errors.push(`delivery: ${id}: embed must be subset|none`);
    if (typeof m.editable !== "boolean") errors.push(`delivery: ${id}: editable must be a boolean`);
    if (m.embed === "subset") {
      if (m.format !== "woff2") errors.push(`delivery: ${id}: embedded format must be woff2`);
      if (typeof m.alias !== "string" || !m.alias.trim()) errors.push(`delivery: ${id}: subset embedding requires an alias`);
      // OFL: a subset is a Modified Version. Using the reserved name as the alias violates the licence.
      for (const n of rfn)
        if (String(m.alias).toLowerCase().includes(n.toLowerCase()))
          errors.push(`delivery: ${id}: alias "${m.alias}" contains the Reserved Font Name "${n}" — a subset is a Modified Version and must not use it`);
      const T = m.tool ?? {};
      for (const k of ["name", "version", "brotli", "command", "wrapper"]) if (typeof T[k] !== "string" || !T[k].trim())
        errors.push(`delivery: ${id}: tool.${k} must be pinned`);
      if (T.wrapper) {
        try { readFileSync(path.resolve(skinsDir, "..", "..", String(T.wrapper))); }
        catch { errors.push(`delivery: ${id}: tool.wrapper not found at ${T.wrapper} — subsetting must run through the package-owned wrapper, not an arbitrary executable`); }
      }
      if (m.identity_rewrite !== "required" || m.preserve_legal_names !== "required")
        errors.push(`delivery: ${id}: a subset embed must declare identity_rewrite and preserve_legal_names as required (a subset is a Modified Version)`);
      if (!Array.isArray(T.options) || !T.options.length) errors.push(`delivery: ${id}: tool.options must be pinned`);
      if (T.dependency_class !== "build-only")
        errors.push(`delivery: ${id}: tool.dependency_class must be build-only — consuming or verifying an artifact must not require the subsetter`);
      if (m.on_tool_missing !== "fail-closed" || m.on_glyph_missing !== "fail-closed")
        errors.push(`delivery: ${id}: missing tool or glyph must fail closed (never a full embed, never a silent system fallback)`);
      if (m.editable) errors.push(`delivery: ${id}: a subset embed cannot be declared editable — edited text loses its glyphs`);
    } else {
      if (m.grade === "acceptance") errors.push(`delivery: ${id}: a non-embedding mode depends on the viewer's installed fonts and cannot be acceptance-grade`);
      if (m.requires_installed_family !== true) errors.push(`delivery: ${id}: a non-embedding mode must declare requires_installed_family: true`);
    }
  }
  return { doc, digest };
}

// Deterministic stack serialisation — face plus fallback under the CSS rule (quote only families containing spaces)
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
// The tombstone body is a deterministic string the code owns — check and generation share one
// template, so changing the wording cannot make the document and the check disagree
// (skin.mjs tombstones --write).
function canonicalTombstone(title, tid) {
  return `## ${title}\n\n**Migrated to TypePack \`${tid}\`.** Rules: [\`types/specs/${tid}.md\`](types/specs/${tid}.md) ·\n` +
    `routing: [\`types/selection.md\`](types/selection.md).\n`;
}

const OPTION_SPEC = {
  validate: { "--json": false },
  resolve: { "--mode": true, "--treatment": true, "--json": false },
  registry: { "--json": false },
  icons: { "--json": false },
  materialize: { "--profile": true, "--mode": true, "--treatment": true, "--check": false, "--json": false },
  manifest: { "--json": false },
  selection: { "--check": false, "--write": false, "--json": false },
  gallery: { "--check": false, "--write": false, "--json": false },
  tombstones: { "--check": false, "--write": false, "--json": false },
  typography: { "--json": false },
  "typography-check": { "--json": false },
  "delivery": { "--json": false },
  pageframe: { "--h1-lines": true, "--eyebrow": true, "--subtitle": true, "--support": true, "--footer": true, "--content-height": true, "--optical-scale": true, "--json": false },
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

// ---- TypePack input payload schema (CP2A-R1B) ---------------------------------
// The SSoT for input is a **structured payload**, not a prompt sentence. The shared primitives
// (exact key, localized text, stable id, grapheme budget) are kept apart from the per-TypePack
// validators, and unknown fields are refused fail-closed at both root and entity level.
//
// The standing of a character ceiling: where the spec fixes an actual character count — a label,
// say — it is a pre-render hard gate. But copy defined only as "one line / two lines" cannot have
// its line fit proven by a character count. The latter is an **authoring sanity ceiling**; the real
// line count and any overflow are settled by the CP2B browser measurement.
const LOCALES = ["ko", "en"];
const graphemes = (str) => {
  try { return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(String(str))].length; }
  catch { return [...String(str)].length; }   // code point fallback
};
// budget kind: "hard" = the spec fixes the character count / "sanity" = an authoring ceiling under a line-count contract
const B = (ko, en, kind = "sanity") => ({ ko, en, kind });

const INPUT_SCHEMA = {
  "cards-kpi-grid": {
    root: ["cards"], collection: "cards",
    entity: { required: { title: B(28, 44) }, optional: { body: B(30, 48), icon: "icon", numeral: B(5, 5, "hard") } },
    limits: {},
  },
  "layer-stack": {
    root: ["layers"], collection: "layers",
    entity: { required: { label: B(28, 40, "hard") }, optional: { note: B(30, 48), items: "chips" } },
    limits: { chipsPerLayer: 4, chipBudget: B(16, 24, "hard") },
  },
  "nested-scope": {
    root: ["rings"], collection: "rings",
    entity: { required: { label: B(20, 30, "hard") }, optional: { callout: B(30, 48), core_icon: "icon" } },
    limits: {},
  },
  "topology-component": {
    root: ["zones", "edges", "boundary"], collection: "zones",
    entity: { required: { label: B(18, 28, "hard") }, optional: { nodes: "nodes" } },
    limits: { nodesPerZone: TOPOLOGY_LIMITS.nodesPerZone, nodesTotal: TOPOLOGY_LIMITS.nodesTotal,
      specimenNodesTotal: TOPOLOGY_LIMITS.specimenNodesTotal, maxEdges: TOPOLOGY_LIMITS.maxEdges,
      nodeName: B(24, 36) },
  },
  "process-flow": {
    root: ["steps", "feedback", "lanes", "branches"], collection: "steps",
    entity: { required: { name: B(24, 36) }, optional: {} },
    limits: { maxBranches: 2, lanes: [2, 3] },
  },
  "approval-gate": {
    root: ["nodes", "gate"], collection: "nodes",
    entity: { required: { name: B(20, 30) }, optional: {} },
    limits: {},
  },
  "before-after": {
    root: ["panels", "slots", "delta"], collection: "panels",
    entity: { required: { title: B(20, 30) }, optional: {} },
    limits: { panels: 2, slots: [2, 5], maxDelta: 3, slotBudget: B(24, 36) },
  },
  "roadmap-timeline": {
    root: ["phases", "now_marker"], collection: "phases",
    entity: { required: { label: B(16, 24), status: "status", card: "card" }, optional: {} },
    limits: { cardTitle: B(20, 30), cardBody: B(30, 48) },
  },
  "decision-matrix": {
    root: ["axes", "cells"], collection: "cells",
    // Position is itself the claim, so a cell declares **which axis values it belongs to**
    // (x/y = tier id). name is optional — without it the name derives from the two tier labels,
    // which removes vague copy like "low-high".
    entity: { required: { x: "tier", y: "tier", trait: B(30, 44) },
      optional: { name: B(16, 24), action: B(20, 30), examples: "examples" } },
    limits: { maxExamples: 2, exampleBudget: B(20, 30), tiers: [2, 3] },
  },
};

// covers is **observed** in the payload, not taken from a declared label. A declared axis that is
// not actually observed is false coverage and is refused.
const COVERS_VOCAB = ["cardinality-max", "copy-boundary-candidate", "optionals-max",
  "edge-density", "containment-depth", "mirrored-slots", "status-and-marker",
  "gate-caption", "chips-max", "degrade-path", "terminal-current", "primitive-coverage", "wave1-reference"];
// Audited axes: whatever is observed must be declared (not only declared within observed, but the converse too).
const AUDITABLE_COVERS = ["cardinality-max", "copy-boundary-candidate", "optionals-max",
  "edge-density", "containment-depth", "mirrored-slots", "status-and-marker", "chips-max", "degrade-path", "terminal-current", "primitive-coverage", "wave1-reference"];

function localized(v, budget, ctx, report, required = true) {
  if (v == null) { if (required) report(`${ctx} is missing`); return; }
  if (typeof v !== "object" || Array.isArray(v)) return report(`${ctx} must be a { ko, en } map`);
  for (const k of Object.keys(v)) if (!LOCALES.includes(k)) report(`${ctx} has unknown locale "${k}"`);
  for (const loc of LOCALES) {
    if (!v[loc]) { report(`${ctx} is missing the ${loc} value (both locales are first-class)`); continue; }
    const n = graphemes(v[loc]), lim = budget?.[loc];
    if (lim && n > lim) report(`${ctx}.${loc} is ${n} graphemes, over the ${lim} ${budget.kind === "hard" ? "budget" : "authoring sanity ceiling"}`);
  }
}
// Every sub-element a receipt can consume as an independent entity is kebab-case and unique within its scope.
function subIds(items, ctx, report) {
  const seen = new Set();
  for (const it of items ?? []) {
    if (!it || typeof it !== "object") continue;
    if (!it.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(it.id))) report(`${ctx} id "${it.id}" must be kebab-case`);
    else if (seen.has(it.id)) report(`duplicate ${ctx} id "${it.id}"`);
    else seen.add(it.id);
  }
}
const exactKeys = (obj, allowed, ctx, report) => {
  for (const k of Object.keys(obj ?? {})) if (!allowed.includes(k)) report(`${ctx} has unknown field "${k}"`);
};

export function validateInputPayload(doc, tid, declaredCount, report) {
  const sc = INPUT_SCHEMA[tid];
  if (!sc) return new Set();
  const META = ["schema_version", "kind", "typepack", "case", "preset", "layout", "cols", "floor", "count", "prompt_ko", "prompt_en", "title", "variant", "purpose"];
  exactKeys(doc, [...META, ...sc.root], "payload root", report);
  // The H1 is the artifact's concluding sentence — the input owns it so the generator cannot invent it.
  localized(doc.title, B(30, 46), "payload title", report);
  const list = doc[sc.collection];
  const observed = new Set();
  if (!Array.isArray(list) || !list.length) { report(`payload must carry "${sc.collection}" entities`); return observed; }
  if (list.length !== Number(declaredCount)) report(`"${sc.collection}" holds ${list.length} entities but the manifest declares count ${declaredCount}`);
  const ids = new Set();
  const req = sc.entity.required, opt = sc.entity.optional;
  for (const e of list) {
    if (!e || typeof e !== "object") { report(`${sc.collection} entity must be a map`); continue; }
    exactKeys(e, ["id", ...Object.keys(req), ...Object.keys(opt)], `${sc.collection} entity "${e.id}"`, report);
    if (!e.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(e.id))) report(`${sc.collection} entity id "${e.id}" must be kebab-case`);
    else if (ids.has(e.id)) report(`duplicate ${sc.collection} entity id "${e.id}"`);
    else ids.add(e.id);
    for (const [f, budget] of Object.entries(req)) {
      if (budget === "tier") continue;      // axis tier references belong to the per-type validator
      if (budget === "status") { if (!["done", "current", "future"].includes(e[f])) report(`entity "${e.id}" status must be done|current|future`); continue; }
      if (budget === "card") {
        if (e[f] === undefined) { report(`entity "${e.id}" is missing its required milestone card`); continue; }
        exactKeys(e[f], ["title", "body"], `entity "${e.id}" card`, report);
        localized(e[f].title, sc.limits.cardTitle, `entity "${e.id}" card.title`, report);
        if (e[f].body !== undefined) localized(e[f].body, sc.limits.cardBody, `entity "${e.id}" card.body`, report);
        continue;
      }
      localized(e[f], budget, `entity "${e.id}" ${f}`, report);
    }
    for (const [f, budget] of Object.entries(opt)) {
      if (e[f] === undefined) continue;
      if (budget === "icon") { if (!hasIcon(e[f])) report(`entity "${e.id}" ${f} "${e[f]}" is not a bundled icon id`); continue; }
      if (budget === "chips") {
        if (!Array.isArray(e[f])) { report(`entity "${e.id}" items must be a list`); continue; }
        if (e[f].length > sc.limits.chipsPerLayer) report(`entity "${e.id}" holds ${e[f].length} chips, over the ${sc.limits.chipsPerLayer} cap`);
        subIds(e[f], `chip of "${e.id}"`, report);
        for (const ch of e[f]) { exactKeys(ch, ["id", "label"], `chip "${ch.id}"`, report); localized(ch.label, sc.limits.chipBudget, `chip "${ch.id}" label`, report); }
        continue;
      }
      if (budget === "nodes") continue;      // owned by the per-type validator
      if (budget === "card") {
        exactKeys(e[f], ["title", "body"], `entity "${e.id}" card`, report);
        localized(e[f].title, sc.limits.cardTitle, `entity "${e.id}" card.title`, report);
        if (e[f].body !== undefined) localized(e[f].body, sc.limits.cardBody, `entity "${e.id}" card.body`, report);
        continue;
      }
      if (budget === "examples") {
        if (!Array.isArray(e[f])) { report(`entity "${e.id}" examples must be a list`); continue; }
        if (e[f].length > sc.limits.maxExamples) report(`entity "${e.id}" holds ${e[f].length} examples, over the ${sc.limits.maxExamples} cap`);
        subIds(e[f], `example of "${e.id}"`, report);
        for (const ex of e[f]) { exactKeys(ex, ["id", "text"], `example "${ex.id}"`, report); localized(ex.text, sc.limits.exampleBudget, `example "${ex.id}" text`, report); }
        continue;
      }
      localized(e[f], budget, `entity "${e.id}" ${f}`, report, false);
    }
  }
  // ---- per-type validators plus observed coverage ----
  const V = {
    "cards-kpi-grid": () => {
      if (list.every((c) => c.icon !== undefined && c.numeral !== undefined)) observed.add("optionals-max");
    },
    "layer-stack": () => {
      if (list.every((l) => (l.items ?? []).length === sc.limits.chipsPerLayer)) observed.add("chips-max");
    },
    "nested-scope": () => {
      for (const [i, r] of list.entries())
        if (r.core_icon !== undefined && i !== list.length - 1) report(`ring "${r.id}" carries core_icon but only the innermost ring may`);
    },
    "topology-component": () => {
      if (!Object.hasOwn(TOPOLOGY_VARIANTS, doc.variant))
        report(`topology variant must be ${Object.keys(TOPOLOGY_VARIANTS).join("|")} (got "${doc.variant}")`);
      const specimen = doc.purpose === "full-primitive-specimen";
      const wave1Reference = doc.purpose === "wave1-reference";
      if (doc.purpose !== undefined && !specimen && !wave1Reference)
        report(`topology purpose must be full-primitive-specimen|wave1-reference when present (got "${doc.purpose}")`);
      if (wave1Reference) observed.add("wave1-reference");
      const nodeIds = new Set();
      const kinds = [];
      for (const z of list) {
        const ns = z.nodes ?? [];
        subIds(ns, `node of "${z.id}"`, report);
        const [lo, hi] = sc.limits.nodesPerZone;
        if (ns.length < lo || ns.length > hi) report(`zone "${z.id}" holds ${ns.length} nodes; the contract allows ${lo}–${hi}`);
        for (const n of ns) {
          exactKeys(n, ["id", "name", "kind", "icon"], `node "${n.id}"`, report);
          if (!n.id) { report("topology node needs an id"); continue; }
          if (nodeIds.has(n.id)) report(`topology node id "${n.id}" appears in more than one zone`);
          nodeIds.add(n.id);
          localized(n.name, sc.limits.nodeName, `node "${n.id}" name`, report);
          if (n.kind === undefined) report(`node "${n.id}" is missing its semantic kind`);
          else if (!isNodeKind(n.kind)) report(`node "${n.id}" kind "${n.kind}" is not in the architecture vocabulary`);
          else kinds.push(canonicalNodeKind(n.kind));
          if (n.icon === undefined) report(`node "${n.id}" is missing its icon (spec: one icon badge per component)`);
          else if (!hasIcon(n.icon)) report(`node "${n.id}" icon "${n.icon}" is not a bundled icon id`);
          else if (isNodeKind(n.kind) && !isIconAllowedForKind(n.kind, n.icon))
            report(`node "${n.id}" icon "${n.icon}" is not allowed for kind "${canonicalNodeKind(n.kind)}" (allowed: ${KIND_ICONS[canonicalNodeKind(n.kind)].join("|")})`);
        }
      }
      const nodeCap = specimen ? sc.limits.specimenNodesTotal : sc.limits.nodesTotal;
      if (nodeIds.size > nodeCap) report(`topology declares ${nodeIds.size} nodes but the ${specimen ? "full primitive specimen" : "standard"} contract caps it at ${nodeCap}`);
      if (specimen) {
        observed.add("primitive-coverage");
        const actual = [...new Set(kinds)].sort();
        const expected = [...NODE_KINDS].sort();
        if (actual.join("|") !== expected.join("|"))
          report(`full primitive specimen kind set must equal the canonical vocabulary (${expected.join("|")}); got ${actual.join("|")}`);
      }
      const edges = doc.edges ?? [];
      if (!edges.length) report("topology payload must declare at least one edge");
      if (edges.length > sc.limits.maxEdges) report(`topology declares ${edges.length} edges, over the ${sc.limits.maxEdges} cap`);
      subIds(edges, "edge", report);
      const eids = new Set();
      for (const ed of edges) {
        exactKeys(ed, ["id", "from", "to", "kind", "delivery", "visibility", "label"], `edge "${ed.id}"`, report);
        if (!ed.id) report("edge needs an id");
        else if (eids.has(ed.id)) report(`duplicate edge id "${ed.id}"`);
        else eids.add(ed.id);
        for (const end of ["from", "to"]) if (!nodeIds.has(ed[end])) report(`edge "${ed.id}" ${end} "${ed[end]}" is not an existing node`);
        if (!EDGE_KINDS.includes(ed.kind)) report(`edge "${ed.id}" kind must be ${EDGE_KINDS.join("|")}`);
        if (!["sync", "async"].includes(ed.delivery)) report(`edge "${ed.id}" delivery must be sync|async`);
        if (!["public", "private"].includes(ed.visibility)) report(`edge "${ed.id}" visibility must be public|private`);
        if (ed.label !== undefined) localized(ed.label, B(16, 24), `edge "${ed.id}" label`, report);
        if (EDGE_KINDS.includes(ed.kind) && edgeDirection(ed.kind) === "producer-to-consumer" && ed.delivery !== "async")
          report(`event edge "${ed.id}" must use async delivery (producer to consumer)`);
      }
      if (doc.boundary !== undefined) {
        exactKeys(doc.boundary, ["label"], "boundary", report);
        localized(doc.boundary.label, B(18, 28), "boundary label", report);
      }
      if (edges.length === sc.limits.maxEdges) observed.add("edge-density");
    },
    "process-flow": () => {
      const br = doc.branches ?? [];
      if (br.length > sc.limits.maxBranches) report(`process declares ${br.length} branches, over the ${sc.limits.maxBranches} cap`);
      subIds(br, "branch", report);
      for (const b of br) {
        exactKeys(b, ["id", "from", "to", "label"], `branch "${b.id}"`, report);
        for (const end of ["from", "to"]) if (!ids.has(b[end])) report(`branch "${b.id}" ${end} "${b[end]}" is not an existing step`);
        localized(b.label, B(20, 30), `branch "${b.id}" label`, report);
      }
      if (doc.feedback !== undefined) {
        exactKeys(doc.feedback, ["from", "to", "label"], "feedback", report);
        for (const end of ["from", "to"]) if (!ids.has(doc.feedback[end])) report(`feedback ${end} "${doc.feedback[end]}" is not an existing step`);
        localized(doc.feedback.label, B(20, 30), "feedback label", report);
      }
      if (doc.lanes !== undefined) {
        const [lo, hi] = sc.limits.lanes;
        if (!Array.isArray(doc.lanes) || doc.lanes.length < lo || doc.lanes.length > hi) report(`lanes must hold ${lo}–${hi} entries when present`);
        subIds(doc.lanes, "lane", report);
        for (const l of doc.lanes ?? []) { exactKeys(l, ["id", "label"], `lane "${l.id}"`, report); localized(l.label, B(16, 24), `lane "${l.id}" label`, report); }
      }
    },
    "approval-gate": () => {
      const g = doc.gate;
      if (!g || typeof g !== "object") { report("approval payload requires a gate"); return; }
      exactKeys(g, ["id", "label", "from", "to", "criterion"], "gate", report);
      subIds([g], "gate", report);
      localized(g.label, B(16, 24), "gate label", report);
      for (const end of ["from", "to"]) if (!ids.has(g[end])) report(`gate ${end} "${g[end]}" is not an existing node`);
      if (g.criterion !== undefined) { localized(g.criterion, B(30, 48), "gate criterion", report); observed.add("gate-caption"); }
    },
    "before-after": () => {
      if (list.length !== sc.limits.panels) report(`before-after requires exactly ${sc.limits.panels} panels (got ${list.length})`);
      const slots = doc.slots ?? [];
      const [lo, hi] = sc.limits.slots;
      if (slots.length < lo || slots.length > hi) report(`before-after requires ${lo}–${hi} mirrored slots (got ${slots.length})`);
      const sids = new Set();
      for (const sl of slots) {
        exactKeys(sl, ["id", "before", "after", "change"], `slot "${sl.id}"`, report);
        if (!sl.id) report("slot needs an id");
        else if (sids.has(sl.id)) report(`duplicate slot id "${sl.id}"`);
        else sids.add(sl.id);
        for (const side of ["before", "after"]) localized(sl[side], sc.limits.slotBudget, `slot "${sl.id}" ${side}`, report);
        if (sl.change !== undefined && !["unchanged", "added", "removed", "changed"].includes(sl.change))
          report(`slot "${sl.id}" change must be unchanged|added|removed|changed`);
      }
      if ((doc.delta ?? []).length > sc.limits.maxDelta) report(`delta holds more than ${sc.limits.maxDelta} entries`);
      subIds(doc.delta, "delta", report);
      for (const d of doc.delta ?? []) { exactKeys(d, ["id", "text"], `delta "${d.id}"`, report); localized(d.text, B(24, 36), `delta "${d.id}" text`, report); }
      if (slots.length === hi) observed.add("mirrored-slots");
    },
    "roadmap-timeline": () => {
      const cur = list.filter((x) => x.status === "current").length;
      if (cur !== 1) report(`exactly one phase must be "current" (found ${cur})`);
      // What the axis means is order. Checking only for "exactly one current" would let an
      // arrangement contradicting time — future, done, current — pass. The statuses must run
      // done* current future*.
      const rank = { done: 0, current: 1, future: 2 };
      let prev = -1, mono = true;
      for (const p of list) {
        const r = rank[p.status];
        if (r === undefined || r < prev) { mono = false; break; }
        prev = r;
      }
      if (!mono) report(`phase statuses must read done* → current → future* in declaration order (got ${list.map((p) => p.status).join(" → ")})`);
      const curIdx = list.findIndex((p) => p.status === "current");
      if (doc.now_marker !== undefined) {
        exactKeys(doc.now_marker, ["label", "after_phase"], "now_marker", report);
        localized(doc.now_marker.label, B(12, 18), "now_marker label", report);
        // The input states the marker position; the renderer does not infer it. after_phase must
        // equal the current phase, so the value is redundant — but the redundancy is checked, which
        // turns "the marker moved and current stayed behind" into **an error rather than a quiet
        // contradiction**.
        const ap = doc.now_marker.after_phase;
        if (ap === undefined) report("now_marker requires after_phase — the marker position is input data, not something the generator may infer");
        else if (!ids.has(ap)) report(`now_marker after_phase "${ap}" is not an existing phase id`);
        else if (curIdx >= 0 && list[curIdx].id !== ap)
          report(`now_marker after_phase "${ap}" must name the phase whose status is "current" (that is "${list[curIdx].id}")`);
        else if (curIdx === list.length - 1)
          report("the last phase is \"current\", so no ordinal interval follows it — drop now_marker from the input instead of asking the renderer to hide a declared label");
      }
      const st = new Set(list.map((x) => x.status));
      if (st.has("done") && st.has("current") && st.has("future") && doc.now_marker !== undefined) observed.add("status-and-marker");
      // The **legal side** of the combination C-06 handles fail-closed: the last phase is current and there is no marker.
      if (curIdx === list.length - 1 && doc.now_marker === undefined) observed.add("terminal-current");
    },
    "decision-matrix": () => {
      const ax = doc.axes;
      if (!ax || typeof ax !== "object") { report("decision payload requires axes"); return; }
      exactKeys(ax, ["x", "y"], "axes", report);
      const [tlo, thi] = sc.limits.tiers;
      const tierIds = {};
      for (const a of ["x", "y"]) {
        if (ax[a] && "low" in ax[a]) { report(`axes.${a} still uses the low/high form — declare ordered "tiers" instead so cell placement can be derived from the axis value`); continue; }
        exactKeys(ax[a], ["tiers"], `axes.${a}`, report);
        const t = ax[a]?.tiers;
        if (!Array.isArray(t) || t.length < tlo || t.length > thi) { report(`axes.${a}.tiers must hold ${tlo}–${thi} ordered steps (low → high)`); continue; }
        const seen = new Set();
        for (const s of t) {
          exactKeys(s, ["id", "label"], `axes.${a} tier "${s?.id}"`, report);
          if (!s?.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(s.id))) report(`axes.${a} tier id "${s?.id}" must be kebab-case`);
          else if (seen.has(s.id)) report(`axes.${a} declares duplicate tier id "${s.id}"`);
          else seen.add(s.id);
          localized(s?.label, B(14, 20), `axes.${a} tier "${s?.id}" label`, report);
        }
        tierIds[a] = seen;
      }
      // A cell takes its position from the axis values, not from array order — the same square cannot be claimed twice.
      const taken = new Map();
      for (const c of list) {
        for (const a of ["x", "y"]) {
          if (!tierIds[a]) continue;
          if (!tierIds[a].has(c?.[a])) report(`cell "${c?.id}" ${a} "${c?.[a]}" is not a declared axes.${a} tier`);
        }
        const key = `${c?.x}|${c?.y}`;
        if (taken.has(key)) report(`cells "${taken.get(key)}" and "${c?.id}" both claim the same (x=${c?.x}, y=${c?.y}) position`);
        else taken.set(key, c?.id);
      }
      if (tierIds.x && tierIds.y && list.length > tierIds.x.size * tierIds.y.size)
        report(`${list.length} cells exceed the ${tierIds.x.size}×${tierIds.y.size} positions the axes declare`);
      if (list.every((c) => c.action !== undefined && (c.examples ?? []).length === sc.limits.maxExamples)) observed.add("optionals-max");
    },
  };
  (V[tid] ?? (() => {}))();
  return observed;
}

export function observedCoverage(doc, tid, declaredCount, fitMax, geometryExpected, extra) {
  const obs = new Set(extra ?? []);
  // Cardinality and degrade are observed from the declared values regardless of whether a schema exists (fixture typepacks included)
  if (Number(declaredCount) === Number(fitMax)) obs.add("cardinality-max");
  if (geometryExpected === "needs-split") obs.add("degrade-path");
  const sc = INPUT_SCHEMA[tid];
  if (!sc) return obs;
  const list = doc[sc.collection] ?? [];
  if (tid === "nested-scope" && list.length === Number(fitMax)) obs.add("containment-depth");
  // copy-boundary-candidate: any required localized field at 85% or more of its declared ceiling.
  // It is a **candidate**, as the name says; the real line fit is settled by the CP2B browser
  // measurement.
  const texts = [];
  for (const e of list) {
    for (const [f, budget] of Object.entries({ ...sc.entity.required, ...sc.entity.optional }))
      if (typeof budget !== "string") texts.push([e[f], budget]);
    // Also look where the actual copy lives per type (nested text outside the collection)
    for (const ch of e.items ?? []) texts.push([ch.label, sc.limits.chipBudget]);
    for (const n of e.nodes ?? []) texts.push([n.name, sc.limits.nodeName]);
    for (const ex of e.examples ?? []) texts.push([ex.text, sc.limits.exampleBudget]);
    if (e.card) { texts.push([e.card.title, sc.limits.cardTitle]); texts.push([e.card.body, sc.limits.cardBody]); }
  }
  for (const sl of doc.slots ?? []) { texts.push([sl.before, sc.limits.slotBudget]); texts.push([sl.after, sc.limits.slotBudget]); }
  if (doc.gate?.criterion) texts.push([doc.gate.criterion, { ko: 30, en: 48 }]);
  // KO and EN are both first-class, so being at the boundary in one language alone is not a candidate — each locale needs a witness
  const witness = { ko: false, en: false };
  for (const [v, b2] of texts) for (const loc of LOCALES)
    if (v?.[loc] && b2?.[loc] && graphemes(v[loc]) >= Math.ceil(b2[loc] * 0.85)) witness[loc] = true;
  if (witness.ko && witness.en) obs.add("copy-boundary-candidate");
  return obs;
}

const PF_HEADER = ["eyebrow", "h1", "subtitle"];
const PF_HI = ["ascent-mult", "eyebrow-row-mult", "eyebrow-gap", "collapsed-top-mult",
  "h1-line-mult", "h1-descent-mult", "subtitle-gap-mult", "subtitle-descent-mult",
  "keyline-width-mult", "keyline-gap-mult", "keyline-pad-mult"];
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
  preflight({ entrypointUrl: import.meta.url });
  const [cmd, ...restAll] = process.argv.slice(2);
  if (!cmd || !(cmd in OPTION_SPEC)) fail(2, "usage: skin.mjs validate|resolve <profile.yaml> [options] | registry|icons|manifest|selection|gallery|delivery [--json]");
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
    // The optical scale **does not overwrite** the base type scale — for this run alone it makes a
    // copy with corrected header metrics, and PageFrame recomputes the header region height from
    // those values too.
    const os = po["--optical-scale"] === undefined ? 1 : Number(po["--optical-scale"]);
    if (!Number.isFinite(os) || os < 1 || os > 3) fail(2, "--optical-scale must be a factor between 1 and 3");
    const Peff = os === 1 ? P : { ...P, header: Object.fromEntries(Object.entries(P.header).map(([k, v]) => [k, Math.round(Number(v) * os)])) };
    const opts = { h1Lines, eyebrow: b(po["--eyebrow"], true), subtitle: b(po["--subtitle"], true), support, footer: b(po["--footer"], false), contentHeight };
    const out = computePageFrame(Peff, opts);
    if (!out.fluid && (out.contentBox.h == null || out.contentBox.h <= 0)) fail(1, `preset ${preset}: computed contentBox height is not positive (${out.contentBox.h}) — canvas too small for the requested regions`);
    if (out.contentBox.w <= 0) fail(1, `preset ${preset}: computed contentBox width is not positive (${out.contentBox.w})`);
    // headerScale: header metrics derived from the profile, not per-file manual constants — header
    // treatments such as title-keyline consume only these values
    const HIm = P["header-internal"];
    const headerScale = {
      // nominal belongs to the profile; resolved is the value with the optical calibration applied.
      nominal: { eyebrow: P.header.eyebrow, h1: P.header.h1, subtitle: P.header.subtitle },
      opticalScale: os,
      eyebrow: Peff.header.eyebrow, h1: Peff.header.h1, subtitle: Peff.header.subtitle,
      h1LinePitch: Math.round(Peff.header.h1 * HIm["h1-line-mult"]),
      keyline: { width: Math.round(Peff.header.h1 * HIm["keyline-width-mult"]),
                 gap: Math.round(Peff.header.h1 * HIm["keyline-gap-mult"]),
                 pad: Math.round(Peff.header.h1 * HIm["keyline-pad-mult"]) } };
    const receipt = { schemaVersion: 1, command: "pageframe", kernelVersion: "kernel-v1",
      profile: { id: pf.doc.id, digest: pf.digest }, preset, orientation: P.orientation,
      canvas: { width: P["canvas-width"], height: P["canvas-height"] },
      options: opts, arrow: P.arrow, "scale-band": pf.doc["scale-band"], headerScale, regions: out, errors: [], warnings: [] };
    if (po["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`pageframe ${preset} (${P.orientation}) — header ${out.headerRegion.y}..${out.headerRegion.y + out.headerRegion.h} (${out.headerRegion.h}px), contentBox ${JSON.stringify(out.contentBox)}, footer: ${out.footerRule}`);
    }
    process.exit(0);
  }
  if (cmd === "tombstones") {
    // Regenerate migrated archetype sections from the canonical template — so the same wording is
    // not hand-copied across the seven migrations, and a wording change happens in one place.
    const to = parseOptions("tombstones", restAll);
    const mPath = path.resolve(here, "..", "references", "types", "manifest.yaml");
    const archPath = path.resolve(here, "..", "references", "archetypes.md");
    const errors = [];
    let doc, arch;
    try { ({ doc } = readYaml(mPath)); } catch (e) { fail(1, `tombstones: ${e.message}`); }
    try { arch = readFileSync(archPath, "utf8"); } catch (e) { fail(1, `tombstones: ${e.message}`); }
    const claims = (doc.typepacks ?? []).filter((p) => p.legacy_section).map((p) => [String(p.legacy_section), String(p.id)]);
    const parts = arch.split(/^## /m);
    const head = parts[0];
    const secs = parts.slice(1).map((b) => ({ title: b.split("\n")[0].trim(), body: "## " + b }));
    let changed = 0;
    for (const [title, id] of claims) {
      const sec = secs.find((x) => x.title === title);
      if (!sec) { errors.push(`tombstones: legacy_section "${title}" (${id}) not found in archetypes.md`); continue; }
      const want = canonicalTombstone(title, id);
      const trailing = sec.body.endsWith("\n\n") ? "\n" : "";
      const next = want + trailing;
      if (sec.body.trim() !== want.trim()) { sec.body = next; changed++; }
    }
    const out = head + secs.map((x) => x.body).join("");
    if (to["--write"]) {
      if (state()?.mode !== "source-development")
        fail(1, "tombstones --write requires source-development execution (run it from the repository that owns the package)");
      if (!errors.length && changed) writeFileSync(archPath, out);
    } else if (to["--check"] && changed) {
      errors.push(`tombstones: ${changed} migrated section(s) do not match the canonical template (regenerate with --write)`);
    }
    const receipt = { schemaVersion: 1, command: "tombstones", kernelVersion: "kernel-v1",
      claimed: claims.length, changed, errors, warnings: [] };
    if (to["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else console.log(`tombstones — ${claims.length} claimed, ${changed} ${to["--write"] ? "regenerated" : "out of date"}, ${errors.length} error(s)`);
    for (const e of errors) console.error(`ERROR ${e}`);
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "selection") {
    // The selection table is a **view derived** from the manifest, not a hand-maintained copy.
    // The manifest's selection_signal is the SSoT, and this command either generates the view
    // (--write) or checks whether the committed view has drifted from the manifest (--check).
    const so = parseOptions("selection", restAll);
    const mPath = path.resolve(here, "..", "references", "types", "manifest.yaml");
    const viewPath = path.resolve(here, "..", "references", "types", "selection.md");
    const errors = [];
    let doc;
    try { ({ doc } = readYaml(mPath)); } catch (e) { fail(1, `selection: ${e.message}`); }
    const mr = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "manifest", "--json"], { encoding: "utf8" });
    let mj = null;
    try { mj = JSON.parse(mr.stdout); } catch { errors.push("selection: manifest validation did not return JSON"); }
    if (mj && mj.errors.length) errors.push(`selection: manifest is invalid (${mj.errors.length} error(s)) — fix the manifest before deriving the view`);
    const packs = (doc.typepacks ?? []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    // The routing view is discovery copy — a gated type is not exposed, only counted.
    const shown = packs.filter((p) => p.support !== "gated");
    const gated = packs.length - shown.length;
    const anchors = new Set();
    for (const p of packs) {
      if (anchors.has(p.canonical_prompt)) errors.push(`selection: duplicate canonical_prompt anchor "${p.canonical_prompt}"`);
      anchors.add(p.canonical_prompt);
    }
    const esc = (v) => String(v).replace(/\|/g, "\\|");
    // Spec links must be relative to the view file's location (the manifest's spec paths are relative to references/)
    const specHref = (spec) => path.relative(path.dirname(viewPath), path.resolve(here, "..", "references", String(spec))).split(path.sep).join("/");
    // experimental means preview — marked so it does not read with the same stability as core.
    const maturity = (p) => p.support === "core" ? "core" : "experimental (preview)";
    const promptCell = (p) => p.canonical_prompt?.status === "bound"
      ? `\`${p.canonical_prompt.anchor}\``
      : `\`${p.canonical_prompt?.anchor}\` (reserved)`;
    const rows = shown.map((p) => `| ${esc(p.selection_signal)} | \`${p.id}\` | ${p.profile} | ${maturity(p)} | [spec](${specHref(p.spec)}) | ${promptCell(p)} |`);
    const gatedRows = packs.filter((p) => p.support === "gated")
      .map((p) => `| \`${p.id}\` | ${esc(p.gate?.reason ?? "—")} | ${esc(p.gate?.release ?? "—")} |`);
    const view = [
      "<!-- GENERATED VIEW — do not edit by hand.",
      "     Source of truth: references/types/manifest.yaml (`selection_signal`).",
      "     Regenerate with `node scripts/skin.mjs selection --write`;",
      "     `node scripts/skin.mjs selection --check` fails when this file drifts. -->",
      "",
      "# TypePack selection",
      "",
      "Start from what you want to show and pick a TypePack. Each row's spec owns that type's",
      "input contract, layout formulas and verification checklist. `experimental (preview)` means",
      "no example or verification evidence is registered yet, so do not read it as being as stable",
      "as `core`.",
      "",
      "| Content signal | TypePack | profile | maturity | spec | canonical prompt |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
      "## Registered but not routable",
      "",
      gated
        ? "The TypePacks below are registered but not routed to. The reason and the release condition are recorded here so this stays auditable."
        : "None at present. (A gated TypePack drops out of routing, but its reason and release condition stay here.)",
      "",
      ...(gated ? ["| TypePack | gate reason | release condition |", "| --- | --- | --- |", ...gatedRows, ""] : []),
      `${shown.length} of the ${packs.length} registered TypePacks are routed to.`,
      "",
    ].join("\n");
    const readView = () => { try { return readFileSync(viewPath, "utf8"); } catch { return null; } };
    const current = readView();
    const driftedBefore = current !== view;
    let wrote = false;
    if (so["--write"]) {
      // Writing a generated view into the package is development work — not allowed in an installed run.
      if (state()?.mode !== "source-development")
        fail(1, "selection --write requires source-development execution (run it from the repository that owns the package)");
      if (!errors.length) { writeFileSync(viewPath, view); wrote = true; }
    } else if (so["--check"]) {
      if (current === null) errors.push("selection: references/types/selection.md is missing — regenerate it with --write");
      else if (driftedBefore) errors.push("selection: references/types/selection.md is out of date with the manifest (regenerate with --write)");
    }
    // The drift state distinguishes before and after the write — a successful sync must not leave drifted behind.
    const driftedAfter = readView() !== view;
    const receipt = { schemaVersion: 1, command: "selection", kernelVersion: "kernel-v1",
      registered: packs.length, shown: shown.length, gated,
      driftedBefore, wrote, driftedAfter, errors, warnings: [] };
    if (so["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else if (so["--check"] || so["--write"]) console.log(`selection — ${packs.length} registered, ${shown.length} shown, ${errors.length} error(s)`);
    else process.stdout.write(view);
    for (const e of errors) console.error(`ERROR ${e}`);
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "gallery") {
    // The Prompt Gallery is a **derived view** too, not a hand-maintained document. The manifest owns
    // the selection signal and the input payloads own the prompt wording — this command only joins
    // the two, so the gallery cannot quietly claim copy the package does not carry.
    const go = parseOptions("gallery", restAll);
    const mPath = path.resolve(here, "..", "references", "types", "manifest.yaml");
    const viewPath = path.resolve(here, "..", "references", "PROMPT-GALLERY.md");
    const errors = [];
    let doc;
    try { ({ doc } = readYaml(mPath)); } catch (e) { fail(1, `gallery: ${e.message}`); }
    const packs = (doc.typepacks ?? []).filter((p) => p.support !== "gated")
      .slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const rel = (p) => path.relative(path.dirname(viewPath), p).split(path.sep).join("/");
    const sections = [];
    for (const p of packs) {
      const anchor = String(p.canonical_prompt?.anchor ?? "");
      const am = /^PROMPT-GALLERY\.md#([a-z0-9-]+)$/.exec(anchor);
      if (!am) { errors.push(`gallery: ${p.id}: canonical_prompt.anchor must be PROMPT-GALLERY.md#<anchor> (got "${anchor}")`); continue; }
      // The anchor derives from the heading — if it differs from the id, a reader lands on another entry.
      if (am[1] !== p.id) errors.push(`gallery: ${p.id}: anchor "#${am[1]}" must match the TypePack id`);
      const ci = p.inputs?.canonical;
      if (!ci?.path) { errors.push(`gallery: ${p.id}: no canonical input registered`); continue; }
      const ip = path.resolve(here, "..", "references", String(ci.path));
      let input = null;
      try { ({ doc: input } = readYaml(ip)); } catch { errors.push(`gallery: ${p.id}: canonical input ${ci.path} is unreadable`); continue; }
      for (const k of ["prompt_ko", "prompt_en"])
        if (!input[k]) errors.push(`gallery: ${p.id}: canonical input is missing ${k} — the gallery never invents a prompt`);
      const presets = (p.presets ?? []).join(", ");
      const variants = (p.inputs?.stress ?? []).map((s) =>
        `\`${String(s.id).replace(`${p.id}-`, "")}\` (${s.preset}, ${s.geometry_expected})`).join(" · ") || "—";
      sections.push([
        `## ${p.id}`,
        "",
        `**Choose it when** ${p.selection_signal}`,
        "",
        `- Spec: [\`${path.basename(String(p.spec))}\`](${rel(path.resolve(here, "..", "references", String(p.spec)))})`,
        `- Profile \`${p.profile}\` · maturity \`${p.support}\` · presets ${presets} · preferred \`${p.preferred_preset}\``,
        `- Canonical input: [\`${path.basename(String(ci.path))}\`](${rel(ip)}) (\`${ci.preset}\`, ${ci.layout}, count ${ci.count})`,
        "",
        "Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:",
        "",
        "```text",
        `ko: ${input.prompt_ko ?? ""}`,
        `en: ${input.prompt_en ?? ""}`,
        "```",
        "",
        "Build and verify:",
        "",
        "```bash",
        `node scripts/generate.mjs build --typepack ${p.id} --case canonical --locale ko \\`,
        `  --out <out>.svg --receipt <out>.json`,
        `node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg`,
        "```",
        "",
        `The receipt records \`consumed\` (every declared entity id), \`geometry\` vs \`geometryExpected\`, \`residual\` with its disposition, and \`fontDelivery\`. Declared variants: ${variants}. A configuration that does not fit returns \`needs-split\` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.`,
        "",
      ].join("\n"));
    }
    const view = [
      "<!-- GENERATED VIEW — do not edit by hand.",
      "     Source of truth: references/types/manifest.yaml + the canonical input payloads.",
      "     Regenerate with `node scripts/skin.mjs gallery --write`;",
      "     `node scripts/skin.mjs gallery --check` fails when this file drifts. -->",
      "",
      "# Prompt Gallery",
      "",
      "One entry per routable TypePack: the signal that selects it, the canonical prompt in both locales,",
      "the command that produces the artifact, and what the receipt must show. Prompts are read from the",
      "canonical input payloads, so this catalog cannot claim wording the package does not actually carry.",
      "",
      "This file is the **agent-facing** catalog and stays inside the package. Rendered examples for human",
      "readers live in the repository's Example Cookbook, outside the installed package.",
      "",
      `${packs.length} routable TypePacks.`,
      "",
      ...sections,
    ].join("\n").replace(/\n+$/, "\n");
    const readView = () => { try { return readFileSync(viewPath, "utf8"); } catch { return null; } };
    const current = readView();
    const driftedBefore = current !== view;
    let wrote = false;
    if (go["--write"]) {
      if (state()?.mode !== "source-development")
        fail(1, "gallery --write requires source-development execution (run it from the repository that owns the package)");
      if (!errors.length) { writeFileSync(viewPath, view); wrote = true; }
    } else if (go["--check"]) {
      if (current === null) errors.push("gallery: references/PROMPT-GALLERY.md is missing — regenerate it with --write");
      else if (driftedBefore) errors.push("gallery: references/PROMPT-GALLERY.md is out of date with the manifest or the canonical inputs (regenerate with --write)");
    }
    const receipt = { schemaVersion: 1, command: "gallery", kernelVersion: "kernel-v1",
      entries: packs.length, driftedBefore, wrote, driftedAfter: readView() !== view, errors, warnings: [] };
    if (go["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else if (go["--check"] || go["--write"]) console.log(`gallery — ${packs.length} entries, ${errors.length} error(s)`);
    else process.stdout.write(view);
    for (const e of errors) console.error(`ERROR ${e}`);
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "typography") {
    const tArg = restAll[0] && !restAll[0].startsWith("--") ? restAll[0] : null;
    const to = parseOptions("typography", tArg ? restAll.slice(1) : restAll);
    const errors = [];
    const typo = loadTypography(errors, tArg);
    const receipt = { schemaVersion: 1, command: "typography", kernelVersion: "kernel-v1",
      profileDigest: typo?.digest ?? null,
      treatments: typo && !errors.length ? Object.fromEntries(Object.entries(typo.doc.treatments).map(([t, cfg]) => [t, {
        ko: cfg.locales.ko.face, en: cfg.locales.en.face,
        weights: cfg.locales.ko.weights, weightPolicy: cfg["weight-policy"] ?? null,
        opticalCalibration: cfg.optical_calibration ?? null,
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
    // Static effective-font verification (blocking a lost composite wrapper font).
    // The rule: every text/tspan inside a sketch scope (root data-treatment="sketch", or a wrapper
    // data-typography-scope) must either (a) resolve to the scope family or (b) carry an explicit
    // secondary annotation. A standalone pre-gate result cannot stand in for the composite check —
    // this command inspects the final file itself. Evidence level: computed cascade (not
    // rendered-face proof — the runtime confirmation is recorded at its own level by
    // font-probe.mjs).
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
      const rootTag = src.match(/<svg[^>]*>/)?.[0] ?? "";
      const rootSketch = (rootTag.match(/data-treatment\s*=\s*("([^"]*)"|'([^']*)')/)?.[2]
        ?? rootTag.match(/data-treatment\s*=\s*("([^"]*)"|'([^']*)')/)?.[3]) === "sketch";
      const firstFam = (v) => String(v).split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      const attrOf = (tag, name) => {
        const a = tag.match(new RegExp(name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')"));
        return a ? (a[2] ?? a[3]) : null;
      };
      const styleOf = (tag, prop) => {
        const st = attrOf(tag, "style");
        const m2 = st?.match(new RegExp(prop + ":\\s*([^;\"}]+)"));
        return m2 ? m2[1].trim() : null;
      };
      const famOf = (tag) => attrOf(tag, "font-family") ?? styleOf(tag, "font-family");
      const weightOf = (tag) => attrOf(tag, "font-weight") ?? styleOf(tag, "font-weight");
      // stack: [ {scope, family} ] — pushed on entering a g or svg
      const stack = [];
      let texts = 0;
      for (const m of src.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
        const [, close, name, attrs, self] = m;
        if (close) { if (["g", "svg", "text"].includes(name)) stack.pop(); continue; }
        const fam = famOf(m[0]);
        const scopeAttr = attrOf(m[0], "data-typography-scope")
          ?? (name === "svg" && rootSketch ? (embedded[0] ?? sk.locales.ko.face) : null);
        // F2: weight is computed through the inheritance stack too (catching a 700 inherited from an ancestor g's style or attribute)
        const w0 = weightOf(m[0]);
        const frame = { scope: scopeAttr ?? stack.at(-1)?.scope ?? null,
                        family: fam ? firstFam(fam) : stack.at(-1)?.family ?? null,
                        weight: w0 ?? stack.at(-1)?.weight ?? null };
        if (!self && ["g", "svg", "text"].includes(name)) stack.push(frame);
        if (name !== "text" && name !== "tspan") continue;
        const inScope = frame.scope != null;
        if (!inScope) continue;
        texts++;
        const secondary = attrOf(m[0], "data-typography-role") === "secondary";
        const eff = frame.family;
        if (secondary) {
          if (!eff || firstFam(eff) !== firstFam(secondaryHead))
            errors.push(`E-TYPO-SECONDARY <${name}> annotated secondary must resolve to "${secondaryHead}" (got "${eff}")`);
        } else if (!eff || eff !== frame.scope) {
          errors.push(`E-TYPO-LOST <${name}> in scope "${frame.scope}" resolves to "${eff ?? "(document default)"}" — the wrapper lost the typography alias (silent fallback)`);
        } else {
          const w = frame.weight;
          if (w != null && !allowedWeights.has(Number(w)))
            errors.push(`E-TYPO-WEIGHT <${name}> resolves to weight ${w} (inherited cascade included) but the sketch face supports [${[...allowedWeights].join(", ")}] — synthetic weights are forbidden`);
        }
      }
      const hasMarkers = rootSketch || /data-typography-(scope|role)\s*=/.test(src);
      if (hasMarkers && texts === 0)
        errors.push("E-TYPO-EMPTY typography markers present but no scoped text was recognized — malformed annotation must not degrade to \"nothing to check\"");
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
    if (doc.schema_version !== 2) errors.push(`manifest: schema_version must be 2 (atomic package upgrade — v1 manifests are rejected; got ${doc.schema_version})`);
    const packs = doc.typepacks;
    if (!Array.isArray(packs)) errors.push("manifest: typepacks must be an array");
    const ids = new Set(), fixtureIds = new Set(), exampleIds = new Set(), fixturePaths = new Set(), inputIds = new Set();
    // Compute the live PageFrame receipt once per preset and reuse it (never copy constants out of the docs)
    const pfCache = new Map();
    const pageframeFor = (preset) => {
      if (pfCache.has(preset)) return pfCache.get(preset);
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "pageframe", preset, "--json"], { encoding: "utf8" });
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { j = null; }
      pfCache.set(preset, j);
      return j;
    };
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
      // full locked-schema validation (the whole kernel contract)
      const FIELDS = ["id", "selection_signal", "profile", "support", "spec", "presets",
        "orientations", "verifier", "receipt_schema", "fixtures", "examples",
        "required_roles", "optional_aliases", "canonical_prompt", "annexes", "gate",
        "migration_origin", "legacy_section", "fit", "inputs", "composition", "preferred_preset"];
      for (const k of Object.keys(p)) if (!FIELDS.includes(k)) errors.push(`manifest: ${id}: unknown field "${k}" (locked schema: ${FIELDS.join("/")})`);
      for (const k of FIELDS) if (k !== "composition" && !(k in p)) errors.push(`manifest: ${id}: missing field "${k}"`); // composition is an optional capability (absent => composable: false)
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
        // A fixture is an evidence entry, not a path string — pinning its kind, preset and
        // extension is what stops "promotion to core" from meaning "any one file path".
        if (!Array.isArray(p.fixtures)) errors.push(`manifest: ${id}: fixtures must be an array`);
        else for (const f of p.fixtures) {
          if (!f || typeof f !== "object") { errors.push(`manifest: ${id}: fixture must be { id, kind, preset, path }`); continue; }
          for (const k of Object.keys(f)) if (!["id", "kind", "preset", "path"].includes(k)) errors.push(`manifest: ${id}: fixture unknown field "${k}"`);
          if (!f.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(f.id))) errors.push(`manifest: ${id}: invalid fixture id "${f.id}"`);
          else if (fixtureIds.has(f.id)) errors.push(`manifest: ${id}: duplicate fixture id "${f.id}"`);
          else fixtureIds.add(f.id);
          if (!["positive", "baseline-red"].includes(f.kind)) errors.push(`manifest: ${id}: fixture "${f.id}" kind must be positive|baseline-red`);
          if (Array.isArray(p.presets) && !p.presets.includes(f.preset)) errors.push(`manifest: ${id}: fixture "${f.id}" preset "${f.preset}" is not one of this typepack's presets`);
          const fp = String(f.path ?? "");
          if (!/\.(svg|json)$/.test(fp)) errors.push(`manifest: ${id}: fixture "${f.id}" must point at an .svg artifact or .json receipt (got "${fp}")`);
          const abs = path.resolve(path.dirname(mPath), "..", fp);
          if (!isUnder(abs, path.resolve(here, ".."))) errors.push(`manifest: ${id}: fixture "${f.id}" path escapes the package`);
          else { try { readFileSync(abs); } catch { errors.push(`manifest: ${id}: fixture path not found (${fp})`); } }
          // Reusing one artifact as both positive and baseline-red, or across several presets,
          // turns it from evidence into registration metadata.
          const fkey = `${id}::${fp}`;
          if (fixturePaths.has(fkey)) errors.push(`manifest: ${id}: fixture artifact "${fp}" is registered more than once — one artifact proves one (kind, preset) claim`);
          else fixturePaths.add(fkey);
        }
      }
      // An example is evidence tied to a real gallery anchor — promotion to core is possible only
      // when that link actually resolves (see the promotion check below).
      if ("examples" in p) {
        if (!Array.isArray(p.examples)) errors.push(`manifest: ${id}: examples must be an array`);
        else for (const ex of p.examples) {
          if (!ex || typeof ex !== "object") { errors.push(`manifest: ${id}: example must be { id, gallery_anchor }`); continue; }
          for (const k of Object.keys(ex)) if (!["id", "gallery_anchor"].includes(k)) errors.push(`manifest: ${id}: example unknown field "${k}"`);
          if (!ex.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(ex.id))) errors.push(`manifest: ${id}: invalid example id "${ex.id}"`);
          else if (exampleIds.has(ex.id)) errors.push(`manifest: ${id}: duplicate example id "${ex.id}"`);
          else exampleIds.add(ex.id);
          // The gallery locator is restricted to the canonical gallery file — blocking the path
          // where any document's heading gets registered as example evidence.
          if (!/^PROMPT-GALLERY\.md#[a-z0-9][a-z0-9-]*$/.test(String(ex.gallery_anchor ?? "")))
            errors.push(`manifest: ${id}: example "${ex.id}" gallery_anchor must be PROMPT-GALLERY.md#<kebab-anchor> (the canonical gallery is the only example registry)`);
        }
      }
      if ("required_roles" in p) {
        if (!Array.isArray(p.required_roles) || p.required_roles.length === 0) errors.push(`manifest: ${id}: required_roles must be a non-empty array`);
        else for (const r of p.required_roles) if (!ROLES.includes(r)) errors.push(`manifest: ${id}: unknown role "${r}" (Foundation roles: ${ROLES.join("/")})`);
      }
      const MANIFEST_ALIASES = ["edge", "api", "compute", "data", "external", "icon"];
      if ("optional_aliases" in p && (!Array.isArray(p.optional_aliases) || p.optional_aliases.some((a) => !MANIFEST_ALIASES.includes(a))))
        errors.push(`manifest: ${id}: optional_aliases must be an array within ${MANIFEST_ALIASES.join("/")}`);
      // canonical_prompt: reserved (format and uniqueness only) | bound (requires the file and anchor to exist)
      const cp = p.canonical_prompt;
      if (!cp || typeof cp !== "object") errors.push(`manifest: ${id}: canonical_prompt must be { status, anchor }`);
      else {
        for (const k of Object.keys(cp)) if (!["status", "anchor"].includes(k)) errors.push(`manifest: ${id}: canonical_prompt unknown field "${k}"`);
        if (!["reserved", "bound"].includes(cp.status)) errors.push(`manifest: ${id}: canonical_prompt.status must be reserved|bound`);
        const am = /^([A-Za-z0-9._-]+\.md)#([a-z0-9][a-z0-9-]*)$/.exec(String(cp.anchor ?? ""));
        if (!am) errors.push(`manifest: ${id}: canonical_prompt.anchor must match <file>.md#<kebab-anchor>`);
        else if (cp.status === "bound") {
          // bound is a claim that the link is complete — the target file and anchor must really exist
          const target = path.resolve(path.dirname(mPath), "..", am[1]);
          let text = null;
          try { text = readFileSync(target, "utf8"); } catch { errors.push(`manifest: ${id}: canonical_prompt is bound but ${am[1]} does not exist in the package`); }
          if (text !== null) {
            const slug = (t) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
            const heads = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((h) => slug(h[1]));
            if (!heads.includes(am[2])) errors.push(`manifest: ${id}: canonical_prompt anchor "#${am[2]}" not found in ${am[1]}`);
          }
        }
      }
      if (!Array.isArray(p.annexes) || p.annexes.some((x) => !["topology", "data-accuracy"].includes(x)))
        errors.push(`manifest: ${id}: annexes must be a list within topology/data-accuracy`);
      if (p.support === "gated") {
        if (!p.gate || typeof p.gate !== "object" || !p.gate.reason || !p.gate.release)
          errors.push(`manifest: ${id}: gated typepacks require gate: { reason, release } so the registration stays auditable`);
      } else if (p.gate !== null) errors.push(`manifest: ${id}: gate must be null unless support is gated`);
      if (!(p.legacy_section === null || typeof p.legacy_section === "string"))
        errors.push(`manifest: ${id}: legacy_section must be null or the archetypes.md heading it replaces`);
      // ---- the fit contract: the formula variables live here (the SSoT) rather than in document
      // prose, and feasibility is **recomputed against the live PageFrame contentBox** rather than
      // taken from the declared value.
      const posInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
      let computeFit = null;
      const fit = p.fit;
      if (!fit || typeof fit !== "object") errors.push(`manifest: ${id}: fit block is required (cardinality/params/footprint/feasibility)`);
      else {
        for (const k of Object.keys(fit)) if (!["cardinality", "params", "footprint", "feasibility", "floor_basis"].includes(k))
          errors.push(`manifest: ${id}: fit unknown field "${k}"`);
        // floor_basis: whether this number is a geometric assumption (geometry) or a value
        // confirmed by an actual render (rendered). For Wave 1 geometry is the honest default, and
        // promotion to rendered comes only after the CP2B stress render.
        if (!["geometry", "rendered"].includes(fit.floor_basis))
          errors.push(`manifest: ${id}: fit.floor_basis must be geometry|rendered (geometry = not yet confirmed by an actual render)`);
        else if (fit.floor_basis === "rendered")
          // rendered is a claim that requires evidence. Until CP2B brings floor_evidence (preset,
          // locale, stress fixture locator plus digest) in atomically, it cannot be promoted by
          // self-declaration, so it is refused.
          errors.push(`manifest: ${id}: fit.floor_basis "rendered" requires the CP2B floor_evidence contract (preset/locale stress fixtures with digests) — it cannot be self-declared`);
        const card = fit.cardinality ?? {};
        // derivePanelFloor owns the floor formula (the renderer calls the same function).
        {
          const f = derivePanelFloor(fit.params ?? {});
          if (f.declared && f.missing?.length) errors.push(`manifest: ${id}: derived floor needs ${f.missing.join(", ")}`);
          else if (f.declared && Number(fit.params.itemMinH) !== f.value)
            errors.push(`manifest: ${id}: itemMinH ${fit.params.itemMinH} != derived floor ${f.value} (${f.formula})`);
        }
        for (const k of ["min", "canonical", "max"]) if (!posInt(card[k])) errors.push(`manifest: ${id}: fit.cardinality.${k} must be a positive integer (got ${card[k]})`);
        if (Number(card.min) > Number(card.canonical) || Number(card.canonical) > Number(card.max))
          errors.push(`manifest: ${id}: fit.cardinality must satisfy min <= canonical <= max`);
        const prm = fit.params ?? {};
        for (const [k, v] of Object.entries(prm)) {
          const n = Number(v);
          if (!Number.isFinite(n)) { errors.push(`manifest: ${id}: fit.params.${k} must be a number (got ${v})`); continue; }
          // Minimum sizes and insets must be positive and gaps and margins cannot be negative —
          // blocking the path where a negative gap manufactures a false fit.
          if (/(ItemMinW|ItemMinH|inset|itemMinW|itemMinH|nodeMinW|nodeMinH)$/.test(k) && !(n > 0))
            errors.push(`manifest: ${id}: fit.params.${k} must be positive (got ${n})`);
          else if (n < 0) errors.push(`manifest: ${id}: fit.params.${k} must be >= 0 (got ${n})`);
        }
        const need = (n) => { if (!Number.isFinite(Number(prm[n]))) { errors.push(`manifest: ${id}: fit.params.${n} is required by the declared layouts`); return NaN; } return Number(prm[n]); };
        const compute = computeFit = (fp) => {
          const n = Number(fp.count), ex = { w: Number(fp.extraW ?? 0), h: Number(fp.extraH ?? 0) };
          // The floor name selects among different content floors — base, compact, wide and so on
          const fl = fp.floor && fp.floor !== "base" ? fp.floor : null;
          const iw = fl ? need(`${fl}ItemMinW`) : need("itemMinW");
          const ih = fl ? need(`${fl}ItemMinH`) : need("itemMinH");
          const gx = Number(prm.gapX ?? prm.gap ?? 0), gy = Number(prm.gapY ?? prm.gap ?? 0);
          if (fp.layout === "zones") {
            // Hierarchical: the bounding box satisfying both the widest zone (a node row) and the
            // deepest stack (the zone count) at once — every legal configuration fits inside it.
            const npz = need("maxNodesPerZone"), pad = need("zonePad"), band = need("zoneLabelBand"), zgap = need("zoneGap");
            return { w: npz * iw + (npz - 1) * gx + 2 * pad + ex.w,
                     h: n * (band + ih + 2 * pad) + (n - 1) * zgap + ex.h };
          }
          if (fp.layout === "row") return { w: n * iw + (n - 1) * gx + Number(ex.w ?? 0), h: ih + Number(ex.h ?? 0) };
          if (fp.layout === "column") return { w: iw + Number(ex.w ?? 0), h: n * ih + (n - 1) * gy + Number(ex.h ?? 0) };
          if (fp.layout === "grid") {
            const cols = Number(fp.cols), rows = Math.ceil(n / cols);
            return { w: cols * iw + (cols - 1) * gx + Number(ex.w ?? 0), h: rows * ih + (rows - 1) * gy + Number(ex.h ?? 0) };
          }
          if (fp.layout === "concentric") {
            const inset = need("inset");
            return { w: iw + 2 * (n - 1) * inset + Number(ex.w ?? 0), h: ih + 2 * (n - 1) * inset + Number(ex.h ?? 0) };
          }
          errors.push(`manifest: ${id}: fit footprint layout "${fp.layout}" is not one of row/column/grid/concentric/zones`);
          return null;
        };
        const byCount = new Map();
        for (const fp of fit.footprint ?? []) {
          for (const k of Object.keys(fp)) if (!["count", "layout", "cols", "floor", "extraW", "extraH", "w", "h"].includes(k)) errors.push(`manifest: ${id}: fit.footprint unknown field "${k}"`);
          if (!posInt(fp.count)) errors.push(`manifest: ${id}: fit.footprint count must be a positive integer (got ${fp.count})`);
          if (fp.cols !== undefined && !posInt(fp.cols)) errors.push(`manifest: ${id}: fit.footprint cols must be a positive integer`);
          for (const k of ["extraW", "extraH"]) if (fp[k] !== undefined && !(Number(fp[k]) >= 0)) errors.push(`manifest: ${id}: fit.footprint ${k} must be >= 0`);
          if (!(Number(fp.w) > 0) || !(Number(fp.h) > 0)) errors.push(`manifest: ${id}: fit.footprint w/h must be positive`);
          const got = compute(fp);
          if (!got) continue;
          if (Math.round(got.w) !== Number(fp.w) || Math.round(got.h) !== Number(fp.h))
            errors.push(`manifest: ${id}: fit.footprint(count ${fp.count}, ${fp.layout}) declares ${fp.w}×${fp.h} but the params compute ${Math.round(got.w)}×${Math.round(got.h)}`);
          byCount.set(`${fp.count}:${fp.layout}:${fp.floor ?? "base"}`, { ...fp, ...got });
        }
        if (!(fit.footprint ?? []).some((fp) => Number(fp.count) === Number(card.max)))
          errors.push(`manifest: ${id}: fit.footprint must cover the maximum cardinality (${card.max})`);
        // feasibility: the declared outcome is recomputed against the live contentBox and compared (never re-copy constants from the docs)
        const seen = new Set(), seenTuple = new Set();
        for (const fs of fit.feasibility ?? []) {
          for (const k of Object.keys(fs)) if (!["preset", "orientation", "count", "layout", "floor", "result"].includes(k)) errors.push(`manifest: ${id}: fit.feasibility unknown field "${k}"`);
          if (!["fits", "needs-split"].includes(fs.result)) errors.push(`manifest: ${id}: fit.feasibility result must be fits|needs-split`);
          if (Array.isArray(p.presets) && !p.presets.includes(fs.preset)) errors.push(`manifest: ${id}: fit.feasibility preset "${fs.preset}" is not declared by this typepack`);
          const tuple = `${fs.preset}:${fs.count}:${fs.layout}:${fs.floor ?? "base"}`;
          if (seenTuple.has(tuple)) errors.push(`manifest: ${id}: duplicate fit.feasibility entry (${tuple})`);
          seenTuple.add(tuple);
          seen.add(`${fs.preset}:${fs.count}`);
          const fp = byCount.get(`${fs.count}:${fs.layout}:${fs.floor ?? "base"}`);
          if (!fp) { errors.push(`manifest: ${id}: fit.feasibility(count ${fs.count}, ${fs.layout}, floor ${fs.floor ?? "base"}) has no matching footprint`); continue; }
          const pf = pageframeFor(fs.preset);
          if (!pf) { errors.push(`manifest: ${id}: cannot resolve PageFrame contentBox for "${fs.preset}"`); continue; }
          // orientation must agree both with the TypePack declaration and with **the preset's actual orientation**
          if (Array.isArray(p.orientations) && !p.orientations.includes(fs.orientation))
            errors.push(`manifest: ${id}: fit.feasibility orientation "${fs.orientation}" is not declared by this typepack`);
          if (pf.orientation !== fs.orientation)
            errors.push(`manifest: ${id}: fit.feasibility(${fs.preset}) declares orientation "${fs.orientation}" but the preset is "${pf.orientation}"`);
          const cb = pf.regions.contentBox;
          // On a fluid canvas height is not a constraint (the canvas follows the content) — only width is judged.
          const fits = fp.w <= cb.w && (pf.regions.fluid || fp.h <= cb.h);
          const want = fits ? "fits" : "needs-split";
          if (fs.result !== want)
            errors.push(`manifest: ${id}: fit.feasibility(${fs.preset}, count ${fs.count}) declares "${fs.result}" but ${Math.round(fp.w)}×${Math.round(fp.h)} against contentBox ${cb.w}×${cb.h} computes "${want}"`);
        }
        if (p.preferred_preset !== undefined) {
          if (!Array.isArray(p.presets) || !p.presets.includes(p.preferred_preset))
            errors.push(`manifest: ${id}: preferred_preset "${p.preferred_preset}" must be one of the declared presets`);
        }
        for (const pr of (Array.isArray(p.presets) ? p.presets : []))
          if (!seen.has(`${pr}:${card.max}`)) errors.push(`manifest: ${id}: fit.feasibility must cover preset "${pr}" at the maximum cardinality (${card.max})`);
      }
      // ---- the CP2A input contract (with R1 applied): one canonical plus a **list of stress
      // scenarios**. The SSoT for input is the structured payload, and stress is divided by risk
      // axis (covers).
      const inp = p.inputs;
      if (!inp || typeof inp !== "object") errors.push(`manifest: ${id}: inputs block is required (canonical + stress scenarios)`);
      else {
        for (const k of Object.keys(inp)) if (!["canonical", "stress"].includes(k)) errors.push(`manifest: ${id}: inputs unknown case "${k}"`);
        const cases = [["canonical", inp.canonical]].concat((Array.isArray(inp.stress) ? inp.stress : []).map((x) => ["stress", x]));
        if (!Array.isArray(inp.stress) || !inp.stress.length) errors.push(`manifest: ${id}: inputs.stress must be a non-empty list of named scenarios`);
        const coversSeen = new Set();
        let maxCardScenario = null;
        for (const [cse, c] of cases) {
          if (!c || typeof c !== "object") { errors.push(`manifest: ${id}: inputs.${cse} is required`); continue; }
          const allowed = ["id", "path", "preset", "layout", "cols", "floor", "count", "residual_disposition", "routing_expected", "artifact_policy"].concat(cse === "stress" ? ["geometry_expected", "covers"] : []);
          for (const k of Object.keys(c)) if (!allowed.includes(k)) errors.push(`manifest: ${id}: inputs.${cse} unknown field "${k}"`);
          if (c.artifact_policy !== undefined && !["tracked", "transient"].includes(c.artifact_policy))
            errors.push(`manifest: ${id}: inputs.${cse} artifact_policy must be tracked|transient`);
          if (!c.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(c.id))) errors.push(`manifest: ${id}: inputs.${cse} id invalid`);
          else if (inputIds.has(c.id)) errors.push(`manifest: ${id}: duplicate input id "${c.id}"`);
          else inputIds.add(c.id);
          const ip = String(c.path ?? "");
          if (!/(^|\/)inputs\/[a-z0-9.-]+\.yaml$/.test(ip)) errors.push(`manifest: ${id}: inputs.${cse} path must live in an inputs/ directory inside the package`);
          const iabs = path.resolve(path.dirname(mPath), "..", ip);
          let idoc = null;
          try { ({ doc: idoc } = readYaml(iabs)); } catch { errors.push(`manifest: ${id}: inputs.${cse} file not found (${ip})`); }
          if (Array.isArray(p.presets) && !p.presets.includes(c.preset)) errors.push(`manifest: ${id}: inputs.${cse} preset "${c.preset}" is not declared`);
          if (!posInt(c.count)) errors.push(`manifest: ${id}: inputs.${cse} count must be a positive integer`);
          // Geometric judgement: compute the declared arrangement, compare it with the live
          // contentBox and match it against expected. It also applies whatever extra the same
          // configuration's footprint declared (axis labels and the like) — if the scenario
          // judgement and the footprint judgement used different numbers the two contracts would
          // diverge.
          const fpMatch = (Array.isArray(p.fit?.footprint) ? p.fit.footprint : []).find((f) =>
            Number(f.count) === Number(c.count) && f.layout === c.layout
            && String(f.cols ?? "") === String(c.cols ?? "") && String(f.floor ?? "base") === String(c.floor ?? "base"));
          const got = computeFit ? computeFit({ count: c.count, layout: c.layout, cols: c.cols, floor: c.floor,
            extraW: fpMatch?.extraW, extraH: fpMatch?.extraH }) : null;
          const pfi = pageframeFor(c.preset);
          let computed = null;
          if (got && pfi) {
            const cb = pfi.regions.contentBox;
            computed = (got.w <= cb.w && (pfi.regions.fluid || got.h <= cb.h)) ? "fits" : "needs-split";
          }
          if (cse === "canonical") {
            if (computed && computed !== "fits")
              errors.push(`manifest: ${id}: inputs.canonical computes ${Math.round(got.w)}×${Math.round(got.h)} → needs-split; the canonical input must be renderable`);
          } else {
            if (c.routing_expected !== undefined && !["routable", "needs-split"].includes(c.routing_expected))
              errors.push(`manifest: ${id}: "${c.id}" routing_expected must be routable|needs-split`);
            if (c.residual_disposition !== undefined) {
              const rd = c.residual_disposition;
              if (!rd || typeof rd !== "object" || !Number.isFinite(Number(rd.bottom)) || Number(rd.bottom) < 0 || typeof rd.reason !== "string" || rd.reason.trim().length < 12)
                errors.push(`manifest: ${id}: "${c.id}" residual_disposition must be { bottom: <px >= 0>, reason: "<why this page does not fill>" }`);
            }
            if (!["fits", "needs-split"].includes(c.geometry_expected)) errors.push(`manifest: ${id}: stress "${c.id}" geometry_expected must be fits|needs-split`);
            else if (computed && computed !== c.geometry_expected)
              errors.push(`manifest: ${id}: stress "${c.id}" declares geometry_expected "${c.geometry_expected}" but computes "${computed}" against ${c.preset} (geometry only — actual render fit is CP2B)`);
            const cov = Array.isArray(c.covers) ? c.covers : [];
            if (!cov.length) errors.push(`manifest: ${id}: stress "${c.id}" must declare the risk axes it covers`);
            for (const v of cov) {
              if (!COVERS_VOCAB.includes(v)) errors.push(`manifest: ${id}: stress "${c.id}" covers "${v}" is not in the vocabulary (${COVERS_VOCAB.join("/")})`);
              coversSeen.add(v);
            }
            if (cov.includes("cardinality-max")) {
              maxCardScenario = c;
              if (Number(c.count) !== Number(fit?.cardinality?.max))
                errors.push(`manifest: ${id}: stress "${c.id}" covers cardinality-max but count ${c.count} != fit.cardinality.max (${fit?.cardinality?.max})`);
            }
          }
          // input file integrity plus structured-payload validation
          if (idoc) {
            if (Number(idoc.schema_version) !== 1 || idoc.kind !== "typepack-input")
              errors.push(`manifest: ${id}: inputs.${cse} file identity invalid (schema_version 1 + kind typepack-input)`);
            if (idoc.typepack !== id) errors.push(`manifest: ${id}: inputs.${cse} file declares typepack "${idoc.typepack}"`);
            // A file's case is bound to the scenario id — one file cannot serve several scenarios
            const wantCase = cse === "canonical" ? "canonical" : String(c.id).slice(String(id).length + 1);
            if (idoc.case !== wantCase) errors.push(`manifest: ${id}: input file case "${idoc.case}" != scenario "${wantCase}"`);
            for (const k of ["preset", "layout", "count"])
              if (String(idoc[k]) !== String(c[k])) errors.push(`manifest: ${id}: inputs.${cse} file ${k} "${idoc[k]}" != manifest "${c[k]}"`);
            for (const loc of ["ko", "en"]) if (!idoc[`prompt_${loc}`]) errors.push(`manifest: ${id}: inputs.${cse} prompt_${loc} is required (explaining the intent)`);
            const obsExtra = validateInputPayload(idoc, id, c.count, (m) => errors.push(`manifest: ${id}: inputs.${cse} payload — ${m}`));
            if (idoc.purpose === "full-primitive-specimen" && c.artifact_policy !== "transient")
              errors.push(`manifest: ${id}: full-primitive-specimen must declare artifact_policy: transient (it is acceptance evidence, not a gallery artifact)`);
            if (cse === "stress") {
              // covers must be observed in the payload, not taken from a declared label — blocking false coverage
              const obs = observedCoverage(idoc, id, c.count, fit?.cardinality?.max, c.geometry_expected, obsExtra);
              const decl = new Set(Array.isArray(c.covers) ? c.covers : []);
              for (const v of decl)
                if (!obs.has(v)) errors.push(`manifest: ${id}: stress "${c.id}" declares covers "${v}" but the payload does not exhibit it (observed: ${[...obs].join(", ") || "none"})`);
              // being an audit view it works both ways — an observed audited axis missing from the declaration is an error
              for (const v of obs)
                if (AUDITABLE_COVERS.includes(v) && !decl.has(v))
                  errors.push(`manifest: ${id}: stress "${c.id}" payload exhibits "${v}" but it is not declared in covers (declared coverage must equal observed auditable coverage)`);
            }
          }
        }
        if (!maxCardScenario) errors.push(`manifest: ${id}: at least one stress scenario must cover "cardinality-max"`);
        // The canonical input takes the representative cardinality fit declared as its reference point
        if (inp.canonical && Number(inp.canonical.count) !== Number(fit?.cardinality?.canonical))
          errors.push(`manifest: ${id}: inputs.canonical count ${inp.canonical.count} != fit.cardinality.canonical (${fit?.cardinality?.canonical})`);
        // If feasibility contains a needs-split tuple there must also be an input exercising the degrade path
        const hasNeedsSplit = (fit?.feasibility ?? []).some((f) => f.result === "needs-split");
        const hasDegradeInput = (Array.isArray(inp.stress) ? inp.stress : []).some((x) => x.geometry_expected === "needs-split");
        if (hasNeedsSplit && !hasDegradeInput)
          errors.push(`manifest: ${id}: fit.feasibility declares a needs-split tuple, so at least one stress input must exercise the degrade path (geometry_expected: needs-split)`);
        // The copy-boundary candidate is required only of TypePacks that have a payload schema (the real catalogue).
        if (INPUT_SCHEMA[id] && !coversSeen.has("copy-boundary-candidate"))
          errors.push(`manifest: ${id}: at least one stress scenario must cover "copy-boundary-candidate" (a KO/EN boundary-copy candidate — the real line fit is settled by CP2B)`);
      }
      // migration origin: a Wave 1 type migrated from an existing archetype must name its legacy section
      if (!["legacy", "new"].includes(p.migration_origin)) errors.push(`manifest: ${id}: migration_origin must be legacy|new`);
      else if (p.migration_origin === "legacy" && !p.legacy_section)
        errors.push(`manifest: ${id}: migration_origin "legacy" requires legacy_section (the archetypes.md heading it replaces)`);
      else if (p.migration_origin === "new" && p.legacy_section !== null)
        errors.push(`manifest: ${id}: migration_origin "new" must not claim a legacy_section`);
      // A surface making a semantic claim (accuracy, topology) must have both a verifier and a
      // receipt schema locator. The topology annex passes the same gate — if the spec's "core comes
      // after the verifier" sentence and the validator disagreed, it would be wording rather than
      // a contract.
      const semanticBearing = p.profile === "exact-parametric" || (p.annexes ?? []).some((a2) => ["data-accuracy", "topology"].includes(a2));
      const accuracyBearing = semanticBearing;
      if (p.receipt_schema !== null && p.receipt_schema !== undefined) {
        const rp = path.resolve(path.dirname(mPath), "..", String(p.receipt_schema));
        if (!isUnder(rp, path.resolve(here, ".."))) errors.push(`manifest: ${id}: receipt_schema escapes the package`);
        else { try { readFileSync(rp); } catch { errors.push(`manifest: ${id}: receipt_schema not found (${p.receipt_schema})`); } }
      }
      if (accuracyBearing && p.support === "core") {
        if (!p.verifier) errors.push(`manifest: ${id}: a semantic-claim typepack (exact-parametric, data-accuracy or topology annex) requires a machine verifier before it may claim "core"`);
        if (!p.receipt_schema) errors.push(`manifest: ${id}: a semantic-claim typepack requires a receipt_schema locator before it may claim "core"`);
      }
      // Promotion evidence: core cannot be obtained by a string or by just any path
      if (p.support === "core") {
        const exs = Array.isArray(p.examples) ? p.examples : [];
        if (exs.length === 0) errors.push(`manifest: ${id}: support "core" requires at least one registered example (promotion evidence)`);
        for (const ex of exs) {
          // An example must resolve to a real gallery anchor — a non-existent id is not evidence
          const gm = /^([A-Za-z0-9._-]+\.md)#([a-z0-9][a-z0-9-]*)$/.exec(String(ex?.gallery_anchor ?? ""));
          if (!gm) { errors.push(`manifest: ${id}: example "${ex?.id}" cannot support "core" without a resolvable gallery_anchor`); continue; }
          const gp = path.resolve(path.dirname(mPath), "..", gm[1]);
          let text = null;
          try { text = readFileSync(gp, "utf8"); } catch { errors.push(`manifest: ${id}: example "${ex.id}" points at ${gm[1]}, which does not exist — "core" requires a real gallery entry`); }
          if (text !== null) {
            const slug = (t) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
            const heads = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((h) => slug(h[1]));
            if (!heads.includes(gm[2])) errors.push(`manifest: ${id}: example "${ex.id}" anchor "#${gm[2]}" is not in ${gm[1]}`);
          }
        }
        const fxs = Array.isArray(p.fixtures) ? p.fixtures : [];
        for (const pr of (Array.isArray(p.presets) ? p.presets : [])) {
          if (!fxs.some((f) => f?.kind === "positive" && f?.preset === pr))
            errors.push(`manifest: ${id}: support "core" requires a positive fixture for preset "${pr}"`);
        }
        if (!fxs.some((f) => f?.kind === "baseline-red"))
          errors.push(`manifest: ${id}: support "core" requires at least one baseline-red fixture`);
      }
      // composition capability block (schema v2, optional — absent => composable: false)
      if ("composition" in p) {
        const C = p.composition;
        const CK = ["composable", "min_slot_size", "preferred_slot_aspect", "allowed_slots", "variants", "ports", "rhythm"];
        for (const k of Object.keys(C)) if (!CK.includes(k)) errors.push(`manifest: ${id}: composition unknown field "${k}"`);
        if (typeof C.composable !== "boolean" && C.composable !== "true" && C.composable !== "false")
          errors.push(`manifest: ${id}: composition.composable must be boolean`);
        const sizeOk = (o) => o && Number.isFinite(Number(o.w)) && Number(o.w) > 0 && Number.isFinite(Number(o.h)) && Number(o.h) > 0;
        if (!sizeOk(C.min_slot_size)) errors.push(`manifest: ${id}: composition.min_slot_size must be positive {w, h} (logical px)`);
        const A = C.preferred_slot_aspect;
        if (!A || !Number.isFinite(Number(A.min)) || !Number.isFinite(Number(A.max)) || Number(A.min) <= 0 || Number(A.min) > Number(A.max))
          errors.push(`manifest: ${id}: composition.preferred_slot_aspect must be {min, max} with 0 < min <= max`);
        if ("allowed_slots" in C) {
          if (!Array.isArray(C.allowed_slots) || C.allowed_slots.length === 0 || C.allowed_slots.some((x) => !["top", "middle", "bottom", "side"].includes(x)))
            errors.push(`manifest: ${id}: composition.allowed_slots must be a non-empty list within top/middle/bottom/side`);
        }
        if ("variants" in C) {
          if (!Array.isArray(C.variants)) errors.push(`manifest: ${id}: composition.variants must be a list`);
          else {
            const vids = new Set();
            for (const v of C.variants) {
              if (!v.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(v.id))) errors.push(`manifest: ${id}: variant id invalid`);
              else if (vids.has(v.id)) errors.push(`manifest: ${id}: duplicate variant id "${v.id}"`);
              else vids.add(v.id);
              if (!sizeOk(v.min_slot_size)) errors.push(`manifest: ${id}: variant "${v.id}" min_slot_size must be positive {w, h}`);
            }
          }
        }
        if ("rhythm" in C) {
          // The TypePack-owned visual-rhythm band — the declaration forbidding a variant that
          // absorbs residual by stretching connectors (the pack sets the extension ceiling and
          // compose/verify enforce it)
          const RK2 = ["connector_run_band"];
          for (const k of Object.keys(C.rhythm ?? {})) if (!RK2.includes(k)) errors.push(`manifest: ${id}: composition.rhythm unknown field "${k}"`);
          const B = C.rhythm?.connector_run_band;
          if (!B || !Number.isFinite(Number(B.min)) || !Number.isFinite(Number(B.max)) || Number(B.min) <= 0 || Number(B.min) > Number(B.max))
            errors.push(`manifest: ${id}: composition.rhythm.connector_run_band must be {min, max} with 0 < min <= max`);
        }
        if ("ports" in C) {
          if (!Array.isArray(C.ports)) errors.push(`manifest: ${id}: composition.ports must be a list`);
          else for (const pt of C.ports) {
            if (!pt.template || !/^[a-z0-9][a-z0-9-]*$/.test(String(pt.template))) errors.push(`manifest: ${id}: port template id invalid`);
            if (!["out", "in", "bidir"].includes(pt.direction)) errors.push(`manifest: ${id}: port "${pt.template}" direction must be out|in|bidir`);
            if (!["flow", "reference"].includes(pt.kind)) errors.push(`manifest: ${id}: port "${pt.template}" kind must be flow|reference`);
            if (!/^\d+(\.\.(\d+|n))?$|^0\.\.n$/.test(String(pt.cardinality ?? ""))) errors.push(`manifest: ${id}: port "${pt.template}" cardinality must be "n", "n..m" or "0..n"`);
          }
        }
      }
    }
    // ---- registration closure: the manifest owns the registration invariants completely ----
    // The inventory and legacy closures apply only to **the package's canonical registry**. An
    // arbitrary YAML passed in for schema validation (a negative fixture, say) is not a subject.
    const canonicalManifest = path.resolve(here, "..", "references", "types", "manifest.yaml");
    const isCanonical = path.resolve(mPath) === canonicalManifest;
    const specsDir = path.resolve(path.dirname(mPath), "specs");
    const REQUIRED_SECTIONS = [
      "1. Identity and selection", "2. Input schema and budget",
      "3. Semantic model and invariants", "4. Intrinsic fit and variant contract",
      "5. Layout, encoding and connector rules", "6. Degrade ladder",
      "7. Verifier, receipt and fixture contract",
      "8. Reading order, accessibility and locale",
      "9. Anti-patterns and known failures",
    ];
    const ANNEX_SECTIONS = { topology: "A1. Topology contract", "data-accuracy": "A2. Data accuracy contract" };
    const ANNEX_SUBSECTIONS = {
      topology: ["Entity identity", "Edge kind and direction", "Cardinality", "Cycle policy",
                 "Traversal and reading order", "Topology verifier and receipt boundary"],
      "data-accuracy": ["Source data and input digest", "Scale and domain", "Visual encoding",
                        "Rounding and tolerance", "Verifier", "Accuracy receipt schema"],
    };
    const specSeen = new Map(), anchorSeen = new Map(), legacySeen = new Map();
    for (const p of packs || []) {
      const id = p.id;
      // spec path uniqueness — two TypePacks cannot point at the same spec
      if (p.spec) {
        if (specSeen.has(p.spec)) errors.push(`manifest: ${id}: spec "${p.spec}" is already claimed by "${specSeen.get(p.spec)}" (spec paths are 1:1)`);
        else specSeen.set(p.spec, id);
      }
      const anchor = p.canonical_prompt?.anchor;
      if (anchor) {
        if (anchorSeen.has(anchor)) errors.push(`manifest: ${id}: duplicate canonical_prompt anchor "${anchor}" (also "${anchorSeen.get(anchor)}")`);
        else anchorSeen.set(anchor, id);
      }
      if (p.legacy_section) {
        if (legacySeen.has(p.legacy_section)) errors.push(`manifest: ${id}: legacy_section "${p.legacy_section}" is already claimed by "${legacySeen.get(p.legacy_section)}"`);
        else legacySeen.set(p.legacy_section, id);
      }
      // spec identity plus completeness of the required sections
      if (!p.spec) continue;
      let text = null;
      try { text = readFileSync(path.resolve(path.dirname(mPath), "..", String(p.spec)), "utf8"); } catch { continue; }
      const fm = /^---\n([\s\S]*?)\n---/.exec(text);
      if (!fm) { errors.push(`manifest: ${id}: spec is missing its identity frontmatter (spec_schema_version/typepack_id/profile)`); continue; }
      const meta = Object.fromEntries([...fm[1].matchAll(/^([a-z_]+):\s*(.+)$/gm)].map((m) => [m[1], m[2].trim()]));
      if (Number(meta.spec_schema_version) !== 1) errors.push(`manifest: ${id}: spec_schema_version must be 1 (got ${meta.spec_schema_version})`);
      if (meta.typepack_id !== id) errors.push(`manifest: ${id}: spec declares typepack_id "${meta.typepack_id}" — spec and manifest identity must match`);
      if (meta.profile !== p.profile) errors.push(`manifest: ${id}: spec declares profile "${meta.profile}" but the manifest says "${p.profile}"`);
      // A heading existing is not a contract — each section must have real body text, and an annex
      // must carry its required subsections too (adding one heading line does not satisfy it).
      const sectionBody = (level, title) => {
        const re = new RegExp(`^#{${level}}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
        const m = re.exec(text);
        if (!m) return null;
        const rest = text.slice(m.index + m[0].length);
        const nxt = new RegExp(`^#{1,${level}}\\s`, "m").exec(rest);
        return (nxt ? rest.slice(0, nxt.index) : rest).replace(/\s/g, "");
      };
      const MIN_BODY = 16;
      const heads = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
      for (const want of REQUIRED_SECTIONS) {
        if (!heads.includes(want)) { errors.push(`manifest: ${id}: spec is missing required section "${want}"`); continue; }
        const body = sectionBody(2, want);
        if ((body?.length ?? 0) < MIN_BODY) errors.push(`manifest: ${id}: spec section "${want}" has no substantive body`);
      }
      for (const ax of p.annexes ?? []) {
        const title = ANNEX_SECTIONS[ax];
        if (!heads.includes(title)) { errors.push(`manifest: ${id}: spec declares the ${ax} annex but has no "${title}" section`); continue; }
        for (const sub of ANNEX_SUBSECTIONS[ax]) {
          const body = sectionBody(3, sub);
          if (body === null) { errors.push(`manifest: ${id}: ${ax} annex is missing "### ${sub}"`); continue; }
          if (body.length < MIN_BODY) errors.push(`manifest: ${id}: ${ax} annex subsection "${sub}" has no substantive body`);
        }
      }
    }
    // inventory closure: the specs tree and the manifest are exactly 1:1 (no orphan spec)
    if (isCanonical) {
      let specFiles = [];
      try { specFiles = readdirSync(specsDir).filter((f) => f.endsWith(".md")).sort(); } catch { errors.push("manifest: types/specs directory is missing"); }
      const declared = new Set([...specSeen.keys()].map((sp) => path.basename(String(sp))));
      for (const f of specFiles) if (!declared.has(f)) errors.push(`manifest: orphan spec "types/specs/${f}" is not registered by any typepack`);
    }
    // No dual legacy norm: the archetype section of a registered TypePack must be a pointer tombstone
    if (isCanonical && legacySeen.size) {
      let arch = null;
      try { arch = readFileSync(path.resolve(path.dirname(mPath), "..", "archetypes.md"), "utf8"); } catch { errors.push("manifest: archetypes.md not readable for legacy closure"); }
      if (arch !== null) {
        const secs = arch.split(/^## /m).slice(1).map((b) => ({ title: b.split("\n")[0].trim(), body: b }));
        // A tombstone must match the **deterministic canonical body** exactly, not merely contain a
        // keyword. This blocks the bypass of appending extra rule sentences.
        for (const [title, id] of legacySeen) {
          const sec = secs.find((x) => x.title === title);
          if (!sec) { errors.push(`manifest: ${id}: legacy_section "${title}" not found in archetypes.md`); continue; }
          const want = canonicalTombstone(title, id).trim();
          if (sec.body.replace(/^/, "## ").trim() !== want)
            errors.push(`manifest: ${id}: archetypes.md "${title}" is not the canonical tombstone — it must contain only the TypePack pointer (no extra rules); regenerate it exactly as:\n${want}`);
        }
        // No ownerless tombstone: setting legacy_section back to null cannot slip past the check
        for (const sec of secs) {
          if (!/Migrated to TypePack/.test(sec.body)) continue;
          if (!legacySeen.has(sec.title))
            errors.push(`manifest: archetypes.md "${sec.title}" is a tombstone but no typepack claims it via legacy_section — an unclaimed tombstone means the migration record was dropped`);
        }
      }
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
      kernelVersion: "kernel-v1",
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
  if (cmd !== "registry" && cmd !== "icons" && cmd !== "delivery") {
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

  if (cmd === "icons") {
    const receipt = { schemaVersion: 1, command: "icons", count: ICON_IDS.length,
      ids: ICON_IDS, icons: ICON_IDS.map((id) => ({ id, viewBox: "0 0 24 24", path: ICON_PATHS[id] })),
      errors: [], warnings: [] };
    if (opts["--json"]) console.log(JSON.stringify(receipt, null, 1));
    else process.stdout.write(ICON_IDS.join("\n") + "\n");
    process.exit(0);
  }

  if (cmd === "delivery") {
    rest = restAll;
    const errors = [];
    const typo = loadTypography(errors);
    const del = loadDelivery(errors, typo?.doc ?? null);
    if (errors.length) { for (const e of errors) console.error(`  ERROR ${e}`); process.exit(1); }
    const out = { schemaVersion: 1, command: "delivery", profile: { id: del.doc.id, digest: del.digest },
      typographyProfileDigest: typo.digest, defaultMode: del.doc.default_mode,
      modes: Object.fromEntries(Object.entries(del.doc.modes).map(([k, m]) => [k, { grade: m.grade, embed: m.embed, editable: m.editable }])) };
    if (rest.includes("--json")) console.log(JSON.stringify(out, null, 1));
    else console.log(`delivery — default ${out.defaultMode}; ` + Object.entries(out.modes).map(([k, m]) => `${k}: ${m.grade}/${m.embed}`).join(", "));
    process.exit(0);
  }
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
    provenance: { kernel: "kernel-v1", palette: ctx.prof.id, extension_point: null },
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
  // Typography is an independent axis, but it rides along in the resolve receipt so a consumer gets it in one go
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
// (silent-pass hardening applies to all scripts).
try {
  const argvReal = realpathSync(process.argv[1]);
  const selfReal = realpathSync(fileURLToPath(import.meta.url));
  if (argvReal === selfReal) main();
} catch { main(); }
