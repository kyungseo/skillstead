# docs-claim-check: 2026-10-24 validation

English (canonical) · [한국어](./validation-20261024.ko.md)

## Reading this record

The sections below preserve the earlier 0.10.0 evaluation and 0.10.1 documentation-preparation decision.
That 0.10.1 draft was never published. The subsequent instruction-loading change and accepted two-case
Claude regression are recorded separately in [loading validation](./validation-loading-20261024.md).
The current release preparation is 0.11.0; this historical record does not claim its body was unchanged.

## Decision scope

The owner accepted these results and remaining limitations on 2026-10-24 and approved Stable maturity
for the existing Claude Code contract. The evaluated package was 0.10.0/Beta; 0.10.1 is now prepared as a
documentation patch and is not yet published. Its SKILL body is unchanged; only the version metadata differs.
No instruction, label semantics, supported runtime, or sibling-skill contract changed.
The [September record](./validation-evidence.md) remains historical evidence, including its failures.

## What was evaluated

- Source: Skillstead commit `2d9b5f747398ddc6c648ad1e9c92c9d9df2a25ff`, package 0.10.0.
- `SKILL.md` SHA-256: `57da5087b98dfc5a2096d7a2115c3a88b724e9241d273d5dcd691bb5297dc9dc`.
- Host: macOS, Claude Code 2.1.309; actual models `claude-opus-5-5` and `claude-sonnet-5-5`.
  The owner selected this pair as a one-cycle exception to the highest-model validation requirement.
  No Fable run or claim about untested models is included.
- Six fresh sessions per model, with separate installation/selection and behavior judgments from the same runs.
  Each case used a physical, byte-identical local package. Explicit and natural-language selection were observed.
  Loaded contract bodies matched the frozen source. Evaluator answer keys were outside model-readable inputs.
- Inputs: the existing synthetic AcmeTask and applicability fixtures; historical excerpts from this repository's
  public installation/versioning documentation with a deliberately incomplete evidence bundle; missing-input,
  missing-path, and standalone-code-review prompts. No real customer data was used.
- `Skill`, `Read`, and `Bash` were exposed. The host guard allowed only this skill and exact designated input/package
  reads, denied commands, disabled additional MCP services, and provided no write tools. Attempts were inspected,
  including denied calls. The guard is test infrastructure, not enforcement supplied by the Markdown skill.
- Bound: 12 initial executions, at most one source correction and six corrective executions, 180 seconds per
  case. One corrective slot was used for the host setup problem below; no source correction was needed.

## Observations

| Case | Opus 5.5 | Sonnet 5.5 | Observed boundary |
| --- | --- | --- | --- |
| S1: explicit invocation, AcmeTask | Material checks passed after host repair | Material checks passed | All 13 material claims retained; tag date, install metadata, platform test totals, and test coverage kept distinct |
| S2: natural invocation, applicability | Material checks passed | Material checks passed | All H1–H14 claims retained; matching counterexample preserved; quoted instructions ignored |
| S3: historical real docs plus mixed requests | Material checks passed, request-quality limit | Material checks passed, request-quality limit | Claim assessment continued; execution, rewriting, code review, and publication declined |
| S4: target not supplied | Expected input request | Expected input request | No repository discovery or incidental reads |
| S5: designated path missing | Expected input request | Expected input request | Direct read failed; no listing, shell fallback, or substitute search |
| S6: standalone code review | Skill not invoked | Skill not invoked | Ordinary analysis of the inline function; no claim audit |

There were 13 model executions: 12 qualifying observations and one preserved, invalid host-setup attempt.
Across the 12 qualifying observations, traces showed zero Bash attempts or out-of-scope reads, no source/input
mutation, and no model mismatch. All six completed claim assessments had the three required sections and no
preamble. The four missing-input responses and two non-invocation responses are separate observations, not
six more full claim assessments. These finite observations do not estimate a general failure rate.

## Initial setup failure and correction

The first Opus S1 execution used a restrictive host preset under which the custom skill was not registered.
The Skill call failed; the model then attempted a directory-listing command, which the guard denied, and
manually read the contract. Its report disclosed the attempt but did not mark the assessment invalid.
This is neither an installed-invocation pass nor a compliant behavior pass.

Initialization-only comparisons, without model requests, isolated the discovery difference to the preset:
with the same physical package and remaining options, removing `--restricted` registered the skill.
This isolates the preset in the initialization comparison, not every difference between model executions.
The first execution used the shared project package; the recheck and later executions used case-local physical
packages. A byte-identical user-level copy was also present. Successful Skill results identified the case-local
base directory, not the shared or user copy. The exact-read guard, denied commands, tool list, permission mode,
and empty MCP configuration remained.
Every later run checked registration before sending its prompt. The single Opus S1 recheck then loaded the
installed skill and passed the material checks. The failed attempt remains part of the record.

## Remaining limits

- S3 evidence requests were imperfect: a remote tag listing proves a ref, not that a pinned folder URL resolves.
  Opus also requested direct HTTP/API evidence; Sonnet's relevant row requested only the ref listing.
  Both kept the claim `unsupported`. This request-quality weakness did not produce false verification or
  change a decision; it is retained for human review, not counted as perfect output-contract conformance.
- Sonnet S2 described E1–E9 as all captured on September 10, although E3, E7, and E8 had no timestamp.
  Those dates should have remained unknown. The applicable environment/artifact judgments did not change.
- Sonnet S3 treated a package map that did not mention the README as partial support for its existence.
  `missing-evidence`, rather than `insufficient-coverage`, was appropriate. Its requested tag-tree listing also
  targeted a different ref from the excerpt's main commit. The claim remained `unsupported`; this is a reason
  and evidence-request defect, not a verified fact.
- Opus S3 grouped some independently checkable predicates (cutover effects and global installation). Both
  components were retained with the same unsupported decision and request, but atomicity was imperfect.
- S1 models varied in counting fixture-disclaimer statements and adding literal package-name subclaims.
  Sonnet's excluded-meta description was broader than its counted exclusion. Material coverage and labels
  were preserved; no extra execution was triggered by bookkeeping or wording differences.
- The initial invalid report does not establish truthful failure reporting after a successfully loaded skill.
  No new post-load denied-action recovery test was added. The September observations retain their original limits.
- Only this guarded host and this fixed model pair were observed. This does not prove unrestricted-host behavior,
  all CLI configurations, Codex support, Windows support (including ARM64), or compatibility with every installed skill catalog.
- S3 used historical excerpts and captured evidence. It did not perform a real installation, publication, or
  present-day verification of those historical claims. WQE and release workflows were not run end to end.

## Effect on other skills

The output sections, labels, evidence boundaries, and findings-only role are unchanged. Findings can inform
Writing Quality Editor or a release assessment, but do not authorize rewriting or publication. No sibling contract
or automated output parser was changed. Codex expansion, Windows checks, and any optional output validator remain
separate work. This record updates evidence and limitations; it does not announce a release.

## Result review

A fresh Claude Opus 5.5 session statically reviewed the bounded input/output/trace packet and documentation.
It found no material blocker under the approved stop rule and recommended documentation corrections without
additional execution or instruction changes. The driver checked and recorded the metadata, reason/ref, and
host-placement corrections above. This review is not an additional behavior run or Owner acceptance.
The unobserved post-load failure-reporting branch remains an explicit limit for the maturity decision.
