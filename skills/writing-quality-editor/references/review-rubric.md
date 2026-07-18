# Review Rubric

Use this rubric for every mode. Weight it by document profile instead of applying every axis mechanically.

## Severity

| Severity | Meaning |
| --- | --- |
| Blocking | Meaning, claim, instruction, identifier, condition, risk, or authority changed; or the text could cause a wrong action |
| Major | The target reader is likely to misunderstand the point, miss a necessary action, or distrust the text |
| Minor | The meaning is safe, but tone, rhythm, wording, or local clarity can improve |
| Neutral | The text differs from the editor's preference but is acceptable for the stated audience and profile; preserve it unless the user asks for that stylistic change |

Record `Neutral` observations under `Preserve`, not as defects. This distinction is the primary guard against
over-editing and preference-driven churn.

## Review Axes

### Semantic Fidelity

- Preserve factual claims, intent, stance, conditions, numbers, comparisons, exceptions, limitations, risks, and uncertainty.
- Mark additions or omissions explicitly. Naturalness never excuses a semantic change.
- Distinguish fact, inference, hypothesis, decision, proposal, and aspiration.

### Naturalness And Voice

- Make the prose sound native to the audience, medium, and formality level.
- Remove source-language syntax, translationese, canned transitions, unnecessary restatement, mechanical symmetry,
  uniform sentence rhythm, and generic praise.
- Preserve a coherent author voice. Do not flatten everything into one neutral corporate tone.
- Leave already-natural text alone unless a material improvement is available.

### Plain-Language Accessibility

- Lead with the conclusion, user value, or purpose before internal machinery.
- Explain an internal abstraction, metaphor, or technical term at first use when the reader cannot recover its
  meaning from the sentence itself.
- Preserve commands, paths, codes, status values, and product identities exactly.
- Treat easy writing as information design, not information deletion.

### Argument And Information Flow

- Give each paragraph one main role.
- Prefer conclusion → reason/evidence → boundary/limitation → next action when the profile benefits from it.
- Use bullets for actual sets, choices, or steps—not to avoid causal explanation.
- Do not force a template when a shorter natural paragraph is clearer.

### Actionability

- Make the next action, owner, prerequisite, success/failure signal, and recovery visible when relevant.
- Do not bury the first decision path inside details, appendices, or maintainer internals.
- Keep operational risks and approval boundaries even when shortening.

### Terminology And Identifier Safety

- Follow an explicit glossary and keep terminology consistent.
- Preserve exact identifiers and technical terms when precision or searchability matters.
- Translate user-facing explanations around an identifier rather than translating the identifier itself.
- Report a glossary delta when the revision changes a term that appears to be canonical.

### Bilingual And Canonical Parity

- Compare sections, claims, conditions, risks, identifiers, links, limitations, and next actions—not sentence count.
- Identify the current source/authority before judging a bilingual pair.
- Do not infer fidelity from round-trip translation.
- If canonical and mirror text conflict, report the conflict and the applicable authority rule; do not merge them silently.

## Document Profiles

### README

Prioritize identity, reader problem, concrete value, shortest success path, support boundary, limitation, and next
document. Keep repository architecture and maintainer process after the reader understands why the product matters.

### Onboarding

Prioritize current state, the next safe step, what the user decides, what the agent/system does, completion state,
failure state, and recovery. Follow the order in which a new user encounters the work.

### Release Note

Prioritize user-visible outcome, what changed, who is affected, required action, observed evidence, compatibility,
limitations, and detail links. Exclude internal Work IDs, raw review logs, and implementation noise unless the
release audience needs them.

### Manual Or Runbook

Prioritize purpose, prerequisites, ordered steps, branches, success/failure criteria, rollback/recovery, and
escalation. Preserve technical precision; a maintainer runbook may remain technical.

### App UI

Prioritize the user's current state and next action. Keep labels concise and consistent with platform conventions.
Do not trade clarity for personality or silently change the strength of a consent, warning, or destructive action.

### Error Message

Preserve the stable error code and safe diagnostic identity. Explain what happened and what the user can do next.
Do not leak secrets or internal exception detail. Locale-specific message text may change; the code and contract do not.

### Gallery Or Example Copy

Prioritize one clear message, artifact identity, what the example demonstrates, and honest provenance/support labels.
Keep captions readable at their actual display size. Do not imply that a curated subset is exhaustive.

## Borderline Tests

- A defined term such as `atomic parity` is not a problem when its first use explains that both language versions
  change in the same pull request.
- A command such as `git diff --check` must not be translated; explain its purpose around it.
- A compact maintainer note is not automatically too technical. Judge it against the maintainer audience.
- A repeated phrase is not automatically AI-like. Flag it only when it weakens flow, tone, or reader trust.
