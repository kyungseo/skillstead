# GitHub Repository Settings Template

**English** · [한국어](./repo-settings-template.ko.md)

Use these settings as a baseline, then adapt them to the target repository.

## Basic

- Visibility: public only after confirming a clean baseline.
- Default branch: `main`.
- Description: short, accurate, and specific about what the project does; avoid inflated claims.
- Topics: balance language, domain, core technology, and user task.
- Homepage/About URL: set only when it is stable and useful.
- Issues: enable when public feedback is planned.
- Discussions: enable when a lightweight question or feedback channel would help.
- Wiki: disable unless it will be maintained.
- Projects: optional.

## Pull Requests

- Merge commits: enable when preserving feature history matters.
- Squash merge: optional.
- Rebase merge: optional; disable when the repository workflow advises against it.
- Auto-merge: optional.
- Allow update branch: enabled.
- Delete head branches automatically: use with care.

If a long-lived branch such as `develop` may be used as a pull-request head, verify its deletion protection before
enabling automatic branch deletion. Otherwise, merging a release pull request can delete the long-lived branch.

For an initial `main`-only repository, `delete_branch_on_merge=true` may be reasonable. Revisit this setting and
branch deletion protection together if long-lived branches are added later.

## Branch Protection And Rulesets

Recommended rules:

| Target | Rules |
| --- | --- |
| `main` | Block deletion and non-fast-forward pushes; require pull requests and, when CI exists, required checks |
| `develop` | Block deletion and non-fast-forward pushes; require pull requests |
| Release tags | Block updates and deletion of existing tags. Keep creation unrestricted so normal release tags can be created while published anchors remain immutable. Allow only a narrow administrative bypass. **Applicability:** repositories that release from version tags need this protection; only repositories that release without tags may mark it not applicable, with evidence. **Severity when absent:** `Blocked` if a release-critical consumer depends on immutable tags—pinned installation, tag-pinned clone, dependency, or CI—and otherwise `Needs attention` with explicit accepted risk and a revisit trigger. |

Derive the tag pattern from the repository's actual release convention. `v*` is only a candidate default. In
GitHub ruleset `fnmatch`, `*` does not cross `/`, so a monorepo namespace such as `pkg-a/v1.2.3` needs a separate
pattern. Before applying it, compare the pattern with the real tag list for both missed matches and overreach.

Recommended bypass:

- A solo-maintainer workflow must have an owner or administrator bypass available when emergency recovery or
  post-release branch synchronization requires it.
- Keep bypass access as narrow as possible. The default recommendation is an administrator-only bypass.
- Add ordinary contributors, GitHub Apps, or broad teams only when the need is clear.
- A push response that says `Bypassed rule violations` is immediate observed evidence. Use the rule suites API for
  a durable audit record. Some Insights views may be limited by the repository's GitHub plan, including Team or
  Enterprise availability.

### Migrate Legacy Branch Protection To Rulesets (Optional, Overlap First)

Rulesets and legacy branch protection can apply at the same time. Preserve that overlap during migration:

1. Activate the new ruleset first.
2. Verify that its effective rules and bypass behavior match the legacy protection with
   `gh api repos/OWNER/REPO/rules/branches/BRANCH`.
3. Treat removal of legacy protection as a separate decision and approval step.
4. Verify the effective rules again after removal. If verification fails, keep or restore the legacy protection.

Do not remove existing protection before proving equivalence.

## Security

- Vulnerability alerts: enabled.
- Dependabot security updates: manual or automated, according to project preference.
- Secret scanning: enabled when available.
- Secret scanning push protection: enabled when available.
- Private vulnerability reporting: enable when it would help a public repository.

## Verification Commands

```bash
gh repo view OWNER/REPO --json defaultBranchRef,deleteBranchOnMerge,hasDiscussionsEnabled,visibility
gh api repos/OWNER/REPO
gh api repos/OWNER/REPO/vulnerability-alerts -i
gh api repos/OWNER/REPO/rulesets
```

Plan constraints, verified 2026-07-17 and subject to GitHub policy changes: **GitHub Free and Free for
organizations support rulesets and protected branches for public repositories. Private repositories require
GitHub Pro, Team, or Enterprise.** Check visibility and plan before attempting configuration on a private
repository. Other security features may also depend on plan and visibility. If a setting is unavailable, record
the limitation and the date it was checked. Record any ruleset or protection that cannot be applied as accepted
risk with a revisit trigger in the post-public record.

## Description And Topics

Description checklist:

- [ ] State a concrete output or capability.
- [ ] Do not depend on an internal phase name or Work title.
- [ ] Avoid claims the README cannot support.
- [ ] Make the text fit naturally in GitHub's repository description field.

Topic checklist:

- [ ] Language, for example `typescript`, `python`, or `go`.
- [ ] Domain, for example `presentation`, `automation`, or `developer-tools`.
- [ ] Technology, for example `pptx`, `pptxgenjs`, or `cli`.
- [ ] User task, for example `deck-generation`, `public-release`, or `workflow`.
- [ ] Add an AI or tooling tag only when it accurately describes the project and improves discovery.

## Profile Pinning

- [ ] Decide whether to pin the repository to the maintainer's profile after publication.
- [ ] Confirm that its README, examples, release, and license are ready for it to represent the project.
- [ ] Confirm that the repository merits a limited pinned slot as a current focus or long-term representative project.
