# writing-quality-editor examples

**English** · [한국어](./README.ko.md)

Synthetic contract-testing material for
[`writing-quality-editor`](../../skills/writing-quality-editor). Scenario products, commands, and facts are synthetic;
versions, models, and measurements in validation records describe the recorded runs.

| Path | Purpose |
| --- | --- |
| `fixtures/scenarios.md` | Thirty-nine scenario groups covering Compose, Assess, Revise, and Adapt; F37–F39 contain six context variants |
| `fixtures/expected-outcomes.md` | Answer key and invariant checklist; keep away from agents under evaluation |
| `fixtures/validation-evidence.md` | Static gate, fresh-context execution ledger, stop rule, and claim boundary |
| `release-claim-audit-v0.7.0-prepublish-20260718.md` | Pre-release assessment of thirteen release-critical public claims and the one pinned-tag item that remains open until publication |
| `release-claim-audit-v0.7.0-postpublish-20260718.md` | Post-release closeout for the pinned-tag install claim and Claude Code/Codex runtime-support wording |

The matrix covers all seven defined document profiles, same-language editing, both EN→KO and KO→EN adaptation,
meaning drift, over-editing, `needs-human`, protected identifiers, plain-language rewriting, AI-style pattern
cleanup without detector gaming, Korean local-naturalness repair, and refusal to rewrite already-natural text.
It also tests explanatory reader friction across document profiles against concise specialist no-edit controls.

Run each scenario in a fresh context with only the installed skill and the selected scenario. Compare material
behavior with the answer key; wording and formatting need not match unless the scenario requires exact preservation.
For F37–F39, follow the runner-only input isolation instructions and provide one context variant at a time.

F19 and F20 use a bounded research budget recorded in the scenario. They test evidence handling, not exhaustive
research depth; the budget does not limit real user work.

For results and limits of the Korean drafting path added in `0.14.0`, see the
[skill guide](../../skills/writing-quality-editor/README.md#korean-new-drafts). Historical results from F01–F36 do not substitute for validation of that new path.

`0.15.0` reader-flow guidance has additional [scenarios](./reader-flow/scenarios.md) and a separate
[answer key](./reader-flow/expected-outcomes.md). They are distinct from the historical 36-case set.

Read the [development observations and limits](./reader-flow/development-validation.md).

[Direct explanation examples and bounded observations](./direct-prose.md) cover recurring disclaimers,
necessary negative rules, already-clear prose, and a protected quotation.

[Context-sensitive Korean pairs F37–F39](./fixtures/scenarios.md#running-f37f39) use the same source in two
contexts to test repeated notifications, form names, and prior-support implications. Their
[bounded baseline observations](./fixtures/validation-evidence.md#f37f39-korean-context-pairs--2026-10-28)
reuse six first outputs from WQE 0.19.0 with its contracts supplied inline. They do not establish installed
skill discovery, general quality improvement, or additional runtime support.
