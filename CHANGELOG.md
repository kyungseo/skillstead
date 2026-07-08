# Changelog

Notable changes to this repository. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Granular, per-change entries begin at the first public release. Earlier development history is in the git log.

## [0.1.0] — 2026-07-08

### svg-infographic

- Author technical/structured SVG infographics and diagrams from a description, with SVG as the primary editable vector asset and crisp **2× PNG** preview/export when a headless Chromium browser is available.
- **Rendering:** Chrome / Edge / Chromium paths are documented for macOS, Windows, and Linux; v0.1.0 PNG export is smoke-tested on macOS, with Windows/Linux render verification pending.
- **Archetypes:** cloud/network topology, layer & nested "onion" models, icon cards, before/after comparison, process/data flow, roadmap, qualitative risk and decision matrix — each with a mini recipe.
- **Icon-first:** reusable line-icon set in soft tinted circles; number badges only when sequence matters.
- **First-class Korean/CJK** text with cross-platform font fallback (Apple SD Gothic Neo / Malgun Gothic / Noto Sans KR).
- CSS-variable color tokens (recolor in one place), canvas presets, vertical-centering, text-wrapping, and connector-routing rules.
- **Examples** covering several archetypes (English + Korean, source SVG + 2× PNG, each with its prompt and provenance): `technical-infographic`, `before-after-migration`, `process-flow`, `roadmap`, `cloud-infra-topology`, `skill-overview`, `ai-code-review-loop`, `agent-task-matrix`.

### Repository

- Multi-agent catalog positioning, with Claude Code as the supported v0.1.0 runtime.
- GitHub install guide (clone + copy, latest or pinned tag, update, uninstall) — no remote script executed.
- Apache-2.0 license.
