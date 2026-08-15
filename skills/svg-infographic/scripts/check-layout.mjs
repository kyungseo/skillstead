#!/usr/bin/env node
// check-layout.mjs — generic layout contract guard (Wave 0 provable subset).
//
// Contracts, annotation-declared (design-kernel §7):
//  1. padded/nested titled container — geometric min padding + visual bounds
//     (rect + stroke/2 + conservative shadow range) with touch = hard error,
//     title reservation (`data-reserve-top`) excluded from content bounds and
//     collision-checked, symmetry judged on BOTH geometric and visual insets,
//     declared child count fail-closed, recursive.
//  2. repeated row/column distribution — equal-gap visual gap spread, uniform
//     item size, balanced outer insets, declared member count fail-closed.
//  3. atomic layout item (cluster) — a card is its frame plus declared
//     components (icon background, glyph anchor, text anchors); every supported
//     component's visual bounds/anchor must sit inside the item bounds and the
//     declared member count must match (a moved frame with a left-behind icon
//     circle is an error, not a pass).
//
// Annotation grammar:
//   containers: data-layout-container="<id>" data-min-pad data-layout-count
//               [data-min-visual-pad=8] [data-reserve-top=0] [data-reserve-left=0]
//               [data-symmetry=x|y|xy]
//               [data-symmetry-tol=4]        (min-pad and layout-count REQUIRED)
//   membership: data-layout-parent="<id>"
//   groups:     data-layout-group="<id>" data-distribution="equal-gap"
//               data-axis="x|y" data-group-count [data-gap-tol=1]
//               (distribution/axis/group-count REQUIRED); items: data-layout-item="<id>"
//   alignment:  data-align-row="<id>" data-align-row-count="<n>=2>" — same y, same height, fixed participant count
//               data-align-col="<id>" data-align-col-count="<n>=2>" — same x, same width, fixed participant count
//               (for cross-alignment spanning different containers only. Not a grid engine)
//   clusters:   item frame: data-cluster-id="<id>" data-cluster-count
//               components: data-cluster="<id>" on circle/rect (bounds) or
//               text/g/use (anchor point)
//   data-layout-unverified="reason"   explicit unverified classification (exit 3)
//
// Provable subset: rect/circle geometry with numeric attributes, translate-only
// ancestor transforms, feDropShadow / feDisplacementMap filters, text/g anchors.
// Anything else on a declared participant is an ERROR unless explicitly classified
// data-layout-unverified — never a silent pass (no-false-certainty).
// Exit: 0 clean · 1 contract errors · 2 usage · 3 unverified-only (explicit review
// state — canonical hard gates must NOT treat 3 as success).
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preflight } from "./preflight-lib.mjs";

const num = (v) => (v == null ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN);

function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g))
    o[m[1]] = m[3] !== undefined ? m[3] : m[4];
  return o;
}

// strict numeric field: required or optional-with-default; NaN/negative never slips through
function field(a, name, errors, ctx, { required = false, def = null } = {}) {
  if (!(name in a)) {
    if (required) { errors.push(`E-LAYOUT-SCHEMA ${ctx}: missing required "${name}"`); return null; }
    return def;
  }
  const v = num(a[name]);
  if (!Number.isFinite(v) || v < 0) { errors.push(`E-LAYOUT-SCHEMA ${ctx}: "${name}" must be a finite non-negative number (got "${a[name]}")`); return null; }
  return v;
}

function parseFilters(src) {
  const out = {};
  for (const m of src.matchAll(/<filter [^>]*id=("([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/filter>/g)) {
    const id = m[2] ?? m[3], body = m[4];
    const ds = body.match(/<feDropShadow[^>]*/);
    if (ds) {
      const a = attrs(ds[0]);
      const dx = num(a.dx) ?? 0, dy = num(a.dy) ?? 0, sd = num(a.stdDeviation) ?? 0;
      out[id] = { left: 3 * sd + Math.max(0, -dx), right: 3 * sd + Math.max(0, dx),
                  top: 3 * sd + Math.max(0, -dy), bottom: 3 * sd + Math.max(0, dy) };
      continue;
    }
    const dm = body.match(/<feDisplacementMap[^>]*/);
    if (dm) {
      const s = num(attrs(dm[0]).scale) ?? 0;
      out[id] = { left: s, right: s, top: s, bottom: s };
      continue;
    }
    out[id] = null; // unknown filter — unverified for declared participants
  }
  return out;
}

export function checkLayoutFile(file) {
  const src = readFileSync(file, "utf8");
  const errors = [], unverified = [];
  const filters = parseFilters(src);
  const stack = [];
  const els = [];
  for (const m of src.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    const [, close, name, rawAttrs, self] = m;
    if (close) { if (name === "g") stack.pop(); continue; }
    const a = attrs(rawAttrs);
    let tx = stack.reduce((s, f) => s + f.tx, 0), ty = stack.reduce((s, f) => s + f.ty, 0);
    let broken = stack.some((f) => f.broken);
    // Translate-only is the rule; for anchor participants (text/g/use) the origin is independent of
    // scale, so translate+scale is provable too
    const anchorKind = name === "text" || name === "g" || name === "use";
    const tRe = anchorKind
      ? /^\s*translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)(?:\s*scale\([\d. ]+\))?\s*$/
      : /^\s*translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)\s*$/;
    const tm = a.transform != null ? a.transform.match(tRe) : null;
    if (a.transform != null && !tm) broken = true;
    if (name === "g" && !self) stack.push({ tx: tm ? Number(tm[1]) : 0, ty: tm ? Number(tm[2]) : 0, broken: a.transform != null && !tm });
    const declared = a["data-layout-container"] || a["data-layout-parent"] || a["data-layout-item"]
      || a["data-layout-group"] || a["data-cluster-id"] || a["data-cluster"] || a["data-layout-title"]
      || a["data-align-row"] || a["data-align-col"];
    if (!declared) continue;
    if (a["data-layout-unverified"] != null) {
      unverified.push({ id: declared, reason: a["data-layout-unverified"] });
      els.push({ a, name, uv: true });  // counted as a declared member, but its geometry check stays in an explicit review state
      continue;
    }
    if (tm) { tx += Number(tm[1]); ty += Number(tm[2]); }
    const el = { a, name };
    let g = null;
    if (name === "rect") {
      const x = num(a.x) ?? 0, y = num(a.y) ?? 0, w = num(a.width), h = num(a.height);
      if ([x, y, w, h].every(Number.isFinite)) g = { x: x + tx, y: y + ty, w, h };
    } else if (name === "circle") {
      const cx = num(a.cx), cy = num(a.cy), r = num(a.r);
      if ([cx, cy, r].every(Number.isFinite)) g = { x: cx - r + tx, y: cy - r + ty, w: 2 * r, h: 2 * r };
    } else if (anchorKind) {
      // anchor-point participants — cluster membership only (for g, the translate origin is the anchor)
      const ax = num(a.x) ?? (name === "g" ? 0 : NaN), ay = num(a.y) ?? (name === "g" ? 0 : NaN);
      if ([ax, ay].every(Number.isFinite)) el.anchor = { x: ax + tx, y: ay + ty };
    }
    if (broken || (!g && !el.anchor)) {
      errors.push(`E-LAYOUT-UNVERIFIED ${declared}: declared participant <${name}> has ${broken ? "a non-translate transform" : "non-numeric or unsupported geometry"} — classify data-layout-unverified explicitly or use the provable subset (silent pass is forbidden)`);
      continue;
    }
    if (g) {
      const sw = (num(a["stroke-width"]) ?? 0) / 2;
      let sh = { left: 0, right: 0, top: 0, bottom: 0 };
      const fm = (a.filter || "").match(/url\(#([^)]+)\)/);
      if (fm) {
        sh = filters[fm[1]];
        if (sh == null) {
          errors.push(`E-LAYOUT-UNVERIFIED ${declared}: filter "${fm[1]}" has no provable visual range — classify data-layout-unverified explicitly`);
          continue;
        }
      }
      el.geom = g;
      el.vis = { x: g.x - sw - sh.left, y: g.y - sw - sh.top,
                 x2: g.x + g.w + sw + sh.right, y2: g.y + g.h + sw + sh.bottom };
    }
    els.push(el);
  }

  const r1 = (v) => Math.round(v * 10) / 10;
  // --- alignment inventory: catches even a group that went missing **in its entirety** ------
  const invAttr = [...src.matchAll(/data-align-inventory="([^"]*)"/g)].map((m) => m[1]);
  if (invAttr.length > 1) errors.push(`E-LAYOUT-ALIGN-SCHEMA: more than one data-align-inventory declaration`);
  const declaredInv = invAttr.length
    ? new Map(invAttr[0].split(";").filter(Boolean).map((t) => {
        const m = t.match(/^(row|col):(.+)=(\d+)$/);
        if (!m) { errors.push(`E-LAYOUT-ALIGN-SCHEMA: unparseable inventory entry "${t}"`); return ["?", NaN]; }
        return [`${m[1]}:${m[2]}`, Number(m[3])];
      }))
    : null;

  // --- alignment rows/cols: cross-axis alignment plus **participation completeness** --------
  // Checking only whether things line up lets a group pass on its remaining members when one
  // annotation is missing. So each group must declare its expected participant count, and a
  // mismatched count is rejected.
  const alignTol = 1;
  for (const [attr, cntAttr, axis, pos, size, label] of [
    ["data-align-row", "data-align-row-count", "row", "y", "h", "top edge"],
    ["data-align-col", "data-align-col-count", "col", "x", "w", "left edge"],
  ]) {
    const byName = new Map();
    for (const e of els.filter((x) => x.a[attr])) {
      const k = e.a[attr];
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(e);
    }
    for (const [name, list] of byName) {
      const ctxA = `${axis} "${name}"`;
      const counts = [...new Set(list.map((e) => e.a[cntAttr]))];
      if (counts.some((c) => c === undefined)) {
        errors.push(`E-LAYOUT-ALIGN-SCHEMA ${ctxA}: every participant must declare ${cntAttr} — without it a missing participant passes unnoticed`);
        continue;
      }
      if (counts.length > 1) {
        errors.push(`E-LAYOUT-ALIGN-SCHEMA ${ctxA}: participants disagree on ${cntAttr} (${counts.join(", ")})`);
        continue;
      }
      const expected = num(counts[0]);
      if (!Number.isFinite(expected) || expected < 2) {
        errors.push(`E-LAYOUT-ALIGN-SCHEMA ${ctxA}: ${cntAttr} must be an integer ≥ 2 — a one-member alignment ${axis} asserts nothing`);
        continue;
      }
      if (list.length !== expected) {
        errors.push(`E-LAYOUT-ALIGN-SCHEMA ${ctxA}: declared ${expected} participant(s) but found ${list.length} — a missing annotation is a missing alignment claim`);
        continue;
      }
      const withGeom = list.filter((e) => e.geom);
      if (withGeom.length !== list.length) {
        errors.push(`E-LAYOUT-ALIGN-SCHEMA ${ctxA}: ${list.length - withGeom.length} participant(s) have no provable geometry`);
        continue;
      }
      const posOf = (e) => (pos === "y" ? e.geom.y : e.geom.x);
      const sizeOf = (e) => (size === "h" ? e.geom.h : e.geom.w);
      const pSpread = r1(Math.max(...withGeom.map(posOf)) - Math.min(...withGeom.map(posOf)));
      const sSpread = r1(Math.max(...withGeom.map(sizeOf)) - Math.min(...withGeom.map(sizeOf)));
      if (pSpread > alignTol)
        errors.push(`E-LAYOUT-ALIGN ${ctxA}: ${label}s differ by ${pSpread}px across ${withGeom.length} member(s) — members of one alignment ${axis} must share it`);
      if (sSpread > alignTol)
        errors.push(`E-LAYOUT-ALIGN ${ctxA}: ${size === "h" ? "heights" : "widths"} differ by ${sSpread}px — an alignment ${axis} implies equal extent`);
    }
  }

  if (declaredInv) {
    const actual = new Map();
    for (const [attr, cntAttr, axis] of [["data-align-row", "data-align-row-count", "row"], ["data-align-col", "data-align-col-count", "col"]])
      for (const e of els.filter((x) => x.a[attr])) {
        const k = `${axis}:${e.a[attr]}`;
        actual.set(k, (actual.get(k) ?? 0) + 1);
        void cntAttr;
      }
    for (const [k, n] of declaredInv) {
      if (!actual.has(k)) errors.push(`E-LAYOUT-ALIGN-SCHEMA: alignment group "${k}" is declared in the inventory but no participant carries it — the whole group is missing`);
      else if (actual.get(k) !== n) errors.push(`E-LAYOUT-ALIGN-SCHEMA: alignment group "${k}" has ${actual.get(k)} participant(s) but the inventory declares ${n}`);
    }
    for (const k of actual.keys())
      if (!declaredInv.has(k)) errors.push(`E-LAYOUT-ALIGN-SCHEMA: alignment group "${k}" exists in the artifact but is absent from the inventory`);
  }

  const receipt = { file: path.basename(file), containers: [], groups: [], clusters: [], unverified };

  // ---- containers (duplicate id = error) ----
  const containers = new Map();
  for (const e of els.filter((x) => x.a["data-layout-container"])) {
    const id = e.a["data-layout-container"];
    if (containers.has(id)) { errors.push(`E-LAYOUT-SCHEMA container "${id}": duplicate container id`); continue; }
    if (!e.geom) { errors.push(`E-LAYOUT-SCHEMA container "${id}": container must be a rect/circle with numeric bounds`); continue; }
    containers.set(id, e);
  }
  for (const [id, c] of containers) {
    const ctx = `container "${id}"`;
    const minPad = field(c.a, "data-min-pad", errors, ctx, { required: true });
    const declaredCount = field(c.a, "data-layout-count", errors, ctx, { required: true });
    const visPad = field(c.a, "data-min-visual-pad", errors, ctx, { def: 8 });
    const reserve = field(c.a, "data-reserve-top", errors, ctx, { def: 0 });
    // When a span is reserved **horizontally** — a label column, say — the content boundary starts that much further right.
    const reserveLeft = field(c.a, "data-reserve-left", errors, ctx, { def: 0 });
    const symTol = field(c.a, "data-symmetry-tol", errors, ctx, { def: 4 });
    const symAxes = c.a["data-symmetry"] ?? "";
    if (!["", "x", "y", "xy"].includes(symAxes)) errors.push(`E-LAYOUT-SCHEMA ${ctx}: data-symmetry must be x|y|xy (got "${symAxes}")`);
    if (minPad == null || declaredCount == null) continue;
    const frame = { x: c.geom.x, y: c.geom.y, x2: c.geom.x + c.geom.w, y2: c.geom.y + c.geom.h };
    const contentTop = frame.y + reserve;     // title reservation excluded from content bounds
    const contentLeft = frame.x + reserveLeft; // label-column reservation, same idea on the x axis
    const kids = els.filter((e) => e.a["data-layout-parent"] === id);
    // title participant: the measured line-box (centred baseline: the conservative range y +/- 0.6 x font-size)
    const titleEls = els.filter((e) => e.a["data-layout-title"] === id);
    const titledMode = "data-title-gap" in c.a;
    if (titledMode && titleEls.length === 0)
      errors.push(`E-LAYOUT-SCHEMA ${ctx}: titled mode (data-title-gap) declared but no data-layout-title participant — the title-gap contract must not silently disappear`);
    if (titleEls.length > 1)
      errors.push(`E-LAYOUT-SCHEMA ${ctx}: ${titleEls.length} data-layout-title participants — exactly one is allowed`);
    const titleEl = titleEls[0];
    let titleBox = null;
    if (titleEl) {
      const fs = num(titleEl.a["font-size"]);
      if (!titleEl.anchor || !Number.isFinite(fs) || fs <= 0) {
        errors.push(`E-LAYOUT-SCHEMA ${ctx}: title participant must be a text with numeric x/y and font-size`);
      } else {
        const central = titleEl.a["dominant-baseline"] === "central";
        titleBox = { top: central ? titleEl.anchor.y - 0.6 * fs : titleEl.anchor.y - 0.85 * fs,
                     bottom: central ? titleEl.anchor.y + 0.6 * fs : titleEl.anchor.y + 0.3 * fs };
        if (reserve <= 0) errors.push(`E-LAYOUT-SCHEMA ${ctx}: a title participant requires data-reserve-top > 0`);
        if (!("data-title-gap" in c.a)) errors.push(`E-LAYOUT-SCHEMA ${ctx}: a title participant requires data-title-gap (preset minimum title→content gap)`);
        if (titleBox.bottom > contentTop + 0.5)
          errors.push(`E-LAYOUT-RESERVE ${ctx}: title visual bottom ${r1(titleBox.bottom)} overflows the reservation (contentTop ${r1(contentTop)}) — enlarge data-reserve-top or move the title up`);
        if (titleBox.top < frame.y - 0.5)
          errors.push(`E-LAYOUT-RESERVE ${ctx}: title visual top ${r1(titleBox.top)} escapes the container frame`);
      }
    }
    const titleGapMin = field(c.a, "data-title-gap", errors, ctx, { def: null });
    // titled mode: require a minimum top inset against the contentBox (after reservation) as an
    // explicit contract, and do not apply y-symmetry to a titled container (the title filling the
    // top is deliberate asymmetry — an explicit contract, not a silent downgrade)
    const contentPadTop = field(c.a, "data-content-pad-top", errors, ctx, { required: titledMode, def: null });
    if (titledMode && symAxes.includes("y"))
      errors.push(`E-LAYOUT-SCHEMA ${ctx}: y-symmetry is not applicable to a titled container — declare data-content-pad-top + data-title-gap instead (design-kernel §7a)`);
    if (kids.length !== declaredCount)
      errors.push(`E-LAYOUT-COUNT ${ctx}: declared ${declaredCount} children, found ${kids.length} annotated — fail-closed`);
    const geo = { left: [], right: [], top: [], bottom: [] };
    const vis = { left: [], right: [], top: [], bottom: [] };
    const kidRecs = [];
    for (const k of kids) {
      const kid = k.a["data-layout-container"] || k.a["data-layout-item"] || k.a["data-cluster-id"] || "child";
      if (k.uv) continue;  // unverified member: counted only; its check stays in the exit-3 review state
      if (!k.geom) { errors.push(`E-LAYOUT-SCHEMA ${ctx}/${kid}: layout child must carry numeric rect/circle bounds`); continue; }
      const gi = { left: k.geom.x - contentLeft, right: frame.x2 - (k.geom.x + k.geom.w),
                   top: k.geom.y - contentTop, bottom: frame.y2 - (k.geom.y + k.geom.h) };
      const vi = { left: k.vis.x - contentLeft, right: frame.x2 - k.vis.x2,
                   top: k.vis.y - contentTop, bottom: frame.y2 - k.vis.y2 };
      for (const side of ["left", "right", "top", "bottom"]) {
        if (vi[side] <= 0)
          errors.push(`E-LAYOUT-TOUCH ${ctx}/${kid}: visual ${side} edge touches or crosses the parent edge (${r1(vi[side])}px)`);
        else if (vi[side] < visPad)
          errors.push(`E-LAYOUT-VISPAD ${ctx}/${kid}: visual ${side} clearance ${r1(vi[side])}px < floor ${visPad}px`);
        if (gi[side] < minPad - 0.5 && !(side === "top" && titledMode))
          errors.push(`E-LAYOUT-PAD ${ctx}/${kid}: ${side} inset ${r1(gi[side])}px < declared min padding ${minPad}px`);
        geo[side].push(gi[side]); vis[side].push(vi[side]);
      }
      if (reserveLeft > 0 && k.vis.x < contentLeft - 0.5)
        errors.push(`E-LAYOUT-RESERVE ${ctx}: child "${k.a["data-layout-item"] ?? k.a["data-layout-parent"]}" starts left of the declared data-reserve-left boundary`);
      if (reserve > 0 && k.vis.y < contentTop - 0.5)
        errors.push(`E-LAYOUT-RESERVE ${ctx}/${kid}: visual top ${r1(k.vis.y)} enters the title reservation (content starts at ${r1(contentTop)}) — title and content collide`);
      if (titleBox && titleGapMin != null && k.vis.y - titleBox.bottom < titleGapMin - 0.05)
        errors.push(`E-LAYOUT-TITLE-GAP ${ctx}/${kid}: measured title→content visual gap ${r1(k.vis.y - titleBox.bottom)}px < preset minimum ${titleGapMin}px`);
      if (contentPadTop != null && k.geom.y - contentTop < contentPadTop - 0.5)
        errors.push(`E-LAYOUT-PAD ${ctx}/${kid}: contentBox-adjusted top inset ${r1(k.geom.y - contentTop)}px (contentTop ${r1(contentTop)}) < declared data-content-pad-top ${contentPadTop}px`);
      kidRecs.push({ id: kid, geom: k.geom,
        insets: { geometric: { left: r1(gi.left), right: r1(gi.right), top: r1(gi.top), bottom: r1(gi.bottom) },
                  visual: { left: r1(vi.left), right: r1(vi.right), top: r1(vi.top), bottom: r1(vi.bottom) },
                  titleAdjustedTop: r1(k.geom.y - contentTop), reserveBoundaryGap: r1(k.vis.y - contentTop),
                  titleGapVisual: titleBox ? r1(k.vis.y - titleBox.bottom) : null } });
    }
    const bind = (o, side) => o[side].length ? Math.min(...o[side]) : null;
    const sym = {};
    if (kids.length) {
      for (const [ax, s1, s2] of [["x", "left", "right"], ["y", "top", "bottom"]]) {
        if (!symAxes.includes(ax)) continue;
        sym[ax] = { geometric: r1(Math.abs(bind(geo, s1) - bind(geo, s2))), visual: r1(Math.abs(bind(vis, s1) - bind(vis, s2))) };
        if (sym[ax].geometric > symTol)
          errors.push(`E-LAYOUT-SYM ${ctx}: geometric ${s1}/${s2} insets differ by ${sym[ax].geometric}px > tol ${symTol}px`);
        if (sym[ax].visual > symTol)
          errors.push(`E-LAYOUT-SYM ${ctx}: visual ${s1}/${s2} insets differ by ${sym[ax].visual}px > tol ${symTol}px (canonical visual-spacing contract)`);
      }
    }
    receipt.containers.push({ id, frame, contentTop: r1(contentTop), reserveTop: reserve, minPad, minVisualPad: visPad,
      bindingInsets: { geometric: { left: r1(bind(geo, "left") ?? -1), right: r1(bind(geo, "right") ?? -1), top: r1(bind(geo, "top") ?? -1), bottom: r1(bind(geo, "bottom") ?? -1) },
                       visual: { left: r1(bind(vis, "left") ?? -1), right: r1(bind(vis, "right") ?? -1), top: r1(bind(vis, "top") ?? -1), bottom: r1(bind(vis, "bottom") ?? -1) } },
      symmetry: sym, titledMode, contentPadTop,
      contentInsets: kids.length ? { topFromContentTop: r1(Math.min(...kids.filter((k) => !k.uv && k.geom).map((k) => k.geom.y - contentTop))),
                                     bottomFromFrame: r1(bind(geo, "bottom") ?? -1) } : null,
      titleBounds: titleBox ? { top: r1(titleBox.top), bottom: r1(titleBox.bottom) } : null,
      titleGapMin, children: kidRecs });
  }

  // A title referencing an undeclared container is a schema error (orphan title)
  for (const e of els.filter((x) => x.a["data-layout-title"])) {
    if (!containers.has(e.a["data-layout-title"]))
      errors.push(`E-LAYOUT-SCHEMA title participant references undeclared container "${e.a["data-layout-title"]}"`);
  }

  // ---- groups (duplicate id = error; distribution/axis/count required) ----
  const groups = new Map();
  for (const e of els.filter((x) => x.a["data-layout-group"])) {
    const id = e.a["data-layout-group"];
    if (groups.has(id)) { errors.push(`E-LAYOUT-SCHEMA group "${id}": duplicate group id`); continue; }
    groups.set(id, e);
  }
  for (const [gid, decl] of groups) {
    const ctx = `group "${gid}"`;
    const mode = decl.a["data-distribution"];
    const axis = decl.a["data-axis"];
    if (mode !== "equal-gap") errors.push(`E-LAYOUT-SCHEMA ${ctx}: data-distribution must be "equal-gap" (got "${mode ?? ""}" — packed/space-between are Wave 1 candidates, not silently accepted)`);
    if (axis !== "x" && axis !== "y") errors.push(`E-LAYOUT-SCHEMA ${ctx}: data-axis must be x|y (got "${axis ?? ""}")`);
    const gapTol = field(decl.a, "data-gap-tol", errors, ctx, { def: 1 });
    const declaredCount = field(decl.a, "data-group-count", errors, ctx, { required: true });
    if (mode !== "equal-gap" || (axis !== "x" && axis !== "y") || declaredCount == null) continue;
    const allItems = els.filter((e) => e.a["data-layout-item"] === gid);
    if (allItems.length !== declaredCount)
      errors.push(`E-LAYOUT-COUNT ${ctx}: declared ${declaredCount} items, found ${allItems.length} annotated — fail-closed`);
    const items = allItems.filter((e) => e.geom)
      .sort((a2, b2) => axis === "x" ? a2.geom.x - b2.geom.x : a2.geom.y - b2.geom.y);
    if (items.length < 2) { receipt.groups.push({ id: gid, mode, axis, items: items.length }); continue; }
    const lo = (e) => axis === "x" ? e.vis.x : e.vis.y;
    const hi = (e) => axis === "x" ? e.vis.x2 : e.vis.y2;
    const glo = (e) => axis === "x" ? e.geom.x : e.geom.y;
    const ghi = (e) => axis === "x" ? (e.geom.x + e.geom.w) : (e.geom.y + e.geom.h);
    const gapsV = [], gapsG = [];
    for (let i = 1; i < items.length; i++) { gapsV.push(lo(items[i]) - hi(items[i - 1])); gapsG.push(glo(items[i]) - ghi(items[i - 1])); }
    if (gapsV.some((g) => g < 0)) errors.push(`E-LAYOUT-GAP ${ctx}: adjacent items overlap on the ${axis} axis`);
    const spread = r1(Math.max(...gapsV) - Math.min(...gapsV));
    if (spread > gapTol)
      errors.push(`E-LAYOUT-GAP ${ctx}: visual gap spread ${spread}px (gaps ${gapsV.map(r1).join("/")}) > tol ${gapTol}px — reflow the whole group (start/gap/size), never move one item`);
    const sizes = items.map((e) => axis === "x" ? e.geom.w : e.geom.h);
    const sizeSpread = r1(Math.max(...sizes) - Math.min(...sizes));
    if (sizeSpread > 1) errors.push(`E-LAYOUT-SIZE ${ctx}: repeated item ${axis === "x" ? "width" : "height"} spread ${sizeSpread}px > 1px`);
    let outer = null;
    const parentId = items[0].a["data-layout-parent"];
    const pc = parentId && containers.get(parentId);
    if (pc && items.every((i2) => i2.a["data-layout-parent"] === parentId)) {
      const reserve = num(pc.a["data-reserve-top"]) || 0;
      const pcReserveTop = num(pc.a["data-reserve-top"]) || 0;
      const pcReserveLeft = num(pc.a["data-reserve-left"]) || 0;
      const cL = axis === "x" ? pc.geom.x + pcReserveLeft : pc.geom.y + pcReserveTop;
      const cR = axis === "x" ? pc.geom.x + pc.geom.w : pc.geom.y + pc.geom.h;
      outer = { start: r1(glo(items[0]) - cL), end: r1(cR - ghi(items[items.length - 1])) };
      const tol = num(pc.a["data-symmetry-tol"]) || 4;
      if (Math.abs(outer.start - outer.end) > tol)
        errors.push(`E-LAYOUT-OUTER ${ctx}: outer insets ${outer.start}px vs ${outer.end}px differ > tol ${tol}px — first/last alignment broken`);
    }
    receipt.groups.push({ id: gid, mode, axis, items: items.length, gaps: { geometric: gapsG.map(r1), visual: gapsV.map(r1) }, gapSpread: spread, sizes, outerInsets: outer });
  }

  // ---- atomic clusters (card = frame + declared components) ----
  const clusters = new Map();
  for (const e of els.filter((x) => x.a["data-cluster-id"])) {
    const id = e.a["data-cluster-id"];
    if (clusters.has(id)) { errors.push(`E-LAYOUT-SCHEMA cluster "${id}": duplicate cluster id`); continue; }
    if (!e.geom) { errors.push(`E-LAYOUT-SCHEMA cluster "${id}": cluster frame must be a rect/circle with numeric bounds`); continue; }
    clusters.set(id, e);
  }
  const memberRefs = els.filter((e) => e.a["data-cluster"]);
  for (const mref of memberRefs) {
    if (!clusters.has(mref.a["data-cluster"]))
      errors.push(`E-LAYOUT-SCHEMA cluster member references undeclared cluster "${mref.a["data-cluster"]}"`);
  }
  for (const [cid, frameEl] of clusters) {
    const ctx = `cluster "${cid}"`;
    const declaredCount = field(frameEl.a, "data-cluster-count", errors, ctx, { required: true });
    const bindTol = field(frameEl.a, "data-cluster-tol", errors, ctx, { def: 1 });
    const fb = { x: frameEl.geom.x, y: frameEl.geom.y, x2: frameEl.geom.x + frameEl.geom.w, y2: frameEl.geom.y + frameEl.geom.h };
    const members = memberRefs.filter((e) => e.a["data-cluster"] === cid);
    if (declaredCount != null && members.length !== declaredCount)
      errors.push(`E-LAYOUT-COUNT ${ctx}: declared ${declaredCount} components, found ${members.length} annotated — fail-closed (a moved frame must carry all its components)`);
    const memberRecs = [];
    for (const mm of members) {
      if (mm.uv) { memberRecs.push({ tag: mm.name, kind: "unverified", inside: null }); continue; }
      let ok, kind, ref;
      if (mm.geom) {
        kind = "bounds";
        ref = { x: mm.geom.x + mm.geom.w / 2, y: mm.geom.y + mm.geom.h / 2 }; // binding reference: the centre of the bounds
        ok = mm.geom.x >= fb.x - 0.5 && mm.geom.y >= fb.y - 0.5 && mm.geom.x + mm.geom.w <= fb.x2 + 0.5 && mm.geom.y + mm.geom.h <= fb.y2 + 0.5;
      } else {
        kind = "anchor";
        ref = mm.anchor;
        ok = mm.anchor.x >= fb.x && mm.anchor.x <= fb.x2 && mm.anchor.y >= fb.y && mm.anchor.y <= fb.y2;
      }
      if (!ok)
        errors.push(`E-LAYOUT-CLUSTER ${ctx}: component <${mm.name}> (${kind} ${JSON.stringify(mm.geom ?? mm.anchor)}) sits outside the item frame ${JSON.stringify(fb)} — the item moved without this component`);
      // atomic binding: containment alone misses a frame-only small drift — check against the declared relative offset
      let bind = null;
      const at = mm.a["data-cluster-at"];
      if (at == null) {
        errors.push(`E-LAYOUT-SCHEMA ${ctx}: component <${mm.name}> is missing data-cluster-at="dx,dy" — relative binding must be declared (containment alone is not atomicity)`);
      } else {
        const am = String(at).match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)$/);
        if (!am) errors.push(`E-LAYOUT-SCHEMA ${ctx}: invalid data-cluster-at "${at}" (expected "dx,dy")`);
        else {
          const dx = ref.x - fb.x - Number(am[1]), dy = ref.y - fb.y - Number(am[2]);
          bind = { declared: [Number(am[1]), Number(am[2])], measured: [r1(ref.x - fb.x), r1(ref.y - fb.y)], delta: [r1(dx), r1(dy)] };
          if (Math.abs(dx) > bindTol || Math.abs(dy) > bindTol)
            errors.push(`E-LAYOUT-BINDING ${ctx}: component <${mm.name}> drifted from its declared offset by (${r1(dx)}, ${r1(dy)})px > tol ${bindTol}px — the frame moved without carrying this component (or vice versa)`);
        }
      }
      memberRecs.push({ tag: mm.name, kind, at: mm.geom ?? mm.anchor, inside: ok, binding: bind });
    }
    receipt.clusters.push({ id: cid, frame: fb, declared: declaredCount, found: members.length, members: memberRecs });
  }
  return { receipt, errors };
}

export function runLayoutCli(argv) {
  const KNOWN = ["--json"];
  const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.includes(a));
  if (unknown.length) { console.error(`unknown option for check-layout: ${unknown.join(" ")} (known: ${KNOWN.join(", ")})`); return 2; }
  const json = argv.includes("--json");
  const files = argv.filter((a) => !a.startsWith("--"));
  if (!files.length) { console.error("usage: check-layout.mjs <svg...> [--json]"); return 2; }
  let allErrors = 0, anyUnverified = false;
  const receipts = [];
  for (const f of files) {
    const { receipt, errors } = checkLayoutFile(f);
    receipts.push({ ...receipt, errors });
    allErrors += errors.length;
    anyUnverified = anyUnverified || receipt.unverified.length > 0;
    if (!json) {
      console.log(`${path.basename(f)} — ${receipt.containers.length} container(s), ${receipt.groups.length} group(s), ${receipt.clusters.length} cluster(s), ${errors.length} error(s)`);
      for (const e of errors) console.log(`  ERROR ${e}`);
      for (const u of receipt.unverified) console.log(`  UNVERIFIED ${u.id}: ${u.reason} — explicit review state, not a pass`);
    }
  }
  if (json) console.log(JSON.stringify({ schemaVersion: 2, command: "check-layout", files: receipts, errors: allErrors, unverified: anyUnverified }, null, 1));
  return allErrors ? 1 : anyUnverified ? 3 : 0;
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  }
}
if (isEntrypoint()) {
  preflight({ entrypointUrl: import.meta.url });
  process.exit(runLayoutCli(process.argv.slice(2)));
}
