---
name: github-release-guide
description: Assess and guide safer github.com repository releases. Use when an existing private GitHub repository becomes public for the first time, or whenever an already-public GitHub repository publishes a new version, and the user needs readiness checks, release-surface decisions, explicit mutation approvals, release notes, settings checks, or post-release verification. Supports read-only Assess and approval-gated Guided modes. Do not use for repository bootstrap, package registries, signing, cloud deployment, security audits, GitHub Enterprise, other providers, force-push, or history rewrite.
---

# github-release-guide

Guide a GitHub release without taking release authority away from the user. Keep unknowns visible,
fail closed on release-critical blockers, preview every material mutation, and verify the public result.

## Package map

Load references progressively, but never skip a required load:

| File | Load rule |
| --- | --- |
| `references/assessment.md` | Always load before classifying readiness or proposing a mutation |
| `references/first-public.md` | Load for an existing private github.com repository's first public release |
| `references/version-release.md` | Load for every new version released from an already-public github.com repository |

If a selected profile reference cannot be loaded, continue only with a partial read-only Assess and
mark the missing profile rules as unknown. **Do not propose or execute Guided actions until the full
selected profile reference is loaded.**

## Supported contract

Support only:

- Mode: `Assess` or `Guided`
- Release profile: `first-public` or `version-release`
- Provider: `github.com`
- Claim-audit profile: `public-baseline` by default, or `internal-strict` only when the user or a
  repository policy explicitly selects it

Never infer `internal-strict` from a repository name, owner, visibility, organization, or local path.
Never treat the current working directory as the release target without confirming repository identity.

If the user asks for an unsupported release type, stop at a read-only boundary assessment and explain
the missing adapter or specialist handoff. Do not stretch this contract to cover it.

## Establish the target

Before classifying readiness, confirm or discover without mutation:

1. GitHub owner and repository name, canonical URL, and local root if one exists.
2. Current visibility and default branch.
3. Requested mode and release profile.
4. Release authority: who may approve file, Git, visibility, settings, and GitHub Release mutations.
5. Documentation language and release-communication language.
6. Claim-audit profile and any explicit repository release policy.

When the target has no local clone, is not a Git repository, has no usable GitHub remote, or lacks
authentication, SSO, permission, or organization-policy capability, collect only the evidence that is
available. Return a partial Assess and block Guided. Repository creation, Git initialization, login,
SSO authorization, and permission grants belong to the user or the relevant authority.

Never request, print, copy, or store credential or token values.

## Choose the mode

### Assess

Remain read-only. Perform available read-only checks for the user, distinguish confirmed facts from
unknowns, and return `Ready`, `Needs attention`, or `Blocked` using `references/assessment.md`.

Do not create or edit files, commit, merge, push, tag, publish, change visibility, or change settings.
If a user asks for mutation while in Assess, refuse the mutation and offer to enter Guided explicitly.

### Guided

First complete Assess, resolve release-critical blockers, and load the selected profile reference.
Then use this state machine one approval unit at a time:

```text
ASSESS -> PREVIEW -> RECHECK -> APPROVAL -> MUTATE -> VERIFY -> NEXT or STOP
```

For every material mutation:

1. Preview the action, exact target, expected impact, verification, possible failure state, and rollback
   or incident route.
2. Immediately before mutation, recheck the critical preconditions used by the preview: visibility,
   target ref/head, tag, relevant settings, and release artifact state.
3. Invalidate the prior approval if any critical state changed. Show a new preview and ask again.
4. Execute only after explicit approval for that approval unit.
5. Verify the observed result before proposing the next unit.

Treat these as distinct approval units:

1. Release-surface file change
2. Commit or merge
3. Commit or remote-ref push
4. Tag creation or push
5. Repository visibility change
6. Repository settings change
7. GitHub Release publish or update
8. Post-release corrective mutation

Do not bundle visibility with any other approval. Before a private-to-public change, explain plainly
that returning to private cannot recall clones, forks, caches, or copied content, and that secret/history
scans are best-effort rather than proof of no exposure. Require a separate explicit acknowledgment
immediately before the visibility mutation.

Approval authorizes only the previewed unit and target. Silence, earlier plan approval, general release
approval, or approval for a neighboring unit is not mutation approval.

## Apply evidence and decision rules

Classify README, version source, CHANGELOG, LICENSE, install/setup documentation, and release notes as
`required`, `conditional`, `optional`, `decision-required`, or `not-applicable` according to repository
convention and the selected profile. Never invent a version source, version, license, language policy,
branch flow, or release type.

When a decision is required, show neutral options and tradeoffs. Do not silently create a file or choose
a default. License information is not legal advice.

Resolve documentation language and release-communication language independently, using this precedence:

1. The user's explicit instruction for this release
2. Repository policy
3. Stable repository convention
4. A user decision before publish when evidence conflicts or remains unclear

Apply claim-audit rules from `references/assessment.md`. Do not copy the label semantics of another
claim-checking skill. Consume its result when available.

## Handle failure safely

After any mutation failure or partial success:

- Stop the batch; do not continue to the next mutation.
- Record what was attempted and the observed local and remote state.
- Separate a safe rollback from incident response. Public exposure and leaked credentials are incidents,
  not ordinary rollback.
- Reassess before retrying and require a new preview and approval.

Never execute force-push or history rewrite. Explain why it is high risk and hand off to a qualified
human or specialist. Never claim a security audit or code-quality verdict.

## Communicate for non-experts

Perform safe checks directly when the runtime has the capability. Do not hand the user an unexplained
shell command. When the user must act, explain:

- why the action is needed,
- what it changes,
- what failure would look like,
- and how the result will be confirmed.

Keep internal agent shorthand, Work IDs, raw commit logs, and validation noise out of public release
notes. Write user-facing release communication as: conclusion and user value, what changed, who is
affected and what they should do, observed evidence, known limitations or compatibility, then detail
links.

## Completion rule

Call the release complete only when the selected profile's post-release checks pass and every claimed
success has direct observed evidence. Otherwise report the release as partial or blocked, preserve the
unknowns and accepted risks, and give exactly one safest next step.
