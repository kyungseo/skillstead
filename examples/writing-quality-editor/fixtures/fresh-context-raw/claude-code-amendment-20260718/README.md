# Claude Code Post-R2 Amendment Leg — Raw Evidence Manifest (2026-07-18)

Post-R2 owner amendment(4-mode Compose + intent inference) fresh-context behavior 검증의 Claude Code 실행 원문.

- Runtime: Claude Code (Agent tool fresh subagent, fixture당 1개 독립 context)
- Observed model: `claude-fable-5`; reasoning effort unobserved (session-inherited)
- Isolation: 설치 skill 폴더 read-only + complete scenario metadata inline; examples/answer key 접근 금지;
  answer key는 8건 첫 실행 전체 종료 후 coordinator가 개봉
- F19·F20: live web research 허용 + fixture별 validation budget(검색 2회·substantive open 6·인용 5) inline 전달
- Environment/delivery retry: 전 fixture 0. Material corrective rerun: 전 fixture 0
- F19의 외부 사이트 접근 실패(McKinsey timeout, korea.net redirect, 403 2건)는 evaluator 절차 오류가 아니라
  research 대상 environment 실패이며, output 내 stop-condition(미열람 수치 본문 배제 + Needs Human)으로 처리됨

| File | Fixture |
| --- | --- |
| `F01-first-run.md` | Intent inference — unnamed ambiguous review → `Assess` |
| `F02-first-run.md` | Intent inference — named skill without mode → `Revise` |
| `F12-first-run.md` | Intent inference — unnamed natural revision → `Revise` + no-edit gate |
| `F16-first-run.md` | Compose — verified facts README |
| `F17-first-run.md` | Compose — direct Korean onboarding |
| `F18-first-run.md` | Compose — insufficient release brief → provisional + Needs Human |
| `F19-first-run.md` | Research-backed Compose — AX trend brief (budget-bounded) |
| `F20-first-run-header.md` + `F20-first-run-body.md` | Research-backed Compose — Spring Modulith vs microservices (budget-bounded) |
