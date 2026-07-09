<!-- 한국어: [README.ko.md](./README.ko.md) -->

# Skillstead

Practical, portable skills for agentic coding workflows.

> [!TIP]
> **Skillstead = skill + homestead.** The name points to a small, durable place for practical skills that coding agents can use, starting with `svg-infographic`.

The first release supports Claude Code. The first skill, [`svg-infographic`](./skills/svg-infographic), turns architecture notes, migration plans, process flows, decision matrices, and technical concepts into editable SVGs and crisp 2x PNGs for docs, decks, and social posts.

[![svg-infographic example gallery](./examples/svg-infographic/gallery-preview.en.png)](./examples/svg-infographic)

## Why This Exists

Claude can make good visuals in chat, but Claude Code works inside a repository, where a useful diagram needs to become an actual asset. You want an SVG that drops straight into docs and HTML pages and is easy to reuse in PPTX/slide workflows, plus a PNG preview/export when you need a share image.

`svg-infographic` gives the agent a focused workflow for those assets. It keeps the output flat, structured, source-controlled, and checked so Korean/CJK text does not fall apart at render time.

## What You Can Create

| Use case | Example |
| --- | --- |
| Architecture and cloud topology | Azure / AWS style request paths, zones, services, databases |
| Technical infographics | Layer models, capability maps, one-page explainers |
| Before / after comparisons | Migration plans, modernization stories, tradeoff panels |
| Process and data flows | RAG pipelines, approval flows, system handoffs |
| Roadmaps and timelines | Product phases, milestones, status snapshots |
| Decision and priority matrices | 2×2 quadrant maps, scope/uncertainty grids, trade-off views |
| Korean-ready visual assets | CJK-safe SVG for docs, HTML, and slide decks; PNG for previews and social posts |

See the full [example gallery](./examples/svg-infographic) for ten examples across several archetypes — architecture, migration, workflow, decision matrix, CI/CD promotion, approval flow, and more — in English and Korean, with the prompts that produced them. The preview above is a curated six-example montage.

## Quick Start

Install the current Claude Code package:

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/svg-infographic ~/.claude/skills/
```

Or install it **per project** (`.claude/skills/` in a repo, so your team gets it on clone). Project-scoped install, Windows PowerShell, pinned versions, update, and uninstall are in [`docs/INSTALL.md`](./docs/INSTALL.md).

Then ask your Claude Code agent for a visual:

```text
Use svg-infographic to draw an Azure topology: Application Gateway -> APIM -> AKS -> PostgreSQL.
```

```text
Use svg-infographic to turn this before/after migration plan into a technical infographic for a slide.
```

For better results, include the audience, key message, intended use, and whether you want SVG only or SVG + 2× PNG.

The skill produces:

- `*.svg` — the primary deliverable: editable vector content for docs, HTML, and PPTX workflows
- `*.png` — a crisp 2× preview/export for sharing, thumbnails, and social posts

**2× PNG** means the PNG is rendered at twice the SVG `viewBox` size, so it stays crisp when embedded, previewed, or shared.

## Skill Catalog

Starting with one practical skill. More skills can be added when they meet the same evidence and example bar.

| Skill | Supported runtime | Status | What it does |
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

Skillstead is intended as a multi-agent skill catalog. The v0.1.0 release is Claude Code first because that install path and the browser-based PNG export workflow are verified there. Codex / Codex CLI and other agent runtimes are deferred until there is confirmed demand and the export path is verified in those environments.

`svg-infographic` is for flat, structural visuals. It intentionally does not target photo-heavy marketing graphics, statistical charts, hand-drawn/crayon styles, or mascot/character illustration.

## License

[Apache-2.0](./LICENSE).
