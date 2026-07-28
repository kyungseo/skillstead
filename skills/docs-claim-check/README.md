# docs-claim-check

**English** · [한국어](./README.ko.md)

Check whether the claims in public-facing documentation — README files, release
notes, install and usage docs — are actually supported by the evidence you provide:
manifests, logs, tag lists, CI output, command output you ran yourself.

The skill splits composite statements into atomic claims and walks each one through a
fixed decision tree, producing exactly one confidence label per claim:

| Label | Meaning |
| --- | --- |
| `verified` | the provided, current evidence directly supports the whole claim — valid only within the reviewed scope |
| `unsupported` | objectively checkable, but the evidence is missing (`missing-evidence`), conflicting (`contradicted`), or partial (`insufficient-coverage`) |
| `stale-suspected` | a date/version/support-window mismatch — likely true once, currency not supported |
| `needs-human` | requires subjective judgment, code review, command execution, or an external authority |

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
- Anything requiring command execution — by contract it does not run commands; it
  asks you for the output instead. In a mixed request it declines only the
  out-of-scope part and still assesses the eligible claims

## Beta model validation

Contract fixtures passed on Claude Code with Fable and Sonnet on 2026-07-14. Exact
row decomposition and coverage bookkeeping may vary by model; material claim
coverage, confidence-label semantics, evidence boundaries, and output-contract
compliance are the compatibility criteria.

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

If you have not supplied the target text, the skill asks for it without searching the repository or running a
command. If the target is present but some evidence is missing, it tells you exactly what evidence is needed.

If a request also asks for rewriting, `docs-claim-check` handles the claim judgment first. It reports findings
but does not write replacement text; rewriting remains a separate step.

See the repository-only
[`intent and invocation contract`](../../examples/intent-invocation-contract) for examples of how the skills
handle mixed or ambiguous requests.

See [`examples/docs-claim-check`](https://github.com/kyungseo/skillstead/tree/main/examples/docs-claim-check) for a synthetic
fixture set and a complete worked output.
