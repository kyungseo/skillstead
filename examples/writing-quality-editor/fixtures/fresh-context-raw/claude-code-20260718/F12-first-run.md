# F12 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

## Revised Text

```text
Acme Diff compares two configuration files and highlights values that changed. Run `acme-diff before.yml after.yml`
to print a local report; the command does not upload either file.
```

No changes. The excerpt already meets the README profile for a developer audience, and revising it further would be churn rather than improvement.

## Preservation Notes

- **Already-correct README structure**: identity ("Acme Diff compares two configuration files"), concrete value ("highlights values that changed"), shortest success path (the runnable command), and a support/privacy boundary ("does not upload either file") — in that order. This is exactly the priority order the README profile calls for, so the information flow was preserved as-is.
- **Identifiers kept exact**: `acme-diff`, `before.yml`, `after.yml`, and the product name "Acme Diff".
- **Claims kept at original strength**: "compares", "highlights", "prints a local report", and the negative claim "does not upload either file" were neither strengthened (e.g., to "never uploads anything") nor weakened. That upload claim is a trust-critical invariant; I preserved its exact scope ("either file") rather than broadening it.
- **Neutral preferences not applied**: wordings like "values that changed" vs. "changed values", or splitting the semicolon into two sentences, are stylistic coin-flips for this audience. Per the rubric, already-natural text is left alone.

## Material Changes

None.

One note outside editing scope: whether the command truly performs no upload is a factual claim I did not verify — this workflow preserves claims, it does not check them. If you want that claim audited against the code, a claim-checking pass is the right tool.
