# Consistency Across Variants And Edits

Use when making a requested series, changing a portrait treatment, or revising an accepted result. A single
portrait still uses the ordinary Impression Map; do not require a long profile or JSON before drawing it.

## Separate What Stays From What Changes

Keep a small task-scoped record, in prose or structured fields when useful:

- **Identity:** original reference roles, head frame, feature relationships, hair silhouette, identifying outer
  anchors, and uncertainty. The original portrait remains the identity source.
- **Treatment:** accepted line character, simplification, color relationships, material behavior, and edge handling.
  An accepted artwork may clarify these choices without becoming a new authority for the person's anatomy.
- **This variation:** exactly which expression, pose, clothing, background, crop, or treatment the user asked to change.
  Preserve the other accepted choices. Expression and clothing are not permanently locked when the user requests them.

Do not infer fixed facial traits from lighting, lens distortion, a generated artifact, or a single stylized result.
A JSON representation is a portable record of decisions, not a guarantee of likeness or deterministic reproduction.
Keep the record within this task; durable profiles or public fixtures need the user's separate authorization.

## Choose The Correct Source

For a new variation, carry the original likeness reference and the approved treatment choices forward. Use an
accepted artwork as a labeled style reference only when it helps; do not silently replace the original with it.
Keep references explicit so a previous subject's colors, face, or clothing cannot migrate into the current subject.

For a local correction to an accepted image, use that accepted image as the edit target and preserve its successful
areas. State the changed region or feature. Keep the original available for identity clarification when necessary.
Restarting the whole portrait from the photo is not the default for a local fix.

When repeated edits drift, return to the best accepted result and the original reference, identify the changed
relationship, and revise that hypothesis. Do not keep feeding increasingly distorted generations into the next run.
Retain the production workflow's two-worsening-revisions stop condition.

## Inspect The Series

Compare each result with the original and the accepted treatment, not merely with the immediately preceding image.
Inspect face proportions and feature spacing separately from palette, line weight, detail density, and crop.
Treat a pleasing picture of a different-looking person as an identity finding. Identify any unrequested changes
instead of hiding them behind a single consistency score. Exact untouched pixels require a capable editing surface
and verification; a prompt that says “keep unchanged” does not prove preservation.
