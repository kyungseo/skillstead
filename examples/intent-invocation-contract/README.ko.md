# Intent와 Invocation 계약

[English](./README.md) · **한국어**

이 repository에서만 사용하는 검증 시나리오 모음(fixture)은 Skillstead의 독립적인 네 skill이 이름을
직접 쓴 요청, 자연스러운 요청, `WQE` 줄임말, 필수 입력이 빠진 요청과 여러 작업이 섞인 요청에 어떻게
반응해야 하는지 확인합니다.

고정된 keyword 명령을 만들지는 않습니다. Runtime과 model에 따라 선택 결과가 달라질 수 있으므로
skill 이름을 직접 쓰는 방법이 가장 예측 가능합니다. 자연어로 선택하더라도 읽기 전용 범위, 변경 전
승인과 산출물 소유 경계는 그대로 지켜야 합니다.

## 파일

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — 식별 정보를 제거한 prompt
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — 각 요청을 어떻게 처리해야 하는지
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — 근거 범위를 한정한 runtime 결과

이 fixture는 설치되는 skill package에 포함되지 않습니다.
