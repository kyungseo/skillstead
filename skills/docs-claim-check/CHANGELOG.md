# Changelog — docs-claim-check

Notable changes to the `docs-claim-check` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

## [0.9.1] — 2026-07-30

- Added first-use guidance for supplying claim text and evidence, requesting findings only, and installing the
  complete package from the current pinned tag.
- Aligned the user guide with the contract term `confidence label`, using natural Korean in the companion README.

## [0.9.0] — 2026-07-28

- Added a pre-tool missing-target branch that asks for the document or claim text without listing, searching,
  reading repository files, or executing a command.
- Preserved the existing missing-evidence path when the target text is already supplied.
- Added canonical-name and natural request examples, including the read-only boundary for ambiguous or mixed
  claim-check requests.
- Added repository-only invocation fixtures that keep claim judgment separate from prose revision.

## [0.8.0] — 2026-07-24

**Per-skill versioning baseline.** This is not a functional release, and no feature of this skill changed
here. `0.8.0` is the point at which the version number became this skill's own rather than one shared
with the whole catalog — the number carries over from catalog release `v0.8.0` so that the two histories
line up.

The package contents are **not** identical to that catalog release. This entry is where the baseline
artifacts below were added, so the tree deliberately differs. The date is the catalog release date this
baseline continues from; per-skill release dates begin after cutover.

Changes to this skill before that point are recorded in the repository's catalog changelog and are not
reproduced in this file. This skill appears under catalog versions `v0.4.0` — see
[the catalog changelog](https://github.com/kyungseo/skillstead/blob/main/CHANGELOG.md).

- Declared `metadata.version` in `SKILL.md`.
- Bundled the Apache-2.0 licence text as `LICENSE.txt` so it travels with a folder-only install.
