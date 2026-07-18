# Changelog

Notable changes to this repository. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Granular, per-change entries begin at the first public release. Earlier development history is in the git log.

## [Unreleased]

### writing-quality-editor (new skill, Beta)

- **Natural, preservation-first writing.** Adds new-document `Compose`, read-only `Assess`, same-language `Revise`,
  and cross-language `Adapt` modes for README files, onboarding, release notes, manuals, app UI, error messages,
  gallery copy, and similar user-facing prose. The contract protects facts, intent, author voice, conditions,
  numbers, identifiers, limitations, risks, approvals, and next actions.
- **Intent-based mode selection.** Users can ask naturally to write, review, fix, supplement, improve, translate,
  or make text sound natural without naming the skill or a mode. Selection follows the requested outcome and
  mutation boundary rather than a fixed synonym list; a bare review request defaults to read-only `Assess`.
- **Host workflow precedence.** Repository workflows retain ownership of artifact classification, path, indexing,
  lifecycle, and approval. The writing skill may improve prose inside that contract but cannot treat a document
  label such as `brief` as permission to bypass the host workflow; F21 covers this boundary.
- **First-pass composition.** `Compose` writes directly from a supplied brief and evidence packet so users do not
  need a separate draft-then-polish cycle. It may create structure and prose, but not product facts, capabilities,
  evidence, compatibility, metrics, procedures, or experience that the user did not supply. A familiar artifact
  format is not permission to add an unsupplied next action.
- **Research-backed composition.** When the user supplies no materials, `Compose` may gather traceable public
  evidence first. A dedicated procedure requires opened primary sources, evidence cutoff dates, direct citations,
  scope preservation, and separation of measured facts, source claims, disagreement, and synthesis.
- **English↔Korean adaptation beyond literal translation.** `Adapt` may change sentence boundaries, information
  order, idioms, and explanation density so the result reads naturally in the target language, while a parity
  audit blocks invented claims and hidden ambiguity. Locale-neutral design is separated from the initial
  localization profile under behavioral validation: English↔Korean (`ko-KR` for Korean output).
- **No detector gaming.** AI-detector optimization, provenance concealment, fake experience, random synonyms,
  and unnecessary rewriting of already-natural text are explicit non-goals.
- **Portable package and fixtures.** The self-contained skill includes English/Korean READMEs, UI metadata, a
  profile-aware review rubric, dedicated EN↔KO and research-backed Compose references. Twenty-one scenarios and a
  separate answer key cover seven document profiles, meaning drift, over-editing, `needs-human`, and protected
  identifiers. Cross-runtime behavior and repository dogfood pass; runtime support remains Pending until clean
  installation/discovery and the final public-claim gate finish.
- **Fresh-context contract correction.** The first Claude Code behavior leg passed six of eight high-signal
  scenarios and exposed repeatable misses in ambiguous destructive UI and actorless release procedures. The
  strengthened contract passed the post-fix regression set on both runtimes, bounded R2 approved the result, and
  the later Compose, intent-inference, and host-workflow amendments passed their fresh-context gates without a
  formal R3.
- **User-supplied enrichment boundary.** Facts and examples supplied or explicitly approved by the user may be
  integrated within the requested scope; the skill still must not infer adjacent claims. F15 checks both
  over-refusal and invention while preserving the supplied limit, local-storage fact, and authentication condition.
- **No-edit gate correction.** The first Codex behavior leg reproduced preference-driven churn on already-natural
  F12 text. `Revise` now requires a concrete reader problem before any wording, sentence, punctuation, or formatting
  change and returns the source exactly when all candidate changes are Neutral.

### Repository

- Root English/Korean READMEs add `writing-quality-editor` to the priority catalog with evidence-bounded Beta
  and runtime labels. The catalog impact map now represents all four skills.
- **Public-release playbook bilingualization.** Eight Korean-primary source documents are preserved as `.ko.md`
  mirrors, while natural English candidates use the canonical filenames. Every pair has a visible language
  switch, same-language internal links, matching checklist decisions, and an atomic-parity maintenance rule. The
  owner approved the English authority flip after independent parity review; it takes effect when the
  bilingualization pull request merges, using that merge commit as the DR-810 anchor.

## [0.6.0] — 2026-07-17

### github-release-guide (Beta → Stable)

- **Maturity promoted to Stable.** Basis: Claude Code/Codex material parity including the new PT
  protection fixtures (corrective reruns 0/0/0 and 0/1/0), the disposable first-public live E2E, the
  Guided tag-ruleset apply-and-verify live E2E (2026-07-17, disposable repository), and pinned project
  installation/discovery evidence. Runtime support (`Supported`) and maturity (`Stable`) remain
  separate labels.
- **Release protection checks.** The version-release profile now checks default-branch and release-tag
  protection before the tag step (applicability derived from the repository's actual release convention;
  severity split by release-critical tag-pinned consumer paths). In Guided mode the skill offers to apply
  the recommended settings and verify the result, each as its own approved repository-settings change;
  declining records the accepted risk. A shared protection-settings mutation safety rule keeps legacy
  protection in place until a replacement ruleset is verified.

### Repository

- **Playbooks protection baseline.** The canonical public-release playbook gained a release tag ruleset
  baseline (applicability/severity split), a new `recurring-release-protection-checkpoint.md` for every
  post-public version release, an overlap-first legacy-migration procedure, and a definite GitHub plan
  availability statement (verified 2026-07-17).

- **Playbooks area (`playbooks/public-release/`).** The canonical public-release playbook — six Korean
  checklists and templates for taking a private repository public and verifying it afterward — moved here
  from a standalone private repository as an unmodified snapshot import (no git history). These are
  maintainer reference documents, not installable skills; the `github-release-guide` skill continues to
  mirror their rules in its own self-contained package. The documents are now covered by this repository's
  Apache-2.0 license. Provenance details are recorded in `playbooks/README.md`.
- **Independent installation.** The root README (EN/KO) now states explicitly that each skill is
  self-contained and can be installed independently by copying only that skill's complete folder.

## [0.5.0] — 2026-07-16

### github-release-guide (new skill, Beta)

- **New skill: `github-release-guide`.** Provides a read-only `Assess` mode and an approval-gated `Guided`
  mode for an existing private github.com repository's first public transition and every version release after
  that repository is public.
- **Change-by-change approval.** File edits, commit or merge, push, tag creation and push, public visibility,
  repository settings, GitHub Release publication, and corrective work each require their own preview and
  approval. The guide checks the current state again immediately before the change; if the state differs, the
  earlier approval no longer applies.
- **Safer first publication.** The repository is never made public in the same batch as another change. Because
  public copies cannot be fully recalled and automated scans cannot guarantee every risk was found, the guide
  explains those limits and asks for direct approval immediately before changing visibility. It then checks the
  public clone, installation, links, settings, tags, and GitHub Release result.
- **Licensing and language decisions.** A missing or undecided LICENSE stops the release. Choosing no license is
  allowed only after the guide explains the practical consequence and risk in plain language, states that it is
  not legal advice, and asks for separate approval. Documentation and release-note languages are decided from
  the user's instruction and repository convention rather than assumed to be the same.
- **Claims must match evidence.** Public installation, version, compatibility, and runtime claims need direct
  evidence. A repository that explicitly chooses the stricter internal policy must also supply the required
  external claim-audit result.
- **Portable package and fixtures.** Runtime-neutral `SKILL.md`, user-friendly English/Korean READMEs, three
  one-level references, Codex UI metadata, and repository-only synthetic scenarios/answer key/worked outputs.
  At release publication, clean Claude Code/Codex material parity and the disposable live first-public E2E had
  passed; public support remained pending pinned `v0.5.0` install verification and the final strict claim audit.
- **Post-release verification.** The published `v0.5.0` package passed pinned project installation and discovery
  in both Claude Code and Codex. The final strict claim audit passed; runtime support is now `Supported` within
  that recorded evidence scope.
- **Bilingual impact diagrams.** Two editable SVG + dimension-verified 2× PNG pairs explain how to choose a
  mode and release type, and how each change moves through preview, recheck, approval, execution, and verification
  in English and Korean.

### Catalog and installation

- Root English/Korean READMEs now lead with a three-skill priority catalog and per-skill problem, value, use
  case, detail/installation link, impact visual, maturity, and evidence-scoped runtime support.
- Install documentation now distinguishes Claude Code and Codex global/project projections, uses pinned
  `v0.5.0` examples, documents clean replacement updates, and lists the installed README pair.

## [0.4.0] — 2026-07-14

### docs-claim-check (new skill, Beta)

- **New skill: `docs-claim-check`.** Checks whether the claims in public-facing documentation — READMEs, release notes, install/usage docs — are supported by the evidence the user provides (manifests, logs, tag lists, CI output, user-run command output). Advisory only: its behavioral contract prohibits command execution during an assessment and the generation of fixes or replacement text; it does not substitute for code review. These are procedural guardrails, not technical sandbox enforcement.
- **Per-claim confidence contract.** Composite statements are split into atomic claims; each claim gets exactly one label — `verified` / `unsupported` (with a reason: `missing-evidence` / `contradicted` / `insufficient-coverage`) / `stale-suspected` / `needs-human` — via a fixed decision tree. `verified` requires the claimed outcome to be directly observed in the evidence, and is always scoped to the reviewed input.
- **Auditable output format.** Every claim-assessment output begins with an **Input Scope Reviewed** section (documents, reviewed evidence with available version/timestamp context, requested-but-missing evidence, exclusions with reasons, a literal `Commands executed during the assessment: none` line, and claim-coverage counts) and ends with fixed Boundary Notes. This keeps the intended scope of `verified` explicit and auditable.
- **Contract test material.** `examples/docs-claim-check/` ships a fully synthetic fixture set ("AcmeTask", a fictitious product) covering every label, every `unsupported` reason, composite-claim splitting, and all three boundary refusals, plus a worked example output and an answer key for contract verification.
- **Beta model validation.** Contract fixtures passed on Claude Code with Fable and Sonnet (2026-07-14). Row decomposition and coverage bookkeeping may vary by model; material claim coverage, label semantics, evidence boundaries, and output-contract compliance are the compatibility criteria.
- Bilingual skill READMEs (EN/KO), root catalog row, and install docs included.

### Install docs

- The manual-install tree for `svg-infographic` now lists the skill's `README.md`/`README.ko.md` (previously omitted).
- The Update section documents the `cp -R` merge behavior (files removed upstream may remain) and the clean-update path.
- Clarified that any skill present in the checked-out ref installs the same way, and that a pinned tag contains only the skills that existed at that tag.

## [0.3.1] — 2026-07-13

### svg-infographic

- **Maturity: Stable.** The skill catalog status graduates from Beta after fourteen bilingual examples, multiple iterative public releases, compute-first layout and pre-render checks, dimension-verified 2× export, and an opt-in sketch preset. This is a skill-contract maturity label, not a platform-verification claim: macOS rendering is verified; Windows/Linux render verification remains pending.
- **New example (14th): `agent-system-sketch`.** A tidy hand-drawn component map showing an Orchestrator connected to Context, Memory, Tools, Guardrails, and Evaluation, with a feedback edge from evaluation back to the center. English + Korean use identical geometry, subset-embedded Nanum Pen Script, editable SVG, and 2× PNG.
- **Gallery preview recuration.** The root preview now uses two large sketch heroes (`incident-response-sketch`, `agent-system-sketch`) above four structurally distinct supporting examples (`zero-trust-onion`, `agent-waiting-swimlane`, `cloud-infra-topology`, `agent-task-matrix`). The previous fixed 3×2 treatment is replaced by an editorial 2-hero + 4-supporting composition in EN/KO.

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
