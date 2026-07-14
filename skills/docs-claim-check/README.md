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

Every run states its **input scope** up front — what documents and evidence were
reviewed, what was requested but missing, and a claim coverage count — so a
`verified` can never quietly mean more than it should.

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

## Try it

See [`examples/docs-claim-check`](../../examples/docs-claim-check) for a synthetic
fixture set and a complete worked output.
