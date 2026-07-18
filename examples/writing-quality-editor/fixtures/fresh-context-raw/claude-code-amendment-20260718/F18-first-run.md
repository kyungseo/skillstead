# F18 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F18 — Compose From An Insufficient Release Brief
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + supplied facts inline
- Environment/delivery retry: 0
- Material corrective rerun: 0

## First-Run Raw Output

Compose mode, Release note profile. I loaded the review rubric before drafting. The brief supports only one claim — that synchronization behavior changed in 3.0 — so the result below is a provisional draft, not a publishable note.

## Drafted Text

> **PROVISIONAL — NOT FOR PUBLICATION.** Placeholders below mark facts the brief does not supply.
>
> # Acme Tasks 3.0
>
> ## Synchronization
>
> This release changes how Acme Tasks synchronizes your data. `[PLACEHOLDER: what you will notice — the user-visible outcome of the sync change has not been confirmed]`
>
> **Do I need to do anything?** `[PLACEHOLDER: whether any migration or user action is required has not been confirmed]`
>
> **Availability:** `[PLACEHOLDER: platform status — Windows and Linux status is unknown, and macOS verification has no recorded result]`

The one sentence that is fully supported ("This release changes how Acme Tasks synchronizes your data") is deliberately neutral: the brief does not say the change is an improvement, a fix, or faster, so the draft does not claim it.

## Source Notes

- Version identifier: Acme Tasks 3.0 — used verbatim.
- Fact used: synchronization behavior changed. No direction, benefit, or scope was supplied, so none is claimed.
- `SYNC-220` — internal ticket, **excluded from the draft** per release-note convention (internal IDs are omitted unless the release audience needs them). It is preserved here so the team can trace the change.
- QA on macOS 15 — **excluded from the draft.** A test run with no pass/fail result cannot support a "tested on macOS 15" claim, because readers would read that as a pass.

## Needs Human

These block publication; each maps to a placeholder above:

1. **User-visible outcome** — what users will actually see or experience differently. A release note without this has no headline claim.
2. **Required action / migration** — whether users must do anything. Publishing without an answer risks either silent breakage (if migration is needed) or unnecessary alarm (if the section is hedged).
3. **Platform status** — Windows/Linux behavior is unknown; saying nothing implies parity across platforms, which the evidence does not support.
4. **QA result** — the macOS 15 run needs a pass/fail before any verification or compatibility statement can appear.
5. **Decision** — confirm that `SYNC-220` should stay internal-only, or supply a public-facing changelog reference if one exists.

## Assumptions And Omissions

- Assumed the note targets existing users of the current stable release; no upgrade-path wording was added because none was supplied.
- Omitted any benefit framing ("faster," "more reliable"), compatibility claims, and migration instructions — none are supported by the brief.

**Bottom line:** the draft is structurally ready, but items 1–4 above must be answered before this can be published. The fastest path is a one-line answer each for user-visible behavior, migration need, platform status, and the QA verdict.
