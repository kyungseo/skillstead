---
spec_schema_version: 1
typepack_id: decision-matrix
profile: constrained-layout
---

# TypePack: decision-matrix

Options placed by two qualitative axes.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `decision-matrix` · **profile** `constrained-layout`
- **Selection signal** — options or items placed by two qualitative axes: 2×2 priority/decision quadrants, 3×3 risk severity grid.
- **Choose when** the two axes are qualitative and the placement itself is the argument.
- **Do not choose when** the axes carry measured values — that is a data-accuracy type, not this one.

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `axes` | exactly 2, each with both end labels | ≤ 1 line per end |
| `cells[]` | 4 (2×2) or 9 (3×3) | name ≤ 1 line, trait ≤ 1 line |
| `cells[].examples[]` | optional | ≤ 2, ≤ 1 line each |
| `cells[].action` | optional pill | ≤ 1 line |

## 3. Semantic model and invariants

- Entities are **cells** addressed by their axis position; position is the claim.
- Invariants: all cells are equal in size; both axes label **both** ends; every cell carries a name; at most one cell takes the emphasis toolkit.
- Qualitative only — saturation may encode severity but no numeric scale is asserted.

## 4. Intrinsic fit and variant contract

- Fit requires each cell to hold name + trait at the floor **and** keep the corner-decoration budget: badge, status label and corner icon need ≥ 20–24px between bounding boxes.
- Axis label gutters are reserved outside the panel block before cells are sized; when the remaining block cannot meet the cell floor, §6 applies.
- 3×3 is a declared variant of the same type with a tighter per-cell budget (no examples).

## 5. Layout, encoding and connector rules

- Four or nine equal panels with visible gutters; axis arrows drawn **outside** the panels; quadrant name labels inside their panel.
- One colour family per cell; risk grids encode severity by saturation (low light → high saturated).
- Corner decorations are placed by rule: badge top-left, status label on the same row right of the badge, icon top-right.
- No connectors between cells.

## 6. Degrade ladder

1. Drop cell examples.
2. Drop the recommended-action pill.
3. Reduce 3×3 to 2×2 when the input allows, recording the merge.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`).
- Checks: cells exactly equal; both ends of both axes labelled; axis labels clear of panel corners; corner decorations meet the ≥ 20–24px separation. **Corner crowding is this type's top failure — verify it against the exported PNG, not only the SVG source.**
- **Receipt**: cells with their axis position, the emphasised cell, and dropped optional content.
- **Fixtures**: positive per preset + a baseline-red with crowded corners. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is declared (default: bottom-left → bottom-right → top-left → top-right for 2×2) and must match DOM order.
- Severity is never colour-only: the cell trait states it.
- KO and EN budgets are per script; corner decorations are budgeted per script too.

## 9. Anti-patterns and known failures

- Corner crowding — the top failure; badge, status and icon collide at small sizes.
- One axis labelled at only one end.
- Cells resized to fit longer text.
- Saturation read as a numeric severity score.
