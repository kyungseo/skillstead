# Codex Post-R2 Fresh-Context Manifest — 2026-07-18

- Runtime: Codex
- Observed model and reasoning effort: unobserved
- Isolation: one no-history context per fixture
- Evaluator input: installed skill package and the complete scenario only
- Answer key: withheld from every evaluator
- Research: bounded live public-source retrieval for F19 and F20
- Result: 6/6 first-run pass
- Corrective reruns: 0
- Environment or delivery errors: 0

| Fixture | Result | Raw output |
| --- | --- | --- |
| F01 | Pass — inferred read-only `Assess` from an unnamed ambiguous review request | [F01-first-run.md](F01-first-run.md) |
| F02 | Pass — inferred `Revise` from the named skill without a mode | [F02-first-run.md](F02-first-run.md) |
| F12 | Pass — inferred unnamed `Revise` and returned the single-line source passed to the evaluator byte-identically | [F12-first-run.md](F12-first-run.md) |
| F19 | Pass — bounded research-backed AX brief preserved evidence classes and source scope | [F19-first-run.md](F19-first-run.md) |
| F20 | Pass — bounded decision comparison distinguished toolkit and architecture styles | [F20-first-run.md](F20-first-run.md) |
| F21 | Pass — deferred to the host-owned brief workflow without creating repository artifacts | [F21-first-run.md](F21-first-run.md) |

The driver compared these outputs with `expected-outcomes.md` only after all first runs completed.
