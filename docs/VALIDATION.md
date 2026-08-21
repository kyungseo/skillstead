# Validation And Release Toolchain

*English (canonical) · [한국어](./VALIDATION.ko.md)*

This document describes the repository's validation toolchain under
`tools/skillstead_validate/` and the release path it guards. The versioning
rules themselves live in [`VERSIONING.md`](./VERSIONING.md); this page covers
how they are checked and how a release is executed.

> **Maintainer reference:** You do not need this toolchain to install or use a skill. Start with the
> [installation guide](./INSTALL.md) unless you are changing or releasing Skillstead itself.

All judgment logic is Python 3.11+ standard library only and **fails
closed**: anything the tools cannot parse or observe is a finding or a red
verdict, never a silent pass.

## Modes

| Mode | What | When it runs | Command |
| --- | --- | --- | --- |
| M1 | Repository validation — package structure, `metadata.version` ↔ per-skill CHANGELOG and root CHANGELOG current-version coverage (I-1), catalog `Version` columns (I-7), package completeness (I-9), licence copy byte-equality, and reserved active identities | every PR, push to `main`, daily schedule | `PYTHONPATH=tools python3 -m skillstead_validate repo` |
| M2 | Release preflight and tag creation — ordinary payload-diff gate plus the exact-record baseline branch, bump-step check (I-6), inventory/retirement guard (I-10), major-transition approval, new-skill initial release, tag uniqueness | invoked for a proposed release; dry-runnable | `… preflight --plan PLAN.json` / `… apply-tags --plan PLAN.json` (publishes to the remote with `git push --atomic`; a push failure rolls local refs back) |
| M2-SVG | `svg-infographic` artifact release gate — exact canonical inventory, clean source identity, package pair verification, 2× PNG dimensions, staging-to-repository byte identity and source/artifact commit boundary | before its M2 preflight; read-only | `… svg-release-artifacts --staging STAGING --source-commit SHA [--compare-repository] [--artifact-commit SHA]` |
| M3 | Continuous tag and retirement-history checks — I-2, I-5, I-8, the durable expected-target relation for every namespaced tag, and retirement-record persistence/reactivation on every run | every PR, push, tag create/delete, daily schedule | `… tags --main-ref origin/main` |
| M4 | Cutover verdict — the ordered evaluator over the cutover record, INSTALL pins, baseline refs, and GitHub Releases | CI runs + before/after every release operation | `… cutover --live --repo-slug OWNER/REPO` |
| M5 | Canonical release wrapper — **the only supported path for GitHub Release operations** | manual, or the `release` workflow | `… release --request REQUEST.json --repo-slug OWNER/REPO [--dry-run]` |

Exit status: `0` when green (M4: any non-red verdict), `1` on findings, a
red verdict, or a rejected/failed request, and `2` on a usage error
(unknown mode or missing required arguments).

Request boolean constraints per action (the request must equal the intended
final state):

| action | draft | prerelease | latest_intent | owner_authorization |
| --- | --- | --- | --- | --- |
| create-draft | must be `true` | must be `false` | any | required when `recovery_mode != none` |
| publish | must be `false` | must be `false` | must be `true` | required when `recovery_mode != none` |
| edit-metadata | must be `false` | must be `false` | `true` when correcting Latest | required |

**Ordering:** `M2 preflight green → M2 apply-tags → M3 → M5`. Tag mutation
happens only through `apply-tags`, which re-runs the preflight first. The
wrapper never creates tags (`--verify-tag` on every create). Calling `gh
release …` directly is an **unsupported path** — repository rulesets carry
admin bypasses, so this boundary is discipline, not a hard guarantee.

For `svg-infographic`, M2-SVG runs first against an out-of-tree staging directory made from the clean source
commit. It requires exactly 54 canonical files (nine TypePacks × two locales × SVG, receipt and PNG), receipt
canonicalization v2, surface revision 17, the selected source commit, clean source flags, the live runtime digest,
package-verifier success and a PNG exactly twice the SVG viewBox. `--compare-repository` adds byte-for-byte copy
verification. After the artifact commit, `--artifact-commit` requires a descendant whose canonical-artifact delta
is exactly the files whose staged bytes differ from the source snapshot; only `gallery/model.json` and
`gallery/index.html` may additionally differ. Deterministically identical SVG or PNG bytes need not appear in the
Git delta. The package runtime and contact sheet may not move.
The command only inspects. Generation, copy, commit and tag operations remain separate approved steps.

**Post-publish re-read (M5).** A read issued immediately after a publish can
come back from a replica that has not caught up, listing releases without the
one just created. The wrapper retries **only** that case, identified by an
observation that contradicts itself: `Latest` names the requested tag, yet
that tag is absent from the release list. A list cannot omit the release
`Latest` points at, so the list is simply not visible yet.

This covers both promotion verdicts. Which one a stale list produces depends
only on whether any successor release is visible, so the very first ordinary
release after the cutover reports the same staleness as `CV-LATEST-INITIAL`
rather than `CV-LATEST-STEADY`. A list that is still missing baseline Releases
never reaches either check — it is judged earlier — so the retry does not apply
during a cutover.

Everything else keeps its red. A *real* misplacement looks different — `Latest`
is present in the list but is not the expected one — and so do a missing
Release, an unnormalizable release object (`CV-DOMAIN`, including a published
release whose `published_at` is null or empty), and any transport failure.

The retry is bounded three ways: at most **3** re-reads, backing off
**1s / 2s / 4s**, inside a **10s** wall-clock cap measured from the first stale
read. The cap is handed to the transport as a deadline and re-checked before
every page of the paged releases call, so a single in-flight request cannot
outlive it either — a per-request timeout alone would bound one page, not the
loop. The wrapper reports how the re-read ended, together with the first stale
verdict, and anything other than `resolved` returns that original verdict
unchanged.

| End reason | Meaning |
| --- | --- |
| `resolved` | a re-read no longer contradicted itself; the verdict was recomputed |
| `retry-exhausted` | all three re-reads still showed the stale observation |
| `total-cap` | the wall-clock cap was reached, or the transport refused a request because the deadline had passed |
| `observation-failed` | a re-read failed for a reason unrelated to the deadline (for example the CLI itself erred) |

The last two are separate on purpose: reporting a transport error as a timeout
would state something the run did not observe.

## CI workflows

| File | Triggers | Purpose |
| --- | --- | --- |
| `validate.yml` | PR, push to `main`, tag create/delete | event-driven M1+M3+M4 (tag events run M3+M4 against an explicit `main` checkout) |
| `validate-periodic.yml` | daily schedule (`17 3 * * *` UTC), manual dispatch | periodic fallback for state changes that fire no event (e.g. a tag repointed outside a push) |
| `release.yml` | manual dispatch only | M5 wrapper entry; dry-run by default; checkout pinned to `main` so a dispatch can never run an unreviewed wrapper or request under the write token |

The two validation workflows are separate files so that disabling either —
including GitHub's automatic disable of scheduled workflows after 60 days of
repository inactivity — never silences the other. Nominal maximum detection
latency for event-less mutations is one schedule period (~24h) plus
scheduler delay. If the scheduled workflow is auto-disabled, re-enable it
from the Actions tab (or run it once via manual dispatch) after the next
activity.

All jobs check out with full history and tags (`fetch-depth: 0`) — the
first-parent derivations below require it.

## Release plan (M2 input)

```json
{
  "target_commit": "<sha or ref on main>",
  "releases": [
    {"skill": "<name>", "previous_ref": "<name>/vX.Y.Z or null",
     "proposed_version": "X.Y.Z", "proposed_ref": "refs/tags/<name>/vX.Y.Z"}
  ]
}
```

The preflight is green only when the set of skills whose **payload** changed
since their previous release equals the plan's set exactly — a changed skill
missing from the plan is an I-3 finding, an unchanged skill in the plan is an
I-4 finding. Payload excludes exactly two bookkeeping artifacts: the
`metadata.version` scalar and `CHANGELOG.md` (see `VERSIONING.md`).

Additional checks: the target commit must satisfy the full M1 validation and
sit on `main` first-parent history; the bump step must match the path-default
step unless the major-transition branch applies; a single-step major
transition requires the exact tracked approval record below; an inventory
reduction requires the exact retirement record and full-removal predicate
below; a new skill's initial release must introduce the package and both
catalog rows in the target commit itself; no existing tag may share the
proposed version's SemVer precedence (including `+build` aliases).

The one-time baseline branch activates only when the target carries the
canonical prepared cutover record. The plan must equal the record's four
`baseline_tags` entries in order; every entry must use `previous_ref: null`
and version `0.8.0`; and the target must be the first `main` first-parent
commit that introduced the current attempt. T1 and T2 still require attempt
`1` first and increments of exactly one. The ordinary I-3/I-4/I-6 and
new-skill `0.1.0`/same-commit rules do not apply to this baseline, but
package/catalog checks, tag grammar and uniqueness, `main` ancestry, exact
four-ref atomicity, and I-10 remain active. Baseline I-10 compares the target
inventory with `baseline_finalization_sha:skills`; any decrease is a finding.

## Tracked transition evidence

Both evidence types are strict JSON objects. Unknown or duplicate keys, wrong
types, path/content identity mismatches, malformed dates, and unobservable
state fail closed. `authorization_id` must match
`owner-YYYYMMDD-<16 lowercase hex>` and its date must equal `approved_at`.
The identifier is an allowlisted repository-local handle, not cryptographic
proof of the approving person. Identity authority remains the owner-controlled
review and merge boundary.

Free-text `reason` must be non-empty and neutral. It must not contain private
tracker identifiers, local absolute paths, or repository/external URLs. The
validator applies those bounded hygiene patterns; owner review of the exact
record and diff remains authoritative for other sensitive or identifying
content.

### Retirement record

Path: `.skillstead/retirements/<skill>.json`

```json
{
  "schema_version": 1,
  "skill": "<skill>",
  "last_release_ref": "<skill>/vX.Y.Z or null",
  "authorization_id": "owner-YYYYMMDD-<16 lowercase hex>",
  "approved_at": "YYYY-MM-DD",
  "reason": "<neutral public-safe explanation>",
  "replacement": null
}
```

The package, both active catalog rows, and both INSTALL pins must disappear in
the same target tree. `README.md` must carry a `## Retired skills` table and
`README.ko.md` a `## 은퇴한 스킬` table, with localized three-column headers.
Both tables must add this exact material row:

```text
| `<skill>` | `<last_release_ref or unreleased>` | [record](./.skillstead/retirements/<skill>.json) |
```

`last_release_ref` must equal the latest observable namespaced release. It must
be `null` only when no such release exists; a string in the no-release case and
`null` in the released case both fail closed.

M2 compares the target inventory with the union of the latest observable
release commit and the target's immediate parent. The parent comparison covers
a never-released package introduced after the latest release and removed by
this target; it must use `last_release_ref: null`.

The record must first appear in the same `main` first-parent commit that removes
the package, both active catalog rows, and both INSTALL pins and adds both
retired-table rows. Never merge the record first. A split merge permanently
records an active package coexisting with its retirement record, so every later
M3 run remains red; deleting or rewriting the record cannot repair that
history.

M3 reads the complete `main` first-parent history. Once a valid retirement
record appears, its fixed path and semantic value must remain present. Deletion,
rename, mutation, delete-and-restore, and reactivation of the retired identity
are findings. Because M3 is a continuous release-operation gate, a violation
already merged into an environment without required checks becomes red after
merge; this document does not claim the validator prevents every merge.
Recovery from a false positive or contract defect requires an owner-approved
contract amendment. Direct record repair or history editing is unsupported.

V1 supports identity changes only before publication. A post-publication name
change is not an in-place rename: handle the old identity as retirement and
introduce the new identity as a separately approved skill.

### Major-transition approval record

Path: `.skillstead/major-approvals/<skill>-v<proposed_version>.json`

```json
{
  "schema_version": 1,
  "skill": "<skill>",
  "previous_ref": "<skill>/vX.Y.Z",
  "proposed_version": "X.Y.Z",
  "authorization_id": "owner-YYYYMMDD-<16 lowercase hex>",
  "approved_at": "YYYY-MM-DD",
  "reason": "<neutral public-safe explanation>"
}
```

The record applies only when the proposal is a single-step major transition.
Its path, `skill`, `previous_ref`, and `proposed_version` bind it to that
transition. The payload is still authorized by exact pull-request review and
merge; the record does not approve arbitrary content. Any intervening release
changes the latest observable `previous_ref` and invalidates the record
fail-closed.

Unlike retirement records, major-approval records are not first-parent
persistence authorities in v1. The immutable version tag target preserves the
accepted transition evidence, tag precedence prevents version reuse, and M3
blocks tag deletion or retargeting. This lifecycle asymmetry is intentional:
retirement records continue to authorize absence from the current inventory,
while major-approval records authorize one completed transition.

### Template identity and validator rotation

`templates/skill-package/` is disposable scaffolding. `sample-skill` is a
reserved identity, and M1 rejects it under active `skills/`; replace every
identity surface before validating the materialized package. The template
contains no second package validator.

When a change rotates an INSTALL pin, lifecycle-state syntax, or another
production validator contract, update the production validator and its
real-repository fixture in the same pull request. This keeps documentation,
the executable gate, and the consumer-shaped example on one revision.

**Bump-Adjustment marker.** When the proposed step differs from the
path-default step, the release's CHANGELOG entry must contain a standalone,
non-empty reason line:

```text
Bump-Adjustment: <why the default step was overridden>
```

An empty marker, a marker inside another entry, or a marker embedded in a
longer line does not count.

## Continuous tag checks (M3)

For every `<name>/vX.Y.Z` tag, on every run:

* **Grammar** — `<name>/vMAJOR.MINOR.PATCH` only; no pre-release or build
  suffixes.
* **I-2** — the peeled target commit declares exactly the tag's version.
* **I-8** — the peeled target is a commit on `main`.
* **I-5** — at every observed release commit, every skill whose version
  changed there still has its tag (existence only; target correctness is the
  next check's job). After the cutover record exists, the expected tag set
  is also derived independently from `main` first-parent version changes, so
  deleting *all* tags of a release is still detected.
* **Release grace window (event runs only)** — the release protocol creates
  the tag only after the version-bump commit has merged, so the push/PR run
  that fires between merge and tag creation observes a structurally missing
  tag. That job alone passes `--release-grace-minutes 1440`: a missing tag
  whose version-change commit is younger than the window is reported as a
  visible `I-5-PENDING` notice with exit 0 instead of a red run. Everything
  else stays fail-closed red — older changes, unobservable timestamps, and
  every run without the flag (the release gate, the cutover evaluator, tag
  create/delete events, the periodic schedule, and branch create/delete
  events no longer run M3 at all since they say nothing about tag state).
  A genuinely deleted tag therefore still turns red at its delete event
  immediately, and a tag that is never created hardens to red at the next
  periodic run after the window expires.
* **Expected target** — derived without looking at the tag: for an ordinary
  tag, the oldest `main` first-parent commit where the skill's declared
  version changed to the tag's version; for the four baseline tags (exact
  ref membership in the cutover record, never version-string matching), the
  commit that introduced the record. A tag pointing anywhere else is a
  repoint finding.

Comparisons use peeled commit SHAs — annotated and lightweight tags mix in
this repository's history and tag-object SHAs would split them.

## Cutover verdict (M4)

The evaluator re-derives the cutover state from observation on every run;
no verdict is ever stored. Inputs: the combined `docs/INSTALL.md` and
`docs/INSTALL.ko.md` pin inventory, the cutover record at
`.skillstead/cutover-record.json`, the four baseline refs, the GitHub Releases
list (every page; a pagination shortfall or an untypeable release object is
`CV-DOMAIN`), the repository Latest, and `main` first-parent history.

The two INSTALL files are one normative observation surface. Their ordered
`(ref, copy_skill)` sequences and individual pin classes must be identical;
otherwise the combined class is `PIN-OTHER`. `Q-SAME` requires the record and
both files' actual `PIN-LEGACY → PIN-BASELINE` transitions in the same commit.
The public-breakage clock uses this combined history and starts at the most
recent departure from combined `PIN-LEGACY`. Older commits from before the
Korean mirror existed classify as `PIN-OTHER`, but they do not backdate the
clock past the later, observable cutover departure.

Verdicts: `not-started` · `pending-tags` · `tags-ok` · `complete` ·
`aborted` · `red` (with an error code). Failures carry
`candidate=`/`predicate=` detail.

| Code | Meaning | Way out |
| --- | --- | --- |
| CV-ORPHAN | pins/refs/releases moved without a record | revert, or create a proper cutover commit |
| CV-SCHEMA | record violates the schema (S1~S10) | replace the record (only while no baseline ref exists) |
| CV-ATTEMPT | attempt sequence invalid; **any attempt increase is `T3-unprovable`** — a prior attempt's ref absence cannot be machine-verified, so retries require the owner gate in cutover step ⓪ | owner procedure |
| CV-ABORT-TAGS / CV-ABORT-PIN | aborted record with refs present / non-legacy pins | owner judgment / revert pins |
| CV-PARTIAL-TAGS | 1–3 of the four baseline refs exist | complete the set — owner judgment first if an atomic failure left residue |
| CV-PIN | combined EN/KO pin inventory does not match the phase | fix both INSTALL files in one commit |
| CV-SAME / CV-BASE / CV-TREE | cutover commit did not switch both INSTALL inventories with the record / baseline SHA unreachable / `skills/` tree drifted | recreate the cutover commit (only while refs are 0) |
| CV-CLOCK | the public-breakage window (pins switched, tags not yet created) exceeded 1 hour | finish tag creation or revert |
| CV-TARGET / CV-FROZEN | baseline tag repointed / record touched (including deleted-and-restored) after refs exist | owner decision — tags are never deleted |
| CV-RELEASE | a published release violates P1 (no prereleases), P2 (title contains `<skill> X.Y.Z`), or P3 (exact Latest marker as the first body line), or a successor tag fails the tag gate | owner-approved metadata correction via the wrapper |
| CV-PREMATURE | an ordinary release went out before the cutover completed | owner accept-forward via the wrapper |
| CV-LATEST-INITIAL / CV-LATEST-STEADY | repository Latest is not the expected release | owner-approved Latest correction via the wrapper |
| CV-DOMAIN | the Releases observation could not be completed or normalized | re-run; fix the transport failure |
| CV-OBSERVE | a git observation failed (this code is tool-defined; the underlying decision record fixes the others) | re-run; fix the repository access |

P3's exact marker (fixed, English, byte-compared after trimming):

```text
> **Latest** refers to the most recently published individual skill release, not a catalog version.
```

### Abort, retry, and forward recovery

Before any baseline ref exists, an attempt may be aborted with one commit
that restores both INSTALL files to `PIN-LEGACY` and changes the record to
`phase: aborted`; `skills/**` remains unchanged. A retry uses a new cutover
commit and `attempt: N+1`. The tools enforce T1, T2, the aborted predecessor,
and the restored combined legacy pins. They cannot prove that a previous
attempt never created a now-deleted ref, so M4 remains fail-closed with
`CV-ATTEMPT` / `T3-unprovable` until the owner directly verifies and records
ref absence at cutover step ⓪. This procedural approval is not reported as a
machine proof.

After any baseline ref exists, the record, tags, and targets are immutable.
Recovery is forward-only: do not delete or retarget a tag and do not rewrite
the record. If `CV-PREMATURE` occurs:

1. Stop publishing additional releases.
2. Check the premature Release and tag with the ordinary gate and P1–P3.
3. If valid, obtain owner accept-forward approval; do not roll it back.
4. If only metadata is wrong, correct it through the wrapper after owner approval.
5. If the immutable target itself is wrong, stop and escalate to a separate remediation.
6. Without deleting or retargeting existing objects, publish every missing baseline Release.
7. Set **Latest** to the actual newest public Release and rerun M3, M4, and the wrapper postcondition.

## Release wrapper (M5)

Request file:

```json
{
  "action": "create-draft | publish | edit-metadata",
  "recovery_mode": "none | premature-accept-forward | metadata-correction",
  "tag": "<name>/vX.Y.Z",
  "title": "…",
  "body": "…",
  "draft": false,
  "prerelease": false,
  "latest_intent": true,
  "owner_authorization": null
}
```

`owner_authorization` is required for `edit-metadata` and for any
`recovery_mode` other than `none`. The wrapper: runs the evaluator; checks
the operation against the allowed matrix below (the judgment key is the
combination of verdict, error code, action, and recovery mode — recovery is
never a blanket bypass); verifies the tag exists, the metadata satisfies
P1~P3, and the whole tag surface passes M3 (any finding blocks the
mutation); executes only the permitted `gh release create`/`edit` with the
verified metadata applied exactly; re-runs the evaluator and, after a
publish, requires **Latest to equal the tag just published** — stronger than
the evaluator's steady-state check.

| Verdict | Allowed |
| --- | --- |
| not-started / aborted / pending-tags | nothing |
| tags-ok | create-draft/publish for a record-declared baseline ref whose release is missing |
| complete | create-draft/publish for a release that passes the normal gates |
| red / CV-RELEASE | owner-approved metadata correction of the offending release |
| red / CV-LATEST-* | owner-approved Latest correction of the expected release |
| red / CV-PREMATURE | owner accept-forward: missing baseline releases and Latest correction |
| red / anything else | nothing |

## Spec reference validator (skills-ref)

`tools/run_skills_ref.py` runs the agent-skills specification's reference
validator as a supplementary check, pinned to an exact upstream commit:

| Fact | Value |
| --- | --- |
| Source | `https://github.com/agentskills/agentskills` — `skills-ref/` subdirectory |
| Pin | commit `38a2ff82958afee88dadf4831509e6f7e9d8ef4e` (exact; upgrades are deliberate, reviewed pin changes) |
| Upstream license | Apache-2.0 |
| Constraint | upstream describes itself as a demonstration-only reference implementation, not for production |
| Checked by it | frontmatter required fields and name↔folder agreement |
| Not checked by it | licence pointer resolution, licence byte-equality, SemVer form, CHANGELOG agreement, catalog columns — all owned by `skillstead_validate` |

Replacement conditions — the pin is upgraded or the dependency dropped when
any of these holds: upstream declares production readiness or materially
changes the specification the pin no longer reflects; procurement through
the pin fails repeatedly; or `skillstead_validate` absorbs the spec-level
checks, making the reference run redundant. A failure to procure or run the
pinned validator fails the build (fail-closed).
