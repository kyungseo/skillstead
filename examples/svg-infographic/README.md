# Examples — svg-infographic

Real outputs from the [`svg-infographic`](../../skills/svg-infographic) skill. Each is a **flat, structural** diagram (the skill's sweet spot), shipped as source SVG + 2× PNG, in English and Korean, with the prompt that generated it. Every example is an originally authored, non-client synthetic (see each folder's Provenance).

## Gallery

### 1. Technical infographic — flagship

Concept infographics: nested/onion models + icon cards.

[![The 4 Layers of AI Engineering](./technical-infographic/technical-infographic.en.png)](./technical-infographic)

→ [`technical-infographic/`](./technical-infographic) · English + 한국어

### 2. Before / after migration

Comparison archetype — beyond architecture: two equal panels, semantic colors, ✓/✕ points.

[![Monolith to microservices](./before-after-migration/before-after-migration.en.png)](./before-after-migration)

→ [`before-after-migration/`](./before-after-migration) · English + 한국어

### 3. Cloud infrastructure topology

Architecture/topology proof: zones, components with icon badges, request-path arrows.

[![Azure reference topology](./cloud-infra-topology/cloud-infra-topology.en.png)](./cloud-infra-topology)

→ [`cloud-infra-topology/`](./cloud-infra-topology) · English + 한국어

### 4. Skill overview — self-demo

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

## Render smoke test (per OS)

Honest status — only macOS is verified in this build. Windows/Linux paths are documented in [`SKILL.md`](../../skills/svg-infographic/SKILL.md) §6 but not yet smoke-tested here; contributions welcome.

| Environment | Browser | en/ko SVG → 2× PNG | Status |
| --- | --- | --- | --- |
| macOS 15 | Chrome (headless) | all 4 examples | ✅ verified — correct 2× dimensions, no tofu |
| Windows 10/11 | Chrome / Edge | — | ⏳ not yet verified (see SKILL.md §6 PowerShell path) |
| Linux / WSL | Chrome / Chromium | — | ⏳ not yet verified (install Noto Sans CJK/KR for Korean) |

## Scope

Flat, structural technical diagrams only. Hand-drawn / crayon "sketchnote" styles, mascots, and character illustration are **out of scope** — keeping that line is what keeps the output consistent.
