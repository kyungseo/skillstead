<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: references/types/manifest.yaml (`selection_signal`).
     Regenerate with `node scripts/skin.mjs selection --write`;
     `node scripts/skin.mjs selection --check` fails when this file drifts. -->

# TypePack selection

Start from what you want to show and pick a TypePack. Each row's spec owns that type's
input contract, layout formulas and verification checklist. `experimental (preview)` means
no example or verification evidence is registered yet, so do not read it as being as stable
as `core`.

| Content signal | TypePack | profile | maturity | spec | canonical prompt |
| --- | --- | --- | --- | --- | --- |
| A simple request path with one approval gate or checkpoint (a->b->c; a full sequence diagram is out of scope) | `approval-gate` | constrained-layout | experimental (preview) | [spec](specs/approval-gate.md) | `PROMPT-GALLERY.md#approval-gate` |
| Before and after — migration, modernisation, refactor outcome, trade-off comparison | `before-after` | constrained-layout | experimental (preview) | [spec](specs/before-after.md) | `PROMPT-GALLERY.md#before-after` |
| A few key items or figures summarised as equal cards (feature highlights, principles, status counts, capability summaries; not a chart claiming data accuracy) | `cards-kpi-grid` | constrained-layout | experimental (preview) | [spec](specs/cards-kpi-grid.md) | `PROMPT-GALLERY.md#cards-kpi-grid` |
| Options or items placed by two qualitative axes — a 2x2 priority/decision quadrant, a 3x3 risk grid | `decision-matrix` | constrained-layout | experimental (preview) | [spec](specs/decision-matrix.md) | `PROMPT-GALLERY.md#decision-matrix` |
| A hierarchy that stacks on or abstracts the layer beneath it (platform stacks, runtime layers, capability models) | `layer-stack` | constrained-layout | experimental (preview) | [spec](specs/layer-stack.md) | `PROMPT-GALLERY.md#layer-stack` |
| Containment and scope — the inner lives inside the outer (trust zones, scope rings, platform -> app -> feature) | `nested-scope` | constrained-layout | experimental (preview) | [spec](specs/nested-scope.md) | `PROMPT-GALLERY.md#nested-scope` |
| Ordered steps or handoffs — processes, pipelines, data flows, review loops | `process-flow` | constrained-layout | experimental (preview) | [spec](specs/process-flow.md) | `PROMPT-GALLERY.md#process-flow` |
| Time or phases — product phases, milestones, rollout waves, a status snapshot over time (evenly spaced, claiming no proportional duration) | `roadmap-timeline` | constrained-layout | experimental (preview) | [spec](specs/roadmap-timeline.md) | `PROMPT-GALLERY.md#roadmap-timeline` |
| Systems or components and their connections — request paths, cloud/network zones, service architecture with a system boundary | `topology-component` | editorial-composition | experimental (preview) | [spec](specs/topology-component.md) | `PROMPT-GALLERY.md#topology-component` |

## Registered but not routable

None at present. (A gated TypePack drops out of routing, but its reason and release condition stay here.)

9 of the 9 registered TypePacks are routed to.
