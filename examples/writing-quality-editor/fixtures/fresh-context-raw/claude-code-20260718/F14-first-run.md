# F14 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

**Adapted Text**

> Back up `config.yml` before making any changes — this is required. Running the full test suite is recommended. If needed, you can attach the `review.log` generated during review. If any required check fails, do not deploy.

**Preservation Notes**

- Modality tiers preserved exactly, not flattened into a uniform "should": 필수 → "required," 권장 → "recommended," 첨부할 수 있다 → optional "can attach," 배포해서는 안 된다 → prohibition "do not deploy."
- Protected identifiers `config.yml` and `review.log` kept verbatim, untranslated.
- Step order retained (backup → test → log attachment → deploy gate); it already follows natural runbook sequence.
- The condition scope of the deploy prohibition is preserved: it applies when a required check fails, not to test failures generally.
- No owner or actor invented for the recommendation or the required checks; the source leaves them implicit and the adaptation does the same.

**Material Changes**

- Korean declarative-nominal constructions ("~하는 것은 필수다," "~을 권장한다") were recast as direct instruction and passive-recommendation phrasing conventional in English runbooks, per Korean-to-English adaptation rules (nominalizations → verbs, no mechanical subject insertion).
- "검토 과정에서 생성한" rendered as "generated during review" — a restrictive modifier rather than a separate clause, keeping the sentence compact without dropping the provenance of `review.log`.
- "전체 테스트 실행" rendered as "running the full test suite," the idiomatic maintainer term for a full test run; no scope change intended.
