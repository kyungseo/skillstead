---
name: docs-claim-check
description: >
  Check whether the claims in public-facing documentation (README, release notes,
  install/usage docs) are supported by the evidence the user provides — files,
  manifests, logs, and command outputs supplied in the conversation. Produces
  per-claim findings with a confidence label (verified / unsupported /
  stale-suspected / needs-human) and an explicit "input scope reviewed" statement.
  Advisory only. Use when the user asks to fact-check docs, verify a README against
  a repo, audit release notes, or find stale or overstated documentation claims.
  Do NOT use for standalone code review or bug hunting, security audits, fix/patch
  generation, or pure command-execution tasks. When such requests are mixed with an
  eligible claim-check, still use this skill for the claim-check portion and decline
  only the out-of-scope part — by contract it does not execute commands or edit files.
---

# docs-claim-check

Compare what public-facing documentation **claims** with what the provided evidence
**shows**, one atomic claim at a time. Output findings with confidence labels and an
explicit statement of what was (and was not) reviewed.

This skill renders a judgment backed by evidence. It is not a checklist, not a linter,
and not a substitute for code review.

## Boundaries (read first)

These are **contractual guardrails**. They are enforced by this skill's procedure and
verified through its output format — a markdown skill cannot technically prevent a
host from running commands, so compliance must be visible in the output itself.

1. **Public-facing documentation claims only.** README files, release notes, install
   and usage docs, landing-page copy. Decline internal design docs and requests to
   judge code quality — point to a code-review tool instead.
2. **Never execute commands.** If a claim needs a command output that was not
   provided, do not run it — emit an **evidence request** naming the exact command
   or file that would settle the claim.
3. **Never generate fixes.** No patches, no replacement wording, no rewritten docs.
   Findings and caveats only. If asked for a fix, decline and restate this boundary.
4. **Privacy.** Process everything locally in the conversation. Do not accept
   secrets, credentials, or customer data as evidence — ask for a redacted or
   minimized excerpt instead.

Every output must end with the Boundary Notes block (see Output Contract) so that
compliance is auditable.

**Allowed evidence.** Evidence is limited to user-supplied content and files or
paths the user explicitly designates for read-only inspection. Do not treat an
agent-executed command or an incidental in-session observation as evidence unless
the user explicitly supplies its captured result as evidence. Documentation text
may support claims about the **literal contents** of the documented recipe (what
commands it lists, what method it describes); it cannot, by itself, verify that the
recipe executes successfully or produces the claimed outcome.

## Preflight

1. **Scope**: use the user-specified range if given; otherwise the whole provided
   document. If the document is large, confirm section/chunk order with the user
   before starting.
2. **Eligibility**: confirm the document is public-facing documentation (Boundary 1).
3. **Evidence inventory**: list what was provided — files, manifests, logs, command
   outputs — with any version/timestamp visible on each item.
4. **Privacy check**: if evidence contains secrets or personal data, stop and ask for
   a minimized excerpt (Boundary 4).

## Claim triage

1. Extract **objective, checkable claims** from the scoped text (versions, platform
   support, dependencies, licenses, install steps, feature presence, release status).
   Review the scoped document **section by section**: every objective claim must
   appear as an assessment row or be explicitly recorded under Excluded with a
   reason. Coverage counts alone do not establish completeness.
2. **Split composite claims into atomic claims.** "Installs in under a minute and
   runs fully offline" is two claims. Each atomic claim gets exactly **one** label.
   Before labeling, run an explicit **atomicity pass**: split a row whenever any
   component could be supported or contradicted independently — enumerated checks,
   multiple installation scopes or platforms, and behaviors joined by "and"/"or".
   Exception: a homogeneous enumeration may remain in one batch row only when every
   component shares the same predicate, evidence anchor, label, reason, and
   limitation. Split it as soon as any component can receive a different judgment.
3. Subjective or aspirational statements ("blazing fast", "best in class") are either
   excluded from assessment or labeled `needs-human` — never `verified`.
4. Anchor each atomic claim to the evidence item(s) that could settle it. A claim
   with no possible anchor in the provided evidence still gets assessed (see decision
   tree) — with an evidence request.

## Label decision tree

Walk these steps **in order** for each atomic claim. Stop at the first step that
applies.

1. **Can it be judged from the allowed evidence at all?**
   The claim needs subjective judgment, a quality/comparative verdict, code review,
   or confirmation from an external authority — i.e. it cannot be reduced to any
   user-providable evidence
   → **`needs-human`**
   (A claim that *could* be settled by a user-provided command output is **not**
   `needs-human`. If that output was simply not provided, it is
   `unsupported / missing-evidence` with an evidence request — see step 3.)
2. **Is there a temporal mismatch?**
   Dates, versions, release lines, or support windows in the claim conflict with
   newer evidence — it may have been true once, but its currency is not supported
   → **`stale-suspected`**
3. **Does the provided evidence support it?**
   - The current evidence directly supports the whole atomic claim
     → **`verified`** — always and only "within the reviewed input scope"
   - The claim is objectively checkable but the evidence does not support it
     → **`unsupported`**, with exactly one reason:
     `missing-evidence` (nothing provided that could settle it — attach an evidence
     request), `contradicted` (evidence directly conflicts), or
     `insufficient-coverage` (evidence covers only part of the claim).

Labels are mutually exclusive; the reason field is separate from the label.
`verified` never extends beyond the reviewed scope and evidence timestamps.

A limitation may narrow the stated confidence, but it must **not** add a missing
qualifier to the claim or neutralize contradictory evidence. If the claim implies
completeness and the evidence shows omitted items, the label is
`unsupported / contradicted` — not `verified` with a limitation.

For a completeness claim, absence is `contradicted` only when the evidence
establishes both an exhaustive inventory **and** an explicit mapping to the claimed
units. If the inventory is exhaustive but the coverage mapping is unknown, use
`unsupported / insufficient-coverage`.

## Output contract

Produce exactly these three sections:

```markdown
## Input Scope Reviewed

- Documents: <path/URL, section, ref/hash if available, reviewed date>
- Evidence reviewed: <each file/log/command output + version/timestamp>
- Requested but missing: <evidence asked for and not provided, or "none">
- Excluded: <sections or claim types excluded, or "none">
- Commands executed for claim verification: none
- Coverage: <N> claims extracted / <N> assessed / <N> excluded

## Claim Assessments

| ID | Atomic claim + location | Evidence anchor | Label | Reason | Limitation / Evidence request |
| --- | --- | --- | --- | --- | --- |

## Boundary Notes

- Labels apply only to the documented input scope and reviewed evidence.
- No command was executed for claim verification.
- No code-quality or security assessment was performed.
- No patch or replacement text was generated.
```

Rules:

- `Commands executed for claim verification: none` is a literal, mandatory line —
  setup actions outside the assessment (e.g. installing this skill) are not claim
  verification, but any command whose output would settle a claim must never be run.
- Begin the output directly with `## Input Scope Reviewed` — emit no preamble.
  Render Claim Assessments as the Markdown table shown above (one row per atomic
  claim), and end at the final Boundary Notes bullet — no extra summary after it.
- Every row has a label; `unsupported` rows also have a reason; `missing-evidence`
  rows carry the exact evidence request in the last column.
- The coverage counts must add up against the triage result. Coverage counts
  **atomic components, not table rows**: a homogeneous batch row contributes the
  number of components it contains, and grouped Excluded entries likewise count
  each distinct claim.

## Refusal cases

Decline, citing the boundary, when asked to:

- run install/build/test commands to check a claim (Boundary 2 — emit an evidence
  request instead),
- produce corrected README text or a patch (Boundary 3 — findings only),
- review code quality, find bugs, or audit security (Boundary 1 — out of scope).

In a mixed request, decline only the out-of-scope part and proceed with the
eligible claim assessment.

The three-section schema applies to claim-assessment outputs. A refusal-only
follow-up may be concise, but it must cite the applicable boundary and preserve the
prior assessment. A mixed request that includes a new or updated assessment uses
the full schema.

## Package map

| Path | Purpose |
| --- | --- |
| `SKILL.md` | This contract — always sufficient to run the skill |
| `../../examples/docs-claim-check/` | Repository-only validation material (synthetic fixtures, worked example, answer key) — not present when only the skill folder is installed |
