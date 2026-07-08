<!-- 한국어: [README.ko.md](./README.ko.md) -->

# Agent Skills

Reusable skills for AI coding agents, starting with one practical gap: making clean technical visuals from plain text.

The first skill, [`svg-infographic`](./skills/svg-infographic), helps Claude Code turn architecture notes, migration plans, process flows, and technical concepts into editable SVGs and crisp 2x PNGs for docs, decks, and social posts.

[![svg-infographic example gallery](./examples/svg-infographic/gallery-preview.en.png)](./examples/svg-infographic)

## Why This Exists

Claude can produce good visual artifacts in chat, but Claude Code often works inside a repository where you need files: an SVG you can edit, a PNG you can share, and a repeatable style that does not fall apart when the diagram has Korean or CJK text.

`svg-infographic` gives Claude Code a focused workflow for those artifacts. It keeps the output flat, structured, and source-controlled.

## What You Can Create

| Use case | Example |
| --- | --- |
| Architecture and cloud topology | Azure / AWS style request paths, zones, services, databases |
| Technical infographics | Layer models, capability maps, one-page explainers |
| Before / after comparisons | Migration plans, modernization stories, tradeoff panels |
| Process and data flows | RAG pipelines, approval flows, system handoffs |
| Roadmaps and timelines | Product phases, milestones, status snapshots |
| Korean-ready share images | CJK-safe SVG + PNG output for docs and social posts |

See the full [example gallery](./examples/svg-infographic) for six archetypes in English and Korean, with the prompts that produced them.

## Quick Start

Install the first skill for Claude Code:

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p ~/.claude/skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

Windows PowerShell, pinned versions, update, and uninstall instructions are in [`docs/INSTALL.md`](./docs/INSTALL.md).

Then ask Claude Code for a visual:

```text
Use svg-infographic to draw an Azure topology: Application Gateway -> APIM -> AKS -> PostgreSQL.
```

```text
Use svg-infographic to turn this before/after migration plan into a technical infographic for a slide.
```

The skill produces:

- `*.svg` as the editable source of truth
- `*.png` as a 2x export for sharing, slides, and social posts

## Skill Catalog

| Skill | Agent | Status | What it does |
| --- | --- | --- | --- |
| [`svg-infographic`](./skills/svg-infographic) | Claude Code | Beta | Creates flat, structured SVG infographics and exports PNGs. |

## Quality Bar

The included examples are synthetic, non-client artifacts. Each ships as SVG + 2x PNG and is checked for:

- no text overflow
- correct Korean/CJK rendering
- matching SVG/PNG dimensions
- accessible SVG metadata
- no host-specific or client paths

## Current Scope

This repo is Claude Code first. Codex / Codex CLI support is deferred until there is confirmed demand and the browser-based PNG export path is verified there.

`svg-infographic` is for flat, structural visuals. It intentionally does not target photo-heavy marketing graphics, statistical charts, hand-drawn/crayon styles, or mascot/character illustration.

## License

[Apache-2.0](./LICENSE).
