<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: references/types/manifest.yaml (`selection_signal`).
     Regenerate with `node scripts/skin.mjs selection --write`;
     `node scripts/skin.mjs selection --check` fails when this file drifts. -->

# TypePack selection

무엇을 보여줄지에서 시작해 TypePack을 고른다. 각 행의 spec이 그 타입의 입력 계약·
레이아웃 수식·검증 체크리스트를 소유한다. `experimental (preview)`는 example과
검증 증거가 아직 등록되지 않은 상태이므로 `core`와 같은 안정성으로 읽지 않는다.

| 내용 신호 | TypePack | profile | maturity | spec | canonical prompt |
| --- | --- | --- | --- | --- | --- |
| 승인 gate·체크포인트가 하나 있는 단순 요청 경로 (a→b→c; 전체 sequence diagram은 범위 밖) | `approval-gate` | constrained-layout | experimental (preview) | [spec](specs/approval-gate.md) | `PROMPT-GALLERY.md#approval-gate` (reserved) |
| 이전과 이후 — 마이그레이션·현대화·리팩터 결과·트레이드오프 비교 | `before-after` | constrained-layout | experimental (preview) | [spec](specs/before-after.md) | `PROMPT-GALLERY.md#before-after` (reserved) |
| 핵심 항목·수치 몇 개를 동등한 카드로 요약 (feature highlight·원칙·상태 카운트·역량 요약; 데이터 정확성을 주장하는 chart가 아님) | `cards-kpi-grid` | constrained-layout | experimental (preview) | [spec](specs/cards-kpi-grid.md) | `PROMPT-GALLERY.md#cards-kpi-grid` (reserved) |
| 두 정성 축으로 배치하는 옵션·항목 — 2×2 우선순위/결정 사분면·3×3 리스크 격자 | `decision-matrix` | constrained-layout | experimental (preview) | [spec](specs/decision-matrix.md) | `PROMPT-GALLERY.md#decision-matrix` (reserved) |
| 아래 층을 기반으로 쌓이거나 추상화하는 계층 구조 (플랫폼 스택·런타임 계층·역량 모델) | `layer-stack` | constrained-layout | experimental (preview) | [spec](specs/layer-stack.md) | `PROMPT-GALLERY.md#layer-stack` (reserved) |
| 포함·범위 관계 — 안쪽이 바깥쪽 안에 산다 (신뢰 zone·scope ring·platform → app → feature) | `nested-scope` | constrained-layout | experimental (preview) | [spec](specs/nested-scope.md) | `PROMPT-GALLERY.md#nested-scope` (reserved) |
| 순서 있는 단계나 인계 — 프로세스·파이프라인·데이터 흐름·리뷰 루프 | `process-flow` | constrained-layout | experimental (preview) | [spec](specs/process-flow.md) | `PROMPT-GALLERY.md#process-flow` (reserved) |
| 시간·단계 — 제품 phase·마일스톤·롤아웃 wave·시점별 상태 (균등 간격이며 기간 비례를 주장하지 않음) | `roadmap-timeline` | constrained-layout | experimental (preview) | [spec](specs/roadmap-timeline.md) | `PROMPT-GALLERY.md#roadmap-timeline` (reserved) |
| 시스템·컴포넌트와 그 연결 — 요청 경로·클라우드/네트워크 zone·시스템 경계가 있는 서비스 아키텍처 | `topology-component` | editorial-composition | experimental (preview) | [spec](specs/topology-component.md) | `PROMPT-GALLERY.md#topology-component` (reserved) |

## Registered but not routable

현재 없음. (gated TypePack은 라우팅에서 빠지되 여기에 사유와 해제 조건이 남는다.)

등록된 TypePack 9개 중 9개가 라우팅 대상이다.
