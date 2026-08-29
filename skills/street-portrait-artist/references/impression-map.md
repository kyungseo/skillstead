# Impression Map

Build one compact identity model before choosing rendering details. This is a visual observation record, not a biometric
template and not a personality profile. Keep it private to the task unless the user explicitly asks to retain it.

## Reference Roles

Use `Quick Sketch` when one clear photo is sufficient. Treat its pose, expression, lighting, and camera distortion as a
bounded view rather than the whole person. State that the result is based on one view when that limitation matters.

Use `Studio Portrait` when two or three complementary references are available:

- `composition anchor`: owns pose, crop, expression, and viewing angle;
- `identity clarification`: may clarify hairline, jaw, eyewear, or another named feature;
- `optional expression reference`: may clarify a requested expression without replacing the composition anchor.

Never average faces, merge clothing, combine poses, or invent a synthetic third view. More references improve evidence
only when their roles are explicit.

## Map Fields

Record short, visible observations for these fields:

1. `Head frame`: the overall bounding geometry and relative upper, middle, and lower face proportions.
2. `T-axis`: eyebrow-to-nose structure, eye spacing, eye-axis angle, and the dominant vertical flow.
3. `Mouth-chin rhythm`: nose-to-mouth and mouth-to-chin distances, lip direction, jaw taper, and chin weight.
4. `Outer anchors`: hair silhouette and part, ears, eyewear, facial hair, neck, shoulders, and distinctive accessories.
5. `Expression`: eyebrow, eyelid, cheek, and mouth relationships visible in the composition anchor.
6. `Primary anchor`: the one relationship or silhouette that best organizes recognition in this image set.

Do not reduce the map to labels such as “large eyes” or “long face.” Record relationships: “wide eye spacing relative
to the narrow nose bridge,” or “compact upper face against a longer mouth-chin interval.” Do not infer character,
intelligence, mood beyond the visible expression, health, ethnicity, gender identity, or attractiveness.

## Primary Anchor

Choose one primary anchor, not a list of equally exaggerated features. Prefer a relationship supported across the
available references. It may be structural, expressive, or an outer anchor such as a characteristic hairstyle or
glasses. Avoid using a transient artifact, lens distortion, harsh shadow, or skin blemish as the anchor unless the user
explicitly asks for it.

The anchor should make the result recognizable and affectionate, not humiliating. When two anchors appear equally
plausible and would produce materially different portraits, show the alternatives briefly and ask the user to choose.

## Action-Reaction Redesign

Exaggeration is relational. When one part moves, enlarge, compress, rotate, or simplify a supporting part so the whole
face remains coherent:

- expanding the lower face may compress the upper face and simplify the forehead;
- widening eye spacing may narrow the central T-axis and reduce competing mouth detail;
- emphasizing a sweeping hair silhouette may simplify internal strands and keep facial proportions calmer;
- lifting one mouth corner may echo in the cheek and eye-axis rather than becoming an isolated symbol.

Preserve the composition anchor's pose and expression unless the user requests a change. Do not enlarge every feature,
default to a large head and large eyes, or treat generic cuteness as identity.

## Map Output

Keep the working map concise:

```text
Reference profile: Quick Sketch | Studio Portrait
Composition anchor: ...
Identity clarification: ...
Head frame: ...
T-axis: ...
Mouth-chin rhythm: ...
Outer anchors: ...
Expression: ...
Primary anchor: ...
Action-reaction plan: ...
Uncertainty: ...
```

Do not present the full private map unless useful to the user. The delivered `Artist's Note` should disclose only the
primary anchor, its structural consequence, and any material limitation.
