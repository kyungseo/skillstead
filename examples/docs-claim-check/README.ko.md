# docs-claim-check 예제

[English](./README.md) · **한국어**

[`docs-claim-check`](../../skills/docs-claim-check)의 계약을 검증하기 위한 가상 자료입니다.
모든 내용은 임의로 만들었습니다. "AcmeTask"는 가상 제품에 흔히 쓰는 Acme 이름을 따르고,
manifest 이름에는 의도적으로 `-fixture` 접미사를 붙였습니다. 실제 프로젝트, 문서나 저장소를
참조하지 않습니다.

| 경로 | 내용 |
| --- | --- |
| `fixtures/sample-readme.md` | 네 가지 판정 상태를 모두 검증하도록 만든 가상 README |
| `fixtures/evidence/` | 대응하는 근거 묶음: manifest, 태그 목록, CI 출력 |
| `fixtures/boundary-requests.md` | 스킬이 반드시 거부해야 하는 요청 3종(명령 실행, patch 작성, 코드 검토) |
| `fixtures/expected-outcomes.md` | 정답표 — 평가 대상 에이전트에게는 제공하지 않음 |
| `example-output.md` | 계약을 준수하는 완결 출력 예시 |

검증 자료는 판정 상태 4종(`verified`, `unsupported`, `stale-suspected`, `needs-human`),
`unsupported` 사유 3종(`missing-evidence`, `contradicted`, `insufficient-coverage`), 복합 주장 분해와
범위 밖 요청 거부 3종을 다룹니다.
