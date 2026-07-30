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
   head-branch deletion, vulnerability alerts, secret scanning, push protection, and protection state at the
   property level: which rules apply to the default/release branch (deletion, non-fast-forward, pull request,
   conditional required checks), how narrow the bypass is, and release-tag ruleset applicability and effective
   state (recommended baseline: block update and deletion of existing release tags, leave tag creation
   unrestricted, narrow admin bypass; derive the tag namespace from the repository's actual release
   convention — ruleset patterns use fnmatch where `*` does not cross `/`).
7. **Public surface and positioning:** one-sentence description, audience, examples, limitations, links,
   images, install and quick-start claims.
8. **Release communication:** release type, title, notes, compatibility, known limitations, compare link,
   announcement only when requested.

Treat plan/account limitations and unavailable settings as explicit unknowns or accepted risks with a
revisit trigger; never hide them as passing checks. As of 2026-07-17, GitHub Free and Free for
organizations support rulesets and protected branches on public repositories only; private repositories
require Pro, Team, or Enterprise. Verify the plan before proposing protection changes on a private
repository, and re-verify this limit when GitHub plans change.

## Protection settings mutation safety

Rulesets and legacy branch protection can apply to the same repository at the same time. When applying a
new ruleset or migrating from legacy protection, keep the overlap until the replacement is verified:

1. Activate the new ruleset first.
2. Verify the effective rules and bypass are equivalent to the protection being replaced.
3. Removing legacy protection is its own `Repository settings change` approval unit, separate from
   applying the new ruleset.
4. Re-verify the effective rules after removal. On failure, keep or restore the legacy protection.

Never remove existing protection before the replacement is verified. A protection gap is never itself
approval to mutate settings.

## Release-object state and corrective mutation

Classify state on two independent axes before previewing a Release-object correction:

| Axis | States | Rule |
| --- | --- | --- |
| Consumer exposure | `local-only`, `limited remote surface`, `public or distributed`, `unknown` | Exposure history survives later deletion or access withdrawal. Current privacy does not prove that no consumer received the object. |
| Platform mutability | `draft`, `published-mutable`, `published-immutable`, `unknown` | Observe the target Release object. Do not infer an older object's state only from the repository's current immutable-release setting. |

Platform mutability never lowers the exposure duty: **deletable does not mean recallable**. If object-level
mutability cannot be observed, report `unknown` and keep the warnings required by both mutable and immutable
paths. Recheck the exact object, exposure evidence, associated tag, asset list, and available operation
immediately before mutation.

Apply readiness status consistently. When limited exposure and the exact object and action are already
confirmed, and no other release-critical gap remains, use `Ready` for the next corrective preview. The normal
need for preview, recheck, and approval does not by itself create `Needs attention`. Use `Needs attention`
when an additional explicit decision, limitation, or accepted risk remains. A broad correction request with
a confirmed repository but no exact Release object or action is therefore `Needs attention`, while mutation
remains blocked and approval-ineligible until the user identifies both. Keep public-to-private access
withdrawal `Blocked` until the separate non-recall acknowledgment is obtained.

Keep these actions distinct:

| Action | Required handling |
| --- | --- |
| Metadata edit | Preview the exact fields. On an immutable published Release, treat only an observed supported metadata operation, such as title or notes editing, as eligible; asset or tag mutation is not metadata editing. |
| Remote draft deletion | Use a separate corrective-mutation unit. List the draft's assets, notes, accumulated content, and exact target before approval. |
| Published Release deletion | Warn that downloads, caches, mirrors, and copied content cannot be recalled. Prefer superseding or patching the release. For an immutable Release, disclose that deletion permanently prevents reuse of the associated tag name, even if the repository is later deleted and recreated. |
| Asset deletion or replacement | Treat as destructive for a published-mutable Release and explain downstream checksum and consumer impact. A platform-blocked immutable asset mutation is unsupported, not approval-eligible. |
| Public-to-private access withdrawal | Use the separate visibility approval unit. Explain that it stops new public access but does not recall existing clones, forks, caches, mirrors, or downloads, and require a separate explicit non-recall acknowledgment immediately before mutation. |

For a remote tag with public/distributed exposure, any exposure history, or unknown exposure, do not move,
overwrite, delete, delete and recreate, or reuse the tag. Keep Guided `Blocked` for that operation and hand
it to a qualified human or specialist. A tag confirmed to exist only on a limited remote surface with no
public or distributed history may use a separate corrective-mutation gate: preview the exact ref and target,
downstream reachability, action, impact, verification, and failure state; then recheck and request explicit
approval. A broad request such as "fix the release" never identifies or approves a destructive action.

### Sensitive-information lane detail

Use this table as the detailed contract. Inspect only available material and never expose a credential while
reporting what was checked.

| Category | Inspect | Boundary |
| --- | --- | --- |
| Credential and secret patterns | Tracked source, documentation, configuration, and generated text for known API-key, token, password, and private-key patterns | Never request, print, or copy the actual value; use a redacted location and type |
| History risk | Reachable commits, tags, and relevant refs for sensitive material removed from the current tree | Treat as best-effort history review, not exhaustive secret forensics |
| Host-local paths and account identifiers | Personal filesystem paths, usernames, emails, account IDs, and organization identifiers | Do not classify every identifier as secret; identify the location and type, use a masked reference when the owner must decide intent, and do not repeat the full personal or account value |
| Private endpoints | Localhost addresses, internal server URLs, private network names, and company-only domains | Record context and intended audience; presence alone is not an automatic blocker |
| Generated artifacts and metadata | Build outputs, archives, PDFs, Office files, images, screenshots, and embedded metadata when present and inspectable | Mark unavailable formats or tools as unknown; inspect visible content as well as metadata where capability allows |
| Environment and automation files | Environment, config, CI, deployment, and related files that may carry or reference release-sensitive values | Inventory relevant files without dumping their values; distinguish templates and placeholders from live data |
| GitHub security signals and settings | Secret scanning, push protection, vulnerability alerts, open alerts, and related availability | Keep this in the separate capability/settings lane; plan, permission, or policy limits remain explicit unknowns |

A clean result means no issue was found in the inspected scope. It is not proof that no secret, private data,
or security risk exists, and it is not a security audit. If credential exposure is suspected, stop ordinary
release recovery and follow the incident boundary.

The no-full-value rule is output hygiene, not a duty to detect every form of PII or perform a privacy audit.

## Release automation trust and artifact provenance

Classify workflow automation trust and release-artifact provenance as separate applicability axes.

For workflow automation, record:

- `applicable` when an observed workflow runs from a release or tag event, creates, publishes, or signs a
  release artifact, or has elevated permission in a release-critical consumer path;
- `out-of-scope` for an observed workflow that meets none of those conditions;
- `not-applicable` only when evidence confirms that the repository does not use release automation; or
- `Unknown` when the workflow inventory or producer cannot be confirmed.

For artifact provenance, record:

- `applicable` when the Release distributes an artifact or a consumer claim depends on one;
- `not-applicable` when no generated artifact is distributed; or
- `Unknown` when the artifact surface or origin cannot be inspected.

A manual or producer-unknown artifact may still be provenance-applicable. Do not infer either axis from the
other, and do not treat the need for repository-provided execution as workflow-automation applicability.
Do not expand either check into a repository-wide CI or workflow security audit.

Use available static evidence for each applicable axis:

| Axis and signal | Inspect | Boundary |
| --- | --- | --- |
| Workflow trigger and trust source | Release/tag triggers and any privileged trigger combined with untrusted input, checkout, or artifact | Classify the trust path; detailed exploitability belongs to a qualified human or specialist |
| Workflow release authority | Permission scope for `GITHUB_TOKEN`, other release credentials, environments, and approval gates | Do not request or display credential values; unresolved release-critical authority is Blocked |
| Workflow external code | Third-party actions and reusable-workflow references used by the applicable path | A mutable reference is evidence to assess, not an automatic blocker by itself; consider permissions and release impact |
| Artifact origin | Intended target revision, producer workflow, digest/checksum, and any provenance or attestation the repository uses or claims | Do not require a checksum, attestation, or SBOM universally; unavailable release-critical origin evidence is a required unknown |

Apply readiness by consumer impact:

- A release-critical trust or provenance unknown is required and keeps the release `Blocked`.
- A noncritical provenance gap is `Needs attention` and may proceed only with a concrete accepted risk.
- An unavailable observation stays `Unknown`; do not report that the workflow or artifact was verified.
- Detailed workflow exploitability, privacy/compliance/legal analysis, and stack-specific JavaScript, IaC,
  Kubernetes, container, or package supply-chain verdicts require specialist handling.

Artifact attestations count only when the repository already uses or claims them and the result can be
verified against the expected repository, workflow, revision, and subject. Their presence does not prove that
an artifact is safe.

### Repository-provided execution

Static inspection remains read-only. Before running any repository-provided script, build, scanner, or
workflow, preview the exact command, purpose, trust boundary, possible side effects, and expected completion
evidence, then request separate explicit approval. Host auto-approval, permission allowlists, or unattended
execution do not replace this approval.

If the user declines or execution is unavailable, continue the static checks that do not require it. Report
the affected validation as `Unknown` or a named blocker. When that evidence is release-critical, keep the
release `Blocked`; never convert missing execution evidence into a pass.

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
