<!-- 한국어: [README.ko.md](./README.ko.md) -->

# Skillstead

Small, practical skills you install into Claude Code, one at a time.

Community project, not affiliated with Anthropic's official Agent Skills.

> [!TIP]
> **Skillstead = skill + homestead.** The name points to a small, durable place for practical Claude Code skills, starting with `svg-infographic`.

The first skill, [`svg-infographic`](./skills/svg-infographic), helps Claude Code turn architecture notes, migration plans, process flows, decision matrices, and technical concepts into editable SVGs and crisp 2x PNGs for docs, decks, and social posts.

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
| Decision and priority matrices | 2×2 quadrant maps, scope/uncertainty grids, trade-off views |
| Korean-ready share images | CJK-safe SVG + PNG output for docs and social posts |

See the full [example gallery](./examples/svg-infographic) for eight examples across several archetypes — architecture, migration, workflow, decision matrix, and more — in English and Korean, with the prompts that produced them.

## Quick Start

Install the first skill for Claude Code:

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/svg-infographic ~/.claude/skills/
```

Or install it **per project** (`.claude/skills/` in a repo, so your team gets it on clone). Project-scoped install, Windows PowerShell, pinned versions, update, and uninstall are in [`docs/INSTALL.md`](./docs/INSTALL.md).

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

Starting with one practical skill. More skills can be added when they meet the same evidence and example bar.

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
