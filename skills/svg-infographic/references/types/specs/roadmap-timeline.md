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

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: row(axis band 포함)
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: **4:5 portrait에서 5 phase는 성립하지 않는다**(needs-split) — 4:5의 상한은 4 phase다. 16:9은 5 phase가 성립한다. 간격은 계산값이며 label 폭으로 띄우지 않는다.

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
