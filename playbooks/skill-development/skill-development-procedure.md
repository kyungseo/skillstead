# Skill Development Procedure

**English** · [한국어](./skill-development-procedure.ko.md)

This procedure turns an intent into a self-contained, evidence-backed skill without expanding user authority or
public support claims by accident.

## 1. Frame The Work

Record the target user outcome, non-goals, affected files, validation, risk, reversal cost, and approval owner.
Identify the host repository's artifact, state, release, and mutation workflows before applying package-local
guidance.

Choose a working name only after the intent is concrete. Do not create public catalog rows, install pins, or
release identity yet.

## 2. Build The Intent Contract

Write named, natural-language, negative, ambiguous, mutation, and host-precedence scenarios. Keep expected
outcomes in a separate answer key. State which inputs a fresh reviewer may see.

Confirm:

- what selects the skill and what does not;
- the read-only or no-mutation default;
- actions requiring explicit approval;
- safe failure and recovery;
- claims that require runtime or locale evidence.

## 3. Lock The Pre-Publication Identity

Compare working-name candidates for action clarity, collisions, folder/frontmatter consistency, and length.
Run trigger-overlap cases. The owner then retains or changes the canonical name before the first public catalog
entry or release.

If the name changes, update the folder, frontmatter, display text, README links, install commands, examples,
indexes, validation fixtures, and planned release identity in the same approved change. V1 does not support an
in-place rename after publication.

## 4. Materialize The Package

Copy `templates/skill-package/` into a disposable repository. Replace every `sample-skill` identity before moving
it under `skills/`; the production validator rejects that reserved name in active inventory.

Keep the package self-contained. Copy the repository's root license byte-for-byte. Add required references only
when the entrypoint would otherwise become hard to use. Do not add executable scripts unless the behavior needs
them and symlink invocation has positive and negative fixtures.

## 5. Compose User-Facing Guidance

Write from the intent and evidence ledger, not from a plausible generic story. State use and do-not-use cases,
approval and mutation boundaries, failure behavior, and host-workflow precedence. Do not promote runtime, locale,
or maturity beyond observed evidence.

Write English as canonical. Adapt the Korean mirror for Korean readers while preserving material meaning rather
than copying sentence structure.

## 6. Validate

At minimum:

1. run the official M1 repository validator on the materialized disposable repository;
2. run positive, negative, ambiguous, mutation, and host-precedence scenarios that apply;
3. verify package license containment and byte equality;
4. verify folder/frontmatter/catalog/install/release identity;
5. audit English/Korean claims, conditions, links, limitations, and next actions;
6. sanitize public evidence to repository-relative paths;
7. record raw results and residual risk in the validation ledger.

Do not implement a second package validator inside the template.

## 7. Review

Use `templates/cross-review-relay.md` when independent review is proportionate to the change. A repository's
existing review workflow or review-recording tool may execute the relay.

The reviewer attacks the contract and evidence, not only prose. The driver dispositions every finding. Recheck
only open named findings. An unresolved blocker, scope expansion, or exhausted round bound goes to the arbiter.
Approval of the review does not itself authorize commit, publication, tag changes, or release operations.

## 8. Integrate And Release

Update the root catalog and maintainer entrypoint only after the package, fixtures, and evidence agree. Follow
the per-skill versioning and release gates. If an INSTALL pin, validator lifecycle state, or supported syntax
changes, rotate the production validator and related real-repository fixture in the same pull request.

Prepare the release note before publishing. The versioned unit is one `skills/<name>/` package; a GitHub source
archive is a repository snapshot, not a standalone package artifact.

During the merge-to-tag window, do not suppress a temporary red result. Re-run only the documented bounded path
after the actual merge target and remote refs are observable. Unexpected codes or partial refs require an owner
decision.

The publish step itself needs no such judgement. The release wrapper already retries its own post-publish read
when — and only when — that observation contradicts itself, within a bounded budget it reports. A red the
wrapper returns has therefore already survived that retry, so read it as a real finding rather than a timing
artefact, and never repeat a publish to make one disappear.

## 9. Retire When Support Ends

Retirement applies to an active skill, not disposable pre-publication material.

1. Inventory the package, both active catalog rows, both INSTALL documents, references, and support claims.
2. Prepare `.skillstead/retirements/<skill>.json` with the strict schema in
   [`docs/VALIDATION.md`](../../docs/VALIDATION.md), the package/catalog/pin removals, and both retired-table rows
   as one merge candidate.
3. Ensure the record first appears in the same `main` first-parent merge commit as the full removal. Never merge
   the record alone: a record-first split merge creates a permanent M3 red history.
4. In a disposable repository based on current `main`, materialize the expected merge tree as one commit and run
   M1, an M2 preflight, M3 against that commit as `--main-ref`, links, and public-hygiene checks.
5. The owner reviews the exact record, expected merge commit, and full-removal diff before merge.

The tracked record remains unchanged. Re-adding the package under that identity is unsupported. A false positive
or contract defect requires an owner-approved contract amendment; editing history or repairing the record
directly is not a supported recovery path.
