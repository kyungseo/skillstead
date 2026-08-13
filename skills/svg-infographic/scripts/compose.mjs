#!/usr/bin/env node
// compose.mjs — composition contract tooling (design-kernel composition 계약).
//
// Three schemas, three commands (수명·소유자 분리 — 혼합 금지):
//   plan    <plan.yaml>                 Composition Plan v1 검증 (scene 저작 문서)
//   compose <plan.yaml> --fragments <dir> --out <svg> [--receipt <json>]
//                                       translation-only 배치 + namespace rewrite +
//                                       Composition Receipt v1 산출 (needs-split은
//                                       exit 3 non-success)
//   verify  <composite.svg> --receipt <json> --plan <plan.yaml>
//                                       최종 SVG를 재측정해 receipt와 대조 —
//                                       receipt가 source만 보고 꾸며낸 값이면 fail
//
// 경계(CP1 provable subset):
//   - layout_template: vertical-stack 고정 (slot-a=top, slot-b=bottom)
//   - 변환: translation-only, scale=1 — scale/rotate/skew는 거부
//   - bounded composition: primary 정확히 1 + supporting 1..2, nested 거부
//   - semantic binding은 선 없는 대응(번호/label), connector_edge만 port routing
//   - identity: instance 간 skin/typography/pageFrame/kernel/iconSet 동일성 검사
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skinCli = path.join(here, "skin.mjs");
const sha16 = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

// ---------- minimal YAML (skin.mjs와 동일 subset: nested maps, lists, inline map/array) ----------
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
    "header", "instances", "semantic_bindings", "binding_complete_over", "connector_edges", "reading_order", "traversal"];
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
  // bounded composition: primary 정확히 1 + supporting 1..2
  if (primary !== 1) errors.push(`plan: exactly one primary instance is required (got ${primary})`);
  if (supporting < 1 || supporting > 2) errors.push(`plan: supporting instances must be 1..2 (got ${supporting}) — a lone primary needs no composition; more modules need an owner gate`);
  if (tmpl) {
    for (const sid of Object.keys(plan.slots ?? {})) if (!tmpl.slots[sid]) errors.push(`plan: slot "${sid}" is not defined by template "${plan.layout_template}"`);
  }
  // semantic bindings — 선 없는 대응
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
  // connector edges — port 참조 구조 검증 (호환·anchor는 compose/receipt 단계)
  for (const e of plan.connector_edges ?? []) {
    for (const end of ["from", "to"]) {
      const ref = e[end];
      if (!ref || !ids.has(ref.instance_id)) errors.push(`plan: connector edge ${end} references unknown instance`);
      if (!ref?.port) errors.push(`plan: connector edge ${end} missing port id`);
    }
  }
  // reading order — instance 집합과 정확히 일치
  const ro = plan.reading_order ?? [];
  if (ro.length !== ids.size || ro.some((r) => !ids.has(r)) || new Set(ro).size !== ro.length)
    errors.push(`plan: reading_order must list every instance exactly once`);
  if (!["explicit", "row-major", "column-major"].includes(plan.traversal)) errors.push(`plan: traversal must be explicit|row-major|column-major`);
  return { plan, planDigest, errors };
}

// ---------- geometry helpers (provable subset: rect/circle + stroke/2) ----------
// CP1 지원 geometry: rect, circle, line, path(M/L/H/V 절대좌표). text/tspan은 정적
// 파서로 증명 불가 — browser 측정 bounds(evidence)를 opts.textBoxes로 받아 union하며,
// evidence 없이 text가 존재하면 명시적 오류다. fragment 내부의 transform은 종류를
// 불문하고 fail-closed다(instance wrapper의 translate는 caller가 벗겨서 전달).
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
      // text 하위 — text 단위 evidence로 커버
    } else if (["g", "title", "desc"].includes(name)) {
      // 허용 컨테이너/메타 (transform은 위에서 전면 거부)
    } else {
      errors.push(`<${name}> is outside the CP1 provable fragment subset`);
    }
  }
  // text evidence 대조: 존재하는 text 수와 측정 evidence 수가 일치해야 하며,
  // evidence가 없으면 unverified 명시 실패다
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
      .filter(([k]) => !k.startsWith("data-"))   // namespace prefix 차이는 배치가 아님
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
  // id 선언 (양쪽 quote·spaced =)
  body = body.replace(/\bid\s*=\s*("([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)')/g, (mm, q, d, sq) => `id="${ren(d ?? sq)}"`);
  // url(#…)
  body = body.replace(/url\(#([A-Za-z0-9_-]+)\)/g, (mm, id) => ids.has(id) ? `url(#${ren(id)})` : mm);
  // href / xlink:href
  body = body.replace(/\b(xlink:href|href)\s*=\s*("#([A-Za-z0-9_-]+)"|'#([A-Za-z0-9_-]+)')/g,
    (mm, attr, q, d, sq) => { const id = d ?? sq; return ids.has(id) ? `${attr}="#${ren(id)}"` : mm; });
  // 복수 ID ARIA references
  body = body.replace(/\b(aria-labelledby|aria-describedby)\s*=\s*("([^"]*)"|'([^']*)')/g,
    (mm, attr, q, d, sq) => `${attr}="${(d ?? sq).split(/\s+/).filter(Boolean).map((id) => ids.has(id) ? ren(id) : id).join(" ")}"`);
  // layout/cluster/port/entity 참조 계열 (quote·spacing 중립)
  body = body.replace(/data-(layout-container|layout-parent|layout-item|layout-group|cluster-id|cluster|layout-title|comp-entity|comp-port)\s*=\s*("([^"]+)"|'([^']+)')/g,
    (mm, k, q, d, sq) => `data-${k}="${prefix}-${d ?? sq}"`);
  return body;
}
// rewrite 이후: dangling reference와 duplicate id는 조립 오류다
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

// ---------- compose ----------
function compose(planPath, opts) {
  const { plan, planDigest, errors } = validatePlan(planPath, opts.manifest);
  if (errors.length) { for (const e of errors) console.error(`  ERROR ${e}`); process.exit(1); }
  const fragDir = opts.fragments;
  const pf = JSON.parse(spawnSync(process.execPath, [skinCli, "pageframe", plan.page.preset,
    ...(plan.page.support && plan.page.support !== "none" ? ["--support", plan.page.support] : []), "--json"],
    { encoding: "utf8" }).stdout);
  const cb = pf.regions.contentBox;
  // vertical-stack: slot 예산은 contentBox와 정확히 일치해야 한다 (fail-closed)
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
    // variant 선택: base가 slot에 맞지 않으면 manifest 선언 variants 순서로 시도 — Composition이 선택
    const tryVariants = [inst.variant ?? "base"];
    const packs = loadManifest(opts.manifest, []);
    for (const v of packs?.[inst.typepack]?.composition?.variants ?? []) if (!tryVariants.includes(v.id)) tryVariants.push(v.id);
    let chosen = null;
    for (const variant of tryVariants) {
      const stem = variant === "base" ? inst.typepack : `${inst.typepack}.${variant}`;
      const svgP = path.join(fragDir, `${stem}.svg`), rcpP = path.join(fragDir, `${stem}.receipt.json`);
      let frag, rcp;
      try { frag = readFileSync(svgP, "utf8"); rcp = JSON.parse(readFileSync(rcpP, "utf8")); } catch { continue; }
      if (rcp.usedBounds.w <= slot.w && rcp.usedBounds.h <= slot.h) { chosen = { variant, frag, rcp, svgP }; break; }
    }
    if (!chosen) {
      status = "needs-split";
      problems.push(`instance "${inst.instance_id}": no declared variant fits slot ${inst.slot_id} (${slotRects[inst.slot_id].w}x${slotRects[inst.slot_id].h}) — recommend splitting into a separate page`);
      continue;
    }
    const { variant, frag, rcp } = chosen;
    // fragment 계약: page 요소(header-cluster 등) 금지
    if (/data-layout-role\s*=\s*["']header-cluster["']/.test(frag)) { problems.push(`instance "${inst.instance_id}": fragment contains page header elements — fragments own only their local topology`); continue; }
    // receipt 무결성: sourceDigest 대조 + usedBounds 재측정 대조 (stale/조작 receipt 차단)
    const fragSha = createHash("sha256").update(frag).digest("hex").slice(0, 16);
    if (rcp.sourceDigest && rcp.sourceDigest !== fragSha) { problems.push(`instance "${inst.instance_id}": fragment sourceDigest mismatch (receipt ${rcp.sourceDigest}, file ${fragSha})`); continue; }
    if (!rcp.sourceDigest) { problems.push(`instance "${inst.instance_id}": fragment receipt missing sourceDigest`); continue; }
    const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
    // text bounds evidence: 방식·입력 digest·내용 digest가 fragment와 묶여야 한다(stale 거부)
    const fragTextCount = [...body.matchAll(/<text[\s>]/g)].length;
    if (fragTextCount === 0) {
      // text-free fragment 계약: textDigest/textMarkupDigest/textMeasure = null, textBounds = []
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
    // port 계약 완결(R1-P4): capability 대조·유일성·cardinality·anchor·normal
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
    // translation-only 배치: 수평 중앙, 상단 정렬
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
  // semantic binding: endpoint entity가 실제 fragment receipt entities에 존재해야 한다(R1-P2)
  const entByInstance = Object.fromEntries(recInstances.map((r) => [r.instance_id, new Set(r.entities)]));
  for (const b of plan.semantic_bindings ?? []) {
    for (const e of b.endpoints ?? []) {
      const set = entByInstance[e.instance_id];
      if (set && !set.has(e.entity_id))
        problems.push(`binding "${b.key}": entity "${e.entity_id}" does not exist in instance "${e.instance_id}" (ghost endpoint)`);
    }
  }
  // 선언된 완전성: binding_complete_over에 오른 instance는 전 entity가 최소 1개 binding에 참여
  for (const covId of plan.binding_complete_over ?? []) {
    const set = entByInstance[covId];
    if (!set) continue;
    const bound = new Set((plan.semantic_bindings ?? []).flatMap((b) => b.endpoints.filter((e) => e.instance_id === covId).map((e) => e.entity_id)));
    for (const ent of set) if (!bound.has(ent) && ent !== "root")
      problems.push(`binding coverage: entity "${ent}" of "${covId}" is not bound — declared complete coverage is missing a pair`);
  }
  // identity 동일성 (instance 간)
  const idents = recInstances.map((r) => JSON.stringify(r.identity));
  const identityConsistent = idents.length > 0 && idents.every((x) => x === idents[0]);
  if (!identityConsistent && recInstances.length) problems.push("identity digests differ across instances — all modules must share one skin/typography/pageframe/kernel contract");
  // connector edges (micro-fixture 경로): port 존재·kind/direction 호환 + 세로 corridor 검증
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
  // 한 port는 CP1에서 edge 1개까지만 사용한다
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pf.canvas.width} ${pf.canvas.height}" width="${pf.canvas.width}" height="${pf.canvas.height}" role="img"
  style="font-family:Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <title>${hdr.h1 ?? plan.id}</title>
  <desc>Composite scene (${plan.layout_template}): ${plan.instances.map((i) => i.typepack).join(" + ")}.</desc>
  <defs>
    <marker id="comp-ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="11.25" markerHeight="11.25" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M2 2 L10 6 L2 10" fill="none" data-stroke-role="edge-line" stroke="#2E6DA4" stroke-width="2" stroke-linecap="round"/></marker>
  </defs>
  <rect data-fill-role="canvas" fill="#F7F7F5" width="${pf.canvas.width}" height="${pf.canvas.height}"/>
  <g data-layout-role="header-cluster" data-layout-content-top="${cb.y + 14}" data-layout-breathing="36" data-layout-tolerance="2">
    ${hdr.eyebrow ? `<rect data-layout-role="cluster-locator" data-fill-role="focus" x="40" y="48" width="8" height="8" rx="2" fill="#2E6DA4"/>
    <text data-layout-role="cluster-eyebrow" data-fill-role="muted" x="56" y="56" font-size="14" font-weight="700" letter-spacing="0.10em" fill="#636A75" dominant-baseline="central">${hdr.eyebrow}</text>` : ""}
    <text data-layout-role="cluster-h1" data-fill-role="ink" x="40" y="92" font-size="28" font-weight="700" fill="#252B35" dominant-baseline="central">${hdr.h1 ?? plan.id}</text>
    ${hdr.subtitle ? `<text data-layout-role="cluster-subtitle" data-fill-role="muted" x="40" y="124" font-size="14" fill="#636A75" dominant-baseline="central">${hdr.subtitle}</text>` : ""}
  </g>
  ${bodies.join("\n  ")}
</svg>`;
  // namespace rewrite 이후 dangling reference·duplicate id는 조립 실패다 (최종 SVG 기준)
  for (const re of checkRefs(svg)) { problems.push(`assembly: ${re}`); if (status === "ok") status = "invalid"; }
  const receipt = { schemaVersion: 1, kind: "composition-receipt", planId: plan.id, planDigest,
    layoutTemplate: plan.layout_template, page: { preset: plan.page.preset, canvas: pf.canvas },
    resolvedSlots: slotRects, slotGap: gap, instances: recInstances, connectorEdges: edges,
    semanticBindings: plan.semantic_bindings ?? [], readingOrder: plan.reading_order,
    identityConsistent, status, problems,
    budget: { h1Count: 1, h1ScaleTexts: 1, note: "focal/tint/connector 집계는 measured/advisory — threshold 미정의(계약)" } };
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
  // Receipt v1 strict schema — receipt의 어떤 필드도 무검증 신뢰하지 않는다(R1-P1)
  const RK = ["schemaVersion", "kind", "planId", "planDigest", "layoutTemplate", "page", "resolvedSlots",
    "slotGap", "instances", "connectorEdges", "semanticBindings", "readingOrder", "identityConsistent",
    "status", "problems", "budget"];
  for (const k of Object.keys(receipt)) if (!RK.includes(k)) errors.push(`E-COMP-SCHEMA receipt unknown field "${k}"`);
  for (const k of RK) if (!(k in receipt)) errors.push(`E-COMP-SCHEMA receipt missing field "${k}"`);
  if (receipt.schemaVersion !== 1 || receipt.kind !== "composition-receipt") errors.push("E-COMP-SCHEMA receipt identity invalid");
  if (receipt.status !== "ok" || (receipt.problems ?? []).length) errors.push(`E-COMP-STATUS receipt status "${receipt.status}" with ${receipt.problems?.length ?? 0} problem(s) — only clean ok passes verify`);
  // planDigest는 plan 파일에서 재계산해 대조
  if (receipt.planDigest !== livePlanDigest) errors.push(`E-COMP-FORGED receipt planDigest ${receipt.planDigest} != recomputed ${livePlanDigest}`);
  // slots/page는 Plan+PageFrame에서 재계산해 대조
  if (plan) {
    const pfR = JSON.parse(spawnSync(process.execPath, [skinCli, "pageframe", plan.page.preset,
      ...(plan.page.support && plan.page.support !== "none" ? ["--support", plan.page.support] : []), "--json"], { encoding: "utf8" }).stdout);
    const cbR = pfR.regions.contentBox;
    const ha = Number(plan.slots["slot-a"].height), hb = Number(plan.slots["slot-b"].height), gap = Number(plan.slot_gap ?? 24);
    const expectSlots = { "slot-a": { x: cbR.x, y: cbR.y, w: cbR.w, h: ha }, "slot-b": { x: cbR.x, y: cbR.y + ha + gap, w: cbR.w, h: hb } };
    if (JSON.stringify(expectSlots) !== JSON.stringify(receipt.resolvedSlots)) errors.push("E-COMP-FORGED receipt resolvedSlots != recomputed from plan + pageframe");
    if (JSON.stringify(pfR.canvas) !== JSON.stringify(receipt.page?.canvas)) errors.push("E-COMP-FORGED receipt page.canvas != pageframe receipt");
  }
  // live SSoT digest 대조 — 서로 같기만 한 가짜 digest를 거부(R1-P1)
  const live = {};
  try {
    const rj = JSON.parse(spawnSync(process.execPath, [skinCli, "resolve", "current", "--mode", "light", "--json"], { encoding: "utf8" }).stdout);
    const pj = JSON.parse(spawnSync(process.execPath, [skinCli, "pageframe", "social-4x5", "--json"], { encoding: "utf8" }).stdout);
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
  // instance receipt nested strict schema (P1-1) — 필드 삭제로 검사를 무력화할 수 없다
  const IK = ["instance_id", "typepack", "variant", "module_role", "slot_id", "translate",
    "usedBounds", "ports", "entities", "identity", "degrade", "textDigest", "textMarkupDigest",
    "textBounds", "textMeasure"];
  for (const inst of receipt.instances ?? []) {
    const ctx = `instance "${inst.instance_id ?? "?"}"`;
    for (const k of Object.keys(inst)) if (!IK.includes(k)) errors.push(`E-COMP-SCHEMA ${ctx} unknown field "${k}"`);
    for (const k of IK) if (!(k in inst)) errors.push(`E-COMP-SCHEMA ${ctx} missing field "${k}"`);
  }
  // receipt instance 집합 = plan 집합 (svg 집합 대조는 아래 domOrder 검사와 합쳐 3-way)
  const rIds = (receipt.instances ?? []).map((r) => r.instance_id);
  const pIds = (plan?.instances ?? []).map((i) => i.instance_id);
  for (const id of pIds) if (!rIds.includes(id)) errors.push(`E-COMP-MISSING receipt drops instance "${id}" declared in the plan`);
  for (const id of rIds) if (!pIds.includes(id)) errors.push(`E-COMP-EXTRA receipt contains undeclared instance "${id}"`);
  // instance group 추출 + DOM 순서
  const domOrder = [];
  const groups = {};
  const re = /<g data-comp-instance="([a-z0-9-]+)" data-comp-slot="([a-z0-9-]+)" transform="translate\((-?[\d.]+),(-?[\d.]+)\)(?:[^)]*)\)?">/g;
  let m2;
  const idxs = [];
  while ((m2 = re.exec(svg))) { domOrder.push(m2[1]); idxs.push({ id: m2[1], slot: m2[2], dx: Number(m2[3]), dy: Number(m2[4]), start: m2.index }); }
  // slice 경계: 다음 comp group(instance 또는 connectors) 또는 문서 끝
  const boundaries = [...svg.matchAll(/<g data-comp-(?:instance|connectors)/g)].map((b) => b.index);
  for (let i = 0; i < idxs.length; i++) {
    const nb = boundaries.find((b) => b > idxs[i].start);
    const end = nb ?? svg.length;
    groups[idxs[i].id] = { ...idxs[i], body: svg.slice(idxs[i].start, end) };
  }
  // translation-only 강제: instance transform에 scale/rotate가 섞이면 거부
  for (const g of svg.matchAll(/<g data-comp-instance="[a-z0-9-]+"[^>]*transform="([^"]+)"/g)) {
    if (!/^translate\(-?[\d.]+,-?[\d.]+\)$/.test(g[1])) errors.push(`E-COMP-TRANSFORM instance transform must be translation-only (got "${g[1]}")`);
  }
  const planIds = (plan?.instances ?? []).map((i) => i.instance_id);
  for (const id of planIds) if (!groups[id]) errors.push(`E-COMP-MISSING instance "${id}" declared in the plan is absent from the composite`);
  for (const id of domOrder) if (!planIds.includes(id)) errors.push(`E-COMP-EXTRA composite contains undeclared instance "${id}"`);
  if (new Set(domOrder).size !== domOrder.length) errors.push("E-COMP-DUP duplicate instance groups in the composite");
  // usedBounds: receipt 값이 아니라 최종 SVG에서 재측정 — receipt 조작 방지
  for (const inst of receipt.instances ?? []) {
    const g = groups[inst.instance_id];
    if (!g) continue;
    const innerBody = g.body.replace(/^<g data-comp-instance[^>]*>/, "");
    const compositeTextCount = [...innerBody.matchAll(/<text[\s>]/g)].length;
    if (compositeTextCount === 0) {
      // text-free instance 계약: 정확히 이 null 조합만 허용 (release-blocking P2)
      const wantNull = { textDigest: inst.textDigest, textMarkupDigest: inst.textMarkupDigest, textMeasure: inst.textMeasure };
      for (const [k, v] of Object.entries(wantNull))
        if (v != null) errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" has no text but "${k}" is ${JSON.stringify(v)} — text-free instances must record null`);
      if (!Array.isArray(inst.textBounds) || inst.textBounds.length !== 0)
        errors.push(`E-COMP-SCHEMA instance "${inst.instance_id}" has no text but textBounds is not []`);
    }
    if (compositeTextCount > 0) {
      // text 보유 instance: evidence 전 필드 필수 — 삭제/공백은 schema error (P1-1)
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
    // composite text 내용·배치가 evidence와 일치해야 한다 (조작·교체 거부)
    if (inst.textDigest && textDigestOf(innerBody) !== inst.textDigest)
      errors.push(`E-COMP-RECEIPT-TEXT instance "${inst.instance_id}" text content digest ${textDigestOf(innerBody)} != receipt ${inst.textDigest} — text was altered after measurement`);
    if (inst.textMarkupDigest && textMarkupDigestOf(innerBody) !== inst.textMarkupDigest)
      errors.push(`E-COMP-RECEIPT-TEXT instance "${inst.instance_id}" text markup digest mismatch — text placement/typography changed after measurement (x/y/font/anchor/tspan)`);
    // textBounds는 이미 전역 좌표(compose가 translate 반영) — local 합산을 위해 역변환
    const localTextBoxes = (inst.textBounds ?? []).map((b) => ({ x: b.x - g.dx, y: b.y - g.dy, w: b.w, h: b.h }));
    const mm2 = measuredBoundsStrict(innerBody, { textBoxes: localTextBoxes });
    for (const ge of mm2.errors) errors.push(`E-COMP-UNVERIFIED-GEOM instance "${inst.instance_id}": ${ge}`);
    const local = mm2.bounds;
    if (!local) { errors.push(`E-COMP-UNMEASURABLE instance "${inst.instance_id}" has no provable geometry`); continue; }
    const meas = { x: round1(local.x + 0), y: round1(local.y + 0), w: round1(local.w), h: round1(local.h) };
    // group body 좌표는 로컬(fragment) 좌표 + translate — 측정에 translate 반영
    const tx = { x: round1(local.x + g.dx), y: round1(local.y + g.dy), w: round1(local.w), h: round1(local.h) };
    const rb = inst.usedBounds;
    if (Math.abs(tx.x - rb.x) > 1 || Math.abs(tx.y - rb.y) > 1 || Math.abs(tx.w - rb.w) > 1 || Math.abs(tx.h - rb.h) > 1)
      errors.push(`E-COMP-RECEIPT instance "${inst.instance_id}" measured bounds ${JSON.stringify(tx)} != receipt ${JSON.stringify(rb)} — receipts must reflect the artifact, not the plan`);
    const slot = receipt.resolvedSlots[inst.slot_id];
    if (tx.x < slot.x - 0.5 || tx.y < slot.y - 0.5 || tx.x + tx.w > slot.x + slot.w + 0.5 || tx.y + tx.h > slot.y + slot.h + 0.5)
      errors.push(`E-COMP-BOUNDS instance "${inst.instance_id}" used bounds escape slot ${inst.slot_id}`);
  }
  // slot 간 overlap 금지
  const sr = Object.entries(receipt.resolvedSlots ?? {});
  for (let i = 0; i < sr.length; i++) for (let j = i + 1; j < sr.length; j++) {
    const [aId, a] = sr[i], [bId, b] = sr[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      errors.push(`E-COMP-OVERLAP slots ${aId} and ${bId} overlap`);
  }
  // reading order: traversal=explicit → DOM 순서가 선언과 일치
  if (plan?.traversal === "explicit") {
    const ro = plan.reading_order ?? [];
    if (JSON.stringify(domOrder) !== JSON.stringify(ro))
      errors.push(`E-COMP-ORDER DOM order [${domOrder.join(", ")}] != declared reading_order [${ro.join(", ")}]`);
  }
  // entity 집합: 최종 SVG의 data-comp-entity가 receipt entities와 1:1 (R1-P2)
  for (const inst of receipt.instances ?? []) {
    const g = groups[inst.instance_id];
    if (!g) continue;
    const found = new Set([...g.body.matchAll(/data-comp-entity\s*=\s*(?:"([^"]+)"|'([^']+)')/g)].map((mm) => (mm[1] ?? mm[2]).replace(`${inst.instance_id}-`, "")));
    for (const ent of inst.entities ?? []) if (!found.has(ent)) errors.push(`E-COMP-ENTITY instance "${inst.instance_id}" entity "${ent}" missing from the composite`);
    for (const ent of found) if (!(inst.entities ?? []).includes(ent)) errors.push(`E-COMP-ENTITY composite carries undeclared entity "${ent}" in "${inst.instance_id}"`);
  }
  // identity 동일성
  if (receipt.identityConsistent === false) errors.push("E-COMP-IDENTITY receipt reports inconsistent module identities");
  const idents = (receipt.instances ?? []).map((r) => JSON.stringify(r.identity));
  if (idents.length && !idents.every((x) => x === idents[0])) errors.push("E-COMP-IDENTITY module identity digests differ");
  // duplicate SVG id 전역
  const seen = new Map();
  for (const mm of svg.matchAll(/id\s*=\s*"([A-Za-z0-9_-]+)"/g)) seen.set(mm[1], (seen.get(mm[1]) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) errors.push(`E-COMP-DUPID svg id "${id}" appears ${n} times`);
  // 최종 composite text runtime 재측정 (기본 on — 가장 정직한 binding; 상속 스타일까지 커버)
  if (!opts.noBrowser) {
    const mtCli = process.env.COMPOSE_TEXT_MEASURE_CLI ?? path.join(here, "measure-text.mjs");
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
  // page budget machine gate(R1-P2p): semantic role 기반 H1 정확히 1 — header 소유
  const roleH1 = [...svg.matchAll(/data-layout-role\s*=\s*["']cluster-h1["']/g)].length;
  if (roleH1 !== 1) errors.push(`E-COMP-H1 composite must carry exactly one cluster-h1 role (found ${roleH1})`);
  for (const [iid, g] of Object.entries(groups)) {
    if (/data-layout-role\s*=\s*["'](cluster-h1|page-title-header)["']/.test(g.body))
      errors.push(`E-COMP-H1 instance "${iid}" carries a page-heading role — module headings stay at section scale`);
  }
  // 보조 측정(advisory): H1급 font-size 텍스트 수 — 판정이 아니라 기록
  const h1Scale = [...svg.matchAll(/<text[^>]*font-size\s*=\s*["'](2[89]|[3-9]\d)/g)].length;
  if (roleH1 === 1 && h1Scale > 1) errors.push(`E-COMP-H1 ${h1Scale - 1} module text(s) at H1 scale (>=28px) compete with the page H1 — keep module headings at section scale`);
  // budget receipt 필수 field
  const BK = ["h1Count", "h1ScaleTexts", "note"];
  for (const k of BK) if (!(k in (receipt.budget ?? {}))) errors.push(`E-COMP-SCHEMA receipt.budget missing "${k}"`);
  const receiptOut = { schemaVersion: 1, command: "compose-verify", file: path.basename(svgPath), instances: domOrder.length,
    textRuntime: opts.noBrowser ? "static-only (explicit --no-browser) — NOT full verification" : "browser re-measured", errors };
  if (opts.json) console.log(JSON.stringify(receiptOut, null, 1));
  else {
    console.log(`verify ${path.basename(svgPath)} — instances ${domOrder.length}, ${errors.length} error(s)${opts.noBrowser ? " [static-only — bounded, not acceptance-grade]" : ""}`);
    for (const e of errors) console.log(`  ERROR ${e}`);
  }
  // exit 계약: 0 = 완전 검증 성공(browser 포함) · 1 = 오류 · 3 = static-only bounded(비성공)
  process.exit(errors.length ? 1 : opts.noBrowser ? 3 : 0);
}

// ---------- CLI (entrypoint guard: import 시 실행 금지 — realpath parity) ----------
import { realpathSync } from "node:fs";
function isEntrypoint() {
  if (!process.argv[1]) return false;
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return import.meta.url === pathToFileURL(process.argv[1] ?? "").href; }
}
if (isEntrypoint()) {
const argv = process.argv.slice(2);
const cmd = argv[0];
const files = argv.slice(1).filter((a) => !a.startsWith("--"));
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const KNOWN = ["--fragments", "--out", "--receipt", "--plan", "--manifest", "--json", "--no-browser"];
for (const a of argv.filter((x) => x.startsWith("--"))) if (!KNOWN.includes(a)) { console.error(`unknown option for compose: ${a}`); process.exit(2); }
const defaultManifest = path.resolve(here, "..", "references", "types", "manifest.yaml");
if (cmd === "plan") {
  const { errors } = validatePlan(files[0], opt("manifest", defaultManifest));
  if (errors.length) { console.log(`plan — ${errors.length} error(s)`); for (const e of errors) console.log(`  ERROR ${e}`); process.exit(1); }
  console.log("plan — 0 error(s)");
  process.exit(0);
} else if (cmd === "compose") {
  compose(files[0], { fragments: opt("fragments"), out: opt("out"), receipt: opt("receipt"), manifest: opt("manifest", defaultManifest) });
} else if (cmd === "verify") {
  verify(files[0], { receipt: opt("receipt"), plan: opt("plan"), manifest: opt("manifest", defaultManifest), json: argv.includes("--json"), noBrowser: argv.includes("--no-browser") });
} else {
  console.error("usage: compose.mjs plan|compose|verify ...");
  process.exit(2);
}
}
