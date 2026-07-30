# Changelog — github-release-guide

Notable changes to the `github-release-guide` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

## [Unreleased]

- Separated consumer exposure from platform mutability for Release-object corrections and made metadata edits,
  draft deletion, published Release deletion, asset mutation, and access withdrawal distinct actions.
- Refused move, overwrite, deletion, recreation, or reuse of public, distributed, exposure-history, or
  exposure-unknown release tags while preserving an exact approval gate for confirmed limited-remote correction.
- Added RO1–RO8 answer-key-blind Claude Code/Codex parity evidence, including immutable-release deletion,
  forward correction, non-recall acknowledgment, and broad-request denial behavior.
- Limited release-automation review to release/tag workflows, artifact producers or publishers, and
  release-critical elevated-permission paths, with static trust and provenance classification rather than
  a workflow security-audit claim.
- Split workflow-automation and artifact-provenance applicability so manual or producer-unknown artifacts
  retain provenance handling without expanding unrelated workflow review.
- Separated read-only repository state from repository-code execution safety; scripts, builds, scanners, and
  workflows now require an exact execution preview and separate approval, while declined or unavailable
  evidence remains unknown or a named blocker.
- Extended no-value-output hygiene to PII while preserving masked identifying references, and added RA1–RA7
  fixtures for applicability, trust, provenance, execution refusal, and non-universal attestation behavior.

## [0.8.2] — 2026-07-30

- Added a first-use path for choosing `Assess` or `Guided`, selecting a release profile, and installing the
  complete package from the current pinned tag.
- Clarified the Korean safety guidance so mutation failure, partial success, and credential incidents remain
  distinct recovery states.

## [0.8.1] — 2026-07-28

- Added canonical-name and intent-only release examples that distinguish read-only readiness assessment from
  approval-gated repository mutations.
- Added repository-only collision fixtures for release requests that also involve public-claim or prose work.

## [0.8.0] — 2026-07-24

**Per-skill versioning baseline.** This is not a functional release, and no feature of this skill changed
here. `0.8.0` is the point at which the version number became this skill's own rather than one shared
with the whole catalog — the number carries over from catalog release `v0.8.0` so that the two histories
line up.

The package contents are **not** identical to that catalog release. This entry is where the baseline
artifacts below were added, so the tree deliberately differs. The date is the catalog release date this
baseline continues from; per-skill release dates begin after cutover.

Changes to this skill before that point are recorded in the repository's catalog changelog and are not
reproduced in this file. This skill appears under catalog versions `v0.5.0`, `v0.6.0` — see
[the catalog changelog](https://github.com/kyungseo/skillstead/blob/main/CHANGELOG.md).

- Declared `metadata.version` in `SKILL.md`.
- Bundled the Apache-2.0 licence text as `LICENSE.txt` so it travels with a folder-only install.
