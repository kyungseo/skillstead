> **Latest** refers to the most recently published individual skill release, not a catalog version.

## svg-infographic 0.12.0 — Reuse Settled Preflight Decisions

This minor release stops preflight from asking again about visual choices, output paths, and file-creation
authorization that the user already settled for the current task. It asks only for material missing choices or
missing write authorization and applies the same boundary when selecting a key message from supplied source
material.

Tool installation, sandbox permission, and other host-controlled gates remain separate. The rendering contract,
canonical TypePack outputs, Stable maturity, and supported runtimes are unchanged.

The 18 bilingual TypePack pairs and their receipts were regenerated through the canonical path after the
instruction change. Repository validation and the SVG release-artifact gate passed. This does not claim a new
diagram type or different rendered output.

### 한국어

이번 minor release에서는 사용자가 현재 작업에서 이미 정한 시각 선택, 출력 경로와 파일 생성 승인을
preflight가 다시 묻지 않습니다. 결과에 영향을 주는 선택이나 쓰기 승인이 실제로 빠졌을 때만 질문하며,
제공된 자료에서 핵심 메시지를 정할 때도 같은 경계를 적용합니다.

도구 설치, sandbox 권한처럼 실행 환경이 관리하는 gate는 별도로 유지합니다. 렌더링 계약, canonical
TypePack 결과, Stable 성숙도와 지원 실행 환경은 바뀌지 않습니다.

지침 변경 후 canonical 경로로 영문·한국어 TypePack 18쌍과 receipt를 다시 생성했습니다. 저장소 검증과
SVG release-artifact gate를 통과했습니다. 새 다이어그램 유형이나 달라진 렌더링 결과를 주장하는
릴리스는 아닙니다.

- [Package / 패키지](https://github.com/kyungseo/skillstead/tree/svg-infographic/v0.12.0/skills/svg-infographic)
- [Changelog / 변경 기록](https://github.com/kyungseo/skillstead/blob/svg-infographic/v0.12.0/skills/svg-infographic/CHANGELOG.md)
- [Changes / 변경 비교](https://github.com/kyungseo/skillstead/compare/svg-infographic/v0.11.1...svg-infographic/v0.12.0)

The versioned unit is `skills/svg-infographic/`. GitHub source archives contain the whole repository snapshot, not a standalone skill package.
GitHub 소스 압축 파일에는 저장소 전체가 들어 있습니다. 설치 대상은 `skills/svg-infographic/` 폴더입니다.
