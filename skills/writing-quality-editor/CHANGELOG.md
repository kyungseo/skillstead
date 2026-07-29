# Changelog — writing-quality-editor

Notable changes to the `writing-quality-editor` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

## [0.10.0] — 2026-07-29

- Clarified what happens when the audience and the source register disagree. A draft carries what a document
  means, but supplied facts and reviewed evidence outrank it, and it settles nothing on its own about how the
  document reads: style can change when it does not fit the intended reader, while everything the document
  claims, requires, or warns stays fixed. Audience was already part of the editing contract; the priority between
  it and preservation was not.
- Separated the invariant ledger, the author's voice, and the register into distinct layers. Voice here means how
  the writing carries itself — warmth, directness, rhythm — not what the document commits to, and a trait changes
  only on request or where it conflicts with the audience.
- Gave `Revise` two strategies. Alongside local edits, a structural revise may move paragraphs and sections when
  it names the reader problem, points to the sections involved, and changes no more than that problem requires.
  Relationships, step order, prerequisite placement, referenced headings, and link targets survive it.
- Added five scenarios covering register adjustment, register retention under a host contract, density reduction,
  voice survival, and a bounded structural revise.

## [0.9.1] — 2026-07-29

- Pointed the Korean README at the Korean install guide (`docs/INSTALL.ko.md`) instead of the English one.

## [0.9.0] — 2026-07-28

- Added `WQE` as a natural-language discovery alias in the common description and user examples. The canonical
  skill name remains the most predictable selector; the alias is not a `$WQE` or `/WQE` command.
- Added positive, ambiguous, incidental-token, and host-workflow precedence scenarios to the repository-only
  invocation contract.

## [0.8.0] — 2026-07-24

**Per-skill versioning baseline.** This is not a functional release, and no feature of this skill changed
here. `0.8.0` is the point at which the version number became this skill's own rather than one shared
with the whole catalog — the number carries over from catalog release `v0.8.0` so that the two histories
line up.

The package contents are **not** identical to that catalog release. This entry is where the baseline
artifacts below were added, so the tree deliberately differs. The date is the catalog release date this
baseline continues from; per-skill release dates begin after cutover.

Changes to this skill before that point are recorded in the repository's catalog changelog and are not
reproduced in this file. This skill appears under catalog versions `v0.7.0` — see
[the catalog changelog](https://github.com/kyungseo/skillstead/blob/main/CHANGELOG.md).

- Declared `metadata.version` in `SKILL.md`.
- Bundled the Apache-2.0 licence text as `LICENSE.txt` so it travels with a folder-only install.
