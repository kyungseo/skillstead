#!/usr/bin/env node
// check-svg.mjs — source-level lint gate for svg-infographic SVG output.
//
// Enforces, before any browser render, the subset of SKILL.md §3/§4 rules that
// can be checked deterministically or with high confidence from the SVG source:
//
//   E-ID        duplicate element ids
//   E-REF       dangling url(#…) / href="#…" / marker references (attrs and CSS)
//   E-ROOT      missing/invalid root viewBox; width/height mismatch is W-ROOT
//   E-BOUNDS    shape obviously outside the root viewBox
//   E-MARKER    referenced <marker> without explicit markerUnits="userSpaceOnUse"
//   E-HEADSIZE  effective arrowhead footprint far beyond the connector contract
//   E-LAYOUT    opt-in page-title, panel-header, and icon/text-cluster geometry violations
//   E-TEXT      high-confidence Latin/CJK text overflow past its containing box
//   W-*         ambiguous cases (transforms, unresolved styles, near-threshold
//               overflow, large-but-plausible heads) — reported, never fatal
//
// Usage:  node check-svg.mjs file.svg [more.svg …]
// Exit:   0 when no hard errors (warnings allowed) · 1 hard errors · 2 usage
//
// Design constraints (approved design decisions):
//   - Node 18+ standard library only; no npm dependency.
//   - Only deterministic/high-confidence findings are hard errors.
//   - Text measurement is an estimate: per-script average glyph widths with a
//     CJK wide-glyph weighting. Uncertain cases degrade to warnings, never to
//     silent passes or false certainty.
//   - The SVG is inspected as text; no XML entity resolution, no network, no
//     script execution.
//
// Opt-outs for deliberate design exceptions (use sparingly, with a reason in
// the surrounding commit/PR): data-lint-allow="text-overflow" on the text or
// its container, data-lint-allow="marker-footprint" on the marker, or
// data-lint-allow="layout-geometry" on an explicitly annotated layout group.

import { readFileSync , realpathSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { allowedPaintSet } from "./skin.mjs";
import { preflight } from "./preflight-lib.mjs";
import process from "node:process";

// ---------------------------------------------------------------------------
// Tag tokenizer — builds a lightweight element tree with line numbers.
// ---------------------------------------------------------------------------

const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function parseAttrs(chunk) {
  const attrs = Object.create(null);
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(chunk)) !== null) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  return attrs;
}

function parseTree(source) {
  const root = { tag: "#root", attrs: {}, children: [], parent: null, line: 0, text: "" };
  let node = root;
  let m;
  TAG_RE.lastIndex = 0;
  let lastEnd = 0;
  while ((m = TAG_RE.exec(source)) !== null) {
    const raw = m[0];
    if (raw.startsWith("<!--") || raw.startsWith("<![CDATA[")) continue;
    const [, closing, tag, attrChunk, selfClose] = m;
    if (node !== root) node.text += source.slice(lastEnd, m.index);
    lastEnd = m.index + raw.length;
    if (closing) {
      // Pop to the nearest matching open tag (tolerates minor nesting slips).
      let up = node;
      while (up !== root && up.tag !== tag) up = up.parent;
      node = up === root ? node : up.parent ?? root;
      continue;
    }
    const el = {
      tag,
      attrs: parseAttrs(attrChunk),
      children: [],
      parent: node,
      line: lineOf(source, m.index),
      contentStart: m.index + raw.length,
      text: "",
    };
    node.children.push(el);
    if (!selfClose) node = el;
  }
  return root;
}

function* walk(node) {
  for (const child of node.children) {
    yield child;
    yield* walk(child);
  }
}

function hasAncestor(el, tags) {
  for (let p = el.parent; p; p = p.parent) if (tags.includes(p.tag)) return true;
  return false;
}

function ancestorAllows(el, token) {
  for (let p = el; p; p = p.parent) {
    const allow = p.attrs?.["data-lint-allow"];
    if (allow && allow.split(/\s+/).includes(token)) return true;
  }
  return false;
}

// Translate-only transforms are applied; anything else marks the subtree
// uncertain (text checks degrade to warnings there).
function resolveTransform(el) {
  let dx = 0;
  let dy = 0;
  let uncertain = false;
  for (let p = el; p; p = p.parent) {
    const t = p.attrs?.transform;
    if (!t) continue;
    const only = t.match(/^\s*translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)\s*$/);
    if (only) {
      dx += parseFloat(only[1]);
      dy += only[2] !== undefined ? parseFloat(only[2]) : 0;
    } else {
      uncertain = true;
    }
  }
  return { dx, dy, uncertain };
}

// ---------------------------------------------------------------------------
// Minimal CSS parsing — class/tag rules from <style> blocks.
// ---------------------------------------------------------------------------

function parseStyles(styleText) {
  const rules = [];
  const body = styleText.replace(/\/\*[\s\S]*?\*\//g, "");
  const RULE_RE = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = RULE_RE.exec(body)) !== null) {
    const decls = Object.create(null);
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      decls[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
    }
    for (const sel of m[1].split(",")) rules.push({ selector: sel.trim(), decls });
  }
  return rules;
}

function parseInlineStyle(styleAttr) {
  const decls = Object.create(null);
  if (!styleAttr) return decls;
  for (const d of styleAttr.split(";")) {
    const i = d.indexOf(":");
    if (i < 0) continue;
    decls[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
  }
  return decls;
}

function declsFor(el, rules) {
  // Specificity-lite: tag rules, then class rules, then id rules, then the
  // inline style attr (C4-R2: id selectors are part of the supported subset).
  const merged = Object.create(null);
  const classes = (el.attrs.class ?? "").split(/\s+/).filter(Boolean);
  for (const r of rules) if (r.selector === el.tag || r.selector === "svg") Object.assign(merged, r.decls);
  for (const r of rules) {
    const m = r.selector.match(/^([A-Za-z]*)\.([\w-]+)$/);
    if (m && classes.includes(m[2]) && (m[1] === "" || m[1] === el.tag)) Object.assign(merged, r.decls);
  }
  if (el.attrs.id) {
    for (const r of rules) {
      const m = r.selector.match(/^([A-Za-z]*)#([\w:.-]+)$/);
      if (m && m[2] === el.attrs.id && (m[1] === "" || m[1] === el.tag)) Object.assign(merged, r.decls);
    }
  }
  Object.assign(merged, parseInlineStyle(el.attrs.style));
  return merged;
}

// Resolve non-inherited geometry on the element itself. Unlike declsFor(),
// this must not merge root `svg` rules into descendants: width/y/height do not
// inherit. Presentation attributes are the fallback; local CSS wins.
function localGeometryProp(el, name, rules) {
  const merged = Object.create(null);
  const classes = (el.attrs.class ?? "").split(/\s+/).filter(Boolean);
  for (const r of rules) if (r.selector === el.tag) Object.assign(merged, r.decls);
  for (const r of rules) {
    const m = r.selector.match(/^([A-Za-z]*)\.([\w-]+)$/);
    if (m && classes.includes(m[2]) && (m[1] === "" || m[1] === el.tag)) Object.assign(merged, r.decls);
  }
  if (el.attrs.id) {
    for (const r of rules) {
      const m = r.selector.match(/^([A-Za-z]*)#([\w:.-]+)$/);
      if (m && m[2] === el.attrs.id && (m[1] === "" || m[1] === el.tag)) Object.assign(merged, r.decls);
    }
  }
  Object.assign(merged, parseInlineStyle(el.attrs.style));
  return merged[name] ?? el.attrs[name];
}

function px(value) {
  if (value === undefined) return undefined;
  const m = String(value).match(/^(-?[\d.]+)\s*(px)?$/);
  return m ? parseFloat(m[1]) : undefined;
}

// Resolve a presentation property through inline attr → style/class decls,
// walking up ancestor groups (SVG presentation attributes inherit).
function inheritedProp(el, name, rules) {
  for (let p = el; p && p.tag !== "#root"; p = p.parent) {
    if (p.attrs?.[name] !== undefined) return p.attrs[name];
    const d = declsFor(p, rules)[name];
    if (d !== undefined) return d;
  }
  return undefined;
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Families declared via @font-face are embedded custom fonts (e.g. the sketch
// preset's handwriting font) whose metrics the estimator cannot know.
function fontFaceFamilies(styleText) {
  const families = new Set();
  const RE = /@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^;'"}]+)['"]?/g;
  let m;
  while ((m = RE.exec(styleText)) !== null) families.add(m[1].trim().toLowerCase());
  return families;
}

// ---------------------------------------------------------------------------
// Text width estimation — average glyph widths per script, CJK weighted 1.0em.
// ---------------------------------------------------------------------------

const CJK_RANGES = [
  [0x1100, 0x11ff], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf],
  [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff],
  [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6],
];

function isCjk(code) {
  for (const [lo, hi] of CJK_RANGES) if (code >= lo && code <= hi) return true;
  return false;
}

const NARROW = new Set(".,:;!'’‘`ijl|()[]{}".split(""));
const MID_NARROW = new Set("ftrI-·/\\\"".split(""));
const WIDE = new Set("mMW@%".split(""));

export function estimateWidth(text, fontSize, bold, letterSpacing) {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (ch === " ") em += 0.28;
    else if (isCjk(code)) em += 1.0;
    else if (NARROW.has(ch)) em += 0.3;
    else if (MID_NARROW.has(ch)) em += 0.37;
    else if (WIDE.has(ch)) em += 0.85;
    else if (ch >= "A" && ch <= "Z") em += 0.68;
    else em += 0.53; // lowercase, digits, remaining latin/symbol average
  }
  let width = em * fontSize;
  if (bold) width *= 1.07;
  if (letterSpacing) width += letterSpacing * Math.max(0, [...text].length - 1);
  return width;
}

// ---------------------------------------------------------------------------
// Lint implementation.
// ---------------------------------------------------------------------------

export function lintSvg(source, filename = "input.svg") {
  const errors = [];
  const warnings = [];
  const add = (list, line, rule, message, fix) => list.push({ file: filename, line, rule, message, fix });

  // Duplicate attributes make the file invalid XML. Browsers tolerate it (last/first
  // value wins inconsistently), so a malformed file can render "fine" while breaking
  // strict consumers (PPT import, XML tooling) — fail closed here.
  {
    const tagRe = /<[A-Za-z][^>]*>/g;
    let tm;
    while ((tm = tagRe.exec(source))) {
      const tagLine = source.slice(0, tm.index).split("\n").length;
      const seen = new Set();
      for (const am of tm[0].matchAll(/\s([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*(["'])[^"']*\2/g)) {
        const name = am[1];
        if (seen.has(name)) add(errors, tagLine, "E-DUPATTR", `duplicate attribute "${name}" on <${tm[0].match(/<([A-Za-z][A-Za-z0-9-]*)/)[1]}> — invalid XML that browsers silently tolerate`, "keep one value per attribute; strict consumers (PPT import, XML tooling) reject or misread duplicates");
        else seen.add(name);
      }
    }
  }

  const tree = parseTree(source);
  const svgRoot = tree.children.find((c) => c.tag === "svg");
  if (!svgRoot) {
    add(errors, 1, "E-ROOT", "no <svg> root element found", "author a single root <svg> with a viewBox");
    return { errors, warnings };
  }

  // --- root / viewBox ---------------------------------------------------
  let vb = null;
  const vbAttr = svgRoot.attrs.viewBox;
  if (!vbAttr) {
    add(errors, svgRoot.line, "E-ROOT", "root <svg> has no viewBox", 'add viewBox="0 0 W H" matching the intended canvas (SKILL.md §3)');
  } else {
    const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN) || parts[2] <= 0 || parts[3] <= 0) {
      add(errors, svgRoot.line, "E-ROOT", `invalid viewBox "${vbAttr}"`, 'use four numbers: viewBox="0 0 W H" with positive W/H');
    } else {
      vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      const wAttr = px(svgRoot.attrs.width);
      const hAttr = px(svgRoot.attrs.height);
      if ((wAttr !== undefined && Math.abs(wAttr - vb.w) > 0.5) || (hAttr !== undefined && Math.abs(hAttr - vb.h) > 0.5)) {
        add(warnings, svgRoot.line, "W-ROOT", `width/height (${svgRoot.attrs.width}×${svgRoot.attrs.height}) differ from viewBox (${vb.w}×${vb.h})`, "keep width=W height=H equal to the viewBox so 2× render math stays exact");
      }
    }
  }

  // --- styles -----------------------------------------------------------
  // Keep per-<style> source offsets so CSS findings report real lines (F2).
  const styleSegments = [];
  for (const el of walk(svgRoot)) {
    if (el.tag === "style") styleSegments.push({ text: el.text, contentStart: el.contentStart });
  }
  const styleText = styleSegments.map((s) => s.text).join("\n");
  const rules = parseStyles(styleText);

  // --- ids and references ------------------------------------------------
  const ids = new Map();
  for (const el of walk(svgRoot)) {
    const id = el.attrs.id;
    if (!id) continue;
    if (ids.has(id)) add(errors, el.line, "E-ID", `duplicate id "${id}" (first at line ${ids.get(id).line})`, "rename one of the elements; references resolve to the first match only");
    else ids.set(id, el);
  }

  const refs = [];
  const URL_REF_RE = /url\(\s*['"]?#([\w:.-]+)['"]?\s*\)/g;
  for (const el of walk(svgRoot)) {
    for (const [name, value] of Object.entries(el.attrs)) {
      if (name === "href" || name === "xlink:href") {
        if (value.startsWith("#")) refs.push({ id: value.slice(1), line: el.line, via: `${el.tag} ${name}`, el });
      } else if (value.includes("url(")) {
        let m;
        URL_REF_RE.lastIndex = 0;
        while ((m = URL_REF_RE.exec(value)) !== null) refs.push({ id: m[1], line: el.line, via: `${el.tag} ${name}`, el });
      }
    }
  }
  for (const seg of styleSegments) {
    let m;
    URL_REF_RE.lastIndex = 0;
    while ((m = URL_REF_RE.exec(seg.text)) !== null) {
      refs.push({ id: m[1], line: lineOf(source, seg.contentStart + m.index), via: "css", el: null });
    }
  }
  for (const ref of refs) {
    if (!ids.has(ref.id)) add(errors, ref.line, "E-REF", `dangling reference #${ref.id} (via ${ref.via})`, "define the referenced element or remove the reference (SKILL.md §4.3)");
  }

  // --- marker contract ----------------------------------------------------
  // Which markers are actually referenced, and by what stroke widths?
  const markerRefs = new Map(); // id -> Set of stroke widths (numbers) or "unknown"
  const noteMarkerRef = (id, strokeWidth) => {
    if (!markerRefs.has(id)) markerRefs.set(id, new Set());
    markerRefs.get(id).add(strokeWidth ?? "unknown");
  };
  // R5 (R4-CX-F1): marker use is collected per RENDERED ELEMENT with fully
  // resolved declarations — presentation attribute, matching CSS rules (also
  // when marker-* and stroke-width live in separate rules), inline style, and
  // inherited group values all flow through the same inheritedProp path. A
  // CSS rule no element uses is not a marker use (its dangling references are
  // still caught by the E-REF scan above).
  for (const el of walk(svgRoot)) {
    if (el.tag === "style" || hasAncestor(el, ["defs", "symbol", "marker", "clipPath", "mask", "pattern"])) continue;
    for (const attr of ["marker-end", "marker-start", "marker-mid"]) {
      const v = inheritedProp(el, attr, rules); // marker-* inherits like stroke-width
      if (!v) continue;
      const m = v.match(/url\(\s*['"]?#([\w:.-]+)['"]?\s*\)/);
      if (!m) continue;
      const sw = px(inheritedProp(el, "stroke-width", rules));
      noteMarkerRef(m[1], sw);
    }
  }

  for (const [id, widths] of markerRefs) {
    const marker = ids.get(id);
    if (!marker || marker.tag !== "marker") continue; // dangling handled above
    const units = marker.attrs.markerUnits;
    // R4-P2: the SVG default of 3 applies only when the attribute is ABSENT.
    // An explicit value px() cannot parse (e.g. "1e2") must never be replaced
    // by the default — it downgrades the marker to unproven instead.
    const mwParsed = px(marker.attrs.markerWidth);
    const mhParsed = px(marker.attrs.markerHeight);
    const dimUnparsable =
      (marker.attrs.markerWidth !== undefined && mwParsed === undefined) ||
      (marker.attrs.markerHeight !== undefined && mhParsed === undefined);
    const mw = mwParsed ?? 3;
    const knownWidths = [...new Set([...widths].filter((w) => typeof w === "number"))];
    const hasUnknownRef = widths.has("unknown");
    const maxStroke = knownWidths.length ? Math.max(...knownWidths) : undefined;
    if (units !== "userSpaceOnUse") {
      const eff = maxStroke !== undefined ? ` (effective head ≈ ${round1(mw * maxStroke)}px at stroke-width ${maxStroke})` : "";
      add(
        errors,
        marker.line,
        "E-MARKER",
        `marker #${id} is referenced but does not declare markerUnits="userSpaceOnUse"${eff}`,
        maxStroke !== undefined
          ? `set markerUnits="userSpaceOnUse", multiply markerWidth/markerHeight by ${maxStroke} (add viewBox="0 0 ${marker.attrs.markerWidth ?? 3} ${marker.attrs.markerHeight ?? 3}" first if the marker has none) to preserve the current rendered size, then reassess the head size (SKILL.md §3, authoring.md §3)`
          : 'set markerUnits="userSpaceOnUse" with explicit user-space markerWidth/markerHeight (SKILL.md §3, authoring.md §3)',
      );
      continue;
    }
    // Visible-geometry contract (C4 correction): what the eye sees is the
    // glyph extent inside the marker viewport, not the viewport itself. For
    // the canonical open-V (`M2 2 L10 6 L2 10` in viewBox 0 0 12 12) the
    // visible head is markerWidth × 8/12. Aim visible ≈3× the shaft; a newly
    // authored diagram fails visual QA at visible ≈4× or more, and an
    // undersized head (< ≈2.5×) reads weak at fit-to-page scale. Reviewed
    // legacy exceptions declare data-lint-allow="marker-footprint".
    if (ancestorAllows(marker, "marker-footprint")) continue;
    let proof = markerGlyphExtent(marker);
    if (proof.proven && dimUnparsable) {
      proof = { proven: false, reason: "explicit markerWidth/markerHeight is not a plain decimal number" };
    }
    const viewportRatio = maxStroke ? mw / maxStroke : undefined;
    const sizingRule = `for the canonical open-V, viewport ≈ 4.5 × shaft gives a ≈3× visible head (authoring.md §3)`;
    if (proof.proven && knownWidths.length) {
      // R4-P1: a marker reused at several stroke widths is judged per DISTINCT
      // width and the single worst finding survives — the thickest shaft must
      // never mask a thin-shaft violation.
      const visible = mw * (proof.extent / proof.viewBoxW);
      let worst = null; // severity: 3 error ≥4.75 · 2 warn ≥4.0 · 1 warn <2.5 · 0 clean
      for (const sw of knownWidths) {
        const ratio = visible / sw;
        const severity = ratio >= 4.75 ? 3 : ratio >= 4.0 ? 2 : ratio < 2.5 ? 1 : 0;
        if (!worst || severity > worst.severity) worst = { severity, sw, ratio };
      }
      const others = knownWidths.filter((w) => w !== worst.sw);
      const widthNote = others.length ? `; also referenced at ${others.join("px, ")}px` : "";
      const measured = `visible head ≈ ${round1(visible)}px (${round1(worst.ratio)}× its ${worst.sw}px shaft; glyph spans ${round1(proof.extent)}/${round1(proof.viewBoxW)} of the viewport)${widthNote}`;
      if (worst.severity === 3) {
        add(errors, marker.line, "E-HEADSIZE", `arrowhead #${id}: ${measured} — at or beyond the ≈4× visual-fail contract`, `resize the marker viewport (or split per-width markers) — ${sizingRule}; data-lint-allow="marker-footprint" only with a reviewed reason`);
      } else if (worst.severity === 2) {
        add(warnings, marker.line, "W-HEADSIZE", `arrowhead #${id}: ${measured} — at the ≈4× visual-fail line (SKILL.md §7)`, `resize toward ≈3× visible — ${sizingRule}`);
      } else if (worst.severity === 1) {
        add(warnings, marker.line, "W-HEADSIZE", `arrowhead #${id}: ${measured} — below the ≈3× aim; a major-flow head this small can disappear at fit-to-page scale`, `enlarge the marker viewport toward 4.5 × shaft, and check shaft weight for the fit-to-page pass (SKILL.md §7)`);
      }
    } else if (!proof.proven) {
      // R3-P1: an unproven visible size is NEVER a hard error and never a
      // silent pass; the viewport measurement keeps extreme cases visible.
      const extreme = mw > 36 || (viewportRatio !== undefined && viewportRatio > 12)
        ? " — the viewport is extreme, so verify this one first"
        : "";
      const shaftNote = knownWidths.length ? ` on ${knownWidths.join("px/")}px shaft(s)` : "";
      add(warnings, marker.line, "W-HEADSIZE", `arrowhead #${id} visible size is unverified from source (${proof.reason}); viewport ${round1(mw)}px${shaftNote}${extreme}`, "confirm the ≈3× visible proportion in the 2× PNG at fit-to-page scale, or rewrite the glyph in the provable subset (absolute M/L/H/V, plain decimal coordinates, no child transforms, uniform scaling — authoring.md §3)");
    }
    // R4-P1: references whose stroke width cannot be resolved are surfaced
    // separately — a proven-clean marker can still be mis-sized on an edge
    // the linter could not measure.
    if (hasUnknownRef) {
      add(warnings, marker.line, "W-HEADSIZE", `arrowhead #${id} is referenced by edge(s) whose stroke-width could not be resolved — the visible ratio is unverified for those edges`, "resolve the stroke width to a plain value (attribute, class, or inline style), or confirm those edges' head proportion in the 2× PNG (SKILL.md §7)");
    }
  }

  // --- degenerate connector-filter bounds (C4 filter-bounds correction) ----
  // A percentage/objectBoundingBox filter region collapses when the filtered
  // geometry has zero width or height (e.g. a group of collinear horizontal
  // connectors), and Chrome then drops the strokes entirely. The check is
  // deliberately narrow: it fires only when every painted child is provably
  // an axis-aligned straight stroke and the union bbox is degenerate on an
  // axis. Anything unparsable (curves, rects, text, transforms) exits the
  // check silently — visual QA owns those.
  // C4-R3-P1: a userSpaceOnUse region collapses whenever an explicit width or
  // height is not strictly positive — 0, 0%, and negatives all drop the
  // strokes in Chrome. Returns the parsed numeric value when it is provably
  // non-positive, else null (unparsable/omitted → not our call).
  const nonPositiveDim = (v) => {
    if (v === undefined) return null;
    const m = String(v).trim().match(/^(-?[\d.]+)\s*(px|%)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n <= 0 ? `${m[1]}${m[2] ?? ""}` : null;
  };
  for (const el of walk(svgRoot)) {
    if (hasAncestor(el, ["defs", "symbol", "marker", "clipPath", "mask", "pattern"])) continue;
    // C4-R2-P1: CSS wins over the presentation attribute; a class/inline
    // `filter` overriding a safe attr must be the value we resolve. filter:none
    // means no filter. id selectors are covered by declsFor.
    const resolvedFilter = declsFor(el, rules).filter ?? el.attrs.filter;
    if (!resolvedFilter || /^\s*none\s*$/i.test(resolvedFilter)) continue;
    const filterRef = resolvedFilter.match(/url\(\s*['"]?#([\w:.-]+)['"]?\s*\)/);
    if (!filterRef) continue;
    const filterEl = ids.get(filterRef[1]);
    if (!filterEl || filterEl.tag !== "filter") continue; // dangling handled by E-REF
    if (ancestorAllows(el, "filter-bounds")) continue;
    const units = (filterEl.attrs.filterUnits ?? "").trim();
    if (units === "userSpaceOnUse") {
      // C4-R3-P1: a user-space region is safe UNLESS an explicit width/height
      // is non-positive (0, 0%, negative) — those collapse the region. A
      // positive percentage still resolves against the viewport (non-zero).
      const badW = nonPositiveDim(filterEl.attrs.width);
      const badH = nonPositiveDim(filterEl.attrs.height);
      if (badW !== null || badH !== null) {
        const which = badW !== null ? "width" : "height";
        const val = badW !== null ? badW : badH;
        add(errors, el.line, "E-FILTERBOUNDS", `filtered ${el.tag} references #${filterRef[1]} whose userSpaceOnUse filter region has non-positive ${which}="${val}" — Chrome renders nothing through a collapsed filter region`, 'give the filter a strictly positive user-space width/height covering the strokes, or remove the filter (references/sketch.md section 2)');
      } else {
        // C4-R4: an explicit width/height the lint cannot parse (e.g.
        // calc(0px)) may still collapse the region and silently drop the
        // strokes. We do not build a calc() evaluator — surface it as an
        // unverified warning instead of a silent pass. This closes the filter
        // lint scope: further dimension forms are a PNG-verification concern.
        const unverified = ["width", "height"].filter(
          (dim) => filterEl.attrs[dim] !== undefined && !/^\s*-?[\d.]+\s*(px|%)?\s*$/.test(filterEl.attrs[dim]),
        );
        if (unverified.length) {
          const parts = unverified.map((dim) => `${dim}="${filterEl.attrs[dim]}"`).join(", ");
          add(warnings, el.line, "W-FILTERBOUNDS", `filtered ${el.tag} references #${filterRef[1]} whose userSpaceOnUse filter region has an unsupported ${parts} — the lint cannot prove it is non-zero, and a collapsed region would silently drop these strokes`, "use a plain positive user-space length/percentage for the filter width/height, or verify the strokes render in the 2× PNG (references/sketch.md section 2)");
        }
      }
      continue;
    }
    // objectBoundingBox (default or explicit): a percentage region collapses
    // when the painted connector geometry is degenerate on an axis.
    const box = provableStrokeBBox(el, rules);
    if (!box) continue; // not provable — no false certainty
    const EPS = 0.01;
    const flatY = box.maxY - box.minY <= EPS;
    const flatX = box.maxX - box.minX <= EPS;
    if (flatY || flatX) {
      const axis = flatY ? "zero height (collinear horizontal strokes)" : "zero width (collinear vertical strokes)";
      add(errors, el.line, "E-FILTERBOUNDS", `filtered ${el.tag} references #${filterRef[1]} (objectBoundingBox percentage region) but its painted connector geometry has ${axis} — Chrome collapses the filter region and drops these strokes entirely`, 'remove the filter from these strokes, give the filter filterUnits="userSpaceOnUse" with an explicit non-zero region, or group the strokes with two-dimensional geometry (references/sketch.md section 2)');
    }
  }

  // --- collect rects for containment/bounds -------------------------------
  const rects = [];
  for (const el of walk(svgRoot)) {
    if (el.tag !== "rect" || hasAncestor(el, ["defs", "symbol", "marker", "clipPath", "mask", "pattern"])) continue;
    const t = resolveTransform(el);
    const x = px(el.attrs.x) ?? 0;
    const y = px(el.attrs.y) ?? 0;
    const w = px(el.attrs.width);
    const h = px(el.attrs.height);
    if (w === undefined || h === undefined) continue;
    rects.push({ el, x: x + t.dx, y: y + t.dy, w, h, uncertain: t.uncertain });
  }

  // --- obvious root-bounds violations -------------------------------------
  if (vb) {
    const SLACK = 2;
    for (const r of rects) {
      if (r.uncertain) continue;
      if (r.x < vb.x - SLACK || r.y < vb.y - SLACK || r.x + r.w > vb.x + vb.w + SLACK || r.y + r.h > vb.y + vb.h + SLACK) {
        add(errors, r.el.line, "E-BOUNDS", `rect (${round1(r.x)},${round1(r.y)} ${round1(r.w)}×${round1(r.h)}) extends outside the ${vb.w}×${vb.h} viewBox`, "recompute the layout so every element sits inside the canvas margins (SKILL.md §2)");
      }
    }
  }

  // --- opt-in layout geometry contracts ---------------------------------
  // Generic SVG is too varied for a reliable universal overlap detector.
  // Authors opt in only the repeated structures that the skill can prove:
  // page-title headers, panel headers, and icon/text cards. Text in these groups must use a centered
  // baseline so its source-coordinate line box can be derived from y, dy, and
  // font-size. Rendered ink and optical centering still belong to PNG QA.
  const roleOf = (el) => el.attrs["data-layout-role"];
  const descendantsWithRole = (group, roles) => [...walk(group)].filter((el) => roles.includes(roleOf(el)));
  const lineBox = (el) => {
    if (el.tag !== "text") return { proven: false, reason: `role is on <${el.tag}>, not <text>` };
    const lineAt = (lineEl, y) => {
      const fs = px(inheritedProp(lineEl, "font-size", rules));
      const baseline = String(inheritedProp(lineEl, "dominant-baseline", rules) ?? "").trim().toLowerCase();
      const t = resolveTransform(lineEl);
      if (t.uncertain) return { proven: false, reason: "non-translate transform present" };
      if (y === undefined || fs === undefined) return { proven: false, reason: "plain y/dy and font-size are required" };
      if (!["middle", "central"].includes(baseline)) {
        return { proven: false, reason: 'dominant-baseline must be "middle" or "central"' };
      }
      const center = y + t.dy;
      return { proven: true, top: center - fs / 2, bottom: center + fs / 2 };
    };

    let currentY = px(el.attrs.y);
    const boxes = [];
    const ownText = decodeEntities(el.text.trim());
    if (ownText) boxes.push(lineAt(el, currentY));
    const tspans = el.children.filter((child) => child.tag === "tspan");
    if (el.children.some((child) => child.tag === "tspan" && child.children.some((nested) => nested.tag === "tspan"))) {
      return { proven: false, reason: "nested tspan text is outside the provable subset" };
    }
    for (const ts of tspans) {
      const absoluteY = px(ts.attrs.y);
      const dy = px(ts.attrs.dy);
      if (ts.attrs.y !== undefined && absoluteY === undefined) return { proven: false, reason: "tspan y must be a plain number" };
      if (ts.attrs.dy !== undefined && dy === undefined) return { proven: false, reason: "tspan dy must be a plain number" };
      if (absoluteY !== undefined) currentY = absoluteY;
      if (dy !== undefined && currentY === undefined) return { proven: false, reason: "tspan dy needs a resolvable parent y or absolute y" };
      if (dy !== undefined) currentY += dy;
      if (currentY === undefined) return { proven: false, reason: "tspan needs a resolvable parent y, y, or dy" };
      if (decodeEntities(ts.text.trim())) boxes.push(lineAt(ts, currentY));
    }
    if (!boxes.length) return { proven: false, reason: "layout text has no measurable line" };
    const unproven = boxes.find((box) => !box.proven);
    if (unproven) return unproven;
    return {
      proven: true,
      top: Math.min(...boxes.map((box) => box.top)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
      lineCount: boxes.length,
    };
  };
  const clusterBox = (elements) => {
    const boxes = elements.map((el) => ({ el, box: lineBox(el) }));
    const unproven = boxes.find(({ box }) => !box.proven);
    if (unproven) return { proven: false, el: unproven.el, reason: unproven.box.reason };
    return {
      proven: true,
      top: Math.min(...boxes.map(({ box }) => box.top)),
      bottom: Math.max(...boxes.map(({ box }) => box.bottom)),
      lineCount: boxes.reduce((sum, { box }) => sum + box.lineCount, 0),
    };
  };

  for (const group of walk(svgRoot)) {
    const definitionTags = ["defs", "symbol", "marker", "clipPath", "mask", "pattern"];
    if (definitionTags.includes(group.tag) || hasAncestor(group, definitionTags)) continue;
    if (ancestorAllows(group, "layout-geometry")) continue;
    const role = roleOf(group);
    if (role === "page-title-header") {
      const topPadding = px(group.attrs["data-layout-rail-padding-top"]);
      const bottomPadding = px(group.attrs["data-layout-rail-padding-bottom"]);
      const subtitleGap = px(group.attrs["data-layout-subtitle-gap"]);
      const toleranceRaw = group.attrs["data-layout-tolerance"];
      const parsedTolerance = px(toleranceRaw);
      const tolerance = toleranceRaw === undefined || parsedTolerance === undefined || parsedTolerance < 0 || parsedTolerance > 8 ? 2 : parsedTolerance;
      const gt = resolveTransform(group);
      const rails = descendantsWithRole(group, ["title-rail"]);
      const eyebrows = descendantsWithRole(group, ["title-eyebrow"]);
      const titles = descendantsWithRole(group, ["title-line"]);
      const subtitles = descendantsWithRole(group, ["title-subtitle"]);
      if ([topPadding, bottomPadding, subtitleGap].some((n) => n === undefined || n < 0) || rails.length !== 1 || rails[0].tag !== "rect" || eyebrows.length !== 1 || titles.length < 1 || titles.length > 2 || subtitles.length !== 1) {
        add(errors, group.line, "E-LAYOUT", "page-title-header contract requires non-negative numeric rail padding/subtitle gap, one title-rail rect, one title-eyebrow text, one or two title-line texts, and one title-subtitle text", "complete the page-title-header roles and numeric budget or remove the annotation (authoring.md §1)");
        continue;
      }
      if (gt.uncertain) {
        add(warnings, group.line, "W-LAYOUT", "page-title-header geometry is unverified because a non-translate transform is present", "use translate() only or verify the title rail manually in the 2× PNG (authoring.md §1)");
        continue;
      }
      if (toleranceRaw !== undefined && (parsedTolerance === undefined || parsedTolerance < 0)) {
        add(warnings, group.line, "W-LAYOUT", `page-title-header tolerance "${toleranceRaw}" is unsupported; the 2px default was used`, 'use a plain 0–8px tolerance or data-lint-allow="layout-geometry" with a reviewed reason (authoring.md §1)');
      } else if (parsedTolerance !== undefined && parsedTolerance > 8) {
        add(warnings, group.line, "W-LAYOUT", `page-title-header tolerance ${parsedTolerance}px exceeds the 8px review threshold; the 2px default was used`, 'use 0–8px or data-lint-allow="layout-geometry" with a reviewed reason (authoring.md §1)');
      }
      const eyebrow = lineBox(eyebrows[0]);
      const titleBox = clusterBox(titles);
      const subtitle = lineBox(subtitles[0]);
      if ([eyebrow, titleBox, subtitle].some((box) => !box.proven && box.reason === "layout text has no measurable line")) {
        add(errors, group.line, "E-LAYOUT", "page-title-header contract requires every eyebrow/title/subtitle role to contain measurable text", "add visible text content or remove the empty layout role (authoring.md §1)");
        continue;
      }
      const railYRaw = localGeometryProp(rails[0], "y", rules);
      const railY = railYRaw === undefined ? 0 : px(railYRaw);
      const railH = px(localGeometryProp(rails[0], "height", rules));
      const railWidthRaw = localGeometryProp(rails[0], "width", rules);
      const railW = px(railWidthRaw);
      const rt = resolveTransform(rails[0]);
      if (railH !== undefined && railH <= 0) {
        add(errors, group.line, "E-LAYOUT", "page-title-header title-rail height must be greater than zero", "compute a positive rail height from the eyebrow and final title line (authoring.md §1)");
        continue;
      }
      if (railW !== undefined && railW <= 0) {
        add(errors, group.line, "E-LAYOUT", "page-title-header title-rail width must be greater than zero", "use a visible positive rail width (authoring.md §1)");
        continue;
      }
      if (!eyebrow.proven || !titleBox.proven || !subtitle.proven || railY === undefined || railH === undefined || railW === undefined || rt.uncertain) {
        const reason = !eyebrow.proven ? eyebrow.reason : !titleBox.proven ? titleBox.reason : !subtitle.proven ? subtitle.reason : railW === undefined ? "title rail needs a plain positive width" : "title rail needs plain y/height and a translate-only transform";
        add(warnings, group.line, "W-LAYOUT", `page-title-header geometry is unverified: ${reason}`, "use plain centered-baseline text and rect geometry so the pre-render rail check can prove the stack (authoring.md §1)");
        continue;
      }
      if (titleBox.lineCount < 1 || titleBox.lineCount > 2) {
        add(errors, group.line, "E-LAYOUT", `page-title-header supports one or two measurable title lines; found ${titleBox.lineCount}`, "split the title into one or two measurable lines or remove the premium page-title contract (authoring.md §1)");
        continue;
      }
      const expectedTop = eyebrow.top - topPadding;
      const expectedBottom = titleBox.bottom + bottomPadding;
      const railTop = railY + rt.dy;
      const railBottom = railTop + railH;
      const violations = [];
      if (Math.abs(railTop - expectedTop) > tolerance) violations.push(`rail top differs from eyebrow budget by ${round1(Math.abs(railTop - expectedTop))}px`);
      if (Math.abs(railBottom - expectedBottom) > tolerance) violations.push(`rail bottom differs from final title line by ${round1(Math.abs(railBottom - expectedBottom))}px`);
      if (subtitle.top < titleBox.bottom + subtitleGap - 0.01) violations.push(`title/subtitle gap is ${round1(subtitle.top - titleBox.bottom)}px; needs ${subtitleGap}px`);
      if (railBottom > subtitle.top - subtitleGap + 0.01) violations.push(`rail bottom leaves ${round1(subtitle.top - railBottom)}px before the subtitle; needs ${subtitleGap}px`);
      if (violations.length) {
        add(errors, group.line, "E-LAYOUT", `page-title-header rail budget failed: ${violations.join("; ")}`, "derive rail y/height from the eyebrow and final title line before rendering (SKILL.md §2, authoring.md §1)");
      }
    } else if (role === "marker-label-row") {
      // 공통 primitive (design-kernel §6 파생): marker(rect|circle) + 단일행 label을
      // 하나의 atomic row로 취급 — markerCenterY = labelLineCenterY. eyebrow 외에도
      // legend·callout·section label의 작은 marker+label 조합에 재사용한다.
      const kids = group.children ?? [];
      const marker = kids.find((k) => k.tag === "rect" || k.tag === "circle");
      const label = kids.find((k) => k.tag === "text");
      const tolRaw = px(group.attrs["data-layout-tolerance"]);
      const tol = tolRaw === undefined || tolRaw < 0 || tolRaw > 8 ? 2 : tolRaw;
      if (!marker || !label) {
        add(errors, group.line, "E-LAYOUT", "marker-label-row requires exactly one rect/circle marker and one text label as direct children", "restructure the row or remove the annotation (design-kernel §6)");
      } else if (label.attrs["dominant-baseline"] !== "central") {
        add(errors, group.line, "E-LAYOUT", "marker-label-row label must use dominant-baseline=\"central\" — centering is provable only against the line center", "set dominant-baseline=central on the label (design-kernel §6)");
      } else {
        let mc;
        if (marker.tag === "rect") {
          const my = px(marker.attrs.y), mh = px(marker.attrs.height);
          mc = my !== undefined && mh !== undefined ? my + mh / 2 : undefined;
        } else {
          mc = px(marker.attrs.cy);
        }
        const ly = px(label.attrs.y);
        if (mc === undefined || ly === undefined) {
          add(warnings, group.line, "W-LAYOUT", "marker-label-row geometry is unverified (need numeric marker y/height|cy and label y)", "use plain numeric geometry (design-kernel §6)");
        } else if (Math.abs(mc - ly) > tol) {
          add(errors, group.line, "E-LAYOUT", `marker-label-row misaligned: marker center ${round1(mc)} vs label line center ${round1(ly)} (>${tol}px) — markerCenterY must equal labelLineCenterY`, "derive the marker y from the label line center; per-file nudges are forbidden (design-kernel §6)");
        }
      }
    } else if (role === "header-cluster") {
      // H-C editorial stack contract (design-kernel §6): optional eyebrow row with a
      // derived --focus locator → H1 (1–2 lines) → optional subtitle. Locator exists
      // only with the eyebrow and derives from it (≈0.6×, accepted band 0.5–0.7).
      const gt = resolveTransform(group);
      const locators = descendantsWithRole(group, ["cluster-locator"]);
      const keylines = descendantsWithRole(group, ["cluster-keyline"]);
      const eyebrows = descendantsWithRole(group, ["cluster-eyebrow"]);
      const h1s = descendantsWithRole(group, ["cluster-h1"]);
      const subtitles = descendantsWithRole(group, ["cluster-subtitle"]);
      const toleranceRaw = group.attrs["data-layout-tolerance"];
      const parsedTolerance = px(toleranceRaw);
      const tolerance = toleranceRaw === undefined || parsedTolerance === undefined || parsedTolerance < 0 || parsedTolerance > 8 ? 2 : parsedTolerance;
      if (h1s.length < 1 || locators.length > 1 || keylines.length > 1 || eyebrows.length > 1 || subtitles.length > 1) {
        add(errors, group.line, "E-LAYOUT", "header-cluster contract requires at least one cluster-h1 and at most one cluster-locator/cluster-keyline/cluster-eyebrow/cluster-subtitle", "complete the header-cluster roles or remove the annotation (design-kernel §6)");
        continue;
      }
      if (locators.length === 1 && keylines.length === 1) {
        add(errors, group.line, "E-LAYOUT", "header-cluster carries both a cluster-keyline and a cluster-locator — the keyline replaces the square locator, never doubles it", "keep exactly one header accent (design-kernel §6)");
        continue;
      }
      if (locators.length === 1 && eyebrows.length === 0) {
        add(errors, group.line, "E-LAYOUT", "header-cluster locator exists without an eyebrow — the locator collapses with the eyebrow row", "remove the locator (H-B minimal variant) or restore the eyebrow (design-kernel §6)");
        continue;
      }
      if (gt.uncertain) {
        add(warnings, group.line, "W-LAYOUT", "header-cluster geometry is unverified because a non-translate transform is present", "use translate() only or verify the header manually in the 2× PNG (design-kernel §6)");
        continue;
      }
      const h1Box = clusterBox(h1s);
      const eyebrowBox = eyebrows.length ? lineBox(eyebrows[0]) : null;
      const subtitleBox = subtitles.length ? lineBox(subtitles[0]) : null;
      if (!h1Box.proven || (eyebrowBox && !eyebrowBox.proven) || (subtitleBox && !subtitleBox.proven)) {
        const reason = !h1Box.proven ? h1Box.reason : eyebrowBox && !eyebrowBox.proven ? eyebrowBox.reason : subtitleBox.reason;
        add(warnings, group.line, "W-LAYOUT", `header-cluster geometry is unverified: ${reason}`, "use plain measurable text so the cluster check can prove the stack (design-kernel §6)");
        continue;
      }
      if (h1Box.lineCount < 1 || h1Box.lineCount > 2) {
        add(errors, group.line, "E-LAYOUT", `header-cluster supports one or two H1 lines; found ${h1Box.lineCount}`, "keep the title to one or two lines (design-kernel §6)");
        continue;
      }
      const violations = [];
      // 2줄 H1은 x가 tspan에 있다 — 첫 tspan의 시작선을 H1 left edge로 삼는다
      const h1X = px(h1s[0].attrs.x ?? h1s[0].children.find((c) => c.tag === "tspan")?.attrs.x);
      if (locators.length === 1) {
        const loc = locators[0];
        if (loc.tag !== "rect") violations.push("cluster-locator must be a rect");
        const locH = px(localGeometryProp(loc, "height", rules));
        const locW = px(localGeometryProp(loc, "width", rules));
        const locX = px(localGeometryProp(loc, "x", rules));
        const eyFont = px(eyebrows[0].attrs["font-size"]);
        if (locH === undefined || locW === undefined || eyFont === undefined) {
          add(warnings, group.line, "W-LAYOUT", "header-cluster locator/eyebrow sizes are unverified (need plain numeric width/height/font-size)", "use plain numeric geometry (design-kernel §6)");
          continue;
        }
        const ratio = locH / eyFont;
        if (ratio < 0.5 - 0.001 || ratio > 0.7 + 0.001) violations.push(`locator height ${round1(locH)}px is ${round1(ratio * 100) / 100}× the eyebrow size — the derived band is 0.5–0.7×`);
        const eyX = px(eyebrows[0].attrs.x);
        if (locX !== undefined && h1X !== undefined && Math.abs(locX - h1X) > tolerance) violations.push(`locator x ${round1(locX)} is not aligned with the H1 left edge ${round1(h1X)}`);
        if (locX !== undefined && eyX !== undefined && (eyX - (locX + locW) < 4 || eyX - (locX + locW) > 14)) violations.push(`eyebrow starts ${round1(eyX - (locX + locW))}px after the locator; expected a 4–14px gap`);
        // marker-label-row 산식: markerCenterY = labelLineCenterY (파일별 수기 보정 금지)
        const locY = px(localGeometryProp(loc, "y", rules));
        const eyY = px(eyebrows[0].attrs.y);
        const eyCentral = eyebrows[0].attrs["dominant-baseline"] === "central";
        if (locY !== undefined && eyY !== undefined) {
          if (!eyCentral) violations.push("locator/eyebrow centering is provable only with dominant-baseline=\"central\" on the eyebrow");
          else {
            const dc = Math.abs((locY + locH / 2) - eyY);
            if (dc > tolerance) violations.push(`locator center ${round1(locY + locH / 2)} is ${round1(dc)}px off the eyebrow line center ${round1(eyY)} — markerCenterY must equal labelLineCenterY`);
          }
        }
      }
      if (keylines.length === 1) {
        // title-keyline 산식(design-kernel §6): 세로 keyline은 H1 line-box에서만
        // 파생한다 — top = titleTop − pad, bottom = titleBottom + pad(동일 pad),
        // eyebrow~subtitle 전체를 감싸는 구형 rail 복원 금지, 텍스트 시작선 단일 정렬.
        const key = keylines[0];
        if (key.tag !== "rect") violations.push("cluster-keyline must be a rect");
        const ky = px(localGeometryProp(key, "y", rules));
        const kh = px(localGeometryProp(key, "height", rules));
        const kx = px(localGeometryProp(key, "x", rules));
        const kw = px(localGeometryProp(key, "width", rules));
        if (ky === undefined || kh === undefined || kx === undefined || kw === undefined) {
          add(warnings, group.line, "W-LAYOUT", "header-cluster keyline geometry is unverified (need plain numeric x/y/width/height)", "use plain numeric geometry (design-kernel §6)");
          continue;
        }
        const padTop = h1Box.top - ky, padBottom = (ky + kh) - h1Box.bottom;
        if (padTop < -tolerance || padBottom < -tolerance) violations.push(`keyline ${round1(ky)}..${round1(ky + kh)} does not cover the H1 line-box ${round1(h1Box.top)}..${round1(h1Box.bottom)}`);
        if (Math.abs(padTop - padBottom) > tolerance) violations.push(`keyline pads are asymmetric (top ${round1(padTop)}px vs bottom ${round1(padBottom)}px) — both ends derive from the H1 line-box with one pad`);
        if (eyebrowBox && ky < eyebrowBox.bottom - tolerance) violations.push(`keyline top ${round1(ky)} reaches the eyebrow (bottom ${round1(eyebrowBox.bottom)}) — the keyline derives from the H1 line-box only, not the eyebrow~subtitle stack`);
        if (subtitleBox && ky + kh > subtitleBox.top + tolerance) violations.push(`keyline bottom ${round1(ky + kh)} reaches the subtitle (top ${round1(subtitleBox.top)}) — the keyline derives from the H1 line-box only`);
        if (h1X !== undefined && kx + kw >= h1X) violations.push(`keyline right edge ${round1(kx + kw)} is not left of the text start line ${round1(h1X)}`);
        const eyX2 = eyebrows.length ? px(eyebrows[0].attrs.x) : undefined;
        if (eyX2 !== undefined && h1X !== undefined && Math.abs(eyX2 - h1X) > tolerance) violations.push(`eyebrow x ${round1(eyX2)} is not on the single text start line ${round1(h1X)} — keyline mode aligns eyebrow/H1/subtitle starts`);
      }
      if (eyebrowBox && eyebrowBox.bottom > h1Box.top + tolerance) violations.push(`eyebrow bottom ${round1(eyebrowBox.bottom)} intrudes into the H1 top ${round1(h1Box.top)}`);
      if (subtitleBox) {
        const subX = px(subtitles[0].attrs.x);
        if (subX !== undefined && h1X !== undefined && Math.abs(subX - h1X) > tolerance) violations.push(`subtitle x ${round1(subX)} is not aligned with the H1 left edge ${round1(h1X)}`);
        if (subtitleBox.top < h1Box.bottom + 4 - 0.01) violations.push(`subtitle top ${round1(subtitleBox.top)} intrudes into the H1 bottom ${round1(h1Box.bottom)} (needs ≥4px)`);
      }
      const contentTop = px(group.attrs["data-layout-content-top"]);
      const breathing = px(group.attrs["data-layout-breathing"]);
      if (contentTop !== undefined && breathing !== undefined) {
        const clusterBottom = subtitleBox ? subtitleBox.bottom : h1Box.bottom;
        if (contentTop - clusterBottom < breathing - tolerance) violations.push(`content top ${round1(contentTop)} leaves ${round1(contentTop - clusterBottom)}px of breathing; the declared budget is ${breathing}px`);
      }
      if (violations.length) {
        add(errors, group.line, "E-LAYOUT", `header-cluster contract failed: ${violations.join("; ")}`, "derive the locator/gaps from the computed cluster bounds (design-kernel §6, skin.mjs pageframe)");
      }
    } else if (role === "panel-header") {
      const top = px(group.attrs["data-layout-top"]);
      const bottom = px(group.attrs["data-layout-bottom"]);
      const gap = px(group.attrs["data-layout-gap"]);
      const padTop = px(group.attrs["data-layout-padding-top"]);
      const padBottom = px(group.attrs["data-layout-padding-bottom"]);
      const gt = resolveTransform(group);
      if ([top, bottom, gap, padTop, padBottom].some((n) => n === undefined) || gt.uncertain) {
        add(warnings, group.line, "W-LAYOUT", "panel-header geometry is unverified because its numeric budget or transform is unsupported", 'use plain data-layout-top/bottom/gap/padding-top/padding-bottom values and translate() only (authoring.md §4)');
        continue;
      }
      const titles = descendantsWithRole(group, ["header-title"]);
      const subtitles = descendantsWithRole(group, ["header-subtitle"]);
      const dividers = descendantsWithRole(group, ["header-divider"]);
      if (titles.length !== 1 || subtitles.length !== 1 || dividers.length !== 1 || dividers[0].tag !== "line") {
        add(errors, group.line, "E-LAYOUT", "panel-header contract requires exactly one header-title text, one header-subtitle text, and one header-divider line", "add the three data-layout-role children or remove the panel-header annotation (authoring.md §4)");
        continue;
      }
      const title = lineBox(titles[0]);
      const subtitle = lineBox(subtitles[0]);
      const divider = dividers[0];
      const dt = resolveTransform(divider);
      const y1 = px(divider.attrs.y1);
      const y2 = px(divider.attrs.y2);
      const strokeRaw = inheritedProp(divider, "stroke-width", rules);
      const strokeWidth = strokeRaw === undefined ? 1 : px(strokeRaw);
      if (!title.proven || !subtitle.proven || dt.uncertain || y1 === undefined || y2 === undefined || Math.abs(y1 - y2) > 0.01 || strokeWidth === undefined) {
        const reason = !title.proven ? title.reason : !subtitle.proven ? subtitle.reason : strokeWidth === undefined ? "divider stroke-width must be a plain number" : "divider must be a horizontal line with plain y1/y2";
        add(warnings, group.line, "W-LAYOUT", `panel-header geometry is unverified: ${reason}`, 'use centered-baseline text with plain y/font-size and a horizontal <line> divider (authoring.md §4)');
        continue;
      }
      const frameTop = top + gt.dy;
      const frameBottom = bottom + gt.dy;
      const dividerY = y1 + dt.dy;
      const dividerTop = dividerY - strokeWidth / 2;
      const dividerBottom = dividerY + strokeWidth / 2;
      const violations = [];
      if (title.top < frameTop + padTop - 0.01) violations.push(`title starts ${round1(frameTop + padTop - title.top)}px inside the top padding`);
      if (subtitle.top < title.bottom + gap - 0.01) violations.push(`title/subtitle gap is ${round1(subtitle.top - title.bottom)}px; needs ${gap}px`);
      if (dividerTop < subtitle.bottom + padBottom - 0.01) violations.push(`subtitle/divider visual gap is ${round1(dividerTop - subtitle.bottom)}px; needs ${padBottom}px`);
      if (dividerBottom > frameBottom + 0.01) violations.push(`divider visual edge is ${round1(dividerBottom - frameBottom)}px below the header budget`);
      if (violations.length) {
        add(errors, group.line, "E-LAYOUT", `panel-header vertical budget failed: ${violations.join("; ")}`, "recompute header height and y positions before rendering (SKILL.md §2, authoring.md §4)");
      } else {
        const unused = frameBottom - dividerBottom;
        const slackLimit = Math.max(16, gap);
        if (unused > slackLimit) {
          add(warnings, group.line, "W-LAYOUT", `panel-header declares ${round1(unused)}px below its divider; more than the ${slackLimit}px slack allowance`, "tighten data-layout-bottom so downstream regions do not inherit accidental empty space (authoring.md §4)");
        }
      }
    } else if (role === "icon-text-card") {
      const targetRaw = group.attrs["data-layout-center-y"];
      const target = px(targetRaw);
      const toleranceRaw = group.attrs["data-layout-center-tolerance"];
      const parsedTolerance = px(toleranceRaw);
      const tolerance = toleranceRaw === undefined || parsedTolerance === undefined || parsedTolerance < 0 ? 2 : parsedTolerance;
      const gt = resolveTransform(group);
      const frames = descendantsWithRole(group, ["card-frame"]);
      const icons = descendantsWithRole(group, ["icon-center"]);
      const texts = descendantsWithRole(group, ["card-title", "card-body"]);
      if (targetRaw === undefined || target === undefined || frames.length !== 1 || frames[0].tag !== "rect" || icons.length !== 1 || icons[0].tag !== "circle" || texts.length === 0) {
        add(errors, group.line, "E-LAYOUT", "icon-text-card contract requires a plain data-layout-center-y, exactly one card-frame rect, exactly one icon-center circle, and at least one card-title/card-body text", "complete the declared card contract or remove the icon-text-card annotation (authoring.md §7)");
        continue;
      }
      if (gt.uncertain) {
        add(warnings, group.line, "W-LAYOUT", "icon-text-card geometry is unverified because a non-translate transform is present", "use translate() only or verify the card manually in the 2× PNG (authoring.md §7)");
        continue;
      }
      if (toleranceRaw !== undefined && (parsedTolerance === undefined || parsedTolerance < 0)) {
        add(warnings, group.line, "W-LAYOUT", `icon-text-card tolerance "${toleranceRaw}" is unsupported; the 2px default was used`, 'use a plain 0–8px tolerance or data-lint-allow="layout-geometry" with a reviewed reason (authoring.md §7)');
      } else if (tolerance > 8) {
        add(warnings, group.line, "W-LAYOUT", `icon-text-card tolerance ${tolerance}px exceeds the 8px review threshold and can conceal visible drift`, 'use 0–8px or data-lint-allow="layout-geometry" with a reviewed reason (authoring.md §7)');
      }
      const frameYRaw = frames[0].attrs.y;
      const frameY = frameYRaw === undefined ? 0 : px(frameYRaw);
      const frameH = px(frames[0].attrs.height);
      const ft = resolveTransform(frames[0]);
      const iconCy = px(icons[0].attrs.cy);
      const it = resolveTransform(icons[0]);
      const textBox = clusterBox(texts);
      if (!textBox.proven && textBox.reason === "layout text has no measurable line") {
        add(errors, group.line, "E-LAYOUT", "icon-text-card contract requires every card-title/card-body text to contain at least one measurable line", "add visible text content or remove the empty layout role (authoring.md §7)");
        continue;
      }
      if (frameY === undefined || frameH === undefined || ft.uncertain || iconCy === undefined || it.uncertain || !textBox.proven) {
        const reason = !textBox.proven ? textBox.reason : frameY === undefined || frameH === undefined || ft.uncertain ? "card frame needs plain y/height and a translate-only transform" : "icon circle needs a plain cy and translate-only transform";
        add(warnings, group.line, "W-LAYOUT", `icon-text-card geometry is unverified: ${reason}`, "use plain card-frame, circle, and centered-baseline text geometry so the pre-render center check can prove the cluster (authoring.md §7)");
        continue;
      }
      const targetY = target + gt.dy;
      const frameCenterY = frameY + frameH / 2 + ft.dy;
      const actualIconY = iconCy + it.dy;
      const textCenterY = (textBox.top + textBox.bottom) / 2;
      const violations = [];
      if (Math.abs(frameCenterY - targetY) > tolerance) violations.push(`card-frame center differs from target by ${round1(Math.abs(frameCenterY - targetY))}px`);
      if (Math.abs(actualIconY - targetY) > tolerance) violations.push(`icon center differs from target by ${round1(Math.abs(actualIconY - targetY))}px`);
      if (Math.abs(textCenterY - targetY) > tolerance) violations.push(`text-cluster center differs from target by ${round1(Math.abs(textCenterY - targetY))}px`);
      if (violations.length) {
        add(errors, group.line, "E-LAYOUT", `icon-text-card center alignment failed: ${violations.join("; ")} (tolerance ${tolerance}px)`, "derive the frame, icon, and text-cluster centers from the same card center before rendering (SKILL.md §2, authoring.md §7)");
      }
    }
  }

  // --- high-confidence text overflow ---------------------------------------
  for (const el of walk(svgRoot)) {
    if (el.tag !== "text" || hasAncestor(el, ["defs", "symbol", "marker"])) continue;
    if (ancestorAllows(el, "text-overflow")) continue;
    const t = resolveTransform(el);
    const textDecls = declsFor(el, rules);
    const fontSize = px(el.attrs["font-size"]) ?? px(textDecls["font-size"]);
    const anchorDefault = el.attrs["text-anchor"] ?? textDecls["text-anchor"] ?? "start";
    const weight = el.attrs["font-weight"] ?? textDecls["font-weight"] ?? "";
    const boldDefault = weight === "bold" || parseInt(weight, 10) >= 600;
    const lsDefault = px(el.attrs["letter-spacing"] ?? textDecls["letter-spacing"]) ?? 0;
    const baseX = px(el.attrs.x);

    const embeddedFamilies = fontFaceFamilies(styleText);
    const family = String(inheritedProp(el, "font-family", rules) ?? "").toLowerCase();
    const customFont = [...embeddedFamilies].some((f) => family.includes(f)) || family.includes("cursive");

    // Lines: the text element's own direct content (if any), plus each tspan.
    const lines = [];
    const tspans = el.children.filter((c) => c.tag === "tspan");
    const ownText = decodeEntities(el.text.trim());
    if (ownText) lines.push({ text: ownText, x: baseX, line: el.line, el });
    for (const ts of tspans) {
      const tsText = decodeEntities(ts.text.trim());
      if (!tsText) continue;
      const decls = declsFor(ts, rules);
      lines.push({
        text: tsText,
        x: px(ts.attrs.x) ?? baseX,
        line: ts.line,
        el: ts,
        fontSize: px(ts.attrs["font-size"]) ?? px(decls["font-size"]),
        anchor: ts.attrs["text-anchor"] ?? decls["text-anchor"],
        bold: (() => {
          const w = ts.attrs["font-weight"] ?? decls["font-weight"];
          return w === undefined ? undefined : w === "bold" || parseInt(w, 10) >= 600;
        })(),
      });
    }

    for (const ln of lines) {
      if (ln.x === undefined) continue;
      const fs = ln.fontSize ?? fontSize;
      if (fs === undefined) {
        add(warnings, ln.line, "W-TEXT", `text "${clip(ln.text)}" has no resolvable font-size; overflow not checked`, "set font-size via class in the single <style> block or an explicit attribute");
        continue;
      }
      const anchorX = ln.x + t.dx;
      const yAttr = px(ln.el.attrs?.y) ?? px(el.attrs.y);
      const anchorY = yAttr === undefined ? undefined : yAttr + t.dy;
      const container = smallestContaining(rects, anchorX, anchorY);
      if (!container) continue; // free-standing label (edge label, title) — out of scope
      if (t.uncertain || container.uncertain) {
        add(warnings, ln.line, "W-TEXT", `text "${clip(ln.text)}" sits under a non-translate transform; overflow estimate skipped`, "verify this label visually in the 2× PNG (only translate() is machine-checked)");
        continue;
      }
      if (ancestorAllows(container.el, "text-overflow")) continue;
      const bold = ln.bold ?? boldDefault;
      const estW = estimateWidth(ln.text, fs, bold, lsDefault);
      const anchor = ln.anchor ?? anchorDefault;
      let left = anchorX;
      let right = anchorX + estW;
      if (anchor === "middle") { left = anchorX - estW / 2; right = anchorX + estW / 2; }
      else if (anchor === "end") { left = anchorX - estW; right = anchorX; }
      const PAD = 8; // deliberately looser than the authored 10–16px padding: high-confidence only
      const overflowR = right - (container.x + container.w - PAD);
      const overflowL = (container.x + PAD) - left;
      const threshold = Math.max(10, estW * 0.08); // stay outside the estimator's error band
      for (const [side, overflow] of [["right", overflowR], ["left", overflowL]]) {
        if (overflow > threshold && !customFont) {
          add(errors, ln.line, "E-TEXT", `"${clip(ln.text)}" overflows its box ${side} edge by ≈${round1(overflow)}px (est. width ${round1(estW)}px @ ${fs}px, box ${round1(container.w)}px wide)`, "shorten/abbreviate the line, split it into another <tspan>, or widen the box per the §2 text budget");
        } else if (overflow > 0) {
          const label = customFont ? "custom/embedded font — width estimate is low-confidence" : "estimate";
          add(warnings, ln.line, "W-TEXT", `"${clip(ln.text)}" may overflow its box ${side} edge by ≈${round1(overflow)}px (${label})`, "re-check this label in the 2× PNG; consider a shorter line or wider box");
        }
      }
    }
  }

  return { errors, warnings };
}

// Horizontal glyph extent of a marker's drawable children — but ONLY when it
// is exactly provable from source (R2-P1: no rendered-extent guessing).
// Provable subset:
//   - path with absolute straight commands only (M/L/H/V/Z) — coordinate
//     extent equals rendered extent; curves/arcs (Q/C/T/S/A) are excluded
//     because control points bound but do not equal the rendered curve;
//   - polygon/polyline points, line x1/x2, rect x+width;
//   - no transform on the marker or any descendant;
//   - provable x-scaling: no viewBox (1:1), preserveAspectRatio="none"
//     (x-scale = markerWidth/vbW exactly), or default uniform scaling where
//     the x-axis is the limiting axis (markerWidth/vbW ≤ markerHeight/vbH).
// Returns { proven, extent, viewBoxW, reason }; reason is set when unproven.
function markerGlyphExtent(marker) {
  let minX;
  let maxX;
  const note = (x) => {
    if (Number.isNaN(x)) return;
    minX = minX === undefined ? x : Math.min(minX, x);
    maxX = maxX === undefined ? x : Math.max(maxX, x);
  };
  const unproven = (reason) => ({ proven: false, reason });

  for (const child of walk(marker)) {
    if (child.attrs.transform !== undefined) return unproven("child transform present");
    if (child.tag === "path") {
      const d = child.attrs.d ?? "";
      if (/[mlhvqcsta]/.test(d)) return unproven("relative path commands in glyph"); // lowercase commands
      if (/[QCTSA]/.test(d)) return unproven("curve/arc commands in glyph path");
      // R3-P1: the simple number scanner would split exponent notation
      // ("1e3") into wrong coordinates — downgrade instead of mis-proving.
      if (/[eE]/.test(d)) return unproven("exponent notation in glyph coordinates");
      const segments = d.match(/[MLHVZ][^MLHVZ]*/gi) ?? [];
      for (const seg of segments) {
        const cmd = seg[0].toUpperCase();
        const nums = (seg.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
        if (cmd === "Z" || cmd === "V") continue;
        if (cmd === "H") { nums.forEach(note); continue; }
        for (let i = 0; i < nums.length; i += 2) note(nums[i]); // M/L (x y) pairs
      }
    } else if (child.tag === "polygon" || child.tag === "polyline") {
      const points = child.attrs.points ?? "";
      if (/[eE]/.test(points)) return unproven("exponent notation in glyph coordinates");
      const nums = (points.match(/-?[\d.]+/g) ?? []).map(Number);
      for (let i = 0; i < nums.length; i += 2) note(nums[i]);
    } else if (child.tag === "line") {
      note(px(child.attrs.x1) ?? NaN);
      note(px(child.attrs.x2) ?? NaN);
    } else if (child.tag === "rect") {
      const x = px(child.attrs.x) ?? 0;
      const w = px(child.attrs.width);
      if (w === undefined) return unproven("rect without explicit width");
      note(x); note(x + w);
    } else if (child.tag !== "g") {
      return unproven(`unsupported child element <${child.tag}>`);
    }
  }
  if (minX === undefined) return unproven("no drawable glyph found");

  const mw = px(marker.attrs.markerWidth) ?? 3;
  const mh = px(marker.attrs.markerHeight) ?? 3;
  const vb = marker.attrs.viewBox;
  if (!vb) return { proven: true, extent: maxX - minX, viewBoxW: mw, reason: "" }; // 1:1 content units
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN) || parts[2] <= 0 || parts[3] <= 0) {
    return unproven("invalid marker viewBox");
  }
  const [, , vbW, vbH] = parts;
  const par = marker.attrs.preserveAspectRatio?.trim();
  // R3-P1: only two scaling modes are exactly provable for the x-axis —
  // "none" (x-scale = markerWidth/vbW by definition) and the ABSENT default
  // (uniform meet) when the x-axis is the limiting axis. Any other explicit
  // preserveAspectRatio (slice, alignment variants, explicit meet) is
  // downgraded instead of being pushed through the default-meet arithmetic.
  const xLimiting = mw / vbW <= mh / vbH + 1e-9;
  if (par !== undefined && par !== "none") return unproven(`explicit preserveAspectRatio "${par}"`);
  if (par === undefined && !xLimiting) return unproven("non-uniform viewBox scaling (y-axis limits the default uniform scale)");
  return { proven: true, extent: maxX - minX, viewBoxW: vbW, reason: "" };
}

// Whether a geometry child is a painted connector — i.e. it draws a visible
// stroke a collapsed filter could drop. Returns "painted" | "unpainted" |
// "unknown". C4-R3-P2: stroke-width:0 is unpainted; an unresolved stroke width
// is "unknown" (the caller must not assume painted). Only a resolved color
// stroke with a positive (or default) width is "painted".
function strokePaintState(el, rules) {
  const stroke = inheritedProp(el, "stroke", rules);
  if (stroke === undefined || stroke.trim().toLowerCase() === "none") return "unpainted";
  const swRaw = inheritedProp(el, "stroke-width", rules);
  if (swRaw === undefined) return "painted"; // SVG default stroke-width is 1
  const sw = px(swRaw);
  if (sw === undefined) return "unknown"; // e.g. var(--w) / calc() — cannot prove
  return sw > 0 ? "painted" : "unpainted";
}

// Union bbox of a filtered element's PAINTED straight strokes, computed ONLY
// when every painted child is a provably axis-parseable straight stroke: path
// with absolute M/L/H/V/Z and plain decimal coordinates, line, or
// polyline/polygon points. Unpainted children (stroke none/unset) are ignored.
// Any painted child outside the parseable subset (curves, rects, text, use,
// transforms, exponents) returns null — the caller then stays silent.
function provableStrokeBBox(root, rules) {
  let minX; let maxX; let minY; let maxY;
  let sawStroke = false;
  const note = (x, y) => {
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    minX = minX === undefined ? x : Math.min(minX, x);
    maxX = maxX === undefined ? x : Math.max(maxX, x);
    minY = minY === undefined ? y : Math.min(minY, y);
    maxY = maxY === undefined ? y : Math.max(maxY, y);
  };
  const elements = [root, ...walk(root)];
  for (const child of elements) {
    if (child.attrs?.transform !== undefined) return null;
    if (child.tag === "g") continue;
    const GEOMETRY = ["path", "line", "polyline", "polygon"];
    if (!GEOMETRY.includes(child.tag)) {
      return null; // rect/text/use/anything else → not provable
    }
    const paint = strokePaintState(child, rules);
    if (paint === "unpainted") continue; // draws nothing → cannot be dropped
    if (paint === "unknown") return null; // cannot prove painted → no false certainty
    if (child.tag === "path") {
      const d = child.attrs.d ?? "";
      if (/[mlhvqcsta]/.test(d) || /[QCTSA]/.test(d) || /[eE]/.test(d)) return null;
      const segments = d.match(/[MLHVZ][^MLHVZ]*/gi) ?? [];
      let curX; let curY;
      for (const seg of segments) {
        const cmd = seg[0].toUpperCase();
        const nums = (seg.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
        if (cmd === "Z") continue;
        if (cmd === "H") { for (const x of nums) { curX = x; note(curX, curY ?? NaN); } continue; }
        if (cmd === "V") { for (const y of nums) { curY = y; note(curX ?? NaN, curY); } continue; }
        for (let i = 0; i + 1 < nums.length; i += 2) { curX = nums[i]; curY = nums[i + 1]; note(curX, curY); }
      }
      sawStroke = true;
    } else if (child.tag === "line") {
      const x1 = px(child.attrs.x1); const y1 = px(child.attrs.y1);
      const x2 = px(child.attrs.x2); const y2 = px(child.attrs.y2);
      if ([x1, y1, x2, y2].some((v) => v === undefined)) return null;
      note(x1, y1); note(x2, y2);
      sawStroke = true;
    } else {
      const points = child.attrs.points ?? "";
      if (/[eE]/.test(points)) return null;
      const nums = (points.match(/-?[\d.]+/g) ?? []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) note(nums[i], nums[i + 1]);
      sawStroke = true;
    }
  }
  if (!sawStroke || minX === undefined) return null;
  return { minX, maxX, minY, maxY };
}

function smallestContaining(rects, x, y) {
  let best = null;
  for (const r of rects) {
    if (x < r.x || x > r.x + r.w) continue;
    if (y !== undefined && (y < r.y || y > r.y + r.h)) continue;
    if (!best || r.w * r.h < best.w * best.h) best = r;
  }
  return best;
}

function clip(text) {
  return text.length > 42 ? `${text.slice(0, 39)}…` : text;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function formatFinding(kind, f) {
  const head = `${f.file}:${f.line}  ${kind}  ${f.rule}  ${f.message}`;
  return f.fix ? `${head}\n    fix: ${f.fix}` : head;
}

function paletteAndBypassChecks(source, file, profileId, add2) {
  // authoring bypass (a): paint on a group inside defs/symbol does not reach <use>
  // instances (observed shipped defect — icons render black while lint passed).
  const defsRe = /<(defs|symbol)\b[\s\S]*?<\/\1>/g;
  let m;
  while ((m = defsRe.exec(source))) {
    for (const g of m[0].matchAll(/<g\b[^>]*>/g)) {
      const paint = g[0].match(/\b(fill|stroke)\s*=\s*"(?!none)[^"]+"/);
      if (paint) add2("error", "E-BYPASS", `paint ${paint[0]} sits on a <g> inside <${m[1]}> — it does not reach <use> instances (icons render with default paint)`, "move the paint onto the drawable elements themselves (expanded concrete paths in canonical output)");
    }
  }
  // authoring bypass (b): font-size on a parent <g> silently skips text overflow checks
  const gFont = [...source.matchAll(/<g\b[^>]*\bfont-size\s*=\s*"[^"]+"[^>]*>/g)];
  if (gFont.length) {
    const bare = /<text\b(?![^>]*font-size)[^>]*>/.test(source);
    if (bare) add2("warning", "W-BYPASS", "font-size on a parent <g> with font-size-less <text> children — overflow estimation is silently skipped for those labels", "put font-size on each <text> (or its class) so the text budget stays machine-checked");
  }
  if (!profileId) return;
  let profile;
  try { profile = allowedPaintSet(profileId); }
  catch (e) { add2("error", "E-PALETTE", e.message, "use --palette-profile current | legacy-v0.8 | sketch"); return; }
  const paints = [];
  for (const mm of source.matchAll(/\b(fill|stroke|stop-color|flood-color)\s*=\s*(["'])([^"']*)\2/g)) paints.push({ prop: mm[1], v: mm[3], attr: mm[0] });
  for (const st of source.matchAll(/style\s*=\s*"([^"]*)"/g)) {
    for (const mm of st[1].matchAll(/(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"]+)/g)) paints.push({ prop: mm[1], v: mm[2].trim(), attr: mm[0] });
  }
  for (const sb of source.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    for (const mm of sb[1].matchAll(/(fill|stroke|stop-color|flood-color)\s*:\s*([^;}]+)/g)) paints.push({ prop: mm[1], v: mm[2].trim(), attr: `style-block ${mm[1]}` });
  }
  const staticHex = new Set();
  for (const mm of source.matchAll(/<[A-Za-z][^>]*data-paint-static\s*=\s*(["'])(?:true|1)\1[^>]*>/g)) {
    for (const hm of mm[0].matchAll(/#[0-9A-Fa-f]{6}/g)) staticHex.add(hm[0].toUpperCase());
  }
  const annotated = new Set();
  for (const mm of source.matchAll(/<[A-Za-z][^>]*data-(?:fill|stroke)-role\s*=\s*(["'])[A-Za-z0-9-]+\1[^>]*>/g)) {
    for (const hm of mm[0].matchAll(/#[0-9A-Fa-f]{6}/g)) annotated.add(hm[0].toUpperCase());
  }
  let varHit = false;
  for (const p of paints) {
    const v = p.v.trim();
    if (v === "none" || v === "transparent" || v.startsWith("url(")) continue;
    if (/var\(|currentColor/.test(v)) { varHit = true; continue; }
    const hex = v.match(/^#[0-9A-Fa-f]{6}$/);
    if (!hex) continue;
    const H = v.toUpperCase();
    if (staticHex.has(H)) continue; // explicitly allowed non-token paint
    if (profile.kind === "frozen-allowlist") {
      if (!profile.allowed.has(H)) add2("error", "E-PALETTE", `hex ${v} is outside the frozen legacy-v0.8 allowlist`, "the preserved artifact is frozen — restore the original value");
    } else if (profile.allowed.has(H)) {
      if (!annotated.has(H)) add2("error", "E-PALETTE", `canonical hex ${v} appears without a role annotation`, "annotate data-fill-role/data-stroke-role (or data-paint-static) so the materializer owns recoloring");
    } else {
      add2("warning", "W-PALETTE", `hex ${v} is outside the ${profile.id} profile`, "use resolver tokens (skin.mjs resolve) — escalates to an error after the Wave 1 regeneration");
    }
  }
  if (varHit && profile.kind !== "frozen-allowlist") add2("error", "E-PALETTE", "variable paint (var(--…)/currentColor) in canonical output — the rejected baseline-red form", "author direct per-shape paint with role annotations (design-kernel §5)");
}

export function runCli(argv) {
  const ppIdx = argv.indexOf("--palette-profile");
  let paletteProfile = null;
  if (ppIdx !== -1) {
    paletteProfile = argv[ppIdx + 1];
    if (!paletteProfile || paletteProfile.startsWith("-")) { console.error("ERROR --palette-profile requires a value (current | legacy-v0.8 | sketch)"); return 2; }
    argv = argv.filter((_, i) => i !== ppIdx && i !== ppIdx + 1);
  }
  const files = argv.filter((a) => !a.startsWith("-"));
  if (files.length === 0) {
    console.error("usage: node check-svg.mjs file.svg [more.svg …]");
    return 2;
  }
  let errorCount = 0;
  let warningCount = 0;
  for (const file of files) {
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch (e) {
      console.error(`${file}:0  ERROR  E-IO  cannot read file: ${e.message}`);
      errorCount++;
      continue;
    }
    const { errors, warnings } = lintSvg(source, file);
    paletteAndBypassChecks(source, file, paletteProfile, (kind, code, message, fix) => {
      const finding = { file, line: 0, rule: code, message, fix };
      (kind === "error" ? errors : warnings).push(finding);
    });
    for (const f of errors) console.error(formatFinding("ERROR", f));
    for (const f of warnings) console.error(formatFinding("warn ", f));
    errorCount += errors.length;
    warningCount += warnings.length;
  }
  // Success summary goes to stdout so a clean run writes nothing to stderr
  // (PowerShell 5.1 raises NativeCommandError noise on any stderr output);
  // real findings above stay on stderr.
  console.log(`check-svg: ${errorCount} error(s), ${warningCount} warning(s) across ${files.length} file(s)`);
  return errorCount > 0 ? 1 : 0;
}

// Entrypoint guard compares REAL paths so symlinked installs still execute —
// the previous href comparison silently skipped main() behind a symlink (exit 0
// with no output), bypassing the hard gate.
const __isMain = (() => {
  try {
    if (!process.argv[1]) return false;
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  }
})();
if (__isMain) {
  preflight({ entrypointUrl: import.meta.url });
  process.exit(runCli(process.argv.slice(2)));
}
