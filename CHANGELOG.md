# Changelog

Notable changes to this repository. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Granular, per-change entries begin at the first public release. Until then, the entry below summarizes what the initial release provides. (Development history is in the git log.)

## [Unreleased] — initial release

### svg-infographic (Claude Code)

- Author technical/structured SVG infographics and diagrams from a description, and render crisp **2× PNG** via a headless Chromium browser (Chrome / Edge / Chromium) on macOS, Windows, and Linux.
- **Archetypes:** cloud/network topology, layer & nested "onion" models, icon cards, before/after comparison, process/data flow, roadmap, qualitative risk matrix — each with a mini recipe.
- **Icon-first:** reusable line-icon set in soft tinted circles; number badges only when sequence matters.
- **First-class Korean/CJK** text with cross-platform font fallback (Apple SD Gothic Neo / Malgun Gothic / Noto Sans KR).
- CSS-variable color tokens (recolor in one place), canvas presets, vertical-centering, text-wrapping, and connector-routing rules.
- **Examples** (English + Korean, source SVG + 2× PNG, each with its prompt and provenance): `technical-infographic`, `before-after-migration`, `cloud-infra-topology`, `skill-overview`.

### Repository

- GitHub install guide (clone + copy, latest or pinned tag, update, uninstall) — no remote script executed.
- Apache-2.0 license.
