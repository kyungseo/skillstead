# Playbooks

[English](./README.md) · **한국어**

Maintainer용 참고 문서(playbook) 영역입니다. 설치형 skill이 아니며, skill 설치에 이 파일들이 필요하지
않습니다.

| Playbook | 용도 |
| --- | --- |
| [`public-release/`](./public-release/README.ko.md) | 비공개 저장소를 공개로 전환하고 이후를 검증할 때 쓰는 범용 체크리스트·템플릿 |
| [`skill-development/`](./skill-development/README.ko.md) | Skill 개발을 위한 package, naming, validation, review, release, retirement 표준 |

## public-release History

`public-release/`의 최초 6개 문서는 2026-07-17에 독립적으로 관리되던 public-safe snapshot에서
편입했으며 Git history는 가져오지 않았습니다. `recurring-release-protection-checkpoint.md`는 이후
7번째 문서로 추가했습니다. 원본 identity와 local revision은 public operating contract에 포함하지
않습니다. 이제 모든 문서는 이 repository의 일반 pull request로 변경하며
[Apache-2.0](../LICENSE) license 범위에 포함됩니다.

이 playbook 문서들은 범용 release 절차의 최종 기준이며,
[`skills/github-release-guide`](../skills/github-release-guide)는 같은 규칙을 자체 패키지에 포함한 설치형
mirror입니다. 두 문서의 내용이 서로 다를 경우에는 이 playbook을 기준으로 판단합니다. English 문서를
최종 기준으로 관리하며, `.ko.md` 파일은 같은 내용을 담는 한국어 문서입니다. 의미가 달라지는 수정은
두 언어 문서에 같은 pull request로 반영합니다. English와 한국어 문서의 내용이 서로 다르면 English
문서를 기준으로 판단합니다.

`skill-development/`는 authoring·lifecycle 규칙의 canonical maintainer reference입니다. 설치된
skill이 이 playbook에 의존하도록 만들지는 않습니다.
