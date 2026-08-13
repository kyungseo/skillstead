---
spec_schema_version: 1
typepack_id: approval-gate
profile: constrained-layout
---

# TypePack: approval-gate

A simple request path with one approval gate.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `approval-gate` · **profile** `constrained-layout`
- **Selection signal** — a simple request path (a → b → c) with an approval gate or checkpoint.
- **Choose when** exactly one gate guards one arrow on a short path.
- **Do not choose when** the content needs lifelines, activations or alt-frames — full sequence diagrams are out of scope; use `process-flow` instead.

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `nodes[]` | 3–4 | name ≤ 2 lines |
| `gate.label` | exactly 1 | ≤ 1 line |
| `gate.criterion` | optional caption | ≤ 1 line under the band |

## 3. Semantic model and invariants

- Entities are **path nodes** in one row plus exactly one **gate**.
- Invariants: the gate attaches to exactly one arrow; the path is linear; nodes before and after the gate keep their order; there is never more than one gate.
- The gate is a control point, not a step — it is not numbered.

## 4. Intrinsic fit and variant contract

- Fit requires the single row to hold 3–4 node cards at the text floor plus two arrow runs, and the gate pill to sit above the guarded arrow without overlapping either neighbouring card.
- No variants are declared in Wave 1; if the content grows, the type changes (§6) rather than degrading.

## 5. Layout, encoding and connector rules

- One row, 3–4 nodes; the gate is a labelled pill (or small diamond) on or above the arrow it guards, with a dotted drop-line touching that arrow.
- Gate pill uses a warning/amber family with a check/shield icon.
- Pre-gate and post-gate arrows may differ (solid → thicker/coloured after approval).
- The gate criterion is a caption under the band, never inside the pill.

## 6. Degrade ladder

1. Move the criterion from the caption to the subtitle.
2. Shorten node names to the budget.
3. Switch archetype to `process-flow` when a second gate or interaction appears — this type is not stretched.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`).
- Checks: the dotted connector touches exactly one arrow; the gate pill does not collide with node cards; node count 3–4.
- **Receipt**: nodes in order, the guarded edge id, and the gate label.
- **Fixtures**: positive per preset + a baseline-red where the gate overlaps a node card. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is left → right (or top → bottom) and declared.
- The gate label and criterion are real text.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Two gates on one band (that is a flow).
- A gate pill floating without the dotted connector, so which arrow it guards is ambiguous.
- Numbering the gate as if it were a step.
- Stretching this type into a lifeline diagram.
