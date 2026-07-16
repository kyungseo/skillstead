# Assessment And Shared Safety Rules

Load this reference for every Assess or Guided request.

## Readiness classification

Use the most severe applicable state:

| State | Meaning |
| --- | --- |
| `Ready` | No release-critical blocker remains; Guided may preview the next unit |
| `Needs attention` | Release may proceed only after an explicit decision, limitation, or accepted risk |
| `Blocked` | Target identity, prerequisite, security, evidence, policy, or release-critical claim prevents mutation |

Unknown is not Ready. Keep `Blocked` until a required unknown is resolved. Use partial Assess when the
runtime cannot inspect the target fully.

## Evidence lanes

Check the available evidence without mutation:

1. **Target identity:** canonical GitHub owner/repo, URL, local root, remote mapping, visibility, default branch.
2. **Git state:** current branch/ref, clean or dirty worktree, ahead/behind state, release path, tag conflicts.
3. **Release surface:** README, version source, CHANGELOG, LICENSE, install/setup docs, release-note draft.
4. **Sensitive information:** tracked files, history risk, generated artifacts, screenshots, host-local paths,
   private endpoints, account identifiers, credentials, and secret patterns. Report scans as best-effort.
5. **Dependencies and security signals:** repository-defined audit/test/build results, GitHub alerts and
   security capabilities. Do not turn these checks into a security-audit claim.
6. **GitHub settings:** description, topics, default branch, Issues/Discussions/Wiki/Projects, merge method,
   head-branch deletion, branch protection/rulesets, vulnerability alerts, secret scanning, push protection.
7. **Public surface and positioning:** one-sentence description, audience, examples, limitations, links,
   images, install and quick-start claims.
8. **Release communication:** release type, title, notes, compatibility, known limitations, compare link,
   announcement only when requested.

Treat plan/account limitations and unavailable settings as explicit unknowns or accepted risks with a
revisit trigger; never hide them as passing checks.

### Sensitive-information lane detail

Use this table as the detailed contract. Inspect only available material and never expose a credential while
reporting what was checked.

| Category | Inspect | Boundary |
| --- | --- | --- |
| Credential and secret patterns | Tracked source, documentation, configuration, and generated text for known API-key, token, password, and private-key patterns | Never request, print, or copy the actual value; use a redacted location and type |
| History risk | Reachable commits, tags, and relevant refs for sensitive material removed from the current tree | Treat as best-effort history review, not exhaustive secret forensics |
| Host-local paths and account identifiers | Personal filesystem paths, usernames, emails, account IDs, and organization identifiers | Do not classify every identifier as secret; confirm whether public exposure is intended |
| Private endpoints | Localhost addresses, internal server URLs, private network names, and company-only domains | Record context and intended audience; presence alone is not an automatic blocker |
| Generated artifacts and metadata | Build outputs, archives, PDFs, Office files, images, screenshots, and embedded metadata when present and inspectable | Mark unavailable formats or tools as unknown; inspect visible content as well as metadata where capability allows |
| Environment and automation files | Environment, config, CI, deployment, and related files that may carry or reference release-sensitive values | Inventory relevant files without dumping their values; distinguish templates and placeholders from live data |
| GitHub security signals and settings | Secret scanning, push protection, vulnerability alerts, open alerts, and related availability | Keep this in the separate capability/settings lane; plan, permission, or policy limits remain explicit unknowns |

A clean result means no issue was found in the inspected scope. It is not proof that no secret, private data,
or security risk exists, and it is not a security audit. If credential exposure is suspected, stop ordinary
release recovery and follow the incident boundary.

## Release-surface classification

Classify each item, with a reason:

| Disposition | Meaning |
| --- | --- |
| `required` | The selected profile or repository policy requires it before release |
| `conditional` | Required only when the repository uses the surface or makes the corresponding claim |
| `optional` | Useful, but absence is not a blocker after an explicit disposition |
| `decision-required` | The owner must choose; do not silently default or create the file |
| `not-applicable` | The surface does not apply; record why |

LICENSE handling:

- Missing or undecided license: `Blocked`.
- Explicit no-license: explain that public visibility does not automatically grant reuse permission,
  state practical reuse/contribution risk in plain language, say this is not legal advice, and require a
  separate acknowledgment before accepting the disposition.
- Never choose or generate a license without the owner's decision.

## Claim-audit profiles

### `public-baseline` — default

Require direct evidence for release-critical operational claims: install/quick-start, version, compatibility,
supported runtime, and any claim whose failure breaks the release's primary use. Missing direct evidence is
a blocker.

For other objectively checkable claims without direct evidence, label the claim `unverified`, explain the
specific risk, and require explicit acknowledgment to proceed. A sibling claim-check skill is optional.

### `internal-strict` — explicit policy only

When claim-bearing user-facing content changed, require an external claim-audit result. If the audit is
applicable but its evidence or result is unavailable, keep the release Blocked. If no claim-bearing content
changed, record a reasoned `not-applicable` disposition.

Consume external audit results; do not reproduce their label decision tree.

## Language profiles

Choose documentation and release-communication language separately. Record one of the repository's actual
conventions, for example `ko-first`, `en-first`, `en-only`, `ko-only`, or a user-defined profile. Determine
each profile from the user's current instruction, repository policy, then stable convention. Ask before
publish when signals conflict or are unclear.

Do not require every artifact to be bilingual. Verify parity only for surfaces the selected profile says
must correspond.

## Assess output contract

Return all sections. Use plain language and omit empty command dumps.

```markdown
## Release Assessment

- Target: <owner/repo and local root or unknown>
- Mode: Assess
- Release profile: first-public | version-release | unresolved
- Claim-audit profile: public-baseline | internal-strict
- Status: Ready | Needs attention | Blocked

## Confirmed
- <observed fact and evidence>

## Unknown Or Unavailable
- <unknown, why it matters, how to resolve it>

## Decisions Needed
- <neutral options and tradeoffs>

## Blockers And Accepted Risks
- <blocker or accepted risk; write "none" when empty>

## If Skipped
- <concrete consequence of bypassing the unresolved item>

## Next Step
- <exactly one safest next step>
```

For partial Assess, say which checks could not run and do not imply readiness beyond observed evidence.

## Guided preview contract

Before every approval, show:

```markdown
## Mutation Preview

- Approval unit: <one unit only>
- Exact target: <file/ref/tag/repository/setting/release>
- Action: <what will change>
- Impact: <user-visible and repository effect>
- Preconditions rechecked: <critical state and observation time>
- Verification: <how success will be observed>
- Failure state: <possible partial state>
- Rollback or incident route: <safe reversal or escalation>
- Approval requested: <explicit yes/no question>
```

After execution, report the observed result, not the intended result. If a check fails, stop and use the
failure protocol from `SKILL.md`.
