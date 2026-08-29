# Changelog — street-portrait-artist

Notable changes to the `street-portrait-artist` skill package.

## [0.1.0] — 2026-08-29

- Added the initial Experimental `Street Artist` release with one shared Impression Map and two interpretations:
  `Street Caricature` / `Exaggerate` and `Romance Watercolor` / `Illuminate`.
- Added reference triangulation for one-photo `Quick Sketch` and two-to-three-photo `Studio Portrait` inputs without
  face averaging, pose blending, or invented views.
- Added head-frame, T-axis, mouth-chin, outer-anchor, expression, primary-anchor, and action-reaction contracts so the
  output is structurally interpreted rather than style-filtered.
- Added `Twin Portrait` and concise `Artist's Note` outputs while prohibiting personality inference, named living-artist
  imitation, guaranteed likeness, human-authorship claims, and unapproved persistent identity profiles.
- Refined `Romance Watercolor` around precise varied pen contours, transparent watercolor behavior, and restrained
  character idealization rather than a compulsory romance-comic face.
- Set `Street Caricature` to an ink-first, near-monochrome finish with open-paper facial planes, decisive black masses,
  and at most a tiny muted spot color; colored realistic portraits and enlarged-head photo treatments are failures.
- Set the default social-feed output to a `4:5` composition targeting `1080 x 1350 px`, with actual-dimension
  verification and a fail-visible nearest-output branch when exact raster export is unavailable.
- Added permission, inaccessible-reference, unavailable-image-tool, host-workflow precedence, targeted revision, and
  public-fixture privacy boundaries.
- Kept ChatGPT and Codex runtime support at `Validation pending` until runtime-specific evidence is accepted.
