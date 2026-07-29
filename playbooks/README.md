# Playbooks

**English** · [한국어](./README.ko.md)

This directory contains reference playbooks for maintainers. They are not installable skills, and no skill depends
on these files at installation time.

| Playbook | Purpose |
| --- | --- |
| [`public-release/`](./public-release/README.md) | Generic checklists and templates for taking a private repository public and verifying it afterward |
| [`skill-development/`](./skill-development/README.md) | Package, naming, validation, review, release, and retirement standard for developing skills |

## public-release History

The initial six `public-release/` documents were consolidated from an independently maintained, public-safe
snapshot on 2026-07-17 without importing its Git history. `recurring-release-protection-checkpoint.md` was added
later as the seventh document. The source identity and local revision are not part of the public operating
contract. All documents now change through this repository's normal pull-request process and are covered by the
[Apache-2.0 license](../LICENSE).

These playbooks are the canonical source for generic release mechanics.
[`skills/github-release-guide`](../skills/github-release-guide) is an installable, self-contained mirror. If the
two copies conflict, follow the playbooks. English is the canonical language; Korean mirrors use the `.ko.md`
suffix and must carry the same semantic changes in the same pull request. If the English and Korean versions
conflict, follow the English version.

`skill-development/` is the canonical maintainer reference for authoring and lifecycle rules. It does not make an
installed skill depend on the playbook.
