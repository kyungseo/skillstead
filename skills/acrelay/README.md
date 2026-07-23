# acRelay Skill

**English** · [한국어](./README.ko.md)

This Skill makes the standalone
[acRelay engine](https://github.com/kyungseo/acrelay) easier to use. The engine
is one executable with no acRelay-owned daemon, server, or database. The Skill
does not reimplement that engine; it turns a natural-language request into the
engine’s review workflow.

Ask for a red-team review of a plan, document, one file, selected implementation
files, or a declared directory tree. acRelay starts a separate Claude Code or
Codex CLI reviewer, keeps the reviewed revision and findings in a private
record, requires a driver response to every finding, and leaves approval and
Close with a human owner.

## What It Replaces

For every manual round, someone normally copies the request to the reviewer and
copies the result back to the driver. Three rounds can require six
copy-and-paste handoffs.

| Before | With the acRelay Skill |
| --- | --- |
| Move each request and result between agents | Start in natural language; the Skill calls the engine |
| Remember the reviewed revision and open findings | Keep the revision, findings, and responses in one private record |
| Let the conversation drift until someone agrees | Use 1–5 formal rounds (default 3), then return the decision to the owner |

One-shot means one deliberately started, bounded review objective—not one
prompt or one reviewer turn. acRelay runs only when invoked and never continues
as a background service.

## Publication Status

This Skill is a flagship Alpha preview and has not yet been published as
supported for Claude Code or Codex. Its files, compatibility messages, and
offline request routing can be checked now. Installation, recognition by each
runtime, and a complete first review through closeout still need direct
evidence.

## Install The Engine

The Skill needs the exact `v0.1.0-alpha.1` engine on `PATH`. The current
prebuilt binary is for macOS Apple Silicon (`darwin/arm64`).
The command below works only after the exact tag and release assets are public;
if they are unavailable, stop rather than substituting `latest`.

```sh
curl -fsSL https://raw.githubusercontent.com/kyungseo/acrelay/v0.1.0-alpha.1/scripts/install.sh | bash
```

The installer is pinned to the release and checks the binary archive against
its published checksum. If you prefer to inspect the installer before running
it, or want the pinned `go install` alternative, follow the
[acRelay installation guide](https://github.com/kyungseo/acrelay/blob/v0.1.0-alpha.1/docs/OPERATIONS.md).

Linux and Windows core runtime lanes are already verified. Platform-specific
Claude Code and Codex review validation is planned as the next support step,
with patches released after the evidence is reviewed. Until then the engine
stops before reviewer dispatch on an unverified platform tuple.

## Install The Skill Preview

The preview is not included in the published `v0.7.0` Skillstead tag. Use the
default branch only when intentionally evaluating unreleased work. Copy the
complete `skills/acrelay` folder; do not copy `SKILL.md` by itself.

### Claude Code

```sh
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p "$HOME/.claude/skills"
cp -R /tmp/skillstead/skills/acrelay "$HOME/.claude/skills/"
```

### Codex

```sh
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p "$HOME/.agents/skills"
cp -R /tmp/skillstead/skills/acrelay "$HOME/.agents/skills/"
```

Restart the agent host if it does not recognize the newly copied Skill. See the
[Skillstead install guide](../../docs/INSTALL.md) for project-local paths,
Windows copy commands, clean updates, and removal.

The Skill never installs or upgrades the engine automatically. A missing or
different engine version stops with an explanation; it never bypasses acRelay
by calling the reviewer directly.

## Example Requests

### Challenge a plan

```text
Use acRelay to have Claude red-team this plan. Keep the review record private, use at most three formal rounds, and show me the decisions that still belong to the owner.
```

### Review one file

```text
Use acRelay to have Codex review this file. Record what it examined and every finding, but do not close the review.
```

### Review an implementation

```text
Use acRelay to review these checked-out implementation files against the approved plan. Ask the driver to respond to every finding before showing the closeout summary.
```

acRelay v0.1.0-alpha.1 accepts a file, explicit files, or a declared subtree.
It does not yet accept a PR URL, staged patch, commit range, or branch
comparison as a first-class selector. Check out the intended revision and name
the files or subtree instead.

### Use one agent ecosystem

```text
I am working in Claude Code. Use acRelay with a separate Claude Code CLI reviewer. Record that this is a same-vendor review and that the two contexts may share blind spots.
```

A single-agent user can run a red team through a separate CLI reviewer,
including a supported same-vendor session. This is not host-native subagent
support. Direct ingestion of a host-created subagent result remains
unsupported and fails closed until a stable host interface and typed result
contract are available.

### Current agent paths

The practical Alpha path is:

```text
Codex App, Claude Code CLI, or Codex CLI as driver
  → acRelay Skill
  → installed acrelay binary
  → Claude Code CLI or Codex CLI as reviewer
```

- Claude Code CLI and Codex CLI can fill the driver or reviewer role on a
  verified engine platform tuple.
- Codex App can be the driver and invoke the local Skill/binary; it is not a
  reviewer adapter.
- Claude App has no direct acRelay path.
- Antigravity is a future driver candidate, but neither its driver path nor a
  reviewer adapter is supported today.

The engine does not infer that any two agents are independent. It records the
declared and observed relationship and shows the corresponding caution.

### Inspect without closing

```text
Continue this acRelay review with the existing reviewer. Show me the closeout summary, but leave the final decision and Close to the owner.
```

## What The Skill Asks Before Review

- the exact file, files, or subtree to review,
- the review question,
- Claude Code or Codex as reviewer,
- who the owner is,
- where to keep the private Markdown review record,
- whether review content, resolved paths, and metadata may be sent to the
  selected reviewer service,
- how the driver and reviewer contexts are related,
- and whether the default three-round limit is acceptable.

The reviewer CLI may use its provider’s network and model tokens. A local
review record does not mean local model inference.

## Boundaries

- The binary—not the Skill—owns review state, evidence, recovery, cleanup, and
  Close.
- acRelay automates the reviewer run, not the driver’s response or the owner’s
  decision.
- A separate context or reviewer vendor does not prove independent judgment.
- Recorded excerpts do not prove understanding, completeness, or correctness.
- `briefing` only summarizes the current record; it is never approval.
- A reviewer run recorded as `UNKNOWN` is never retried automatically.
- Removing the binary or Skill does not remove `~/.acrelay`, private review
  records, or reviewer-vendor data.

For exact commands, formats, platform evidence, and recovery rules, use the
[acRelay engine documentation](https://github.com/kyungseo/acrelay).
