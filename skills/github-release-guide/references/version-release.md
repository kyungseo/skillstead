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
