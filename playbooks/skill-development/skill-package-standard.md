# Skill Package Standard

**English** · [한국어](./skill-package-standard.ko.md)

This standard describes the minimum package and evidence contract for a Skillstead skill. Apply a rule only when
its stated condition holds; do not turn an observed pattern into a universal requirement.

## Package Boundary

An installable skill is the complete `skills/<name>/` folder. It must not depend on `playbooks/`, repository-only
examples, private notes, or files outside its package after installation.

Required:

- `SKILL.md` with lowercase-hyphen `name`, an accurate use/do-not-use description, a package-contained license
  pointer, and `metadata.version` in `MAJOR.MINOR.PATCH` form;
- `CHANGELOG.md` whose top released version equals `metadata.version`;
- a byte-identical copy of the root Apache-2.0 license;
- every required reference, script, asset, or agent file needed by the instructions.

Use a thin `SKILL.md` entrypoint. Move detailed material to `references/` only when that keeps the entrypoint
focused. If a reference is required for a safe or correct action, instruct the agent to load it and fail closed
when it cannot be read. Optional references may degrade explicitly.

## Intent And Safety

Before writing prose, record:

- the user outcome and named-skill examples;
- natural-language requests that should select the skill;
- similar requests that should not select it;
- ambiguous cases and their read-only or no-mutation default;
- mutations, approvals, destructive effects, and recovery;
- host-provided artifact workflows that take precedence.

The description must say what the skill does and does not do. A natural request must not silently widen mutation
authority. When the host owns an artifact workflow—such as document classification, repository state, or release
approval—follow that workflow before applying package-local writing or analysis guidance.

## Naming Lifecycle

1. Write the intent and trigger examples.
2. Choose a working name.
3. Compare candidates for action clarity, collisions, and the 64-character lowercase-hyphen limit.
4. Run trigger-overlap fixtures.
5. Verify folder, frontmatter, display text, README, install pins, indexes, and release identity as one map.
6. The owner retains or changes the canonical name before the first public catalog entry or release.
7. If it changes, close the pre-publication rename cascade in one approved change.

The template identity `sample-skill` is reserved. It must be replaced before materialization under `skills/`.
Post-publication in-place identity rename is unsupported in v1. If that need appears, treat the existing identity
as a retirement candidate and the new identity as a new skill in separately approved work.

Naming examples demonstrate the procedure; they do not decide another product's canonical name.

## Validation And Claims

Keep scenarios separate from expected outcomes. Include positive, negative, ambiguous, mutation, host-precedence,
and fresh-context cases when they apply. Record the exact package revision, runtime/capability surface, inputs,
outputs, findings, and residual risk.

Do not infer support from successful prose review or from the number of agents involved. Runtime, locale, and
maturity claims must be limited to observed evidence. Sanitize public evidence: use repository-relative paths and
remove usernames, local absolute paths, private tracker identifiers, model/session identity, and unrelated
comparison provenance.

English package guidance is canonical when both languages exist. Korean material must preserve claims,
conditions, risks, identifiers, links, limitations, approvals, and next actions; matching sentence counts are
not required.

## Independent Review

Use independent review when the change affects public behavior, approval or mutation boundaries, release or
retirement, multiple consumer surfaces, or has material reversal cost. Small mechanical changes do not require it
unless the target repository says otherwise.

Use role names rather than tool names:

- `driver`: owns the scope, evidence, change, and finding disposition;
- `reviewer`: challenges the premise, fixtures, hidden cost, and unsupported claims;
- `specialist`: reviews one bounded concern when needed;
- `arbiter`: decides unresolved policy, scope expansion, and final approval.

Persist the target revision, review scope, findings, driver response, residual risk, and arbiter decisions. The
driver marks each finding `accept`, `revise`, `defend`, or `needs-user`. Rechecks cover open named findings, not
the whole design again. Set a round bound or escalation rule before starting; reaching it without convergence is
an arbiter decision, not permission to continue indefinitely.

Multiple agents do not prove independence. Record whether the reviewer had fresh context, whether an answer key
was hidden, and whether agents owned separate artifacts or worked in isolated trees. A host review workflow or
review-recording tool may implement this contract; the package must not require one named product.

## Release, Retirement, And Change Control

Follow [`docs/VERSIONING.md`](../../docs/VERSIONING.md) and
[`docs/VALIDATION.md`](../../docs/VALIDATION.md). A major transition requires a target-bound tracked approval
record. That record approves the version transition, not the payload; payload approval remains with exact pull
request review and merge.

Removing an active skill requires a retirement record and the full removal predicate. A retirement record is
durable evidence and cannot be deleted, changed, or bypassed by silently re-adding the package. Historical prose
may remain as context, but it must not read as an active install or support claim.

If a release changes an INSTALL pin, validator lifecycle state, or supported syntax, update the production
validator and the related real-repository fixture in the same pull request.
