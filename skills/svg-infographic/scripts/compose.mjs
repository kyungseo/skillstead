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
    "header", "instances", "semantic_bindings", "connector_edges", "reading_order", "traversal"];
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
function measuredBounds(svgBody) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const m of svgBody.matchAll(/<(rect|circle)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g)) {
    const a = Object.fromEntries([...m[2].matchAll(/([A-Za-z-]+)\s*=\s*"([^"]*)"/g)].map((mm) => [mm[1], mm[2]]));
    const sw = (Number(a["stroke-width"]) || 0) / 2;
    let bx1, by1, bx2, by2;
    if (m[1] === "rect") {
      bx1 = Number(a.x || 0); by1 = Number(a.y || 0);
      bx2 = bx1 + Number(a.width || 0); by2 = by1 + Number(a.height || 0);
    } else {
      const cx = Number(a.cx || 0), cy = Number(a.cy || 0), r = Number(a.r || 0);
      bx1 = cx - r; by1 = cy - r; bx2 = cx + r; by2 = cy + r;
    }
    x1 = Math.min(x1, bx1 - sw); y1 = Math.min(y1, by1 - sw);
    x2 = Math.max(x2, bx2 + sw); y2 = Math.max(y2, by2 + sw);
  }
  if (!Number.isFinite(x1)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
const round1 = (v) => Math.round(v * 10) / 10;

function namespaceBody(body, prefix) {
  for (const idm of new Set([...body.matchAll(/id\s*=\s*"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]))) {
    body = body.replaceAll(`id="${idm}"`, `id="${prefix}-${idm}"`)
      .replaceAll(`url(#${idm})`, `url(#${prefix}-${idm})`)
      .replaceAll(`href="#${idm}"`, `href="#${prefix}-${idm}"`)
      .replaceAll(`aria-labelledby="${idm}"`, `aria-labelledby="${prefix}-${idm}"`);
  }
  body = body.replace(/data-(layout-container|layout-parent|layout-item|layout-group|cluster-id|cluster|layout-title|comp-entity)\s*=\s*"([^"]+)"/g,
    (mm, k, v) => `data-${k}="${prefix}-${v}"`);
  return body;
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
    // fragment는 page 요소를 포함하면 안 된다 (fragment contract)
    if (/data-layout-role\s*=\s*"header-cluster"|<svg[^>]*data-treatment/.test(frag) === false) { /* fragment root는 중립 — treatment는 composite가 소유 */ }
    const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
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
      degrade: variant === "base" ? null : { selectedVariant: variant, lost: rcp.degradeLost ?? "variant-declared reduction (see fragment receipt)" } });
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
    bodies.push(`<path d="M${from.anchor.x} ${from.anchor.y + 8} V${to.anchor.y - 8}" fill="none" data-stroke-role="edge-line" stroke="#2E6DA4" stroke-width="2.5" marker-end="url(#comp-ah)"/>`);
  }
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
  const receipt = { schemaVersion: 1, kind: "composition-receipt", planId: plan.id, planDigest,
    layoutTemplate: plan.layout_template, page: { preset: plan.page.preset, canvas: pf.canvas },
    resolvedSlots: slotRects, slotGap: gap, instances: recInstances, connectorEdges: edges,
    semanticBindings: plan.semantic_bindings ?? [], readingOrder: plan.reading_order,
    identityConsistent, status, problems,
    budget: { h1Count: 1, note: "focal/tint/connector 집계는 measured/advisory — threshold 미정의(계약)" } };
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
  const { plan, errors: pErr } = validatePlan(opts.plan, opts.manifest);
  errors.push(...pErr);
  // instance group 추출 + DOM 순서
  const domOrder = [];
  const groups = {};
  const re = /<g data-comp-instance="([a-z0-9-]+)" data-comp-slot="([a-z0-9-]+)" transform="translate\((-?[\d.]+),(-?[\d.]+)\)(?:[^)]*)\)?">/g;
  let m2;
  const idxs = [];
  while ((m2 = re.exec(svg))) { domOrder.push(m2[1]); idxs.push({ id: m2[1], slot: m2[2], dx: Number(m2[3]), dy: Number(m2[4]), start: m2.index }); }
  for (let i = 0; i < idxs.length; i++) {
    const end = i + 1 < idxs.length ? idxs[i + 1].start : svg.length;
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
    const local = measuredBounds(g.body);
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
  // identity 동일성
  if (receipt.identityConsistent === false) errors.push("E-COMP-IDENTITY receipt reports inconsistent module identities");
  const idents = (receipt.instances ?? []).map((r) => JSON.stringify(r.identity));
  if (idents.length && !idents.every((x) => x === idents[0])) errors.push("E-COMP-IDENTITY module identity digests differ");
  // duplicate SVG id 전역
  const seen = new Map();
  for (const mm of svg.matchAll(/id\s*=\s*"([A-Za-z0-9_-]+)"/g)) seen.set(mm[1], (seen.get(mm[1]) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) errors.push(`E-COMP-DUPID svg id "${id}" appears ${n} times`);
  // page budget machine gate: H1(>=28px) 정확히 1 — header 소유
  const h1s = [...svg.matchAll(/<text[^>]*font-size="(2[89]|[3-9]\d)"/g)].length;
  if (h1s !== 1) errors.push(`E-COMP-H1 composite must carry exactly one H1-scale text (found ${h1s}) — module headings stay at section scale`);
  const receiptOut = { schemaVersion: 1, command: "compose-verify", file: path.basename(svgPath), instances: domOrder.length, errors };
  if (opts.json) console.log(JSON.stringify(receiptOut, null, 1));
  else {
    console.log(`verify ${path.basename(svgPath)} — instances ${domOrder.length}, ${errors.length} error(s)`);
    for (const e of errors) console.log(`  ERROR ${e}`);
  }
  process.exit(errors.length ? 1 : 0);
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const files = argv.slice(1).filter((a) => !a.startsWith("--"));
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const KNOWN = ["--fragments", "--out", "--receipt", "--plan", "--manifest", "--json"];
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
  verify(files[0], { receipt: opt("receipt"), plan: opt("plan"), manifest: opt("manifest", defaultManifest), json: argv.includes("--json") });
} else {
  console.error("usage: compose.mjs plan|compose|verify ...");
  process.exit(2);
}
