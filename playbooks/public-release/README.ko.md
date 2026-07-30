# 공개 릴리스 Playbook

[English](./README.md) · **한국어**

비공개 저장소를 공개로 전환할 때 사용하는 개인용 체크리스트입니다.

이 playbook은 특정 프로젝트에 종속되지 않습니다. 프로젝트별 결정과 실행 기록은 대상 저장소에
남기고, 여러 프로젝트에서 다시 사용할 수 있는 공개 전환 절차와 검토 기준은 여기에 관리합니다.

## 문서

| 파일 | 용도 |
| --- | --- |
| `github-public-release-checklist.ko.md` | GitHub Release 제목과 본문 준비를 포함한 공개 전환 전체 체크리스트 |
| `sensitive-info-sweep.ko.md` | 민감 정보 점검 안내 |
| `repo-settings-template.ko.md` | GitHub 저장소 설정 기준 |
| `post-public-verification.ko.md` | 저장소 공개 직후 검증 |
| `recurring-release-protection-checkpoint.ko.md` | 공개 후 매 버전 릴리스 전에 수행하는 보호 설정 점검 |
| `social-release-note-template.ko.md` | 공개 안내문 작성 템플릿 |

영문 문서는 같은 이름의 `.md` 파일에서 확인할 수 있습니다.

## 운영 원칙

저장소의 공개 상태를 바꾸기 전에 이 playbook을 검토합니다.

대상 저장소마다 다음 순서로 진행합니다.

1. 공개 전환 작업을 추적할 Work item을 만들거나 기존 Work를 재사용합니다.
2. 공개 상태를 바꾸기 전에 사전 공개 점검을 끝냅니다.
3. 기준 상태에 문제가 없음을 확인한 뒤에만 저장소를 공개합니다.
4. 공개 상태를 바꾼 직후 `post-public-verification.ko.md`를 실행합니다.
5. GitHub Release를 만들 예정이라면 공개하기 전에 제목과 본문 초안을 준비합니다.
6. 릴리스를 외부에 알릴 예정이라면 짧은 안내문을 준비합니다.
7. 막힌 설정, GitHub 요금제 제약과 수동 후속 작업은 대상 저장소에 기록합니다.
