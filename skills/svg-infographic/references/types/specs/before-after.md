---
spec_schema_version: 1
typepack_id: before-after
profile: constrained-layout
---

# TypePack: before-after

Old versus new, side by side.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `before-after` · **profile** `constrained-layout`
- **Selection signal** — old vs new: migration, modernisation, refactor outcome, trade-off comparison.
- **Choose when** the reader must diff two states slot by slot.
- **Do not choose when** there are three or more states (that is a `roadmap-timeline`) or when only the outcome matters (`cards-kpi-grid`).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `panels` | exactly 2 (before, after) | title ≤ 1 line |
| `panels[].slots[]` | 2–5, **mirrored** | ≤ 2 lines each |
| `delta[]` | optional strip | ≤ 3 items, ≤ 1 line each |

## 3. Semantic model and invariants

- Entities are **two states** with **mirrored slots**: slot `i` in BEFORE and slot `i` in AFTER address the same concern.
- Invariants: both panels declare the same slot list; panel heights and widths are equal regardless of content; semantic colour encodes change (unchanged neutral, added green, removed red, changed amber).
- The comparison asserts change, not magnitude — no proportional encoding.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: row (2 panels)
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: both panels and the gutter hold in both presets. The taller panel sets the height and the
  shorter one is **padded** to match.
- The panel height floor is not a constant — it is **derived from the minimum legal syntax**: the header
  reservation, plus (minimum slot count × slot height), plus the gaps between slots, plus the panel's
  inner padding. Symbolically:
  `panelFloor = panelHeaderH + minSlots × slotMinH + (minSlots − 1) × slotGap + 2 × panelPad`,
  and the manifest `fit.params` owns every variable. The validator and the renderer call the **same
  derive helper**, so the document, the check and the render cannot drift apart. Never raise the
  canonical slot count to reach the floor, and never lower the floor to an arbitrary constant.

## 5. Layout, encoding and connector rules

- Two equal-height, equal-width panels with a 32–48px gutter; optional centre arrow or migration chip between them; optional delta strip below.
- Mirrored slots align to the same y in both panels. This symmetry is not judged by eye: slot `i` joins
  one `data-align-row` across both panels and declares a participant count of 2, so a slot that drifts —
  or an annotation that goes missing — becomes a hard error (design-kernel §7d). The panel header is
  reserved with `data-reserve-top` and is therefore excluded from the symmetry judgement.
- A legend is required when three or more semantic colours appear.
- No connectors between panel internals — the mirror alignment carries the correspondence.

## 6. Degrade ladder

1. Drop the delta strip.
2. Reduce mirrored slots (removing the same slot from both panels).
3. Shorten slot text to the budget.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`).
- Checks: panel heights and widths equal; mirrored slots share a y; gutter ≥ 24 with balanced outer margins; legend present when required. The first two are decided by machine through the alignment contract in `check-layout.mjs`, and the artifact's `data-align-inventory` is compared against an expectation recomputed from the original input.
- **Receipt**: the mirrored slot list, per-slot change class, and the padding applied to the shorter panel.
- **Fixtures**: positive per preset + a baseline-red with ragged panel ends. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is BEFORE then AFTER, declared; within a panel, slot order.
- Change is never encoded by colour alone — the slot text says what changed.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Panels ending ragged because content differed.
- Slots that do not mirror, so the eye cannot diff.
- Only one panel keeping its slot annotations, so the alignment check passes on "the survivors agree".
- Colour-only change encoding with no legend and no text.
- A third panel bolted on.
