# writing-quality-editor 예제

[English](./README.md) · **한국어**

[`writing-quality-editor`](../../skills/writing-quality-editor)의 contract를 검증하기 위한 synthetic
자료입니다. 여기에 나오는 제품, 명령, code, version과 수치는 모두 가상입니다.

| 경로 | 용도 |
| --- | --- |
| `fixtures/scenarios.md` | Compose, Assess, Revise, Adapt를 다루는 prompt와 source material 21개 |
| `fixtures/expected-outcomes.md` | Answer key와 invariant checklist. 평가받는 agent에게는 제공하지 않음 |
| `fixtures/validation-evidence.md` | Static gate, fresh-context 실행 기록, stop rule과 claim boundary |

7개 document profile, same-language editing, EN→KO·KO→EN Adapt, meaning drift, over-editing,
`needs-human`, identifier 보호, plain-language rewrite, detector 회피 없는 AI-style pattern 정리, 이미
자연스러운 문장의 불필요한 rewrite 거부를 모두 포함합니다.

설치된 skill과 선택한 scenario만 fresh context에 제공해 실행합니다. 결과 문구와 형식이 똑같을 필요는
없으며, answer key의 material behavior가 일치하는지 확인합니다.

F19·F20에는 scenario에 적힌 제한된 조사 예산을 적용합니다. 조사 깊이가 아니라 근거를 다루는 행동을
검증하기 위한 제한이며, 실제 사용자 작업의 조사 범위를 제한하지 않습니다.
