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

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: grid 2×2 / 3×3 + axis gutter
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: 축 gutter를 제외한 뒤에도 2×2와 3×3이 두 preset에서 성립한다. corner decoration 간격은
  cell floor에 포함된 예산이다.

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

- Reading order는 선언값이며 DOM 순서와 일치해야 한다. **기본값은 DOM 친화적인 top-row-first**
  (top-left → top-right → bottom-left → bottom-right)다. 축 의미상 아래 행부터 읽어야 하는
  경우(예: 저위험 → 고위험 상승)에는 입력이 그 순서를 **명시적으로 선언**해야 하며, 암묵적
  기본값으로 두지 않는다.
- Severity is never colour-only: the cell trait states it.
- KO and EN budgets are per script; corner decorations are budgeted per script too.

## 9. Anti-patterns and known failures

- Corner crowding — the top failure; badge, status and icon collide at small sizes.
- One axis labelled at only one end.
- Cells resized to fit longer text.
- Saturation read as a numeric severity score.
