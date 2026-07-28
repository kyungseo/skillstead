# Validation And Release Toolchain

[한국어](./VALIDATION.ko.md)

This document describes the repository's validation toolchain under
`tools/skillstead_validate/` and the release path it guards. The versioning
rules themselves live in [`VERSIONING.md`](./VERSIONING.md); this page covers
how they are checked and how a release is executed.

All judgment logic is Python 3.11+ standard library only and **fails
closed**: anything the tools cannot parse or observe is a finding or a red
verdict, never a silent pass.

## Modes

| Mode | What | When it runs | Command |
| --- | --- | --- | --- |
| M1 | Repository validation — package structure, `metadata.version` ↔ CHANGELOG (I-1), catalog `Version` columns (I-7), package completeness (I-9), licence copy byte-equality | every PR, push to `main`, daily schedule | `PYTHONPATH=tools python3 -m skillstead_validate repo` |
| M2 | Release preflight and tag creation — payload-diff release gate (I-3/I-4), bump-step check (I-6), inventory guard (I-10), major-bump guard, new-skill initial release, tag uniqueness | invoked for a proposed release; dry-runnable | `… preflight --plan PLAN.json` / `… apply-tags --plan PLAN.json` (publishes to the remote with `git push --atomic`; a push failure rolls local refs back) |
| M3 | Continuous tag checks — I-2, I-5, I-8 and the durable expected-target relation for every namespaced tag, on every run (tags are mutable; creation-time checks alone guarantee nothing) | every PR, push, tag create/delete, daily schedule | `… tags --main-ref origin/main` |
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
step; a major bump is rejected unconditionally until an owner-approval
evidence format exists; an inventory reduction without an approved retirement
marker is rejected unconditionally until the marker format exists; a new
skill's initial release must introduce the package and both catalog rows in
the target commit itself; no existing tag may share the proposed version's
SemVer precedence (including `+build` aliases).

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
no verdict is ever stored. Inputs: the INSTALL pin inventory, the cutover
record at `.skillstead/cutover-record.json`, the four baseline refs, the
GitHub Releases list (every page; a pagination shortfall or an untypeable
release object is `CV-DOMAIN`), the repository Latest, and `main`
first-parent history.

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
| CV-PIN | pin inventory does not match the phase | fix `docs/INSTALL.md` pins |
| CV-SAME / CV-BASE / CV-TREE | cutover commit did not switch the pins in the same commit / baseline SHA unreachable / `skills/` tree drifted | recreate the cutover commit (only while refs are 0) |
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
