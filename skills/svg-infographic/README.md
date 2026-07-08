<!-- 한국어: [README.ko.md](./README.ko.md) -->

# svg-infographic

Create flat, structured technical visuals for agentic coding workflows: architecture diagrams, cloud topologies, process flows, before/after comparisons, roadmaps, and share-ready infographics. The current package is authored for Claude Code.

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

## Detailed Example

Use a longer prompt when you want the skill to make layout decisions, choose an archetype, and verify the output.

```text
Use svg-infographic to create a technical infographic from the content below.

Topic: AI code review loop

Goal:
- Show the flow from a developer opening a PR, to an AI agent reviewing it, to a human reviewer approving it, to changes being patched and verified.
- Make it a clean flat technical infographic suitable for docs, slides, or a social post.

Content:
1. Developer opens PR
   - code changes
   - test results attached
2. AI Review Agent
   - analyze diff
   - flag risky areas
   - check missing tests
3. Human Reviewer
   - inspect comments that need judgment
   - filter false positives
4. Patch & Verify
   - apply fixes
   - rerun tests
5. Merge Ready
   - approved
   - PR merge

Visual direction:
- Use a left-to-right process flow.
- Put each step in a rounded card.
- Add a simple line icon to each card.
- Highlight the AI Review Agent step with an accent color.
- Add a small legend at the bottom:
  - solid arrow = normal path
  - dashed arrow = feedback loop

Output:
- Propose an output directory inside the current project and ask before writing files.
- Create both the SVG source and a 2x PNG.
- Use the skill defaults for style, font, and colors, but tell me before drawing that I can change them.
```

## Before Generation

When you run it, the skill shows defaults like the table below before writing files, then tells you what you can change. This makes the result predictable and gives you a chance to adjust the style before files are written.

| Item | Default | You can change |
| --- | --- | --- |
| Style | flat / muted technical, light background | dark mode |
| Icons | line icons inside soft circular badges | iconless line, solid, mono |
| Font | Pretendard -> Apple SD Gothic Neo -> Malgun Gothic / Noto Sans KR fallback | a specific font |
| Color | semantic colors per step, accent for the key card | brand colors |
| Ratio | chosen for the request, such as wide landscape or 4:5 social | any target size |
| Language | inferred from the prompt | English, Korean, or bilingual |
| Output | SVG + 2x PNG, inside the current project | SVG only |

## Output

The skill proposes an output directory inside your current project before writing files.

- `*.svg` — primary editable vector asset for docs, HTML, and PPTX workflows
- `*.png` — 2x preview/export for sharing, thumbnails, and social posts

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

Copy this Claude Code package into a skills directory — either **global** (`~/.claude/skills/`, available in all your projects) or **project** (`.claude/skills/` in a repo, so your team gets it on clone):

```text
<skills-dir>/svg-infographic/SKILL.md
```

GitHub install commands (global and project scope) for macOS, Linux, and Windows are in [../../docs/INSTALL.md](../../docs/INSTALL.md).

## Examples

Browse the full gallery:

**https://github.com/kyungseo/skillstead/tree/main/examples/svg-infographic**

It includes English and Korean examples for topology, layer/onion models, before/after comparison, process flow, roadmap, and a self-demo.

## Boundaries

Use this skill for flat, structural visuals. It is not designed for:

- photo-heavy or illustration-heavy marketing graphics
- statistical charts such as bar, line, scatter, or heatmap charts
- hand-drawn/crayon sketchnote styles
- mascots, character art, or custom illustration

If PNG export is unavailable, the skill still delivers SVG and states the limitation.
