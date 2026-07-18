# writing-quality-editor 예제

[English](./README.md) · **한국어**

[`writing-quality-editor`](../../skills/writing-quality-editor)의 계약을 검증하기 위한 가상 자료입니다.
여기에 나오는 제품, 명령, 코드, 버전과 수치는 모두 임의로 만들었습니다.

| 경로 | 용도 |
| --- | --- |
| `fixtures/scenarios.md` | Compose, Assess, Revise, Adapt를 다루는 요청과 원문 자료 21개 |
| `fixtures/expected-outcomes.md` | 정답표와 의미 보존 점검표. 평가 대상 에이전트에게는 제공하지 않음 |
| `fixtures/validation-evidence.md` | 정적 검사, 새 대화에서의 실행 기록, 중단 기준과 공개 문구의 근거 범위 |
| `release-claim-audit-v0.7.0-prepublish-20260718.md` | 릴리스 필수 공개 문구 13건의 사전 평가와, 공개 후까지 남는 고정 태그 검증 항목 |
| `release-claim-audit-v0.7.0-postpublish-20260718.md` | 고정 태그 설치 주장과 Claude Code·Codex 실행 환경 지원 문구에 대한 릴리스 후 최종 점검 |

정의된 문서 유형 7종, 같은 언어 안에서의 교정, EN→KO·KO→EN Adapt, 의미 변화, 과도한 수정,
`needs-human`, 식별자 보호, 쉬운 문장으로 고쳐 쓰기, 탐지기 회피 없이 부자연스러운 반복 패턴 다듬기,
이미 자연스러운 문장을 불필요하게 고치지 않는 동작을 모두 포함합니다.

설치된 스킬과 선택한 시나리오만 새 대화에 제공해 실행합니다. 결과 문구와 형식이 똑같을 필요는 없으며,
정답표에서 요구하는 핵심 행동과 일치하는지 확인합니다.

F19·F20에는 시나리오에 적힌 제한된 조사 예산을 적용합니다. 조사 깊이가 아니라 근거를 다루는 행동을
검증하기 위한 제한이며, 실제 사용자 작업의 조사 범위를 제한하지 않습니다.
