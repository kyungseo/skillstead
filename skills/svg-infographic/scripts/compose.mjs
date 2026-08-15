#!/usr/bin/env node
// compose.mjs — composition contract tooling (the design-kernel composition contract).
//
// Three schemas, three commands (separate lifetimes and owners — never mixed):
//   plan    <plan.yaml>                 verify a Composition Plan v1 (the scene authoring document)
//   compose <plan.yaml> --fragments <dir> --out <svg> [--receipt <json>]
//                                       translation-only placement + namespace rewrite +
//                                       producing a Composition Receipt v1 (needs-split is
//                                       exit 3 non-success)
//   verify  <composite.svg> --receipt <json> --plan <plan.yaml>
//                                       re-measure the final SVG and compare it with the
//                                       receipt — a value the receipt invented from the
//                                       source alone fails
//
// Boundaries (the CP1 provable subset):
//   - layout_template: fixed to vertical-stack (slot-a=top, slot-b=bottom)
//   - transforms: translation-only, scale=1 — scale/rotate/skew are refused
//   - bounded composition: exactly 1 primary plus 1..2 supporting; nesting is refused
//   - a semantic binding is a line-free correspondence (number or label); only connector_edge does port routing
//   - identity: skin/typography/pageFrame/kernel/iconSet are checked identical across instances
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preflight, guardPackagePath } from "./preflight-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skinCli = path.join(here, "skin.mjs");
const sha16 = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

// ---------- minimal YAML (the same subset as skin.mjs: nested maps, lists, inline map/array) ----------
function parseInlineMap(v, file, line) {
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
      if (km && !rest.startsWith("{")) {
        const item = {};
        parent.holder[parent.key].push(item);
        stack.push({ indent: indent + 1, obj: item, holder: null, key: null });
        let v = km[2].trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        else if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
        else if (v.startsWith("{") && v.endsWith("}")) v = parseInlineMap(v, file, i);
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
    if (valRaw === "") {
      const obj = {};
      parent.obj[key] = obj;
      stack.push({ indent, obj, holder: parent.obj, key });
    } else {
      let v = valRaw.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v === "null") v = null;
      else if (v === "[]") v = [];
      else if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x);
      else if (v.startsWith("{") && v.endsWith("}")) v = parseInlineMap(v, file, i);
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      parent.obj[key] = v;
    }
  }
  return root;
}
const readYamlFile = (p) => {
  const buf = readFileSync(p);
  return { doc: parseYaml(buf.toString("utf8"), path.basename(p)), digest: sha16(buf) };
};

// ---------- shared: manifest capability lookup ----------
function loadManifest(mPath, errors) {
  let doc;
  try { ({ doc } = readYamlFile(mPath)); } catch (e) { errors.push(`plan: manifest unreadable: ${e.message}`); return null; }
  const r = spawnSync(process.execPath, [skinCli, "manifest", mPath], { encoding: "utf8" });
  if (r.status !== 0) { errors.push(`plan: manifest validation failed:\n${r.stdout}`); return null; }
  const byId = {};
  for (const p of doc.typepacks ?? []) byId[p.id] = p;
  return byId;
}

const TEMPLATES = {
  "vertical-stack": { slots: { "slot-a": "top", "slot-b": "bottom" } },
};

// ---------- Composition Plan v1 validation ----------
export function validatePlan(planPath, manifestPath) {
  const errors = [];
  let plan, planDigest;
  try { ({ doc: plan, digest: planDigest } = readYamlFile(planPath)); }
  catch (e) { return { errors: [`plan: unreadable: ${e.message}`] }; }
  const PK = ["schema_version", "kind", "id", "page", "layout_template", "slots", "slot_gap",
    "header", "instances", "semantic_bindings", "binding_complete_over", "connector_edges", "reading_order", "traversal", "residual_disposition"];
  for (const k of Object.keys(plan)) if (!PK.includes(k)) errors.push(`plan: unknown field "${k}"`);
  if (plan.schema_version !== 1) errors.push(`plan: schema_version must be 1 (got ${plan.schema_version})`);
  if (plan.kind !== "composition-plan") errors.push(`plan: kind must be "composition-plan"`);
  const tmpl = TEMPLATES[plan.layout_template];
  if (!tmpl) errors.push(`plan: layout_template must be one of ${Object.keys(TEMPLATES).join("/")} (got "${plan.layout_template}")`);
  const packs = manifestPath ? loadManifest(manifestPath, errors) : null;

  const instances = plan.instances ?? [];
  const ids = new Set(), slotsUsed = new Set();
  let primary = 0, supporting = 0;
  for (const inst of instances) {
    const IK = ["instance_id", "typepack", "module_role", "slot_id", "variant"];
    for (const k of Object.keys(inst)) if (!IK.includes(k)) errors.push(`plan: instance unknown field "${k}"`);
    if (!inst.instance_id || !/^[a-z0-9][a-z0-9-]*$/.test(inst.instance_id)) errors.push(`plan: invalid instance_id "${inst.instance_id}"`);
    else if (ids.has(inst.instance_id)) errors.push(`plan: duplicate instance_id "${inst.instance_id}"`);
    else ids.add(inst.instance_id);
    if (inst.module_role === "primary") primary++;
    else if (inst.module_role === "supporting") supporting++;
    else errors.push(`plan: instance "${inst.instance_id}" module_role must be primary|supporting`);
    if (!plan.slots?.[inst.slot_id]) errors.push(`plan: instance "${inst.instance_id}" binds unknown slot "${inst.slot_id}"`);
    else if (slotsUsed.has(inst.slot_id)) errors.push(`plan: slot "${inst.slot_id}" bound more than once`);
    else slotsUsed.add(inst.slot_id);
    if (packs) {
      const tp = packs[inst.typepack];
      if (!tp) errors.push(`plan: instance "${inst.instance_id}" references unknown typepack "${inst.typepack}"`);
      else {
        const comp = tp.composition;
        const composable = comp && (comp.composable === true || comp.composable === "true");
        if (!composable) errors.push(`plan: typepack "${inst.typepack}" is not composable (no composition capability) — nested/unregistered composition is rejected`);
        else if (tmpl) {
          const pos = tmpl.slots[inst.slot_id];
          if (pos && Array.isArray(comp.allowed_slots) && !comp.allowed_slots.includes(pos))
            errors.push(`plan: typepack "${inst.typepack}" does not allow slot position "${pos}" (allowed: ${comp.allowed_slots.join("/")})`);
        }
      }
    }
  }
  // bounded composition: exactly 1 primary plus 1..2 supporting
  if (primary !== 1) errors.push(`plan: exactly one primary instance is required (got ${primary})`);
  if (supporting < 1 || supporting > 2) errors.push(`plan: supporting instances must be 1..2 (got ${supporting}) — a lone primary needs no composition; more modules need an owner gate`);
  if (tmpl) {
    for (const sid of Object.keys(plan.slots ?? {})) if (!tmpl.slots[sid]) errors.push(`plan: slot "${sid}" is not defined by template "${plan.layout_template}"`);
  }
  // semantic bindings — line-free correspondence
  const keys = new Set();
  for (const b of plan.semantic_bindings ?? []) {
    if (!b.key) errors.push("plan: semantic binding without key");
    else if (keys.has(b.key)) errors.push(`plan: duplicate semantic binding key "${b.key}"`);
    else keys.add(b.key);
    if (!Array.isArray(b.endpoints) || b.endpoints.length < 2) errors.push(`plan: binding "${b.key}" needs >= 2 endpoints`);
    for (const e of b.endpoints ?? []) {
      if (!ids.has(e.instance_id)) errors.push(`plan: binding "${b.key}" endpoint references unknown instance "${e.instance_id}" (orphan)`);
      if (!e.entity_id) errors.push(`plan: binding "${b.key}" endpoint missing entity_id`);
    }
  }
  // connector edges — verify the port reference structure (compatibility and anchors come at the compose/receipt stage)
  for (const e of plan.connector_edges ?? []) {
    for (const end of ["from", "to"]) {
      const ref = e[end];
      if (!ref || !ids.has(ref.instance_id)) errors.push(`plan: connector edge ${end} references unknown instance`);
      if (!ref?.port) errors.push(`plan: connector edge ${end} missing port id`);
    }
  }
  // header — h1 is 1-2 lines (a string or a list of strings); style picks the header treatment
  const hdrV = plan.header ?? {};
  const HK = ["eyebrow", "h1", "subtitle", "style"];
  for (const k of Object.keys(hdrV)) if (!HK.includes(k)) errors.push(`plan: header unknown field "${k}"`);
  if (Array.isArray(hdrV.h1) && (hdrV.h1.length < 1 || hdrV.h1.length > 2 || hdrV.h1.some((l) => typeof l !== "string" || !l)))
    errors.push("plan: header.h1 as a list must hold 1..2 non-empty lines");
  if (hdrV.style !== undefined && !["locator", "title-keyline"].includes(hdrV.style))
    errors.push(`plan: header.style must be locator|title-keyline (got "${hdrV.style}")`);
  // reading order — exactly the same set as the instances
  const ro = plan.reading_order ?? [];
  if (ro.length !== ids.size || ro.some((r) => !ids.has(r)) || new Set(ro).size !== ro.length)
    errors.push(`plan: reading_order must list every instance exactly once`);
  if (!["explicit", "row-major", "column-major"].includes(plan.traversal)) errors.push(`plan: traversal must be explicit|row-major|column-major`);
  return { plan, planDigest, errors };
}

// ---------- rhythm: measuring the module connector run ----------
// The vertical run length of data-stroke-role="muted" paths (absolute V segments, the provable
// subset). When a TypePack declares rhythm.connector_run_band, compose (variant selection) and
// verify (re-measuring the final SVG) each check against it — the contract forbidding residual
// space from being absorbed by stretching connectors (relation density and legibility outrank
// minimising dead space).
export function connectorRunsOf(svgBody) {
  const runs = [];
  for (const m of svgBody.matchAll(/<path((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g)) {
    const raw = m[1];
    if (!/data-stroke-role\s*=\s*["']muted["']/.test(raw)) continue;
    const dm = raw.match(/\sd\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    if (!dm) continue;
    const cmds = (dm[1] ?? dm[2]).match(/[A-Za-z][^A-Za-z]*/g) ?? [];
    let x = 0, y = 0;
    for (const c of cmds) {
      const op = c[0];
      const nums = (c.slice(1).trim().match(/-?[\d.]+/g) ?? []).map(Number);
      if (op === "M" || op === "L") {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          if (op === "L" && nums[i] === x && nums[i + 1] !== y) runs.push(Math.abs(nums[i + 1] - y));
          x = nums[i]; y = nums[i + 1];
        }
      } else if (op === "V") { for (const v of nums) { runs.push(Math.abs(v - y)); y = v; } }
      else if (op === "H") { for (const v of nums) x = v; }
      // any other op is already refused by measuredBoundsStrict as outside the provable subset
    }
  }
  return runs;
}

export function bandViolations(runs, band) {
  if (!band) return [];
  const min = Number(band.min), max = Number(band.max);
  return runs.filter((r) => r < min - 0.5 || r > max + 0.5);
}

// ---------- geometry helpers (provable subset: rect/circle + stroke/2) ----------
// Geometry CP1 supports: rect, circle, line, path (absolute M/L/H/V). text and tspan cannot be
// proven by a static parser — browser-measured bounds (evidence) arrive as opts.textBoxes and are
// unioned in, and text present without evidence is an explicit error. A transform inside a
// fragment fails closed whatever its kind (the caller strips the instance wrapper's translate
// before passing it in).
export function measuredBoundsStrict(svgBody, opts = {}) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const errors = [];
  let textCount = 0;
  const attrs = (raw) => Object.fromEntries([...raw.matchAll(/([A-Za-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((mm) => [mm[1], mm[3] ?? mm[4]]));
  const take = (bx1, by1, bx2, by2, sw) => {
    x1 = Math.min(x1, bx1 - sw); y1 = Math.min(y1, by1 - sw);
    x2 = Math.max(x2, bx2 + sw); y2 = Math.max(y2, by2 + sw);
  };
  for (const m of svgBody.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    const [, close, name, raw] = m;
    if (close) continue;
    const a = attrs(raw);
    if (a.transform != null) {
      errors.push(`transform "${a.transform}" on <${name}> — any transform inside a fragment is outside the CP1 provable subset (fail-closed)`); continue;
    }
    if (a.filter != null) { errors.push(`filter on <${name}> has no provable visual range in a fragment`); continue; }
    const sw = (Number(a["stroke-width"]) || 0) / 2;
    if (name === "rect") {
      take(Number(a.x || 0), Number(a.y || 0), Number(a.x || 0) + Number(a.width || 0), Number(a.y || 0) + Number(a.height || 0), sw);
    } else if (name === "circle") {
      const cx = Number(a.cx || 0), cy = Number(a.cy || 0), r = Number(a.r || 0);
      take(cx - r, cy - r, cx + r, cy + r, sw);
    } else if (name === "line") {
      take(Math.min(Number(a.x1 || 0), Number(a.x2 || 0)), Math.min(Number(a.y1 || 0), Number(a.y2 || 0)),
           Math.max(Number(a.x1 || 0), Number(a.x2 || 0)), Math.max(Number(a.y1 || 0), Number(a.y2 || 0)), sw);
    } else if (name === "path") {
      const d = a.d ?? "";
      if (/[^MLHVmlhv0-9 .,-]/.test(d.replace(/\s+/g, " "))) { errors.push(`unsupported path commands in "${d.slice(0, 40)}…" (CP1 subset: absolute M/L/H/V)`); continue; }
      if (/[mlhv]/.test(d)) { errors.push(`relative path commands are outside the CP1 provable subset ("${d.slice(0, 40)}…")`); continue; }
      let px = 0, py = 0, seen = false;
      const toks = d.match(/[MLHV]|-?[\d.]+/g) ?? [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === "M" || t === "L") { px = Number(toks[++i]); py = Number(toks[++i]); }
        else if (t === "H") { px = Number(toks[++i]); }
        else if (t === "V") { py = Number(toks[++i]); }
        else continue;
        if (!Number.isFinite(px) || !Number.isFinite(py)) { errors.push(`non-finite path coordinate in "${d.slice(0, 40)}…"`); break; }
        take(px, py, px, py, sw);
        seen = true;
      }
      if (!seen && d.trim()) errors.push(`unparsable path "${d.slice(0, 40)}…"`);
    } else if (name === "text") {
      textCount++;
    } else if (name === "tspan") {
      // inside text — covered by the per-text evidence
    } else if (["g", "title", "desc"].includes(name)) {
      // permitted containers and metadata (transforms were refused outright above)
    } else {
      errors.push(`<${name}> is outside the CP1 provable fragment subset`);
    }
  }
  // Check the text evidence: the number of text elements present must match the number of
  // measurements, and no evidence is an explicit unverified failure
  const boxes = opts.textBoxes ?? null;
  if (textCount > 0 && !boxes) errors.push(`${textCount} text element(s) without measured bounds evidence — text is unverifiable statically (provide browser-measured textBounds)`);
  if (boxes) {
    if (boxes.length !== textCount) errors.push(`text evidence count ${boxes.length} != text elements ${textCount}`);
    for (const b of boxes) take(Number(b.x), Number(b.y), Number(b.x) + Number(b.w), Number(b.y) + Number(b.h), 0);
  }
  return { bounds: Number.isFinite(x1) ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null, errors, textCount };
}
export const textMarkupDigestOf = (body) => {
  const canon = [...body.matchAll(/<text((?:[^>"']|"[^"]*"|'[^']*')*?)>([\s\S]*?)<\/text>/g)].map((m) => {
    const attrs = [...m[1].matchAll(/([A-Za-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)]
      .map((a) => [a[1], a[3] ?? a[4]])
      .filter(([k]) => !k.startsWith("data-"))   // a namespace prefix difference is not a placement difference
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`).join(";");
    const inner = m[2].replace(/<tspan((?:[^>"']|"[^"]*"|'[^']*')*?)>/g, (mm, raw) => {
      const ta = [...raw.matchAll(/([A-Za-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)]
        .map((a) => [a[1], a[3] ?? a[4]]).filter(([k]) => !k.startsWith("data-"))
        .sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join(";");
      return `<tspan ${ta}>`;
    });
    return `${attrs}|${inner}`;
  });
  return createHash("sha256").update(canon.join("\u0001")).digest("hex").slice(0, 16);
};
export const textDigestOf = (body) => {
  const texts = [...body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  return createHash("sha256").update(texts.join("\u0001")).digest("hex").slice(0, 16);
};
const round1 = (v) => Math.round(v * 10) / 10;

export function namespaceBody(body, prefix) {
  const ids = new Set([...body.matchAll(/\bid\s*=\s*("([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)')/g)].map((m) => m[2] ?? m[3]));
  const ren = (id) => `${prefix}-${id}`;
  // id declarations (either quote style, spaced =)
  body = body.replace(/\bid\s*=\s*("([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)')/g, (mm, q, d, sq) => `id="${ren(d ?? sq)}"`);
  // url(#…)
  body = body.replace(/url\(#([A-Za-z0-9_-]+)\)/g, (mm, id) => ids.has(id) ? `url(#${ren(id)})` : mm);
  // href / xlink:href
  body = body.replace(/\b(xlink:href|href)\s*=\s*("#([A-Za-z0-9_-]+)"|'#([A-Za-z0-9_-]+)')/g,
    (mm, attr, q, d, sq) => { const id = d ?? sq; return ids.has(id) ? `${attr}="#${ren(id)}"` : mm; });
  // multi-ID ARIA references
  body = body.replace(/\b(aria-labelledby|aria-describedby)\s*=\s*("([^"]*)"|'([^']*)')/g,
    (mm, attr, q, d, sq) => `${attr}="${(d ?? sq).split(/\s+/).filter(Boolean).map((id) => ids.has(id) ? ren(id) : id).join(" ")}"`);
  // the layout/cluster/port/entity reference family (quote- and spacing-neutral)
  body = body.replace(/data-(layout-container|layout-parent|layout-item|layout-group|cluster-id|cluster|layout-title|comp-entity|comp-port)\s*=\s*("([^"]+)"|'([^']+)')/g,
    (mm, k, q, d, sq) => `data-${k}="${prefix}-${d ?? sq}"`);
  return body;
}
// After the rewrite: a dangling reference or a duplicate id is an assembly error
export function checkRefs(svg) {
  const errors = [];
  const ids = new Map();
  for (const m of svg.matchAll(/\bid\s*=\s*("([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)')/g)) {
    const id = m[2] ?? m[3];
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, n] of ids) if (n > 1) errors.push(`duplicate id "${id}" (${n}x)`);
  const refs = [];
  for (const m of svg.matchAll(/url\(#([A-Za-z0-9_-]+)\)/g)) refs.push(m[1]);
  for (const m of svg.matchAll(/\b(?:xlink:href|href)\s*=\s*(?:"#([A-Za-z0-9_-]+)"|'#([A-Za-z0-9_-]+)')/g)) refs.push(m[1] ?? m[2]);
  for (const m of svg.matchAll(/\b(?:aria-labelledby|aria-describedby)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    for (const id of (m[1] ?? m[2]).split(/\s+/).filter(Boolean)) refs.push(id);
  for (const r of refs) if (!ids.has(r)) errors.push(`dangling reference "#${r}"`);
  return errors;
}

// Running a child CLI (JSON) — a failure surfaces as a diagnostic rather than quietly corrupt
// JSON (so a child's preflight refusal or usage error is not disguised as a SyntaxError).
function spawnJson(args, label) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`  ERROR ${label} failed (exit ${r.status}):\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trimEnd());
    process.exit(1);
  }
  try { return JSON.parse(r.stdout); }
  catch { console.error(`  ERROR ${label} did not return JSON:\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trimEnd()); process.exit(1); }
}

// ---------- compose ----------
function compose(planPath, opts) {
  const { plan, planDigest, errors } = validatePlan(planPath, opts.manifest);
  if (errors.length) { for (const e of errors) console.error(`  ERROR ${e}`); process.exit(1); }
  const fragDir = opts.fragments;
  const h1Lines = Array.isArray(plan.header?.h1) ? plan.header.h1 : [plan.header?.h1 ?? plan.id];
  const pf = spawnJson([skinCli, "pageframe", plan.page.preset,
    "--h1-lines", String(h1Lines.length),
    ...(plan.page.support && plan.page.support !== "none" ? ["--support", plan.page.support] : []), "--json"],
    "skin.mjs pageframe");
  const cb = pf.regions.contentBox;
  // vertical-stack: the slot budget must match the contentBox exactly (fail-closed)
  const ha = Number(plan.slots["slot-a"].height), hb = Number(plan.slots["slot-b"].height);
  const gap = Number(plan.slot_gap ?? 24);
  if (ha + gap + hb !== cb.h) { console.error(`  ERROR compose: slot budget ${ha}+${gap}+${hb} != contentBox ${cb.h}`); process.exit(1); }
  const slotRects = {
    "slot-a": { x: cb.x, y: cb.y, w: cb.w, h: ha },
    "slot-b": { x: cb.x, y: cb.y + ha + gap, w: cb.w, h: hb },
  };
  const bodies = [], recInstances = [];
  let status = "ok";
  const problems = [];
  for (const inst of plan.instances) {
    const slot = slotRects[inst.slot_id];
    // Variant selection: if base does not fit the slot, try the variants in the order the manifest declares — Composition chooses
    const tryVariants = [inst.variant ?? "base"];
    const packs = loadManifest(opts.manifest, []);
    for (const v of packs?.[inst.typepack]?.composition?.variants ?? []) if (!tryVariants.includes(v.id)) tryVariants.push(v.id);
    // Residual-space policy (1 of 2): not plain area maximisation — pick the variant that fills
    // the slot most within the rhythm band the TypePack declares. A variant that absorbs the
    // residual by stretching connectors is not eligible, and patching raw coordinates or
    // enlarging text and arrows is likewise forbidden. When no more can legally be filled, the
    // leftover space is honestly declared through residual_disposition.
    const band = packs?.[inst.typepack]?.composition?.rhythm?.connector_run_band ?? null;
    let chosen = null;
    const rhythmRejected = [];
    for (const variant of tryVariants) {
      const stem = variant === "base" ? inst.typepack : `${inst.typepack}.${variant}`;
      const svgP = path.join(fragDir, `${stem}.svg`), rcpP = path.join(fragDir, `${stem}.receipt.json`);
      let frag, rcp;
      try { frag = readFileSync(svgP, "utf8"); rcp = JSON.parse(readFileSync(rcpP, "utf8")); } catch { continue; }
      if (band) {
        // Body extraction can fail on a tampered or irregular fragment — running the band check
        // over the whole document is equivalent (connectors live only inside the svg), and
        // sourceDigest is what catches the integrity problem
        const bad = bandViolations(connectorRunsOf(frag.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? frag), band);
        if (bad.length) { rhythmRejected.push(`${variant} (connector run ${round1(bad[0])}px outside ${band.min}..${band.max})`); continue; }
      }
      if (rcp.usedBounds.w <= slot.w && rcp.usedBounds.h <= slot.h) {
        if (!chosen || rcp.usedBounds.h > chosen.rcp.usedBounds.h) chosen = { variant, frag, rcp, svgP };
      }
    }
    if (!chosen) {
      status = "needs-split";
      problems.push(`instance "${inst.instance_id}": no declared variant fits slot ${inst.slot_id} (${slotRects[inst.slot_id].w}x${slotRects[inst.slot_id].h})${rhythmRejected.length ? ` — rhythm-band ineligible: ${rhythmRejected.join(", ")}` : ""} — recommend splitting into a separate page`);
      continue;
    }
    const { variant, frag, rcp } = chosen;
    // the fragment contract: page-level elements (a header-cluster and the like) are forbidden
    if (/data-layout-role\s*=\s*["']header-cluster["']/.test(frag)) { problems.push(`instance "${inst.instance_id}": fragment contains page header elements — fragments own only their local topology`); continue; }
    // receipt integrity: check sourceDigest, and re-measure against usedBounds (blocking stale or tampered receipts)
    const fragSha = createHash("sha256").update(frag).digest("hex").slice(0, 16);
    if (rcp.sourceDigest && rcp.sourceDigest !== fragSha) { problems.push(`instance "${inst.instance_id}": fragment sourceDigest mismatch (receipt ${rcp.sourceDigest}, file ${fragSha})`); continue; }
    if (!rcp.sourceDigest) { problems.push(`instance "${inst.instance_id}": fragment receipt missing sourceDigest`); continue; }
    const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
    // text bounds evidence: the method, input digest and content digest must be bound to the fragment (stale evidence is refused)
    const fragTextCount = [...body.matchAll(/<text[\s>]/g)].length;
    if (fragTextCount === 0) {
      // the text-free fragment contract: textDigest/textMarkupDigest/textMeasure = null, textBounds = []
      for (const k of ["textDigest", "textMarkupDigest", "textMeasure"])
        if (rcp[k] != null) problems.push(`instance "${inst.instance_id}": text-free fragment must record ${k}: null (got ${JSON.stringify(rcp[k])})`);
      if (!Array.isArray(rcp.textBounds) || rcp.textBounds.length !== 0)
        problems.push(`instance "${inst.instance_id}": text-free fragment must record textBounds: []`);
    } else if (!rcp.textMeasure || rcp.textMeasure.method !== "browser-getBBox") problems.push(`instance "${inst.instance_id}": fragment receipt missing browser text-measure evidence`);
    else if (rcp.textMeasure.inputDigest !== fragSha) problems.push(`instance "${inst.instance_id}": text-measure inputDigest ${rcp.textMeasure.inputDigest} != fragment ${fragSha} (stale text evidence)`);
    if (fragTextCount > 0 && rcp.textDigest !== textDigestOf(body)) problems.push(`instance "${inst.instance_id}": fragment text content digest mismatch (receipt ${rcp.textDigest}, measured ${textDigestOf(body)})`);
    if (fragTextCount > 0 && rcp.textMarkupDigest !== textMarkupDigestOf(body)) problems.push(`instance "${inst.instance_id}": fragment text markup digest mismatch — text placement/typography attributes changed after measurement`);
    const meas = measuredBoundsStrict(body, { textBoxes: rcp.textBounds });
    for (const ge of meas.errors) problems.push(`instance "${inst.instance_id}": ${ge}`);
    if (meas.bounds) {
      const rb = rcp.usedBounds;
      if (Math.abs(meas.bounds.x - rb.x) > 1 || Math.abs(meas.bounds.y - rb.y) > 1 || Math.abs(meas.bounds.w - rb.w) > 1 || Math.abs(meas.bounds.h - rb.h) > 1)
        problems.push(`instance "${inst.instance_id}": fragment receipt usedBounds ${JSON.stringify(rb)} != measured ${JSON.stringify(meas.bounds)}`);
    }
    // completing the port contract (R1-P4): capability check, uniqueness, cardinality, anchor, normal
    const packsForPorts = loadManifest(opts.manifest, []);
    const caps = packsForPorts?.[inst.typepack]?.composition?.ports ?? [];
    const capByTemplate = Object.fromEntries(caps.map((c) => [c.template, c]));
    const portIds = new Set();
    const byTemplate = {};
    for (const p of rcp.ports ?? []) {
      if (portIds.has(p.id)) problems.push(`instance "${inst.instance_id}": duplicate port id "${p.id}"`);
      portIds.add(p.id);
      const cap = capByTemplate[p.template];
      if (!cap) { problems.push(`instance "${inst.instance_id}": port "${p.id}" uses undeclared capability template "${p.template}"`); continue; }
      if (p.direction !== cap.direction) problems.push(`instance "${inst.instance_id}": port "${p.id}" direction ${p.direction} != capability ${cap.direction}`);
      if (p.kind !== cap.kind) problems.push(`instance "${inst.instance_id}": port "${p.id}" kind ${p.kind} != capability ${cap.kind}`);
      if (!Number.isFinite(p.anchor?.x) || !Number.isFinite(p.anchor?.y)) problems.push(`instance "${inst.instance_id}": port "${p.id}" anchor is not finite`);
      else {
        const rb = rcp.usedBounds;
        if (p.anchor.x < rb.x - 2 || p.anchor.x > rb.x + rb.w + 2 || p.anchor.y < rb.y - 2 || p.anchor.y > rb.y + rb.h + 2)
          problems.push(`instance "${inst.instance_id}": port "${p.id}" anchor sits outside usedBounds`);
      }
      const nx = p.normal?.x ?? NaN, ny = p.normal?.y ?? NaN;
      if (!((Math.abs(nx) === 1 && ny === 0) || (nx === 0 && Math.abs(ny) === 1)))
        problems.push(`instance "${inst.instance_id}": port "${p.id}" normal must be a unit axis vector`);
      (byTemplate[p.template] ??= []).push(p);
    }
    for (const [tpl, cap] of Object.entries(capByTemplate)) {
      const n = (byTemplate[tpl] ?? []).length;
      const card = String(cap.cardinality);
      let ok = true;
      if (card === "0..n") ok = true;
      else if (/^\d+$/.test(card)) ok = n === Number(card);
      else { const [lo, hi] = card.split(".."); ok = n >= Number(lo) && (hi === "n" || n <= Number(hi)); }
      if (!ok) problems.push(`instance "${inst.instance_id}": template "${tpl}" has ${n} actual port(s) but capability cardinality is "${card}"`);
    }
    // translation-only placement: centred horizontally, aligned to the top
    const dx = round1(slot.x + (slot.w - rcp.usedBounds.w) / 2 - rcp.usedBounds.x);
    const dy = round1(slot.y - rcp.usedBounds.y);
    const nsBody = namespaceBody(body, inst.instance_id);
    bodies.push(`<g data-comp-instance="${inst.instance_id}" data-comp-slot="${inst.slot_id}" transform="translate(${dx},${dy})">${nsBody}</g>`);
    recInstances.push({ instance_id: inst.instance_id, typepack: inst.typepack, variant,
      module_role: inst.module_role, slot_id: inst.slot_id, translate: { dx, dy },
      usedBounds: { x: round1(rcp.usedBounds.x + dx), y: round1(rcp.usedBounds.y + dy), w: rcp.usedBounds.w, h: rcp.usedBounds.h },
      ports: (rcp.ports ?? []).map((p) => ({ ...p, anchor: { x: round1(p.anchor.x + dx), y: round1(p.anchor.y + dy) } })),
      entities: rcp.entities ?? [], identity: rcp.identity,
      textDigest: rcp.textDigest,
      textMarkupDigest: rcp.textMarkupDigest,
      textMeasure: rcp.textMeasure ?? null,
      textBounds: (rcp.textBounds ?? []).map((b) => ({ x: round1(b.x + dx), y: round1(b.y + dy), w: b.w, h: b.h })),
      degrade: variant === "base" ? null : { selectedVariant: variant, lost: rcp.degradeLost ?? "variant-declared reduction (see fragment receipt)" } });
  }
  // semantic binding: an endpoint entity must exist among the actual fragment receipt entities (R1-P2)
  const entByInstance = Object.fromEntries(recInstances.map((r) => [r.instance_id, new Set(r.entities)]));
  for (const b of plan.semantic_bindings ?? []) {
    for (const e of b.endpoints ?? []) {
      const set = entByInstance[e.instance_id];
      if (set && !set.has(e.entity_id))
        problems.push(`binding "${b.key}": entity "${e.entity_id}" does not exist in instance "${e.instance_id}" (ghost endpoint)`);
    }
  }
  // Declared completeness: on an instance listed in binding_complete_over, every entity takes part in at least one binding
  for (const covId of plan.binding_complete_over ?? []) {
    const set = entByInstance[covId];
    if (!set) continue;
    const bound = new Set((plan.semantic_bindings ?? []).flatMap((b) => b.endpoints.filter((e) => e.instance_id === covId).map((e) => e.entity_id)));
    for (const ent of set) if (!bound.has(ent) && ent !== "root")
      problems.push(`binding coverage: entity "${ent}" of "${covId}" is not bound — declared complete coverage is missing a pair`);
  }
  // identity equality (across instances)
  const idents = recInstances.map((r) => JSON.stringify(r.identity));
  const identityConsistent = idents.length > 0 && idents.every((x) => x === idents[0]);
  if (!identityConsistent && recInstances.length) problems.push("identity digests differ across instances — all modules must share one skin/typography/pageframe/kernel contract");
  // connector edges (the micro-fixture path): port existence, kind/direction compatibility, and the vertical corridor check
  const edges = [];
  for (const e of plan.connector_edges ?? []) {
    const from = recInstances.find((r) => r.instance_id === e.from.instance_id)?.ports.find((p) => p.id === e.from.port);
    const to = recInstances.find((r) => r.instance_id === e.to.instance_id)?.ports.find((p) => p.id === e.to.port);
    if (!from || !to) { problems.push(`connector edge references missing actual port (${e.from.port} -> ${e.to.port})`); continue; }
    if (from.kind !== to.kind) problems.push(`connector kind mismatch ${from.kind} != ${to.kind}`);
    if (!(from.direction === "out" || from.direction === "bidir") || !(to.direction === "in" || to.direction === "bidir"))
      problems.push(`connector direction incompatible (${from.direction} -> ${to.direction})`);
    const gapTop = Math.abs(to.anchor.y - from.anchor.y);
    if (gapTop < 8 + 12 + 8) problems.push(`connector corridor ${round1(gapTop)}px cannot satisfy tip gap 8 + visible shaft 12 + gap 8`);
    edges.push({ from: { ...e.from, anchor: from.anchor }, to: { ...e.to, anchor: to.anchor },
      d: `M${from.anchor.x} ${from.anchor.y + 8} V${to.anchor.y - 8}` });
    bodies.push(`<g data-comp-connectors="true"><path d="M${from.anchor.x} ${from.anchor.y + 8} V${to.anchor.y - 8}" fill="none" data-stroke-role="edge-line" stroke="#2E6DA4" stroke-width="2.5" marker-end="url(#comp-ah)"/></g>`);
  }
  // In CP1 one port carries at most one edge
  const usedPorts = new Map();
  for (const e of plan.connector_edges ?? []) {
    for (const end of ["from", "to"]) {
      const key = `${e[end].instance_id}#${e[end].port}`;
      usedPorts.set(key, (usedPorts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, n] of usedPorts) if (n > 1) problems.push(`port ${key} participates in ${n} edges (CP1 limit: 1)`);
  if (problems.length && status === "ok") status = "invalid";
  const hdr = plan.header ?? {};
  // header treatment: derived from the pageframe headerScale, not from coordinate constants.
  // - title-keyline (the canonical default): a vertical keyline derived from the H1 line-box
  //   alone. Never shown together with the locator; the eyebrow, H1 and subtitle text start on
  //   one alignment; gap, pad and width belong to the scale profile
  // - locator (the alternative variant): a square locator before the eyebrow, following the
  //   marker-label-row formula (centres agree)
  const hs = pf.headerScale;
  const hStyle = hdr.style ?? "title-keyline";
  const textX = 40, h1Y = 92;
  const h1YLast = h1Y + (h1Lines.length - 1) * hs.h1LinePitch;
  const subtitleY = 124 + (h1Lines.length - 1) * hs.h1LinePitch;
  const h1Markup = h1Lines.length === 1
    ? `<text data-layout-role="cluster-h1" data-fill-role="ink" x="${textX}" y="${h1Y}" font-size="${hs.h1}" font-weight="700" fill="#252B35" dominant-baseline="central">${h1Lines[0]}</text>`
    : `<text data-layout-role="cluster-h1" data-fill-role="ink" font-size="${hs.h1}" font-weight="700" fill="#252B35" dominant-baseline="central"><tspan x="${textX}" y="${h1Y}">${h1Lines[0]}</tspan><tspan x="${textX}" y="${h1Y + hs.h1LinePitch}">${h1Lines[1]}</tspan></text>`;
  const kl = hs.keyline;
  const klTop = h1Y - hs.h1 / 2 - kl.pad, klBottom = h1YLast + hs.h1 / 2 + kl.pad;
  const eyebrowMarkup = hdr.eyebrow
    ? (hStyle === "title-keyline"
      ? `<text data-layout-role="cluster-eyebrow" data-fill-role="muted" x="${textX}" y="56" font-size="${hs.eyebrow}" font-weight="700" letter-spacing="0.10em" fill="#636A75" dominant-baseline="central">${hdr.eyebrow}</text>`
      : `<rect data-layout-role="cluster-locator" data-fill-role="focus" x="${textX}" y="52" width="8" height="8" rx="2" fill="#2E6DA4"/>
    <text data-layout-role="cluster-eyebrow" data-fill-role="muted" x="${textX + 16}" y="56" font-size="${hs.eyebrow}" font-weight="700" letter-spacing="0.10em" fill="#636A75" dominant-baseline="central">${hdr.eyebrow}</text>`)
    : "";
  const keylineMarkup = hStyle === "title-keyline"
    ? `<rect data-layout-role="cluster-keyline" data-fill-role="focus" x="${textX - kl.gap - kl.width}" y="${klTop}" width="${kl.width}" height="${round1(klBottom - klTop)}" rx="${kl.width / 2}" fill="#2E6DA4"/>
    ` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pf.canvas.width} ${pf.canvas.height}" width="${pf.canvas.width}" height="${pf.canvas.height}" role="img"
  style="font-family:Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <title>${h1Lines.join(" ")}</title>
  <desc>Composite scene (${plan.layout_template}): ${plan.instances.map((i) => i.typepack).join(" + ")}.</desc>
  <defs>
    <marker id="comp-ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="11.25" markerHeight="11.25" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M2 2 L10 6 L2 10" fill="none" data-stroke-role="edge-line" stroke="#2E6DA4" stroke-width="2" stroke-linecap="round"/></marker>
  </defs>
  <rect data-fill-role="canvas" fill="#F7F7F5" width="${pf.canvas.width}" height="${pf.canvas.height}"/>
  <g data-layout-role="header-cluster" data-layout-content-top="${cb.y + 14}" data-layout-breathing="36" data-layout-tolerance="2">
    ${keylineMarkup}${eyebrowMarkup ? `${eyebrowMarkup}
    ` : ""}${h1Markup}
    ${hdr.subtitle ? `<text data-layout-role="cluster-subtitle" data-fill-role="muted" x="${textX}" y="${subtitleY}" font-size="${hs.subtitle}" fill="#636A75" dominant-baseline="central">${hdr.subtitle}</text>` : ""}
  </g>
  ${bodies.join("\n  ")}
</svg>`;
  // Residual-space policy (2 of 2): after the final placement, record contentFlowBounds and the
  // contentBox residual; the leftover at the page bottom must match the plan's explicit
  // residual_disposition declaration — "fill what can be filled, declare what is left", with no
  // invented threshold
  let contentFlowBounds = null, residual = null;
  if (recInstances.length) {
    const xs1 = Math.min(...recInstances.map((r) => r.usedBounds.x));
    const ys1 = Math.min(...recInstances.map((r) => r.usedBounds.y));
    const xs2 = Math.max(...recInstances.map((r) => r.usedBounds.x + r.usedBounds.w));
    const ys2 = Math.max(...recInstances.map((r) => r.usedBounds.y + r.usedBounds.h));
    contentFlowBounds = { x: round1(xs1), y: round1(ys1), w: round1(xs2 - xs1), h: round1(ys2 - ys1) };
    residual = { top: round1(Math.max(0, ys1 - cb.y)), bottom: round1(Math.max(0, cb.y + cb.h - ys2)) };
    const disp = plan.residual_disposition ?? null;
    if (residual.bottom > 2) {
      if (!disp || !Number.isFinite(Number(disp.bottom)))
        problems.push(`page bottom residual ${residual.bottom}px is undeclared — declare residual_disposition {bottom, reason} (with the largest fitting variants already selected) or split the page`);
      else if (Math.abs(Number(disp.bottom) - residual.bottom) > 2)
        problems.push(`declared residual_disposition.bottom ${disp.bottom}px != measured ${residual.bottom}px`);
      else if (!disp.reason) problems.push("residual_disposition requires a reason (e.g. bottom breathing for the 4:5 social posture)");
    }
    if (problems.length && status === "ok") status = "invalid";
  }
  // After the namespace rewrite, a dangling reference or a duplicate id is an assembly failure (judged on the final SVG)
  for (const re of checkRefs(svg)) { problems.push(`assembly: ${re}`); if (status === "ok") status = "invalid"; }
  const receipt = { schemaVersion: 1, kind: "composition-receipt", planId: plan.id, planDigest,
    layoutTemplate: plan.layout_template, page: { preset: plan.page.preset, canvas: pf.canvas },
    resolvedSlots: slotRects, slotGap: gap, contentFlowBounds, residual,
    residualDisposition: plan.residual_disposition ?? null,
    instances: recInstances, connectorEdges: edges,
    semanticBindings: plan.semantic_bindings ?? [], readingOrder: plan.reading_order,
    identityConsistent, status, problems,
    budget: { h1Count: 1, h1ScaleTexts: 1, note: "the focal/tint/connector tallies are measured and advisory — no threshold is defined (by contract)" } };
  if (opts.receipt) writeFileSync(opts.receipt, JSON.stringify(receipt, null, 1));
  if (status === "ok" && opts.out) writeFileSync(opts.out, svg.replace(/[ \t]+$/gm, ""));
  console.log(`compose ${plan.id} — status=${status}, instances=${recInstances.length}/${plan.instances.length}${problems.length ? `\n  ` + problems.join("\n  ") : ""}`);
  process.exit(status === "ok" ? 0 : status === "needs-split" ? 3 : 1);
}

// ---------- verify ----------
function verify(svgPath, opts) {
  const errors = [];
  const svg = readFileSync(svgPath, "utf8");
  const receipt = JSON.parse(readFileSync(opts.receipt, "utf8"));
  const { plan, planDigest: livePlanDigest, errors: pErr } = validatePlan(opts.plan, opts.manifest);
  errors.push(...pErr);
  const packsV = opts.manifest ? loadManifest(opts.manifest, []) : null;
  // Receipt v1 strict schema — no field of a receipt is trusted unverified (R1-P1)
  const RK = ["schemaVersion", "kind", "planId", "planDigest", "layoutTemplate", "page", "resolvedSlots",
    "slotGap", "contentFlowBounds", "residual", "residualDisposition", "instances", "connectorEdges",
    "semanticBindings", "readingOrder", "identityConsistent", "status", "problems", "budget"];
  for (const k of Object.keys(receipt)) if (!RK.includes(k)) errors.push(`E-COMP-SCHEMA receipt unknown field "${k}"`);
  for (const k of RK) if (!(k in receipt)) errors.push(`E-COMP-SCHEMA receipt missing field "${k}"`);
  if (receipt.schemaVersion !== 1 || receipt.kind !== "composition-receipt") errors.push("E-COMP-SCHEMA receipt identity invalid");
  if (receipt.status !== "ok" || (receipt.problems ?? []).length) errors.push(`E-COMP-STATUS receipt status "${receipt.status}" with ${receipt.problems?.length ?? 0} problem(s) — only clean ok passes verify`);
  // planDigest is recomputed from the plan file and compared
  if (receipt.planDigest !== livePlanDigest) errors.push(`E-COMP-FORGED receipt planDigest ${receipt.planDigest} != recomputed ${livePlanDigest}`);
  // slots and page are recomputed from Plan plus PageFrame and compared
  if (plan) {
    const h1LinesV = Array.isArray(plan.header?.h1) ? plan.header.h1.length : 1;
    const pfR = spawnJson([skinCli, "pageframe", plan.page.preset,
      "--h1-lines", String(h1LinesV),
      ...(plan.page.support && plan.page.support !== "none" ? ["--support", plan.page.support] : []), "--json"], "skin.mjs pageframe");
    const cbR = pfR.regions.contentBox;
    const ha = Number(plan.slots["slot-a"].height), hb = Number(plan.slots["slot-b"].height), gap = Number(plan.slot_gap ?? 24);
    const expectSlots = { "slot-a": { x: cbR.x, y: cbR.y, w: cbR.w, h: ha }, "slot-b": { x: cbR.x, y: cbR.y + ha + gap, w: cbR.w, h: hb } };
    if (JSON.stringify(expectSlots) !== JSON.stringify(receipt.resolvedSlots)) errors.push("E-COMP-FORGED receipt resolvedSlots != recomputed from plan + pageframe");
    if (JSON.stringify(pfR.canvas) !== JSON.stringify(receipt.page?.canvas)) errors.push("E-COMP-FORGED receipt page.canvas != pageframe receipt");
  }
  // compare against the live SSoT digests — a fake digest that is merely self-consistent is refused (R1-P1)
  const live = {};
  try {
    const rj = spawnJson([skinCli, "resolve", "current", "--mode", "light", "--json"], "skin.mjs resolve");
    const pj = spawnJson([skinCli, "pageframe", "social-4x5", "--json"], "skin.mjs pageframe");
    live.skinProfileDigest = rj.profile.digests[0].digest;
    live.typographyProfileDigest = rj.typography.profileDigest;
    live.pageFrameDigest = pj.profile.digest;
    live.kernelVersion = rj.provenance.kernel;
  } catch { errors.push("E-COMP-LIVE unable to load live registry digests — fail-closed"); }
  for (const inst of receipt.instances ?? []) {
    for (const [k, v] of Object.entries(live)) {
      if (inst.identity?.[k] !== v)
        errors.push(`E-COMP-LIVE instance "${inst.instance_id}" ${k} "${inst.identity?.[k]}" != live registry "${v}"`);
    }
  }
  // the nested strict schema for an instance receipt (P1-1) — deleting a field cannot disable the check
  const IK = ["instance_id", "typepack", "variant", "module_role", "slot_id", "translate",
    "usedBounds", "ports", "entities", "identity", "degrade", "textDigest", "textMarkupDigest",
    "textBounds", "textMeasure"];
  for (const inst of receipt.instances ?? []) {
    const ctx = `instance "${inst.instance_id ?? "?"}"`;
    for (const k of Object.keys(inst)) if (!IK.includes(k)) errors.push(`E-COMP-SCHEMA ${ctx} unknown field "${k}"`);
    for (const k of IK) if (!(k in inst)) errors.push(`E-COMP-SCHEMA ${ctx} missing field "${k}"`);
  }
  // the receipt instance set equals the plan set (the svg set is compared in the domOrder check below, making it 3-way)
  const rIds = (receipt.instances ?? []).map((r) => r.instance_id);
  const pIds = (plan?.instances ?? []).map((i) => i.instance_id);
  for (const id of pIds) if (!rIds.includes(id)) errors.push(`E-COMP-MISSING receipt drops instance "${id}" declared in the plan`);
  for (const id of rIds) if (!pIds.includes(id)) errors.push(`E-COMP-EXTRA receipt contains undeclared instance "${id}"`);
  // extract the instance groups plus their DOM order
  const domOrder = [];
  const groups = {};
  const re = /<g data-comp-instance="([a-z0-9-]+)" data-comp-slot="([a-z0-9-]+)" transform="translate\((-?[\d.]+),(-?[\d.]+)\)(?:[^)]*)\)?">/g;
  let m2;
  const idxs = [];
  while ((m2 = re.exec(svg))) { domOrder.push(m2[1]); idxs.push({ id: m2[1], slot: m2[2], dx: Number(m2[3]), dy: Number(m2[4]), start: m2.index }); }
  // the slice boundary: the next comp group (an instance or connectors) or the end of the document
  const boundaries = [...svg.matchAll(/<g data-comp-(?:instance|connectors)/g)].map((b) => b.index);
  for (let i = 0; i < idxs.length; i++) {
    const nb = boundaries.find((b) => b > idxs[i].start);
    const end = nb ?? svg.length;
    groups[idxs[i].id] = { ...idxs[i], body: svg.slice(idxs[i].start, end) };
  }
  // enforce translation-only: an instance transform mixing in scale or rotate is refused
  for (const g of svg.matchAll(/<g data-comp-instance="[a-z0-9-]+"[^>]*transform="([^"]+)"/g)) {
    if (!/^translate\(-?[\d.]+,-?[\d.]+\)$/.test(g[1])) errors.push(`E-COMP-TRANSFORM instance transform must be translation-only (got "${g[1]}")`);
  }
  const planIds = (plan?.instances ?? []).map((i) => i.instance_id);
  for (const id of planIds) if (!groups[id]) errors.push(`E-COMP-MISSING instance "${id}" declared in the plan is absent from the composite`);
  for (const id of domOrder) if (!planIds.includes(id)) errors.push(`E-COMP-EXTRA composite contains undeclared instance "${id}"`);
  if (new Set(domOrder).size !== domOrder.length) errors.push("E-COMP-DUP duplicate instance groups in the composite");
  // usedBounds: re-measured from the final SVG rather than taken from the receipt — receipt-tamper resistance
  for (const inst of receipt.instances ?? []) {
    const g = groups[inst.instance_id];
    if (!g) continue;
    const innerBody = g.body.replace(/^<g data-comp-instance[^>]*>/, "");
    const compositeTextCount = [...innerBody.matchAll(/<text[\s>]/g)].length;
    if (compositeTextCount === 0) {
      // the text-free instance contract: exactly this all-null combination is allowed (release-blocking P2)
      const wantNull = { textDigest: inst.textDigest, textMarkupDigest: inst.textMarkupDigest, textMeasure: inst.textMeasure };
      for (const [k, v] of Object.entries(wantNull))
        if (v != null) errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" has no text but "${k}" is ${JSON.stringify(v)} — text-free instances must record null`);
      if (!Array.isArray(inst.textBounds) || inst.textBounds.length !== 0)
        errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" has no text but textBounds is not []`);
    }
    if (compositeTextCount > 0) {
      // an instance carrying text: every evidence field is required — deletion or blanks are a schema error (P1-1)
      const needs = { textDigest: inst.textDigest, textMarkupDigest: inst.textMarkupDigest, textBounds: inst.textBounds, textMeasure: inst.textMeasure };
      for (const [k, v] of Object.entries(needs))
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0))
          errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" has ${compositeTextCount} text(s) but "${k}" evidence is missing/empty`);
      if (inst.textMeasure && (inst.textMeasure.method !== "browser-getBBox" || !inst.textMeasure.inputDigest))
        errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" textMeasure must record method browser-getBBox and inputDigest`);
      if (Array.isArray(inst.textBounds) && inst.textBounds.length !== compositeTextCount)
        errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" textBounds count ${inst.textBounds.length} != composite text count ${compositeTextCount}`);
      if (inst.textMeasure?.texts != null && inst.textMeasure.texts !== compositeTextCount)
        errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" textMeasure.texts ${inst.textMeasure.texts} != composite text count ${compositeTextCount}`);
    }
    // the composite text's content and placement must match the evidence (tampering or substitution is refused)
    if (inst.textDigest && textDigestOf(innerBody) !== inst.textDigest)
      errors.push(`E-COMP-RECEIPT-TEXT instance "${inst.instance_id}" text content digest ${textDigestOf(innerBody)} != receipt ${inst.textDigest} — text was altered after measurement`);
    if (inst.textMarkupDigest && textMarkupDigestOf(innerBody) !== inst.textMarkupDigest)
      errors.push(`E-COMP-RECEIPT-TEXT instance "${inst.instance_id}" text markup digest mismatch — text placement/typography changed after measurement (x/y/font/anchor/tspan)`);
    // textBounds is already in global coordinates (compose applied the translate) — invert it to sum in local space
    const localTextBoxes = (inst.textBounds ?? []).map((b) => ({ x: b.x - g.dx, y: b.y - g.dy, w: b.w, h: b.h }));
    const mm2 = measuredBoundsStrict(innerBody, { textBoxes: localTextBoxes });
    for (const ge of mm2.errors) errors.push(`E-COMP-UNVERIFIED-GEOM instance "${inst.instance_id}": ${ge}`);
    const local = mm2.bounds;
    if (!local) { errors.push(`E-COMP-UNMEASURABLE instance "${inst.instance_id}" has no provable geometry`); continue; }
    const meas = { x: round1(local.x + 0), y: round1(local.y + 0), w: round1(local.w), h: round1(local.h) };
    // the group body coordinates are local (fragment) plus the translate — the measurement applies the translate
    const tx = { x: round1(local.x + g.dx), y: round1(local.y + g.dy), w: round1(local.w), h: round1(local.h) };
    const rb = inst.usedBounds;
    if (Math.abs(tx.x - rb.x) > 1 || Math.abs(tx.y - rb.y) > 1 || Math.abs(tx.w - rb.w) > 1 || Math.abs(tx.h - rb.h) > 1)
      errors.push(`E-COMP-RECEIPT instance "${inst.instance_id}" measured bounds ${JSON.stringify(tx)} != receipt ${JSON.stringify(rb)} — receipts must reflect the artifact, not the plan`);
    const slot = receipt.resolvedSlots[inst.slot_id];
    if (tx.x < slot.x - 0.5 || tx.y < slot.y - 0.5 || tx.x + tx.w > slot.x + slot.w + 0.5 || tx.y + tx.h > slot.y + slot.h + 0.5)
      errors.push(`E-COMP-BOUNDS instance "${inst.instance_id}" used bounds escape slot ${inst.slot_id}`);
    // rhythm band: re-measure the connector run from the final SVG — the pack is looked up by the
    // plan's typepack (so forging the receipt's typepack cannot bypass the band)
    const planTp = (plan?.instances ?? []).find((pi) => pi.instance_id === inst.instance_id)?.typepack;
    const bandV = packsV?.[planTp]?.composition?.rhythm?.connector_run_band ?? null;
    if (bandV) for (const r of bandViolations(connectorRunsOf(innerBody), bandV))
      errors.push(`E-COMP-RHYTHM instance "${inst.instance_id}" connector run ${round1(r)}px outside declared band ${bandV.min}..${bandV.max} — residual must not be absorbed by stretching connector runs`);
  }
  // recompute and compare contentFlowBounds and residual (tamper resistance), plus the disposition policy
  if (receipt.instances?.length && plan) {
    const xs1 = Math.min(...receipt.instances.map((r) => r.usedBounds.x));
    const ys1 = Math.min(...receipt.instances.map((r) => r.usedBounds.y));
    const xs2 = Math.max(...receipt.instances.map((r) => r.usedBounds.x + r.usedBounds.w));
    const ys2 = Math.max(...receipt.instances.map((r) => r.usedBounds.y + r.usedBounds.h));
    const cbAll = Object.values(receipt.resolvedSlots ?? {});
    const cbTop = Math.min(...cbAll.map((s2) => s2.y));
    const cbBottom = Math.max(...cbAll.map((s2) => s2.y + s2.h));
    const expFlow = { x: round1(xs1), y: round1(ys1), w: round1(xs2 - xs1), h: round1(ys2 - ys1) };
    if (JSON.stringify(expFlow) !== JSON.stringify(receipt.contentFlowBounds))
      errors.push("E-COMP-FORGED receipt contentFlowBounds != recomputed union of instance bounds");
    const expResidual = { top: round1(Math.max(0, ys1 - cbTop)), bottom: round1(Math.max(0, cbBottom - ys2)) };
    if (JSON.stringify(expResidual) !== JSON.stringify(receipt.residual))
      errors.push("E-COMP-FORGED receipt residual != recomputed from contentFlowBounds/contentBox");
    if (expResidual.bottom > 2) {
      const disp = receipt.residualDisposition;
      if (!disp || !Number.isFinite(Number(disp.bottom)) || Math.abs(Number(disp.bottom) - expResidual.bottom) > 2 || !disp.reason)
        errors.push(`E-COMP-RESIDUAL page bottom residual ${expResidual.bottom}px lacks a matching explicit residual_disposition — large dead space must never pass silently`);
    }
  }
  // slots must not overlap
  const sr = Object.entries(receipt.resolvedSlots ?? {});
  for (let i = 0; i < sr.length; i++) for (let j = i + 1; j < sr.length; j++) {
    const [aId, a] = sr[i], [bId, b] = sr[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      errors.push(`E-COMP-OVERLAP slots ${aId} and ${bId} overlap`);
  }
  // reading order: with traversal=explicit the DOM order must match the declaration
  if (plan?.traversal === "explicit") {
    const ro = plan.reading_order ?? [];
    if (JSON.stringify(domOrder) !== JSON.stringify(ro))
      errors.push(`E-COMP-ORDER DOM order [${domOrder.join(", ")}] != declared reading_order [${ro.join(", ")}]`);
  }
  // the entity set: data-comp-entity in the final SVG is 1:1 with the receipt entities (R1-P2)
  for (const inst of receipt.instances ?? []) {
    const g = groups[inst.instance_id];
    if (!g) continue;
    const found = new Set([...g.body.matchAll(/data-comp-entity\s*=\s*(?:"([^"]+)"|'([^']+)')/g)].map((mm) => (mm[1] ?? mm[2]).replace(`${inst.instance_id}-`, "")));
    for (const ent of inst.entities ?? []) if (!found.has(ent)) errors.push(`E-COMP-ENTITY instance "${inst.instance_id}" entity "${ent}" missing from the composite`);
    for (const ent of found) if (!(inst.entities ?? []).includes(ent)) errors.push(`E-COMP-ENTITY composite carries undeclared entity "${ent}" in "${inst.instance_id}"`);
  }
  // identity equality
  if (receipt.identityConsistent === false) errors.push("E-COMP-IDENTITY receipt reports inconsistent module identities");
  const idents = (receipt.instances ?? []).map((r) => JSON.stringify(r.identity));
  if (idents.length && !idents.every((x) => x === idents[0])) errors.push("E-COMP-IDENTITY module identity digests differ");
  // duplicate SVG ids across the whole document
  const seen = new Map();
  for (const mm of svg.matchAll(/id\s*=\s*"([A-Za-z0-9_-]+)"/g)) seen.set(mm[1], (seen.get(mm[1]) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) errors.push(`E-COMP-DUPID svg id "${id}" appears ${n} times`);
  // runtime re-measurement of the final composite text (on by default — the most honest binding; it covers inherited styles too)
  if (!opts.noBrowser) {
    const mtCli = path.join(here, "measure-text.mjs");
    const mr = spawnSync(process.execPath, [mtCli, svgPath], { encoding: "utf8", timeout: 60000 });
    if (mr.status !== 0) {
      errors.push("E-COMP-TEXT-RUNTIME browser text re-measure unavailable or failed — fail-closed (pass --no-browser only as an explicit environment-bounded downgrade)");
    } else {
      try {
        const tm = JSON.parse(mr.stdout);
        for (const inst of receipt.instances ?? []) {
          const mine = tm.texts.filter((t) => t.instance === inst.instance_id);
          const rb = inst.textBounds ?? [];
          if (mine.length !== rb.length) {
            errors.push(`E-COMP-TEXT-RUNTIME instance "${inst.instance_id}" has ${mine.length} rendered text(s) but receipt records ${rb.length}`);
            continue;
          }
          for (let i = 0; i < mine.length; i++) {
            const a = mine[i], b = rb[i];
            if (Math.abs(a.gx - b.x) > 2 || Math.abs(a.gy - b.y) > 2 || Math.abs(a.gw - b.w) > 2 || Math.abs(a.gh - b.h) > 2)
              errors.push(`E-COMP-TEXT-RUNTIME instance "${inst.instance_id}" text[${i}] rendered ${JSON.stringify({ x: a.gx, y: a.gy, w: a.gw, h: a.gh })} != receipt ${JSON.stringify(b)} — placement/typography drift beyond tolerance`);
          }
        }
      } catch { errors.push("E-COMP-TEXT-RUNTIME unparseable browser measurement"); }
    }
  }
  // the page budget machine gate (R1-P2p): exactly one H1 by semantic role — owned by the header
  const roleH1 = [...svg.matchAll(/data-layout-role\s*=\s*["']cluster-h1["']/g)].length;
  if (roleH1 !== 1) errors.push(`E-COMP-H1 composite must carry exactly one cluster-h1 role (found ${roleH1})`);
  for (const [iid, g] of Object.entries(groups)) {
    if (/data-layout-role\s*=\s*["'](cluster-h1|page-title-header)["']/.test(g.body))
      errors.push(`E-COMP-H1 instance "${iid}" carries a page-heading role — module headings stay at section scale`);
  }
  // supporting measurement (advisory): how many texts carry an H1-scale font-size — recorded, not adjudicated
  const h1Scale = [...svg.matchAll(/<text[^>]*font-size\s*=\s*["'](2[89]|[3-9]\d)/g)].length;
  if (roleH1 === 1 && h1Scale > 1) errors.push(`E-COMP-H1 ${h1Scale - 1} module text(s) at H1 scale (>=28px) compete with the page H1 — keep module headings at section scale`);
  // required fields of the budget receipt
  const BK = ["h1Count", "h1ScaleTexts", "note"];
  for (const k of BK) if (!(k in (receipt.budget ?? {}))) errors.push(`E-COMP-SCHEMA receipt.budget missing "${k}"`);
  const receiptOut = { schemaVersion: 1, command: "compose-verify", file: path.basename(svgPath), instances: domOrder.length,
    textRuntime: opts.noBrowser ? "static-only (explicit --no-browser) — NOT full verification" : "browser re-measured", errors };
  if (opts.json) console.log(JSON.stringify(receiptOut, null, 1));
  else {
    console.log(`verify ${path.basename(svgPath)} — instances ${domOrder.length}, ${errors.length} error(s)${opts.noBrowser ? " [static-only — bounded, not acceptance-grade]" : ""}`);
    for (const e of errors) console.log(`  ERROR ${e}`);
  }
  // exit contract: 0 = fully verified success (browser included) / 1 = error / 3 = static-only bounded (not a success)
  process.exit(errors.length ? 1 : opts.noBrowser ? 3 : 0);
}

// ---------- CLI (entrypoint guard: never runs on import — realpath parity) ----------
import { realpathSync } from "node:fs";
function isEntrypoint() {
  if (!process.argv[1]) return false;
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return import.meta.url === pathToFileURL(process.argv[1] ?? "").href; }
}
if (isEntrypoint()) {
preflight({ entrypointUrl: import.meta.url });
const argv = process.argv.slice(2);
const cmd = argv[0];
const files = argv.slice(1).filter((a) => !a.startsWith("--"));
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const KNOWN = ["--fragments", "--out", "--receipt", "--plan", "--manifest", "--json", "--no-browser"];
// A package-owned lookup (the manifest) is containment-checked at resolve time — plan, fragment
// and out are user input and so are not subjects of that check (input is bound by digest instead).
for (const a of argv.filter((x) => x.startsWith("--"))) if (!KNOWN.includes(a)) { console.error(`unknown option for compose: ${a}`); process.exit(2); }
const defaultManifest = path.resolve(here, "..", "references", "types", "manifest.yaml");
const manifestPath = guardPackagePath(opt("manifest", defaultManifest), "composition manifest");
if (cmd === "plan") {
  const { errors } = validatePlan(files[0], manifestPath);
  if (errors.length) { console.log(`plan — ${errors.length} error(s)`); for (const e of errors) console.log(`  ERROR ${e}`); process.exit(1); }
  console.log("plan — 0 error(s)");
  process.exit(0);
} else if (cmd === "compose") {
  compose(files[0], { fragments: opt("fragments"), out: opt("out"), receipt: opt("receipt"), manifest: manifestPath });
} else if (cmd === "verify") {
  verify(files[0], { receipt: opt("receipt"), plan: opt("plan"), manifest: manifestPath, json: argv.includes("--json"), noBrowser: argv.includes("--no-browser") });
} else {
  console.error("usage: compose.mjs plan|compose|verify ...");
  process.exit(2);
}
}
