# Archetype catalog

**Every archetype has been migrated to a TypePack (Wave 1).** Per-type rules — input
contract, fit and variants, layout formulas, degrade ladder, verification — live in
`references/types/specs/<id>.md`, and routing lives in the generated
`references/types/selection.md`. Each section below is a **pointer tombstone** kept so
the migration record stays visible; nothing per-type in this file is normative any
more, and the manifest validator fails closed if a rival rule set reappears here.

What remains normative in this file is the **cross-type premium base recipe** below: it
applies to every archetype rather than belonging to any one of them.

## Premium base recipe (applies to every archetype)

This is the default visual language — the gallery look. Apply it unless the user asks for something plainer:

- **Page header (H-C editorial stack):** optional muted eyebrow row, then a conclusion-style H1 (1–2 lines) with the **computed title-keyline** at its left (canonical default — derived from the H1 line-box ± pad via PageFrame scale-profile tokens; the square locator in front of the eyebrow is the explicit alternative variant, never doubled with the keyline), then an optional one-line muted subtitle, then generous breathing room before the first band (design-kernel §6). No legacy full-height rail, box or wash around the header. Header region ≈ 82px (4:5 base) / ≈ 108px (16:9 base) at the B scale anchor and grows only with actual content (absent elements collapse).
- **Band containers:** each major section sits in a light-tinted rounded panel (`rx 14–22`, very light fill such as `#F4F8FC`, hairline border). Bands stack top→bottom with 32–48px gaps.
- **Pill section headers:** each band opens with a filled pill (rounded rect, saturated section color, label with direct light `fill` + `data-fill-role="on-focus"`, optional ①②③ numbering) at the band's top-left, overlapping or just inside the band's top edge.
- **White cards:** content cards are white (`#FFFFFF`) on the tinted band, hairline border in the card's semantic color, subtle shadow (`<filter>` soft drop shadow, low opacity). Icon circle left, title + 1–2 body lines right — or icon-top for narrow cards.
- **Badges:** number badges (filled circle; numeral with direct light `fill` + `data-fill-role="on-focus"`) only when sequence matters; status/corner labels as small pills. Keep every corner decoration ≥ 20–24px from its neighbors.
- **Footer row (optional):** 2–4 small summary cards (icon + bold takeaway + caption) or a single muted rule-of-thumb strip, visually lighter than the body bands.
- **Line styles:** solid = sync/request/normal path; dashed `5 4` = async/private/feedback. Add a small legend whenever both appear.

## Layer stack

**Migrated to TypePack `layer-stack`.** Rules: [`types/specs/layer-stack.md`](types/specs/layer-stack.md) ·
routing: [`types/selection.md`](types/selection.md).

## Nested / onion

**Migrated to TypePack `nested-scope`.** Rules: [`types/specs/nested-scope.md`](types/specs/nested-scope.md) ·
routing: [`types/selection.md`](types/selection.md).

## Topology / component

**Migrated to TypePack `topology-component`.** Rules: [`types/specs/topology-component.md`](types/specs/topology-component.md) ·
routing: [`types/selection.md`](types/selection.md).

## Flow

**Migrated to TypePack `process-flow`.** Rules: [`types/specs/process-flow.md`](types/specs/process-flow.md) ·
routing: [`types/selection.md`](types/selection.md).

## Approval / sequence-lite

**Migrated to TypePack `approval-gate`.** Rules: [`types/specs/approval-gate.md`](types/specs/approval-gate.md) ·
routing: [`types/selection.md`](types/selection.md).

## Before / after

**Migrated to TypePack `before-after`.** Rules: [`types/specs/before-after.md`](types/specs/before-after.md) ·
routing: [`types/selection.md`](types/selection.md).

## Roadmap / timeline

**Migrated to TypePack `roadmap-timeline`.** Rules: [`types/specs/roadmap-timeline.md`](types/specs/roadmap-timeline.md) ·
routing: [`types/selection.md`](types/selection.md).

## Cards / KPI stat grid

**Migrated to TypePack `cards-kpi-grid`.** Rules: [`types/specs/cards-kpi-grid.md`](types/specs/cards-kpi-grid.md) ·
routing: [`types/selection.md`](types/selection.md).

## Decision / risk matrix

**Migrated to TypePack `decision-matrix`.** Rules: [`types/specs/decision-matrix.md`](types/specs/decision-matrix.md) ·
routing: [`types/selection.md`](types/selection.md).
