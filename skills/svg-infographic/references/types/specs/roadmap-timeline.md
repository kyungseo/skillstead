---
spec_schema_version: 1
typepack_id: roadmap-timeline
profile: constrained-layout
---

# TypePack: roadmap-timeline

Phases or milestones over time.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `roadmap-timeline` · **profile** `constrained-layout`
- **Selection signal** — time or phases: product phases, milestones, rollout waves, a status snapshot over time.
- **Choose when** the horizontal position means "later", qualitatively.
- **Do not choose when** the dates must be read against a real scale — this type spaces phases **evenly** and makes no proportional-duration claim; that needs a data-accuracy type.

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `phases[]` | 3–5 | label ≤ 1 line |
| `phases[].card` | one per phase | title ≤ 1 line, body ≤ 2 lines |
| `phases[].status` | done / current / future | — |
| `now_marker` | optional | pill label ≤ 1 line |
| `now_marker.after_phase` | required when `now_marker` is present | must name the `current` phase |

## 3. Semantic model and invariants

- Entities are **ordered phases**; position encodes order only, and intervals are uniform by construction.
- Invariants: exactly one phase may be `current`; **statuses read `done* → current → future*` in declaration order** (one-current alone would admit `future → done → current`); the axis is continuous across all phases.
- **Position is input, never inference.** Phase order fixes phase position; the now marker's position comes from `now_marker.after_phase`, which must name the `current` phase. The value is redundant with `status` on purpose — a marker moved without moving `current` becomes an error instead of a silent contradiction. If the `current` phase is last there is no interval after it, so a `now_marker` is refused: drop it from the input rather than asking the renderer to hide a declared label.
- **No dates.** This TypePack carries no date, duration, tick, numeric scale or dependency. Such fields are refused at the input, not silently ignored.
- **No duration claim**: even spacing must never be read as equal length, and the subtitle says so when dates are shown.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: judge whether this type fits the region before attempting
placement, and drop to the §6 ladder when it does not. Never shrink type or spacing to force a fit.

**The manifest's `fit` block owns the formula variables, not this document**
(`references/types/manifest.yaml`, this TypePack's `fit.cardinality` / `fit.params` / `fit.footprint`). Restating constants here would
let the two copies drift, so this section records only the arrangement and the decision boundary.

- Arrangement: row (including the axis band)
- Evidence level: while the manifest's `fit.floor_basis` reads `geometry`, these numbers are a
  **geometric assumption**, not a value confirmed by rendering. They are promoted to `rendered`
  only after passing the CP2B stress render (getBBox, containment, PNG inspection).
- Decision: `fit.footprint` is computed from the params, and `fit.feasibility` is settled as
  `fits` or `needs-split` against the **live PageFrame contentBox** (a per-preset receipt). The
  manifest validator recomputes both, so a declaration alone never passes.
- Boundary: **5 phases do not hold in 4:5 portrait** (needs-split) — 4:5 tops out at 4 phases
  and 16:9 holds 5. The interval is a computed value, never widened by label width.

## 5. Layout, encoding and connector rules

- Axis as a soft thick line or chevron band; phase dots/chevrons in phase colours.
- One milestone card per phase under the axis, or alternating above/below.
- Status is distinguishable **without colour**, and every state marker is **opaque**: `done` = status fill · `current` = background underlay + status fill + outer ring · `future` = background fill + outline. "Outlined" never means transparent — a hollow dot lets the axis rail show through and reads as sitting behind the line. The fill comes from the background **role**, never a hardcoded colour, so it follows the skin into dark mode. The ring must be visibly clear of the dot (radius floor and stroke floor are re-measured on the final SVG, not declared).
- Paint order is a DOM contract: **axis → marker underlay → dot/ring → label**. The axis is a background rail, so it belongs to the container layer; drawing it after the markers puts the rail on top of them. The accessible status wording per locale is fixed by this spec, so the generator never invents it — see the vocabulary table below.
- The phase label sits on the **opposite side of the axis from its milestone card**, so alternating layout never buries a label under a card.
- Even spacing derives from the card that must fit: `endInset = cardVisualW/2 + outerClearance` and `step = (contentW − 2 × endInset) / (n − 1)`, where `cardVisualW` is the resolved maximum over both locales. A constant end inset lets the outermost card leave the content box.
- The "now" marker is a dashed vertical line with a small pill label; it crosses the axis but no card.

**Accessible status vocabulary** (rendered copy, fixed by this spec — not prose):

| `status` | en | ko |
| --- | --- | --- |
| `done` | Done | 완료 |
| `current` | In progress | 진행 중 |
| `future` | Planned | 예정 |

## 6. Degrade ladder

1. Alternate cards above/below the axis.
2. Return `needs-split`.

Two steps that a reader might expect are **deliberately absent**. *Dropping card bodies* is not a step: height never binds in this type (a body adds ~36px against a content box of 700+), so dropping it cannot rescue a layout — a body over the §2 budget is an input error, not something to degrade away. *Merging adjacent phases* is not a step either: merging changes the author's meaning, and no input yet declares which phases may merge or what label survives.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: no separate data-accuracy verifier (`verifier: null`) — the type makes no proportional claim. Structure is still machine-checked: the generation entrypoint runs an ordinal audit that recomputes geometry from the input and compares it against the written SVG.
- Checks: the axis appears before every state marker in DOM order; each marker carries a background-role underlay covering its full extent (ring included for `current`); `future` is background-filled with an outline rather than transparent; intervals recomputed from the input and matched within 0.5px; declaration order = DOM order = left-to-right order; dot shape matches status and the current ring is visibly clear; the axis is drawn once, horizontal, and spans the first and last phase; the marker sits where `after_phase` puts it and its **whole visual bounds** (pill + stem) clear every card, phase label and the content box; the outermost card stays inside the content box, re-measured on the final SVG.
- **Receipt**: `timeline receipt v1` — `schemaVersion`, `kind: "ordinal"`, axis (`x0`, `x1`, `endInset`, `step`), `phases[]` (`id`, `index`, `status`, `x`), and `marker` as a union of `null` or `{ afterPhase, x, labelConsumed }`. Undeclared fields are refused. One shared validator serves both the producer and the verifier, and the verifier recomputes every coordinate from the input rather than trusting the receipt.
- **Fixtures**: positive per preset + a baseline-red with label-width spacing. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is earliest → latest, declared.
- Status is never colour-only: `done/current/future` also reads from the card.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Spacing phases by label width instead of the computed interval.
- A now marker whose position the renderer inferred rather than the input declaring it.
- Statuses that contradict time order (`future` before `done`).
- A constant axis end inset that pushes the outermost milestone card out of the content box.
- `done` and `current` differing by colour alone.
- A transparent `future` dot with the axis rail visible through it.
- The axis painted over the state markers.
- Even spacing presented as if it were a real duration scale.
- Two phases marked `current`.
- A "now" marker drawn over a milestone card.
