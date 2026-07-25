---
name: acrelay
description: >
  Start, continue, inspect, or close a tracked code or artifact review through
  an installed acRelay v0.1.0-alpha.2 command, using Claude Code or Codex as the
  reviewer. Keep the review record private, leave approvals and Close with the
  owner, and stop when the command is missing or incompatible.
---

# acRelay

Use the local acRelay command as the single authority for review state,
evidence, reviewer runs, recovery, and closure. This Skill translates a user’s
request into acRelay operations; do not recreate the acRelay state machine in
prose or host memory.

## Terms To Explain In Plain Language

When these terms first matter to the user, explain them instead of presenting
them as unexplained protocol vocabulary:

- **objective:** one tracked review from `init` until the owner closes or
  terminates it
- **canonical record:** the private Markdown file that contains the official
  review history
- **session reference (`ref`):** the identifier acRelay uses to resume or clean
  up one specific reviewer session
- **vendor egress:** review files, resolved paths, and metadata sent to the
  selected Claude Code or Codex reviewer
- **disposition:** the driver’s response to a finding—accept, revise, defend,
  or ask the owner—plus the reason
- **briefing:** a read-only summary of whether the review appears ready to close
- **fail closed:** stop without silently changing the review or bypassing
  acRelay

## Compatibility Gate

This package is compatible only with:

```text
acRelay v0.1.0-alpha.2
```

Before any `init`, `review`, `confirm`, mutation, or Close:

1. Resolve `acrelay` from `PATH`.
2. Run `acrelay version --short`.
3. Continue only when the exact output is `v0.1.0-alpha.2`.

If the command is missing, show the user the public installation guide:

```text
https://github.com/kyungseo/acrelay/blob/v0.1.0-alpha.2/docs/OPERATIONS.md
```

Do not install or update the binary automatically. If the version is different
or unobservable, stop with the installed and required versions. Never fall
back to raw reviewer invocation or a different workflow.

## Establish The Review

Before `init`, obtain or confirm:

- the exact review subject: one file, explicit files, or a declared subtree,
- the review question,
- the private canonical path,
- the declared owner/approval actor,
- whether vendor egress is acknowledged,
- reviewer vendor: `claude` or `codex`,
- driver vendor and whether driver/reviewer context is separate or shared,
- whether the formal-round bound should remain at the default 3 or use another
  value from 1 through 5.

The canonical path must be private and outside shared, synced, or repository
paths. Do not infer that a location is safe from the absence of a warning. Do
not use `-allow-unsafe-location` unless the owner explicitly approves the exact
detected location and supplies a reason.

Explain that vendor egress may include subject content, absolute and resolved
paths, and metadata. Local canonical storage does not mean local model
inference.

If the user asks for a host-native subagent, explain that v0.1.0-alpha.2 cannot
ingest a host-created subagent result. Offer a separate external Claude Code or
Codex CLI reviewer only when its platform tuple is supported and the user
accepts that topology. Never describe the external CLI session as a subagent.

## Start

Prefer the shortest single-file form when it matches the user’s subject:

```sh
acrelay init \
  -canonical <private-canonical-path> \
  -question <review-question> \
  -target <subject-file> \
  -approval-actor <owner> \
  -ack-vendor-egress \
  -execution-surface external-cli \
  -driver-vendor <claude|codex|other> \
  -context-relation <separate|shared>
```

For explicit files or a subtree, prepare a `subject-spec v0.1` JSON file and
use `-target-spec`. Do not select the canonical, its lock, dispatch journals,
or quarantine files as review members.

Then dispatch one round:

```sh
acrelay review \
  -canonical <private-canonical-path> \
  -reviewer <claude|codex> \
  -prompt-file <review-prompt-path>
```

Use `-round-bound` only when the user selected a non-default objective bound.
The first successful preflight binds it immutably. Do not change it later.

## Handle Results

After a valid round:

1. Summarize the verdict and open findings without treating reviewer output as
   owner authority.
2. For every finding, ask the driver to choose `accept`, `revise`, `defend`, or
   `needs-user` and record a non-empty rationale through `acrelay disposition`.
3. Use the typed approval-request commands when a decision belongs to the
   owner. Preserve the exact owner response; ambiguity remains unresolved.
4. After the target changes, use `acrelay advance` with a factual delta note.
5. Continue the same reviewer session unless an explicit, reasoned
   `-session-reset` mode is required.

Never describe `content-match`, `reviewer-declared`, or topology labels as
proof of understanding, completeness, correctness, or independence.

## Failure And Reconciliation

- A preflight failure does not consume a round. Correct the stated cause and
  retry only after the user agrees.
- A pending journal blocks mutation. Use `acrelay reconcile`.
- `UNKNOWN` means execution was ambiguous and must never be retried
  automatically.
- Use `abandon-transaction` only when normal reconciliation is impossible and
  the owner or arbiter declares the exact transaction and reason.
- Do not delete canonical, journal, quarantine, handle, cwd, or vendor state as
  an improvised recovery step.

## Briefing And Close

Use:

```sh
acrelay briefing -canonical <private-canonical-path>
```

`briefing` is read-only. It is not approval and does not authorize Close.

Only the explicit Close command changes the objective to closed:

```sh
acrelay close \
  -canonical <private-canonical-path> \
  -actor <owner> \
  -role owner
```

Do not run Close unless the user acting as owner explicitly asks to close the
exact objective after reviewing current readiness.

## Cleanup Boundary

Binary uninstall and private-state cleanup are separate. Never remove
`~/.acrelay` automatically. Session cleanup must use the exact
canonical/ref-scoped `acrelay cleanup` flow and requires an eligible terminal
objective plus the owner’s continuity-abandon declaration. Raw canonicals and
vendor-owned state remain outside automatic cleanup.

## User-Facing Completion

Report:

- canonical path without exposing it to public output,
- reviewer vendor and declared topology boundary,
- current objective/governance/readiness state,
- open findings or approval requests,
- whether dispatch was completed, failed, or `UNKNOWN`,
- exactly what the owner must decide or run next.

Do not call a review complete merely because the reviewer approved it. Close is
a separate owner action.
