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
- keep already-effective text when no material improvement is available,
- keep the author's voice except where a trait conflicts with the stated audience, and then change only that trait,
- treat a source register that does not fit the stated audience as adjustable, not as something to preserve.

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
| F22 | Lead with what the reader can do now, in plain language, and drop the contract register. Keep every claim: per-skill zip files are not offered; the release checks verify neither that an archive matches its skill and tag nor its `checksum`; the pinned-tag `git clone` is the way to install today. The reason must stay attached to the recommendation. | Drop the identity check, the `checksum`, or the reason the clone is recommended; imply zip files are coming; present the clone as one option among several; keep the stacked contract phrasing unchanged. |
| F23 | Improve rhythm and connectives within the existing register. Keep each obligation at its stated level, keep `identity` and `checksum` as distinct things, keep the reason a checksum is insufficient, and keep the escalation path to the release owner. | Replace `MUST` / `MUST NOT` with softer modals; merge identity and checksum into one check; drop the escalation; restructure the runbook because it reads formally; call the audited wording unnecessary jargon. |
| F24 | Tighten wording only. Every one of these survives: confirm with the data owner first; a restart during a backfill leaves partial rows; the nightly reconciler will not repair them; wait rather than cancel; cancellation drops the checkpoint; the row-count check happens **after** the restart; it compares against the previous hour; the on-call engineer performs it; the two percent threshold; escalate to the data owner rather than rerunning ingest. | Drop any reason clause as redundant; merge the data owner and the on-call engineer into one actor; turn the escalation into a rerun; lose the two percent figure or the previous-hour comparison; move the row-count check before the restart or leave its timing unstated; remove the cancellation warning because the wait instruction implies it. |
| F25 | Fix the two grammar defects (`Installation are done`, `is requiring`). Keep the opening voice — the dry contrast about dashboards and the deliberate `boring` framing — intact, and keep the installer script as the installation route, `Node 18 or newer` including the `or newer`, the Prometheus dependency, the no-collection claim, and the network boundary. | Rewrite the opening into neutral marketing prose; delete the contrast because it is informal; flatten `deliberately boring`; restructure the README when two sentence-level fixes suffice; pin Node to exactly 18; drop the installer script or the network boundary. |
| F26 | Name the reader problem and move the irreversibility warning, the backup step, and the unenrolled-host failure ahead of the `rotate-key --apply` instruction. Keep `#rotate-the-signing-key` and `#verify` with their current heading text, keep `keyring.json` and `rotate-key`, and reproduce the `Verify` section **word for word** — it is outside the requested scope. | Restructure without naming the reader problem; leave the warning under `Notes`; reword `Verify` at all; rename or drop either protected heading; drop the mixed-state failure or the backup step; reorder so the previous key deactivation reads as reversible. |

## Register, Voice, And Structure Fixtures

F22 to F26 test the layer separation. Judge them on two axes at once: did the writing get easier to use, and did
every invariant survive.

| Fixture | Tests |
| --- | --- |
| F22 | Register adjusts for a first-time reader while the identity and `checksum` limits survive |
| F23 | Register is retained because the host contract requires it — improvement is not a licence to soften audited wording |
| F24 | Reducing density must not delete a condition, an actor, a threshold, or a reason |
| F25 | A working voice survives a sentence-level fix; local edits are enough, so a structural revise here is a failure |
| F26 | A structural revise is warranted, and it is bounded: warning before instruction, anchors intact, unrelated sections untouched |

### Building the invariant list for these fixtures

Do not write the list from memory of the source. Build it twice and reconcile.

1. Walk the ledger categories in `SKILL.md` and pull every item of each kind out of the source.
2. Walk the source clause by clause and map each one to a list entry or to a recorded `N/A` with a reason. A
   clause with no mapping means the list is not finished.

Record each entry as: source anchor, invariant kind, the proposition or relationship to keep, exact tokens if any,
what may change, what may not.

A second reviewer who has not seen the list builds their own from the source and compares. Record the result of
that comparison, including when nothing was missing.

This procedure belongs to fixture and answer-key preparation. It is not something the skill asks of a user at
runtime.

### Judging a run

- Exact tokens — commands, numbers, identifiers, links — compare mechanically.
- Obligation strength, conditions, actors, causal and prerequisite relationships, and step order — compare as
  propositions against the list, not as strings.
- For F26, the anchors named as referenced by other documents must still exist and resolve.

Then check the result reads better, not just differently. An evaluator who sees **only the revised text** — not
the source, not this answer key — should be able to say what the document is about, why it matters, what to do,
and what conditions or risks remain. Compare those answers against the required propositions: an evaluator who
cannot answer means the writing did not improve, and an answer missing a required proposition means something was
lost.

## Enforcing "Reads Better" (F27)

F22 to F26 test that an intended change happened. F27 tests the other direction: it supplies three frozen
candidates that all keep the meaning, and asks whether the procedure still fails the ones that are worse to
read. Judge them, do not rewrite them.

### Expected verdicts

| Candidate | Verdict | Why |
| --- | --- | --- |
| 1 | fail | Ritual framing repeated on nearly every sentence flattens instruction and background into the same weight |
| 2 | fail | Nominalised frames absorb the clause structure, so the one instruction becomes a definition rather than a command |
| 3 | pass | Condition, action, and reason arrive in the order the reader needs them, and no sentence is empty |

Ranking, once each candidate has its own verdict: 3, then 1, then 2.

### How to judge

Judge each candidate **on its own** first. Only after every candidate has an independent pass or fail may
you rank them. All three can pass; all three can fail.

1. **Quote the places that force a re-read**, and say what each one costs the reader. "Hard to follow" with
   no quotation is not a finding.
2. **Name the kind of document it reads as.** A migration note that reads as meeting minutes or as an
   internal architecture memo has failed its profile even when every fact survives.
3. **Record a pass or a fail per candidate**, with the evidence above, before any comparison.

### Diagnostics, not gates

Two more observations help explain a verdict but never decide one.

- **How many empty frames there are.** Counting is useful for showing a reader what went wrong. It is not a
  threshold: two judges counted the same candidate at 12 and at 16 and still reached the same verdict and
  the same ranking. Do not set a passing number, and do not rank by count.
- **Whether a frame can be lifted off.** A repeated prefix can be deleted and leave a working sentence
  behind; a nominalised frame that owns the predicate has to be rewritten. This explains why candidate 2
  ranks below candidate 1 even though both fail, and why the count alone would order them the other way.

### What is out of scope here

Candidate 2 implies a layered structure the source does not support, which could lead a reader to mistake it
for the product's real architecture. That is a profile failure, not a meaning failure: no candidate states a
component, interface, or behaviour the source does not state, and the concrete sentences that follow still
describe the same resampler behaviour.

### Locale boundary

Repetition counts, English nominalisation, and detachable prefixes are surface signals of **this English
fixture**. In another locale, do not look for the same expressions. Judge empty framing and unnecessary
abstraction that blur the requested document profile, and their effect on the reader, against the grammar
and conventions of that language. Counts and thresholds are never shared across locales.

## Coverage

| Dimension | Fixtures |
| --- | --- |
| Assess | F01, F05, F07 |
| Compose | F16, F17, F18, F19, F20 |
| Revise | F02, F08, F10, F11, F12, F15 |
| Adapt EN→KO | F03, F06, F09 |
| Adapt KO→EN | F04, F13, F14 |
| Register and voice layers | F22, F23, F24, F25 |
| Structural revise | F25 (must not), F26 (must) |
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
| Reads-better enforcement (frozen candidates) | F27 |
