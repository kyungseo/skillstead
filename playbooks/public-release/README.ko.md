# Public Release Playbook

[English](./README.md) · **한국어**

private repo를 public repo로 전환할 때 쓰는 개인용 체크리스트다.

이 playbook은 특정 프로젝트에 종속되지 않는다. 프로젝트별 의사결정과 실행 기록은 대상 repo에 남기고,
반복해서 쓸 수 있는 공개 전환 절차와 점검 기준은 여기에 모은다.

## 문서

| 파일 | 용도 |
| --- | --- |
| `github-public-release-checklist.ko.md` | public 전환 전체 체크리스트, GitHub Release title/notes 준비 기준 |
| `sensitive-info-sweep.ko.md` | 민감정보 점검 가이드 |
| `repo-settings-template.ko.md` | GitHub repo settings 기본값 |
| `post-public-verification.ko.md` | public 전환 직후 검증 |
| `recurring-release-protection-checkpoint.ko.md` | 공개 후 매 version release 전 protection 재점검 |
| `social-release-note-template.ko.md` | 공개 후 소셜 공유 문구 준비 템플릿 |

English 문서는 같은 이름의 `.md` 파일에서 확인할 수 있습니다.

## 운영 원칙

repo visibility를 바꾸기 전에 이 playbook을 먼저 확인한다.

대상 repo마다:

1. public 전환 작업을 추적할 Work item을 만들거나 기존 Work를 재사용한다.
2. visibility 변경 전에 pre-public check를 끝낸다.
3. 공개 전 점검을 모두 통과한 뒤에만 public으로 전환한다.
4. visibility 변경 직후 `post-public-verification.ko.md`를 실행한다.
5. GitHub Release를 만들 예정이면 publish 전에 title과 notes 초안을 먼저 준비한다.
6. 공개 공유를 할 예정이면 짧은 announcement note를 준비한다.
7. 막힌 설정, GitHub plan 제약, 수동 후속 작업은 대상 repo에 기록한다.
