#!/usr/bin/env node
// check-layout.mjs — generic layout contract guard (Wave 0 provable subset).
//
// Two contracts, annotation-declared (design-kernel §7):
//  1. padded/nested container: children sit inside the parent's content bounds with
//     the declared geometric min padding; VISUAL bounds (rect + stroke/2 + conservative
//     shadow range) must never touch the parent edge and must keep the visual
//     clearance floor; declared symmetry axes hold within tolerance; recursive.
//  2. repeated row/column distribution: equal-gap groups keep gap spread within
//     tolerance, uniform item size, symmetric outer insets, declared member count.
//
// Annotation grammar (containers are rects):
//   data-layout-container="<id>"      declares a container
//   data-min-pad="32"                 geometric min inner padding (all sides)
//   data-min-visual-pad="12"          visual clearance floor (default 8)
//   data-reserve-top="0"              title/header reservation excluded from content top
//   data-symmetry="xy"                axes whose opposing insets must balance
//   data-symmetry-tol="4"             symmetry tolerance px (default 4)
//   data-layout-count="4"             declared child count (fail-closed)
//   data-layout-parent="<id>"         membership (child of container <id>)
//   data-layout-group="<id>" data-distribution="equal-gap" data-axis="x"
//   data-group-count="3" data-gap-tol="1"   group declaration (on first item)
//   data-layout-item="<id>"           group membership
//   data-layout-unverified="reason"   explicit unverified classification
//
// Provable subset: rect/circle geometry with numeric attributes, translate-only
// ancestor transforms, feDropShadow / feDisplacementMap filters. Anything else on a
// declared participant is an ERROR (E-LAYOUT-UNVERIFIED) unless explicitly classified
// data-layout-unverified — never a silent pass (no-false-certainty).
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const json = args.includes("--json");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) { console.error("usage: check-layout.mjs <svg...> [--json]"); process.exit(2); }

const num = (v) => (v == null ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN);

function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
}

function parseFilters(src) {
  const out = {};
  for (const m of src.matchAll(/<filter [^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/filter>/g)) {
    const [, id, body] = m;
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

function checkFile(file) {
  const src = readFileSync(file, "utf8");
  const errors = [], unverified = [];
  const filters = parseFilters(src);
  // walk tags with a <g> stack for translate accumulation
  const stack = [];
  const els = [];
  for (const m of src.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g)) {
    const [, close, name, rawAttrs, self] = m;
    if (close) { if (name === "g") stack.pop(); continue; }
    const a = attrs(rawAttrs);
    let tx = stack.reduce((s, f) => s + f.tx, 0), ty = stack.reduce((s, f) => s + f.ty, 0);
    let broken = stack.some((f) => f.broken);
    if (a.transform != null) {
      const t = a.transform.match(/^\s*translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)\s*$/);
      if (t) { tx += Number(t[1]); ty += Number(t[2]); }
      else broken = true;
    }
    if (name === "g" && !self) {
      const t = a.transform ? a.transform.match(/^\s*translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)\s*$/) : ["", "0", "0"];
      stack.push({ tx: t ? Number(t[1]) : 0, ty: t ? Number(t[2]) : 0, broken: a.transform != null && !t });
    }
    const declared = a["data-layout-container"] || a["data-layout-parent"] || a["data-layout-item"] || a["data-layout-group"];
    if (!declared) continue;
    const el = { a, name, file };
    if (a["data-layout-unverified"] != null) { unverified.push({ id: declared, reason: a["data-layout-unverified"] }); continue; }
    // geometric bounds (provable subset)
    let g = null;
    if (name === "rect") {
      const x = num(a.x) ?? 0, y = num(a.y) ?? 0, w = num(a.width), h = num(a.height);
      if ([x, y, w, h].every((v) => Number.isFinite(v))) g = { x: x + tx, y: y + ty, w, h };
    } else if (name === "circle") {
      const cx = num(a.cx), cy = num(a.cy), r = num(a.r);
      if ([cx, cy, r].every((v) => Number.isFinite(v))) g = { x: cx - r + tx, y: cy - r + ty, w: 2 * r, h: 2 * r };
    }
    if (!g || broken) {
      errors.push(`E-LAYOUT-UNVERIFIED ${declared}: declared participant <${name}> has ${broken ? "a non-translate transform" : "non-numeric or unsupported geometry"} — classify data-layout-unverified explicitly or use the provable subset (silent pass is forbidden)`);
      continue;
    }
    const sw = (num(a["stroke-width"]) ?? 0) / 2;
    let sh = { left: 0, right: 0, top: 0, bottom: 0 };
    const fm = (a.filter || "").match(/url\(#([^)]+)\)/);
    if (fm) {
      sh = filters[fm[1]];
      if (sh === null || sh === undefined) {
        errors.push(`E-LAYOUT-UNVERIFIED ${declared}: filter "${fm[1]}" has no provable visual range — classify data-layout-unverified explicitly`);
        continue;
      }
    }
    el.geom = g;
    el.vis = { x: g.x - sw - sh.left, y: g.y - sw - sh.top,
               x2: g.x + g.w + sw + sh.right, y2: g.y + g.h + sw + sh.bottom };
    els.push(el);
  }

  const containers = new Map(els.filter((e) => e.a["data-layout-container"]).map((e) => [e.a["data-layout-container"], e]));
  const receipt = { file: path.basename(file), containers: [], groups: [], unverified };
  const r1 = (v) => Math.round(v * 10) / 10;

  for (const [id, c] of containers) {
    const minPad = num(c.a["data-min-pad"]) ?? 0;
    const visPad = num(c.a["data-min-visual-pad"]) ?? 8;
    const reserve = num(c.a["data-reserve-top"]) ?? 0;
    const symTol = num(c.a["data-symmetry-tol"]) ?? 4;
    const symAxes = c.a["data-symmetry"] || "";
    const declaredCount = num(c.a["data-layout-count"]);
    const cb = { x: c.geom.x, y: c.geom.y + reserve, x2: c.geom.x + c.geom.w, y2: c.geom.y + c.geom.h };
    const kids = els.filter((e) => e.a["data-layout-parent"] === id);
    if (declaredCount != null && kids.length !== declaredCount)
      errors.push(`E-LAYOUT-COUNT ${id}: declared ${declaredCount} children, found ${kids.length} annotated — fail-closed`);
    const insets = { left: [], right: [], top: [], bottom: [] };
    const kidRecs = [];
    for (const k of kids) {
      const kid = k.a["data-layout-container"] || k.a["data-layout-item"] || "child";
      const gi = { left: k.geom.x - cb.x, right: cb.x2 - (k.geom.x + k.geom.w),
                   top: k.geom.y - cb.y, bottom: cb.y2 - (k.geom.y + k.geom.h) };
      const vi = { left: k.vis.x - cb.x, right: cb.x2 - k.vis.x2,
                   top: k.vis.y - cb.y, bottom: cb.y2 - k.vis.y2 };
      for (const side of ["left", "right", "top", "bottom"]) {
        if (vi[side] <= 0)
          errors.push(`E-LAYOUT-TOUCH ${id}/${kid}: visual ${side} edge touches or crosses the parent content edge (${r1(vi[side])}px)`);
        else if (vi[side] < visPad)
          errors.push(`E-LAYOUT-VISPAD ${id}/${kid}: visual ${side} clearance ${r1(vi[side])}px < floor ${visPad}px`);
        if (gi[side] < minPad - 0.5)
          errors.push(`E-LAYOUT-PAD ${id}/${kid}: ${side} inset ${r1(gi[side])}px < declared min padding ${minPad}px`);
        insets[side].push(gi[side]);
      }
      kidRecs.push({ id: kid, geom: k.geom, visual: k.vis, insets: { left: r1(gi.left), right: r1(gi.right), top: r1(gi.top), bottom: r1(gi.bottom) } });
    }
    const bind = (side) => insets[side].length ? Math.min(...insets[side]) : null;
    const sym = {};
    if (kids.length) {
      if (symAxes.includes("x")) {
        sym.x = r1(Math.abs(bind("left") - bind("right")));
        if (sym.x > symTol) errors.push(`E-LAYOUT-SYM ${id}: left/right insets differ by ${sym.x}px (${r1(bind("left"))} vs ${r1(bind("right"))}) > tol ${symTol}px`);
      }
      if (symAxes.includes("y")) {
        sym.y = r1(Math.abs(bind("top") - bind("bottom")));
        if (sym.y > symTol) errors.push(`E-LAYOUT-SYM ${id}: top/bottom insets differ by ${sym.y}px (${r1(bind("top"))} vs ${r1(bind("bottom"))}, reserve-top ${reserve}) > tol ${symTol}px`);
      }
    }
    receipt.containers.push({ id, contentBounds: { x: cb.x, y: cb.y, x2: cb.x2, y2: cb.y2 }, reserveTop: reserve,
      minPad, minVisualPad: visPad, bindingInsets: { left: r1(bind("left") ?? -1), right: r1(bind("right") ?? -1), top: r1(bind("top") ?? -1), bottom: r1(bind("bottom") ?? -1) },
      symmetry: sym, children: kidRecs });
  }

  const groups = new Map(els.filter((e) => e.a["data-layout-group"]).map((e) => [e.a["data-layout-group"], e]));
  for (const [gid, decl] of groups) {
    const mode = decl.a["data-distribution"] || "equal-gap";
    const axis = decl.a["data-axis"] || "x";
    const gapTol = num(decl.a["data-gap-tol"]) ?? 1;
    const declaredCount = num(decl.a["data-group-count"]);
    const items = els.filter((e) => e.a["data-layout-item"] === gid)
      .sort((a2, b2) => axis === "x" ? a2.geom.x - b2.geom.x : a2.geom.y - b2.geom.y);
    if (declaredCount != null && items.length !== declaredCount) {
      errors.push(`E-LAYOUT-COUNT group ${gid}: declared ${declaredCount} items, found ${items.length} annotated — fail-closed`);
    }
    if (items.length < 2) { receipt.groups.push({ id: gid, mode, axis, items: items.length }); continue; }
    const lo = (e) => axis === "x" ? e.vis.x : e.vis.y;
    const hi = (e) => axis === "x" ? e.vis.x2 : e.vis.y2;
    const size = (e) => axis === "x" ? e.geom.w : e.geom.h;
    const gaps = [];
    for (let i = 1; i < items.length; i++) gaps.push(hi(items[i - 1]) <= lo(items[i]) ? lo(items[i]) - hi(items[i - 1]) : -1);
    if (gaps.some((g) => g < 0)) errors.push(`E-LAYOUT-GAP group ${gid}: adjacent items overlap on the ${axis} axis`);
    const spread = r1(Math.max(...gaps) - Math.min(...gaps));
    if (mode === "equal-gap" && spread > gapTol)
      errors.push(`E-LAYOUT-GAP group ${gid}: gap spread ${spread}px (gaps ${gaps.map(r1).join("/")}) > tol ${gapTol}px — reflow the whole group (start/gap/size), never move one item`);
    const sizes = items.map(size);
    const sizeSpread = r1(Math.max(...sizes) - Math.min(...sizes));
    if (sizeSpread > 1) errors.push(`E-LAYOUT-SIZE group ${gid}: repeated item ${axis === "x" ? "width" : "height"} spread ${sizeSpread}px > 1px`);
    let outer = null;
    const parentId = items[0].a["data-layout-parent"];
    const pc = parentId && containers.get(parentId);
    if (pc && items.every((i2) => i2.a["data-layout-parent"] === parentId)) {
      const cL = axis === "x" ? pc.geom.x : pc.geom.y + (num(pc.a["data-reserve-top"]) ?? 0);
      const cR = axis === "x" ? pc.geom.x + pc.geom.w : pc.geom.y + pc.geom.h;
      const first = axis === "x" ? items[0].geom.x : items[0].geom.y;
      const lastEl = items[items.length - 1];
      const last = axis === "x" ? lastEl.geom.x + lastEl.geom.w : lastEl.geom.y + lastEl.geom.h;
      outer = { start: r1(first - cL), end: r1(cR - last) };
      const tol = num(pc.a["data-symmetry-tol"]) ?? 4;
      if (Math.abs(outer.start - outer.end) > tol)
        errors.push(`E-LAYOUT-OUTER group ${gid}: outer insets ${outer.start}px vs ${outer.end}px differ > tol ${tol}px — first/last alignment broken`);
    }
    receipt.groups.push({ id: gid, mode, axis, items: items.length, gaps: gaps.map(r1), gapSpread: spread, sizes, outerInsets: outer });
  }
  return { receipt, errors };
}

let allErrors = 0;
const receipts = [];
for (const f of files) {
  const { receipt, errors } = checkFile(f);
  receipts.push({ ...receipt, errors });
  allErrors += errors.length;
  if (!json) {
    console.log(`${path.basename(f)} — ${receipt.containers.length} container(s), ${receipt.groups.length} group(s), ${errors.length} error(s)`);
    for (const e of errors) console.log(`  ERROR ${e}`);
    for (const u of receipt.unverified) console.log(`  UNVERIFIED ${u.id}: ${u.reason}`);
  }
}
if (json) console.log(JSON.stringify({ schemaVersion: 1, command: "check-layout", files: receipts, errors: allErrors }, null, 1));
process.exit(allErrors ? 1 : 0);
