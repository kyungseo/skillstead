# Synthetic Scenarios

Run one scenario at a time. Do not provide `expected-outcomes.md` to the agent under evaluation.

## F01 — README Front Door

- User request: `이 README 좀 봐 줘.`
- Profile: README
- Audience: a non-developer evaluating Acme Relay for the first time

```markdown
# Acme Relay

Acme Relay uses a three-surface orchestration model with policy-driven adapter convergence.

## Repository Structure

- `core/`: canonical engine
- `adapters/`: tool bindings
- `state/`: durable workflow state

## Getting Started

Run `acme-relay start` and inspect the generated workspace.
```

## F02 — Explained Technical Concept

- User request: `writing-quality-editor를 사용해 이 문서를 자연스럽고 명확하게 고쳐 줘.`
- Profile: Manual
- Audience: an application developer who knows Git but not Acme Relay internals
- Constraint: preserve `atomic parity`, `pull request`, and the same-change requirement

```text
Atomic parity surface maintenance should be executed as a dual-artifact convergence activity. English and Korean
documents should reflect semantic deltas through a co-located pull request surface.
```

## F03 — English To Korean Release Note

- Mode: `Adapt` (English→Korean)
- Profile: Release note
- Audience: Korean users of Acme Notes
- Tone: direct and professional

```text
Acme Notes 2.4 adds offline draft recovery. If the app closes before a draft is synced, reopen the same note and
choose Restore draft. Recovery was verified on macOS 15. Windows and Linux remain unverified.
```

## F04 — Korean To English Release Procedure

- Mode: `Adapt` (Korean→English)
- Profile: Manual/runbook
- Audience: English-speaking maintainer
- Protected identifiers: `v2.4.0`, `git diff --check`, `main`

```text
릴리스 전에 `git diff --check`를 실행해 문서 형식 오류가 없는지 확인한다. 검사가 통과한 경우에만
`main`의 현재 commit에 `v2.4.0` tag를 만든다. 검사가 실패하면 tag를 만들지 말고 오류를 수정한 뒤
처음부터 다시 확인한다.
```

## F05 — Onboarding Audience Boundary

- Mode: `Assess`
- Profile: Onboarding
- Audience: a first-time user

```text
Clone Acme Board and review ADR-014, the adapter registry, release branch policy, and the maintainer migration
manifest. Then run `acme-board init`. If initialization succeeds, create your first board.
```

## F06 — Protected Error Identifier

- Mode: `Adapt` (English→Korean)
- Profile: Error message
- Audience: Korean end user
- Protected identifier: `SYNC-1042`

```text
SYNC-1042: Draft synchronization could not complete because the server did not respond. Try again. If the problem
continues, export the draft before closing the app.
```

## F07 — Scaffold Dump Rejection

- Mode: `Assess`
- Profile: README
- Audience: a prospective user

```markdown
# [Project name — fill this in]

This repository includes a two-track agent workflow harness.

| Track | Files |
| --- | --- |
| Product | `docs/backlog/PRODUCT.md`, `docs/works/product/` |
| Harness | `docs/backlog/HARNESS.md`, `docs/works/harness/` |

Use `/session-start`, then `/work-select`, then `/work-plan`.
```

## F08 — Honest Support Claim

- Mode: `Revise`
- Profile: Release note
- Evidence supplied by the user: macOS 15 manual smoke passed; Windows/Linux were not tested

```text
Acme Export 1.2 now works everywhere. The export flow is fully reliable across macOS, Windows, and Linux, giving
every team a seamless release experience.
```

## F09 — Ambiguous App UI

- Mode: `Adapt` (English→Korean)
- Profile: App UI
- Context: a destructive confirmation dialog

```text
Title: Clear workspace
Body: This removes local items and may affect shared copies.
Primary button: Clear
Secondary button: Cancel
```

No evidence is provided for whether shared copies are deleted, merely disconnected, or left unchanged.

## F10 — Actionable Recovery

- Mode: `Revise`
- Profile: Onboarding/manual
- Protected command: `acme init --resume`

```text
Initialization may sometimes not finish. There are several possible reasons, and in this situation it is generally
recommended that the user consider resuming the process. The resume capability can be invoked through
`acme init --resume`. Review the state afterward.
```

## F11 — Gallery Caption With AI-Style Patterns

- Mode: `Revise`
- Profile: Gallery copy
- Audience: developers browsing examples

```text
Unlock the power of clarity with this comprehensive and robust architecture visualization. Not only does it show
services, but it also shows queues, and it also shows data stores. In today's fast-paced landscape, this diagram
serves as a testament to seamless, scalable, and innovative system design.
```

The image actually demonstrates one request path through three services, one queue, and one data store. It does
not provide scalability evidence.

## F12 — Preserve Already-Natural Text

- User request: `이 문서를 자연스럽게 고쳐 줘.`
- Profile: README
- Audience: developers

```text
Acme Diff compares two configuration files and highlights values that changed. Run `acme-diff before.yml after.yml`
to print a local report; the command does not upload either file.
```

## F13 — Korean To English With An Implicit Actor

- Mode: `Adapt` (Korean→English)
- Profile: Manual/runbook
- Audience: English-speaking release maintainers
- Protected identifier: `release-plan.md`
- Context: the source does not identify who requests approval, deploys, rolls back, or records the result

```text
검토를 마친 뒤 승인 요청서를 공유한다. 승인을 받은 경우에만 `release-plan.md`를 운영 저장소에 반영하고
배포한다. 배포 후 문제가 발생하면 이전 버전으로 되돌리고 결과를 기록한다.
```

## F14 — Korean To English Obligation Strength

- Mode: `Adapt` (Korean→English)
- Profile: Manual/runbook
- Audience: English-speaking release maintainers
- Protected identifiers: `config.yml`, `review.log`

```text
변경 전에 `config.yml`을 백업하는 것은 필수다. 전체 테스트 실행을 권장한다. 검토 과정에서 생성한
`review.log`는 필요하면 첨부할 수 있다. 필수 검사가 실패하면 배포해서는 안 된다.
```

## F15 — User-Supplied README Enrichment

- Mode: `Revise`
- Profile: README
- Audience: developers evaluating a synchronization CLI
- Protected identifier: `acme sync --resume`
- User-supplied facts to integrate: resume supports files up to 5 GB; progress is stored locally; if authentication
  has expired, the command stops and asks the user to sign in again

```text
Acme Sync can resume an interrupted upload. Run `acme sync --resume` to continue.
```

## F16 — Compose A New README From Verified Facts

- Mode: `Compose`
- Profile: README
- Audience: developers evaluating a local queue-inspection CLI
- Purpose: explain the product and provide the shortest verified success path
- Tone: direct and professional
- Supplied facts and constraints:
  - Product name: Acme Queue Lens
  - It inspects a local queue snapshot and creates a local HTML report.
  - Command: `acme-queue inspect snapshot.json`
  - Output path: `report.html`
  - The command does not upload the snapshot or report.
  - Verified platform: macOS 15. Windows and Linux are unverified.

Create a new README front door directly from this brief. Do not draft generic scaffolding for a later editing pass.

## F17 — Compose Korean Onboarding Directly From A Brief

- Mode: `Compose`
- Profile: Onboarding/manual
- Audience: Korean developers using Acme Vault for the first time
- Output language: Korean (`ko-KR`)
- Tone: concise and reassuring without weakening limitations
- Supplied facts and constraints:
  - Install with `brew install acme-vault`.
  - Initialize `~/Documents` with `acme-vault init ~/Documents`.
  - Initialization creates `.acme-vault/config.yml`.
  - No data is uploaded until the user runs `acme-vault push`.
  - Verified platform: macOS 15. Windows and Linux are unverified.

Write the onboarding section directly in Korean. Do not compose an English version first.

## F18 — Compose From An Insufficient Release Brief

- Mode: `Compose`
- Profile: Release note
- Audience: existing Acme Tasks users
- Desired output: publishable English release note if the evidence supports one
- Supplied facts and evidence:
  - Version: Acme Tasks 3.0
  - Synchronization behavior changed.
  - Internal ticket: `SYNC-220`
  - QA ran on macOS 15, but no pass/fail result was supplied.
  - The user-visible behavior, migration need, and Windows/Linux status are unknown.

Create the safest useful draft supported by this brief and identify what prevents publication.

## F19 — Research-Backed Current Enterprise AX Trend Brief

- Mode: `Compose` (research-backed)
- Profile: Brief
- Audience: Korean technology leaders planning enterprise AI transformation
- Output language: Korean (`ko-KR`)
- Research question: What enterprise adoption trends are currently visible for AI transformation (AX)?
- Requirement: use publicly available evidence; state the evidence cutoff date; cite material claims; distinguish
  measured adoption, announced intent, vendor framing, and bounded synthesis
- Validation research budget (not a product limit): at most two search rounds, six substantive pages opened, and
  five sources cited. Stop as soon as the required distinctions have adequate support; do not attempt an exhaustive
  market survey or follow citation chains beyond one gap-filling step.
- Count a page as opened only when enough substantive content loads to inspect a material claim. Log timeout,
  access-denied, and redirect-only attempts separately; they do not consume the six-page cap or authorize another
  search round beyond the single gap fill.

Research before writing. Do not rely on model memory or treat one survey as the entire market.

## F20 — Research-Backed Spring Modulith And Microservices Comparison

- Mode: `Compose` (research-backed)
- Profile: Technical comparison
- Audience: Spring architects choosing an architecture direction for a new business system
- Output language: Korean (`ko-KR`)
- Research question: Compare a Spring Modulith-supported modular monolith with a microservices architecture.
- Requirement: use official or primary technical sources; distinguish Spring Modulith the toolkit from modular
  monolith the architecture style; compare deployment, data and transaction boundaries, team autonomy, failure and
  operational cost, evolution path, and selection criteria; cite material claims
- Validation research budget (not a product limit): at most two search rounds, six substantive pages opened, and
  five sources cited. Stop when the requested comparison axes are supported; do not build an exhaustive literature
  review or follow citation chains beyond one gap-filling step.
- Count a page as opened only when enough substantive content loads to inspect a material claim. Log timeout,
  access-denied, and redirect-only attempts separately; they do not consume the six-page cap or authorize another
  search round beyond the single gap fill.

Write a decision-oriented comparison, not a universal winner.

## F21 — Host-Owned Brief Workflow Precedence

- User request: `Toolstead의 다음 skill 전략을 비교하는 brief를 작성해 줘.`
- Host context:
  - The repository provides `workflow-work-brief` for classifying strategy/comparison/position documents.
  - That workflow owns the `docs/briefs/` destination, index update, follow-up routing, and repository approval rules.
  - `writing-quality-editor` is installed, but the user did not ask to bypass the host workflow or choose a file path.
- Supplied content evidence: none beyond the topic phrase `다음 skill 전략`

Determine the safe next action. Do not invent strategy evidence or independently create a governed repository file.
