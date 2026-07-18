# F15 — Post-Fix First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

## Revised Text

```text
Acme Sync can resume an interrupted upload. Run `acme sync --resume` to continue. Resume supports files up to 5 GB, and upload progress is stored locally. If your authentication has expired, the command stops and asks you to sign in again.
```

## Preservation Notes

- The original two sentences were already effective for a README — capability first, then the command — so they are kept verbatim, including the protected identifier `acme sync --resume`.
- The three supplied facts are integrated exactly at their stated strength: the 5 GB figure is presented as a bound on resume (not on uploads generally), progress storage is stated as "locally" without inventing a mechanism or path, and the expired-auth behavior is described as stop-then-prompt, not as an automatic re-authentication.
- No adjacent claims were inferred — nothing about resuming across machines, data safety, network conditions, or what happens above 5 GB, since none of that was supplied.

## Material Changes

- Added two sentences after the command in README order: capability boundary (5 GB, local progress) first, then the failure path (expired authentication). This gives an evaluating developer the limit and the failure behavior immediately after the success path, without altering the original claim or command.
