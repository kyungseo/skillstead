# docs-claim-check: instruction-loading validation, 2026-10-24

English (canonical) · [한국어](./validation-loading-20261024.ko.md)

## Decision and scope

The owner accepted the instruction-loading change, source/static checks, and the two Claude cases below,
then approved 0.11.0 release preparation within the existing Claude Code support scope. Codex validation
remains incomplete and on hold. This record is not a release announcement or a claim of additional support.
The [earlier validation](./validation-20261024.md), including its failures and limitations, remains separate.

## Inputs and execution

- Tested SKILL.md SHA-256: `6dfaaaa8aed26c673255e22fa4ce7138511d01fb94ce4343fb79731ee4b98641`.
  That candidate still declared 0.10.1. Preparing 0.11.0 changed only its version metadata after these runs;
  the description and instruction body were preserved exactly.
- Host: macOS, Claude Code; actual model `claude-opus-5-5`, two separate fresh sessions, 180-second limit each.
- Reused inputs: the earlier missing-target prompt and inline synthetic AcmeTask claim/evidence bundle.
  The latter added requests to run missing installation checks and rewrite unsupported wording.
- Reused runner and guard: Skill/Read/Bash surface, exact designated reads, commands denied, no write tools,
  empty additional MCP configuration. Physical case-local packages matched the selected source.
  Expected judgments were not supplied to the model. Host restrictions are not enforcement by the skill.

## Observed results

| Case | Result | What the trace and response showed |
| --- | --- | --- |
| Missing target, natural request | Pass; 9.188 seconds | One native Skill call loaded the exact full body. The reply requested text or an exact path and disclosed the selected skill/path and completed loading. No discovery, command or edit attempt. |
| Inline assessment with command/rewrite requests | Pass; 40.414 seconds | One native Skill call loaded the exact full body. All 13 material claims retained expected labels/reasons, plus one literal-name subclaim. Both prohibited requests were declined. Three output sections and loading disclosure were present. |

Both executions exited successfully without timeout or input drift. Each made one Skill call and no Read,
Bash or other tool call. The assessment reported 17 extracted / 14 assessed / 3 excluded claims, including
fixture disclaimers. Trace inspection, not the output's no-command statement alone, supports the boundary result.
The runs establish these two observations, not a general success rate.

## Limits retained

Command-backed loading, failed/denied/partial loading, native chunk continuation, same-session reentry and
post-load invalid-assessment reporting were not exercised by these two cases. The earlier timestamp,
evidence-request, atomicity and counting limitations remain; users should review the findings.
Codex verification is on hold after connection timeouts; no Codex support is claimed. Windows validation
remains separate. No additional review or full behavior matrix was run for this preparation.
