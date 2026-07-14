# docs-claim-check

[English](./README.md) · **한국어**

공개 문서(README, release note, install/사용 문서)의 claim이 사용자가 제공한 evidence —
manifest, log, tag 목록, CI 출력, 직접 실행한 명령의 출력 — 로 실제로 뒷받침되는지 검토한다.

복합 문장을 atomic claim으로 분해하고, 각 claim을 고정된 decision tree에 통과시켜 claim마다
정확히 하나의 confidence label을 부여한다:

| Label | 의미 |
| --- | --- |
| `verified` | 제공된 현재 evidence가 claim 전체를 직접 지지 — 검토된 범위 안에서만 유효 |
| `unsupported` | 객관적으로 판정 가능하나 evidence가 없거나(`missing-evidence`), 모순되거나(`contradicted`), 부분적(`insufficient-coverage`) |
| `stale-suspected` | 날짜/version/지원 범위의 시간적 불일치 — 과거엔 맞았을 수 있으나 현재성 미지지 |
| `needs-human` | 주관적 판단, code review, 명령 실행, 외부 확인이 필요 |

모든 claim-assessment 출력은 **input scope** — 어떤 문서·evidence를 검토했고,
무엇을 요청했지만 받지 못했으며, claim coverage가 몇 건인지 — 를 먼저 명시한다.
이를 통해 `verified`의 적용 범위를 명시적이고 감사 가능하게 유지한다.

## 이런 때 좋다

- release·공지 전에 README fact-check
- release note를 tag·manifest·CI 출력과 대조
- 빠른 개발 후 낡은 version/지원 claim 탐지
- "이 claim을 검증하려면 무엇이 필요한가" 목록(evidence request) 확보

## 이런 용도가 아니다

- code review·버그 탐지·보안 감사 — code-review 도구를 사용
- 수정문·patch 생성 — finding만 출력한다
- 명령 실행이 필요한 작업 — 계약상 명령을 실행하지 않으며 출력 제공을 요청한다.
  요청이 섞여 있으면 범위 밖 부분만 거절하고 나머지 claim 검토는 진행한다

## Beta 모델 검증

2026-07-14 기준 Claude Code의 Fable과 Sonnet에서 계약 fixture를 통과했습니다. 모델에 따라
행 분해와 coverage 장부는 달라질 수 있으며, material claim 포괄 여부·confidence label 의미·
evidence 경계·output contract 준수를 호환성 기준으로 봅니다.

## 예제

synthetic fixture 세트와 완결 출력 예시는
[`examples/docs-claim-check`](../../examples/docs-claim-check) 참조.
