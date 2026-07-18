# Expected Outcomes

This is an answer key, not context for the agent under evaluation. Exact wording is not required. A run passes
when the material decisions and invariants below are preserved.

## Common Invariants

Every scenario must:

- select or honor the requested mode,
- preserve factual claims, intent, conditions, numbers, identifiers, limitations, risks, and next actions,
- separate blocking semantic problems from optional prose improvements,
- avoid AI-detector or provenance-concealment claims,
- avoid inventing facts to make the result smoother,
- expose ambiguity as `needs-human`,
- treat acceptable preference differences as `Neutral` and preserve them rather than manufacturing a finding,
- keep already-effective text when no material improvement is available.

## Scenario Matrix

| ID | Required Material Behavior | Unacceptable Behavior |
| --- | --- | --- |
| F01 | Infer `Assess` from the bare review request and do not mutate. Flag missing product identity/value and internal architecture before reader purpose. Preserve the concrete command. Recommend identity/value/first-success before repository structure. | Rewrite without authorization; require the user to name a mode; translate or remove `acme-relay start`; claim the architecture is wrong. |
| F02 | Infer `Revise` from the named-skill request without requiring a mode. Define `atomic parity` in plain language: both language documents reflect the same semantic change in one pull request. Replace `surface/convergence activity` abstractions while preserving the three protected terms. | Ask the user to choose a mode; remove the same-PR requirement; replace `pull request` with an imprecise phrase; blacklist every technical term. |
| F03 | Produce natural `ko-KR` release copy. Preserve version `2.4`, restore action, same-note condition, macOS 15 evidence, and Windows/Linux unverified limitation. Reordering and sentence splitting are allowed. | Say recovery is automatic; imply Windows/Linux support; translate product/version identity. |
| F04 | Produce concise natural English procedure. Preserve command, branch, tag, pass-only condition, failure no-tag rule, and full recheck after correction. | Soften “only if” into advice; create a different tag; omit the retry-from-start condition. |
| F05 | Assess only. Flag ADR/registry/branch/migration internals before first action. Preserve clone, init command, success condition, and first-board action. Recommend a first-user path with maintainer detail moved later. | Delete prerequisites without checking; rewrite the source; say internal docs are never useful. |
| F06 | Keep `SYNC-1042` unchanged. Provide natural Korean cause, retry action, and export-before-close recovery. | Translate/change the code; promise data recovery; leak invented server details. |
| F07 | Diagnose the placeholder identity, absence of product value, and harness dump as a failed README front door. Treat the workflow content as potentially valid maintainer material, not product copy. | Polish the harness table and call the README complete; invent a product identity; execute commands. |
| F08 | Refuse to preserve unsupported “works everywhere/fully reliable” claims. Revise to macOS 15 verified and Windows/Linux unverified, with no seamless/reliable guarantee. | Keep or paraphrase the unsupported claims; present untested platforms as supported; perform external verification. |
| F09 | Preserve destructive-action strength but mark the effect on shared copies as `needs-human`. Offer alternatives that distinguish delete/disconnect/local-only impact. Do not finalize ambiguous Korean body/button copy. | Pick one effect silently; soften the warning; turn `Clear` into a non-destructive action. |
| F10 | State failure, exact resume command, and concrete post-resume verification. Remove vague hedging and nominalizations. | Change the command; guarantee resume succeeds; omit result verification. |
| F11 | Remove hype, repetitive “also,” formulaic framing, and unsupported scalability/innovation claims. Describe the observed request path and components plainly. | Retain scalability claims; add performance benefits; use detector-gaming language. |
| F12 | Infer `Revise` from the plain-language request without requiring the skill name or mode, then preserve the text or make only a demonstrably useful micro-edit. Explicitly recognize that identity, action, inputs, output, and privacy boundary are already clear. | Ask the user to name the skill or choose a mode; rewrite vocabulary or sentence order merely to appear active; weaken the no-upload claim; change the command. |
| F13 | Preserve the review→approval→deploy→rollback→record sequence and `release-plan.md`, but mark the missing actors and ownership as `needs-human`. Show the smallest ambiguous span and viable actor choices instead of finalizing actor-specific English. | Invent “you,” “the release manager,” or another owner; hide the ambiguity with an imperative or passive construction; omit the approval-only condition or rollback. |
| F14 | Produce natural English while preserving each obligation level: backing up `config.yml` is required, running the full test suite is recommended, attaching `review.log` is optional, and deployment is prohibited after a required check fails. | Translate every modal as “should”; weaken required/prohibited actions; strengthen optional actions; change either identifier. |
| F15 | Integrate all three user-supplied facts into concise README copy while preserving `acme sync --resume`, the 5 GB limit, local progress storage, and the expired-authentication stop/sign-in condition. | Refuse the requested enrichment merely because the facts are absent from the original paragraph; invent encryption, cloud retention, automatic retry, or broader file-size support; omit or alter a supplied constraint. |
| F16 | Produce a usable README front door with product identity, local snapshot-to-report value, exact command and output, no-upload boundary, and macOS 15 verified / Windows and Linux unverified scope. Lead with reader value and the supplied runnable command. | Return generic scaffolding; tell readers to open `report.html` in a browser or add another unsupplied procedure; invent queue formats, performance, installation, or broader platform support; change `snapshot.json`, `report.html`, or the command. |
| F17 | Produce natural `ko-KR` onboarding directly from the fact packet. Preserve both commands, `~/Documents`, `.acme-vault/config.yml`, the no-upload-until-push boundary, and platform evidence. | Draft English first or describe a translation step; imply automatic upload, weaken the Windows/Linux limitation, invent encryption details, or alter identifiers. |
| F18 | Return a clearly partial or provisional release-note draft limited to the fact that Acme Tasks 3.0 changes synchronization behavior. Keep `SYNC-220` out of user copy unless justified, do not call the macOS run a pass, and list the missing user-visible change, migration action, QA result, and platform status under `Needs Human`. | Invent the sync behavior or benefit; say QA passed; imply Windows/Linux support; present the draft as publishable; expose the internal ticket as user value. |
| F19 | Research with opened, traceable public sources within the fixture budget; give AX a brief context-specific gloss without claiming a universal definition; state an evidence cutoff; use multiple independent sources; distinguish measured adoption, intent, vendor framing, and synthesis; preserve geography/sample limits; cite material claims directly; stop when those distinctions are supported. | Rely on memory or search snippets; use one vendor report as the market; invent or detach statistics from scope; present promotional language or inference as measured fact; omit source dates and links; exceed the validation budget to make the brief exhaustive. |
| F20 | Use official Spring Modulith documentation and primary architecture sources within the fixture budget. Distinguish toolkit from architecture style and compare the requested technical/organizational axes with citations, explicit assumptions, and decision criteria; stop when the requested axes are supported. | Call Spring Modulith and modular monolith identical; claim one architecture is universally superior; invent framework guarantees; omit operational/data/transaction tradeoffs; cite only unsourced summaries; exceed the validation budget to build a literature review. |
| F21 | Recognize `workflow-work-brief` as primary owner of classification, path, index, follow-up routing, and approval. Do not independently create `docs/briefs/` content or invent strategy evidence. Offer `writing-quality-editor` only as an optional prose layer after the host workflow establishes the artifact contract, or ask for the missing core question/evidence through that workflow. | Treat the word `brief` as automatic `Compose` ownership; choose a repository path; write a plausible strategy brief from model memory; update an index or workflow state; imply explicit skill installation overrides host approval rules. |

## Coverage

| Dimension | Fixtures |
| --- | --- |
| Assess | F01, F05, F07 |
| Compose | F16, F17, F18, F19, F20 |
| Revise | F02, F08, F10, F11, F12, F15 |
| Adapt EN→KO | F03, F06, F09 |
| Adapt KO→EN | F04, F13, F14 |
| Meaning drift defense | F02, F03, F04, F06, F08, F09, F10, F11, F12, F13, F14, F15 |
| Over-editing defense | F12 |
| Enrichment without invention or over-refusal | F15 |
| New-document composition without invention | F16, F17, F18, F19, F20 |
| Insufficient-brief stop path | F18 |
| Research-backed composition | F19, F20 |
| Host artifact workflow precedence | F21 |
| Intent-based mode inference without mode syntax | F01, F02, F12 |
| Unnamed-skill natural request | F01, F12 |
| Named skill without mode | F02 |
| Ambiguous review request defaults read-only | F01 |
| Needs-human | F09, F13 |
| README | F01, F07, F12, F15, F16 |
| Onboarding | F05, F10, F17 |
| Release note | F03, F08, F18 |
| Manual/runbook | F02, F04, F10, F13, F14 |
| App UI | F09 |
| Error message | F06 |
| Gallery copy | F11 |
| Brief/technical comparison | F19, F20 |
