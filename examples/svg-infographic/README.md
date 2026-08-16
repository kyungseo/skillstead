# Examples — svg-infographic

**English** · [한국어](./README.ko.md)

A technical index of the artifacts checked into this repository. It is not a gallery — for browsing what the
skill produces, open the **[gallery](../../gallery/index.html)**, which is generated from these same files and
states the evidence each one carries.

What lives here, and what each class is proved to:

| Class | Path | Evidence |
| --- | --- | --- |
| Canonical TypePack artifacts | [`typepacks/`](./typepacks) | Built by `generate.mjs` with a receipt; source lint and layout pass; the current palette profile reports **zero errors** against a pinned warning debt of 9 colours / 52 occurrences; `generate.mjs verify` re-measures each against its receipt |
| Transitional legacy examples | the directories below | Source lint, layout and typography only. No receipt — they predate the TypePack contract |
| Historical release asset | [`release-announcement/`](./release-announcement) | Frozen at publication. Kept as a record, not maintained against current contracts |

## Canonical TypePack artifacts

Nine types, each in English and Korean, with a receipt beside every artifact. These are the regression surface:
a change to the package that alters what they draw shows up here first.

```text
typepacks/<type>/<type>.{ko,en}.svg    # source
typepacks/<type>/<type>.{ko,en}.png    # exact 2× export
typepacks/<type>/<type>.{ko,en}.json   # receipt: what was consumed, measured, and which package built it
```

`approval-gate` · `before-after` · `cards-kpi-grid` · `decision-matrix` · `layer-stack` · `nested-scope` ·
`process-flow` · `roadmap-timeline` · `topology-component`

Request phrasing and the build command for each type are in
[`references/PROMPT-GALLERY.md`](../../skills/svg-infographic/references/PROMPT-GALLERY.md).

## Transitional legacy examples

Made before the TypePack contract, kept because they cover request shapes the canonical set does not yet reach.
Six of them are the gallery's current featured selection (marked ★) and are **due for replacement in Wave 2** —
a retained entry migrates to the then-current contracts or is dropped.

Each directory holds the source SVG, its 2× PNG in both languages, and the prompt that produced it.

| Directory | |
| --- | --- |
| [`agent-system-sketch`](./agent-system-sketch) | ★ sketch preset |
| [`agent-task-matrix`](./agent-task-matrix) | ★ |
| [`agent-waiting-swimlane`](./agent-waiting-swimlane) | ★ |
| [`before-after-migration`](./before-after-migration) | ★ |
| [`cloud-infra-topology`](./cloud-infra-topology) | ★ |
| [`zero-trust-onion`](./zero-trust-onion) | ★ |
| [`ai-code-review-loop`](./ai-code-review-loop) | |
| [`ci-cd-artifact-promotion`](./ci-cd-artifact-promotion) | |
| [`incident-response-sketch`](./incident-response-sketch) | sketch preset |
| [`issue-tracker-cicd-approval-flow`](./issue-tracker-cicd-approval-flow) | |
| [`process-flow`](./process-flow) | |
| [`roadmap`](./roadmap) | |
| [`skill-overview`](./skill-overview) | |
| [`technical-infographic`](./technical-infographic) | |

Every one was created for this repository from synthetic, non-client, non-confidential content.

## Historical release asset

[`release-announcement/`](./release-announcement) holds the graphic published with `v0.8.0`. It is frozen at the
state it was published in and is not re-verified against current contracts; the Windows claim on that card refers
to the recorded Windows 11 ARM64 VM Codex App run, not every Windows environment.

## What each class is checked for

Stated per class rather than as one claim over everything.

**Canonical TypePack artifacts** — source lint reports zero errors. Against the current palette profile they
carry **zero errors and a pinned warning debt of 9 colours across 52 occurrences** — steps the profile cannot yet
express, fixed by colour, pack and count so the debt cannot grow or move unnoticed. Layout containers, bindings
and reservations are re-measured; PNG is exactly 2× the SVG viewBox; the receipt is re-verified against the
artifact, so an entity it counts but the drawing never shows is an error.

**Transitional legacy examples** — source lint, layout and typography pass. They are not measured against the
current palette profile and carry no receipt.

**Canonical TypePack artifacts and transitional legacy examples** (not the historical release asset, which is
frozen) — no text overflow, no tofu in Korean/CJK, `<title>`/`<desc>` present, no host-specific or client paths,
icons resolve, paired boxes keep visible gutters.

## Runtime and rendering evidence

The canonical [`scripts/render.mjs`](../../skills/svg-infographic/scripts/render.mjs) requires Node.js 18+, runs
source lint before rendering, discovers a Chromium-based browser, and verifies the exported PNG dimensions. It
runs directly from Bash, PowerShell, or CMD; Git Bash is not required. The optional
[`scripts/render.sh`](../../skills/svg-infographic/scripts/render.sh) wrapper delegates to the same renderer.

Installing and discovering the skill does not require Node. If Node 18+ is unavailable, the agent asks before
installing it. A declined install keeps the full manual source check and direct Chromium 2× render/visual-QA path
documented in [`references/authoring.md`](../../skills/svg-infographic/references/authoring.md) §8.

| Environment | Browser | en/ko SVG → 2× PNG | Status |
| --- | --- | --- | --- |
| macOS | Chrome (headless) | the paired legacy examples + fresh Claude Code/Codex briefs | ✅ verified — exact 2×, no tofu, material parity |
| Windows 11 ARM64 VM | Chrome | fresh Codex App actual bilingual fixture | ✅ verified — install, discovery, correction, exact 2× render |
| Linux / WSL | Chrome / Chromium | documented canonical and manual paths | ⏳ render verification pending (install Noto Sans CJK/KR for Korean) |

The Windows result applies to the recorded VM configuration and does not claim every Windows machine or
filesystem. Linux rendering remains documented but unverified.

## Scope

Flat, structural technical diagrams, plus the opt-in **sketch preset** ("tidy hand-drawn" — hand-drawn
appearance, computed layout). Mascots, character art, and scene illustration remain **out of scope**; keeping
that boundary is what makes the output consistent.
