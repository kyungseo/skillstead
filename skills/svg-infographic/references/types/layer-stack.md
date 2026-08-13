# TypePack: layer-stack

Layered capability — each band builds on or abstracts the one below.

> Spec skeleton (Wave 1). Every TypePack fills these seven sections in this order;
> adding a type means adding one spec file + one manifest entry, and the core
> engine (generic lint, renderer, resolver) is not modified.

## 1. Selection contract

- **Selection signal (SSoT: manifest `selection_signal`)** — layered capability
  where each layer builds on or abstracts the one below: platform stacks, runtime
  layers, organisational capability models.
- **Choose when** the vertical order itself carries the dependency direction.
- **Do not choose when** the items are a flat set (that is `cards-kpi-grid`), a
  sequence of steps over time, or a containment relationship (nested regions).

## 2. Input contract

| Field | Cardinality | Budget |
| --- | --- | --- |
| `layers[].label` | 3–5 layers | one line, ≤ 28 CJK / ≤ 40 Latin characters |
| `layers[].items` | 0–4 chips per layer | one line each, ≤ 16 CJK / ≤ 24 Latin |
| `layers[].note` | optional, one per layer | one line, annotation column only |

More than five layers is a **degrade** input (§5), not a rendering problem: merge
adjacent layers or split the artifact rather than shrinking the band height.

## 3. Layout formulas

Inside the assigned region (page `contentBox`, or the slot the composition layer
assigned):

- Bands are **full region width**, identical `x` and `width`, stacked top to
  bottom with the most user-facing layer first.
- `bandHeight = clamp(72, (regionHeight − (n − 1) × gap) / n, 110)`; `gap` is one
  token from the scale profile (16–24 logical px) and is identical between every
  pair of bands.
- Chips inside a band are laid out with the last-edge formula:
  `chipWidth = (bandWidth − 2 × bandPad − (m − 1) × chipGap) / m`, and the last
  chip's right edge must equal `bandRight − bandPad` by construction, never by
  hand-tuned coordinates.
- A layer label and its chips share **one computed vertical center** per band.
- The optional annotation column reduces `bandWidth` for every band equally; it
  is never applied to a subset.

## 4. Connector and emphasis rules

- **No connectors.** Adjacency and order carry the dependency; drawing arrows
  between adjacent bands is an anti-pattern (§7).
- One colour family per layer (fill/line/ink from the same family). An optional
  light → saturated progression may point at the most important layer.
- At most one band carries emphasis.

## 5. Degrade ladder

1. Drop the annotation column (notes move to the subtitle or are dropped).
2. Reduce chips per band toward the declared minimum.
3. Merge adjacent layers, recording the merge in the receipt.
4. Return `needs-split` — a second artifact — rather than going below the band
   height floor or shrinking type.

Never resolve overflow by shrinking font size, stroke width or arrowheads.

## 6. Verification checklist

Machine-checked (generic lint + layout guard):

- every band shares one `x` and `width`; gaps between consecutive bands are equal
- chips stay inside their band's content box (last-edge formula holds)
- band height inside the 72–110 band after the scale profile is applied
- one `cluster-h1`; module headings stay at section scale

Reviewed visually:

- layer order actually encodes the dependency direction (state it in the subtitle
  when it is not obvious from the labels)
- the colour progression does not read as an unrelated categorical palette

## 7. Anti-patterns

- Arrows between adjacent bands ("stack" already means "on top of").
- Unequal band widths or per-band padding nudges.
- A band used as a section header for unrelated content.
- Turning the stack into a flow by numbering the bands.
