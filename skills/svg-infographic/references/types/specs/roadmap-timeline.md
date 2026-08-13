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

## 3. Semantic model and invariants

- Entities are **ordered phases**; position encodes order only, and intervals are uniform by construction.
- Invariants: exactly one phase may be `current`; phase labels are preferred over exact dates; the axis is continuous across all phases.
- **No duration claim**: even spacing must never be read as equal length, and the subtitle says so when dates are shown.

## 4. Intrinsic fit and variant contract

- Interval is computed, not spaced by label width: `x_i = start + i × interval`, `interval = (axisW − 2 × endPad) / (n − 1)`.
- Fit requires each milestone card to keep its floor within `interval − cardGap`; when it cannot, cards alternate above/below the axis, and if that still fails §6 applies.
- Alternating placement is a declared variant of the same type.

## 5. Layout, encoding and connector rules

- Axis as a soft thick line or chevron band; phase dots/chevrons in phase colours.
- One milestone card per phase under the axis, or alternating above/below.
- Status shifts saturation: done = muted, current = emphasis toolkit, future = outline.
- The "now" marker is a dashed vertical line with a small pill label; it crosses the axis but no card.

## 6. Degrade ladder

1. Drop card bodies (title-only milestones).
2. Alternate cards above/below the axis.
3. Merge adjacent phases, recording the merge.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`) — because the type makes **no** proportional claim. A dated timeline that claimed real intervals would need the data-accuracy annex and a verifier before `core`.
- Checks: intervals mathematically even; alternating cards clear of axis labels; the now marker crosses no card; phase count 3–5.
- **Receipt**: phases in order with status, the computed interval, and any merge.
- **Fixtures**: positive per preset + a baseline-red with label-width spacing. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is earliest → latest, declared.
- Status is never colour-only: `done/current/future` also reads from the card.
- KO and EN budgets are per script.

## 9. Anti-patterns and known failures

- Spacing phases by label width instead of the computed interval.
- Even spacing presented as if it were a real duration scale.
- Two phases marked `current`.
- A "now" marker drawn over a milestone card.
