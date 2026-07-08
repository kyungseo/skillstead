# Examples — svg-infographic

Real outputs from the [`svg-infographic`](../../skills/svg-infographic) skill. Each is a **flat, structural** diagram (the skill's sweet spot), shipped as source SVG + 2× PNG, in English and Korean, with the prompt that generated it. Every example is an originally authored, non-client synthetic (see each folder's Provenance).

## Gallery

### 1. Technical infographic — flagship

Concept infographics: nested/onion models + icon cards.

[![The 4 Layers of AI Engineering](./technical-infographic/technical-infographic.en.png)](./technical-infographic)

→ [`technical-infographic/`](./technical-infographic) · English + 한국어

### 2. Cloud infrastructure topology

Architecture/topology proof: zones, components with icons, request-path arrows.

[![Azure reference topology](./cloud-infra-topology/cloud-infra-topology.en.png)](./cloud-infra-topology)

→ [`cloud-infra-topology/`](./cloud-infra-topology) · English + 한국어

### 3. Skill overview — self-demo

The skill introducing itself: purpose, mechanism, scope.

[![svg-infographic overview](./skill-overview/skill-overview.en.png)](./skill-overview)

→ [`skill-overview/`](./skill-overview) · English + 한국어

## Quality bar (every example passes)

- [x] SVG and PNG dimensions match (PNG is exactly 2× the SVG viewBox)
- [x] No text overflow; text vertically centered in its box
- [x] No tofu — Korean/CJK glyphs render correctly
- [x] `<title>` / `<desc>` present for accessibility
- [x] No host-specific or client paths in the source
- [x] Icons render (no broken `<use>` references)

## Scope

Flat, structural technical diagrams only. Hand-drawn / crayon "sketchnote" styles, mascots, and character illustration are **out of scope** — keeping that line is what keeps the output consistent.
