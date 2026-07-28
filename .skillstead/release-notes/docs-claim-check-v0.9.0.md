> **Latest** refers to the most recently published individual skill release, not a catalog version.

## docs-claim-check 0.9.0

This release makes the no-command boundary explicit before any tool use. If the target text is missing, the
skill asks for it without listing, searching, reading repository files, or executing a command. If only evidence
is missing, it keeps the existing focused evidence-request path.

It also adds canonical-name and natural request examples plus repository-only fixtures for missing-target,
partial-evidence, ambiguous, and cross-skill requests. The skill remains advisory-only, and its runtime support
claim does not expand.
