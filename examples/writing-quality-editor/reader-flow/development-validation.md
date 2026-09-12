# Reader-Flow Development Check — 2026-09-12

**English** · [한국어](./development-validation.ko.md)

The `0.15.0` candidate was compared with the published `0.14.1` instruction baseline in four paired
model-only tasks using Astra (`gpt-6-astra`, high reasoning effort). Each run received the applicable package
instructions inline in a fresh context. There was one response per arm per task, eight responses in total;
arm order alternated. The initial no-edit pair omitted the Korean editing reference; both arms were then rerun
with that reference included, for ten responses overall. The no-edit result remained exact source retention.
No tools were used by the executor. This did not test installed-skill discovery.

| Task | Observed result |
| --- | --- |
| Compose a bounded experience report | Both preserved supplied facts and limitations. The candidate grouped the background into fewer paragraphs; the difference was modest and not proof of better writing. |
| Assess average-to-all overgeneralization and repeated conclusions | Both identified the central evidence error. The candidate also noted the duplicated conclusion as minor reader friction; neither required an unsupported full rewrite. |
| Review an already adequate short instruction | Both returned the source unchanged. |
| Draft a requested story with missing facts | Both asked for missing material without inventing a failure, measurement, or lesson. |

The development prompts included private Korean working material. The adjacent reusable scenarios are separately
authored, transferable cases, not transcripts of these runs. Exact inputs, outputs, and execution receipts remain
in the private development record. The observations above are the developer's qualitative assessment, not a blind
review or a statistical benchmark.

The release decision carries the retained conditional guidance into `0.15.0`. Do not claim broad quality
improvement, faster execution, or stronger runtime support from this check. Maturity remains Beta; `0.14.1`
was the published version and installation pin when the comparison ran.
