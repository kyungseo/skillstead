# Public Release Playbook

private repo를 public repo로 전환할 때 쓰는 개인용 체크리스트다.

이 playbook은 특정 프로젝트에 종속되지 않는다. 프로젝트별 의사결정과 실행 기록은 대상 repo에 남기고,
반복해서 쓸 수 있는 공개 전환 절차와 점검 기준은 여기에 모은다.

## 문서

| 파일 | 용도 |
| --- | --- |
| `github-public-release-checklist.md` | public 전환 전체 체크리스트, GitHub Release title/notes 준비 기준 |
| `sensitive-info-sweep.md` | 민감정보 점검 가이드 |
| `repo-settings-template.md` | GitHub repo settings 기본값 |
| `post-public-verification.md` | public 전환 직후 검증 |
| `social-release-note-template.md` | 공개 후 소셜 공유 문구 준비 템플릿 |

## 운영 원칙

repo visibility를 바꾸기 전에 이 playbook을 먼저 확인한다.

대상 repo마다:

1. public 전환 작업을 추적할 Work item을 만들거나 기존 Work를 재사용한다.
2. visibility 변경 전에 pre-public check를 끝낸다.
3. clean baseline이 확인된 뒤에만 public으로 전환한다.
4. visibility 변경 직후 post-public verification을 실행한다.
5. GitHub Release를 만들 예정이면 publish 전에 title과 notes 초안을 먼저 준비한다.
6. 공개 공유를 할 예정이면 짧은 announcement note를 준비한다.
7. 막힌 설정, GitHub plan 제약, 수동 후속 작업은 대상 repo에 기록한다.
