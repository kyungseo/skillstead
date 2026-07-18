# Post-Fix Regression First Runs — F03, F04, F12 (Claude Code runtime, claude-fable-5 subagents, 2026-07-18)

## F03

`writing-quality-editor` — **Adapt** 모드 (EN → KO, `ko-KR`) 결과입니다.

**Adapted Text**

```text
Acme Notes 2.4에 오프라인 초안 복구 기능이 추가되었습니다.

초안이 동기화되기 전에 앱이 종료되었다면, 같은 노트를 다시 열고 Restore draft(초안 복구)를
선택하면 됩니다.

복구 동작은 macOS 15에서 확인되었습니다. Windows와 Linux에서는 아직 검증되지 않았습니다.
```

**Preservation Notes**

- 제품명·버전(`Acme Notes 2.4`), 플랫폼 식별자(`macOS 15`, `Windows`, `Linux`)는 원문 그대로 유지했습니다.
- 복구 조건("초안이 동기화되기 전에 앱이 종료된 경우")과 사용자 행동(같은 노트 다시 열기 → Restore draft 선택)의 순서와 범위를 그대로 보존했습니다.
- 검증 범위 경계를 그대로 유지했습니다: macOS 15에서만 확인됨, Windows·Linux는 미검증. 확신 강도를 높이거나("모든 플랫폼 지원") 낮추지 않았습니다.
- Tone은 요청대로 직접적·전문적인 합니다체로 통일했고, release note 관례에 따라 사용자 가시 결과(기능 추가) → 사용 방법 → 검증 범위·제한 순으로 배치했습니다. 이 순서는 원문과 동일합니다.

**Needs Human**

- `Restore draft`는 UI 버튼 라벨로 판단해 영문 원형을 유지하고 한국어 설명을 병기했습니다. 만약 한국어 UI에서 이 버튼이 이미 "초안 복구" 등으로 현지화되어 있다면, 실제 UI 문자열로 교체해야 사용자가 화면에서 버튼을 찾을 수 있습니다. 확인 필요: 한국어 빌드의 실제 버튼 라벨.

**Material Changes**

- "adds offline draft recovery"를 기능 명사구 직역("오프라인 초안 복구를 추가") 대신 한국어 release note 관용 표현("~ 기능이 추가되었습니다")으로 전환했습니다. 의미 변화는 없습니다.
- 영어 명령문("reopen … and choose …")을 조건 + 안내형 서술("~했다면 … 선택하면 됩니다")로 바꿨습니다. 행위 주체(사용자)와 행동 내용은 동일합니다.
- 원문 4문장을 기능 / 사용법 / 검증 범위의 3개 단락으로 재배열했습니다. 문장 수는 다르지만 담긴 주장·조건·제한은 동일합니다.

## F04

`Adapted Text`

> Before the release, run `git diff --check` to confirm there are no formatting errors in the documentation. Only if the check passes, create the `v2.4.0` tag on the current commit of `main`. If the check fails, do not create the tag — fix the errors, then run the check again from the beginning.

`Preservation Notes`

- Protected identifiers `git diff --check`, `v2.4.0`, and `main` are kept exactly as written, untranslated and unreformatted.
- The exclusive gating condition survives: tag creation is permitted **only** on a passing check ("검사가 통과한 경우에만"), not merely recommended after it. "Only if" keeps the same strength as the Korean `~경우에만`.
- The failure branch preserves all three elements in order: do not tag → fix the errors → re-verify from the beginning ("처음부터 다시 확인한다" is rendered as "run the check again from the beginning," keeping the full-restart requirement rather than a partial re-check).
- The tag target stays precise: the current commit of `main`, not the branch tip in general terms.
- The stated purpose of the check — confirming the documentation has no formatting errors — is carried over as the source claims it, without expanding it into a broader description of what `git diff --check` does.
- Imperative voice is used throughout, matching runbook convention for a maintainer audience. The Korean source is actorless; since a release runbook addresses a single acting maintainer and no approval or handoff boundary is crossed within these steps, the imperative does not hide an ownership ambiguity.

`Material Changes`

- Voice: Korean plain declarative procedure style (`~한다`) becomes English imperative, the natural register for an English runbook. Meaning and obligation strength are unchanged.
- The failure-branch sentence uses a dash to separate the prohibition from the recovery steps; the Korean links them with connective endings. The sequence and conditions are identical.

## F12

Revised Text

```text
Acme Diff compares two configuration files and highlights values that changed. Run `acme-diff before.yml after.yml`
to print a local report; the command does not upload either file.
```

Preservation Notes

The no-edit gate found no material improvement, so the source is returned exactly as provided. Every candidate change I considered was Neutral for a developer README audience:

- The opening sentence already does README-profile work in the right order: product identity ("Acme Diff"), what it does (compares two configuration files), and the concrete value (highlights changed values) — before any machinery.
- The second sentence is the shortest success path: an exact, copyable command (`acme-diff before.yml after.yml`) tied directly to its observable outcome (prints a local report).
- The trailing clause "the command does not upload either file" is a privacy/support boundary claim. Its placement immediately after the command is where a cautious developer looks for it; the semicolon correctly binds the guarantee to the command rather than leaving it as a detached disclaimer. Weakening, strengthening, or relocating it would alter a risk-relevant claim.
- Identifiers preserved untouched: `acme-diff`, `before.yml`, `after.yml`, the product name Acme Diff, and the terms "local report" and "upload".
- Candidate edits rejected as churn: splitting the semicolon into two sentences, reformatting the inline command into a fenced block, and synonym swaps such as "shows" for "highlights" or "generate" for "print". None solves a concrete reader problem; each only creates diff noise.

Material Changes

None
