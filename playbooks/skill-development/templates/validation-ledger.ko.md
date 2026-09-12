# Validation Ledger Template

## Subject

- Skill:
- Package revision:
- 검토 파일:
- Validator version/revision:
- Runtime/capability surface:
- Locale:
- Runtime version/build:
- 실제 로드된 package version/content digest:
- 실제 사용 가능한 도구 / 사용한 도구:
- 비공개 실행 기록: 기록됨 / 확인 불가

요청한 모델과 관측한 모델, reasoning effort(실행 중 변경 포함), fallback·routing 관측 결과와 정확한
실행 명령은 비공개 실행 기록에 남깁니다. 관측하지 못한 값은 명시하고, alias나 제품 기본값으로 추정하지
않습니다. 공개 ledger에는 중립적인 실행자 label을 사용하고 model/session identity를 제외합니다.
스킬 본문을 프롬프트에 넣은 실행은 설치된 스킬의 자동 발견을 입증하지 않습니다. 검증한 로딩 경로를 기록합니다.

## Claim Ledger

| Claim | 필요한 evidence | 관측한 evidence | 상태 | Limitation |
| --- | --- | --- | --- | --- |
|  |  |  | verified / partial / unsupported / needs-human |  |

## Scenario Results

| Scenario | Executor context | Answer key 미열람? | 결과 | Raw evidence 경로 | Finding |
| --- | --- | --- | --- | --- | --- |
|  | fresh / prior context | yes / no | pass / fail / blocked | repository-relative path |  |

## Commands

| Command | Target revision | 결과 | Notes |
| --- | --- | --- | --- |
|  |  | pass / fail / not-run |  |

## Review

- Findings:
- Driver dispositions:
- Arbiter decisions:
- Residual risk:
- 이 evidence가 허용하는 claim:
- 허용하지 않는 claim:

## Public Sanitation

- [ ] Repository-relative path만 사용
- [ ] Username·local absolute path 없음
- [ ] Private tracker, repository, revision, reviewer/model/session identity 없음
- [ ] 무관한 comparison provenance 없음
- [ ] Synthetic, non-client input
