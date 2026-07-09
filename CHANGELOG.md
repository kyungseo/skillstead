# Changelog

Notable changes to this repository. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Granular, per-change entries begin at the first public release. Earlier development history is in the git log.

## [0.1.1] — 2026-07-09

### svg-infographic

- **All ten examples redrawn to a refreshed, higher-fidelity visual style** — band containers with pill section headers, white icon cards, numbered step badges, emphasized key steps, and footer rule/summary cards. English + Korean, re-rendered to 2× PNG.
- **Two new synthetic examples**, English + Korean, source SVG + 2× PNG, each with its prompt and provenance — example count **8 → 10**:
  - `ci-cd-artifact-promotion` — a build-once / promote-the-same-digest release-candidate model (build → promote → release fix).
  - `issue-tracker-cicd-approval-flow` — an issue key threading commit → build → test → approval → prod deploy, with a parallel issue-state rail and the approval gate as a state transition.
- **Gallery preview** refreshed to a curated 3×2 six-example montage with labelled cells.
- **SKILL.md guidance upgrade (lightweight):** input-mode classification (brief-first / source-first / research-first), archetype selection from the content signal, conclusion-first titles, an optional 3×3 zone layout aid, an expanded rendering + message review checklist, and an optional attribution/footer layer policy. No engine/DSL — the skill stays a lightweight guide.
- **Usage docs & bilingual gallery:** skill README (EN/KO) usage aligned to the new guidance; a Korean examples gallery (`examples/svg-infographic/README.ko.md`) added with cross-links; per-example provenance simplified to a short, consistent line.
- **Render smoke:** all ten examples verified on macOS; Windows/Linux render paths remain documented and pending.

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
