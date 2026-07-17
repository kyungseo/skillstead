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
6. Apply the selected claim-audit and language profiles.

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

Do not move or overwrite an existing remote tag silently. Treat tag correction as a post-release corrective
mutation with a new assessment, explicit preview, and approval; explain downstream cache and consumer risk.

## Completion evidence

Require observed evidence for:

- Remote tag points to the intended public-ready commit
- GitHub Release exists with the intended title, notes, maturity/pre-release, and Latest disposition
- Pinned install/clone instructions resolve
- Release-critical compatibility/runtime/version claims match direct evidence
- Public README, install, changelog, compare/detail links, and examples are accessible
- Repository-defined test/build/validation passes or a named blocker remains

If any item is missing, report partial or Blocked rather than complete.
