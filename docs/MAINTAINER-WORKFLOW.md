# Skillstead Maintainer Workflow

English (canonical) · [한국어](./MAINTAINER-WORKFLOW.ko.md)

Last updated: 2026-09-12

This is the Skillstead-specific procedure for changes and version-release follow-up. It is the source of truth
for the reminders below; it does not add requirements to installed skills or generic public-release playbooks.
Read the current file at the start of a change and again before release closeout if the procedure has changed.

## 1. Establish Scope And Authority

Inspect the actual repository, branch, worktrees, and outstanding changes. Preserve unrelated work and use an
isolated branch appropriate to the task. Record the affected skills and distinguish an unreleased change,
a version-release preparation, and an already published release.

Identify existing authorization for edits, commits, pushes, merges, release operations, and external publication.
Do not ask again for the same authorized action and target. A review-only or documentation request does not
itself authorize publishing. Prepare concrete drafts and verification before asking for any missing authorization.

For a version-release plan, include the required Announcements post and the blog disposition from the outset,
so approval can cover those concrete follow-up actions. Do not repeatedly ask whether an announcement is wanted:
it is required for a published skill version. Honor any narrower instruction from the owner.

## 2. Align Documentation Before Commit And Release

Compare claims with the actual change, package inventory, and observed evidence. Check each applicable surface;
record a reason for surfaces that do not need an update.

| Surface | Required check |
| --- | --- |
| Root `CHANGELOG.md` | Review on every change. Add an entry for material skill, documentation, or maintainer-workflow changes. For every released skill version, include its name, version, and change summary; a per-skill changelog alone is insufficient. |
| `skills/<name>/SKILL.md`, references, scripts, assets | Behavior, constraints, required resources, and package completeness agree. |
| Per-skill `CHANGELOG.md` | Describe the change; keep unreleased work distinct from published versions. |
| Root and per-skill README files | Catalog rows, usage examples, limitations, support, and maturity match the evidence. |
| `docs/INSTALL.md`, version and validation documents | Pins and supported syntax match the actual release state; do not advertise an unpublished target as installable. |
| Examples, validation evidence, indexes, internal links | Update affected examples and links; preserve the distinction between synthetic, historical, and current evidence. |
| English and Korean mirrors | Align claims, numbers, versions, links, conditions, and required actions in the same change. |

Use root `CHANGELOG.md` (exact case). Put unreleased material under `Unreleased` and move it into the appropriate
published/date entry at release; do not describe a proposed change as already released. A truly non-material
change may leave it unchanged only with an explicit reason in the completion record.

Do not invent a version bump or duplicate its rules here. Follow [VERSIONING.md](./VERSIONING.md) for version
semantics and [VALIDATION.md](./VALIDATION.md) for executable release gates. Documentation inside a skill package
can be release payload; assess it under those rules rather than assuming documentation never needs a version.

## 3. Validate And Prepare The Release

Run the official M1 repository check (`PYTHONPATH=tools python3 -m skillstead_validate repo`) and
`git diff --check`; run additional checks for the changed behavior and the gates required by VALIDATION.md.
Inspect rendered Korean Markdown when emphasis changes. Record what passed, failed, or was not run; local checks
do not establish hosted CI, deployment, or new runtime support. Review public artifacts for private data and
unsupported claims before staging or publication.

Prepare release notes, the version announcement, the blog disposition/draft, and any chosen social draft before
requesting publication approval. Use the existing release toolchain and its required ordering; do not replace it
with ad hoc tag or Release commands. Verify the published version, tag target, release URL, and installation pin
before announcing availability. An internal version edit or merged PR is not yet a published release.

## 4. Publish The Required Version Announcement

Destination: [blog repository Announcements](https://github.com/kyungseo/kyungseo.github.io/discussions/categories/announcements).

Every published skill-version update, including a documentation-only patch release, requires an announcement in
this category. A batch post may cover multiple released skills if it names every skill/version and links each
release. Repository-only changes with no skill-version release do not trigger a mandatory announcement.

1. Search existing discussions for the skill/version before creating a post. Reuse or correct the matching post
   rather than duplicating it after an interrupted run. Resolve the destination category at execution time;
   do not keep a stale category ID in this procedure.
2. Prepare a title and body with the released skill/version, user-visible change, reason to update, relevant
   installation or migration guidance, limitations, and verified release/documentation links. Omit invented
   benchmarks, private review provenance, and unverified support claims.
3. Publish under the owner-approved publication scope. If the specific action is already authorized, proceed;
   otherwise present the ready draft and request only the missing authorization. If access or an instruction
   prevents publication, record the blocker and next action instead of silently skipping this required step.
4. Read the posted discussion back and record its URL and covered versions. A successful request without an
   observable matching post is not confirmed publication. Do not repeat a publish merely to obtain a green result.

## 5. Review Related Blog Posts

For each version release, find related posts in [the blog repository](https://github.com/kyungseo/kyungseo.github.io).
Read that repository's current agent instructions before editing it. Choose and record one outcome:

- Update an existing post when installation steps, examples, current limitations, or recommendations became stale.
- Propose a new post for a major workflow change, breaking change, or substantial new capability that needs a
  separate explanation. Prepare its outline or draft; publish only within authorized scope.
- Leave posts unchanged with a concrete reason, such as no related post or no effect on their claims.

Preserve historical observations and old test results as historical. Use a dated update note where useful rather
than rewriting an old experience as if it happened with the new version. Keep related language variants aligned
when they exist. Verify live links/content after an authorized publication and record the affected post URLs.
Blog publication is not automatically authorized by permission to publish a version announcement.

## 6. Prepare Social Copy Only When Useful

Social posting is optional and is performed by the user. Offer or prepare a concise ready-to-post draft when
relevant; the owner may decline, and a declined draft does not block completion. Respect an earlier decline
without repeatedly asking. If no platform is specified, one short adaptable draft is enough; do not create an
unrequested channel matrix. Use verified links and clearly identify an unreleased preview if that is the subject.

Never post through a social account on the basis of this procedure. Record `drafted`, `declined`, or
`not-applicable` with a brief reason; user posting is not an agent completion requirement.

## 7. Record Completion And Resume Safely

Use the existing change/release PR description or Work record as the completion record; link follow-up records
instead of inventing another tracking system. Record:

- affected skills, released versions when applicable, commits/PRs, and release URLs;
- documentation alignment, explicitly including root CHANGELOG status and any no-change reasons;
- validation results, evidence limits, and unresolved blockers;
- announcement status, covered versions, and the verified discussion URL;
- blog outcome and post/draft URLs or a no-change reason;
- social draft location or a declined/not-applicable reason;
- remaining action, owner, and next step for anything pending.

Use precise states such as `prepared`, `pending-authorization`, `blocked`, `published`, and `not-applicable`.
A change PR can finish before its later version release; mark communication work `pending-release` and carry its
pointer into the release record. For repository-only changes, mark release communications not applicable with a
reason. A published Release and completed release follow-up are different states: do not mark the latter complete
while its required version announcement is missing. Report partial success without rolling back or repeating
already successful release operations. The blog disposition must be recorded; social publication may be omitted.

## 8. Evolve This Procedure

Update this file and its Korean mirror in the same reviewed change. Record the reason and changed obligations
in root CHANGELOG, update the date, and adjust entry points or the PR checklist when their pointers or fields
change. Keep agent entry points and templates as small references, not competing copies of this procedure.
Keep versioning and executable gate definitions in their existing canonical documents.

New rules apply to subsequent work and still-open applicable steps. Do not silently republish historical releases
or backfill old announcements solely because this procedure changed; plan any historical backfill separately.
If the owner changes a requirement during work, record the changed scope and follow the latest instruction.
