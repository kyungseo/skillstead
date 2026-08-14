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

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: row + gate pill clearance
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: **4:5 portrait에서 4노드는 성립하지 않는다**(needs-split). 4:5은 3노드가 상한이고,
  16:9은 4노드까지 성립한다.

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
