# docs-claim-check examples

**English** · [한국어](./README.ko.md)

Synthetic contract-testing material for [`docs-claim-check`](../../skills/docs-claim-check).
Everything here is invented — "AcmeTask" follows the Acme fictitious-product
convention and the manifest name is deliberately suffixed `-fixture`. No real
project, document, or repository is referenced.

| Path | What it is |
| --- | --- |
| `fixtures/sample-readme.md` | Synthetic README whose claims exercise every label |
| `fixtures/evidence/` | Matching evidence bundle: manifest, tag list, CI output |
| `fixtures/boundary-requests.md` | Three prompts the skill must refuse (execute / patch / code-review) |
| `fixtures/expected-outcomes.md` | Answer key — keep away from agents under evaluation |
| `example-output.md` | A complete, contract-conforming worked output |

The fixture matrix covers: all four labels (`verified`, `unsupported`,
`stale-suspected`, `needs-human`), all three `unsupported` reasons
(`missing-evidence`, `contradicted`, `insufficient-coverage`), composite-claim
splitting, and all three boundary refusals.
