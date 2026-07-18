# F13 — Post-Fix First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

Skill loaded (`SKILL.md` plus `references/review-rubric.md` and `references/en-ko-adaptation.md`). Adapt mode, KO→EN, manual/runbook profile.

## Adapted Text

**Provisional — step ownership is unassigned in the source. Do not finalize this runbook section until the actor decisions under Needs Human are resolved.**

> 1. After the review is complete, share the approval request. *(actor unassigned)*
> 2. Only if approval is granted, apply `release-plan.md` to the production repository and deploy. *(actor unassigned)*
> 3. If a problem occurs after deployment, roll back to the previous version and record the outcome. *(actor unassigned)*

## Preservation Notes

- `release-plan.md` is kept exactly as the protected identifier; it is never translated or reworded.
- The exclusivity of the approval gate is preserved: "승인을 받은 경우에만 … 반영하고 배포한다" gates **both** applying the file and deploying, so the English keeps a single "Only if approval is granted" condition covering both actions.
- Step order (review → approval request → conditional apply + deploy → rollback → record) is unchanged, and the rollback and record-keeping steps survive intact — nothing was shortened away.
- No parties, tools, channels, or record destinations were invented. The source does not say whom the request is shared with or where the outcome is recorded, so the English stays equally general.
- Assumption (stated, not silent): "운영 저장소" is rendered as "the production repository" (medium-high confidence; see Needs Human 2).

## Needs Human

1. **Actor assignment (blocking).** The spans "승인 요청서를 공유한다", "반영하고 배포한다", and "되돌리고 결과를 기록한다" name no actor, and these steps cross approval, deployment, rollback, and audit-trail boundaries that may belong to different roles. The imperatives above are placeholders, not a resolution. Options:
   - (a) Single-maintainer imperative ("you") — reads most naturally as runbook English, but silently assigns approval requesting, deployment, rollback, and record-keeping to one person, which the source does not establish.
   - (b) Explicit roles (e.g., "the release owner shares…", "the on-call maintainer rolls back…") — best for the audit trail, but requires role information the source does not contain.
   - (c) Keep the unassigned markers until the owning team supplies the roles — faithful, but the runbook is not executable as-is.
2. **"운영 저장소"** — "production repository" vs. "operations repository". If these are distinct repos in your environment, this changes the target of step 2; confirm which repository is meant.
3. **Rollback scope.** "이전 버전으로 되돌리고" does not specify whether the deployment, the `release-plan.md` change in the repository, or both are reverted. The English preserves the same generality ("roll back to the previous version"); confirm the intended scope before this becomes an operational instruction.

## Material Changes

- Reformatted three prose sentences into three numbered steps, matching runbook conventions for the maintainer audience; information order is unchanged.
- Added the visible "Provisional" label and per-step "(actor unassigned)" markers so the ownership gap is surfaced rather than hidden inside fluent imperatives. These are editorial markers to remove once actors are decided, not content additions.
- "만" is rendered as "Only if" to keep the approval condition exclusive rather than weakening it to a plain "if".
