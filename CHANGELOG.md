# Changelog

All notable changes to this repository are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository skeleton: root README (EN) + Korean mirror, naming convention, install guide.
- First skill draft: `svg-infographic` (Claude Code) — technical/structured SVG infographic authoring with 2x PNG export.
- Apache-2.0 license.
- Example artifacts under `examples/svg-infographic/` (namespaced by skill; SVG + 2x PNG, English + Korean, each with the generating prompt + Provenance):
  - `technical-infographic` — "The 4 Layers of AI Engineering" (flat, structural; icon cards).
  - `before-after-migration` — Monolith → Microservices comparison (two-panel before/after).
  - `cloud-infra-topology` — Azure AGW → APIM → AKS → PostgreSQL reference topology (icon badges).
  - `skill-overview` — the skill introducing itself (purpose + mechanism).
- Cross-platform hardening: per-OS browser discovery, `--no-sandbox` fallback, Windows `file://` path handling, CJK font fallback (macOS/Windows/Linux) with a Linux Noto-CJK install note.
- GitHub install guide (clone + copy, latest + pinned tag, update, uninstall) in `docs/INSTALL.md`; quick install in the READMEs.
- SKILL.md layout guide: per-archetype recipes, text-wrapping and connector-routing rules, canvas presets, sharpened non-goals (simple qualitative matrices allowed).
- Gallery + per-OS render smoke-test table in `examples/svg-infographic/README.md`.

### Notes

- Private-first. The two original, non-client example artifacts are in place and pass the quality bar (no text overflow, correct Korean/CJK glyphs, matching SVG/PNG dimensions); remaining public-release gates (repo name freeze, distribution baseline) are tracked in Toolstead.
- Codex support, install scripts, versioning policy, compatibility matrix, and plugin/marketplace packaging are deferred.
