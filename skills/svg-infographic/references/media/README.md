# Canonical Skin Media

`canonical-skin-contact-sheet.{svg,png}` — review/reference artifacts for the approved
canonical skin.

- **Decision**: Selected canonical skin — Candidate C + Owner neutral-hierarchy
  adjustment (2026-08-12, Work `FEAT-20260812-001` CP1B).
- **These files are not the palette source of truth.** Color SSoT is the versioned
  skin profile `references/skins/current-v1.yaml` consumed through the single
  resolver `scripts/skin.mjs` (see `references/design-kernel.md` §3).
- The PNG is a canonical-renderer (`scripts/render.mjs`) 2× output; the SVG is the
  editable source.
- Regeneration: from the profile via the recolor pipeline (a `skin.mjs contact-sheet`
  subcommand is reserved); generator lineage for this edition is preserved in Work
  `FEAT-20260812-001` review evidence.

![Approved svg-infographic canonical skin](canonical-skin-contact-sheet.png)

[Editable SVG](canonical-skin-contact-sheet.svg)
