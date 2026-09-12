<!-- Follow docs/MAINTAINER-WORKFLOW.md. Keep this checklist a pointer, not a second procedure. -->

## Change

Describe the problem and resulting behavior.

## Validation

List executed checks and material limits.

## Completion Record

- [ ] Followed the current [maintainer workflow](https://github.com/kyungseo/skillstead/blob/main/docs/MAINTAINER-WORKFLOW.md).
- [ ] Checked root `CHANGELOG.md` and affected package/catalog/install/example documents, including language mirrors.
- [ ] Recorded validation and public-disclosure checks.
- [ ] For a skill-package change, checked both personal repositories and synchronized, verified, committed, and
      pushed each changed adopted copy, or recorded its `up-to-date`, `not-adopted`, or blocked state.

| Item | Status and evidence / reason / next action |
| --- | --- |
| Root CHANGELOG | Updated entry, or explicit no-change reason |
| Version release | Released version/URL, pending-release link, or not-applicable reason |
| Personal skill sync | Source commit/tag and each personal repository's destination commit/pushed ref, or `up-to-date`, `not-adopted`, or blocker/next action |
| Announcements | Verified discussion URL and covered versions, pending action, or not-applicable reason |
| Blog | Updated/new post or draft link, pending action, or no-change reason |
| Social draft (optional; user posts) | Draft link, declined, or not-applicable reason |

Do not mark a skill change complete while an applicable personal-repository sync is uncommitted or unpushed.
Do not mark release follow-up complete with a required announcement missing. Link the release record if this
change will ship later. Do not paste private execution records into a public PR.
