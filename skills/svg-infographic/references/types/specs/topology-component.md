---
spec_schema_version: 1
typepack_id: topology-component
profile: editorial-composition
---

# TypePack: topology-component

Systems, components and their links inside zones.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `topology-component` · **profile** `editorial-composition`
- **Selection signal** — systems/components and their links: request paths, cloud/network zones, service architecture with a system boundary.
- **Choose when** both the grouping (zone) and the links between components carry meaning.
- **Do not choose when** the message is a linear sequence (`process-flow`) or a pure capability stack (`layer-stack`).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `zones[].label` | 2–4 zones, entry → app → data | one line, ≤ 18 CJK / ≤ 28 Latin |
| `zones[].nodes[]` | zone당 1–4개, **총 9개 이하**(두 상한이 동시에 적용된다) | name ≤ 2 lines, one icon |
| `edges[]` | ≤ 12 | optional label ≤ 1 line |
| `boundary` | optional, one system boundary | label ≤ 1 line |

## 3. Semantic model and invariants

- Entities are **components** grouped into ordered **zones**; edges are directed dependencies.
- Invariants: every node belongs to exactly one zone; an edge references existing nodes; direction is consumer → provider; external actors sit outside the boundary frame when one is declared.
- The zone order encodes depth (ingress → app → data) and is not decorative.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: grid(zone × zone당 node)
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: **계층형 경계 상자**로 판정한다 — 가장 넓은 zone(노드 행)과 가장 깊은 stack(zone 수)을
  동시에 만족하는 상자이며 zone label band·zone padding·zone 간 routing corridor를 포함한다.
  Wave 1 검증 구성은 zone ≤ 4, 한 zone 최대 4 node, **총 node ≤ 9**이고, footprint는 그
  상한(가장 넓은 zone × 가장 깊은 stack)을 계산하므로 어떤 합법 구성도 이 안에 들어간다.
  두 preset에서 성립한다.

## 5. Layout, encoding and connector rules

- Top → bottom by depth; components are white icon cards inside their zone frame; zone tint comes from that layer's colour family.
- **No crossing edges**: route orthogonally around, or move the node. When nodes collide, assign each to a 3×3 zone cell and route only between cells, grouping co-located nodes in one frame.
- Every arrow lands with an 8–12px gap before its target; edge labels sit beside the line, never on it.
- A legend is required when both solid (request) and dashed (private/async) lines appear.

## 6. Degrade ladder

1. Drop edge labels to the legend.
2. Merge co-located nodes into one frame.
3. Reduce to the primary request path (demote secondary edges).
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

원본 archetype의 check를 **기계가 증명하는 것**과 **사람이 보거나 이후 verifier가 증명할
것**으로 나눈다. 규칙을 §5에 적는 것과 그 규칙이 검증된다고 말하는 것은 다르다.

**Machine (generic guard가 실제로 검사하는 것)**

generic lint와 layout guard는 **annotation이 붙은 일반 geometry**를 검사한다 — topology
의미 모델을 아는 전용 경로는 Wave 1에 없다.

- annotated container/child containment(zone frame 안에 node 카드가 들어가는지)
- SVG reference 무결성(`url(#…)`·dangling id)과 중복 id
- arrow-target clearance 8–12px, arrowhead 최소 크기
- 하나의 `cluster-h1`, module heading이 section scale에 머무름

**아직 증명되지 않음(등록 fixture 없음).** 위 항목도 이 TypePack의 fixture가 등록되기
전까지는 *계약*이며 통과 증거가 아니다. "proved"라고 말할 수 있는 것은 실제 fixture로
통과시킨 항목뿐이다.

**Visual / manual (Wave 1에서는 기계 증명 대상이 아님)**

- node → zone **semantic** ownership(annotation이 아닌 의미 모델 수준)
- edge endpoint가 실재하는 node를 가리키는지(semantic dangling)
- edge crossing 없음 — 현재는 육안 확인이며 자동 판정하지 않는다
- edge label이 선 **옆**에 있고 선 위에 놓이지 않았는지
- external actor가 system boundary **밖**에 있는지
- 3×3 cell 재배치 후 실제로 읽히는지

**Future verifier (Wave 2 topology verifier)**

reachability·cycle·completeness 주장은 verifier가 생기기 전에는 할 수 없다. 그때까지
receipt는 선언된 사실(zone·node·edge·direction·boundary)만 담고, 위 visual 항목은
증명이 아니라 검토 항목으로 남는다.

- **Verifier**: `verifier: null`(Wave 1) — topology annex를 선언한 TypePack은 verifier와
  receipt schema가 등록되기 전에는 `core`로 승격되지 않는다(manifest validator가 강제).
- **Receipt**: zones, node→zone 소유, edges(semantic kind·delivery·visibility·direction),
  boundary.
- **Fixtures**: preset별 positive + crossing edge baseline-red. 하나의 artifact는 하나의
  (kind, preset) 주장만 담당한다.

## 8. Reading order, accessibility and locale

- Reading order follows the request path and is declared; when it is not obvious the subtitle states the entry point.
- Node names and edge labels are real text; icons never replace a name.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Crossing edges "because the graph is complex" — re-cell instead.
- Arrows that touch the target card (no gap) or labels sitting on the line.
- A boundary frame drawn but external actors placed inside it.
- More than nine nodes on one canvas.

## A1. Topology contract

### Entity identity
Nodes are `node-<slug>` and zones are `zone-<slug>`; ids are stable within one artifact and are what edges and receipts reference. A node's identity never depends on its position.

### Edge kind and direction
Edge는 세 축을 **분리해서** 기록한다 — 의미(kind)와 전달 방식(delivery), 노출 범위
(visibility)를 하나로 합치면 "private sync edge" 같은 조합이 receipt에서 사라진다.

- `kind: request | dependency` — 의미상 무엇인지
- `delivery: sync | async` — 동기/비동기
- `visibility: public | private` — 경계 안팎 노출

방향은 항상 consumer → provider로 읽는다. **선 스타일은 이 셋에서 파생된다**:
`delivery: async` 또는 `visibility: private`이면 dashed, 그 외에는 solid. 두 스타일이
함께 나오면 legend가 필요하며, legend는 스타일이 아니라 그것이 뜻하는 축을 설명한다.

### Cardinality
At most 12 edges and 9 nodes per artifact; a node may have any in-degree but an edge references exactly one source and one target, both of which must exist.

### Cycle policy
Cycles are permitted only when the input declares them (a feedback dependency); an undeclared cycle is an input error, not a routing problem, because it usually means the direction convention was inverted.

### Traversal and reading order
Traversal is declared explicitly and must agree with DOM order; the default is zone order (ingress → app → data) and, inside a zone, left to right.

### Topology verifier and receipt boundary
Wave 1 ships no topology verifier: the receipt records nodes, zones, edges and direction, and the generic lint proves geometry only. Any claim about reachability, cycles or completeness needs the Wave 2 verifier before it may be asserted, and `core` promotion is blocked until then.
