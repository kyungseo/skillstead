# docs-claim-check

**English** · [한국어](./README.ko.md)

Check whether the claims in public-facing documentation — README files, release
notes, install and usage docs — are actually supported by the evidence you provide:
manifests, logs, tag lists, CI output, command output you ran yourself.

## Start here

Provide two things:

1. the exact document or claims you want assessed;
2. the evidence the assessment may use.

Ask for findings only. The skill does not search for missing material, run verification commands, or rewrite the
document.

The skill splits composite statements into atomic claims and walks each one through a
fixed decision tree, producing exactly one confidence label per claim:

| Label | Meaning |
| --- | --- |
| `verified` | the provided, current evidence directly supports the whole claim — valid only within the reviewed scope |
| `unsupported` | objectively checkable, but the evidence is missing (`missing-evidence`), conflicting (`contradicted`), or partial (`insufficient-coverage`) |
| `stale-suspected` | a date/version/support-window mismatch with newer applicable evidence; currency is not supported |
| `needs-human` | requires subjective/quality judgment, code review, or external-authority confirmation; a missing executable observation is `unsupported`, not `needs-human` |

Every claim-assessment output begins with its **input scope** — what documents
and evidence were reviewed, what was requested but missing, and the claim
coverage count. This keeps the intended scope of `verified` explicit and
auditable.

## Best for

- Fact-checking a README before a release or an announcement
- Auditing release notes against tags, manifests, and CI output
- Finding stale version/support claims after a fast development stretch
- Getting an honest "what would it take to verify this?" list (evidence requests)

## Not for

- Code review, bug hunting, or security audits — use a code-review tool
- Generating fixes or rewritten docs — this skill outputs findings only
- Verification requiring command execution — during assessment it asks you for captured output instead.
  In a mixed request it declines only the out-of-scope part and still assesses the eligible claims

## Instruction loading

Before assessment, the host may load only this skill's SKILL.md at its catalog path. A full body already
supplied is used without rereading. Native loading follows the host; command-backed loading permits one
safely quoted literal cat of that exact path. This exception never permits reading documents or evidence
with commands, editing files, or searching for missing paths. Failed or known-incomplete loading stops the
invocation without retry or escalation. The report discloses loading separately from assessment commands.

## Stable scope and validation

Version 0.11.0 is prepared with Stable maturity for the existing Claude Code support scope. On 2026-10-24,
the owner accepted the earlier bounded results and limitations, then the two Claude regression cases for the
instruction-loading change. Those two cases checked native loading, missing-target handling, claim assessment,
refusal of commands and rewriting, and loading disclosure. The four labels and findings-only role are unchanged.
See the [loading validation record](../../examples/docs-claim-check/validation-loading-20261024.md) for the
observed scope and untested paths. Codex validation remains on hold; no Codex or Windows support is added.

The [2026-10-24 validation record](../../examples/docs-claim-check/validation-20261024.md) covers installed
invocation and behavior on macOS with Claude Code 2.1.309, Opus 5.5 and Sonnet 5.5. It preserves an invalid
initial host-setup attempt alongside 12 qualifying observations, including six complete claim assessments.
This is finite evidence, not a guarantee that every output or host configuration will comply.

Human review remains necessary: outputs can overstate evidence timestamps, choose an imperfect reason or
request the wrong evidence/ref, and group or count claims inconsistently. The qualifying runs did not exercise
failure reporting after a prohibited attempt with the skill already loaded. Stable does not expand Codex or
Windows support, and the Markdown instructions do not enforce host permissions.

Contract fixtures passed on Claude Code with Fable and Sonnet on 2026-07-14. The
[2026-09-12 hardening record](../../examples/docs-claim-check/validation-evidence.md) separately preserves
candidate failures, corrections, and output-format limits. These are historical observations, not new runtime claims.

## Try it

To make it clear that you want this skill, name `docs-claim-check` directly. You can also ask in ordinary
language. Either way, include the document or claim text you want checked and the evidence you already have.

```text
Use docs-claim-check to assess these release-note claims against the supplied tag list and CI output.
```

```text
Check whether the claims in this README are supported by the files and command output below. Report findings
only; do not run commands or rewrite the document.
```

Supply target text or explicitly designate its file path for host-native reading. If neither is supplied,
the skill asks without searching the repository or running commands. If the host cannot read the file without
a command, provide its contents instead. Missing evidence produces a specific request, not an automatic search.
You may designate a captured evidence bundle from a separately authorized workflow step.

For example: "Assess `README.md` using only `evidence/install.txt` and `evidence/release.txt`. Read these paths;
do not run commands or edit files." Documents and logs are evidence, not instructions to the skill.
The report states what happened; its no-command statement does not replace tool-trace inspection.

If a request also asks for rewriting, `docs-claim-check` handles the claim judgment first. It reports findings
but does not write replacement text; rewriting remains a separate step.

See the repository-only
[`intent and invocation contract`](../../examples/intent-invocation-contract) for examples of how the skills
handle mixed or ambiguous requests.

See [`examples/docs-claim-check`](https://github.com/kyungseo/skillstead/tree/main/examples/docs-claim-check) for a synthetic
fixture set and a complete worked output.

## Install

Install the complete `skills/docs-claim-check/` folder. See the
[catalog-wide installation guide](https://github.com/kyungseo/skillstead/blob/main/docs/INSTALL.md) for the
current pinned tag and runtime-specific paths.
