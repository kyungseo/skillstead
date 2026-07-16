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
| `Guided` | Shows one proposed change and its impact, checks the current state again, asks for direct approval, performs only that change, and verifies the result. |

Use the first-public profile once when an existing private github.com repository becomes public. Afterward, use
the version-release profile for every new version published from that public repository. Repository creation,
Git initialization, package registries, signing, cloud deployment, security audits, force-push, and history
rewrite are outside v1.

The examples use fictitious `northwind-labs/fieldnotes-fixture` data. No repository or product claim is real.

## Diagram gallery

| Mode and profile map | Approval safety loop |
| --- | --- |
| [![Choose Assess or Guided, then first-public or version-release](./mode-profile-map/mode-profile-map.en.png)](./mode-profile-map/mode-profile-map.en.svg) | [![How one repository change is previewed, rechecked, approved, carried out, and verified](./approval-safety-loop/approval-safety-loop.en.png)](./approval-safety-loop/approval-safety-loop.en.svg) |

The two workflow diagrams above ship as editable SVG plus dimension-verified 2× PNG, with matching
English/Korean geometry.

### Korean release announcement

[![Korean LinkedIn announcement showing how github-release-guide uses assessment, approval, and result checks for first-public and version releases](./release-announcement/release-announcement.ko.png)](./release-announcement/release-announcement.ko.svg)

This portrait asset is specifically for a Korean LinkedIn post and intentionally has no English pair. Exclude
this folder from EN/KO mirror-parity requirements, but include it in release provenance, credential, host-path,
and secret scans.
