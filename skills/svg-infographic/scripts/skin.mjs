#!/usr/bin/env node
// skin.mjs — single resolver for svg-infographic skin profiles (Node 18+, stdlib only).
//
//   node scripts/skin.mjs validate <profile.yaml>
//   node scripts/skin.mjs resolve  <profile.yaml> [--mode light|dark] [--treatment flat|sketch] [--json]
//
// The resolver is the only component that interprets profile inheritance, alias
// mapping and derivation ratios (references/skins/derivation-v1.yaml). It emits a
// validation receipt: profile identity, digests, resolved tokens, contrast matrix.
// Exit codes: 0 ok · 1 validation failure · 2 usage/internal.
//
// This is deliberately NOT a theme engine: single resolver, versioned profiles,
// one shallow `extends`, bounded overrides. No DSL, plugins or runtime editing.

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- minimal YAML subset parser (2-level maps, scalars, comments) -------------
function parseYaml(text, file) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const noComment = raw.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim()) continue;
    const indent = noComment.match(/^ */)[0].length;
    const m = noComment.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) throw new Error(`${file}:${i + 1} unsupported YAML line: ${raw.trim()}`);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const [, key, valRaw] = m;
    if (valRaw === "") {
      const obj = {};
      parent[key] = obj;
      stack.push({ indent, obj });
    } else {
      let v = valRaw.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v === "null") v = null;
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      parent[key] = v;
    }
  }
  return root;
}

// --- color math ---------------------------------------------------------------
const hexRe = /^#[0-9A-Fa-f]{6}$/;
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
  if (mx === mn) return null; // neutral
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
const GATES = [ // [fg, bg, min, kind]
  ["ink", "canvas", 7.0, "text"], ["ink", "surface", 7.0, "text"],
  ["ink", "surface-tint", 4.5, "text"],
  ["muted", "canvas", 4.5, "text"], ["muted", "surface", 4.5, "text"],
  ["on-focus", "focus", 4.5, "text"],
  ["positive", "surface", 3.0, "icon-line"], ["warning", "surface", 3.0, "icon-line"],
  ["danger", "surface", 3.0, "icon-line"],
];
const STATUS_MIN_HUE_GAP = 30; // paired with lightness/shape/label discrimination

const here = path.dirname(fileURLToPath(import.meta.url));
const skinsDir = path.resolve(here, "..", "references", "skins");
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

function loadProfile(p) {
  const text = readFileSync(p, "utf8");
  let prof = parseYaml(text, p);
  const digestChain = [{ id: prof.id ?? path.basename(p), digest: sha(text) }];
  if (prof.extends) { // single shallow extends only
    const basePath = path.join(skinsDir, `${prof.extends}.yaml`);
    const baseText = readFileSync(basePath, "utf8");
    const base = parseYaml(baseText, basePath);
    if (base.extends) throw new Error(`extends chain too deep: ${prof.extends} extends ${base.extends} (only one shallow extends is allowed)`);
    digestChain.unshift({ id: base.id, digest: sha(baseText) });
    for (const mode of MODES) prof[mode] = { ...(base[mode] || {}), ...(prof[mode] || {}) };
    for (const k of ["kind", "schema_version"]) prof[k] = prof[k] ?? base[k];
  }
  return { prof, digestChain };
}

function validatePalette(prof) {
  const errors = [], warnings = [];
  if (prof.schema_version !== 1) errors.push(`schema_version must be 1 (got ${prof.schema_version})`);
  if (!prof.id) errors.push("missing id");
  if (prof.kind !== "palette") errors.push(`kind must be "palette" (got ${prof.kind})`);
  if (!["candidate", "current", "frozen", "deprecated"].includes(prof.status)) errors.push(`invalid status: ${prof.status}`);
  for (const mode of MODES) {
    const t = prof[mode];
    if (!t) { errors.push(`missing ${mode} token map`); continue; }
    for (const r of ROLES) {
      if (!t[r]) errors.push(`${mode}: missing required role "${r}"`);
      else if (!hexRe.test(t[r])) errors.push(`${mode}.${r}: not a #RRGGBB hex (${t[r]})`);
    }
    for (const k of Object.keys(t)) if (!ROLES.includes(k)) errors.push(`${mode}: unknown role "${k}" (role add/remove is a kernel migration, not a profile edit)`);
    if (errors.length) continue;
    for (const [fg, bg, min, kind] of GATES) {
      const v = contrast(t[fg], t[bg]);
      if (v < min) errors.push(`${mode}: contrast ${fg}/${bg} = ${v} < ${min} (${kind})`);
    }
    const hues = ["positive", "warning", "danger"].map((k) => hueDeg(t[k]));
    if (hues.some((h) => h === null)) warnings.push(`${mode}: neutral status color — hue-gap check skipped`);
    else {
      const s = [...hues].sort((a, b) => a - b);
      const gaps = [s[1] - s[0], s[2] - s[1], 360 - (s[2] - s[0])];
      const minGap = Math.min(...gaps);
      if (minGap < STATUS_MIN_HUE_GAP) errors.push(`${mode}: status hue gap ${minGap.toFixed(0)}° < ${STATUS_MIN_HUE_GAP}°`);
    }
  }
  return { errors, warnings };
}

function loadDerivation() {
  const p = path.join(skinsDir, "derivation-v1.yaml");
  const text = readFileSync(p, "utf8");
  return { deriv: parseYaml(text, p), derivDigest: sha(text), derivPath: p };
}

function resolveTokens(prof, deriv, mode) {
  const t = prof[mode];
  const d = deriv.derive[mode];
  const W = "#FFFFFF", B = "#000000";
  const bgRef = mode === "light" ? W : t["canvas"];
  const inkRef = mode === "light" ? B : W;
  const secondary = mode === "light" ? deriv.secondary.light
    : mix(deriv.secondary.light, W, deriv.secondary["dark-lighten-toward-white"]);
  const lineFor = { focus: t.focus, positive: t.positive, muted: t.muted, secondary };
  const out = {};
  for (const r of ROLES) out[r] = t[r];
  const fillT = mode === "light" ? d["fill-mix-toward-white"] : d["fill-mix-toward-canvas"];
  const inkT = mode === "light" ? d["ink-mix-toward-black"] : d["ink-mix-toward-white"];
  for (const [alias, src] of Object.entries(deriv["alias-sources"])) {
    const line = lineFor[src] ?? t[src];
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

// --- CLI ----------------------------------------------------------------------
function main() {
  const [cmd, profileArg, ...rest] = process.argv.slice(2);
  if (!cmd || !profileArg) {
    console.error("usage: skin.mjs validate|resolve <profile.yaml> [--mode light|dark] [--treatment flat|sketch] [--json]");
    process.exit(2);
  }
  const profilePath = path.resolve(profileArg);
  const { prof, digestChain } = loadProfile(profilePath);
  const { errors, warnings } = validatePalette(prof);
  const { deriv, derivDigest } = loadDerivation();
  const receipt = {
    schemaVersion: 1,
    command: cmd,
    profile: { id: prof.id, kind: prof.kind, status: prof.status, digests: digestChain },
    derivation: { id: deriv.id, digest: derivDigest },
    errors, warnings,
    // provenance identity reserved for SVG <metadata> / sidecar / PNG iTXt alignment:
    provenance: { kernel: "wave0-cp2", palette: prof.id, extension_point: null },
  };
  if (cmd === "validate") {
    if (!errors.length) {
      receipt.contrast = {};
      for (const mode of MODES) {
        receipt.contrast[mode] = GATES.map(([fg, bg, min]) => ({ pair: `${fg}/${bg}`, value: contrast(prof[mode][fg], prof[mode][bg]), min }));
      }
    }
    const asJson = rest.includes("--json");
    if (asJson) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`profile ${prof.id} [${prof.status}] — ${errors.length} error(s), ${warnings.length} warning(s)`);
      for (const e of errors) console.log(`  ERROR ${e}`);
      for (const w of warnings) console.log(`  warn  ${w}`);
      if (!errors.length) for (const mode of MODES) {
        console.log(`  ${mode}: ` + receipt.contrast[mode].map((c) => `${c.pair}=${c.value}`).join(" "));
      }
    }
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === "resolve") {
    if (errors.length) {
      console.error(errors.map((e) => `ERROR ${e}`).join("\n"));
      process.exit(1);
    }
    const mode = rest.includes("--mode") ? rest[rest.indexOf("--mode") + 1] : "light";
    const treatment = rest.includes("--treatment") ? rest[rest.indexOf("--treatment") + 1] : "flat";
    if (!MODES.includes(mode)) { console.error(`invalid --mode ${mode}`); process.exit(2); }
    if (!["flat", "sketch"].includes(treatment)) { console.error(`invalid --treatment ${treatment}`); process.exit(2); }
    const tokens = resolveTokens(prof, deriv, mode);
    if (treatment === "sketch") {
      const op = path.join(skinsDir, "sketch-overlay-v1.yaml");
      const otext = readFileSync(op, "utf8");
      const overlay = parseYaml(otext, op);
      Object.assign(tokens, { paper: overlay.tokens.paper, "sketch-ink": overlay.tokens["sketch-ink"], highlight: overlay.tokens.highlight });
      receipt.overlay = { id: overlay.id, digest: sha(otext) };
    }
    receipt.mode = mode;
    receipt.treatment = treatment;
    receipt.tokens = tokens;
    receipt.resolvedDigest = sha(JSON.stringify(tokens));
    if (rest.includes("--json")) console.log(JSON.stringify(receipt, null, 1));
    else {
      console.log(`resolved ${prof.id} + ${mode} + ${treatment} — digest ${receipt.resolvedDigest}`);
      for (const [k, v] of Object.entries(tokens)) console.log(`  --${k}: ${v}`);
    }
    process.exit(0);
  }
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}

// entrypoint guard: run main() based on real paths so symlinked installs still execute
// (silent-pass hardening is completed for all scripts in CP3).
try {
  const argvReal = realpathSync(process.argv[1]);
  const selfReal = realpathSync(fileURLToPath(import.meta.url));
  if (argvReal === selfReal) main();
} catch { main(); }
