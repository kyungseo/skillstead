> **Latest** refers to the most recently published individual skill release, not a catalog version.

## writing-quality-editor 0.11.0

This minor release makes wording and naturalness requests start with local editing when the document's paragraph
and section order already works. The skill marks the smallest complete phrase, clause, or sentence with a concrete
reader problem, leaves the surrounding text unchanged, and checks every resulting delta against that marked change surface.
It can still use structural revision when it identifies a separate structural problem.

The naturalness pass now turns indirect metaphors and nominalized instructions into concrete actor-and-action
wording without using a mechanical replacement list. If a phrase could mean discretion, approval, or notification,
the skill leaves that span unchanged under `Needs Human` and continues with other safe edits. Direct short-text
requests return only the usable revision by default, or the unchanged source when no edit is needed.

### 한국어

이번 minor release부터 문장 표현이나 자연스러움을 고쳐 달라는 요청은 기존 문단과 섹션 순서에 문제가
없는 한 국소 편집부터 시작합니다. 독자가 실제로 막히는 가장 작은 완결된 구·절·문장만 수정 대상으로
표시하고 나머지는 수정 범위에서 제외합니다. 구조 문제가 별도로 확인된 경우에만 구조 변경으로 범위를 넓힙니다.

간접적인 은유나 명사형 지시는 기계적인 치환 목록이 아니라 문맥에 맞는 주체와 행동이 보이는 문장으로
고칩니다. 하나의 표현이 임의 변경, 승인 없는 변경, 사전 고지 없는 변경 중 무엇을 뜻하는지 확정할 수
없다면 해당 구간은 그대로 두고 `Needs Human`으로 표시한 뒤, 안전한 다른 부분만 계속 다듬습니다. 짧은
문장 수정 요청에는 기본적으로 수정한 문장만, 고칠 필요가 없다면 원문만 반환합니다.

## Evidence And Limits

- Package: `skills/writing-quality-editor/`
- Tag: `writing-quality-editor/v0.11.0`
- Validation: repository tests `178/178`, repository validator `0 finding(s)`, generic skill validator
  `Skill is valid!`, and `git diff --check` pass
- Runtime observation: a corrected project-local targeted run passed Codex F28-B; Codex F25 changed one locked
  span to an equivalent phrase; Claude Code F12 preserved the source but added a disproportionate report
- Compatibility or migration: no migration is required; replace the complete installed skill folder when updating
- Known limitations: agent output is non-deterministic. The new defaults reduce unnecessary changes but do not
  guarantee that every run avoids preference-driven changes outside the marked spans; review the final delta for
  important documents

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
