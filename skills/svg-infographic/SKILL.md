---
name: svg-infographic
description: Author technical/structured SVG infographics. Best for architecture diagrams, topology maps, flows, before/after comparisons, and social-ready technical one-pagers. When browser-based rendering is available, exports an editable SVG plus a sharp 2x PNG. Not for photo-heavy, illustration-heavy, or data-plot-heavy graphics.
---

# svg-infographic

Use this skill when the user asks for a technical or structured infographic. It is a good fit for:

- architecture diagrams
- cloud or network topology
- component / layer diagrams
- before/after or migration visuals
- process or data flow
- roadmap or risk maps
- social-ready technical one-pagers

Do **not** use this skill for:

- photo-heavy or illustration-heavy marketing graphics
- statistical charts (bar, line, scatter, heatmap)
- hand-drawn / crayon "sketchnote" styles, mascots, or character illustration
- freeform logo or icon design

## Workflow

1. Confirm visual intent, audience, output ratio, and language.
2. Propose the default style and ask whether to change it.
3. Propose an output directory inside the current project and confirm with the user.
4. Author the SVG as the editable source of truth.
5. When browser-based rendering is available, export a 2x PNG.
6. Verify there is no text overflow, that CJK (e.g. Korean) glyphs render correctly, and that SVG/PNG dimensions match.

## Style Defaults

- Canvas: 680px width for docs/decks; 1080x1350 for 4:5 social posts.
- Font stack: Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif.
- Background: light.
- Colors: CSS custom properties collected in a single `<style>` block.
- Text: keep it concise, ideally 2-3 lines per box.
- Shape: rounded rectangles with restrained radius and thin borders.

Before generating, tell the user they can change:

- brand color
- ratio
- dark / light mode
- Korean / English language
- SVG-only or SVG+PNG output

## Output

When possible, save both files:

- `<slug>.svg` — the source artifact
- `<slug>.png` — the shareable 2x export for decks and social posts

The SVG is the source of truth; the PNG is the shareable artifact.

## PNG Export

Prefer browser-based rendering. If PNG export is not available, deliver the SVG only and state the limitation.
