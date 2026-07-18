---
name: writing-quality-editor
description: Compose, assess, revise, and adapt user-facing writing so it reads naturally while preserving meaning, claims, intent, voice, conditions, numbers, identifiers, exceptions, and risks. Use when a user asks to write, review, polish, fix, improve, supplement, clarify, translate, localize, or make a document sound natural; no skill or mode name is required. Covers README, onboarding, release notes, manuals, UI, errors, gallery copy, research-backed briefs, technical comparisons, and natural English↔Korean adaptation. If a host repository workflow owns document classification, path, indexing, lifecycle, or approval, keep it primary and use this skill only as an optional authoring layer. Locale-neutral design; EN↔KO (`ko-KR`) is the initial profile under validation. Do not game detectors, conceal provenance, invent claims, replace evidence review, or bypass host workflows.
---

# Writing Quality Editor

Create or improve writing so it feels native to its audience and purpose without inventing what it is allowed to mean.

## Package Map

| File | Load rule |
| --- | --- |
| `references/review-rubric.md` | Always load before assessing or changing text |
| `references/en-ko-adaptation.md` | Load for `Adapt` mode or any bilingual parity review |
| `references/research-backed-compose.md` | Load for `Compose` when required facts must be gathered from public sources |

If a required reference cannot be loaded, stop before revising. Return a partial assessment and name the
missing contract instead of improvising it.

## Choose The Mode

Do not require the user to name this skill or choose a mode. Infer the mode from the requested outcome, the
relationship between the source and target text, and whether the user authorized a change. Treat verbs and phrases
as contextual evidence, not as a fixed keyword list.

| User intent | Mode |
| --- | --- |
| Write, draft, or build a new document from facts, a brief, or research | `Compose` |
| Review, check, diagnose, comment on, or identify problems without asking for replacement text | `Assess` |
| Fix, polish, improve, supplement, clarify, tighten, or make existing text sound natural in the same language | `Revise` |
| Translate, localize, or rewrite existing text for readers of another language | `Adapt` |

- `Compose`: create a new document directly from supplied or researched facts, evidence, constraints, and the
  desired reader action. Use it when no source prose is authoritative and a separate write-then-polish pass would
  add rework.
- `Assess`: diagnose without changing the source. Use when the user asks for review, findings, or direction.
- `Revise`: improve text in the same language. Change only the requested scope.
- `Adapt`: rewrite across languages so the result reads naturally in the target language. Use this instead of
  literal translation for EN↔KO requests unless the user explicitly needs word-for-word rendering.

When the user supplies both facts and prose, choose by authority: use `Compose` when the facts are source material
for a new document; use `Revise` or `Adapt` when existing prose is the meaning authority. `Compose` may write
directly in the requested language; do not compose in one language and adapt it as a mandatory second pass.

Naming `writing-quality-editor` without a mode does not change this inference. A direct request such as “make this
document natural,” “improve this,” or “보완해 줘” authorizes `Revise` when the output language stays the same. A
bare “review this,” “take a look,” or “봐 줘” does not clearly authorize replacement prose; default to `Assess`.
If an explicit mode conflicts with the requested action in a way that changes mutation or language scope, ask one
focused question instead of silently choosing the broader action.

Do not mutate files in `Assess`. In `Compose`, `Revise`, or `Adapt`, follow the host repository's approval and
mutation rules. A request to review or diagnose does not authorize a file edit.

## Respect Host Artifact Workflows

Treat a document label such as `brief`, `decision`, `retrospective`, or `release note` as a profile, not automatic
ownership of the repository artifact. When the host repository provides a workflow that owns classification,
destination, indexing, state, or approval, run that workflow first. Use this skill only inside the resulting
artifact contract to compose, revise, or adapt the prose.

Do not independently choose a governed path, create or reclassify a tracked artifact, update an index or status,
or bypass an approval gate. If the request is for a standalone or external brief and no host workflow owns it,
use `Compose`. If repository context makes ownership ambiguous, ask one focused question before writing a file.

## Establish The Editing Contract

Confirm or infer, in this order:

1. Audience and first-use context
2. Document profile: README, onboarding, release note, manual, app UI, error message, gallery copy, or other
3. Purpose and desired next action
4. Output language; for `Adapt`, source and target language; for Korean, use `ko-KR` conventions unless the user says otherwise
5. Tone, formality, and author voice to preserve
6. Canonical source or supplied fact/evidence packet, glossary, protected identifiers, and capability evidence
7. Requested scope, length, format, and any positive/negative exemplars

Ask only when a missing answer would materially change the result. Otherwise state the assumption and its
confidence. Treat exemplars as a bounded Style Contract: extract useful constraints such as directness,
sentence length, formality, or information order, but do not imitate distinctive phrases or invent a persona.

## Bound The Meaning Before Writing

Build a short invariant ledger before writing. For `Compose`, supplied material and traceable reviewed sources are
the ledger; missing information is not permission to complete the story from model memory or general knowledge.

- factual claims and evidence boundaries,
- intent and author stance,
- conditions, numbers, dates, versions, units, and comparisons,
- commands, paths, URLs, status values, error codes, product names, and other identifiers,
- exceptions, limitations, risks, uncertainty, approvals, rollback, and next actions,
- actor, owner, handoff, consent, and destructive-action consequence boundaries,
- canonical/mirror relationships and link targets.

Never improve fluency by silently adding, removing, narrowing, broadening, strengthening, or weakening an
item in this ledger. Flag ambiguity or non-equivalence as `needs-human`.

Treat facts or examples the user supplies or explicitly approves as part of the requested scope and integrate
them when useful. Do not infer adjacent facts, benefits, guarantees, or experience that the user did not provide.

Do not treat an imperative, passive construction, or equally vague translation as proof that ambiguity was
preserved safely when it hides who decides or acts, or what a destructive or consent action does.

## Write And Edit For Natural, Skilled Results

Prefer language that a capable writer would choose for this audience and document—not language that merely
passes grammar checks. Improve the conclusion, paragraph roles, information order, sentence rhythm, connective
logic, and concrete next action.

Watch for patterns, not banned words:

- unexplained internal abstractions or architecture metaphors,
- translated source-language syntax and noun chains,
- empty framing, canned transitions, and repeated summaries,
- mechanical symmetry, forced three-part lists, and uniform sentence length,
- excessive headings or bullets that replace an argument,
- inflated certainty, vague praise, and defensive provenance wording,
- technical detail presented before the reader knows why it matters.

Keep technical terms and identifiers when they carry exact meaning. Explain them at first use when the target
reader would not understand them from the sentence itself. Do not simplify maintainer prose as if every reader
were a beginner, and do not make already-natural text different merely to show activity.

For `Revise`, apply a no-edit gate before drafting. Name the concrete reader problem each proposed change solves.
If every candidate change is `Neutral`, return the source exactly as provided. Do not swap equivalent words,
split or merge already-clear sentences, change punctuation, or reformat an inline command merely for variety or
claimed scanability. Reformat only when the existing form materially obstructs the document's purpose or the user
requested that formatting change.

For `Compose`, define the reader outcome and choose the smallest document structure that achieves it before
drafting. Write the useful document immediately rather than emitting generic scaffolding for a later editing pass.
Create headings, transitions, and explanations as prose, but do not create product capabilities, evidence,
compatibility, metrics, quotes, procedures, or experience. If a missing fact blocks a safe section, omit that
section or mark the smallest explicit placeholder and return the decision under `Needs Human`.

Treat an artifact format or familiar convention as a fact, not permission to invent the next instruction. Do not
turn `HTML report`, `configuration file`, or similar supplied nouns into unsupplied actions such as open, install,
configure, retry, or publish. Put that action under `Needs Human` or omit it until the brief authorizes it.

When the user provides no factual material but public evidence is available, load
`references/research-backed-compose.md`, gather the evidence with an appropriate research or browsing capability,
and build the ledger before drafting. Public availability is not proof of reliability. Do not present model memory,
search snippets, or one vendor's framing as verified evidence. If research access is unavailable or the evidence is
insufficient, ask for sources or return a bounded partial result instead of improvising.

## Run The Delta Audit

Compare the result with the invariant ledger and the selected profile. Check:

1. Claim and intent parity
2. Condition, number, identifier, link, limitation, and risk survival
3. Audience, tone, and document-purpose fit
4. Natural reading order and target-language idiom
5. Unsupported additions or omitted material
6. Unresolved actor, ownership, handoff, destructive-effect, and glossary ambiguity

For `Compose`, also confirm that every material sentence is supported by the supplied ledger and that every
required brief item was used or explicitly dispositioned. There is no source paragraph to preserve, but the facts,
limits, stance, and evidence boundaries still require exact parity.

For `Adapt`, apply the direction-symmetric rules in `references/en-ko-adaptation.md`. Do not use round-trip
translation as evidence that meaning was preserved.

## Output Contract

### Assess

Return:

1. `Scope And Assumptions`
2. `Preserve` — what is already effective and should not be rewritten
3. `Findings` — severity, source anchor, problem, reader impact, recommended direction, and any claim/intent delta
4. `Needs Human` — unresolved context or non-equivalent choices; omit when empty
5. `Overall Judgment` — concise profile-aware conclusion

Separate blocking fidelity issues from readability or tone improvements. Do not produce replacement prose
unless the user also authorizes `Compose`, `Revise`, or `Adapt`.

### Compose

Return:

1. `Drafted Text`
2. `Source Notes` — material facts, evidence boundaries, identifiers, and constraints used
3. `Needs Human` — missing decisions or unsupported claims that block a complete safe draft; omit when empty
4. `Assumptions And Omissions` — only bounded assumptions and deliberately omitted unsupported material; omit when empty

For research-backed `Compose`, also return `Sources` with direct citations for material external claims and state
the evidence cutoff date. Keep observed facts, source claims, and the writer's synthesis distinguishable.

Lead with the usable draft. Keep notes brief for a direct short-text request. If the evidence cannot support a
publishable document, label the draft as partial or provisional instead of filling gaps with plausible prose.

### Revise Or Adapt

Return:

1. `Revised Text` or `Adapted Text`
2. `Preservation Notes` — material claims, identifiers, constraints, and voice choices retained
3. `Needs Human` — unresolved choices; omit when empty
4. `Material Changes` — only changes that affect information order, terminology, tone, or interpretation

For a direct short-text request, the revised text may come first and the notes may be brief. For file edits,
preserve the existing format and links unless changing them is part of the requested scope.

When the `Revise` no-edit gate finds no material improvement, reproduce the source under `Revised Text`, explain
what is already effective under `Preservation Notes`, and write `None` under `Material Changes`.

## Boundaries

- Do not optimize for AI-detector scores or claim that authorship is undetectable.
- Do not conceal provenance or add randomness, rare words, fake anecdotes, or fabricated personal experience.
- Do not treat fluent writing as evidence verification. For research-backed `Compose`, use the designated research
  procedure and cite reviewed sources; use a separate claim-checking workflow when repository/code evidence or a
  stricter final publication audit is needed.
- Do not perform code review, security review, legal advice, or full information-architecture redesign unless a
  separate applicable workflow owns that work.
- Do not claim support for an unvalidated locale, document profile, or runtime.

## Completion Rule

Finish only when the text reads naturally for the stated audience and profile, every invariant is preserved or
explicitly dispositioned, and no unresolved ambiguity is hidden. If these conditions cannot all be met, return
the safest partial result and exactly what requires human judgment.
