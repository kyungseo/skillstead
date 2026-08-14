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

- Entities are **cells** addressed by their axis position; position is the claim. 자리는 배열 순서가
  아니라 cell이 선언한 **축 값**(`x`/`y` tier id)에서 파생한다: x tier는 낮음→높음이 왼→오,
  y tier는 낮음→높음이 **아래→위**다. 같은 칸을 두 cell이 주장할 수 없고, 축 값과 어긋난 자리는
  통과하지 못한다. cell `name`은 선택이며 없으면 두 축 tier label에서 파생한다 — "낮음-높음"처럼
  어느 축이 먼저인지 알 수 없는 문안을 입력이 지어내지 않게 하기 위해서다.
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
- 격자 폭은 frame 폭이 아니라 **예약을 뺀 나머지**에서 계산한다:
  `gridW = contentW − reserveLeft − 2 × pad`, `cellW = (gridW − (cols − 1) × gapX) ÷ cols`
  (세로도 동형). 축 라벨 열은 `data-reserve-left`로 예약되며, 라벨 폭은 상수가 아니라 KO·EN 실제
  문자열을 측정한 값의 최댓값이다. 이 예약을 빼지 않고 좌표를 잡으면 셀이 경계에 닿고, 경계에
  정확히 닿는 경우도 통과가 아니라 hard error다.

## 5. Layout, encoding and connector rules

- Four or nine equal panels with visible gutters; axis arrows drawn **outside** the panels; quadrant name labels inside their panel.
- **Ordinal axis grammar (this TypePack only).** 격자 왼쪽에 세로 keyline, 아래에 가로 keyline을
  그리고 positive 끝(위·오른쪽)에만 작은 direction marker를 둔다. 양끝 tier label이 각 축 끝점에
  정렬하고, 축선은 예약 구간 안에서 격자와 label 어느 쪽에도 닿지 않는다(clearance는 계산값이며
  고정 상수가 아니다). 이 축은 **ordinal category direction**이다 — 수치 간격을 나타내는 chart
  axis가 아니므로 tick·숫자 눈금·gridline으로 확장하지 않는다. 축은 connector가 아니다:
  `data-route-*`로 분류하지 않고 routing audit 대상도 아니며, direction marker는 primary
  connector arrow보다 얇게(시각적 우선순위가 낮게) 같은 arrow scale 산식에서 파생한다.
  2×2·3×3·불완전 격자가 모두 같은 문법을 쓰고 KO/EN이 같은 축 기하를 갖는다.
- 셀은 행 id와 열 id를 **동시에** 갖는다(`data-align-row` + `data-align-col`, 각각 참여 수 선언).
  위치가 곧 주장이므로 교차 정렬은 기계로 판정한다(design-kernel §7d).
- 격자가 완전히 차지 않을 수 있다. 마지막 행이 부족하면 그 행은 등간격 group을 주장하지 않고
  **열 정렬이 대신 지배**하며, 참여자가 하나뿐인 축은 group 자체를 만들지 않는다. 빈 칸을 채우는
  자리표시자 셀은 만들지 않는다.
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
- Checks: cells exactly equal; both ends of both axes labelled; axis labels clear of panel corners; corner decorations meet the ≥ 20–24px separation. 셀 동일성과 행·열 교차 정렬은 `check-layout.mjs`가 판정하고, `data-align-inventory`는 원본 input에서 다시 계산한 기대치와 대조된다. **Corner crowding is this type's top failure — verify it against the exported PNG, not only the SVG source.**
- Axis checks (기하까지 본다 — 라벨만 보면 축이 없어도 통과한다): 두 축이 각각 정확히 한 번 그려지고
  orientation이 맞을 것 · positive 끝에 direction marker가 있을 것 · 끝점 label의 배치가 그 방향과
  같은 뜻일 것 · 축이 grid/cell bounds를 침범하지 않을 것 · cell 자리가 입력 축 값에서 다시 계산한
  기대 행·열과 일치할 것. 마지막 항목은 receipt가 아니라 **원본 입력**에서 재계산해 대조한다.
- **Receipt**: cells with their axis position, the emphasised cell, and dropped optional content.
  `matrix` 블록에 축 kind(`ordinal-direction`)·tier 순서·positive 방향과 cell별 축 값·행·열·정렬
  group id를 기록한다.
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
- 축 라벨 예약을 무시하고 frame 폭으로 격자를 계산해 셀이 경계에 닿는 경우.
- 배열 순서대로 채워 "낮음" 행이 위로 올라가는 경우 — 축 라벨과 cell 의미가 반대가 된다.
- 축 끝 label만 띄우고 축선·방향 marker를 생략해 2축 방향성이 읽히지 않는 경우.
- cell을 canvas 높이에 맞춰 늘려 두 줄짜리 내용이 빈 세로 면적을 갖는 경우.
- 격자를 네모나게 보이려고 빈 자리표시자 셀을 넣는 경우.
- Saturation read as a numeric severity score.
