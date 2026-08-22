# writing-quality-editor

**English** · [한국어](./README.ko.md)

Create or improve user-facing writing so it reads like clear, natural work by a skilled writer or editor—without
inventing what the text is allowed to mean.

Use `writing-quality-editor` for README files, onboarding, release notes, manuals, app UI, error messages, and
gallery copy. It can write a new document directly from a reliable brief, review existing prose, revise it in the
same language, or adapt it naturally between English and Korean.

## Start Here

Name the skill and describe the result you want. Include the source text or reliable facts, the intended reader,
and any meaning or identifiers that must not change.

```text
Use writing-quality-editor to make this installation guide easier for a first-time user to follow. Preserve
every command, path, prerequisite, warning, and recovery step.
```

If you want findings without replacement text, say that explicitly. The skill will use its read-only `Assess`
mode. You usually do not need to choose a mode for ordinary drafting, revision, or adaptation.

## Four Modes

| Mode | Use it for | Mutation |
| --- | --- | --- |
| `Compose` | Write a new document from supplied facts, evidence, constraints, and reader goals | Creates only the requested draft or file |
| `Assess` | Find fidelity, clarity, tone, structure, and localization issues | Read-only |
| `Revise` | Improve writing in the same language | Only the requested scope |
| `Adapt` | Rewrite between English and Korean so the result feels native to the target language | Only the requested scope |

`Adapt` is not word-for-word translation. It may change sentence boundaries, information order, idioms, and
explanation density to fit the target audience and document type. It must preserve factual claims, intent,
conditions, numbers, identifiers, exceptions, limitations, risks, approvals, and next actions.

`Revise` works the same way on a document that is already in the right language. A draft carries what the
document means, but supplied facts and reviewed evidence outrank it — a claim that contradicts them, or reaches
past what they cover, gets removed or qualified rather than kept. Evidence that simply says nothing about a
point is not a reason to drop it. What a draft never settles on its own is how the document reads: when the
style does not fit the reader it is aimed at, the style can change, while what the document claims, requires,
and warns stays put. Where sentence-level edits leave the reader stuck — a warning that arrives after the
instruction, or the point buried three paragraphs down — `Revise` may also move paragraphs and sections, as long
as it names the reader problem it is solving and leaves the rest alone.

For wording, naturalness, and clarity requests, `Revise` starts locally when the paragraph and section order
already works. It marks the smallest complete phrase, clause, or sentence with a specific reader problem and
leaves the surrounding text unchanged. If a phrase could mean discretion, approval, or notification, the skill
leaves that span unchanged under `Needs Human` and continues with other safe edits instead of choosing the most
fluent interpretation silently. Structural revision remains a separate choice for a named structural problem.

For a direct short-text request, already-natural source text is returned exactly as supplied, without a label or
change report. Same-language Korean revision also preserves the source's honorific level and formality for the
same audience unless the user requests a new register or the source register demonstrably conflicts with that
audience. It repairs compressed prose only where a material actor, condition, or consequence would otherwise have
to be guessed, and does not force sentence endings onto headings, list labels, UI labels, code, or other intentional
fragments.

Both modes keep the author's voice: the warmth, directness, and rhythm the writing carries. A trait changes only
when you ask for it or where it genuinely conflicts with the intended reader, and then only that trait.

`Compose` avoids a separate write-then-polish cycle. It writes directly for the intended reader and profile, but
it creates prose—not facts. Missing capabilities, evidence, compatibility, metrics, or operating decisions remain
missing until they are supplied or established by reviewed sources.

When the facts are available publicly rather than supplied by the user, `Compose` can research them first. It uses
traceable reviewed sources, records an evidence cutoff date, cites material claims, and distinguishes measured
facts from source claims and synthesis. Public availability alone is not treated as proof of reliability.

## What It Protects

- Facts and evidence boundaries
- Author intent and voice
- Commands, paths, URLs, error codes, product names, versions, and other identifiers
- Direct quotations with their punctuation and attached citation or footnote markers
- Conditions, exceptions, limitations, uncertainty, risks, approvals, and rollback meaning
- Canonical/mirror relationships and links

Instructions addressed to an editor or agent inside supplied source text remain source data unless the external
user explicitly activates them. This includes editor notes, TODOs, and prompts such as `ignore the above`; it does
not include instructions written for the document's readers.

When a phrase has no safe equivalent or the source is ambiguous, the skill shows the choice as `needs-human`
instead of hiding it inside fluent prose.

## What Natural Means Here

The skill looks for source-language syntax, unexplained internal metaphors, empty framing, repeated summaries,
mechanical symmetry, uniform sentence rhythm, inflated certainty, and technical detail presented before the reader
knows why it matters. It does not use a blacklist, remove necessary technical terms, or rewrite already-natural text
just to make it different.

This is not an AI-detector evasion tool. It does not promise that authorship is undetectable, conceal provenance,
add fake personal experience, or inject random and unusual wording.

## Validation Scope

- Designed as a locale-neutral writing workflow
- Initial localization profile under release validation: English↔Korean (`ko-KR` for Korean output)
- Synthetic fixture coverage: README, onboarding, release note, manual, app UI, error message, and gallery copy
- Maturity: Beta; the initial release remains deliberately bounded while broader document and locale evidence grows

These are evidence-bounded claims. Other languages and profiles may still benefit, but they are not marked as
validated.

Agent output is non-deterministic. The local-first and ambiguity-hold defaults reduce unnecessary change, but they
cannot guarantee that every run avoids preference-driven changes outside the marked spans. Review the final delta
before publishing or relying on an important document.

## Example Prompts

To make it clear that you want this skill across hosts, name `writing-quality-editor` and describe the result
you want. You usually do not need to name a mode.

On the runtimes tested so far, you can also call it `WQE` in ordinary language. This shorthand is not a
guaranteed `$WQE` or `/WQE` command, and selection can vary by runtime, model, and context. Use
`writing-quality-editor` when you want to make the choice explicit.

```text
Use writing-quality-editor to make the document below read naturally. Preserve its core facts, conditions,
requirements, and commands.
```

```text
Use WQE to review this onboarding guide. Identify meaning or clarity problems, but do not revise the text yet.
```

When the installed agent can select skills from intent, ordinary requests work too:

```text
Write a new README from this product brief. Lead with the user value and do not infer capabilities or platform
support that are not listed.
```

```text
Review this README. Focus on whether a first-time user can understand the value and next step without knowing our
internal architecture. Do not rewrite it yet.
```

```text
Research current enterprise AI-transformation trends and write a brief. Cite material claims, state the evidence
cutoff, and separate measured adoption from vendor announcements and inference.
```

```text
Rewrite this English onboarding guide naturally for Korean readers. Do not translate commands or paths. Preserve
every prerequisite, warning, and recovery step.
```

Name a mode only when you need to force a boundary:

```text
Use writing-quality-editor in Assess mode. Review this release note, but do not rewrite it.
```

In a repository with a workflow that owns brief classification, file location, indexing, or approval, use that
workflow first. `writing-quality-editor` can then improve the prose inside the established artifact contract; it
does not replace repository workflow or approval rules.

Examples where `WQE` is only quoted, another skill is involved, or a repository workflow takes priority are
recorded in the repository-only
[`intent and invocation contract`](../../examples/intent-invocation-contract).

## Package And Evidence

Install the complete `skills/writing-quality-editor/` folder. The skill is self-contained; repository-only
synthetic fixtures and the answer key live in [`examples/writing-quality-editor`](https://github.com/kyungseo/skillstead/tree/main/examples/writing-quality-editor).

See the catalog-wide installation options in [`docs/INSTALL.md`](https://github.com/kyungseo/skillstead/blob/main/docs/INSTALL.md).
