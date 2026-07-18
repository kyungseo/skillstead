# GitHub Public Release Checklist

**English** · [한국어](./github-public-release-checklist.ko.md)

Use this checklist before taking a private repository public.

## 1. Scope And Ownership

- [ ] Confirm the repository owner and target repository.
- [ ] Confirm the default branch.
- [ ] Determine whether the repository uses a long-lived integration branch such as `develop`.
- [ ] Confirm the release path, for example `feature/* -> develop -> main`.
- [ ] Choose the first release tag or version after publication, for example `v1.0.0`.
- [ ] If the README, installation documentation, or package metadata points to a specific tag or version, confirm
      that the tag exists before changing visibility.
- [ ] Identify who may approve changes to visibility, settings, and branch protection.
- [ ] Create a Work item for the audit trail in the target repository, or reuse an existing one.

## 2. Pre-Public Clean Baseline

- [ ] The release branch working tree is clean.
- [ ] The target repository's status dashboard has no Active Work.
- [ ] The live Work directory has no archive-pending Done Work.
- [ ] Archived Work files use `status: Archived`.
- [ ] Public-facing status files contain no internal next actions.
- [ ] Backlog entries are safe for public disclosure and contain no secrets.
- [ ] The README is current.
- [ ] USER-MANUAL, SYSTEM-MANUAL, and examples are current when present.
- [ ] A LICENSE file exists and contains the intended license.
- [ ] CONTRIBUTING exists, or its omission is an explicit decision.

## 3. Sensitive Information

Run `sensitive-info-sweep.md` as part of this review.

Minimum bar:

- [ ] Tracked files contain no secrets, credentials, or tokens.
- [ ] Private endpoints and internal account identifiers are not exposed unintentionally.
- [ ] Public documentation contains no unnecessary personal local paths.
- [ ] Generated artifacts are safe to publish.
- [ ] Commit-history risk has been reviewed.

## 4. Dependency And Security Gate

- [ ] The package-manager audit has no unresolved critical findings.
- [ ] GitHub Dependabot alerts have been reviewed.
- [ ] The lockfile is current.
- [ ] Documentation reflects any runtime baseline change required by a security fix.
- [ ] Accepted risk is recorded in the target repository.

## 5. GitHub Settings Before The Visibility Change

- [ ] The repository description is accurate.
- [ ] Topics are appropriate.
- [ ] The description explains concrete user value and outputs rather than internal terminology.
- [ ] Topics balance language, domain, key technology, and user task.
- [ ] The About URL is set only when it is stable and useful.
- [ ] The default branch is correct.
- [ ] Issues are enabled when public feedback is planned.
- [ ] Discussions are enabled when a lightweight question or feedback channel would help.
- [ ] Wiki, Projects, and Pages are configured as intended.
- [ ] Merge methods match the repository workflow.
- [ ] `delete_branch_on_merge` is set intentionally.

Important: if a long-lived branch such as `develop` may be used as a pull-request head,
`delete_branch_on_merge=true` can delete it after a release pull request is merged. Keep automatic deletion off
until branch deletion protection is verified, or delete feature branches explicitly instead.

## 6. Public Positioning

- [ ] A one-sentence project description is ready.
- [ ] Three to five core keywords or topics are ready.
- [ ] The top of the README supports the same message.
- [ ] Public limitations are stated honestly when needed.
- [ ] A social release note draft exists if the repository will be announced.

Use `social-release-note-template.md` for the announcement draft.

## 7. Visibility Change

- [ ] Confirm the clean baseline one final time.
- [ ] Confirm that no open security alert should block publication.
- [ ] If public README or installation documentation uses a pinned tag, confirm that the tag has been pushed and
      can be checked out.
- [ ] Change visibility to public.
- [ ] Run `post-public-verification.md` immediately.

## 8. Post-Public Settings

- [ ] Branch protection or the applicable ruleset is active.
- [ ] Deletion of the `main` branch is blocked.
- [ ] Deletion of any integration branch is blocked.
- [ ] Non-fast-forward pushes to protected branches are blocked.
- [ ] Protected branches require pull requests.
- [ ] Required checks are configured when CI exists.
- [ ] An administrator bypass is available when the workflow needs an owner or administrator bypass.
- [ ] **Release tag ruleset applicability has been determined.** A repository that releases from version tags is
      in scope. Only a repository that releases without tags may record the ruleset as not applicable, with
      evidence. If an applicable ruleset is missing, classify severity: `Blocked` when a release-critical consumer
      path depends on immutable tags—pinned installation, tag-pinned clone, dependency, or CI—and otherwise
      `Needs attention`, with accepted risk and a revisit trigger. See `repo-settings-template.md` and, for later
      releases, `recurring-release-protection-checkpoint.md`.
- [ ] Vulnerability alerts are enabled.
- [ ] Secret scanning is enabled when available.
- [ ] Secret scanning push protection is enabled when available.
- [ ] Dependabot automated security updates are configured as intended.
- [ ] A decision has been made about pinning the repository to the maintainer's profile.

If rulesets or branch protection will not be applied immediately, do not report a pass. Record accepted risk and
a trigger to revisit the decision before the next release. Examples include a solo maintainer, an initial
`main`-only repository, or a repository without CI.

## 9. Post-Public Verification

- [ ] A public clone succeeds.
- [ ] Installation succeeds in a clean environment.
- [ ] The primary validation command passes.
- [ ] The test command passes.
- [ ] The README quick start is accurate.
- [ ] Public examples are accessible.
- [ ] GitHub security alerts are clear or intentionally documented.

## 10. Prepare The Release Title And Notes

Prepare the title and notes before publishing a GitHub Release. Do not paste the entire commit history. Explain
what changed for users and why it matters.

### Title Conventions

| Release type | Recommended format | Example |
| --- | --- | --- |
| First public release | `vX.0.0` or `vX.0.0 — <one-line summary>` | `v1.0.0 — First Public Release` |
| Minor release | `vX.Y.0` or `vX.Y.0 — <one-line primary change>` | `v1.2.0 — Improved Blueprint Validation` |
| Patch release | `vX.Y.Z`; keep the title short and put details in the notes | `v1.0.1` |
| Release with breaking changes | Call out the break in the title | `v2.0.0 — Breaking: Schema Restructure` |

### Notes Principles

- Use GitHub's **Generate release notes** feature only as a starting point; do not publish the generated text
  without review.
- Do not paste commit messages verbatim. Rewrite changes around their effect on users.
- Use technical terms only when necessary and add a brief explanation when helpful.
- Put breaking changes at the top where readers will see them.
- Do not mention unfinished capabilities or use inflated language.

Recommended sections—include only the ones that apply:

```markdown
## Breaking Changes
Include this section first when the release breaks compatibility. Explain what changed and what users must do.

## What's New
Describe features and improvements from the user's perspective. Lead with what users can now do, not the
implementation details.

## Bug Fixes
Describe corrected problems in terms users will recognize. This section is especially useful for patch releases.

## Migration Guide
Include this section for breaking changes. Give step-by-step upgrade and code or configuration changes.

## Known Issues
Include this section when relevant. State known limitations and whether a later release is expected to address
them.

**Full Changelog:** https://github.com/OWNER/REPO/compare/vX.Y.Z...vA.B.C
```

### First Release (`v1.0.0`) Checklist

- [ ] The title format is chosen.
- [ ] One or two sentences explain what the project does.
- [ ] The notes contain a What's New section or another clear introduction to the first public release.
- [ ] Installation instructions or a Quick Start link is included.
- [ ] Known limitations are stated honestly.
- [ ] The notes identify this as the initial release or include a Full Changelog link.

### Minor And Patch Release Checklist

- [ ] The title format is chosen.
- [ ] Breaking changes appear at the top.
- [ ] A migration guide is present when the release breaks compatibility.
- [ ] Changes are organized by user impact rather than copied from the commit log.
- [ ] Known issues are stated when relevant.
- [ ] A Full Changelog link is included.
- [ ] The comparison link points to the correct previous and current versions.

### Other Considerations

- [ ] Decide whether to use a pre-release tag such as alpha, beta, or rc. If so, mark the GitHub Release as a
      **Pre-release**.
- [ ] Confirm whether this release should be marked **Latest**.
- [ ] Choose a reasonable release time; avoid Friday afternoon or the start of a holiday.
- [ ] Attach a screenshot or demo GIF when it would help.
- [ ] If the project maintains CHANGELOG.md, add the release entry.

## 11. Public Announcement

- [ ] Publish the GitHub Release using the title and notes prepared in §10.
- [ ] Review the announcement draft.
- [ ] Confirm that links point to the public repository.
- [ ] Attach a screenshot, gallery, or demo asset when visuals matter to the project.
- [ ] Keep claims accurate and free of exaggeration.
- [ ] State known limitations honestly when relevant.
- [ ] Choose the publication channel and timing.

## 12. Rollback And Incident Notes

- [ ] Know how to make the repository private again.
- [ ] Rotate or revoke any exposed secret. Making the repository private again is not sufficient.
- [ ] Determine whether sensitive information in history requires a history rewrite.
- [ ] Record an incident note in the target repository or a private incident log.
