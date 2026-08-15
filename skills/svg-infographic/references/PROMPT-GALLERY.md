<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: references/types/manifest.yaml + the canonical input payloads.
     Regenerate with `node scripts/skin.mjs gallery --write`;
     `node scripts/skin.mjs gallery --check` fails when this file drifts. -->

# Prompt Gallery

One entry per routable TypePack: the signal that selects it, the canonical prompt in both locales,
the command that produces the artifact, and what the receipt must show. Prompts are read from the
canonical input payloads, so this catalog cannot claim wording the package does not actually carry.

This file is the **agent-facing** catalog and stays inside the package. Rendered examples for human
readers live in the repository's Example Cookbook, outside the installed package.

9 routable TypePacks.

## approval-gate

**Choose it when** A simple request path with one approval gate or checkpoint (a->b->c; a full sequence diagram is out of scope)

- Spec: [`approval-gate.md`](types/specs/approval-gate.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`approval-gate.canonical.yaml`](types/inputs/approval-gate.canonical.yaml) (`document-compact`, row, count 3)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 요청이 승인 게이트를 지나 반영되는 경로를 보여줘. 4:5.
en: A request passing an approval gate. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack approval-gate --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (presentation-16x9, fits) · `stress-copy` (document-compact, fits) · `stress-degrade` (social-4x5, needs-split). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## before-after

**Choose it when** Before and after — migration, modernisation, refactor outcome, trade-off comparison

- Spec: [`before-after.md`](types/specs/before-after.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`before-after.canonical.yaml`](types/inputs/before-after.canonical.yaml) (`document-compact`, row, count 2)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 마이그레이션 전후를 두 항목으로 비교해줘. 4:5.
en: Compare before and after across two slots. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack before-after --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (document-compact, fits) · `stress-copy` (document-compact, fits). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## cards-kpi-grid

**Choose it when** A few key items or figures summarised as equal cards (feature highlights, principles, status counts, capability summaries; not a chart claiming data accuracy)

- Spec: [`cards-kpi-grid.md`](types/specs/cards-kpi-grid.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`cards-kpi-grid.canonical.yaml`](types/inputs/cards-kpi-grid.canonical.yaml) (`document-compact`, grid, count 4)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 핵심 4가지를 동등한 카드로 요약해줘. 소셜 포스트용 4:5 비율.
en: Summarise the four key points as equal cards, 4:5 social post.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack cards-kpi-grid --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (document-compact, fits) · `stress-copy` (document-compact, fits) · `stress-degrade` (social-4x5, needs-split). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## decision-matrix

**Choose it when** Options or items placed by two qualitative axes — a 2x2 priority/decision quadrant, a 3x3 risk grid

- Spec: [`decision-matrix.md`](types/specs/decision-matrix.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`decision-matrix.canonical.yaml`](types/inputs/decision-matrix.canonical.yaml) (`document-compact`, grid, count 4)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 두 축으로 옵션을 2×2 사분면에 배치해줘. 4:5.
en: Place options in a 2×2 matrix. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack decision-matrix --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (presentation-16x9, fits) · `stress-degrade` (document-compact, needs-split) · `stress-copy` (document-compact, fits). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## layer-stack

**Choose it when** A hierarchy that stacks on or abstracts the layer beneath it (platform stacks, runtime layers, capability models)

- Spec: [`layer-stack.md`](types/specs/layer-stack.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`layer-stack.canonical.yaml`](types/inputs/layer-stack.canonical.yaml) (`document-compact`, column, count 4)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 플랫폼 역량을 4개 계층으로 쌓아서 보여줘. 4:5.
en: Show the platform capability as four stacked layers. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack layer-stack --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (presentation-16x9, fits) · `stress-copy` (document-compact, fits) · `stress-degrade` (social-4x5, needs-split). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## nested-scope

**Choose it when** Containment and scope — the inner lives inside the outer (trust zones, scope rings, platform -> app -> feature)

- Spec: [`nested-scope.md`](types/specs/nested-scope.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`nested-scope.canonical.yaml`](types/inputs/nested-scope.canonical.yaml) (`document-compact`, concentric, count 3)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 신뢰 경계를 3겹 동심 구조로 보여줘. 4:5.
en: Show the trust boundary as 3 concentric scopes. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack nested-scope --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (document-compact, fits) · `stress-copy` (document-compact, fits). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## process-flow

**Choose it when** Ordered steps or handoffs — processes, pipelines, data flows, review loops

- Spec: [`process-flow.md`](types/specs/process-flow.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`process-flow.canonical.yaml`](types/inputs/process-flow.canonical.yaml) (`document-compact`, column, count 4)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 배포 절차를 4단계로 위에서 아래로 보여줘. 4:5 세로.
en: Four top-to-bottom delivery steps. 4:5 portrait.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack process-flow --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (document-compact, fits) · `stress-copy` (document-compact, fits) · `stress-degrade` (social-4x5, needs-split). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## roadmap-timeline

**Choose it when** Time or phases — product phases, milestones, rollout waves, a status snapshot over time (evenly spaced, claiming no proportional duration)

- Spec: [`roadmap-timeline.md`](types/specs/roadmap-timeline.md)
- Profile `constrained-layout` · maturity `experimental` · presets document-compact, social-4x5, presentation-16x9 · preferred `document-compact`
- Canonical input: [`roadmap-timeline.canonical.yaml`](types/inputs/roadmap-timeline.canonical.yaml) (`document-compact`, row, count 4)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 롤아웃을 4개 단계로 마일스톤 카드와 함께 보여줘. 4:5.
en: Four rollout phases with milestone cards. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack roadmap-timeline --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (presentation-16x9, fits) · `stress-body` (document-compact, fits) · `stress-tail-current` (document-compact, fits) · `stress-copy` (presentation-16x9, fits) · `stress-degrade` (document-compact, needs-split). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.

## topology-component

**Choose it when** Systems or components and their connections — request paths, cloud/network zones, service architecture with a system boundary

- Spec: [`topology-component.md`](types/specs/topology-component.md)
- Profile `editorial-composition` · maturity `experimental` · presets social-4x5, presentation-16x9 · preferred `social-4x5`
- Canonical input: [`topology-component.canonical.yaml`](types/inputs/topology-component.canonical.yaml) (`social-4x5`, zones, count 3)

Canonical prompt — these are the payload's own `prompt_ko` / `prompt_en`, not a restatement:

```text
ko: 요청 경로를 3개 zone으로 나눠 컴포넌트와 연결을 보여줘. 4:5.
en: Show the request path across three zones with components and links. 4:5.
```

Build and verify:

```bash
node scripts/generate.mjs build --typepack topology-component --case canonical --locale ko \
  --out <out>.svg --receipt <out>.json
node scripts/generate.mjs verify --receipt <out>.json --svg <out>.svg
```

The receipt records `consumed` (every declared entity id), `geometry` vs `geometryExpected`, `residual` with its disposition, and `fontDelivery`. Declared variants: `stress-cardinality` (social-4x5, fits) · `stress-copy` (social-4x5, fits). A configuration that does not fit returns `needs-split` with a degrade receipt and **no artifact** — that is a non-success, not a smaller render.
