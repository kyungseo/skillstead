<!-- 한국어: [README.ko.md](./README.ko.md) -->

# svg-infographic

Create flat, structured technical visuals in Claude Code: architecture diagrams, cloud topologies, process flows, before/after comparisons, roadmaps, and share-ready infographics.

The skill writes an editable SVG first, then exports a crisp 2x PNG when a Chromium-based browser is available.

## Best For

- Architecture and topology diagrams from text notes
- Technical one-pagers for docs, decks, and social posts
- Migration or modernization before/after visuals
- Process, data, or request-path flows
- Korean/CJK diagrams that must render correctly

## Example Prompts

```text
Use svg-infographic to draw this cloud architecture as a clean topology diagram:
Application Gateway -> APIM -> AKS -> PostgreSQL.
```

```text
Use svg-infographic to turn this monolith-to-microservices plan into a before/after infographic.
```

```text
Use svg-infographic to make a Korean 4:5 social infographic explaining these four layers.
```

## Output

The skill proposes an output directory inside your current project before writing files.

- `*.svg` — editable source of truth
- `*.png` — 2x render for docs, slides, and social sharing

## Style Defaults

By default, the output uses:

- light background
- muted technical palette
- rounded structural cards and panels
- simple line icons in soft tinted circles
- CSS variables collected in one place
- Korean/CJK-safe font stack: Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif

Before drawing, the skill tells you these defaults and gives you a chance to change ratio, language, brand color, theme, or output format.

## Install

Copy this folder into a Claude Code skills directory — either **global** (`~/.claude/skills/`, available in all your projects) or **project** (`.claude/skills/` in a repo, so your team gets it on clone):

```text
<skills-dir>/svg-infographic/SKILL.md
```

GitHub install commands (global and project scope) for macOS, Linux, and Windows are in [../../docs/INSTALL.md](../../docs/INSTALL.md).

## Examples

Browse the full gallery:

**https://github.com/kyungseo/agent-skills/tree/main/examples/svg-infographic**

It includes English and Korean examples for topology, layer/onion models, before/after comparison, process flow, roadmap, and a self-demo.

## Boundaries

Use this skill for flat, structural visuals. It is not designed for:

- photo-heavy or illustration-heavy marketing graphics
- statistical charts such as bar, line, scatter, or heatmap charts
- hand-drawn/crayon sketchnote styles
- mascots, character art, or custom illustration

If PNG export is unavailable, the skill still delivers SVG and states the limitation.
