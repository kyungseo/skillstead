# LEGACY — page-title accent rail (pre-kernel examples only)

**Do not use for new output.** This composition was rejected on 2026-08-12
(unstable length/boundary across 1–2-line titles; ambiguous representative scope).
It is preserved solely so pre-kernel gallery examples keep passing their opt-in
lint contract until the Wave 1 regeneration replaces them. New headers follow the
H-C editorial stack (design-kernel §6).

- Page-title accent rail follows the title stack. Never copy a fixed rail height from a one-line title into a two-line title. With centered-baseline text, compute `eyebrowTop = eyebrowY − eyebrowFontSize/2`, `titleBottom = max(titleLineY + titleFontSize/2)`, `railY = eyebrowTop − railTopPad`, and `railH = titleBottom + railBottomPad − railY`. Keep `subtitleTop − railBottom ≥ subtitleGap`. For the premium one-line/two-line header, opt into the source check:

```xml
<g data-layout-role="page-title-header" data-layout-rail-padding-top="16"
   data-layout-rail-padding-bottom="0" data-layout-subtitle-gap="12"
   data-layout-tolerance="2">
  <rect data-layout-role="title-rail" x="60" y="58" width="6" height="143" rx="3"/>
  <text data-layout-role="title-eyebrow" x="88" y="82" font-size="16"
    dominant-baseline="middle">SKILL · EXAMPLE</text>
  <text data-layout-role="title-line" x="88" y="127" font-size="46"
    dominant-baseline="middle">첫 번째 제목 줄</text>
  <text data-layout-role="title-line" x="88" y="178" font-size="46"
    dominant-baseline="middle">두 번째 제목 줄</text>
  <text data-layout-role="title-subtitle" x="88" y="230" font-size="18"
    dominant-baseline="middle">한 줄 설명</text>
</g>
```

The contract accepts one or two **measurable visual title lines**, counted across `title-line` elements and their non-nested `<tspan>` lines. It requires plain numeric rail padding/gap, a positive-width rect rail, centered-baseline measurable text, and translate-only transforms. Optional `data-layout-tolerance` defaults to 2px and accepts 0–8px; an unsupported, negative, or larger value emits `W-LAYOUT` and falls back to 2px for the actual comparison. Unsupported units or typography become `W-LAYOUT`; a rail whose top/bottom does not match the stack or that enters the subtitle clearance becomes `E-LAYOUT`. The same source-coordinate limitation described in §4 applies, so verify the final rail and rendered glyphs in the 2× PNG.
