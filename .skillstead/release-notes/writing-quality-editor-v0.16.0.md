> **Latest** refers to the most recently published individual skill release, not a catalog version.

## writing-quality-editor 0.16.0 — Explain the Subject Directly

WQE's drafting and editing instructions now address sentences that sound like internal review notes.
A sentence can be grammatically correct and preserve its facts while still making the reader work out what
actually happened. The guidance asks for direct explanations of the facts, checks, unknowns, and actions.

The change covers Korean drafting and the established assessment, revision, and adaptation path. It asks WQE
to check again before delivery, repair the awkward sentence itself, and use the author's approved correction
as context. Appropriate reviewer instructions and already clear prose should remain intact.

For example, with the author's confirmed context, a statement about not extending local success into broader
verification becomes: “This lab was checked locally on macOS. Windows execution, cloud deployment, and actual
service operation were not separately verified.” This is an illustrative editorial example, not a platform
validation result for WQE.

This release changes the instructions. No new behavioral comparison or measurement of how often the problem
recurs was performed. Beta maturity and Claude Code/Codex support remain unchanged. Replace the complete
`skills/writing-quality-editor/` folder to receive the updated references and guides.

### 한국어

내부 검토 메모 같은 표현을 독자용 글에 그대로 쓰는 문제를 작성·편집 지침에서 다루도록 했습니다.
문법과 사실관계가 맞더라도 독자가 뜻을 다시 풀어야 한다면, 실제로 무엇을 했고 확인했는지,
무엇을 아직 모르는지 또는 어떤 행동이 필요한지를 직접 설명하도록 했습니다.

한국어 새 글 작성과 기존 진단·수정·언어 간 각색 경로에 적용합니다. 최종 점검에서도 같은 문제를
확인하고, 어색한 문장을 남긴 채 설명만 덧붙이지 않도록 했습니다. 사용자가 확정한 수정문의 맥락을
따르며, 실제 검토자를 위한 지침과 이미 명확한 문장은 유지합니다.

사용자가 맥락을 확정한 예를 들면 다음과 같습니다.

> 이 실습은 macOS 로컬 환경에서 확인했습니다. Windows 환경에서의 실행, 클라우드 배포, 실제 서비스 운영은 별도로 검증하지 않았습니다.

이 문장은 편집 기준을 설명하는 예시이며 WQE의 플랫폼 검증 결과가 아닙니다.
이번 릴리스는 지침을 보완한 것입니다. 새 지침의 동작 비교나 문제 표현의 재발률은 측정하지 않았습니다.
Beta와 Claude Code·Codex 지원은 유지합니다. 업데이트하려면 `skills/writing-quality-editor/` 폴더 전체를 교체하세요.

- [Package / 패키지](https://github.com/kyungseo/skillstead/tree/writing-quality-editor/v0.16.0/skills/writing-quality-editor)
- [Install / 설치 안내](https://github.com/kyungseo/skillstead/blob/writing-quality-editor/v0.16.0/docs/INSTALL.md)
- [Changelog / 변경 기록](https://github.com/kyungseo/skillstead/blob/writing-quality-editor/v0.16.0/skills/writing-quality-editor/CHANGELOG.md)
- [Changes / 변경 비교](https://github.com/kyungseo/skillstead/compare/writing-quality-editor/v0.15.0...writing-quality-editor/v0.16.0)

The versioned unit is `skills/writing-quality-editor/`. GitHub source archives contain the whole repository snapshot.
GitHub 소스 압축 파일에는 저장소 전체가 들어 있습니다. 설치 대상은 `skills/writing-quality-editor/` 폴더입니다.
