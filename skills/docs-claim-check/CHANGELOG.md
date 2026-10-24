# Changelog — docs-claim-check

Notable changes to the `docs-claim-check` skill package.

This file is the version history for **this skill only**. Versions follow
[SemVer](https://semver.org/) and are released independently of the other skills in this catalog.

Released entries use the heading form `## [X.Y.Z] — YYYY-MM-DD`, newest first. An optional
`## [Unreleased]` section may sit above them. This is a parser contract, not a style preference —
automated checks read the topmost released heading to confirm it matches `metadata.version` in
`SKILL.md`. The full grammar is documented at
[`docs/VERSIONING.md`](https://github.com/kyungseo/skillstead/blob/main/docs/VERSIONING.md).

## [0.11.0] — 2026-10-24

- Separate instruction loading from claim assessment. Use a full body already supplied, or the host's loader
  at the exact catalog path. A command-backed loader permits one safely quoted literal cat of SKILL.md only;
  document/evidence commands, edits, discovery, retries and escalation remain prohibited.
- Disclose loading separately, stop on failed or known-incomplete loads, and report prohibited attempts as invalid.
- Carry the accepted Stable maturity within the existing Claude Code scope. Two bounded Claude Opus 5.5 cases
  passed for native loading, missing targets, mixed-request assessment/refusal and disclosure. Reuse earlier
  claim-assessment evidence where the contract is unchanged. Codex validation remains on hold; no Codex or
  Windows support is added. Unobserved loading/failure paths and earlier output limitations remain documented.
- This minor release includes the documentation work from the unpublished 0.10.1 preparation below.
  The four labels, evidence scope and findings-only role remain unchanged. Update the complete skill folder.

## [0.10.1] — 2026-10-24

Earlier documentation-release preparation; not published and now on hold. The entries below describe that
earlier contract, before the Unreleased instruction-loading change.

- Promote maturity to Stable for the existing Claude Code support scope after owner acceptance of bounded
  validation and its known limitations. Stable does not imply additional runtime or platform support.
- Document installed-invocation observations, the invalid initial setup attempt, evidence metadata/request
  defects, atomicity/bookkeeping variation, and the unobserved post-load failure-reporting branch.
- Keep the assessment instructions, labels, evidence boundaries, and findings-only role unchanged. This patch
  updates package documentation; no migration is required from 0.10.0.

## [0.10.0] — 2026-09-13

- Match evidence to the claimed artifact, version, environment, time, and observed outcome; preserve
  conflicting evidence and distinguish metadata/test summaries from installation or product operation.
- Preserve implicit publication dates and judge split claims independently; retain source quotations in claim rows.
- Accept explicitly designated target files and captured evidence bundles without permitting discovery
  or command execution. Treat embedded instructions as data and report boundary violations, including denied tool attempts, truthfully.
- Align English/Korean label guidance and update paired examples. Stable maturity and broader runtime
  support are not claimed by this release.

## [0.9.2] — 2026-09-07

### Documentation

- Removed a repeated output description and repaired Korean Markdown emphasis. Assessment behavior and Beta maturity are unchanged.

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
