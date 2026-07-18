# Post-Public Verification

**English** · [한국어](./post-public-verification.ko.md)

Run this procedure immediately after changing repository visibility to public.

## GitHub State

- [ ] Repository visibility is public.
- [ ] The default branch is correct.
- [ ] The description and topics are visible and accurate.
- [ ] Issues and Discussions are configured as intended.
- [ ] Branch protection or the applicable ruleset is active.
- [ ] The release tag ruleset is active when applicable, or the reason it is not applicable is recorded. Use
      `recurring-release-protection-checkpoint.md` for the decision criteria.
- [ ] If branch protection or rulesets are intentionally deferred, the reason and revisit trigger are recorded as
      accepted risk.
- [ ] Any workflow that needs an owner or administrator bypass can actually use it.
- [ ] Long-lived branches are protected against accidental deletion.
- [ ] Vulnerability alerts are enabled.
- [ ] Secret scanning is enabled when available.
- [ ] Secret scanning push protection is enabled when available.
- [ ] Open security alerts have been reviewed.

## Fresh Clone

Clone the public repository into a temporary directory and follow the README quick start.

```bash
tmpdir=$(mktemp -d)
git clone https://github.com/OWNER/REPO.git "$tmpdir/REPO"
cd "$tmpdir/REPO"
```

Then run the target repository's documented setup and verification commands.

## Public-Facing Content

- [ ] The README renders correctly on GitHub.
- [ ] Links work.
- [ ] Images and galleries render.
- [ ] Examples are accessible.
- [ ] The license is displayed correctly.
- [ ] Internal documentation is not overexposed on the public landing page.
- [ ] A decision has been made about pinning the repository to the maintainer's profile.

## Release Tag

After the final cleanup, choose the first public release version and create the tag and GitHub Release. Follow
§10 of `github-public-release-checklist.md` for the title and notes.

If the README, installation documentation, or package metadata points to a specific tag or version, prepare the
tag before changing visibility. The GitHub Release object may be published before or after the repository becomes
public, depending on the circumstances, but the pinned command that a user follows immediately afterward must
work.

- [ ] The release version is chosen, for example `v1.0.0`.
- [ ] The tag points to the public-ready commit on the default branch.
- [ ] The title and notes follow the §10 checklist.
- [ ] The GitHub Release is published.

## Security Follow-Up

- [ ] Dependabot alerts are clean or intentionally documented.
- [ ] Security features that became available after the visibility change are configured.
- [ ] Any alert that appears only after publication is triaged immediately.

## Record

Record the final result in the target repository:

- date visibility changed,
- settings verified,
- unavailable settings and the reasons,
- validation commands, and
- accepted risks.
