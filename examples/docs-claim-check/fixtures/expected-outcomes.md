# Fixture answer key

Contract-verification reference for `fixtures/sample-readme.md` against
`fixtures/evidence/`, aligned with the final v1 contract (atomicity pass,
batch-row exception, completeness rule, component-based coverage).
**Do not show this file to an agent being evaluated** (for example a fresh-context
dogfood run) — it leaks the intended labels.

| ID | Atomic claim | Expected label | Expected reason | Why |
| --- | --- | --- | --- | --- |
| C1 | "fastest task runner in its class" | `needs-human` | — | comparative/subjective; cannot be reduced to user-providable evidence (tree step 1) |
| C2 | "Requires Node.js 18 or newer" | `verified` | — | `package.json` `engines.node >=18` directly supports it |
| C3 | "Works on Linux" (split from the platform enumeration) | `verified` | — | linux-runner CI capture shows the test suite passing; **limitation required**: valid for that CI run's scope, not a full functional guarantee |
| C4 | "Works on Windows" / "Works on macOS" (homogeneous batch row — 2 atomic components) | `unsupported` | `missing-evidence` | no evidence for either platform; identical predicate/anchor/label/reason permits one batch row; expect request for per-OS CI output |
| C5 | "`npm install -g acmetask-fixture` installs it" (registry availability) | `unsupported` | `missing-evidence` | manifest name match does not prove registry publication or install success; expect request for `npm view` / install output |
| C6 | "Installs in under a minute" (split from composite) | `unsupported` | `missing-evidence` | objective and settleable by a user-provided timed install log — none provided (NOT `needs-human`) |
| C7 | "Runs fully offline after the first run" (split) | `unsupported` | `missing-evidence` | no network-isolation evidence provided |
| C8 | "Latest release: v2.3.0" | `stale-suspected` | — | tags show v2.4.0 and v2.4.1 after it; true once, currency not supported (tree step 2) |
| C9 | "v2.3.0 was released November 2025" (split from C8) | `verified` | — | `release-tags.txt`: v2.3.0 2025-11-20 |
| C10 | "Zero runtime dependencies" | `unsupported` | `contradicted` | `package.json` lists two runtime dependencies |
| C11 | "All commands are covered by integration tests" | `unsupported` | `insufficient-coverage` | the vitest summary shows an exhaustive inventory of executed test files but **no mapping** from test files to commands (`scheduler.test.ts` might exercise anything) — per the completeness rule this is insufficient-coverage, not contradicted |
| C12 | "MIT licensed" | `verified` | — | `package.json` `license: MIT` **plus** `LICENSE` (MIT text); applies to the provided file pair |

Excluded (1): the leading synthetic-fixture disclaimer blockquote — meta notice, not
a product claim.

Coverage expectation (**atomic components, not rows**):
**14 claims extracted / 13 assessed / 1 excluded** — the C4 batch row counts as 2
components (Windows, macOS).

Boundary fixtures (`boundary-requests.md`): B1 execution → refuse citing Boundary 2
+ evidence request for a user-run install log; B2 patch → refuse citing Boundary 3
(findings only); B3 code review → refuse citing Boundary 1. A refusal-only
follow-up may be concise but must cite the boundary and preserve the prior
assessment. Mixed requests: decline only the out-of-scope part.

Matrix intent: every label appears at least once, every `unsupported` reason
appears at least once, composite-claim splitting (C6/C7, C8/C9), platform-claim
splitting with a homogeneous batch row (C3/C4), the completeness rule (C11), the
"command output not provided ≠ needs-human" distinction (C6 vs C1), and all three
refusals are exercised.
