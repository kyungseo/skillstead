# Street Portrait Artist Intent Contract

## User Outcome

Given one or more permitted portrait references, create a recognizably similar, visibly authored portrait through one
shared identity analysis and either a kind street caricature or a romance-watercolor character interpretation. The
result should communicate one coherent visual idea rather than a generic style transfer.

## Selection

Select for:

- named `street-portrait-artist` requests, including `$street-portrait-artist` where the runtime supports that selector;
- street-fair, cute, ink, brush-pen, or affectionate caricatures based on a real portrait;
- romance-comic, lyrical character, or watercolor portraits based on a real portrait;
- paired interpretations of one subject that should share an identity grammar;
- revisions framed as a wrong primary anchor, feature relationship, analog rendering, or portrait composition.

Do not select for:

- graffiti, murals, public-space street art, or logo lettering;
- restoration, colorization, face swapping, beautification, age transformation, or photorealistic retouching;
- fictional character generation without a likeness reference;
- personality or sensitive-trait inference from appearance;
- a text-heavy poster, infographic, or social-card layout beyond an optional portrait layer;
- imitation of a named living artist, studio, brand, franchise, or existing artwork.

## Inputs And Authority

The user must own the portrait or have likeness permission. One accessible photo enables `Quick Sketch`; two or three
complementary photos enable `Studio Portrait` only when one composition anchor and each clarification role are explicit.
The workflow must not average faces, combine poses, invent unseen views, or pretend to access an unavailable attachment
or local path.

Portraits, Impression Maps, and outputs are task-scoped. The skill invocation does not authorize public examples,
persistent identity profiles, package assets, publication, repository writes, or release mutation.

## Shared Identity Contract

Both modes must build from the same Impression Map: head frame, T-axis, mouth-chin rhythm, outer anchors, expression,
one primary anchor, and a coherent action-reaction plan. Observed appearance must remain separate from artistic choice.
No personality, health, ethnicity, attractiveness, or other sensitive or unverifiable attribute may be inferred.

## Mode Contract

- `Street Caricature` / `Exaggerate`: stronger relational transformation, one witty and kind anchor, varied analog line
  weight, sparse decisive black mass, open-paper facial planes, a near-monochrome base, at most a tiny muted spot color,
  and a subject-first blank background. Lock sparse relational construction before the ink finish so polished rendering
  cannot collapse back into photographic proportions with only an enlarged head.
- `Romance Watercolor` / `Illuminate`: gentler structural simplification, selective emphasis, lyrical line, transparent
  watercolor physicality, and a softly retained meaningful environment reduced to connected color masses and selected
  scene anchors rather than photographic detail or unrelated decoration.

`Twin Portrait` creates both as separate artworks from one shared map. It is not a before/after collage and does not
permit the second output to redefine the subject from the first.

## Output And Claim Boundary

Default to `social-feed-portrait`: `4:5`, exact target `1080 x 1350 px`, no text or mockup. Verify actual dimensions before
claiming exact export. Image generation unavailable means prompt-only fallback, not completed art. Do not promise
guaranteed likeness, deterministic results, product pixel parity, human authorship, or runtime support without accepted
runtime-specific evidence.

## Host Precedence

When another workflow owns layout, publication, file placement, repository state, or approval, follow it first. This
skill can supply a portrait layer or analysis but must not bypass the host workflow's authority.
