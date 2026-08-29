# Production Workflow

## Permission And Privacy

Confirm that the user owns the image or has permission to use the person's likeness before generation. Do not infer
permission from possession of a file. A portrait supplied for one task remains task-scoped: do not add it, its Impression
Map, or its output to package assets, public examples, persistent identity profiles, or unrelated fixtures without
separate permission.

## Input Profiles

- `Quick Sketch`: one clear portrait, one interpretation, and a bounded single-view Impression Map. Good for speed and
  casual use; disclose meaningful uncertainty caused by angle, expression, crop, or lighting.
- `Studio Portrait`: two or three complementary portraits with explicit roles. Use one composition anchor and only
  named identity or expression clarification references. Never average images or blend poses.

If a reference is inaccessible, request an attachment or another accessible source. On a surface that cannot read a
local path, do not claim that the path was inspected.

## Mode And Deliverable Selection

Choose `Street Caricature` for witty structural exaggeration, compact cuteness, bold ink, or a street-fair sketch.
Choose `Romance Watercolor` for an elegant character portrait, softer transformation, watercolor environment, or a
romance-comic protagonist feeling. When neither is stated, disclose `Street Caricature` as the default.

For a `Twin Portrait`, build one Impression Map, then generate both modes as separate artworks. Keep reference roles,
expression, and identity anchors shared. Do not let the second image silently redefine the subject to match the first.

## Social Output Profiles

The default is `social-feed-portrait`:

- composition: `4:5`;
- exact raster target: `1080 x 1350 px`;
- product: the artwork itself, not a phone, frame, feed, desk, or sketchbook mockup;
- edge guard: protect face, hair, hands, eyewear, and identifying clothing silhouette;
- text: none unless explicitly requested.

Optional profiles are selected only when requested:

- `social-square`: `1:1`, exact target `1080 x 1080 px`;
- `story-vertical`: `9:16`, exact target `1080 x 1920 px`.

Request the aspect ratio during generation. Inspect actual dimensions. If safe crop or resize is available, export the
requested dimensions without distortion or identity-critical cuts. Otherwise deliver the closest suitable composition,
report actual dimensions, and mark exact export unavailable. Never stretch the artwork or repeat requested dimensions
as if they were verified.

## Generation Prompt Contract

Carry these facts into the image operation:

1. reference roles and permission status;
2. compact Impression Map and primary anchor;
3. action-reaction plan;
4. selected mode's structural, material, scene, and failure contracts;
5. composition, output profile, and protected edges;
6. invariants: recognizable identity, reference expression, no text or signature, no named-style imitation.

Do not overload the operation with long generic style keyword lists. Prefer the specific structural decision and a few
observable material behaviors. Negative instructions are guards, not substitutes for a positive design.

## Inspection

Inspect the actual output before delivery:

- `identity`: does the head frame, T-axis, mouth-chin rhythm, expression, and outer-anchor pattern still identify the
  subject?
- `design`: is there one primary anchor and a coherent action-reaction response?
- `mode`: does the result satisfy the selected interpretation rather than a generic illustration?
- `physicality`: do lines, pigment, paper, edges, and shadow read as authored analog marks rather than an overlay?
- `composition`: are pose, crop, background behavior, protected edges, and requested profile respected?
- `artifacts`: is there unintended text, signature, watermark, malformed anatomy, or unrelated reference leakage?
- `delivery`: are actual dimensions verified, and are limitations stated without overstating support?

Likeness is a human judgment, not a guarantee. If the user says the result does not resemble the subject, treat that as
a real finding even when the rendering is attractive.

## Targeted Revision

Classify the defect before editing:

- `map defect`: wrong primary anchor or incorrect feature relationship—revise the map, then regenerate or edit;
- `rendering defect`: correct identity design but wrong line, wash, paper, scene, or finish—keep the map fixed;
- `composition defect`: wrong crop, pose, background, or edge safety—keep map and accepted rendering qualities fixed;
- `artifact defect`: unintended text, mark, anatomy, or delivery error—edit only the affected region when possible.

Restate accepted invariants in every edit. If two targeted revisions worsen identity, return to the best accepted result
and ask whether to change the primary anchor. Do not continue generating variants without a new hypothesis.

## Capability Fallbacks

- Image generation/editing unavailable: provide the Impression Map plus structured production prompt, and state that no
  image was generated.
- Output file delivery unavailable: return the accessible generated artifact and state the limitation; do not invent a
  saved path.
- Exact raster export unavailable: report actual dimensions and preserve aspect-ratio composition.
- Cross-product comparison requested: compare workflow, constraints, and visible results only. Do not promise identical
  internal prompts, tool paths, or pixels.

## Delivery

Deliver one primary artwork per requested mode unless variants were requested. State the mode, reference profile,
verified dimensions or limitation, and a concise `Artist's Note`. Do not claim human authorship, guaranteed likeness,
deterministic regeneration, or maturity/support beyond observed runtime evidence.
