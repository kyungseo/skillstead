---
spec_schema_version: 1
typepack_id: nested-scope
profile: constrained-layout
---

# TypePack: nested-scope

Containment or scope — inner things live inside outer things.

> Spec skeleton (Wave 1). Every TypePack fills sections 1–9 in this order, plus
> the annexes its profile declares in the manifest.

## 1. Identity and selection

- **TypePack id** `nested-scope` · **profile** `constrained-layout`
- **Selection signal** — containment or scope: trust zones, scope rings, platform → app → feature.
- **Choose when** the relationship is "inside of", and the nesting depth is the message.
- **Do not choose when** the relation is order (`process-flow`), dependency layers (`layer-stack`) or peer items (`cards-kpi-grid`).

## 2. Input schema and budget

| Field | Cardinality | Budget |
| --- | --- | --- |
| `rings[].label` | 3–4 rings, outermost first | one line, ≤ 20 CJK / ≤ 30 Latin |
| `rings[].core_icon` | innermost only, optional | one glyph |
| `rings[].callout` | optional, one per ring | one line, side column only |

Five or more rings is a degrade input (§6): merge rings or split the artifact.

## 3. Semantic model and invariants

- Entities are **nested regions**; `ring-1` is the outermost and each subsequent ring is strictly contained by the previous one.
- Containment is total and ordered: a ring never overlaps a sibling, and there are no siblings at the same depth.
- Invariants: every ring carries a label placed in its own visible strip; the innermost ring is the core and may carry an icon; depth ≤ 4.

## 4. Intrinsic fit and variant contract

Fit is decided **before** layout: 배치 시도 전에 이 타입이 해당 region에 들어가는지
판정하고, 들어가지 않으면 §6 ladder로 내려간다. 글자·간격을 줄여 억지로 맞추지 않는다.

**수식 변수는 이 문서가 아니라 manifest의 `fit` 블록이 소유한다**(`references/types/manifest.yaml`,
해당 TypePack의 `fit.cardinality` / `fit.params` / `fit.footprint`). 문서에 상수를 다시
적으면 두 벌이 어긋나므로, 여기서는 배치 종류와 판정 경계만 적는다.

- 배치: concentric
- 근거 수준: manifest `fit.floor_basis`가 `geometry`인 동안 이 수치는 **기하 가정**이며
  실제 렌더로 확인된 값이 아니다. CP2B의 stress render(getBBox·containment·PNG 검수)를
  통과한 뒤에만 `rendered`로 승격한다.
- 판정: `fit.footprint`가 params에서 계산되고, `fit.feasibility`가 **실제 PageFrame
  contentBox**(preset별 live receipt)와 대조돼 `fits` 또는 `needs-split`으로 확정된다.
  manifest validator가 두 계산을 모두 재수행하므로 선언만으로 통과할 수 없다.
- 경계: core는 한 줄 최대 20 CJK label을 수용하는 크기이며 inset은 균등하다. 4겹까지 두
  preset에서 성립한다.

## 5. Layout, encoding and connector rules

- 3–4 concentric rounded rects (or circles for a radial reading), each inset by the computed uniform amount.
- Each ring label sits in its **top strip, centred** — the band not covered by the next ring — and is measured against that strip, not against the ring as a whole.
- Colour runs light (outer) → saturated (inner); ring labels use their own ring's ink.
- Optional side callouts attach with thin leader lines; leaders never cross a ring boundary label.
- No arrows: containment is the relation.

## 6. Degrade ladder

1. Drop side callouts.
2. Shorten ring labels to the budget.
3. Merge adjacent rings, recording the merge.
4. Return `needs-split`.

## 7. Verifier, receipt and fixture contract

- **Machine verifier**: none (`verifier: null`); the generic lint plus the layout guard cover containment and label placement.
- Checks that must pass: ring insets uniform within tolerance; every label fully inside its own visible strip and clear of the inner ring; ring count 3–4.
- **Receipt**: entities `ring-1 … ring-n`, computed inset, and any merge.
- **Fixtures**: positive per preset + a baseline-red where a label overlaps the inner ring. Required before `core`.

## 8. Reading order, accessibility and locale

- Reading order is outermost → innermost and declared.
- `<title>`/`<desc>` carry the conclusion; ring labels are real text.
- KO and EN budgets are per script; a label that fits EN but not KO is a fit failure.

## 9. Anti-patterns and known failures

- Eyeballed insets that drift between rings.
- A label placed over the next ring because its own strip was too short.
- Five or more rings ("just one more scope").
- Arrows added between rings, which turns containment into flow.
