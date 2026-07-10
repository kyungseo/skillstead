# Changelog

Notable changes to this repository. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Granular, per-change entries begin at the first public release. Earlier development history is in the git log.

## [0.3.0] — 2026-07-11

### svg-infographic

- **Sketch preset (opt-in) — "tidy hand-drawn."** A new `references/sketch.md` preset: paper background with grain, an OFL Korean handwriting font embedded as a base64 data URI, rough `feTurbulence`/`feDisplacementMap` strokes, underline highlighter, and open-V hand arrowheads — while the layout stays computed (the standard layout pass and pre-render checklist apply unchanged). Deliberately **not** an imitation of image-model sketchnotes: no mascots/character art, no faked organic misalignment; crisp layout with a hand-drawn surface.
- **Font strategy: subset, don't bundle.** The font is downloaded at render time and subset to the glyphs actually used (`pyftsubset`, when `fonttools` is available) — the example SVG is ~99 KB instead of ~4 MB full-embed. Full embed remains a documented fallback with a size warning; the font file is not vendored into the repo (OFL notice recorded per example).
- **New example (13th): `incident-response-sketch`** — an incident-response loop (detect → triage → respond → recover → retro, minor-issue branch to the backlog, prevention loop back) in English + Korean with identical geometry, subset-embedded handwriting, and the prompts included.
- **Boundary update:** hand-drawn/sketchnote styles move from "not for" to **supported as the opt-in sketch preset**; mascots, character art, and scene illustration remain out of scope. Frontmatter description, skill/root/gallery READMEs (EN/KO), and install docs updated accordingly.
- Sketch-specific rules hardened from dogfooding this release: icon–label group **containment clamp**, annotation clearance vs long loop edges, highlighter as underline (not a block), subset-gotcha (re-subset after any text edit) added to the verify list.

## [0.2.0] — 2026-07-10

### svg-infographic

- **Multi-file package.** The skill grows from a single `SKILL.md` into a package — `SKILL.md` (core workflow) + `references/archetypes.md` (archetype catalog) + `references/authoring.md` (detailed rules, icon set, manual render fallback) + `scripts/render.sh`. Install stays the same folder copy.
- **Layout pass — compute before you draw (new, required).** Canvas regions, grid arithmetic (last-edge formula applied *before* drawing), and per-box text budgets are fixed numerically before any SVG is written. This targets the render-and-fix loop at its source.
- **Pre-render checklist (new).** A mechanical source-level self-check before every render: containment arithmetic, `<use>`/`marker` reference resolution, text budgets, on-accent contrast classes, EN/KO geometry parity, root sanity.
- **Archetype catalog systematized.** Nine archetypes under one schema — choose-when signal, layout skeleton (wireframe), premium recipe, per-type checks: layer stack, nested/onion, topology/component, flow (+ swimlane variant), approval/sequence-lite, before/after, roadmap/timeline, cards/KPI grid, decision/risk matrix. The v0.1.1 premium visual language (band containers, pill section headers, white icon cards, badge system, footer summary cards) is now the documented default recipe.
- **`scripts/render.sh`.** One command for browser discovery (Chrome/Edge/Chromium — macOS, Linux, and Windows Git Bash paths with `cygpath` URL handling), wrapper generation, 2× headless render, and automatic PNG dimension verification. Manual per-OS commands (incl. native PowerShell) remain documented as fallback; Windows/Linux render verification is still pending.
- **Authoring rules reorganized by principle** (containment, text, connectors, panels, emphasis/corner decorations, color/contrast, icons) — all v0.1.x failure-prevention rules preserved, now grouped for use while authoring instead of appended as incident notes.
- **Sketch-style spike (Tier 2 groundwork):** verified in headless Chrome — OFL Korean handwriting font (Nanum Pen Script) embedded as a base64 data URI renders cleanly at 30–60px with mixed EN/KO, and `feTurbulence`/`feDisplacementMap` rough borders + highlighter strips work. A hand-drawn preset remains out of scope for this release (font subsetting required before productizing; full TTF embed is ~4MB of SVG source).
- **Two new examples — the v0.2.0 dogfood outputs, example count 10 → 12.** Both were generated fresh with the hardened workflow and passed the quality bar on the first render (English + Korean with identical geometry, source SVG + 2× PNG, prompt and provenance included):
  - `zero-trust-onion` — a nested/onion model of zero-trust access rings around a least-privilege data core.
  - `agent-waiting-swimlane` — a two-lane swimlane (agent states / user actions) with labelled cross-lane alert and approval arrows.
- **Docs:** skill README (EN/KO) gains a five-step "How It Works" walkthrough and a "Supported Archetypes" table; the three-stage review (pre-render source check → PNG verify → message) replaces the old two-axis description; install docs show the multi-file package layout; root README and gallery (EN/KO) updated for twelve examples; `docs/INSTALL.md` updated for v0.2.0.

## [0.1.2] — 2026-07-10

### Repository

- **Visible language toggle on every bilingual README pair.** The root, `skills/svg-infographic`, and `examples/svg-infographic` README pairs now show an inline `English · 한국어` switch directly under the title, replacing the previously invisible HTML-comment cross-links. Readers can discover and switch to the other language straight from the rendered page. Titles and body content are unchanged.

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
