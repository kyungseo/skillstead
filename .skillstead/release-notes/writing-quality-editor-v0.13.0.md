> **Latest** refers to the most recently published individual skill release, not a catalog version.

## writing-quality-editor 0.13.0

This minor release helps WQE find the same explanatory problem across an entire requested document. User examples
now define the kind of defect to look for rather than an exhaustive phrase list. Explanations, comparisons, and
instructions are revised when readers would otherwise have to reconstruct a necessary relationship, decode a term
or shorthand in place of the point, or separate an observation from unsupported causation themselves.

The release also tightens the no-edit boundary. Ordinary local references and equally natural alternatives—such
as active versus passive endings or modifier placement—remain unchanged unless the source creates a material reader
problem. `Needs Human` is reserved for unresolved choices that materially block a safe, usable result.

### 한국어

이번 minor release에서는 사용자가 요청한 문서 전체에서 같은 설명 문제를 찾아냅니다. 사용자가 제시한 예시는
바꿀 문구의 전체 목록이 아니라 찾아야 할 문제 유형을 알려 줍니다. 설명·비교·안내 문장에서 독자가 필요한
관계를 직접 재구성하거나, 용어와 축약 표현을 해석한 뒤에야 핵심을 이해하거나, 관찰 결과와 확인되지 않은
원인을 스스로 구분해야 한다면 해당 구간을 다듬습니다.

원문 보존 경계도 강화했습니다. 가까운 문맥에서 자연스럽게 해석되는 지시 대상과 능동·수동 종결, 수식어 위치
등 동등하게 자연스러운 표현은 실질적인 독자 문제가 없는 한 바꾸지 않습니다. `Needs Human`은 안전하게 사용할
결과를 만들 수 없게 하는 중요한 미확정 선택에만 사용합니다.

## Evidence And Limits

- Package: `skills/writing-quality-editor/`
- Tag: `writing-quality-editor/v0.13.0`
- Validation: repository tests `282/282`, repository validator `0 finding(s)`, generic skill validator passed,
  hosted pull-request checks passed, and `git diff --check` passed
- Runtime observation: answer-key-blind isolated runs with Claude Fable 5 and Codex passed F34 A/B/C and F36;
  both runtimes returned F29 and F35 A byte-for-byte in three independent runs
- Compatibility or migration: no migration is required; replace the complete installed skill folder when updating
- Known limitations: agent output remains non-deterministic, this is a bounded amendment-level evaluation rather
  than a full-matrix rerun, and maturity remains Beta; review the final delta for important documents

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
