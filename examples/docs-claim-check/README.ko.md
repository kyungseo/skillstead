# docs-claim-check 예제

[English](./README.md) · **한국어**

[`docs-claim-check`](../../skills/docs-claim-check)의 계약 검증용 synthetic 자료다.
모든 내용은 가상이다 — "AcmeTask"는 가상 제품 관례(Acme)를 따르고 manifest 이름에는
의도적으로 `-fixture` 접미사를 붙였다. 실제 프로젝트·문서·repository를 참조하지 않는다.

| 경로 | 내용 |
| --- | --- |
| `fixtures/sample-readme.md` | 모든 label을 검증하도록 설계된 synthetic README |
| `fixtures/evidence/` | 대응 evidence 묶음: manifest, tag 목록, CI 출력 |
| `fixtures/boundary-requests.md` | skill이 반드시 거부해야 하는 요청 3종(실행/patch/code review) |
| `fixtures/expected-outcomes.md` | 정답표 — 평가 대상 agent에게 노출 금지 |
| `example-output.md` | 계약을 준수하는 완결 출력 예시 |

fixture matrix가 검증하는 범위: label 4종(`verified`, `unsupported`, `stale-suspected`,
`needs-human`), `unsupported` reason 3종(`missing-evidence`, `contradicted`,
`insufficient-coverage`), 복합 claim 분해, 경계 거부 3종.
