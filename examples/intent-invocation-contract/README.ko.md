# Intent와 Invocation 계약

[English](./README.md) · **한국어**

이 저장소 전용 검증 시나리오는 `svg-infographic`, `docs-claim-check`, `github-release-guide`,
`writing-quality-editor` 네 스킬을 다룹니다. 이름을 직접 쓴 요청, 자연스러운 요청, `WQE` 줄임말,
필수 입력이 빠진 요청과 여러 작업이 섞인 요청에 어떻게 반응해야 하는지 확인합니다.
`street-portrait-artist`의 요청 처리는 [별도 예제](../street-portrait-artist/README.ko.md)에서 확인하세요.

정해진 키워드를 입력해야만 동작하는 명령은 아닙니다. 실행 환경과 모델에 따라 선택 결과가 달라질 수
있으므로, 사용할 스킬을 명확히 하려면 이름을 직접 쓰세요. 자연어 요청으로 스킬을 선택해도 읽기 전용
조건, 변경 전 승인, 산출물을 관리하는 작업 절차는 그대로 따라야 합니다.

## 파일

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — 식별 정보를 제거한 prompt
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — 각 요청을 어떻게 처리해야 하는지
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — 근거 범위를 한정한 runtime 결과

이 fixture는 설치되는 skill package에 포함되지 않습니다.
