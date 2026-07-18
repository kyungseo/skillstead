# Scenario Validation Evidence

This ledger separates static contract review from fresh-context runtime behavior. Runtime support is `Supported`
for Claude Code and Codex within the recorded evidence scope after pinned `v0.7.0` installation/discovery and the
post-release claim closeout passed.

## Static Contract Gate

| Check | Result |
| --- | --- |
| Official skill validator | Pass: `Skill is valid!` |
| Scenario and answer-key parity | Pass: 21 scenarios / 21 answer-key rows |
| Intent-inference coverage | Pass: F01 unnamed ambiguous review, F02 named skill without mode, F12 unnamed revision |
| KO→EN coverage | Pass: F04, F13, F14 |
| Premature `validated` claim and stale 12-count scan | Pass: 0 matches |
| Whitespace validation | Pass: `git diff --check` |

This gate verifies package consistency, not independent model behavior.

## Fresh-Context Executions

| Runtime leg | Observed model | Isolation | Result |
| --- | --- | --- | --- |
| Claude Code, 2026-07-18, pre-fix | `claude-fable-5`; reasoning effort unobserved | One fresh subagent per scenario; skill package and inline source; F09/F13 explanatory Context lines excluded; answer key withheld | Conditional: F03, F04, F08, F11, F12, F14 pass; F09 and F13 systematic fail |
| Codex, 2026-07-18 | Model and reasoning effort unobserved | One no-history context per scenario; skill package and inline scenario only; answer key withheld | Pass after F12 no-edit correction: nine-scenario high-signal set passes |
| Claude Code, 2026-07-18, post-fix | `claude-fable-5`; reasoning effort unobserved | One fresh subagent per scenario; complete metadata and source; answer key withheld until all first runs completed | Pass: F03, F04, F09, F12, F13, F14, F15; corrective reruns 0 |
| Codex Compose, 2026-07-18 | Model and reasoning effort unobserved | One no-history context per scenario; skill package and complete scenario only; answer key withheld | Pass after F16 procedure-inference correction: F16, F17, F18 |
| Codex research-backed Compose, 2026-07-18, pre-budget | Model and reasoning effort unobserved | One no-history context per scenario; skill package and complete scenario only; answer key withheld; live public-source retrieval allowed | Exploratory behavior pass: F19, F20; exceeds the later bounded-validation protocol and does not close the gate |
| Claude Code post-R2 amendment, 2026-07-18 | `claude-fable-5`; reasoning effort unobserved | One fresh subagent per scenario; complete metadata; answer key withheld until all first runs completed; bounded live research for F19/F20 | Pass: F01, F02, F12, F16–F20; corrective reruns 0 |
| Codex post-R2 amendment, 2026-07-18 | Model and reasoning effort unobserved | One no-history context per scenario; skill package and complete scenario only; answer key withheld; bounded live research for F19/F20 | Pass: F01, F02, F12, F19, F20, F21; corrective reruns 0 |
| Claude Code F21, 2026-07-18 | `claude-fable-5`; reasoning effort unobserved | One fresh subagent; installed skill folder and complete F21 metadata only; answer key and prior evidence withheld | Pass: F21; corrective reruns 0 |
| Post-merge clean install/discovery, 2026-07-18 | Claude Code 2.1.214; Codex CLI 0.144.1, `gpt-5.6-sol`, effort `none` | Complete package downloaded from merge commit `7b65d70` into fresh project-local `.claude/skills` and `.agents/skills` paths; no prior session history; read-only discovery prompts | Pass on both runtimes: source and installed packages were byte-identical; each runtime loaded `SKILL.md`, returned `Compose, Assess, Revise, Adapt` in contract order, and identified `Bound The Meaning Before Writing`; zero mutations or corrective reruns. |
| Post-release pinned install/discovery, 2026-07-18 | Claude Code 2.1.214; Codex CLI 0.144.1, `gpt-5.6-sol`, effort `none` | Fresh shallow clone of published tag `v0.7.0` at `1f9fcfb`; complete package copied into isolated project-local `.claude/skills` and `.agents/skills` paths; package equality checked before and after read-only runs | Pass on both runtimes: Claude Code loaded the skill and returned the four modes plus the exact contract heading on its first run. Codex's two implicit-name prompts loaded the skill and returned the modes but paraphrased the requested heading; an explicit `$writing-quality-editor` fresh invocation returned the exact heading with no file mutation. |

### Claude Code Pre-Fix Leg

- Environment and delivery errors: 0. Every evaluator loaded `SKILL.md`; Adapt cases also loaded
  `references/en-ko-adaptation.md` as intended.
- The runner excluded the non-fenced F09/F13 explanatory Context lines as evaluator commentary. Treat this leg as
  a useful minimal-context stress test, but not a protocol-identical comparison with runs that receive the complete
  scenario metadata. Post-fix runs must include the complete Context field.
- First-run passes without corrective reruns: F03, F04, F08, F11, F12, F14.
- F09 reproduced the same miss on corrective rerun 1: it finalized Korean destructive-dialog copy while leaving
  the effect on shared copies unexamined. Its `needs-human` note covered glossary choice instead.
- F13 reproduced the same miss on corrective rerun 1: it used an imperative or passive construction without
  surfacing the missing approval, deployment, rollback, and record-keeping owners.
- Driver disposition: keep the answer key and strengthen the contract. A faithful vague translation, imperative,
  or passive construction must not hide a decision whose consequence or ownership is material.
- Raw outputs and manifest:
  [`fresh-context-raw/claude-code-20260718/README.md`](fresh-context-raw/claude-code-20260718/README.md).
- This is pre-fix failure evidence. F09 and F13 require fresh isolated reruns after the contract change; F03, F04,
  and F14 are regression spot-check candidates because they load the same localization reference. F15 was added
  after this runtime leg and has no Claude Code behavior evidence yet.

### Codex Leg

- First-run passes: F03, F04, F08, F09, F11, F13, F14, F15.
- F09 returned provisional Korean copy, identified the unresolved shared-copy consequence, and offered distinct
  delete, disconnect, and local-only alternatives. F13 used visible role placeholders and offered three ownership
  models instead of hiding the missing actors.
- F12 changed already-natural text on the first run and a fresh reproducibility rerun. Both changes were semantic
  safe but preference-driven: code-block reformatting, equivalent wording, punctuation, and sentence splitting.
- Driver disposition: treat the repeat as a contract failure, not a Neutral pass. The `Revise` no-edit gate now
  requires a concrete reader problem and exact source reproduction when every candidate change is Neutral.
- F12 passed in a new post-fix context with the source unchanged and `Material Changes: None`.
- Raw outputs: [`fresh-context-raw/codex-20260718.md`](fresh-context-raw/codex-20260718.md).
- Claude Code post-fix F09, F13, F15 and regression spot-check evidence is recorded below. No Supported claim is
  justified until repository dogfood and final claim audit finish.

### Claude Code Post-Fix Leg

- First-run passes without corrective reruns: F03, F04, F09, F12, F13, F14, F15.
- F09 marked its copy provisional and presented distinct delete, disconnect, and unchanged outcomes. F13 marked
  ownership as unassigned, used visible placeholders, and presented actor choices rather than resolving them.
- F15 integrated the 5 GB limit, local progress storage, and expired-authentication stop/sign-in behavior without
  refusing enrichment or inferring adjacent claims.
- F12 returned the source exactly and recorded `Material Changes: None`. F04 and F14 showed that the actor rule does
  not block normal single-audience runbook instructions without an approval or ownership handoff.
- The runner corrected the earlier protocol difference by passing the complete F09/F13 Context fields.
- The evaluator agents were answer-key blind. The coordinating evaluator had seen the pre-fix 12-row answer key in
  the earlier review session; this limits coordinator blindness but does not change agent-side context isolation.
- Raw output manifest:
  [`fresh-context-raw/claude-code-postfix-20260718.md`](fresh-context-raw/claude-code-postfix-20260718.md).

### Cross-Runtime Material Parity

Verdict: Pass for the required behavior gate.

- Both runtimes preserve the same claims, conditions, identifiers, obligation levels, and unresolved-decision
  boundaries across F03, F04, F09, F12, F13, F14, and F15.
- Output structure and option wording differ, but no difference changes the material action or answer-key outcome.
- F08 and F11 passed in both runtimes before the ambiguity/no-edit corrections; neither was a failure target. Their
  current-contract risk remains bounded by repository dogfood and final claim audit rather than another broad rerun.
- This parity result authorized bounded R2 and playbook dogfood for the then-current three-mode contract. The owner
  subsequently added `Compose` as a fourth core mode, so dogfood entry is paused until the Compose fixtures below
  pass fresh-context behavior validation. It does not by itself justify `Supported` or a validated-locale claim.

### Owner-Directed Compose Amendment

Status: Supplied-evidence and research-backed Compose material parity pass.

- `Compose` writes a new document directly from a supplied brief and evidence packet; it does not require an
  intentionally rough draft followed by `Revise`.
- F16 checks an English README from complete verified facts. F17 checks direct Korean onboarding composition
  without an English intermediate. F18 checks a safe partial result and `Needs Human` behavior when a release brief
  is insufficient.
- F19 and F20 check research-backed Compose when evidence must be gathered from public sources: a current AX trend
  brief and a Spring Modulith/modular-monolith versus microservices technical comparison.
- F16–F20 now pass on both runtimes with material parity. The two research legs may use different sources and
  examples; parity concerns evidence handling, requested decision coverage, claim scope, and budget compliance.

#### Codex Compose Leg

- F17 produced the Korean onboarding directly from the fact packet, preserving both commands, paths, upload
  boundary, and platform evidence. F18 returned an explicitly provisional draft, withheld the internal ticket and
  unproven QA result from public copy, and listed the missing publication decisions.
- F16 first run added “Open that file in your browser” from the supplied `HTML report` format. Driver judgment:
  fail, because a familiar artifact format does not authorize a product procedure.
- The contract and F16 answer key now prohibit deriving open/install/configure/retry/publish actions from supplied
  artifact nouns. A new isolated F16 run omitted the browser action and passed.
- Raw outputs: [`fresh-context-raw/codex-compose-20260718.md`](fresh-context-raw/codex-compose-20260718.md).
- F19 produced a Korean enterprise AX trend brief with a 2026-07-18 evidence cutoff. It separated measured
  adoption, self-reported status, announced intent, source framing, and bounded synthesis while retaining sample
  and geography limits. Raw output:
  [`fresh-context-raw/codex-compose-f19-research-20260718.md`](fresh-context-raw/codex-compose-f19-research-20260718.md).
- F20 produced a Korean decision-oriented comparison that distinguished Spring Modulith, the modular-monolith
  style, and microservices; compared material tradeoffs without declaring a universal winner; and used direct
  primary or official sources with an explicit cutoff. Raw output:
  [`fresh-context-raw/codex-compose-f20-research-20260718.md`](fresh-context-raw/codex-compose-f20-research-20260718.md).
- These F19/F20 runs predate the bounded-validation protocol and researched more broadly than a contract fixture
  needs. Keep them as exploratory evidence, not as the final research-backed gate.
- For bounded F19/F20 runs, allow at most two search rounds, six substantive pages opened, five sources cited, and
  one citation-chain gap fill. Stop as soon as the required distinctions or comparison axes are supported. This is
  a fixture budget, not a product limit on real user research.
- Current Compose result: F16–F20 cross-runtime material parity pass. Both bounded F19/F20 legs distinguish source
  evidence from synthesis, preserve material scope limits, satisfy the requested comparison or trend axes, and stop
  within the fixture budget.

### Intent-Inference Amendment

Status: Cross-runtime material parity pass.

- Mode names are internal routing, not required prompt syntax. Selection follows requested outcome, source/target
  language relationship, and whether the user authorized replacement text.
- F01 now supplies only `이 README 좀 봐 줘.` and must default to read-only `Assess`.
- F02 names `writing-quality-editor` but no mode and must infer same-language `Revise`.
- F12 names neither skill nor mode and must infer `Revise`, then still apply the no-edit gate.
- Earlier runtime evidence used explicit `Mode` metadata and does not validate this amendment. The post-R2 Claude
  Code and Codex legs below provide the isolated mode-free evidence.

#### Claude Code Post-R2 Amendment Leg

- First-run passes without corrective reruns: F01, F02, F12, F16, F17, F18, F19, F20.
- F01 defaulted the bare review request to read-only `Assess`; F02 inferred `Revise` from a named skill without a
  mode; F12 inferred unnamed `Revise` and returned the already-natural source byte-identically.
- F16 avoided the unsupplied browser-open action on its first run under the corrected contract. F17 composed
  Korean directly, and F18 returned a provisional draft without inventing synchronization behavior or QA results.
- F19 handled inaccessible sources by excluding snippet-only claims and returning a bounded provisional result.
  F20 distinguished toolkit, architecture style, and microservices within the research budget.
- F16–F18 material parity with Codex passes. F01/F02/F12 and bounded F19/F20 parity were subsequently closed by the
  Codex post-R2 amendment leg. F21 was added afterward and remains pending on Claude Code only.
- Raw manifest:
  [`fresh-context-raw/claude-code-amendment-20260718/README.md`](fresh-context-raw/claude-code-amendment-20260718/README.md).

#### Codex Post-R2 Amendment Leg

- First-run passes without corrective reruns: F01, F02, F12, F19, F20, F21.
- F01 inferred read-only `Assess` from `이 README 좀 봐 줘.` and did not supply replacement prose. F02 inferred
  `Revise` from the skill name alone. F12 inferred unnamed `Revise`, applied the no-edit gate, and returned the
  single-line source passed to the evaluator byte-identically with `Material Changes: None`.
- F19 produced a bounded Korean AX trend brief that separated measured adoption, self-report, announced intent,
  vendor framing, and synthesis while preserving source scope. F20 distinguished Spring Modulith as a toolkit from
  modular monolith and microservices as architecture styles and covered the requested decision axes without a
  universal-winner claim. Both stopped within the fixture budget.
- F01/F02/F12 and F19/F20 cross-runtime material parity pass. Different source sets and phrasing do not alter the
  answer-key outcome or material evidence-handling behavior.
- F21 recognized `workflow-work-brief` as the outer workflow, created no repository artifact, and asked for the
  missing candidates, criteria, evidence, or research scope. Claude Code F21 remains Pending.
- Raw manifest:
  [`fresh-context-raw/codex-post-r2-20260718/README.md`](fresh-context-raw/codex-post-r2-20260718/README.md).

### Host Artifact Workflow Precedence Amendment

Status: Cross-runtime material parity pass; playbook dogfood entry open.

- A host workflow owns repository classification, path, index, lifecycle, and approvals.
- `writing-quality-editor` may improve prose inside that artifact contract but must not treat the word `brief` as
  permission to bypass repository workflow.
- Codex and Claude Code both recognized `workflow-work-brief` as the outer owner, created no governed artifact or
  strategy evidence, and requested the missing candidates and evidence. Claude Code first-run pass; corrective
  reruns 0.
- Raw manifest:
  [`fresh-context-raw/claude-code-f21-20260718/README.md`](fresh-context-raw/claude-code-f21-20260718/README.md).

### Repository Dogfood — Public-Release Playbooks

Status: Behavior and bilingual parity pass; English authority activated at PR #18 merge commit `7b65d70`, the
DR-810 anchor.

- The eight Korean-primary source documents were preserved as `.ko.md` mirrors, and eight English candidates now
  occupy the canonical filenames: the playbook catalog index plus seven `public-release` documents.
- Every pair has a visible language switch. Root English/Korean READMEs point to the matching-language entry, and
  internal playbook references remain within the reader's selected language.
- Checklist counts match by pair: public-release checklist 98/98, post-public verification 27/27, recurring
  protection 7/7, settings template 12/12, sensitive-information sweep 21/21, social template 12/12.
- Commands, paths, URLs, status labels, applicability rules, accepted-risk boundaries, visibility warnings,
  rollback/incident distinctions, and version/tag identifiers survive the adaptation. Language-specific release
  title examples and filenames differ only where the target language requires it.
- Korean mirrors replace unexplained internal shorthand such as `surface`, `consumer path`, `clean baseline`, and
  `match/overreach` with the concrete document, user-path, pre-public check, or ruleset behavior meant by the text.
- The consumer disposition maps canonical rule groups to `github-release-guide` package files while preserving the
  package's self-contained installation boundary. Social copy and copy-ready settings templates remain intentional
  human-reference-only differences.
- Claim audit PC-6 initially lacked the explicit mirror mapping and passed the narrow follow-up after the mapping
  was recorded. PC-1 closed when the owner-approved authority flip was activated by PR #18 merge commit `7b65d70`.
- Claim audit evidence:
  [`../playbook-dogfood-claim-audit-20260718.md`](../playbook-dogfood-claim-audit-20260718.md) and
  [`../playbook-dogfood-claim-audit-follow-up-20260718.md`](../playbook-dogfood-claim-audit-follow-up-20260718.md).
- An independent bilingual review found five line-level exceptions that the first driver audit missed: one AND/OR
  gate, three obligation or evidence-recording drifts, two checklist obligation drifts, an implicit language
  conflict rule, and one remaining Korean abstraction/translationese pair. All were corrected without changing
  document structure.
- The original broad PC-5 parity judgment is superseded for those lines by the corrective assessment:
  [`../playbook-dogfood-claim-audit-parity-correction-20260718.md`](../playbook-dogfood-claim-audit-parity-correction-20260718.md).
  The independent reviewer confirmed DF-1–DF-5 closure with no new regression. The owner approved the authority
  flip on 2026-07-18, and PR #18 merge commit `7b65d70` activated it and closed PC-1 under DR-810.

The cross-runtime high-signal set uses F03, F04, F08, F09, F11, F12, F13, F14, and F15. It covers both adaptation
directions, claim honesty, unresolved ambiguity, natural rewriting without detector gaming, over-editing refusal,
implicit Korean actors, Korean obligation strength, and user-approved enrichment without invention.

For each run:

- use one scenario in a fresh context with only the installed skill and that scenario;
- keep `expected-outcomes.md` unavailable to the agent under evaluation;
- record runtime, observed model, reasoning effort when known, isolation method, raw output, and corrective reruns;
- separate error identification from the driver pass/fail decision;
- allow at most two corrective reruns when the contract or output is wrong;
- record environment or driver-input corrections separately from material reruns.

Stop when a required output section is still missing or a Blocking invariant violation is still missed after two
corrective reruns. Fix the contract before restarting; do not increase the rerun count until the fixture passes.

## Claim Boundary

- F01–F18 and F21 are synthetic contract material; F19–F20 require live public-source research. None is user
  research.
- Static review does not establish runtime support or English↔Korean behavioral validation.
- Passing the runtime set and repository dogfood does not by itself establish a public runtime support claim.
- A Supported or validated label requires recorded runtime comparison, remaining coverage disposition, repository
  dogfood, clean installation/discovery evidence, and final claim audit.
