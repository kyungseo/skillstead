---
name: writing-quality-editor
description: Writing Quality Editor (WQE) composes, assesses, revises, and adapts user-facing writing so it reads naturally while preserving meaning, claims, intent, voice, conditions, numbers, identifiers, exceptions, and risks. Use when a user asks to write, review, polish, fix, improve, supplement, clarify, translate, localize, or make a document sound natural; no skill or mode name is required. Covers README, onboarding, release notes, manuals, UI, errors, gallery copy, research-backed briefs, technical comparisons, and natural English↔Korean adaptation. If a host repository workflow owns document classification, path, indexing, lifecycle, or approval, keep it primary and use this skill only as an optional authoring layer. Locale-neutral design; EN↔KO (`ko-KR`) is the initial profile under validation. Do not game detectors, conceal provenance, invent claims, replace evidence review, or bypass host workflows.
license: LICENSE.txt
metadata:
  version: 0.14.1
---

# Writing Quality Editor

Create or improve writing for its intended reader and purpose while preserving what the material is allowed to mean.
Follow the user's request and the host workflow's ownership of files, approvals, document classification, and publication.

## Choose The Task

Do not require a mode name. Choose by the requested outcome and which material is authoritative.

| Requested outcome | Mode |
| --- | --- |
| A new text from facts, notes, a brief, or research | `Compose` |
| Findings or diagnosis without replacement text | `Assess` |
| Improvements to authoritative source prose in the same language | `Revise` |
| A source text rewritten for readers of another language | `Adapt` |

When both facts and prose are supplied, choose `Compose` only if they are material for a new document.
If the prose itself remains the meaning authority, use `Revise` or `Adapt`. A bare "review this" or "봐 줘"
does not authorize replacement prose; use `Assess`. Ask a focused question when explicit instructions conflict
about mutation or language scope. Do not silently choose the broader action.

## Load The Applicable Contract

All paths below are relative to the installed skill package root. Read the selected contract completely.

| Request | Contract |
| --- | --- |
| `Compose` with Korean output | `references/korean-compose.md` |
| `Assess`, every `Revise` or `Adapt`, or non-Korean `Compose` | `references/established-contract.md` and the applicable references it requires |
| `Compose` requiring public-source research | Also read `references/research-backed-compose.md` |
| Multi-paragraph `Compose`, document-level `Assess`, or justified structural `Revise` | Also read `references/reader-flow.md`; skip for local edits and short replies |

The Korean Compose contract is focused on supplied briefs; use the light reader-flow reference when routed above.
Do not load the established editing contract
or its full review rubric for that path. A request to polish existing Korean prose remains `Revise` and uses the
established contract; Korean output alone does not select the new-drafting path.

If a required contract cannot be read, identify the missing file before writing or editing instead of inventing
its rules. The established contract's resource paths also refer to the package root, not its own directory.

Do not invent facts, conceal provenance, optimize for detector evasion, replace evidence review, or bypass host workflows.
