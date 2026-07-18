# Recurring Release Protection Checkpoint

**English** · [한국어](./recurring-release-protection-checkpoint.ko.md)

Use this standalone checkpoint to verify release protection before an already-public repository publishes a new
version. Checking only at the first-public milestone (§8) leaves later releases without a fresh protection review.
Run this checkpoint **before every version release**.

## Determine Applicability First

- [ ] Confirm the repository's release convention: does it release from version tags, and what tag namespace does
      it use? A monorepo may use a name such as `pkg-a/v1.2.3`. In ruleset `fnmatch`, `*` does not cross `/`, so
      that namespace needs a separate pattern.
- [ ] Identify release-critical consumer paths that depend on immutable tags: pinned installation, tag-pinned
      clones, dependency references, or CI checkout.
- [ ] If the repository releases without tags—for example, from branch snapshots—record the tag ruleset as
      **not-applicable** with the supporting reason, then check only the branch items. This is an evidence-based
      no-risk disposition, not risk acceptance.

## Checks

- [ ] The default branch ruleset or protection is active: deletion and non-fast-forward pushes are blocked, pull
      requests are required, and required checks are configured when CI exists.
- [ ] The release tag ruleset is active: updates and deletion of existing tags are blocked, tag creation remains
      allowed, and the administrative bypass is narrow. Follow `repo-settings-template.md`.
- [ ] The ruleset pattern matches the actual release tag namespace. Compare it with the tag list for both missed
      matches and overreach.
- [ ] Plan and permission constraints are known. As of 2026-07-17, rulesets and protected branches on private
      repositories require GitHub Pro, Team, or Enterprise. See `repo-settings-template.md`.

## Classify And Handle Gaps By Severity

- **Missing tag ruleset when a release-critical consumer path exists: Blocked.** Apply it before the release.
- **Any other gap: Needs attention.** Record explicit accepted risk and a trigger to revisit it before the next
  release.
- **The change was declined or cannot be made with current permissions:** keep the existing state and record the
  accepted risk and revisit trigger. The existence of a gap is not approval to change settings.
- **Not applicable:** record the evidence-based no-risk disposition separately from accepted risk.

## Verification Commands

```bash
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/rules/branches/BRANCH
git ls-remote --tags origin
```
