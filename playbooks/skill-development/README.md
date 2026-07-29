# Skill Development Playbook

**English** · [한국어](./README.ko.md)

Use this playbook to design, validate, review, release, and—when necessary—retire a Skillstead skill. It is a
maintainer reference, not an installable skill. An installed package must remain complete without this directory.

## Start Here

1. Read the [package standard](./skill-package-standard.md).
2. Follow the [development procedure](./skill-development-procedure.md).
3. Copy the [skill-package template](./templates/skill-package/) into a disposable workspace, replace its
   reserved identity, and validate the materialized package.
4. Use the scenario, expected-outcome, validation-ledger, review-relay, and release-note templates as needed.
5. Keep project-specific decisions and raw review evidence in the target repository.

## Documents

| Path | Purpose |
| --- | --- |
| [`skill-package-standard.md`](./skill-package-standard.md) | Package, intent, naming, safety, evidence, bilingual, and review requirements |
| [`skill-development-procedure.md`](./skill-development-procedure.md) | Ordered path from intent brief through release or retirement |
| [`templates/skill-package/`](./templates/skill-package/) | Valid concrete starting package with a reserved identity |
| [`templates/scenarios.md`](./templates/scenarios.md) | Positive and negative scenario template |
| [`templates/expected-outcomes.md`](./templates/expected-outcomes.md) | Separate answer-key template |
| [`templates/validation-ledger.md`](./templates/validation-ledger.md) | Repeatable evidence and claim ledger |
| [`templates/cross-review-relay.md`](./templates/cross-review-relay.md) | Role-neutral independent-review packet and bounded-round record |
| [`templates/release-note.md`](./templates/release-note.md) | Per-skill release-note template |
| [`examples/standard-gap-mapping.md`](./examples/standard-gap-mapping.md) | Mapping of the current catalog to the standard |
| [`examples/disposable-sample-validation.md`](./examples/disposable-sample-validation.md) | Official-validator proof for the package template |

English is canonical. Korean mirrors carry the same material claims, conditions, risks, and actions in files with
the `.ko.md` suffix. Update both languages in the same pull request.

## Authority Boundary

This playbook owns the authoring standard. [`docs/VALIDATION.md`](../../docs/VALIDATION.md) owns executable
repository and release gates. A target repository's approval workflow owns who may approve changes. Review tools
may execute or persist the review, but they do not replace the role, evidence, and decision boundaries declared
for the work.

If prose and an executable gate conflict, stop. Do not weaken the gate in prose or silently reinterpret the
procedure; resolve the contract and update its documentation and fixtures together.
