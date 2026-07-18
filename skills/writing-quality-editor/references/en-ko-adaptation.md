# English-Korean Adaptation

Use this reference for `Adapt` mode and bilingual parity review. The initial localization profile under behavioral
validation is English↔Korean, with Korean output following `ko-KR` conventions.

## Adaptation Goal

Produce text that reads as if a skilled writer composed it directly for the target-language audience. Preserve
meaning, intent, voice, document purpose, claims, conditions, identifiers, limitations, risks, and next actions;
do not preserve source-language syntax merely because it is faithful word by word.

## Four-Pass Method

1. **Intent map**: identify the conclusion, reader, desired action, stance, constraints, and protected terms.
2. **Target-language plan**: choose natural information order, formality, sentence rhythm, explicit context, and
   document-profile conventions for the target reader.
3. **Rewrite**: translate meaning units, not sentence shells. Make only allowed transformations.
4. **Parity audit**: compare claims, intent, conditions, numbers, identifiers, links, limitations, risks, and actions.

## Allowed Transformations

Use these when they improve target-language comprehension without changing the invariant ledger:

- Split or merge sentences.
- Reorder context and conclusion.
- Replace an idiom, metaphor, or discourse marker with a natural target-language equivalent.
- Change active/passive voice or subject omission when target-language convention favors it and the change does
  not hide unresolved actor, ownership, handoff, consent, or consequence ambiguity.
- Make an implicit relationship explicit when the source assumes context the target reader will not have.
- Adjust honorifics, formality, punctuation, sentence length, and explanation density.
- Keep an English technical term and add a Korean explanation, or keep a Korean product term with an English gloss,
  when translating the term would reduce precision.

## Prohibited Transformations

- Add a benefit, guarantee, recommendation, limitation, or personal experience absent from both the source and
  material the user explicitly supplies or approves for integration.
- Remove an approval, exception, warning, uncertainty marker, rollback step, or unsupported-status label.
- Translate or normalize a command, path, URL, error code, version, product name, or other protected identifier.
- Narrow or broaden audience, scope, compatibility, frequency, obligation, or certainty.
- Resolve an ambiguous pronoun, actor, ownership relation, or canonical authority without evidence.
- Turn missing ownership into a second-person imperative, an unowned passive, or a generic runbook command when
  actor identity affects an approval, handoff, deployment, rollback, or audit trail.
- Finalize destructive or consent copy when the source leaves a material consequence unresolved, even when the
  target language can reproduce the same vague term faithfully.
- Make Korean more polite or English more assertive when that changes the source stance.

## English To Korean

- Replace long English noun chains with a natural predicate and explicit relationship.
- Choose subjects only when Korean needs them for actor or ownership clarity; do not repeat pronouns mechanically.
- Use Korean particles and connective endings to show causality, contrast, and conditions instead of copying English
  punctuation and clause order.
- Keep technical identities in English when that is the searchable or executable form, and explain them in Korean.
- Prefer direct Korean phrasing over transliterated architecture metaphors that make the reader reverse-engineer the source.

Example:

> Source: If the two surfaces diverge, this playbook is authoritative.
>
> Adapted: 두 문서의 내용이 서로 다를 경우, 이 playbook을 기준으로 판단합니다.

The adaptation names the actual relationship instead of preserving the internal metaphor `surfaces`.

## Korean To English

- Supply an explicit subject when English needs one, but do not invent an owner. An imperative or passive voice is
  safe only when context establishes a single acting audience and no ownership or approval handoff is unresolved.
- Turn stacked Korean nominalizations into verbs and shorter clauses.
- Replace Korean connective endings with the clearest logical relation rather than chaining every sentence with
  “and,” “so,” or “however.”
- Preserve the original formality and strength. Korean `권장`, `필수`, and `가능` must not all become “should.”
- Explain a Korean organizational or workflow term when no direct English equivalent exists.

Example:

> Source: 두 문서의 내용이 서로 다를 경우, 이 playbook이 기준입니다.
>
> Adapted: If the two documents conflict, follow this playbook.

The English sentence is shorter and action-oriented while preserving the authority rule.

## Non-Equivalence And Ambiguity

Return `needs-human` when a choice can materially change meaning or voice, including:

- one source term maps to several target terms with different obligations or audiences,
- the actor or canonical owner is implicit and cannot be recovered,
- an actorless procedure crosses approval, deployment, rollback, or record-keeping boundaries that may belong to
  different roles,
- destructive or consent copy states that something “may affect” another resource without establishing whether it
  is deleted, disconnected, retained, or otherwise changed,
- humor, wordplay, cultural references, or brand voice has no safe equivalent,
- the source is internally inconsistent,
- a requested target tone conflicts with a warning, approval, or legal/operational boundary.

Show the smallest relevant source span, two or three viable options, and the tradeoff. Do not hide the decision
inside a fluent-looking sentence.

For destructive or consent surfaces, preserving the source's vague wording is not enough by itself. Return the
copy as provisional, identify the unresolved consequence, and do not finalize the action label or warning until
the product behavior is known.

## Parity Is Not Sameness

Do not require the same sentence count, heading count, punctuation, or word order. Require the same material
meaning and action. A natural adaptation may look structurally different while remaining faithful; a literal
translation may look similar while still misleading the target reader.
