<!-- 한국어: [README.ko.md](./README.ko.md) -->

# svg-infographic

Author technical/structured SVG infographics with a consistent style system, and export both an editable SVG and a crisp 2x PNG artifact.

## Overview

`svg-infographic` helps Claude Code produce clean, hand-authored SVGs for architecture diagrams, cloud topology, before/after comparisons, process flows, roadmap panels, and structured one-page technical infographics.

It is **not** for photo- or illustration-heavy marketing graphics, statistical charts, or hand-drawn "sketchnote" styles with mascots or character art.

## When To Use

- You want a clean architecture / topology / flow / layer diagram from a text description.
- You want a structured technical one-pager for a deck, doc, or social post.
- You need correct Korean / CJK text in the output.

## When Not To Use

- Photo- or illustration-heavy marketing infographics.
- Statistical charts (bar, line, scatter, heatmap).
- Hand-drawn / crayon sketchnote styles, mascots, or character illustration.

## Install

Copy the skill folder into your Claude Code skills directory:

```text
<claude-skills-dir>/svg-infographic/SKILL.md
```

The exact path varies by environment, so this doc uses a `<claude-skills-dir>` placeholder rather than a machine-specific absolute path. See [../../docs/INSTALL.md](../../docs/INSTALL.md).

## Usage Examples

```text
Use svg-infographic to turn this architecture into a cloud infrastructure topology diagram.
```

```text
Use svg-infographic to turn this before/after migration into a structured social infographic.
```

## Output Artifacts

- `*.svg` — the editable source of truth
- `*.png` — the 2x export for sharing, slides, and social posts

Before writing files, the skill proposes an output directory inside your current project and asks for confirmation.

## Style Defaults

- Style: muted technical
- Font stack: Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif
- Theme: light background
- Color system: CSS variables collected in one place

You can change brand color, ratio, language, dark mode, and output format before generation.

## Limitations

- PNG export depends on browser-based rendering. Where it is unavailable, the skill delivers the SVG only and states the limitation.
- Output is vector/structural. It does not produce raster illustration, photography, or hand-drawn textures.

## Examples

See [`examples/`](../../examples). Public examples are release-gated (see below).
