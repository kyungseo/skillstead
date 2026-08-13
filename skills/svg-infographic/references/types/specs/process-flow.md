---
spec_schema_version: 1
typepack_id: process-flow
profile: constrained-layout
---

# TypePack: process-flow

Ordered steps or handoffs.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `process-flow` · **profile** `constrained-layout`
- **Selection signal** — ordered steps or handoffs: process, pipeline, data flow, review loop.
- **Choose when** the order is the message and each step hands off to the next.
- **Do not choose when** items are peers (`cards-kpi-grid`), layered capability (`layer-stack`) or a single approval gate (`approval-gate`).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `steps[]` | ≤ 5 on the main row | name ≤ 2 lines |
| `branches[]` | optional, drop below and rejoin | ≤ 2 |
| `feedback` | optional, one dashed return | label required |
| `lanes[]` (swimlane variant) | 2–3 actors/tracks | lane label ≤ 1 line |

## 3. Semantic model and invariants

- Entities are **ordered steps**; edges are handoffs and are directed.
- Invariants: the main path is a single sequence; a branch leaves and rejoins the main path; a feedback edge is dashed and labelled; step badges are numbered because sequence matters.
- In the swimlane variant a step belongs to exactly one lane and stage columns share an x-position across lanes.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: row(가로) / column(세로)
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: **4:5 portrait에서 5단계는 가로로 성립하지 않는다** — 가로 압축이 아니라 top→bottom(column)으로 배치한다. 16:9은 가로 5단계가 성립한다.

## 5. Layout, encoding and connector rules

- Main path left → right on one row (or top → bottom); branches drop to a lower row and rejoin; feedback returns as a dashed arc.
- Numbered step badges; the key step gets the emphasis toolkit (stroke + shadow + badge, no top accent bar).
- Solid = normal path, dashed = feedback/async, with a legend when both appear.
- Arrowheads keep an 8–12px gap; no crossing edges.

## 6. Degrade ladder

1. Merge adjacent steps that share an actor.
2. Demote secondary steps into a branch row.
3. Drop edge labels to the legend.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`); generic lint covers arrow geometry, the layout guard covers row containment.
- Checks: ≤ 5 main nodes; no crossing edges; arrow gaps; feedback dashed and labelled; swimlane stage columns aligned and lane labels clear of the first column.
- **Receipt**: steps in order, branch attach/rejoin points, feedback edge, lanes when used.
- **Fixtures**: positive per preset + a baseline-red with six main nodes. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is the step order and is declared; DOM order must match.
- Step names are real text; numbers are text, not baked into an icon.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Six or more nodes squeezed onto the main row.
- A feedback loop drawn solid, so it reads as another forward step.
- Branches that never rejoin (they are a second flow — split instead).
- Crossing edges accepted because "the process really is like that".
