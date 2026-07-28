# Runtime Validation Evidence

This file records sanitized, evidence-bounded observations for the invocation contract. It does not guarantee
automatic activation across every runtime, model, prompt, or repository.

## Validation Matrix

| Runtime | Package set | Isolation | First-run coverage | Result |
| --- | --- | --- | --- | --- |
| Claude Code 2.1.220, Fable 5 | Four Skillstead packages | Fresh project-local context per prompt | Named skill, natural request, ambiguous/mixed request, `WQE` shorthand | Pass within the recorded scenarios; one Compose run stopped at a missing Read permission and passed when rerun with that permission |
| Codex CLI 0.144.1, `gpt-5.6-sol` | `svg-infographic`, `github-release-guide`, `writing-quality-editor` | Ephemeral project-local context per prompt | Named skill, natural request, ambiguous/mixed request, `WQE` shorthand | Pass within the recorded scenarios |
| Codex + `docs-claim-check` | Exploratory only | Not part of the support gate | No public support claim | Not used to expand runtime support |

## Acceptance Boundary

- Success means the selected workflow and its read-only, mutation, approval, and artifact-ownership boundaries
  match [`expected-outcomes.md`](./expected-outcomes.md).
- A corrective rerun is recorded separately from first-run behavior.
- The corrected Claude Code missing-target run requested the target text without listing, searching, reading a
  repository file, or running a command. The target-present partial-evidence run assessed the supplied text and
  requested only the missing CI evidence.
- `WQE` is a convenience alias, not a guaranteed explicit selector.
- Raw transcripts, machine-local paths, private repository identity, and account metadata are not published here.
