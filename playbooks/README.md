# Playbooks

Maintainer용 참고 문서(playbook) 영역입니다. 설치형 skill이 아니며, skill 설치에 이 파일들이 필요하지
않습니다.

| Playbook | 용도 |
| --- | --- |
| [`public-release/`](./public-release) | 비공개 저장소를 공개로 전환하고 이후를 검증할 때 쓰는 범용 체크리스트·템플릿 |

## public-release Provenance

`public-release/`의 문서 중 **기존 6개**(README, checklist, sweep, settings template, post-public
verification, social template)는 독립 private repository `kyungseo/public-release-playbook`의 snapshot
`5594aef`를 2026-07-17에 위치 편입(consolidation)한 것입니다. git history는 이관하지 않았고
(public-safe snapshot import), 편입 시점의 그 6개 파일 내용은 source snapshot과 동일했습니다.
`recurring-release-protection-checkpoint.md`는 snapshot import가 아니라 **편입 후 첫 canonical
보강(release protection baseline, 2026-07-17)에서 새로 작성된 7번째 문서**입니다. 편입 이후의 모든
문서는 이 repository의 일반 PR로 변경될 수 있으며, 전부 [Apache-2.0](../LICENSE) license 범위에
포함됩니다.

이 playbook 문서들은 generic release mechanics의 canonical 기준이며, [`skills/github-release-guide`](../skills/github-release-guide)는
설치형 self-contained mirror입니다. 두 표면이 서로 다르면 이 playbook이 기준입니다. 문서 본문은
현재 **한국어 기준(Korean-primary)**이며, English 판은 아직 제공되지 않습니다 — 내용 안정화 후
English primary + Korean mirror 전환이 후속 작업으로 예정되어 있습니다.
