---
spec_schema_version: 1
typepack_id: cards-kpi-grid
profile: constrained-layout
---

# TypePack: cards-kpi-grid

A few headline items or numbers as an equal-weight card grid.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest. Adding a type means adding one
> spec file here and one manifest row; the core engine (generic lint, renderer,
> resolver) is not modified.

## 1. Identity and selection

- **TypePack id** `cards-kpi-grid` · **profile** `constrained-layout`
- **Selection signal (SSoT: manifest `selection_signal`)** — a few headline items
  or numbers: feature highlights, principles, status counts, capability summary.
- **Choose when** the items are peers and the reader should scan them, not follow
  them in order.
- **Do not choose when** the numbers must be read against a scale — a qualitative
  card grid is **not** a data-accurate chart, and comparative magnitude claims
  belong to a type carrying the data-accuracy annex and its own verifier.

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `cards[].title` | 3–6 cards | ≤ 2 lines |
| `cards[].body` | optional per card | ≤ 2 lines |
| `cards[].icon` | optional, from the bundled icon set | one glyph |
| `cards[].numeral` (KPI variant) | one per card | ≤ 5 glyphs |

Seven or more items is a **degrade** input (§6): split into two artifacts or
promote the extras out of the grid — never shrink the card below the §4 floors.

## 3. Semantic model and invariants

- Entities are **peer items**; the model carries no order, no ranking and no
  magnitude relation between cards.
- Each card has a stable `entity_id` (`card-1 … card-n`) used by composition
  semantic bindings; ids are positional and stable within one artifact.
- Invariants: every card carries a title; at most one card is emphasised; a
  numbered badge appears only when the input declares an actual sequence.
- Nothing here asserts a scale, so no tick, axis or proportional-area encoding may
  be introduced by a variant.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: row(n ≤ 4) / grid 2열(n = 5–6)
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: 두 preset 모두 최대 6장까지 성립한다. compact variant는 body를 버리는 축약이지 floor를 낮추는 수단이 아니다.

## 5. Layout, encoding and connector rules

- Grid is `1 × n` for `n ≤ 4`, otherwise `2 × ceil(n / 2)`.
- Last-edge formula in **both** directions:
  `cardW = (regionW − (cols − 1) × gapX) / cols`,
  `cardH = (regionH − (rows − 1) × gapY) / rows`; the last column's right edge and
  the last row's bottom edge equal the region's edges by construction.
- Every card is identical in size; there are no per-card padding nudges.
- The icon and the full text cluster share **one computed vertical center** per
  card (marker-label-row primitive, design-kernel §6) — never two separate offsets.
- KPI variant: numeral at ≈ 2 × card-title size in the card family's ink, label
  below it, caption last.
- **No connectors between cards.** As the primary module of a composite scene the
  item anchors are exposed as `item-anchor` ports and correspondence defaults to a
  semantic binding (shared numbering or label), not a drawn line.

## 6. Degrade ladder

1. Drop card bodies (title-only cards).
2. Move from the two-row grid to a single row where the count allows.
3. Select the declared `compact` variant.
4. Return `needs-split` rather than reducing card size or type below §4 floors.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none beyond the generic lint and layout guard — this type
  makes no accuracy claim, so `verifier: null` is correct and no data receipt
  exists. A KPI variant that claimed comparability would need the data-accuracy
  annex and a verifier before it could claim `core`.
- Generic checks that must pass: grid arithmetic both directions; identical card
  sizes; text inside its card content box; icon/text shared center; the opt-in
  `icon-text-card` source contract (authoring.md §7); when composed,
  `usedBounds ⊆ slot` and the declared reading order.
- **Composition receipt**: entities `card-1 … card-n`, `item-anchor` ports, and the
  selected variant with what it dropped.
- **Fixtures**: one positive artifact per supported preset plus a baseline-red pair
  for the last-edge formula, registered in the manifest `fixtures` list. Required
  before this type may claim `core`.

## 8. Reading order, accessibility and locale

- Reading order is row-major and **declared**, not inferred; composition compares
  the declaration against DOM order.
- `<title>`/`<desc>` carry the page conclusion; card text is real text, never
  outlined paths.
- KO and EN are both first-class: §2 budgets are per script, and a card that fits
  in EN but not KO is a fit failure, not a rendering detail.

## 9. Anti-patterns and known failures

- Cards of different sizes to "fit" longer text.
- A numeral grid presented as if it were a chart (implied comparison, no scale).
- Per-card icon offsets tuned by eye instead of the shared center formula.
- Drawing connectors between peer cards.
- Known failure: at `n = 5–6` with bodies in the compact slot the text floor breaks
  before the card floor — check §4 fit first, not the rendered result.
