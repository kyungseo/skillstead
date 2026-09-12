# Portrait Enhancement Development Check — 2026-09-12

**English** · [한국어](./enhancement-validation.ko.md)

This is bounded development evidence for unreleased source changes, not new runtime-support certification.
The published package remains `0.1.2`, with Experimental maturity.

## Decision Checks

Four fresh-context, model-only Astra (`gpt-6-astra`, high reasoning effort) responses received the candidate's
applicable instructions inline. No tools were used and no images were generated in these planning checks.
The executor selected the required decisions in all four:

- Preserve source 3:2 framing and occlusion for paper-cut; state unavailable exact background preservation.
- Edit the accepted artwork for a local change, with the original retained as identity evidence.
- Separate original identity, accepted treatment, and requested expression/background changes; reject prior head drift.
- Preserve supplied age cues, hair, clothes, and palette in Editorial Watercolor instead of applying a fixed face or outfit.

These are single responses assessed by the developer, not repeated or independent review results.
They do not establish installed-skill discovery or image quality.

## Visual Checks

The existing public-safe Rooftop Garden synthetic source was used for actual image generation. Prompts were manually
compiled from the applicable instructions and passed to the image tool; this was not an automatically discovered
skill session. The developer inspected a current Romance Watercolor result, an initial Editorial result, one
Editorial refinement, a Paper-Cut result, and one local clothing-color edit.

The initial Editorial result still over-rendered the setting and broke skin into conspicuous color patches.
A narrow instruction refinement produced more visible paper and a clearer face-first hierarchy. Clothing and
plants remained denser than intended. This is partial visual progress on one source, not proof of general superiority
or likeness preservation. The unsuccessful first attempt was retained in the private development record.

The Paper-Cut result visibly separated a drawn figure from photographic surroundings and retained the main seated
pose and visible hands. Its paper edge was stronger than the intended thin margin. The full-frame generation and
different output dimensions do not establish exact background pixel preservation.

The local edit changed the mustard sweater to muted navy while retaining the main pose and scene. Facial and jacket
textures also changed, so this only partially met the requested local-edit contract. No further retries were made;
the trial does not establish that an accepted portrait can be edited without drift.

Source images, generated results, actual dimensions, exact generation calls, and observations are retained in the
private development record. The existing public gallery remains evidence of the original modes; these new results
have not been promoted into that gallery or used to broaden product-support claims.

## Cartoon Treatment Follow-up

The first Paper-Cut result was judged too realistic in user review. The mode now defaults to economical cartoon
facial marks and flat clothing colors rather than modeled facial planes and textured shading. A further actual
image used the same synthetic identity source and a user-supplied example only as a treatment reference.
It showed dot eyes, a short mouth line and flatter color areas, closer to the requested cartoon direction.
Fine facial likeness cues were reduced and the head outline softened. This single style-referenced result does not
establish reference-free reliability or stronger identity preservation. The attachment remains private task input.

## Stronger Editorial Treatment — Bounded Visual Check

An optional stronger simplification was added at user request: retain face/hand detail, dilute clothing into paper
reserves, and omit descriptive scenery when requested. Two initial image-generation attempts failed with connection
errors. A later task-scoped private check returned an image with lighter clothing edges and more paper, but the face
remained more photographically modeled and texturally active than intended. It is partial negative evidence rather
than release validation, and the private likeness input and output remain outside repository fixtures. The follow-up
also clarified that a tidy watercolor needs ordered wash groups and quiet paper fields, not merely paler pigment.

## Earlier Visual References Revisited

Eight user-supplied finished illustrations were inspected to clarify the intended direction. The ink examples allowed
gentle facial stylization, and the watercolors retained rich scenes through light pigment and selective edges. Guidance
was clarified accordingly; these observations are not new generated results or evidence of likeness to unseen originals.
