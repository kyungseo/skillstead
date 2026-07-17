# Playbooks

Maintainer용 참고 문서(playbook) 영역입니다. 설치형 skill이 아니며, skill 설치에 이 파일들이 필요하지
않습니다.

| Playbook | 용도 |
| --- | --- |
| [`public-release/`](./public-release) | 비공개 저장소를 공개로 전환하고 이후를 검증할 때 쓰는 범용 체크리스트·템플릿 |

## public-release Provenance

`public-release/`의 문서 6개는 독립 private repository `kyungseo/public-release-playbook`의 snapshot
`5594aef`를 2026-07-17에 위치 편입(consolidation)한 것입니다. git history는 이관하지 않았고(public-safe
snapshot import), 파일 내용은 source snapshot과 동일합니다(semantic change 없음). 편입과 함께 이
문서들은 이 repository의 [Apache-2.0](../LICENSE) license 범위에 포함됩니다.

이 playbook 문서들은 generic release mechanics의 canonical 기준이며, [`skills/github-release-guide`](../skills/github-release-guide)는
설치형 self-contained mirror입니다. 두 표면이 서로 다르면 이 playbook이 기준입니다. 문서 본문은
현재 한국어로 작성되어 있습니다.
