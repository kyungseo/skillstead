# Playbooks

[English](./README.md) · **한국어**

유지관리자를 위한 참고 문서 영역입니다. 설치형 스킬이 아니므로 스킬을 설치할 때 이 파일들은
필요하지 않습니다.

| Playbook | 용도 |
| --- | --- |
| [`public-release/`](./public-release/README.ko.md) | 비공개 저장소를 공개로 전환하고 이후 상태를 검증하는 범용 체크리스트와 템플릿 |
| [`skill-development/`](./skill-development/README.ko.md) | 스킬의 패키지, 이름, 검증, 리뷰, 릴리스와 지원 종료에 관한 개발 표준 |

## public-release 편입 이력

`public-release/`의 최초 6개 문서는 2026-07-17에 별도로 관리되던 공개 가능한 스냅샷에서 편입했으며
Git 이력은 가져오지 않았습니다. `recurring-release-protection-checkpoint.md`는 이후 7번째 문서로
추가했습니다. 원본 식별 정보와 로컬 리비전은 공개 운영 계약에 포함하지 않습니다. 이제 모든 문서는
이 저장소의 일반 pull request로 변경하며 [Apache-2.0](../LICENSE) 라이선스 범위에 포함됩니다.

이 playbook은 범용 릴리스 절차의 최종 기준입니다.
[`skills/github-release-guide`](../skills/github-release-guide)는 자체 product behavior를 가진,
독립 설치 가능한 operational projection입니다. Playbook은 수정 순서 gate가 아닙니다. Skill에서
변경을 먼저 설계할 수 있지만, 공유하는 범용 mechanics는 이 playbook에도 반영해야 합니다.

차이가 있으면 ownership에 따라 판정합니다. 범용 release mechanics는 playbook을 따릅니다.
Assess/Guided state machine, readiness status, approval, refusal, handoff와 runtime output은 해당 차이와
근거가 검토된 ownership 또는 disposition evidence에 intentional difference로 기록된 경우에만 skill을
따릅니다. 기록되지 않은 차이는 의도된 예외가 아니라 drift이며 merge 또는 release 전에 해소해야 합니다.

영문 문서가 최종 기준이며 `.ko.md` 파일은 같은 내용을 담는 한국어 문서입니다. 의미가 달라지는 변경은
같은 pull request에서 두 언어에 함께 반영합니다.

`skill-development/`는 작성·수명주기 규칙에 관한 최종 유지관리자 참고 문서입니다. 설치된 스킬이 이
playbook에 의존하도록 만들지는 않습니다.
