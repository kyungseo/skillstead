# Changelog — svg-infographic

Notable changes to the `svg-infographic` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

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
