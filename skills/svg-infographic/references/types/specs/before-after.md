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
- 패널 높이 floor는 상수가 아니라 **최소 합법 문법에서 유도한다**: 헤더 예약 + (최소 slot 수 ×
  slot 높이) + slot 사이 간격 + 패널 안쪽 여백. 기호로 쓰면
  `panelFloor = panelHeaderH + minSlots × slotMinH + (minSlots − 1) × slotGap + 2 × panelPad`이고,
  변수 값은 모두 manifest `fit.params`가 소유한다. validator와 renderer가 **같은 derive helper**를
  호출하므로 문서·검증·렌더가 갈라질 수 없다. floor를 맞추려고 canonical의 slot 수를 늘리거나
  임의의 낮은 상수로 내리지 않는다.

## 5. Layout, encoding and connector rules

- Two equal-height, equal-width panels with a 32–48px gutter; optional centre arrow or migration chip between them; optional delta strip below.
- Mirrored slots align to the same y in both panels. 이 대칭은 눈으로 판정하지 않는다: slot `i`는
  두 패널에서 하나의 `data-align-row`에 속하고 참여 수 2를 선언하므로, 한쪽 slot이 어긋나거나
  annotation이 빠지면 hard error가 된다(design-kernel §7d). 패널 헤더는 `data-reserve-top`으로
  예약돼 대칭 판정에서 빠진다.
- A legend is required when three or more semantic colours appear.
- No connectors between panel internals — the mirror alignment carries the correspondence.

## 6. Degrade ladder

1. Drop the delta strip.
2. Reduce mirrored slots (removing the same slot from both panels).
3. Shorten slot text to the budget.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`).
- Checks: panel heights and widths equal; mirrored slots share a y; gutter ≥ 24 with balanced outer margins; legend present when required. 앞의 두 항목은 `check-layout.mjs`의 alignment 계약이 기계로 판정하고, artifact의 `data-align-inventory`는 원본 input에서 다시 계산한 기대치와 대조된다.
- **Receipt**: the mirrored slot list, per-slot change class, and the padding applied to the shorter panel.
- **Fixtures**: positive per preset + a baseline-red with ragged panel ends. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is BEFORE then AFTER, declared; within a panel, slot order.
- Change is never encoded by colour alone — the slot text says what changed.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Panels ending ragged because content differed.
- Slots that do not mirror, so the eye cannot diff.
- 한쪽 패널의 slot annotation만 남아 정렬 검사가 "남은 것끼리는 맞다"로 통과하는 경우.
- Colour-only change encoding with no legend and no text.
- A third panel bolted on.
