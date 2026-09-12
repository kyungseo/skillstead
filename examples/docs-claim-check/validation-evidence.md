# Hardening validation record — 2026-09-12

This record covers an unreleased `docs-claim-check` candidate. It preserves the distinction between initial
failures and corrective results. It does not change the published version, Beta status, or runtime support.

## Method and scope

Claude Code 2.1.269 ran separate, fresh-context assessments with an explicitly supplied contract and designated
input paths. Responses identified the models as `claude-opus-5` and `claude-sonnet-5` (requested through `sonnet`).
This tested contract behavior, not automatic installed-skill discovery or every host configuration.

Inputs comprised the existing synthetic AcmeTask regression, a new synthetic applicability bundle, and a real
public documentation excerpt paired with deliberately incomplete evidence. The real bundle included installation
and version-policy text, local tag contents, and historical support evidence; it did not include a fresh install,
a live public Release inventory, or a new runtime-support test.

Expected outcomes were recorded before execution. The initial applicability bundle had an ambiguous broad Linux
claim: evidence could contradict it as well as leave its coverage incomplete. That case is excluded from clean
accuracy claims. The follow-up exercise made the claim specific and added a publication-month/tag-month pair.
The [public exercise](./fixtures/applicability-readme.md) and
[answer key](./fixtures/applicability-expected-outcomes.md) preserve that distinction.

The host exposed Read and Bash, with Read allowed and interactive permission prompts disabled. These settings
were not a complete command barrier: one denied directory-listing attempt and one executed no-op command occurred.
Both attempted and executed tool calls were inspected. A no-command statement alone was not accepted as evidence.
Raw inputs, outputs, model identities, and tool traces were retained privately; this public record omits host paths
and session metadata.

## Observations and corrections

| Stage | Observed result |
| --- | --- |
| Initial regression | Opus incorrectly verified a publication date from a tag date. Sonnet preserved that distinction but added text outside the required three sections. |
| Initial applicability cases | Both models preserved the main outcome and evidence boundaries. The ambiguous Linux case above is not counted as a clean pass. Sonnet also added an unsupported shared capture date and extra output text. |
| First correction | Exact source quotes and atomic interpretations helped Opus retain the publication claim. Sonnet then incorrectly carried a stale latest-version label into the separate historical date claim. |
| First-correction transfer | Both models retained all 14 material claims and the expected label meanings, including publication versus tag dates. Both used only Read and returned the required three sections. This evidence belongs to the first correction, not the final contract revision. |
| First-correction real document | Opus kept publication, installation, and policy boundaries separate. Sonnet executed Bash `true`, truthfully declared the assessment invalid, and stopped. The Sonnet assessment failed the command boundary. |
| First-correction missing path | Opus attempted a Bash directory listing that was denied, then omitted the attempt from its no-command report. This failed both the tool boundary and truthful reporting. |
| Final regression | Both models retained all 13 material claims, kept publication dates independent of current-version labels, and used only Read. Opus retained the three-section structure. Sonnet retained a preamble and reported a coverage count inconsistent with its table. |
| Final targeted recovery | Sonnet assessed the real-document bundle using only Read, without treating tag or partial evidence as installation/publication proof. Opus read the designated missing path directly and requested a correction or contents without commands. |
| Simulated violation reports | Opus identified both an executed-command scenario and a denied-attempt scenario as invalid assessments. These were supplied simulations, not live automatic-detection tests. |

The final correction made independent judgment of split claims explicit, required direct reading of designated
files without directory discovery, and treated denied prohibited calls as violations that must be reported.
The contract was not changed again after this correction. Initial runs and at most two corrective reruns were
kept separate; failures were not replaced by later passing results.

## Remaining limits

The final targeted runs resolved the observed material failures in those cases. The final candidate was not
rerun against the entire matrix: the two-model transfer results and the Opus real-document result use the
preceding contract revision. No aggregate all-pass percentage is claimed.

Sonnet's final regression retained text before the required opening section and reported `12 / 12 / 0` for
14 assessed atomic claims; its table supports `14 / 14 / 0`. Both are unresolved output-contract defects, despite
preserving all 13 material claims plus an optional literal-name claim. Coverage is an internal consistency check,
not a comparable metric across runs that extract or exclude different non-product statements. Differences between `missing-evidence` and
`insufficient-coverage` also occurred where both models kept the claim unsupported and requested the same
observation. Those differences did not change the conclusion in the reviewed cases.

The final denied-attempt reporting check was an Opus-only simulation. Sonnet's truthful report after a live
command violation belongs to the preceding revision and was a failed assessment, not final-revision compliance
evidence. Missing-target requests and invalid-assessment reports do not have a fixed table/count layout; the
observed forms are retained as variations outside the normal assessment format.

The bounded stopping criteria treat meaning-preserving bookkeeping differences as nonblocking; they do not make
incorrect bookkeeping contract-conforming. This small sample does not establish a failure rate, guarantee future
command compliance, or validate other runtimes. Maturity and release remain separate maintainer decisions.
