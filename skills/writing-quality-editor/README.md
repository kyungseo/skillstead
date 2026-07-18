# writing-quality-editor

**English** · [한국어](./README.ko.md)

Create or improve user-facing writing so it reads like clear, natural work by a skilled writer or editor—without
inventing what the text is allowed to mean.

Use `writing-quality-editor` for README files, onboarding, release notes, manuals, app UI, error messages, and
gallery copy. It can write a new document directly from a reliable brief, review existing prose, revise it in the
same language, or adapt it naturally between English and Korean.

## Four Modes

| Mode | Use it for | Mutation |
| --- | --- | --- |
| `Compose` | Write a new document from supplied facts, evidence, constraints, and reader goals | Creates only the requested draft or file |
| `Assess` | Find fidelity, clarity, tone, structure, and localization issues | Read-only |
| `Revise` | Improve writing in the same language | Only the requested scope |
| `Adapt` | Rewrite between English and Korean so the result feels native to the target language | Only the requested scope |

`Adapt` is not word-for-word translation. It may change sentence boundaries, information order, idioms, and
explanation density to fit the target audience and document type. It must preserve factual claims, intent, voice,
conditions, numbers, identifiers, exceptions, limitations, risks, approvals, and next actions.

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
- Conditions, exceptions, limitations, uncertainty, risks, approvals, and rollback meaning
- Canonical/mirror relationships and links

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

## Example Prompts

For the most predictable selection across hosts, name the skill and state the outcome naturally. You do not need
to name a mode.

```text
Use writing-quality-editor to make this document sound natural without changing its facts, commands, or intent.
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

## Package And Evidence

Install the complete `skills/writing-quality-editor/` folder. The skill is self-contained; repository-only
synthetic fixtures and the answer key live in [`examples/writing-quality-editor`](../../examples/writing-quality-editor).

See the catalog-wide installation options in [`docs/INSTALL.md`](../../docs/INSTALL.md).
