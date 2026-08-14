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

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: column
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: **the chip budget sets the band width.** The base floor holds the label gutter plus 2
  chips (16 CJK characters each); the `wide` floor that demands 4 chips **does not hold in 4:5**
  (needs-split; 16:9 does). When 4:5 needs 4 chips, shorten the chip copy or split the page.
  Clamping applies only **after** the feasibility decision.

## 5. Layout, encoding and connector rules

- Bands are **full region width** with identical `x` and `width`, stacked top to
  bottom, most user-facing first, separated by one constant gap token (16–24px).
- Chips use the last-edge formula:
  `chipWidth = (bandWidth − 2 × bandPad − (m − 1) × chipGap) / m`; the last chip's
  right edge equals `bandRight − bandPad` by construction, never by hand-tuned
  coordinates.
- A layer label and its chips share one computed vertical center per band.
- The optional annotation column reduces `bandWidth` for **every** band equally.
- Chips are **content-sized** (the widest chip text across locales sets one uniform
  width); the run is right-aligned so the last chip's right edge meets
  `bandRight − bandPad` by construction. Everything left of the run is the reserved
  label column — declared, not implied, so the symmetry check measures from it.
  A band **without** chips is the minimal variant of this type (canonical carries
  representative chips; `stress-copy` exercises the chip-less form).
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
