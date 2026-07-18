# Playbooks

**English** · [한국어](./README.ko.md)

This directory contains reference playbooks for maintainers. They are not installable skills, and no skill depends
on these files at installation time.

| Playbook | Purpose |
| --- | --- |
| [`public-release/`](./public-release/README.md) | Generic checklists and templates for taking a private repository public and verifying it afterward |

## public-release Provenance

Six documents in `public-release/`—the README, checklist, sensitive-information sweep, repository settings
template, post-public verification, and social template—were consolidated from snapshot `5594aef` of the
independent private repository `kyungseo/public-release-playbook` on 2026-07-17. The Git history was not imported;
the consolidation used a public-safe snapshot, and the six files matched that source snapshot at the time of
import. `recurring-release-protection-checkpoint.md` was not part of the snapshot. It was added as the seventh
document in the first release-protection update after consolidation (2026-07-17). All
documents may now change through this repository's normal pull-request process and are covered by the
[Apache-2.0 license](../LICENSE).

These playbooks are the canonical source for generic release mechanics.
[`skills/github-release-guide`](../skills/github-release-guide) is an installable, self-contained mirror. If the
two copies conflict, follow the playbooks. English is the canonical language; Korean mirrors use the `.ko.md`
suffix and must carry the same semantic changes in the same pull request. If the English and Korean versions
conflict, follow the English version.
