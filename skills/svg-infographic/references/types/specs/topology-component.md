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
| `zones[].nodes[]` | 1–4 per zone, ≤ 9 total | name ≤ 2 lines, one icon |
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
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: 4 zone × zone당 4 node까지 두 preset에서 성립한다. 그 이상은 zone을 합치거나 분리 페이지다.

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

**Machine (generic lint + layout guard, Wave 1에서 실제로 증명됨)**

- node → zone 소유(모든 node가 정확히 한 zone에 속함)와 zone containment
- edge가 존재하는 node만 참조하는지(dangling edge 없음)
- arrow-target clearance 8–12px, arrowhead 최소 크기
- 하나의 `cluster-h1`, module heading이 section scale에 머무름

**Visual / manual (Wave 1에서는 기계 증명 대상이 아님)**

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
