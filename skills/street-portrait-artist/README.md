# street-portrait-artist

**English** · [한국어](./README.ko.md)

`Street Artist` turns one or more portrait references into a recognizably similar character portrait by analyzing the
person's visible feature relationships before rendering. It is not a style filter. One shared `Impression Map` supports
two intentionally different readings of the same face—“one face, two truths.”

## What Makes It Different

The workflow separates four decisions that generic portrait filters often collapse:

1. `Reference Triangulation`: one image owns pose and crop; additional images clarify named identity features without
   averaging faces or combining poses.
2. `Impression Map`: head frame, T-axis, mouth-chin rhythm, outer anchors, expression, and one primary anchor.
3. `Action-Reaction Distortion`: any amplification changes supporting relationships coherently instead of enlarging one
   feature in isolation.
4. `Artist's Note`: the delivery explains the main visual idea and its structural consequence without inferring
   personality.

Choose `Quick Sketch` for one usable reference or `Studio Portrait` for two or three complementary references.

## Two Modes

| Mode | Interpretation | Typical finish |
| --- | --- | --- |
| `Street Caricature` / `Exaggerate` | Finds one witty, kind structural idea and pushes it coherently | Warm drawing paper, open-paper facial planes, near-monochrome ink or graphite, decisive black mass, and at most a tiny muted spot color |
| `Romance Watercolor` / `Illuminate` | Reveals the same identity through lyrical simplification and restrained character idealization | Cold-pressed paper, precise varied pen contours, transparent washes, grouped hair and clothing, softly retained environment |

The modes share one identity grammar. `Twin Portrait` produces both as separate artworks from the same Impression Map;
the second image must not silently redefine the person to match the first.

## Start Here

Supply one or more clear portrait references. Name a mode or describe the result. If no mode is given,
the skill discloses and uses `Street Caricature` as the default.

```text
Use street-portrait-artist on these two photos of me. Treat the first as the composition anchor and the second only as
hairline and jaw clarification. Make a kind Street Caricature for a 4:5 social post, and tell me the one visual idea you
used. Do not add text or a signature.
```

In Codex, use `$street-portrait-artist` when the installed skill is discovered. In ChatGPT, invoke the installed skill
by name through the product's skill interface. Fresh installations of the published `0.1.0` package were discovered and
invoked in both products with a synthetic portrait, reference-image generation, fail-visible size fallback, and output
delivery. ChatGPT and Codex are `Supported` within that recorded evidence scope.

## Social Output

The default `social-feed-portrait` is a `4:5` composition targeting an exact `1080 x 1350 px` PNG when the current
surface can create and verify it. Optional profiles are `social-square` (`1080 x 1080 px`) and `story-vertical`
(`1080 x 1920 px`) when requested. The workflow reports actual dimensions and marks exact export unavailable rather than
stretching an image or fabricating a size.

## Boundaries

Do not use this skill for graffiti, murals, restoration, colorization, face swaps, beautification, age transformation,
photorealistic retouching, or fictional characters without a likeness reference. It does not infer personality,
ethnicity, health, attractiveness, or other sensitive or unverifiable traits from appearance. It does not imitate a
named living artist, studio, brand, or existing artwork.

For text-heavy posters and infographics, this skill may create only the portrait layer; the host artifact workflow owns
layout, typography, file placement, and publication. A supplied portrait, Impression Map, or output remains task-scoped
and is not reused as a public example or persistent character profile by default.

The workflow does not guarantee likeness, deterministic regeneration, identical output across products, human
authorship, or an exact export that the current surface cannot perform and verify.

## Package

Install the complete `skills/street-portrait-artist/` folder. The package contains all required mode references and its
license; repository-only scenarios and answer keys are intentionally excluded from folder installs.

Version `0.1.1` remains Experimental. The public-safe synthetic gallery establishes the intended visual direction, and
fresh published `0.1.0` package runs establish ChatGPT and Codex runtime support. They do not guarantee likeness or consistent
visual quality across different faces, scenes, or image-generation runs.
