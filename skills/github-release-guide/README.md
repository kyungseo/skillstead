# github-release-guide

**English** · [한국어](./README.ko.md)

Publishing a GitHub repository safely involves more than pressing a release button. Documentation, license,
version, tags, repository settings, and public visibility all need to agree. Some of those changes are hard to
undo once other people can clone or copy the repository.

`github-release-guide` helps you understand what is ready, what is still unknown, and what decision is needed
next. It can then guide the release one approved change at a time. You remain the release authority throughout
the process.

> **Runtime status:** Claude Code and Codex behavior match on clean synthetic fixtures, the disposable
> first-public live E2E passed, and both runtimes discovered the complete pinned `v0.5.0` project package.
> The final strict claim audit also passed, so public support is `Supported` within that recorded evidence scope.

## Choose how you want to proceed

| Mode | What happens |
| --- | --- |
| `Assess` | The guide only inspects available information. It reports `Ready`, `Needs attention`, or `Blocked`, explains why, and gives one safest next step. Nothing is changed. |
| `Guided` | After the assessment is ready, the guide shows one proposed change, checks the current state again, asks for your approval, performs only that change, and verifies the result. |

Start with `Assess` if you are unsure. Moving to `Guided` never turns an earlier plan approval into permission
to change the repository.

## Choose the release type

### `first-public`

Use this when an existing private repository on github.com is ready to become public for the first time. The
guide checks the public README and install path, license decision, intended first version and tag, sensitive
information risk, repository settings, and release notes before it proposes any public-visibility change.

Immediately before the repository becomes public, the guide explains that copied public content cannot be
fully recalled and that automated scans cannot guarantee every risk was found. It then asks for a separate,
direct approval for that visibility change.

### `version-release`

Use this whenever an already-public github.com repository is preparing a new version. It is not limited to the
first version released after the repository becomes public. The guide checks the intended version, authoritative
version source, CHANGELOG, release notes, target commit, tag conflict, and direct install or compatibility
evidence. File changes, commit, push, tag, and GitHub Release publication remain separate approval steps.

## What the guide checks before publication

Assess reviews the material it can access and keeps anything unavailable visible as unknown. These checks help
find release risks, but they are not an automated security guarantee or a replacement for a security audit.
They apply to both release types and matter especially for `first-public`, when the repository and its history
become publicly accessible for the first time.

| Check area | What it looks for | Important limit |
| --- | --- | --- |
| Credentials and secrets | API-key, token, password, and similar patterns in tracked files | It never asks for or prints the actual credential value |
| Git history | Sensitive material that was deleted from current files but may remain in earlier commits | History review is best-effort, not exhaustive forensics |
| Personal environment traces | Host-local paths, usernames, emails, and account or organization identifiers | An identifier is not automatically secret; public intent still needs context |
| Internal connections | Localhost, internal server URLs, private network names, and company-only domains | Presence alone does not block release; the intended audience must be confirmed |
| Generated files and metadata | Build outputs, archives, PDFs, Office files, images, screenshots, and embedded metadata | It checks only formats and content available to the current runtime |
| Configuration and automation | Environment, config, CI, and deployment files that may expose or reference sensitive values | It inventories relevant files without dumping their values |
| GitHub security settings | Secret scanning, push protection, vulnerability alerts, and open alerts | Availability depends on plan, permission, and organization policy |

A clean result means that no issue was found in the inspected scope. It does not prove that the repository has
no secret, private information, or security risk. If something cannot be checked, the assessment reports it as
unknown instead of silently passing it.

## What to prepare

You can begin without having every answer. The assessment will keep missing information visible instead of
guessing. When available, provide:

- the exact GitHub owner and repository,
- whether the repository is private or public,
- the first public version or the version being prepared now,
- the repository's branch and release policy,
- README, install instructions, CHANGELOG, LICENSE decision, and release-note draft,
- recent test, build, clone, or install results,
- and who is authorized to approve repository changes.

Never provide a password, access token, or other credential value to the skill.

## Safety rules you can rely on

- A missing critical fact stays visible as a blocker; the guide does not silently assume success.
- Every material change gets its own preview and approval.
- The guide checks important state again immediately before a change. If it changed, the old approval is void.
- Public visibility is never bundled with settings, tags, or GitHub Release publication.
- If a step fails or succeeds only in part, the guide stops before making another change. If credentials may
  have been exposed, it treats the situation as a security incident instead of merely undoing the last step.
- The guide never force-pushes or rewrites published history.

## Example prompts

### Assess

```text
Use github-release-guide in Assess mode to check whether this private repository is ready to become public.
```

```text
Use github-release-guide in Assess mode to review this public repository's upcoming version release.
```

### Guided

```text
Use github-release-guide in Guided mode to prepare this private repository for its first public release.
Start with Assess. If it is Ready, show only the first proposed change and its impact. Do not change the
repository or its visibility until I approve that exact step.
```

Asking for `Guided` mode does not approve the whole release. The guide begins with Assess and asks again before
each later change.

## Scope limits

V1 supports github.com only. Use it once when an existing private repository becomes public for the first time,
then use it again for every new version released from that public repository. It does not create repositories,
initialize Git, publish packages to registries, sign binaries, deploy cloud services, perform a security audit,
force-push, or rewrite history.

The installed folder includes this README, the agent instructions in `SKILL.md`, information shown in the Codex
interface, and the rules for each release type. The synthetic examples and diagrams used for validation stay in
the Skillstead repository rather than the installed skill folder.
