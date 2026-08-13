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

- Zone bands are full region width; a zone's height is driven by its own node rows, and all zones share one gap token.
- Fit requires each node card to keep its icon + two text lines above the floor and each zone to keep at least one full row; when a zone would need a second row beyond the region, the type does not fit and §6 applies.
- No variants are declared in Wave 1; composition capability is not declared either.

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

- **Machine verifier**: none in Wave 1 (`verifier: null`); the generic lint covers arrow geometry and the layout guard covers zone containment. A topology verifier is the Wave 2 item named in the annex.
- **Receipt**: zones, nodes with their zone, edges with direction, and the boundary when present.
- **Fixtures**: positive per preset + a baseline-red with a crossing edge. Required before `core`.

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
Edges are directed dependencies with `kind: request | async`. Direction always reads consumer → provider; rendering solid (request) or dashed (async) follows the kind and requires a legend when both appear.

### Cardinality
At most 12 edges and 9 nodes per artifact; a node may have any in-degree but an edge references exactly one source and one target, both of which must exist.

### Cycle policy
Cycles are permitted only when the input declares them (a feedback dependency); an undeclared cycle is an input error, not a routing problem, because it usually means the direction convention was inverted.

### Traversal and reading order
Traversal is declared explicitly and must agree with DOM order; the default is zone order (ingress → app → data) and, inside a zone, left to right.

### Topology verifier and receipt boundary
Wave 1 ships no topology verifier: the receipt records nodes, zones, edges and direction, and the generic lint proves geometry only. Any claim about reachability, cycles or completeness needs the Wave 2 verifier before it may be asserted, and `core` promotion is blocked until then.
