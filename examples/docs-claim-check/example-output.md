# Worked example — docs-claim-check on the synthetic AcmeTask fixture

The output below is a complete, contract-conforming run of `docs-claim-check` on
`fixtures/sample-readme.md` with the evidence bundle in `fixtures/evidence/`.
Everything is synthetic; AcmeTask follows the Acme fictitious-product convention and
is not a real product.

---

## Input Scope Reviewed

- Documents: `fixtures/sample-readme.md` (entire document), reviewed 2026-07-14
- Evidence reviewed:
  - `fixtures/evidence/package.json` — acmetask-fixture v2.4.1 manifest
  - `fixtures/evidence/LICENSE` — MIT license text
  - `fixtures/evidence/release-tags.txt` — tag list captured 2026-06-02
  - `fixtures/evidence/ci-test-output.txt` — CI test run captured 2026-05-28 (linux runner)
- Requested but missing: Windows/macOS CI output (C3), timestamped install log (C4a),
  network-isolation run log (C4b)
- Excluded: none
- Commands executed: none
- Coverage: 9 claims extracted / 9 assessed / 0 excluded

## Claim Assessments

| ID | Atomic claim + location | Evidence anchor | Label | Reason | Limitation / Evidence request |
| --- | --- | --- | --- | --- | --- |
| C1 | "fastest task runner in its class" (intro) | — | needs-human | — | comparative claim; needs benchmark data and human judgment |
| C2 | "Requires Node.js 18 or newer" (Requirements) | package.json `engines.node: >=18` | verified | — | valid for manifest v2.4.1 only |
| C3 | "Works on Windows, macOS, and Linux" (Requirements) | ci-test-output.txt (linux runner) | unsupported | insufficient-coverage | evidence covers Linux only; request: Windows/macOS CI output |
| C4a | "Installs in under a minute" (Install) | — | unsupported | missing-evidence | request: timestamped install log on a stated machine/network |
| C4b | "Runs fully offline after the first run" (Install) | — | unsupported | missing-evidence | request: run log with network disabled after first run |
| C5 | "Latest release: v2.3.0, November 2025" (Status) | release-tags.txt: v2.4.1 (2026-05-28) | stale-suspected | — | true at v2.3.0 (2025-11-20); newer tags exist |
| C6 | "Zero runtime dependencies" (Status) | package.json `dependencies` (2 entries) | unsupported | contradicted | commander, picocolors are runtime dependencies |
| C7 | "All commands are covered by integration tests" (Status) | ci-test-output.txt | unsupported | insufficient-coverage | tests shown cover run, list (of run/list/watch/init); coverage of watch, init not shown in evidence |
| C8 | "MIT licensed" (Status) | package.json `license: MIT` + LICENSE (MIT text) | verified | — | applies to the provided manifest + LICENSE pair |

## Boundary Notes

- Labels apply only to the documented input scope and reviewed evidence.
- No command was executed.
- No code-quality or security assessment was performed.
- No patch or replacement text was generated.
