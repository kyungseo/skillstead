<!-- 한국어: [README.ko.md](./README.ko.md) -->

# Agent Skills

Small, practical skills for AI coding agents — packaged so each one is easy to read, install, and share on its own.

Each skill fills a concrete capability gap you hit in real work, and ships with example artifacts so you can see the output before you install. See [`examples/svg-infographic/`](./examples/svg-infographic) for the first skill's outputs (English + Korean).

> **First-class Korean / CJK rendering.** The first skill authors SVG infographics with a font stack and glyph checks tuned for Korean and other CJK text — an area where many diagram/infographic tools break.

## Preview

<table>
<tr>
<td width="34%"><a href="./examples/svg-infographic/technical-infographic"><img src="./examples/svg-infographic/technical-infographic/technical-infographic.en.png" alt="The 4 Layers of AI Engineering" width="100%"></a></td>
<td width="46%"><a href="./examples/svg-infographic/before-after-migration"><img src="./examples/svg-infographic/before-after-migration/before-after-migration.en.png" alt="Monolith to microservices" width="100%"></a></td>
</tr>
</table>

More in the [example gallery](./examples/svg-infographic) — topology, layer/onion, before/after, and a self-demo, each in English + Korean with the prompt that made it.

## Skills

| Skill | Agent | Status | Summary |
| --- | --- | --- | --- |
| [`svg-infographic`](./skills/svg-infographic) | Claude Code | Beta | Author technical/structured SVG infographics and export them as crisp PNG artifacts. |

## Naming Convention

Skill names lead with the function trigger, not a maker or brand name — this makes them match reliably in an agent's skill selector.

```text
<medium-or-capability>-<job>
```

Examples: `svg-infographic`, `review-pr`, `docs-redline`.

Brand identity lives in repository metadata, README copy, and social posts — not in the skill name.

## Usage

In Claude Code, ask for a diagram in plain language — the skill triggers on matching requests, or invoke it by name:

```text
Use svg-infographic to draw an Azure topology: AGW → APIM → AKS → PostgreSQL.
```

You get an editable `.svg` (source of truth) and a crisp 2× `.png` for slides, docs, and social posts. Each [example](./examples/svg-infographic) shows a real prompt.

## Install

Clone the repo and copy the one skill folder you want — no remote script is run. Full guide (Windows PowerShell, update, uninstall): [`docs/INSTALL.md`](./docs/INSTALL.md).

**Install latest** (macOS / Linux):

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p ~/.claude/skills && cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

**Install a pinned version** (reproducible): add `--branch <tag>`, e.g. `--branch v0.1.0`.

## Scope

- **Claude Code first.** Codex / Codex CLI support is deferred until there is demand and the browser-based export path is verified there.
- **Clone + copy install.** GitHub clone + copy (latest or pinned tag) — see [`docs/INSTALL.md`](./docs/INSTALL.md). Install scripts, a plugin/marketplace, and a formal versioning policy are out of scope until they earn their cost.

## License

[Apache-2.0](./LICENSE).
