# Archetype catalog

Layout skeletons, the premium recipe, and per-type checks for every supported archetype. Read the section for the archetype you picked **before the layout pass** — the skeleton feeds the region/grid arithmetic, and each Checks list guards that type's most common first-render failures.

Every archetype uses the same section schema: **Choose when** (content signal) · **Skeleton** (regions and geometry to feed the layout pass) · **Recipe** (visual treatment on top of the premium base) · **Checks** (type-specific items to add to the pre-render checklist).

## Premium base recipe (applies to every archetype)

This is the default visual language — the gallery look. Apply it unless the user asks for something plainer:

- **Page header (H-C editorial stack):** optional muted eyebrow row, then a conclusion-style H1 (1–2 lines) with the **computed title-keyline** at its left (canonical default — derived from the H1 line-box ± pad via PageFrame scale-profile tokens; the square locator in front of the eyebrow is the explicit alternative variant, never doubled with the keyline), then an optional one-line muted subtitle, then generous breathing room before the first band (design-kernel §6). No legacy full-height rail, box or wash around the header. Header region ≈ 82px (4:5 base) / ≈ 108px (16:9 base) at the B scale anchor and grows only with actual content (absent elements collapse).
- **Band containers:** each major section sits in a light-tinted rounded panel (`rx 14–22`, very light fill such as `#F4F8FC`, hairline border). Bands stack top→bottom with 32–48px gaps.
- **Pill section headers:** each band opens with a filled pill (rounded rect, saturated section color, label with direct light `fill` + `data-fill-role="on-focus"`, optional ①②③ numbering) at the band's top-left, overlapping or just inside the band's top edge.
- **White cards:** content cards are white (`#FFFFFF`) on the tinted band, hairline border in the card's semantic color, subtle shadow (`<filter>` soft drop shadow, low opacity). Icon circle left, title + 1–2 body lines right — or icon-top for narrow cards.
- **Badges:** number badges (filled circle; numeral with direct light `fill` + `data-fill-role="on-focus"`) only when sequence matters; status/corner labels as small pills. Keep every corner decoration ≥ 20–24px from its neighbors.
- **Footer row (optional):** 2–4 small summary cards (icon + bold takeaway + caption) or a single muted rule-of-thumb strip, visually lighter than the body bands.
- **Line styles:** solid = sync/request/normal path; dashed `5 4` = async/private/feedback. Add a small legend whenever both appear.

> **Migration note (Wave 1).** The catalog is moving to TypePacks one type at a
> time. A migrated type keeps only a **pointer tombstone** here — its rules live in
> `references/types/specs/<id>.md` and it is routed by the generated
> `references/types/selection.md`. This file stays normative **only for types that
> have not been migrated yet**; a registered TypePack may never have a rival rule
> set here, and the manifest validator fails closed if one reappears.

## Layer stack

**Migrated to TypePack `layer-stack`.** Rules: [`types/specs/layer-stack.md`](types/specs/layer-stack.md) ·
routing: [`types/selection.md`](types/selection.md).

## Nested / onion

**Choose when:** containment or scope — inner things live inside outer things (trust zones, scope rings, platform → app → feature).

**Skeleton:**

```
[ header ]
[   outer ring                      ]
[   [ middle ring                 ] ]
[   [   [ inner core            ] ] ]
```

3–4 concentric rounded rects (or circles for a radial look), inset 40–70px per ring. Label each ring in its **top strip, centered** — the area not covered by the next ring.

**Recipe:** light (outer) → saturated (inner); ring labels in the ring's own ink color; the core can carry an icon + bold label. Optional side callouts with thin leader lines for ring descriptions.

**Checks:** ring insets are uniform (compute, don't eyeball); every ring label sits fully in its visible top strip and doesn't collide with the inner ring; keep to 3–4 rings — 5+ becomes unreadable.

## Topology / component

**Choose when:** systems/components and their links — request paths, cloud/network zones, service architecture with a system boundary.

**Skeleton:**

```
[ header ]
[ zone: entry/ingress   [gw] → [lb]          ]
[ zone: app/service     [svc] [svc] [svc]    ]
[ zone: data            [db] [cache] [queue] ]
```

Top→bottom by depth: outer zone → ingress → app/service → data. Zone frames are the band containers; components are white icon cards inside their zone. For a **component architecture** variant, draw an explicit system boundary and place external actors outside it.

**Recipe:** one icon badge per component; zone tint = that layer's color family; legend for line styles (solid = request, dashed = private/async); dependency arrows point **consumer → provider**; distinguish external vs internal actors (outside vs inside the boundary frame).

**Checks:** no crossing edges — route orthogonally around, or move the node; if nodes collide, assign each to a 3×3 zone cell (top-left … bottom-right), route edges only between cells, and group co-located nodes in one frame; every arrow lands with an 8–12px gap before its target; edge labels sit beside the line, not on it.

## Flow

**Choose when:** ordered steps or handoffs — process, pipeline, data flow, review loop.

**Skeleton:**

```
[ header ]
[ band:  [1]→[2]→[3]→[4]→[5]   (≤5 main nodes, L→R) ]
[        [branch row: drops below the main row]      ]
[ legend / footer ]
```

Main path left→right on one row; branches drop to a lower row and rejoin; feedback loops return as a dashed arc below or above the main row. Top→bottom orientation is fine for tall canvases (4:5 social).

**Swimlane variant** (parallel rails — e.g. a state rail above a pipeline rail): one horizontal lane per actor/track, lane labels in a left gutter or as pill headers; cross-lane arrows vertical; align stage columns across lanes so related nodes share an x-position.

**Recipe:** numbered step badges (sequence matters here); the key step gets the emphasis toolkit (stroke + shadow + badge — no top accent bar); solid = normal path, dashed = feedback/async with a legend when both appear.

**Checks:** ≤5 main nodes on the primary row (merge or demote the rest); no crossing edges; arrowheads gap 8–12px; feedback loop is dashed and labeled; swimlane: stage columns aligned across lanes, lane labels don't collide with the first column.

## Approval / sequence-lite

**Choose when:** a **simple request path** (a→b→c) with an approval gate or checkpoint. Full sequence diagrams (lifelines, activations, alt-frames) are **out of scope** — offer a flow instead.

**Skeleton:**

```
[ header ]
[ band: [requester] → [system] ⇢(gate)⇢ [target] ]
[        gate: pill/diamond above the arrow       ]
```

One row, 3–4 nodes; the gate is a labeled pill (or small diamond) sitting on or above the arrow it guards, with a dotted drop-line to the arrow.

**Recipe:** gate pill in a warning/amber family with an icon (check/shield); pre-gate and post-gate arrows can differ (solid → colored/thicker after approval); annotate the gate criterion in a caption under the band.

**Checks:** the gate visually attaches to exactly one arrow (dotted connector touches it); don't let the gate pill collide with node cards; if the user's content needs more than one lifeline-style interaction, switch archetype — don't stretch this one.

## Before / after

**Choose when:** old vs new — migration, modernization, refactor outcome, trade-off comparison.

**Skeleton:**

```
[ header ]
[ panel: BEFORE ]   [ panel: AFTER ]
[   (equal height, equal width)    ]
[ delta strip / footer ]
```

Two **equal-height, equal-width** panels with a 32–48px gutter; optional center arrow or "migration" chip between them; optional delta strip below (what changed, in numbers).

**Recipe:** semantic colors — unchanged = neutral, added = green family, removed = red family (or strikethrough), changed = amber; the panels' internal layouts should mirror each other so the eye can diff (same slot = same concern).

**Checks:** panel heights equal even when content differs (pad the shorter one — never let panels end ragged); mirrored slots aligned to the same y; the gutter stays ≥ 24px with balanced outer margins; legend present when 3+ semantic colors are used.

## Roadmap / timeline

**Choose when:** time or phases — product phases, milestones, rollout waves, status snapshot over time.

**Skeleton:**

```
[ header ]
[ axis:  Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4 ]
[        [card]       [card]       [card]      [card]   ]
[ optional "now" marker (vertical dashed line)           ]
```

3–5 phases, even horizontal spacing (compute the interval; don't space by label width); one milestone card per phase under (or alternating above/below) the axis; phase labels over exact dates.

**Recipe:** axis as a soft thick line or chevron band; phase dots/chevrons in phase colors; completed vs current vs future phases can shift saturation (done = muted, current = emphasized with the toolkit, future = outline); the "now" marker is a dashed vertical line with a small pill label.

**Checks:** intervals mathematically even (`x_i = start + i·interval`); alternating cards don't overlap the axis labels; the "now" marker crosses the axis but not any card; keep to 3–5 phases.

## Cards / KPI stat grid

**Migrated to TypePack `cards-kpi-grid`.** Rules: [`types/specs/cards-kpi-grid.md`](types/specs/cards-kpi-grid.md) ·
routing: [`types/selection.md`](types/selection.md).

## Decision / risk matrix

**Choose when:** options or items placed by two qualitative axes — 2×2 priority/decision quadrants, 3×3 risk severity grid.

**Skeleton:**

```
[ header ]
        High ↑
[ Q3 panel ] [ Q4 panel ]
[ Q1 panel ] [ Q2 panel ]
        Low  → Broad
   (axis labels on both axes, quadrant labels in-panel)
```

Four (or nine) equal panels with visible gutters; **both** axis labels (ends of each axis) and a name label inside every quadrant; axis arrows drawn outside the panels.

**Recipe:** one color family per quadrant; severity encodes via saturation on a risk grid (low = light, high = saturated); each quadrant: name, one-line trait (`narrow scope · high uncertainty` style), examples, and an optional recommended-action pill; the "most caution" quadrant gets the emphasis toolkit.

**Checks:** this archetype's top failure is **corner crowding** — number badge, status label, and corner icon in one quadrant need ≥ 20–24px between bounding boxes (badge top-left, status label on the same row right of the badge, icon top-right); axis labels don't collide with panel corners; quadrant panels exactly equal; verify decorations against the **exported PNG**, not just the SVG source.
