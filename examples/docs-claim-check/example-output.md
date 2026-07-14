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
- Requested but missing: Windows/macOS CI output (C4), npm registry/install output
  (C5), timestamped install log (C6), network-isolation run log (C7)
- Excluded: leading synthetic-fixture disclaimer blockquote — meta notice, not a
  product claim
- Commands executed for claim verification: none
- Coverage: 14 claims extracted / 13 assessed / 1 excluded

## Claim Assessments

| ID | Atomic claim + location | Evidence anchor | Label | Reason | Limitation / Evidence request |
| --- | --- | --- | --- | --- | --- |
| C1 | "fastest task runner in its class" (intro) | — | needs-human | — | comparative claim; needs benchmark data and human judgment |
| C2 | "Requires Node.js 18 or newer" (Requirements) | package.json `engines.node: >=18` | verified | — | valid for manifest v2.4.1 only |
| C3 | "Works on Linux" (Requirements, split) | ci-test-output.txt (linux runner, suite passed) | verified | — | valid for that CI run's scope; not a full functional guarantee |
| C4 | "Works on Windows" / "Works on macOS" (Requirements, batch — 2 components) | — | unsupported | missing-evidence | request: CI output on Windows and macOS |
| C5 | "`npm install -g acmetask-fixture` installs it" (Install) | package.json name (match only) | unsupported | missing-evidence | name match does not prove registry publication; request: `npm view acmetask-fixture version` or install output |
| C6 | "Installs in under a minute" (Install, split) | — | unsupported | missing-evidence | request: timestamped install log on a stated machine/network |
| C7 | "Runs fully offline after the first run" (Install, split) | — | unsupported | missing-evidence | request: run log with network disabled after first run |
| C8 | "Latest release: v2.3.0" (Status) | release-tags.txt: v2.4.0, v2.4.1 exist | stale-suspected | — | true at v2.3.0 (2025-11-20); newer tags exist (capture 2026-06-02) |
| C9 | "v2.3.0 released November 2025" (Status, split) | release-tags.txt: v2.3.0 2025-11-20 | verified | — | tag-date basis |
| C10 | "Zero runtime dependencies" (Status) | package.json `dependencies` (2 entries) | unsupported | contradicted | commander, picocolors are runtime dependencies |
| C11 | "All commands are covered by integration tests" (Status) | ci-test-output.txt | unsupported | insufficient-coverage | exhaustive test-file inventory but no file→command mapping; coverage of watch, init unknown |
| C12 | "MIT licensed" (Status) | package.json `license: MIT` + LICENSE (MIT text) | verified | — | applies to the provided manifest + LICENSE pair |

## Boundary Notes

- Labels apply only to the documented input scope and reviewed evidence.
- No command was executed for claim verification.
- No code-quality or security assessment was performed.
- No patch or replacement text was generated.
