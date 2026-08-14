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
| `axes.{x,y}.tiers[]` | 2–3 ordered steps, **low → high** | label ≤ 1 line per step |
| `cells[]` | 4 (2×2) or 9 (3×3) | name ≤ 1 line, trait ≤ 1 line |
| `cells[].{x,y}` | required tier id on each axis | — |
| `cells[].examples[]` | optional | ≤ 2, ≤ 1 line each |
| `cells[].action` | optional pill | ≤ 1 line |

## 3. Semantic model and invariants

- Entities are **cells** addressed by their axis position; position is the claim. Placement derives from the
  **axis value** each cell declares (`x` / `y` tier id), never from array order: x tiers run low→high
  left→right, and y tiers run low→high **bottom→top**. 2 cells may not claim the same slot, and a
  position that disagrees with its axis values does not pass. A cell `name` is optional; when absent it
  derives from the two tier labels, so the input never has to invent copy like "Low-High" where the
  axis order is unreadable.
- Invariants: all cells are equal in size; both axes label **both** ends; every cell carries a name; at most one cell takes the emphasis toolkit.
- Qualitative only — saturation may encode severity but no numeric scale is asserted.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: grid 2×2 / 3×3 + axis gutter
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: 2×2 and 3×3 hold in both presets even after the axis gutter is subtracted. The corner
  decoration spacing is a budget already included in the cell floor.
- Grid width is computed from **what remains after the reservation**, not from the frame width:
  `gridW = contentW − reserveLeft − 2 × pad`, `cellW = (gridW − (cols − 1) × gapX) ÷ cols`
  (the vertical axis is symmetric). The axis label column is reserved with `data-reserve-left`, and the
  label width is not a constant — it is the maximum of the measured KO and EN strings. Laying out
  coordinates without subtracting this reservation makes cells touch the boundary, and touching it
  exactly is a hard error rather than a pass.

## 5. Layout, encoding and connector rules

- Four or nine equal panels with visible gutters; axis arrows drawn **outside** the panels; quadrant name labels inside their panel.
- **Ordinal axis grammar (this TypePack only).** Draw a vertical keyline left of the grid and a
  horizontal keyline below it, with a small direction marker only at the positive end (up, right). The
  end tier labels align to each axis endpoint, and the axis line stays inside the reservation without
  touching either the grid or a label (the clearance is computed, not a fixed constant). This axis is an
  **ordinal category direction** — not a chart axis expressing numeric intervals — so it never grows
  ticks, numeric scales or gridlines. The axis is not a connector: it carries no `data-route-*`
  classification, is not subject to the routing audit, and its direction marker is derived from the same
  arrow-scale formula as connectors but thinner, so it never outranks a primary connector arrow
  visually. 2×2, 3×3 and incomplete grids all use the same grammar, and KO and EN share one axis geometry.
- A cell carries a row id **and** a column id at once (`data-align-row` + `data-align-col`, each
  declaring its participant count). Position is the claim, so cross alignment is decided by machine
  (design-kernel §7d).
- The grid may be incomplete. When the last row falls short it asserts no equal-gap group and **column
  alignment governs instead**; an axis left with a single participant forms no group at all. No
  placeholder cell is invented to fill a hole.
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
- Checks: cells exactly equal; both ends of both axes labelled; axis labels clear of panel corners; corner decorations meet the ≥ 20–24px separation. Cell equality and row/column cross alignment are decided by `check-layout.mjs`, and `data-align-inventory` is compared against an expectation recomputed from the original input. **Corner crowding is this type's top failure — verify it against the exported PNG, not only the SVG source.**
- Axis checks (geometry included — checking labels alone would pass an artifact with no axis at all):
  each axis is drawn exactly once with the right orientation · a direction marker sits at the positive
  end · the endpoint labels are placed consistently with that direction · the axis does not intrude into
  the grid or cell bounds · each cell sits at the row and column recomputed from its input axis values.
  That last item is compared against a recomputation from the **original input**, not from the receipt.
- **Receipt**: cells with their axis position, the emphasised cell, and dropped optional content.
  The `matrix` block records the axis kind (`ordinal-direction`), tier order and positive direction,
  plus each cell's axis values, row, column and alignment group ids.
- **Fixtures**: positive per preset + a baseline-red with crowded corners. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is a declared value and must match DOM order. **The default is the DOM-friendly
  top-row-first** order (top-left → top-right → bottom-left → bottom-right). When the axis meaning
  requires reading from the bottom row up (for example low risk → high risk), the input must
  **declare that order explicitly** rather than leaving it to an implicit default.
- Severity is never colour-only: the cell trait states it.
- KO and EN budgets are per script; corner decorations are budgeted per script too.

## 9. Anti-patterns and known failures

- Corner crowding — the top failure; badge, status and icon collide at small sizes.
- One axis labelled at only one end.
- Cells resized to fit longer text.
- Computing the grid from the frame width, ignoring the axis label reservation, so cells touch the boundary.
- Filling by array order so the "low" row lands on top — the axis labels and the cell meaning end up reversed.
- Floating the axis end labels while omitting the axis lines and direction markers, leaving the two-axis direction unreadable.
- Stretching cells to the canvas height so two lines of content sit in a large empty vertical area.
- Inserting an empty placeholder cell to make the grid look rectangular.
- Saturation read as a numeric severity score.
