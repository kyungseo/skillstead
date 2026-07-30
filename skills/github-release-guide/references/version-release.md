# Version-Release Profile

Use this profile whenever an already-public github.com repository releases a new version. It is not limited to
the first release after the repository becomes public.

## Entry gate

Confirm the canonical repository, public visibility, local root and matching remote, default/release branch,
release authority, language profiles, claim-audit profile, and repository versioning policy. If the version
source or release path conflicts or is unknown, keep Guided Blocked until the owner decides.

## Determine the release

1. Identify the current released version from repository evidence and remote tags/releases.
2. Classify the candidate as patch, minor, breaking/major, or repository-defined pre-release. Never infer a
   bump solely from branch names or commit count.
3. Confirm the authoritative version source. Treat VERSION files, package manifests, build metadata, docs,
   and tags as evidence, not interchangeable authorities.
4. Check for an existing conflicting local or remote tag and verify the intended target commit/ref.
5. Classify README, CHANGELOG, version source, install/setup docs, LICENSE, compatibility, migration guide,
   and release notes with `assessment.md`.
6. Apply the separate workflow-automation and artifact-provenance axes in `assessment.md`. Classify each axis
   from its own evidence and do not infer one from the other.
7. Apply the selected claim-audit and language profiles.

## Release surface protection

Check protection state before the tag sequence, without mutation:

1. Derive the release tag namespace from the repository's actual release convention. `v*` is only a
   candidate default; ruleset patterns use fnmatch where `*` does not cross `/`, so a monorepo namespace
   like `pkg-a/v1.2.3` needs its own pattern. Verify match/overreach against the actual tag list.
2. Classify applicability and severity: when the repository releases by version tag and a release-critical
   consumer path depends on immutable tags (pinned install, tag-pinned clone, dependency, or CI), a missing
   release-tag ruleset is `Blocked`. Other protection gaps are `Needs attention` with an explicit accepted
   risk and a revisit trigger. A repository that releases without tags records `not-applicable` with the
   reason — a no-risk disposition, not an accepted risk.
3. Check the effective protection state and plan/permission capability using the settings lane in
   `assessment.md`.
4. In Guided, do not stop at reporting the gap. Offer to apply the recommended settings directly and
   verify the result. On approval, execute each ruleset as its own `Repository settings change` approval
   unit (preview, recheck, approval, apply, verify). After completion, recheck head, tag, and ruleset
   state, then resume the tag sequence.
5. When the user declines or permission is missing, keep the repository unchanged and record the explicit
   accepted risk with a revisit trigger. A protection gap is never itself mutation approval.
6. For any legacy-protection migration, follow the protection settings mutation safety rules in
   `assessment.md`.

## Release notes

Write for users, not as a commit dump. Include only applicable sections:

- Breaking Changes and Migration Guide first when required
- What's New or Bug Fixes in user-impact language
- Who is affected and any action they need to take
- Observed verification evidence
- Known Issues, limitations, compatibility, or maturity
- Full changelog/compare link when accurate

Use `vX.Y.0 — <major change>` for a useful minor title when the repository follows that convention; keep
patch titles concise. Decide pre-release and Latest flags explicitly. Do not claim completion or support
from planned evidence.

## Guided sequence

Follow the repository's branch flow and keep each shared approval unit separate:

1. Apply approved version and release-surface changes; verify consistency.
2. Commit or merge after its own preview, recheck, and approval.
3. Push the approved commit/ref after its own preview, recheck, and approval.
4. Recheck public visibility, target ref/head, version source, CHANGELOG, release-note draft, and tag absence.
5. Create and push the tag after its own preview and approval.
6. Verify the remote tag target.
7. Publish the GitHub Release after its own preview, recheck, and approval.
8. Verify the release object, install/quick-start path, public links, and repository-defined validation.

For a remote tag that was public or distributed, has exposure history, or has unknown exposure, never move,
overwrite, delete, delete and recreate, or reuse it. Keep Guided `Blocked` for that operation and hand it to
a qualified human or specialist. Correct forward with a new tag and superseding or patch release.

A remote tag confirmed to exist only on a limited remote surface with no public or distributed history may
use the separate corrective-mutation gate in `assessment.md`. Reassess and preview the exact ref, old and new
targets, downstream reachability, impact, verification, and failure state; then recheck and request explicit
approval. A general release or correction approval never authorizes the tag operation.

Classify Release metadata edits, draft deletion, published Release deletion, asset deletion/replacement, and
access withdrawal separately with `assessment.md`. Prefer superseding or patching to deleting a published
Release. If the target Release is immutable, disclose the permanent tag-name non-reuse consequence before
any exact deletion preview and never offer a platform-blocked asset mutation.

## Completion evidence

Require observed evidence for:

- Remote tag points to the intended public-ready commit
- GitHub Release exists with the intended title, notes, maturity/pre-release, and Latest disposition
- Pinned install/clone instructions resolve
- Release-critical compatibility/runtime/version claims match direct evidence
- Public README, install, changelog, compare/detail links, and examples are accessible
- Repository-defined test/build/validation passes through observed evidence, or an explicit unknown or named
  blocker remains when execution is declined or unavailable

If any item is missing, report partial or Blocked rather than complete.
