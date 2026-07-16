# Worked example — first-public Assess

Synthetic input: scenario `FP1`, before any mutation.

## Release Assessment

- Target: `northwind-labs/fieldnotes-fixture` at the confirmed local repository root
- Mode: Assess
- Release profile: first-public
- Claim-audit profile: public-baseline
- Status: Ready

## Confirmed

- The GitHub repository identity matches the local origin and its current visibility is private.
- The default branch is `main`; the local worktree is clean and matches the reviewed remote head.
- README and install instructions describe the same `v1.0.0` first-public candidate.
- Apache-2.0 is the owner's intended license and a matching LICENSE file is present.
- The supplied secret/history sweep and critical-alert check have no blocking finding. These checks are
  best-effort and do not prove that exposure is impossible.
- The pinned install path is scheduled to be verified against the pushed tag before visibility changes.

## Unknown Or Unavailable

- Organization-level ruleset behavior after public visibility is not directly observable while private.
  It must be checked immediately after the visibility change.

## Decisions Needed

- Decide whether Issues should be enabled after public release. Enabling them offers a public feedback path;
  leaving them disabled keeps support private.

## Blockers And Accepted Risks

- Blockers: none.
- Accepted risk not yet requested: none. The organization-level ruleset remains a post-public verification
  item, not a hidden pass.

## If Skipped

- Skipping the pinned-tag check could make the public quick start fail immediately.
- Skipping the post-public ruleset check could leave `main` without the intended deletion and push controls.

## Next Step

- Preview the release-surface file-change unit, including the exact release-note draft and verification.
