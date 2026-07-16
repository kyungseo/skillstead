# First-Public Release Profile

Use this profile only for an existing private repository on github.com. Repository bootstrap and Git
initialization are outside v1.

## Entry gate

Confirm all of the following before Guided:

- Canonical GitHub repository identity and private visibility
- Usable local Git repository and matching GitHub remote
- Default branch and release path
- Owner or delegated authority for visibility and settings
- Authentication, organization SSO, permission, and policy capability
- Selected documentation language, release-communication language, and claim-audit profile

If any prerequisite is unavailable, perform only the possible partial Assess and keep Guided Blocked.

## Assess sequence

1. Classify the release surface using `assessment.md`.
2. Confirm the intended first public version/tag and whether pinned install or setup instructions require
   the tag to exist before visibility changes.
3. Check the clean baseline according to repository convention: worktree, active/release-blocking work,
   stale public status, backlog exposure, README/manual/examples, LICENSE disposition, CONTRIBUTING
   disposition, and generated artifacts.
4. Perform a best-effort sensitive-information and history-risk sweep. A clean scan is not proof that
   nothing sensitive exists.
5. Review repository-defined dependency/test/build evidence and GitHub security alerts. Block unresolved
   critical alerts; record unavailable features and accepted risks explicitly.
6. Review description, topics, About URL, feature toggles, merge methods, automatic branch deletion,
   rulesets/protection, bypass, security settings, and profile pinning intent.
7. Prepare public positioning, release title/notes, limitations, install/quick-start evidence, and optional
   announcement. Do not publish an announcement unless requested.

## Guided sequence

Keep approval units separate and follow the shared state machine:

1. Make and verify approved release-surface file changes.
2. Commit or merge the public-ready state after a dedicated preview and approval.
3. Push the approved commit/ref after a dedicated preview and approval.
4. Create and push a required tag after a dedicated preview and approval. Verify pinned instructions can
   resolve it before visibility changes.
5. Re-run the clean baseline, critical-alert check, target identity, remote head, tag, and visibility checks.
6. Present the visibility-specific irreversibility warning and best-effort scan limitation. Ask for a
   separate explicit acknowledgment immediately before mutation.
7. Change visibility only after that acknowledgment; do not batch settings or release publication with it.
8. Verify public visibility immediately, then preview and apply each settings unit separately.
9. Publish the GitHub Release only after a separate preview, recheck, and approval.
10. Run post-public verification and record the observed evidence and accepted risks.

## Post-public verification

Verify directly where capability allows:

- Public clone from a fresh temporary location
- Documented install/quick start and repository-defined validation commands
- README rendering, links, images, examples, LICENSE display, and public-facing limitations
- Default branch, description/topics, Issues/Discussions, merge policy, rulesets/protection, long-lived branch
  deletion safety, vulnerability alerts, secret scanning, push protection, and open alerts
- Tag target, GitHub Release title/notes, pinned install link, and any compare/detail links

Record settings that are unavailable because of plan, account, permission, or policy, with a reason and
revisit trigger.

## Incident boundary

If public exposure reveals a credential or sensitive content, stop ordinary rollback. Tell the user to
rotate or revoke the credential and obtain specialist help for any history rewrite. Returning to private
does not undo exposure.
