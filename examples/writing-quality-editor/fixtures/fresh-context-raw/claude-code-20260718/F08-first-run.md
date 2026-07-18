# F08 — First Run Raw Output (Claude Code runtime, claude-fable-5 subagent, 2026-07-18)

Loaded the skill and its required rubric. Here is the Revise-mode result.

## Revised Text

```text
Acme Export 1.2 updates the export flow.

On macOS 15, the export flow passed manual smoke testing. Windows and Linux were not
tested for this release, so behavior on those platforms is unverified.
```

## Preservation Notes

- Product identity and version kept exactly: `Acme Export 1.2`.
- The export flow remains the subject and the release's user-visible focus.
- The positive framing (this release is about the export flow) is retained, scoped to what the evidence supports.
- Platform names `macOS`, `Windows`, `Linux` preserved as identifiers; the evidence's `macOS 15` version is stated explicitly.

## Needs Human

- The original asserts "works everywhere" and "fully reliable across macOS, Windows, and Linux," but the provided evidence covers only a manual smoke pass on macOS 15. I could not preserve those claims without exceeding the evidence, so I rewrote them to the evidence boundary. If broader verification exists (CI runs, Windows/Linux test results), supply it and the claim can be widened.
- Decide whether shipping with Windows/Linux untested is acceptable messaging, or whether the note should defer mention of those platforms entirely until they are tested.
- The note names no concrete change (what in the export flow changed and why users should care). A release note normally leads with the user-visible outcome; I did not invent one. Add the actual change list if available.

## Material Changes

- **Claim scope (blocking fix):** "now works everywhere" / "fully reliable across macOS, Windows, and Linux" narrowed to "passed manual smoke testing on macOS 15" — the only supported claim. This is an intentional semantic change to match the stated evidence, not a silent one.
- **Limitation added:** explicit statement that Windows and Linux were not tested. Release-note profile requires compatibility and limitations to be visible; omitting this would let readers act on an unverified assumption.
- **Removed:** "giving every team a seamless release experience" — vague praise with no informational content and inflated certainty.
- **Evidence type surfaced:** "manual smoke testing" is named rather than implied, so readers can judge the verification depth themselves.
