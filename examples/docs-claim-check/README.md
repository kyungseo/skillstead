# docs-claim-check examples

**English** · [한국어](./README.ko.md)

Synthetic fixtures and a dated validation record for [`docs-claim-check`](../../skills/docs-claim-check).
The fixture inputs are invented — "AcmeTask" follows the Acme fictitious-product
convention and the manifest name is deliberately suffixed `-fixture`. The fixtures reference no real project, document, or repository.
The validation record separately identifies the use and limits of real public documentation.

| Path | What it is |
| --- | --- |
| `fixtures/sample-readme.md` | Synthetic README whose claims exercise every label |
| `fixtures/evidence/` | Matching evidence bundle: manifest, tag list, CI output |
| `fixtures/boundary-requests.md` | Three prompts the skill must refuse (execute / patch / code-review) |
| `fixtures/applicability-*.md`, `fixtures/applicability-evidence.txt` | Paired outcome, version/environment, conflict, publication, and embedded-instruction cases; keep the answer key separate |
| `fixtures/expected-outcomes.md` | Answer key — keep away from agents under evaluation |
| [`validation-evidence.md`](./validation-evidence.md) | Dated observations, corrections, and remaining limits for the unreleased candidate |
| `example-output.md` | A complete, contract-conforming worked output |

The fixture matrix covers: all four labels (`verified`, `unsupported`,
`stale-suspected`, `needs-human`), all three `unsupported` reasons
(`missing-evidence`, `contradicted`, `insufficient-coverage`), composite-claim
splitting, and all three boundary refusals.
