# writing-quality-editor 예제

[English](./README.md) · **한국어**

[`writing-quality-editor`](../../skills/writing-quality-editor)의 계약을 검증하기 위한 가상 자료입니다.
시나리오의 제품·명령·사실은 합성이며, 검증 기록의 버전·모델·측정값은 기록된 실행을 나타냅니다.

| 경로 | 용도 |
| --- | --- |
| `fixtures/scenarios.md` | Compose, Assess, Revise, Adapt를 다루는 시나리오 39개. F37–F39에는 문맥 변형 6개를 포함 |
| `fixtures/expected-outcomes.md` | 정답표와 의미 보존 점검표. 평가 대상 에이전트에게는 제공하지 않음 |
| `fixtures/validation-evidence.md` | 정적 검사, 새 대화에서의 실행 기록, 중단 기준과 공개 문구의 근거 범위 |
| `release-claim-audit-v0.7.0-prepublish-20260718.md` | 릴리스 필수 공개 문구 13건의 사전 평가와, 공개 후까지 남는 고정 태그 검증 항목 |
| `release-claim-audit-v0.7.0-postpublish-20260718.md` | 고정 태그 설치 주장과 Claude Code·Codex 실행 환경 지원 문구에 대한 릴리스 후 최종 점검 |

정의된 문서 유형 7종, 같은 언어 안에서의 교정, EN→KO·KO→EN Adapt, 의미 변화, 과도한 수정,
`needs-human`, 식별자 보호, 쉬운 문장으로 고쳐 쓰기, 탐지기 회피 없이 부자연스러운 반복 패턴 다듬기,
한국어 문장의 구조를 유지한 자연스러움 개선, 이미 자연스러운 문장을 불필요하게 고치지 않는 동작을 모두 포함합니다.
여러 문서 유형의 설명 부담을 찾아내는 동작과 전문 독자에게 적절한 간결한 문장을 보존하는 대조 사례도 검증합니다.

설치된 스킬과 선택한 시나리오만 새 대화에 제공해 실행합니다. 정확 보존을 요구하는 사례 외에는 결과 문구와
형식이 똑같을 필요가 없으며, 정답표의 핵심 행동을 확인합니다. F37–F39는 실행자용 입력 분리 지침에 따라
문맥 변형 하나씩 제공합니다.

F19·F20에는 시나리오에 적힌 제한된 조사 예산을 적용합니다. 조사 깊이가 아니라 근거를 다루는 행동을
검증하기 위한 제한이며, 실제 사용자 작업의 조사 범위를 제한하지 않습니다.

`0.14.0`에서 추가한 한국어 새 글 작성 경로의 결과와 한계는
[스킬 안내](../../skills/writing-quality-editor/README.ko.md#새-한국어-글-작성)에서 확인하세요.
F01–F36의 과거 실행 기록이 새 작성 경로의 검증을 대신하지는 않습니다.

`0.15.0` 문단 흐름 지침의 [시나리오](./reader-flow/scenarios.md)와
[별도 정답표](./reader-flow/expected-outcomes.md)를 추가했습니다. 기존 36개 사례의 과거 결과와는 구분합니다.

[개발 검증 결과와 한계](./reader-flow/development-validation.ko.md)를 함께 확인할 수 있습니다.

[직접 설명 예제와 한정된 관찰 기록](./direct-prose.md)에서 반복 해명, 필요한 부정 규칙,
이미 자연스러운 문장과 보호된 인용을 다룹니다.

[한국어 문맥 대조 F37–F39](./fixtures/scenarios.md#running-f37f39)는 동일 원문에 두 문맥을 주어
반복 알림, 서류 명칭, 이전 기능 지원의 전제를 확인합니다.
[한정된 baseline 관찰](./fixtures/validation-evidence.md#f37f39-korean-context-pairs--2026-10-28)은
WQE 0.19.0 계약을 직접 제공한 첫 출력 6개를 재사용합니다. 설치된 스킬의 자동 선택, 일반적인 품질 향상이나
추가 실행 환경 지원을 입증한 결과는 아닙니다.
