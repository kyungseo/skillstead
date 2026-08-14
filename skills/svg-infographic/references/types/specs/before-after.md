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

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: row(패널 2개)
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: 두 패널과 gutter가 두 preset에서 성립한다. 높이는 긴 쪽이 정하고 짧은 쪽을 **패딩**한다.

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
