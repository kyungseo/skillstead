<!-- 한국어: [README.ko.md](./README.ko.md) -->

# Agent Skills

Small, practical skills for AI coding agents — packaged so each one is easy to read, install, and share on its own.

Each skill fills a concrete capability gap you hit in real work, and ships with example artifacts so you can see the output before you install.

> **First-class Korean / CJK rendering.** The first skill authors SVG infographics with a font stack and glyph checks tuned for Korean and other CJK text — an area where many diagram/infographic tools break.

## Skills

| Skill | Agent | Status | Summary |
| --- | --- | --- | --- |
| [`svg-infographic`](./skills/svg-infographic) | Claude Code | Draft | Author technical/structured SVG infographics and export them as crisp PNG artifacts. |

## Naming Convention

Skill names lead with the function trigger, not a maker or brand name — this makes them match reliably in an agent's skill selector.

```text
<medium-or-capability>-<job>
```

Examples: `svg-infographic`, `review-pr`, `docs-redline`.

Brand identity lives in repository metadata, README copy, and social posts — not in the skill name.

## Install

See [`docs/INSTALL.md`](./docs/INSTALL.md). The default distribution is manual copy into your agent's skills directory; no install script required.

## Scope

- **Claude Code first.** Codex / Codex CLI support is deferred until there is demand and the browser-based export path is verified there.
- **Manual copy install (L0).** Install scripts, versioning policy, compatibility matrices, and plugin/marketplace packaging are out of scope until they earn their cost.

## License

[Apache-2.0](./LICENSE).
