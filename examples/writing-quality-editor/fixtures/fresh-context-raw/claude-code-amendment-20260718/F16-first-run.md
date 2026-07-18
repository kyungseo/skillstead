# F16 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F16 — Compose A New README From Verified Facts
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + supplied facts inline
- Environment/delivery retry: 0
- Material corrective rerun: 0

## First-Run Raw Output

## Drafted Text

```markdown
# Acme Queue Lens

Acme Queue Lens is a command-line tool that inspects a local queue snapshot and creates a local HTML report. Nothing leaves your machine: the command does not upload the snapshot or the report.

## Quick start

Run the inspector against your snapshot file:

​```
acme-queue inspect snapshot.json
​```

When the command finishes, the report is at `report.html`. That file appearing is your success signal.

## Local-only operation

`acme-queue inspect` reads the snapshot and writes the report locally. It does not upload the snapshot or the report.

## Platform support

Verified on macOS 15. Windows and Linux are unverified.
```

## Source Notes

- Facts used, all from the supplied brief: product name `Acme Queue Lens`; behavior (inspects a local queue snapshot, creates a local HTML report); command `acme-queue inspect snapshot.json`; output path `report.html`; no-upload guarantee; verified platform macOS 15 with Windows/Linux unverified.
- Identifiers (`acme-queue inspect snapshot.json`, `report.html`, `macOS 15`) are preserved exactly as supplied.
- The shortest verified success path is the single supplied command; the success signal (existence of `report.html`) follows directly from the supplied output path.
- The no-upload fact is stated in both the intro (as evaluation-relevant value) and its own section, since it is the only supplied trust/boundary claim.

## Needs Human

- **Installation**: no install or download method was supplied, so the README has no install section. Developers evaluating the tool will likely need one first.
- **Obtaining `snapshot.json`**: the brief does not say how a snapshot is produced or where it comes from, so the quick start assumes the reader already has one.
- **Report contents**: the brief does not describe what the HTML report shows, so the README cannot say what the reader will see. It also does not instruct the reader to open `report.html`, since "open it in a browser" would be an unsupplied action.
- **Next documents/links**: no docs, license, or support channels were supplied, so there is no further-reading section.

## Assumptions And Omissions

- Output language is English, matching the brief and the stated developer audience.
- `report.html` is presented exactly as supplied; the README does not claim it is written to the current working directory, since the brief gives only the relative path.
- No feature list, benefits, compatibility claims, or usage examples beyond the single verified command were added.
