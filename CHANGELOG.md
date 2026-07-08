# Changelog

All notable changes to this repository are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository skeleton: root README (EN) + Korean mirror, naming convention, install guide.
- First skill draft: `svg-infographic` (Claude Code) — technical/structured SVG infographic authoring with 2x PNG export.
- Apache-2.0 license.
- Example artifacts (SVG + 2x PNG, English + Korean), each with the generating prompt:
  - `examples/cloud-infra-topology` — Azure AGW → APIM → AKS → PostgreSQL reference topology.
  - `examples/technical-infographic` — "The 4 Layers of AI Engineering" (flat, structural).

### Notes

- Private-first. The two original, non-client example artifacts are in place and pass the quality bar (no text overflow, correct Korean/CJK glyphs, matching SVG/PNG dimensions); remaining public-release gates (repo name freeze, distribution baseline) are tracked in Toolstead.
- Codex support, install scripts, versioning policy, compatibility matrix, and plugin/marketplace packaging are deferred.
