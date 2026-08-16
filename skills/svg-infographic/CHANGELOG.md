# Changelog — svg-infographic

Notable changes to the `svg-infographic` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

## [Unreleased]

Wave 1 rebuilt how this skill is asked for and how its output is proved. Nothing here is released yet —
`metadata.version` stays `0.9.0` until a version is assigned.

- **TypePacks.** Nine named diagram types (process flow, approval gate, topology, layer stack, nested scope,
  before/after, cards KPI grid, decision matrix, roadmap timeline) replace free-form archetype selection. Each
  is picked from the content signals in `references/types/manifest.yaml`, built with `scripts/generate.mjs`, and
  documented with a request phrasing in `references/PROMPT-GALLERY.md`.
- **Receipts.** A build now emits a receipt beside the artifact recording what was consumed, what was measured,
  the font delivery used, and which package surface produced it. `generate.mjs verify` re-measures the artifact
  against that receipt rather than trusting it — an entity the receipt counts but the drawing never shows is an
  error, not a rounding difference.
- **Surface treatments.** `--treatment sketch` is an opt-in experimental preview with its own paper surface,
  handwriting face and rough strokes. It is fail-closed on the artifact, not on the flag: a renamed flat render
  is refused. Copy, semantic ids and reading order are preserved across treatments, and a treatment never
  patches coordinates — where a face's metrics change the shared budget, the layout is recomputed or the build
  fails closed rather than nudged into place. Measured geometry therefore does differ: at 1.8x the handwriting
  face widens labels enough that `topology-component` does not route under `sketch`, and that limitation is
  recorded in `references/design-kernel.md` §7g rather than met by thinning the clearance it cannot hold.
- **Layout containers and boundaries.** Zones, boundaries and reservations are declared in the artifact and
  re-measured, so a container that says it holds something must actually contain it. A declared topology boundary
  is drawn as a real container instead of being counted but omitted.
- **Connector clearance.** The interval a connector may attach within now reserves the arrowhead's own painted
  width and the corridor clearance, not just the line. An arrowhead used to land under a zone label chip and be
  covered by it.
- **Palette contract.** `check-svg.mjs --palette-profile` compares every paint against a declared profile.
  Canonical artifacts carry zero palette errors; the colours a profile cannot yet express are recorded as a
  bounded, pinned debt rather than quietly rounded to the nearest token.
- **Reproducible portable output.** A subset embedded in an artifact no longer carries the clock it was built
  at, so the same input and the same glyph set produce the same bytes.
- **Text measurement.** Fragment text bounds are measured against the package's own bundled face, loaded and
  verified before measuring. Measurement no longer depends on which fonts the machine happens to have installed.

## [0.9.0] — 2026-08-09

- Added opt-in source layout contracts for panel title/subtitle/divider budgets and icon-text card center alignment,
  with deterministic error/warning fixtures for provable and unsupported geometry.
- Added a one-line/two-line page-title contract that derives the left accent rail from the eyebrow and final title
  line, rejecting copied fixed heights and subtitle-clearance intrusion before rendering.

## [0.8.3] — 2026-07-30

- Added a first-use path with an example request, adjustable defaults, and a direct link to the catalog-wide
  installation guide.
- Clarified that `scripts/render.mjs` is the canonical renderer and `scripts/render.sh` is its optional Bash
  wrapper.

## [0.8.2] — 2026-07-29

- Corrected the package tree in `README.md` and `README.ko.md` to list every file the complete-folder
  install copies, including `README.md`, `README.ko.md`, `CHANGELOG.md`, and `LICENSE.txt`.
- Pointed the Korean README at the Korean install guide (`docs/INSTALL.ko.md`) instead of the English one.

## [0.8.1] — 2026-07-28

- Added canonical-name and intent-only prompt examples while preserving output-path confirmation and render
  approval boundaries.
- Added repository-only collision fixtures that keep structured visual ownership separate from prose editing.

## [0.8.0] — 2026-07-24

**Per-skill versioning baseline.** This is not a functional release, and no feature of this skill changed
here. `0.8.0` is the point at which the version number became this skill's own rather than one shared
with the whole catalog — the number carries over from catalog release `v0.8.0` so that the two histories
line up.

The package contents are **not** identical to that catalog release. This entry is where the baseline
artifacts below were added, so the tree deliberately differs. The date is the catalog release date this
baseline continues from; per-skill release dates begin after cutover.

Changes to this skill before that point are recorded in the repository's catalog changelog and are not
reproduced in this file. This skill appears under catalog versions `v0.1.0`, `v0.1.1`, `v0.2.0`, `v0.3.0`, `v0.3.1`, `v0.7.0`, `v0.7.1`, `v0.8.0` — see
[the catalog changelog](https://github.com/kyungseo/skillstead/blob/main/CHANGELOG.md).

- Declared `metadata.version` in `SKILL.md`.
- Bundled the Apache-2.0 licence text as `LICENSE.txt` so it travels with a folder-only install.
