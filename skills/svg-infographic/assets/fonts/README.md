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

## Pretendard-Regular.otf / Pretendard-Bold.otf — canonical flat faces (400 · 700)

- License: SIL OFL 1.1 (`Pretendard-OFL.txt`) — **Reserved Font Name: "Pretendard"**.
  A subset is a Modified Version under the OFL, so generated subsets must **not** carry
  that name: portable artifacts embed them under the neutral alias declared by
  `references/delivery/font-delivery-v1.yaml`. Redistributing these unmodified files
  under their own name, with this license, is what clause 2 allows.
- Source: official upstream release `v1.3.9` (commit `5c41199ea0024a9e0b2cb31735265056e5472d76`)
  of `github.com/orioncactus/pretendard`, archive `Pretendard-1.3.9.zip`
  (sha256 `04be351a74d6bf7d60c480a3087e51d185485d35a52023142af1df19eb8c428a`),
  members `public/static/Pretendard-Regular.otf` and `public/static/Pretendard-Bold.otf`.
  Locally installed copies are never used as the asset — they carry no pinnable provenance.
- SHA-256: Regular `3ffbacde6ab8411f…`, Bold `2e91915fab54df71…` (full digests in
  `references/typography/typography-v1.yaml`, re-checked by `skin.mjs typography`).
- Only the two weights the profile actually declares (400, 700) are pinned. Synthetic
  weights are forbidden, so a weight without an asset is a validation error rather than
  something the renderer fakes.
- Usage contract: portable artifacts embed a **glyph subset** of these faces (tens of KB);
  the full files stay here for offline subset regeneration. Never a full embed, never a
  remote font.
