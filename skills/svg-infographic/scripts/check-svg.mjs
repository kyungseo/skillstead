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
//   E-TEXT      high-confidence Latin/CJK text overflow past its containing box
//   W-*         ambiguous cases (transforms, unresolved styles, near-threshold
//               overflow, large-but-plausible heads) — reported, never fatal
//
// Usage:  node check-svg.mjs file.svg [more.svg …]
// Exit:   0 when no hard errors (warnings allowed) · 1 hard errors · 2 usage
//
// Design constraints (FEAT-20260723-002 owner decisions):
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
// its container, data-lint-allow="marker-footprint" on the marker.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
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

function estimateWidth(text, fontSize, bold, letterSpacing) {
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

export function runCli(argv) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runCli(process.argv.slice(2)));
}
