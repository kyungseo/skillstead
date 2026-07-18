# F13 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

**Adapted Text**

> After completing the review, share the approval request. Only after approval is granted should you apply `release-plan.md` to the production repository and deploy. If a problem occurs after deployment, roll back to the previous version and record the outcome.

**Preservation Notes**

- Step order and gating preserved: review → share approval request → (approval-gated) apply and deploy → rollback and record on failure.
- The exclusive condition in "승인을 받은 경우에만" is kept at full strength with the "Only after … should you" construction — approval gates *both* applying `release-plan.md` and deploying, not just one of them.
- `release-plan.md` kept verbatim as a protected identifier, untranslated and unreformatted.
- The rollback step ("이전 버전으로 되돌리고") and the recording obligation ("결과를 기록한다") both survive; "record the outcome" carries the same requirement without adding a destination or format the source does not specify.
- The source leaves the actor implicit; English imperative mood addresses the release maintainer directly, which is standard runbook convention and does not invent a new owner.
- Obligation strength unchanged: all three sentences remain directive procedure statements, matching the Korean plain "-한다" register.

**Needs Human**

- "운영 저장소" is rendered as "production repository," the most common reading in a release context. If your environment distinguishes an *operations* repository (e.g., an ops/config repo) from the production code repository, the term should be corrected to name the actual target — a wrong repository reference in a deploy runbook is a wrong-action risk. Options: "production repository" (chosen), "operations repository," or the repository's proper name if one exists.

**Material Changes**

- Mood shifted from Korean declarative procedure style to English imperative, per manual/runbook convention for English-speaking maintainers.
- The approval condition moved to a fronted "Only after …" clause with inversion so the exclusivity reads naturally in English instead of a literal "in the case of having received approval only."
- No claims, conditions, steps, or identifiers were added, removed, or reweighted.
