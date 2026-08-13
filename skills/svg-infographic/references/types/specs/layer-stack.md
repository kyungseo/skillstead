---
spec_schema_version: 1
typepack_id: layer-stack
profile: constrained-layout
---

# TypePack: layer-stack

Layered capability — each band builds on or abstracts the one below.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest. Adding a type means adding one
> spec file here and one manifest row; the core engine (generic lint, renderer,
> resolver) is not modified.

## 1. Identity and selection

- **TypePack id** `layer-stack` · **profile** `constrained-layout`
- **Selection signal (SSoT: manifest `selection_signal`)** — layered capability
  where each layer builds on or abstracts the one below: platform stacks, runtime
  layers, organisational capability models.
- **Choose when** the vertical order itself carries the dependency direction.
- **Do not choose when** the items are a flat peer set (`cards-kpi-grid`), a
  sequence of steps over time, or a containment relationship (nested regions).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `layers[].label` | 3–5 layers | one line, ≤ 28 CJK / ≤ 40 Latin characters |
| `layers[].items` | 0–4 chips per layer | one line each, ≤ 16 CJK / ≤ 24 Latin |
| `layers[].note` | optional, one per layer | one line, annotation column only |

More than five layers is a **degrade** input (§6): merge adjacent layers or split
the artifact rather than shrinking the band height.

## 3. Semantic model and invariants

- Entities are **ordered layers**; adjacency means "sits directly on top of", and
  the order is the dependency direction (top = most user-facing).
- Each layer has a stable `entity_id` (`layer-1 … layer-n`, bottom to top) and
  chips are subordinate to their layer, never independent entities.
- Invariants: the order is total and carries meaning; no layer is skipped; chips
  never span two layers; the stack asserts dependency, not sequence in time.

## 4. Intrinsic fit and variant contract

Fit is decided **before** clamping. With `n` layers, gap token `g` and the floor
`bandMin = 72`:

- required height `H_req = n × bandMin + (n − 1) × g`
- if `H_req > regionH` the type does **not** fit — §6 applies (merge layers or
  `needs-split`). It must not clamp a band up to the floor and overflow the region.
- otherwise `bandHeight = min(110, (regionH − (n − 1) × g) / n)`, identical for
  every band; leftover height stays as declared residual, it is not absorbed by
  stretching one band.

| Variant | Min slot (w × h) | Fits | Meaning kept |
| --- | --- | --- | --- |
| `base` | 640 × (n × 72 + (n − 1) × g) | 3–5 layers with chips | labels + chips (+ notes) |

No `compact` variant is declared: below the band floor the chips stop being
readable, so the ladder goes to merge/split instead.

## 5. Layout, encoding and connector rules

- Bands are **full region width** with identical `x` and `width`, stacked top to
  bottom, most user-facing first, separated by one constant gap token (16–24px).
- Chips use the last-edge formula:
  `chipWidth = (bandWidth − 2 × bandPad − (m − 1) × chipGap) / m`; the last chip's
  right edge equals `bandRight − bandPad` by construction, never by hand-tuned
  coordinates.
- A layer label and its chips share one computed vertical center per band.
- The optional annotation column reduces `bandWidth` for **every** band equally.
- **No connectors.** Adjacency carries the dependency; one colour family per layer,
  optional light → saturated progression toward the most important layer; at most
  one band emphasised.

## 6. Degrade ladder

1. Drop the annotation column (notes move to the subtitle or are dropped).
2. Reduce chips per band toward the declared minimum.
3. Merge adjacent layers, recording the merge in the receipt.
4. Return `needs-split` rather than going below the band floor or shrinking type.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none beyond the generic lint and layout guard
  (`verifier: null`) — this type makes no accuracy claim.
- Generic checks that must pass: every band shares one `x`/`width`; equal gaps;
  chips inside their band content box; band height inside `[72, 110]` **after** the
  §4 feasibility check; one `cluster-h1`.
- **Receipt**: entities `layer-1 … layer-n`, merged layers listed with what was
  combined, and the residual height left after §4.
- **Fixtures**: a positive artifact per supported preset plus a baseline-red pair
  for the pre-clamp feasibility rule, registered in the manifest `fixtures` list.
  Required before this type may claim `core`.

## 8. Reading order, accessibility and locale

- Reading order is top to bottom and declared; when the dependency direction is
  not obvious from the labels, the subtitle states it.
- `<title>`/`<desc>` carry the conclusion; labels and chips are real text.
- KO and EN are both first-class: §2 budgets are per script, and a label that fits
  in EN but not KO is a fit failure.

## 9. Anti-patterns and known failures

- Arrows between adjacent bands ("stack" already means "on top of").
- Unequal band widths or per-band padding nudges.
- A band used as a section header for unrelated content.
- Numbering the bands, which turns the stack into a flow.
- Known failure: clamping the band height up to the floor when the region is too
  short — that overflows the region instead of degrading. §4 decides first.
