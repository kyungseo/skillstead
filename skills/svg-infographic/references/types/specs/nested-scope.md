---
spec_schema_version: 1
typepack_id: nested-scope
profile: constrained-layout
---

# TypePack: nested-scope

Containment or scope — inner things live inside outer things.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `nested-scope` · **profile** `constrained-layout`
- **Selection signal** — containment or scope: trust zones, scope rings, platform → app → feature.
- **Choose when** the relationship is "inside of", and the nesting depth is the message.
- **Do not choose when** the relation is order (`process-flow`), dependency layers (`layer-stack`) or peer items (`cards-kpi-grid`).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `rings[].label` | 3–4 rings, outermost first | one line, ≤ 20 CJK / ≤ 30 Latin |
| `rings[].core_icon` | innermost only, optional | one glyph |
| `rings[].callout` | optional, one per ring | one line, side column only |

Five or more rings is a degrade input (§6): merge rings or split the artifact.

## 3. Semantic model and invariants

- Entities are **nested regions**; `ring-1` is the outermost and each subsequent ring is strictly contained by the previous one.
- Containment is total and ordered: a ring never overlaps a sibling, and there are no siblings at the same depth.
- Invariants: every ring carries a label placed in its own visible strip; the innermost ring is the core and may carry an icon; depth ≤ 4.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: concentric
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: the core holds a single-line label of up to 20 CJK characters and the insets are
  uniform. 4 rings hold in both presets.

## 5. Layout, encoding and connector rules

- 3–4 concentric rounded rects (or circles for a radial reading), each inset by the computed uniform amount.
- Each ring label sits in its **top strip, centred** — the band not covered by the next ring — and is measured against that strip, not against the ring as a whole.
- Colour runs light (outer) → saturated (inner); ring labels use their own ring's ink.
- Optional side callouts attach with thin leader lines; leaders never cross a ring boundary label.
- No arrows: containment is the relation.

## 6. Degrade ladder

1. Drop side callouts.
2. Shorten ring labels to the budget.
3. Merge adjacent rings, recording the merge.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`); the generic lint plus the layout guard cover containment and label placement.
- Checks that must pass: ring insets uniform within tolerance; every label fully inside its own visible strip and clear of the inner ring; ring count 3–4.
- **Receipt**: entities `ring-1 … ring-n`, computed inset, and any merge.
- **Fixtures**: positive per preset + a baseline-red where a label overlaps the inner ring. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is outermost → innermost and declared.
- `<title>`/`<desc>` carry the conclusion; ring labels are real text.
- KO and EN budgets are per script; a label that fits EN but not KO is a fit failure.

## 9. Anti-patterns and known failures

- Eyeballed insets that drift between rings.
- A label placed over the next ring because its own strip was too short.
- Five or more rings ("just one more scope").
- Arrows added between rings, which turns containment into flow.
