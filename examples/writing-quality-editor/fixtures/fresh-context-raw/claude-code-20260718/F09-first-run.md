# F09 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

**Adapted Text (ko-KR)**

```text
Title: 워크스페이스 비우기
Body: 로컬 항목이 삭제되며, 공유된 사본에도 영향을 줄 수 있습니다.
Primary button: 비우기
Secondary button: 취소
```

**Preservation Notes**

- Destructive-action strength is unchanged: the body states deletion as certain ("삭제되며") and keeps the source's uncertainty about shared copies ("영향을 줄 수 있습니다" = "may affect"). I did not narrow "affect" to "삭제" (deletion), since the source does not say shared copies are deleted.
- The primary button reuses the title verb ("비우기"), matching ko-KR platform convention that the confirm button echoes the dialog's action — this preserves the Clear/Clear title–button pairing of the source.
- "워크스페이스" is kept as the established loanword; "로컬 항목" and "공유된 사본" preserve the local-vs-shared distinction exactly.
- "취소" is the standard ko-KR label for Cancel.

**Needs Human**

- If your product glossary already fixes terms for "Clear" (비우기 vs. 삭제 vs. 초기화) or "workspace" (워크스페이스 vs. 작업 공간) elsewhere in the app, those should win for consistency. I assumed no existing glossary; "비우기" was chosen because the action empties the workspace rather than deleting the workspace itself — if the action actually deletes the workspace entity, "삭제" would be the correct strength.

**Material Changes**

- The English active construction "This removes local items" became a subject-omitted Korean construction ("로컬 항목이 삭제되며"), which is the natural ko-KR dialog convention; the actor (this action) is unambiguous from the dialog context.
- "and may affect shared copies" is rendered with "에도 … 줄 수 있습니다," making the "additionally, possibly" relationship explicit in Korean particle form rather than copying the English clause order.
