# Sketch preset (Tier 2) — tidy hand-drawn

An **opt-in** visual preset: paper background, Korean-capable handwriting font, rough hand-drawn strokes, and highlighter accents. Offer it only when the user asks for a hand-drawn / sketchnote / 손글씨 feel — the flat premium style stays the default.

**Identity: "tidy hand-drawn."** The *surface* becomes hand-drawn; the *structure* does not. The layout pass, text budgets, and pre-render checklist from `SKILL.md` apply unchanged — alignment stays computed, spacing stays even, text stays real and editable. Do **not** fake organic imperfection (random misalignment, per-element wobble in placement). That precision is the deliberate difference from image-model sketchnotes: crisp layout, hand feel.

**Still out of scope:** mascots and character art, crayon/marker illustration, scene drawings. If the user wants those, say so — don't approximate them badly.

## 1. Tokens (sketch palette)

Warm paper, dark warm ink, pastel fills with darker same-family strokes:

```xml
<style>
  text { font-family:'Hand','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif; fill:#4A4438 }
  svg { --paper:#FBF7EE; --ink:#4A4438; --muted:#8A8272;
    --a-f:#EFE6F7; --a-s:#7A5EA8;  /* lavender */
    --b-f:#E3EEF8; --b-s:#4A7DB5;  /* blue */
    --c-f:#E4F2E9; --c-s:#4E9268;  /* green */
    --d-f:#FBF3D9; --d-s:#C0983B;  /* yellow */
    --e-f:#F8E3E0; --e-s:#B85C4F;  /* red */
    --f-f:#FAE8DC; --f-s:#C06A3B;  /* orange */
    --g-f:#ECE7F8; --g-s:#6C58B0;  /* purple */ }
</style>
```

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
- Paper: solid `--paper` rect + a second full-canvas rect with `filter="url(#paper)"` at low opacity.
- Strokes: `stroke-width 2.5` boxes and connectors; hand arrowhead = **open V marker** (stroked, not filled), with the mandatory explicit user-space footprint (≈9 units per 1px of shaft — here 22.5 for the 2.5px stroke; the lint gate rejects `markerUnits`-less markers):

```xml
<marker id="ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="22.5" markerHeight="22.5"
  markerUnits="userSpaceOnUse" orient="auto-start-reverse">
  <path d="M2 2 L10 6 L2 10" fill="none" stroke="#4A4438" stroke-width="2" stroke-linecap="round"/></marker>
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
