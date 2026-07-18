# Post-Fix First Runs — F09, F14 (Claude Code runtime, claude-fable-5 subagents, 2026-07-18)

## F09

## Adapted Text (provisional)

```text
Title: 워크스페이스 비우기
Body: 로컬 항목이 제거되며, 공유된 사본에도 영향이 있을 수 있습니다.
Primary button: 비우기
Secondary button: 취소
```

This copy is returned as **provisional, not final**. For a destructive confirmation dialog, faithfully reproducing the vague "may affect" is not sufficient to ship — see Needs Human.

## Preservation Notes

- **Claim scope**: the certain claim (local items are removed) and the uncertain claim (shared copies may be affected) are kept at exactly the source strength. The "may" uncertainty survives as "~있을 수 있습니다"; the effect on shared copies is left as unspecified as the source leaves it — neither narrowed to "deleted" nor softened to "unchanged".
- **Destructive-action strength**: the title verb and the primary button use the same verb (비우기), so the confirm button unambiguously names the destructive action, matching ko-KR platform convention. "취소" is the standard secondary label.
- **Terminology**: "workspace" is rendered as 워크스페이스, the common transliterated product term in Korean app UI (Slack, Notion convention). If your product has a glossary term (e.g., 작업 공간), substitute it — this is an assumption, stated at medium confidence.
- **Voice**: English agentive "This removes…" becomes a Korean subject-omitted construction, which is the natural dialog-body form. The actor (the app, acting on the user's confirmation) remains clear from the dialog context, so no ownership ambiguity is introduced.

## Needs Human

**Source span**: "may affect shared copies"

The source does not establish what actually happens to shared copies, and no evidence was provided. In destructive/consent copy, this is a material unresolved consequence: the body text cannot be finalized until product behavior is known, because each possibility requires a different warning strength.

| Actual behavior | Korean body (second clause) | Effect |
| --- | --- | --- |
| Shared copies are also deleted | 공유된 사본도 함께 삭제됩니다. | Strongest warning — required if true, or users will destroy shared data unknowingly |
| Shared copies are disconnected but retained | 공유된 사본은 연결이 해제되지만 삭제되지는 않습니다. | Accurate middle ground — tells users their shared data survives |
| Shared copies are unchanged | 공유된 사본은 영향을 받지 않습니다. (or drop the clause) | Removes a false scare that would deter a safe action |

Tradeoff: choosing wrong in either direction is harmful — overstating deletes user trust in warnings; understating risks unrecoverable shared-data loss. Please confirm the product behavior, then finalize the body with the matching row.

## Material Changes

- Sentence structure reordered into natural Korean connective form (제거되며 / ~수 있습니다) instead of mirroring the English clause order.
- "workspace" → 워크스페이스 (transliteration; pending glossary confirmation).
- Primary button expanded from bare "Clear" to 비우기 to match the title verb — same action, ko-KR convention for destructive confirms.
- No change to claim strength, uncertainty, or consequence scope; the unresolved shared-copy consequence is flagged above rather than silently resolved.

## F14

**Adapted Text**

> Backing up `config.yml` before making changes is mandatory. A full test run is recommended. The `review.log` generated during review can be attached if needed. If a required check fails, do not deploy.

**Preservation Notes**

- Modality distinctions kept exactly as in the source, per the runbook profile: backup is **mandatory** (`필수`), the full test run is **recommended** (`권장`), attaching `review.log` is **optional** (`할 수 있다`), and deploying after a failed required check is **prohibited** (`해서는 안 된다`). None were flattened into a uniform "should."
- Protected identifiers `config.yml` and `review.log` preserved verbatim, untranslated.
- Source ordering retained (backup → tests → log → deploy gate), which already matches natural runbook flow.
- No actor invented: the source is actorless, and for a release-maintainer runbook the single acting audience is clear, so declarative/imperative phrasing does not hide an ownership or approval handoff.
- "필수 검사" rendered as "a required check," which for release maintainers also reads naturally against CI required checks without narrowing or broadening the source term.

**Material Changes**

- Converted Korean declarative endings into concise English runbook statements ("do not deploy") rather than literal renderings ("one must not deploy"), preserving strength while sounding native.
- "전체 테스트 실행" rendered as "a full test run" rather than "execution of all tests," replacing the Korean nominalization with natural English.
- "필요하면 첨부할 수 있다" kept as an option ("can be attached if needed") without specifying an attachment destination, matching the source's deliberate openness.
