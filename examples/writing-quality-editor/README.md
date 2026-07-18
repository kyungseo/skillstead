# writing-quality-editor examples

**English** · [한국어](./README.ko.md)

Synthetic contract-testing material for
[`writing-quality-editor`](../../skills/writing-quality-editor). Every product, command, code, version, and metric
is invented for this fixture set.

| Path | Purpose |
| --- | --- |
| `fixtures/scenarios.md` | Twenty-one prompts and source materials covering Compose, Assess, Revise, and Adapt |
| `fixtures/expected-outcomes.md` | Answer key and invariant checklist; keep away from agents under evaluation |
| `fixtures/validation-evidence.md` | Static gate, fresh-context execution ledger, stop rule, and claim boundary |
| `release-claim-audit-v0.7.0-prepublish-20260718.md` | Pre-release assessment of thirteen release-critical public claims and the one pinned-tag item that remains open until publication |
| `release-claim-audit-v0.7.0-postpublish-20260718.md` | Post-release closeout for the pinned-tag install claim and Claude Code/Codex runtime-support wording |

The matrix covers all seven defined document profiles, same-language editing, both EN→KO and KO→EN adaptation,
meaning drift, over-editing, `needs-human`, protected identifiers, plain-language rewriting, AI-style pattern
cleanup without detector gaming, and refusal to rewrite already-natural text.

Run each scenario in a fresh context with only the installed skill and the selected scenario. Compare material
behavior with the answer key; wording and formatting do not need to match.

F19 and F20 use a bounded research budget recorded in the scenario. They test evidence handling, not exhaustive
research depth; the budget does not limit real user work.
