# Fixture answer key

Contract-verification reference for `fixtures/sample-readme.md` against
`fixtures/evidence/`. **Do not show this file to an agent being evaluated** (for
example a fresh-context dogfood run) — it leaks the intended labels.

| ID | Atomic claim | Expected label | Expected reason | Why |
| --- | --- | --- | --- | --- |
| C1 | "fastest task runner in its class" | `needs-human` | — | comparative/subjective; cannot be reduced to user-providable evidence (tree step 1) |
| C2 | "Requires Node.js 18 or newer" | `verified` | — | `package.json` `engines.node >=18` directly supports it |
| C3 | "Works on Windows, macOS, and Linux" | `unsupported` | `insufficient-coverage` | `ci-test-output.txt` was captured on a **linux runner** — evidence covers Linux only; expect request for Windows/macOS CI output |
| C4a | "Installs in under a minute" (split from composite) | `unsupported` | `missing-evidence` | objective and settleable by a user-provided timed install log — none provided (NOT `needs-human`; tree step 1 note) |
| C4b | "Runs fully offline after the first run" (split) | `unsupported` | `missing-evidence` | no network-isolation evidence provided |
| C5 | "Latest release: v2.3.0 (November 2025)" | `stale-suspected` | — | tags show v2.4.1 (2026-05-28); true once, currency not supported (tree step 2) |
| C6 | "Zero runtime dependencies" | `unsupported` | `contradicted` | `package.json` lists two runtime dependencies |
| C7 | "All commands are covered by integration tests" | `unsupported` | `insufficient-coverage` | evidence **shows** tests for 2 of 4 commands; coverage of `watch`/`init` is not shown (not confirmed absent — if evidence affirmatively proved non-coverage, `contradicted` would apply) |
| C8 | "MIT licensed" | `verified` | — | `package.json` `license: MIT` **plus** `LICENSE` (MIT text) together support the claim; applies to the provided file pair |

Coverage expectation: 9 atomic claims extracted (C4 split into two) / 9 assessed / 0 excluded.

Boundary fixtures (`boundary-requests.md`): B1 execution → refuse + evidence request
(`unsupported / missing-evidence` on the underlying claim), B2 patch → refuse
(findings only), B3 code review → refuse (out of scope). Mixed requests: decline only
the out-of-scope part; the claim assessment itself proceeds.

Matrix intent: every label appears at least once, every `unsupported` reason appears
at least once, composite-claim splitting, the "command output not provided ≠
needs-human" distinction (C4a vs C1), and all three refusals are exercised.
