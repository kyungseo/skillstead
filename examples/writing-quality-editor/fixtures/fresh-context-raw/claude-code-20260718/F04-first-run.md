# F04 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

## Adapted Text

> Before the release, run `git diff --check` to confirm there are no formatting errors in the documentation. Only if the check passes, create the `v2.4.0` tag on the current commit of `main`. If the check fails, do not create the tag; fix the errors, then run the check again from the beginning.

## Preservation Notes

- Protected identifiers kept exactly as-is and untranslated: `git diff --check`, `v2.4.0`, `main`. The technical terms tag and commit are also retained in their executable/searchable English form.
- The conditional structure is preserved with its original strength: tagging is gated exclusively on the check passing ("검사가 통과한 경우에만" → "Only if the check passes"), not weakened to a general recommendation.
- The failure branch keeps both obligations from the source: the prohibition (do not create the tag) and the recovery path (fix the errors, then re-verify from the start). Neither was merged or softened.
- The claim scope is unchanged: the check is described as confirming documentation formatting errors, exactly as the source states — I did not reinterpret or verify what `git diff --check` technically detects.
- Runbook register preserved: imperative maintainer instructions, no added explanations, warnings, or steps.

## Material Changes

- Sentence structure follows English imperative runbook convention (direct commands with an explicit gate) instead of the Korean declarative procedural ending "~한다"; no information order changed — the source already follows check → gate → failure/recovery, which matches the runbook profile.
- "처음부터 다시 확인한다" is rendered as "run the check again from the beginning," reading "처음부터" as restarting the verification. Since the procedure's only verification step is this check, the practical instruction is the same under either reading, so this was not flagged for human review.
