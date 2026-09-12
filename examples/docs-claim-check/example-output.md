# Worked example — docs-claim-check on the synthetic AcmeTask fixture

The output below is an authored illustration of the current unreleased contract on
`fixtures/sample-readme.md` with the evidence bundle in `fixtures/evidence/`.
Everything is synthetic; AcmeTask follows the Acme fictitious-product convention and
is not a real product.

---

## Input Scope Reviewed

- Documents: `fixtures/sample-readme.md` (entire document), illustration updated 2026-09-12 (not a model-run receipt)
- Evidence reviewed:
  - `fixtures/evidence/package.json` — acmetask-fixture v2.4.1 manifest
  - `fixtures/evidence/LICENSE` — MIT license text
  - `fixtures/evidence/release-tags.txt` — tag list captured 2026-06-02
  - `fixtures/evidence/ci-test-output.txt` — CI test run captured 2026-05-28 (linux runner)
- Requested but missing: Windows/macOS CI output (C4), installation output
  (C5), Linux functional smoke output (C3), timestamped install log (C6), network-isolation run log (C7), release publication record (C9), command-to-test mapping (C11)
- Excluded: leading synthetic-fixture disclaimer blockquote — meta notice, not a
  product claim
- Commands executed during the assessment: none
- Coverage: 14 claims extracted / 13 assessed / 1 excluded

## Claim Assessments

| ID | Atomic claim + location | Evidence anchor | Label | Reason | Limitation / Evidence request |
| --- | --- | --- | --- | --- | --- |
| C1 | "fastest task runner in its class" (intro) | — | needs-human | — | comparative claim; needs benchmark data and human judgment |
| C2 | "Requires Node.js 18 or newer" (Requirements) | package.json `engines.node: >=18` | verified | — | valid for manifest v2.4.1 only |
| C3 | "Works on Windows, macOS, and Linux." → Linux operation (Requirements, split) | ci-test-output.txt (linux runner, suite passed) | unsupported | insufficient-coverage | test execution is observed, product behavior is not; request a matching functional smoke transcript |
| C4 | "Works on Windows, macOS, and Linux." → Windows / macOS operation (Requirements, batch — 2 components) | — | unsupported | missing-evidence | request: matching product-behavior transcripts on Windows and macOS |
| C5 | `npm install -g acmetask-fixture` → installs the package (Install) | package.json name (partial anchor — name component only) | unsupported | insufficient-coverage | name match supports a necessary component but not the operational outcome; request: successful installation output for the named package and environment |
| C6 | "Installs in under a minute" (Install, split) | — | unsupported | missing-evidence | request: timestamped install log on a stated machine/network |
| C7 | "runs fully offline after the first run" (Install, split) | — | unsupported | missing-evidence | request: run log with network disabled after first run |
| C8 | "Latest release: v2.3.0" (Status) | release-tags.txt: v2.4.0, v2.4.1 exist | stale-suspected | — | newer tags exist (capture 2026-06-02); prior truth is not established |
| C9 | "Latest release: v2.3.0 (November 2025)" → published in November 2025 (Status, split) | release-tags.txt: v2.3.0 2025-11-20 | unsupported | insufficient-coverage | tag date does not establish release publication date; request publication record |
| C10 | "zero runtime dependencies" (Status) | package.json `dependencies` (2 entries) | unsupported | contradicted | commander, picocolors are runtime dependencies |
| C11 | "All commands are covered by integration tests" (Status) | ci-test-output.txt | unsupported | insufficient-coverage | exhaustive test-file inventory but no file→command mapping; coverage of watch, init unknown |
| C12 | "MIT licensed" (Status) | package.json `license: MIT` + LICENSE (MIT text) | verified | — | applies to the provided manifest + LICENSE pair |

## Boundary Notes

- Labels apply only to the documented input scope and reviewed evidence.
- No command was executed during the assessment.
- No code-quality or security assessment was performed.
- No patch or replacement text was generated.
