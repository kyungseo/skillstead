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

- Fit requires `2 × panelW + gutter ≤ regionW` with `gutter ≥ 24` (target 32–48) and each panel keeping its slot floors; the taller panel sets the shared height and the shorter one is **padded**, never trimmed.
- When the mirrored slot count cannot fit at the floor, §6 applies; panels are never made unequal to fit.

## 5. Layout, encoding and connector rules

- Two equal-height, equal-width panels with a 32–48px gutter; optional centre arrow or migration chip between them; optional delta strip below.
- Mirrored slots align to the same y in both panels.
- A legend is required when three or more semantic colours appear.
- No connectors between panel internals — the mirror alignment carries the correspondence.

## 6. Degrade ladder

1. Drop the delta strip.
2. Reduce mirrored slots (removing the same slot from both panels).
3. Shorten slot text to the budget.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`).
- Checks: panel heights and widths equal; mirrored slots share a y; gutter ≥ 24 with balanced outer margins; legend present when required.
- **Receipt**: the mirrored slot list, per-slot change class, and the padding applied to the shorter panel.
- **Fixtures**: positive per preset + a baseline-red with ragged panel ends. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is BEFORE then AFTER, declared; within a panel, slot order.
- Change is never encoded by colour alone — the slot text says what changed.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Panels ending ragged because content differed.
- Slots that do not mirror, so the eye cannot diff.
- Colour-only change encoding with no legend and no text.
- A third panel bolted on.
