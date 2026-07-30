# Versioning

*English (canonical) · [한국어](./VERSIONING.ko.md)*

Each skill in this catalog carries its own version. The catalog itself does not have one.

If you install a skill, the version you care about is the one declared in that skill's `SKILL.md`, and
the history you care about is that skill's own `CHANGELOG.md`. Releasing one skill does not renumber the
others — the only shared surface a release touches is that skill's row in the root README catalog table.

> **Using rather than maintaining Skillstead?** Choose the current pinned tag from the
> [installation guide](./INSTALL.md). The remaining sections explain the release contract for maintainers.

## Transition status

**Per-skill versioning is now the active release model.**

| | State |
| --- | --- |
| `metadata.version` in each `SKILL.md`, per-skill `CHANGELOG.md`, README `Version` column | **Active.** These surfaces carry each skill's version |
| Install pin | **Namespaced.** Use the selected skill's `<name>/vX.Y.Z` tag |
| `<name>/vX.Y.Z` tags and per-skill releases | **Active.** The four `0.8.0` baseline releases establish the starting point |
| Bump rules | **In force.** See [What a version change means](#what-a-version-change-means) |

The one-time cutover preserved the package bytes and catalog `Version` values while establishing four
namespaced baseline tags. Later releases change and publish only the affected skill.

## Where the version lives

| Surface | Role |
| --- | --- |
| `skills/<name>/SKILL.md` → `metadata.version` | The declared version of the installed package |
| `skills/<name>/CHANGELOG.md` | That skill's own history |
| Root `README.md` / `README.ko.md` catalog table, `Version` column | The published current version of each skill |
| Git tag `<name>/vX.Y.Z` | The exact commit a version was released from |

The catalog table is the source of truth for "what is the current version of this skill". A release
updates the package and that table together, so the two never drift apart.

## Changelog heading grammar

This section is a **parser contract**. Automated checks read these headings, so the shape matters beyond
readability.

### Released entries

```
## [X.Y.Z] — YYYY-MM-DD
```

- Heading level is exactly `##`.
- The version sits in square brackets and has exactly three numeric components. No build metadata, no
  pre-release suffix — the same restriction the release tags carry.
- The separator is an em dash (`—`, U+2014), with one space on each side.
- The date is ISO-8601 (`YYYY-MM-DD`) and is the release date.
- Entries run newest first.

**One exception.** The `0.8.0` baseline entry in each skill carries the release date of catalog `v0.8.0`,
the history it continues from. Every entry after it carries its own per-skill release date. Checks read
the version, not the date, so this does not affect them.

### Unreleased work

An `## [Unreleased]` section is optional and, when present, sits above every released entry. It carries
no date. Versions are settled at the release gate rather than while work is in progress, so accumulating
notes under `[Unreleased]` is the expected way to stage them.

### How checks read the file

The **topmost released entry** is the first `##` heading, reading from the top, whose bracket contents
match `X.Y.Z`. An `[Unreleased]` heading is skipped rather than treated as a version.

That entry's version must equal `metadata.version` in the same package's `SKILL.md`. A mismatch means
either the release forgot to update one of the two files, or someone edited one by hand.

## What a version change means

**These rules apply to changes made after the baseline.** The cutover described under
[Transition status](#transition-status) was not itself a version bump; it established the starting point
without changing `skills/**`.

A release is justified by a change to the package's **payload** — everything under `skills/<name>/`
except the `metadata.version` value itself and this changelog. Those two are the bookkeeping a release
produces, not the reason for one, so changing only them does not make a release.

| Change | Step |
| --- | --- |
| Observable behaviour, contract, or output changes | minor |
| Everything else | patch |
| Promotion to `1.0.0` or above | major — requires explicit owner approval |

The executable major-transition evidence and binding contract is specified in
[`VALIDATION.md`](./VALIDATION.md#major-transition-approval-record).

When the nature of a change is unclear, the file's location decides: `SKILL.md` body, `references/`,
`scripts/` (excluding fixtures), and `agents/` default to minor; `README*.md`, `LICENSE*`, `assets/`,
and fixtures default to patch. A release may override the default in either direction, but the reason
has to be written into the changelog entry.

Changes outside `skills/<name>/` — the root README, `docs/`, `examples/` — do not version any skill.

## Baseline

All four skills start at `0.8.0`. That number is a transition point, not a claim about how much each
skill has changed. Before it, one shared catalog version covered every skill at once; the number was
carried over so the two histories line up rather than restarting from zero.

A skill added later starts at `0.1.0` instead, because that is a genuine first release.

Catalog tags `v0.1.0` through `v0.8.0` and their releases remain published and installable. They are not
moved, deleted, or reused.
