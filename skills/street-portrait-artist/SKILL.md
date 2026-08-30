---
name: street-portrait-artist
description: Analyze supplied portrait references into a stable impression map, then create a kind Street Caricature or Romance Watercolor character portrait with coherent feature relationships and targeted revision. Use when a real person's recognizable visual identity should be interpreted rather than traced. Do not use for graffiti or murals, restoration, face swaps, photorealistic retouching, personality inference, or imitation of a named living artist.
license: LICENSE.txt
metadata:
  version: 0.1.1
---

# Street Artist

Create a portrait that feels observed and drawn by an artist, not passed through a style filter. Extract the subject's
recognizable visual grammar once, then interpret it through one of two modes:

- `Street Caricature` / `Exaggerate`: a kind, compact caricature with one relational idea, open-paper facial planes,
  near-monochrome ink or graphite, and at most a tiny muted spot color.
- `Romance Watercolor` / `Illuminate`: a delicate pen-and-watercolor character portrait with restrained idealization.

Both modes must preserve the same identity relationships. They differ in what they amplify, not in who the subject is.

## Required References

Before generating or editing, read these files completely:

- [`references/impression-map.md`](references/impression-map.md) — reference roles, identity grammar, primary anchor,
  and action-reaction redesign.
- [`references/production-workflow.md`](references/production-workflow.md) — permission, input profiles, capability
  fallbacks, output sizes, inspection, and revision.

Then read only the selected mode reference:

- [`references/street-caricature.md`](references/street-caricature.md) for `Street Caricature`.
- [`references/romance-watercolor.md`](references/romance-watercolor.md) for `Romance Watercolor`.

If a required reference cannot be read, stop and report that the package is incomplete.

## Use When

- The user supplies one or more clear portraits and wants a recognizably similar, visibly authored character portrait.
- The request calls for a street-fair caricature, cute caricature, hand-drawn ink portrait, delicate pen-and-watercolor
  portrait, or lyrical character portrait.
- A paired `Twin Portrait` should show two interpretations of one person from one shared identity analysis.

## Do Not Use When

- The task is graffiti, a mural, public-space street art, restoration, colorization, face swapping, beautification,
  age transformation, photorealistic retouching, or a fictional character without a likeness reference.
- The primary deliverable is a text-heavy poster, infographic, or social card. This skill may create the portrait layer;
  the host artifact workflow owns typography, layout, file placement, and publication.
- The user asks to infer personality, ethnicity, health, attractiveness, or other sensitive or unverifiable traits from
  appearance.
- The request asks to copy a named living artist, studio, brand, or existing artwork. Translate it into generic visual
  qualities or ask for a non-proprietary direction.

## Procedure

1. Inspect only the references needed for the task. Confirm likeness permission and choose `Quick Sketch` for one
   usable photo or `Studio Portrait` for two or three complementary photos. Never average faces or combine poses.
2. Write a compact `Impression Map`: head frame, T-axis, mouth-chin rhythm, outer anchors, expression, and one primary
   anchor. Separate observations from artistic choices and never infer personality.
3. Choose the mode from the request. If no mode is given, disclose `Street Caricature` as the default; ask when the
   choice would materially change the intended result.
4. Redesign relationships coherently. Any amplified feature must create a compensating action elsewhere rather than an
   isolated enlargement. For `Street Caricature`, lock the relational construction before the ink finish; for `Romance
   Watercolor`, reduce the scene to a few connected color masses and environmental anchors before adding selective
   linework. Keep non-anchor features supportive and preserve the subject's expression and reference roles.
5. Generate the artwork itself with an available reference-image capability. Default to `social-feed-portrait` at
   `4:5`, targeting an exact `1080 x 1350 px` export when the current surface can create and verify it. Do not add text,
   signatures, watermarks, logos, frames, phones, or feed mockups unless requested.
6. Inspect identity, mode adherence, analog physicality, composition, unintended text, actual dimensions, and edge
   safety separately. Deliver a concise `Artist's Note` naming the primary anchor and the structural choice it drove.
7. For revision, change the Impression Map or one named rendering defect, restate accepted invariants, and preserve the
   best accepted result. Do not blindly regenerate after repeated identity drift.

## Failure Boundary

- If no accessible portrait is available, request an upload or attachment; never invent the subject or claim a local
  path was read.
- If image generation or editing is unavailable, provide a structured production prompt and state that no portrait was
  generated. A prompt is not a finished artwork.
- If exact raster export is unavailable, preserve the requested composition, report actual dimensions, and mark exact
  export unavailable. Never stretch the image or fabricate dimensions.
- Do not promise guaranteed likeness, deterministic regeneration, cross-product pixel parity, or human authorship.
- Do not reuse a supplied portrait, Impression Map, or output as a public example, persistent character bible, or
  unrelated fixture without separate permission.
