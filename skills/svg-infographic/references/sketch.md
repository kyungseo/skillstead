# Sketch preset (Tier 2) — tidy hand-drawn

An **opt-in** visual preset: paper background, Korean-capable handwriting font, rough hand-drawn strokes, and highlighter accents. Offer it only when the user asks for a hand-drawn / sketchnote / 손글씨 feel — the flat premium style stays the default.

**Identity: "tidy hand-drawn."** The *surface* becomes hand-drawn; the *structure* does not. The layout pass, text budgets, and pre-render checklist from `SKILL.md` apply unchanged — alignment stays computed, spacing stays even, text stays real and editable. Do **not** fake organic imperfection (random misalignment, per-element wobble in placement). That precision is the deliberate difference from image-model sketchnotes: crisp layout, hand feel.

**Still out of scope:** mascots and character art, crayon/marker illustration, scene drawings. If the user wants those, say so — don't approximate them badly.

## 1. Tokens (sketch palette)

Warm paper, single warm ink, highlighter accent. Canonical values come from the
sketch overlay profile `references/skins/sketch-overlay-v1.yaml` (resolve with
`node scripts/skin.mjs resolve references/skins/current-v1.yaml --mode light --treatment sketch`
— Wave 0 supports sketch in **light mode only**):

```xml
<!-- Canonical sketch output uses direct paint + role annotations, like flat
     (design-kernel §5). Reference values from sketch-overlay-v1:
     paper #FAF4EB · sketch-ink #403C34 · highlight #EFDCA9 · derived muted #847E71 -->
<style>
  text { font-family:'Hand',Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif }
</style>
<rect data-fill-role="paper" fill="#FAF4EB" width="1000" height="880"/>
<text data-fill-role="sketch-ink" fill="#403C34">…</text>
```

The multi-hue pastel families (`--a-*` … `--g-*`) of pre-kernel sketch examples are
**deprecated**: they are the largest measured drift slice in the current gallery.
New sketch output uses paper + sketch-ink + highlight (plus derived muted); existing
examples keep their palettes only until the Wave 1 regeneration.

Roles still encode meaning (ok = green, warning = yellow/orange, danger = red). Label ink per box: a darker shade of the box's stroke family.

## 2. Paper & rough filters

```xml
<filter id="rbox" x="-6%" y="-14%" width="112%" height="128%">
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="5"/>
</filter>
<filter id="rline" x="-12%" y="-12%" width="124%" height="124%">
  <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="4"/>
</filter>
<filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.30 0 0 0 0 0.27 0 0 0 0 0.22 0 0 0 0.035 0"/>
  <feComposite in2="SourceGraphic" operator="over"/></filter>
```

- `rbox` for boxes/pills (group several rects under one `<g filter>`), `rline` for arrows, leaders, and icons.
- **Filter regions need margin** (`x/y` negative, `width/height` >100%) or the displaced stroke clips at the bounding box.
- **Never apply a percentage/objectBoundingBox filter to connector geometry that can have zero width or height.** A group of collinear horizontal (or vertical) connectors has a zero-height (zero-width) object bounding box, the percentage region collapses to nothing, and Chrome drops every stroke in the filter — the diagram ships without its connectors. Approved alternatives only: leave those strokes unfiltered, or give the filter `filterUnits="userSpaceOnUse"` with an explicit non-zero region covering the strokes. Grouping the strokes with two-dimensional geometry also works, but never rely on it by accident — the lint gate hard-errors on the provable degenerate cases (`E-FILTERBOUNDS`).
- Paper: solid `--paper` rect + a second full-canvas rect with `filter="url(#paper)"` at low opacity.
- Strokes: `stroke-width 2.5` boxes and connectors; hand arrowhead = **open V marker** (stroked, not filled), sized by the same *visible-geometry* contract as the flat preset (`visible ≈ markerWidth × 8/12`, aim visible ≈3× the shaft → **`markerWidth ≈ 4.5 × shaft`**, here 11.25 for the 2.5px stroke; the lint gate rejects `markerUnits`-less markers and warns outside the ≈2.5–4× visible band):

```xml
<marker id="ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="11.25" markerHeight="11.25"
  markerUnits="userSpaceOnUse" orient="auto-start-reverse">
  <path d="M2 2 L10 6 L2 10" fill="none" data-stroke-role="sketch-ink" stroke="#403C34" stroke-width="2" stroke-linecap="round"/></marker>
```

- Connectors may use gentle curves (`C`/`Q` paths) — hand-drawn lines aren't strictly orthogonal — but the curve **geometry** follows the flat recipe in `authoring.md` §3 (perpendicular entry/exit, single bend by default, 8–12px arrowhead gap, visible shaft); the sketch preset only adds the rough texture on top.

## 3. Handwriting font (embed, don't assume)

No platform ships a Korean handwriting font, so the SVG must embed one as a base64 `@font-face` data URI. Use an **OFL-licensed** font — default **Nanum Pen Script** (round, legible); alternatives: Gaegu, Hi Melody.

**Subset before embedding whenever possible.** A full Korean TTF is ~3MB (≈4MB SVG). Subsetting to the glyphs actually used yields tens of KB:

```bash
# 1. get the font (OFL — keep the license notice in your provenance/README)
curl -sL -o /tmp/NanumPenScript.ttf \
  "https://github.com/google/fonts/raw/main/ofl/nanumpenscript/NanumPenScript-Regular.ttf"
# 2. collect the exact text used in the SVG, then subset (needs fonttools: pip install fonttools)
pyftsubset /tmp/NanumPenScript.ttf --text-file=used-chars.txt \
  --output-file=hand-subset.ttf --layout-features='*' --hinting
# 3. base64-embed hand-subset.ttf in the <style> @font-face
```

- No `fonttools` available → full embed is acceptable for a one-off, but **warn the user about the ~4MB SVG** and note the PNG is the shareable artifact.
- **Subset gotcha (add to pre-render checklist for sketch):** the subset contains only the glyphs present at subset time. **Any text edit requires re-subsetting**, or the new characters render as tofu. When verifying the PNG, check every label — a missing glyph looks exactly like the CJK-tofu failure.
- EN/KO variants: subset each variant's own text (or one union subset for both).

## 4. Type scale & text budget

Handwriting reads smaller than system sans at equal px — scale up ~15–20%:

- 1000-wide sketch panel: title 52–56 / subtitle 28–29 / node label 30–32 / pill 27 / annotation & caption 22–24
- Text budget: same counting rules as flat (KO ≈ 60% of Latin chars/line); handwriting tolerates slightly longer lines visually but keep the computed budget — it's what guarantees containment.

## 5. Sketch-specific layout rules

- **Highlighter = underline, not block.** Ride the strip under the text baseline (top of strip ≈ baseline − 0.35em, height ≈ 0.5em), width ≈ text width + 2 side bleeds, low opacity (0.45–0.55), slight rotation (−1°…+1°), and pass it through `rbox` so its edges are rough too. A block behind the full title is allowed only for short titles with nothing else in that band.
- **Icon–label grouping formula.** Icon and label form one visual unit: estimate label width `w ≈ chars × size × 0.95` (KO; ~0.5 for Latin), group width `= icon + 14 + w`, centered as a whole. Never park the icon at a fixed corner far from a centered label. **Clamp to the container:** the group must fit `boxW − 2×16` — if it doesn't, shorten the label or widen the box *before* drawing; an estimate that overflows pushes the icon across the border (a containment failure the pre-render checklist must catch).
- **Annotation clearance.** Side annotations (dashed leader + handwritten note) keep their text block **≥ 24px clear of every connector path** — check against long return/loop edges especially. Two short lines beat one long line near a busy edge.
- **Seed variation.** Vary `seed` between the box filter and line filter (and optionally between major groups) so edges don't visibly repeat; keep `scale ≤ 5–6` — beyond that, corners tear.
- **Best-fit archetypes:** flow, cards, roadmap, simple layer models. Dense topology and data-heavy matrices lose legibility in sketch — recommend flat for those and say why.

## 6. Verify additions (sketch)

On top of the standard §7 quality bar:

- every glyph renders (subset completeness — check *each* label on the PNG)
- rough displacement didn't clip at any filter region edge
- highlighter sits under, not over, its text; label ink still reads on pastel fills
- file size reported to the user (subset SVG tens-of-KB vs full-embed ~4MB)
- OFL license notice recorded where the asset ships (example README / provenance)
