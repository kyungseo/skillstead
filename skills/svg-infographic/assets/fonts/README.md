# Bundled fonts

## HiMelody-Regular.ttf — canonical sketch handwriting face

- Selected: 2026-08-13 (typography audition — design review; candidates and rationale
  are preserved in the review evidence)
- License: SIL OFL 1.1 (`HiMelody-OFL.txt`) — no Reserved Font Name declaration,
  so subsets may keep a derived name; we still use a neutral deterministic internal
  alias in embedded subsets.
- Source: google/fonts repository, commit `038b637da7b3fd956a4ed93ffc607c3d5e4ce172`,
  path `ofl/himelody/HiMelody-Regular.ttf`
- SHA-256: `360d2c0a880918aa` … (full digest in `references/typography/typography-v1.yaml`)
- Usage contract: shipped sketch artifacts embed a **glyph subset** of this face
  (never the full file, never a remote font); the full TTF stays here for offline
  authoring and subset regeneration. See `references/typography/typography-v1.yaml`.
