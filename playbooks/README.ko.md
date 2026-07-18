# Playbooks

[English](./README.md) · **한국어**

Maintainer용 참고 문서(playbook) 영역입니다. 설치형 skill이 아니며, skill 설치에 이 파일들이 필요하지
않습니다.

| Playbook | 용도 |
| --- | --- |
| [`public-release/`](./public-release/README.ko.md) | 비공개 저장소를 공개로 전환하고 이후를 검증할 때 쓰는 범용 체크리스트·템플릿 |

## public-release Provenance

`public-release/`의 문서 중 **기존 6개**(README, checklist, sweep, settings template, post-public
verification, social template)는 독립 private repository `kyungseo/public-release-playbook`의
`5594aef` snapshot을 2026-07-17에 이 저장소로 옮긴 것입니다. 공개해도 안전한 시점의 파일만 가져왔고
Git 이력은 이관하지 않았습니다. 편입 당시 6개 파일은 원본 snapshot과 내용이 같았습니다.
`recurring-release-protection-checkpoint.md`는 원본에 없었으며, 편입 뒤 첫 release protection 보강
(2026-07-17)에서 새로 작성한 7번째 문서입니다. 이제 모든 문서는 이 repository의 일반 PR로 변경할
수 있으며, 전부 [Apache-2.0](../LICENSE) license 범위에 포함됩니다.

이 playbook 문서들은 범용 release 절차의 최종 기준이며,
[`skills/github-release-guide`](../skills/github-release-guide)는 같은 규칙을 자체 패키지에 포함한 설치형
mirror입니다. 두 문서의 내용이 서로 다를 경우에는 이 playbook을 기준으로 판단합니다. English 문서를
최종 기준으로 관리하며, `.ko.md` 파일은 같은 내용을 담는 한국어 문서입니다. 의미가 달라지는 수정은
두 언어 문서에 같은 pull request로 반영합니다. English와 한국어 문서의 내용이 서로 다르면 English
문서를 기준으로 판단합니다.
