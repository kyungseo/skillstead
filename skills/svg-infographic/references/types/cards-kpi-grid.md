# TypePack: cards-kpi-grid

A few headline items or numbers as an equal-weight card grid.

> Spec skeleton (Wave 1). Every TypePack fills these seven sections in this order;
> adding a type means adding one spec file + one manifest entry, and the core
> engine (generic lint, renderer, resolver) is not modified.

## 1. Selection contract

- **Selection signal (SSoT: manifest `selection_signal`)** — a few headline items
  or numbers: feature highlights, principles, status counts, capability summary.
- **Choose when** the items are peers and the reader should scan them, not follow
  them in order.
- **Do not choose when** the numbers must be read against a scale — a qualitative
  card grid is **not** a data-accurate chart, and comparative magnitude claims
  belong to a chart type with its own accuracy verifier.

## 2. Input contract

| Field | Cardinality | Budget |
| --- | --- | --- |
| `cards[].title` | 3–6 cards | ≤ 2 lines |
| `cards[].body` | optional per card | ≤ 2 lines |
| `cards[].icon` | optional, from the bundled icon set | one glyph |
| `cards[].numeral` (KPI variant) | one per card | ≤ 5 glyphs |

Seven or more items is a **degrade** input (§5): split into two artifacts or
promote the extras out of the grid — never shrink the card.

## 3. Layout formulas

Inside the assigned region (page `contentBox`, or the slot the composition layer
assigned):

- Grid is `1 × n` for `n ≤ 4`, otherwise `2 × ceil(n / 2)`.
- Column arithmetic uses the last-edge formula in **both** directions:
  `cardW = (regionW − (cols − 1) × gapX) / cols`,
  `cardH = (regionH − (rows − 1) × gapY) / rows`; the last column's right edge and
  the last row's bottom edge equal the region's edges by construction.
- Every card is identical in size; there are no per-card padding nudges.
- The icon and the full text cluster share **one computed vertical center** per
  card (marker-label-row primitive, design-kernel §6) — never two separate
  offsets.
- KPI variant: numeral at ≈ 2 × card-title size in the card family's ink, label
  below it, caption last.

## 4. Connector and emphasis rules

- **No connectors between cards.** Peer items are related by the grid itself; a
  numbered badge is used only when the cards genuinely form a sequence.
- At most one card carries emphasis.
- When this TypePack is the primary module of a composite scene, its item anchors
  are exposed as `item-anchor` ports and correspondence to the supporting module
  defaults to a **semantic binding** (shared numbering or label), not a drawn line.

## 5. Degrade ladder

1. Drop card bodies (title-only cards).
2. Switch from the 2-row grid to a single row where the count allows.
3. Select the declared `compact` variant (reduced internal rhythm).
4. Return `needs-split` rather than reducing card size or type below the floor.

## 6. Verification checklist

Machine-checked (generic lint + layout guard):

- grid arithmetic holds in both directions; all cards identical in size
- text stays inside its card's content box; the icon/text cluster shares one center
- repeated cards use the opt-in `icon-text-card` source contract (authoring.md §7)
- when composed: `usedBounds ⊆ slot`, reading order matches the declaration

Reviewed visually:

- the grid reads as peers, not as a ranked list
- KPI numerals are not implying a scale the data does not support

## 7. Anti-patterns

- Cards of different sizes to "fit" longer text.
- A numeral grid presented as if it were a chart (implied comparison without a
  scale).
- Per-card icon offsets tuned by eye instead of the shared center formula.
- Drawing connectors between peer cards.
