> **Latest** refers to the most recently published individual skill release, not a catalog version.

## github-release-guide 0.9.0

This release strengthens the common safety contract for correcting GitHub Release objects. It separates
consumer exposure from platform mutability, keeps metadata edits, draft deletion, published Release deletion,
asset mutation, and access withdrawal as distinct actions, and blocks broad requests such as “fix the release”
until the exact object and action are identified.

Release-automation review now activates only for release/tag workflows, artifact producers or publishers, and
release-critical elevated-permission paths. Artifact provenance remains an independent axis, so manual or
producer-unknown artifacts still receive provenance handling without expanding unrelated CI into a workflow
security audit.

Repository-provided scripts, builds, scanners, and workflows now require an exact execution preview and
separate approval even during read-only assessment. Output hygiene also covers PII without exposing full
values. The new release-object and applicability fixture suites produced materially equivalent judgments in
fresh isolated Claude Code and Codex runs, including corrected oracle and applicability-axis cases.

These rules strengthen common release decisions; they do not promise exhaustive detail for every repository
profile, platform state, workflow exploitability question, privacy audit, or security audit. Unknown evidence
continues to remain unknown or a named blocker rather than becoming a pass.

The attached source archives are a snapshot of the whole repository at this commit. This release versions only
the `github-release-guide` skill — to install, copy the `skills/github-release-guide/` folder as described in
`docs/INSTALL.md`.
