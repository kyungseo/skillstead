<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: references/types/manifest.yaml (`selection_signal`).
     Regenerate with `node scripts/skin.mjs selection --write`;
     `node scripts/skin.mjs selection --check` fails when this file drifts. -->

# TypePack selection

무엇을 보여줄지에서 시작해 TypePack을 고른다. 각 행의 spec이 그 타입의 입력 계약·
레이아웃 수식·검증 체크리스트를 소유한다.

| 내용 신호 | TypePack | profile | support | spec | canonical prompt |
| --- | --- | --- | --- | --- | --- |
| 핵심 항목·수치 몇 개를 동등한 카드로 요약 (feature highlight·원칙·상태 카운트·역량 요약; 데이터 정확성을 주장하는 chart가 아님) | `cards-kpi-grid` | constrained-layout | experimental | [spec](cards-kpi-grid.md) | `PROMPT-GALLERY.md#cards-kpi-grid` |
| 아래 층을 기반으로 쌓이거나 추상화하는 계층 구조 (플랫폼 스택·런타임 계층·역량 모델) | `layer-stack` | constrained-layout | experimental | [spec](layer-stack.md) | `PROMPT-GALLERY.md#layer-stack` |

등록된 TypePack 2개 중 2개를 노출한다.
