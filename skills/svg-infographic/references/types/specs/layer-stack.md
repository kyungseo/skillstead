---
spec_schema_version: 1
typepack_id: layer-stack
profile: constrained-layout
---

# TypePack: layer-stack

Layered capability — each band builds on or abstracts the one below.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest. Adding a type means adding one
> spec file here and one manifest row; the core engine (generic lint, renderer,
> resolver) is not modified.

## 1. Identity and selection

- **TypePack id** `layer-stack` · **profile** `constrained-layout`
- **Selection signal (SSoT: manifest `selection_signal`)** — layered capability
  where each layer builds on or abstracts the one below: platform stacks, runtime
  layers, organisational capability models.
- **Choose when** the vertical order itself carries the dependency direction.
- **Do not choose when** the items are a flat peer set (`cards-kpi-grid`), a
  sequence of steps over time, or a containment relationship (nested regions).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `layers[].label` | 3–5 layers | one line, ≤ 28 CJK / ≤ 40 Latin characters |
| `layers[].items` | 0–4 chips per layer | one line each, ≤ 16 CJK / ≤ 24 Latin |
| `layers[].note` | optional, one per layer | one line, annotation column only |

More than five layers is a **degrade** input (§6): merge adjacent layers or split
the artifact rather than shrinking the band height.

## 3. Semantic model and invariants

- Entities are **ordered layers**; adjacency means "sits directly on top of", and
  the order is the dependency direction (top = most user-facing).
- Each layer has a stable `entity_id` (`layer-1 … layer-n`, bottom to top) and
  chips are subordinate to their layer, never independent entities.
- Invariants: the order is total and carries meaning; no layer is skipped; chips
  never span two layers; the stack asserts dependency, not sequence in time.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: column
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: **band 폭은 chip 예산이 정한다.** base floor는 label gutter + chip 2개(각 16 CJK)를
  수용하고, chip 4개를 요구하는 `wide` floor는 **4:5에서 성립하지 않는다**(needs-split;
  16:9은 성립). 4:5에서 chip 4개가 필요하면 chip 문구를 줄이거나 분리 페이지다.
  clamp는 feasibility 판정 **이후**에만 적용한다.

## 5. Layout, encoding and connector rules

- Bands are **full region width** with identical `x` and `width`, stacked top to
  bottom, most user-facing first, separated by one constant gap token (16–24px).
- Chips use the last-edge formula:
  `chipWidth = (bandWidth − 2 × bandPad − (m − 1) × chipGap) / m`; the last chip's
  right edge equals `bandRight − bandPad` by construction, never by hand-tuned
  coordinates.
- A layer label and its chips share one computed vertical center per band.
- The optional annotation column reduces `bandWidth` for **every** band equally.
- **No connectors.** Adjacency carries the dependency; one colour family per layer,
  optional light → saturated progression toward the most important layer; at most
  one band emphasised.

## 6. Degrade ladder

1. Drop the annotation column (notes move to the subtitle or are dropped).
2. Reduce chips per band toward the declared minimum.
3. Merge adjacent layers, recording the merge in the receipt.
4. Return `needs-split` rather than going below the band floor or shrinking type.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none beyond the generic lint and layout guard
  (`verifier: null`) — this type makes no accuracy claim.
- Generic checks that must pass: every band shares one `x`/`width`; equal gaps;
  chips inside their band content box; band height inside `[72, 110]` **after** the
  §4 feasibility check; one `cluster-h1`.
- **Receipt**: entities `layer-1 … layer-n`, merged layers listed with what was
  combined, and the residual height left after §4.
- **Fixtures**: a positive artifact per supported preset plus a baseline-red pair
  for the pre-clamp feasibility rule, registered in the manifest `fixtures` list.
  Required before this type may claim `core`.

## 8. Reading order, accessibility and locale

- Reading order is top to bottom and declared; when the dependency direction is
  not obvious from the labels, the subtitle states it.
- `<title>`/`<desc>` carry the conclusion; labels and chips are real text.
- KO and EN are both first-class: §2 budgets are per script, and a label that fits
  in EN but not KO is a fit failure.

## 9. Anti-patterns and known failures

- Arrows between adjacent bands ("stack" already means "on top of").
- Unequal band widths or per-band padding nudges.
- A band used as a section header for unrelated content.
- Numbering the bands, which turns the stack into a flow.
- Known failure: clamping the band height up to the floor when the region is too
  short — that overflows the region instead of degrading. §4 decides first.
