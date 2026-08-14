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
| `zones[].nodes[]` | 1–4 per zone, **9 in total or fewer** (both caps apply at once) | name ≤ 2 lines, one icon |
| `edges[]` | ≤ 12 | optional label ≤ 1 line |
| `boundary` | optional, one system boundary | label ≤ 1 line |

## 3. Semantic model and invariants

- Entities are **components** grouped into ordered **zones**; edges are directed dependencies.
- Invariants: every node belongs to exactly one zone; an edge references existing nodes; direction is consumer → provider; external actors sit outside the boundary frame when one is declared.
- The zone order encodes depth (ingress → app → data) and is not decorative.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: grid (zones × nodes per zone)
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: judged by a **hierarchical bounding box** — the box that simultaneously satisfies the
  widest zone (a row of nodes) and the deepest stack (the zone count), including the zone label band,
  zone padding and the inter-zone routing corridor. The Wave 1 verified configuration is zones ≤ 4,
  at most 4 nodes in one zone and **9 nodes in total**; the footprint computes that upper bound
  (widest zone × deepest stack), so every legal configuration fits inside it. It holds in both presets.

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

This splits the original archetype's checks into what **a machine proves** and what **a person reads,
or a later verifier proves**. Writing a rule in §5 is not the same as saying the rule is verified.

**Machine (what the generic guards actually check)**

The generic lint and layout guard check **annotated general geometry** — Wave 1 has no dedicated path
that understands the topology semantic model.

- annotated container/child containment (whether node cards sit inside the zone frame)
- SVG reference integrity (`url(#…)`, dangling ids) and duplicate ids
- **visible arrowhead size and its ratio to the shaft** (a rule about the arrow itself)
- a single `cluster-h1`, with module headings staying at section scale

The generic guards have **no path that measures the gap between an arrow tip and its target node** —
an arrowhead size check must not be read as target clearance verification.

**Not yet proved (no registered fixture).** Even the items above are a *contract* rather than evidence
of passing until this TypePack's fixtures are registered. Only what an actual fixture has passed may be
called "proved".

**Visual / manual (not machine-proved in Wave 1)**

- the **arrow tip–target 8–12px gap** and the visible shaft corridor — §5 sets the rule but no generic
  path measures it today (it is promoted to Machine once an annotation-based connector guard exists)
- node → zone **semantic** ownership (at the meaning-model level, not the annotation level)
- whether an edge endpoint names a node that exists (semantic dangling)
- no edge crossings — read by eye today, not decided automatically
- whether an edge label sits **beside** the line rather than on it
- whether an external actor sits **outside** the system boundary
- whether a 3×3 cell rearrangement actually reads

**Future verifier (Wave 2 topology verifier)**

Reachability, cycle and completeness claims cannot be made before a verifier exists. Until then the
receipt carries only declared facts (zones, nodes, edges, direction, boundary), and the visual items
above remain review items rather than proof.

- **Verifier**: `verifier: null` (Wave 1) — a TypePack that declares the topology annex is not promoted
  to `core` until a verifier and a receipt schema are registered (the manifest validator enforces this).
- **Receipt**: zones, node→zone ownership, edges (semantic kind, delivery, visibility, direction),
  boundary.
- **Fixtures**: a positive per preset plus a crossing-edge baseline-red. One artifact carries exactly
  one (kind, preset) claim.

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
An edge records three axes **separately** — collapsing meaning (kind), delivery and exposure
(visibility) into one would erase combinations such as a "private sync edge" from the receipt.

- `kind: request | dependency` — what it means
- `delivery: sync | async` — synchronous or asynchronous
- `visibility: public | private` — exposure across the boundary

Direction always reads consumer → provider. **The line style derives from these three**: dashed when
`delivery: async` or `visibility: private`, solid otherwise. When both styles appear a legend is
required, and the legend explains the axis it stands for rather than the style itself.

### Cardinality
At most 12 edges and 9 nodes per artifact; a node may have any in-degree but an edge references exactly one source and one target, both of which must exist.

### Cycle policy
Cycles are permitted only when the input declares them (a feedback dependency); an undeclared cycle is an input error, not a routing problem, because it usually means the direction convention was inverted.

### Traversal and reading order
Traversal is declared explicitly and must agree with DOM order; the default is zone order (ingress → app → data) and, inside a zone, left to right.

### Topology verifier and receipt boundary
Wave 1 ships no topology verifier: the receipt records nodes, zones, edges and direction, and the generic lint proves geometry only. Any claim about reachability, cycles or completeness needs the Wave 2 verifier before it may be asserted, and `core` promotion is blocked until then.
