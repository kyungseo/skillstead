# github-release-guide examples

**English** · [한국어](./README.ko.md)

This directory contains synthetic examples and diagrams used to validate the behavior described in the
[`github-release-guide` README](../../skills/github-release-guide/README.md). It uses no real repository or
customer data, and users do not need to copy this example folder when installing the skill.

The files serve these purposes:

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — synthetic target states and requests
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — the expected readiness decision, reasons
  to stop, approvals, changes, and recovery behavior
- [`fixtures/runtime-assess-state.md`](./fixtures/runtime-assess-state.md) and
  [`fixtures/runtime-missing-reference-state.md`](./fixtures/runtime-missing-reference-state.md) — inputs used
  to check whether a clean agent reaches the same material result without seeing the answer key
- [`fixtures/runtime-safety-critical-state.md`](./fixtures/runtime-safety-critical-state.md) — five independent
  safety cases covering changed state after approval, separate public-visibility approval, push scope, tag
  conflict, and force-push refusal
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — what was run in an agent and what was
  reviewed against the written contract, so support claims do not exceed the evidence
- [`example-assessment.md`](./example-assessment.md) — a complete Assess-mode output
- [`example-guided-preview.md`](./example-guided-preview.md) — what the user sees before approving a repository
  visibility change
- [`release-announcement/`](./release-announcement/) — Korean-only portrait SVG and 2× PNG for a LinkedIn release
  announcement; it intentionally has no English counterpart

## What the skill does

| Mode | Result |
| --- | --- |
| `Assess` | Reads available information without changing the repository. It reports readiness, explains known and unknown information, and gives one safest next step. |
| `Guided` | Shows one proposed change and its impact, checks the current state again, then asks for approval in two distinct scopes — running a repository command, and changing the repository — before performing only that change and verifying the result. |

Use the first-public profile once when an existing private github.com repository becomes public. Afterward, use
the version-release profile for every new version published from that public repository. Repository creation,
Git initialization, package registries, signing, cloud deployment, security audits, force-push, and history
rewrite are outside v1.

The examples use fictitious `northwind-labs/fieldnotes-fixture` data. No repository or product claim is real.

## Diagram gallery

**Mode and profile map** — which mode to pick, and on which profile. `Guided` starts only when all three
entry conditions hold: Assess is complete, release-critical blockers are resolved, and the user explicitly
chooses to switch.

[![Assess checks the repository without changing it and returns Ready, Needs attention or Blocked; Guided starts only when all three entry conditions are met; either mode works on the first-public or version-release profile](./mode-profile-map/mode-profile-map.en.png)](./mode-profile-map/mode-profile-map.en.svg)

**Approval safety loop** — how Guided carries out one change. Execution approval is asked only where a
repository command must run; mutation approval is asked before any change on either path. Neither implies the
other, and a state change at the recheck voids both.

[![In Guided each change is previewed and rechecked, then takes execution approval only when a command must run, always takes mutation approval, applies only what was previewed, and verifies the observed result before continuing or stopping](./approval-safety-loop/approval-safety-loop.en.png)](./approval-safety-loop/approval-safety-loop.en.svg)

Both ship as editable SVG plus dimension-verified 2× PNG. KO and EN share one geometry; only the words differ.

### Korean release announcement

[![Korean LinkedIn announcement: a public repository cannot be fully recalled, so Assess inspects without changing anything, Guided asks separately for command execution and repository change, visibility gets its own approval, and only approved changes are applied and then verified](./release-announcement/release-announcement.ko.png)](./release-announcement/release-announcement.ko.svg)

This portrait asset is specifically for a Korean LinkedIn post and intentionally has no English pair. Exclude
this folder from EN/KO mirror-parity requirements, but include it in release provenance, credential, host-path,
and secret scans.

`release-announcement.v0.9.0.ko.svg` and its PNG are a frozen historical copy of the v0.9.0 post. They are kept
for provenance, are not linked from any document, and are not updated when the contract changes — read the
current asset above instead.

Regenerate the PNG after editing the SVG (run from the repository root):

```bash
bash skills/svg-infographic/scripts/render.sh \
  examples/github-release-guide/release-announcement/release-announcement.ko.svg \
  examples/github-release-guide/release-announcement/release-announcement.ko.png --scale 2
```
