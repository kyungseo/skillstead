# street-portrait-artist

**English** · [한국어](./README.ko.md)

`Street Artist` draws character portraits from the face shape and expression in your photos. Choose a kind
caricature, watercolor portrait, or drawn paper-cut figure in a photographic scene. Ask for a Twin Portrait to get separate caricature and watercolor artworks based on the same observed
features. Supply one or more portrait references.

## How It Interprets The Photos

Before drawing, the skill assigns each photo a role and records the person’s features. After drawing, it explains
its choices:

1. `Reference Triangulation`: one image owns pose and crop; additional images clarify named identity features without
   averaging faces or combining poses.
2. `Impression Map`: face shape, eye-and-nose alignment, the relationship between mouth and chin, surrounding
   features such as hair, expression, and one main distinguishing feature.
3. `Action-Reaction Distortion`: any amplification changes supporting relationships coherently instead of enlarging one
   feature in isolation. Observational watercolor and paper-cut can preserve source proportions.
4. `Artist's Note`: the delivery explains the main visual idea and its structural consequence without inferring
   personality.

Choose `Quick Sketch` for one usable reference or `Studio Portrait` for two or three complementary references.

## Modes

The `0.2.0` package adds the Editorial Watercolor profile, Paper-Cut Illustration mode, and
series-consistency guidance below. Experimental maturity and the recorded runtime-support scope remain unchanged.

| Mode | Interpretation | Typical finish |
| --- | --- | --- |
| `Street Caricature` / `Exaggerate` | Finds one witty, kind structural idea and pushes it coherently | Warm drawing paper, open-paper facial planes, near-monochrome ink or graphite, decisive black mass, and at most a tiny muted spot color |
| `Romance Watercolor` / `Illuminate` | Reveals the same identity through lyrical simplification and restrained character idealization | Cold-pressed paper, precise varied pen contours, transparent washes, grouped hair and clothing, softly retained environment |
| `Paper-Cut Illustration` | Simplifies the person inside the original scene and silhouette | Photographic surroundings, simple dot/oval eyes and mouth marks, flat colors, loose contours, thin paper edge |

Within Romance Watercolor, request `Editorial Watercolor` for more observational facial detail, selective edges,
and loosely painted clothing and surroundings. Original identity, age cues, clothing, and palette remain authoritative
unless you request a change; a white shirt and blue washes are not mandatory. For a much airier result, ask for
clothing dissolved into pale washes and broad paper reserves, with the face as the main detailed area.
For a tidier finish, ask for larger quiet paper areas, grouped washes, and fewer competing small marks while retaining
the scene anchors that matter.

The modes use the same record of the person’s features. `Twin Portrait` still produces Street Caricature and Romance Watercolor as separate artworks from the same Impression Map;
the second image must not silently redefine the person to match the first.

Black-ink requests can use gentle facial stylization or stronger caricature. Romance Watercolor can retain a rich
scene through transparent color and selective detail; the minimal Editorial treatment is a separate compositional choice.

## Consistency And Revisions

For a series, keep the original identity reference, approved rendering choices, and each requested change separate.
A local correction edits the best accepted artwork; a new variation returns to the original identity evidence with
those rendering choices. The skill does not require JSON for a single portrait or treat a generated face as a new
likeness source. Task records remain private unless you authorize another use.

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

Paper-Cut Illustration keeps the original aspect ratio and framing by default. Exact background preservation depends
on a capable editing surface and verification; a generation prompt alone cannot guarantee unchanged pixels.

For the other modes, the default `social-feed-portrait` is a `4:5` composition targeting an exact `1080 x 1350 px` PNG when the current
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

Maturity remains Experimental. The public-safe synthetic gallery establishes the intended visual direction, and
fresh published `0.1.0` package runs establish ChatGPT and Codex runtime support. They do not guarantee likeness or consistent
visual quality across different faces, scenes, or image-generation runs.
