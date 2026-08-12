# Canonical Skin Media

`canonical-skin-contact-sheet.{svg,png}` — review/reference artifacts for the approved
canonical skin.

- **Decision**: Selected canonical skin — Candidate C + Owner neutral-hierarchy
  adjustment (2026-08-12, Work `FEAT-20260812-001` CP1B).
- **These files are not the palette source of truth.** Color SSoT is the versioned
  skin profile `references/skins/current-v1.yaml` consumed through the single
  resolver `scripts/skin.mjs` (see `references/design-kernel.md` §3).
- Status: **generated composite evidence artifact — regenerated profile consumer** (2026-08-12, CP4). Mixed light/dark/sketch profiles on one canvas: not an ordinary canonical-output surface, so it is not linted under a single `--palette-profile` (each embedded pilot is linted under its own profile). Package-local automatic regeneration (`skin.mjs contact-sheet`) stays reserved; the recolor/contact-sheet contract items stay partial until it lands. — H-C header, six
  materializer-verified pilots (flat light/dark + sketch, KO/EN; dark is a
  deterministic `--mode dark` re-color of the same sources), 11-role tokens,
  normative contrast from the validate receipt, and provenance digests, all
  consumed from `current-v1` through `skin.mjs`. The PNG is a canonical-renderer
  (`scripts/render.mjs`) 2× output; the SVG is the editable source. Sketch slots
  reference a locally installed handwriting font (no `@font-face` embed) — the PNG
  carries the approved rendering.
- Regeneration: from the profile via the recolor pipeline (a `skin.mjs contact-sheet`
  subcommand is reserved); generator lineage for this edition is preserved in Work
  `FEAT-20260812-001` review evidence.

![Approved svg-infographic canonical skin](canonical-skin-contact-sheet.png)

[Editable SVG](canonical-skin-contact-sheet.svg)
