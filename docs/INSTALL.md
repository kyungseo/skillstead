# Install

**English** · [한국어](./INSTALL.ko.md)

Each Skillstead skill is a self-contained folder with the instructions and
supporting files it needs. To install one, clone a verified release tag such as
`v0.8.0`, then copy that skill’s complete folder into the location used by
Claude Code or Codex. No remote install script is executed.

> **Release pin:** The commands below target the published `v0.8.0` tag. Its release closeout verified an
> anonymous pinned-tag clone, package equality, source-lint tests, and an exact 2× Chromium smoke render.

Copying or discovering `svg-infographic` does not install or require Node.js. Node.js 18+ is needed only for its
automated source-lint and bundled render workflow. If it is missing, the skill asks before using the detected
package manager to install it. If the user declines, the skill preserves its earlier manual source-check and
Node-free Chromium PNG/visual-QA path; only the automated lint is unavailable.

## Runtime Support

Here, a runtime is the agent host that loads and follows a Skill: Claude Code or
Codex. Support is verified separately for every Skill and runtime.

| Skill | Claude Code | Codex | Notes |
| --- | --- | --- | --- |
| `acrelay` | Pending | Pending | Unpublished Alpha preview. Its files and compatibility messages were checked offline; installation, recognition by each runtime, and a complete first review through closeout still need direct evidence. Requires exact acRelay `v0.1.0-alpha.1`. |
| `svg-infographic` | Supported | Supported | Frozen fresh-context briefs passed on Claude Code and macOS Codex CLI; a fresh Codex App task also passed in a Windows 11 ARM64 VM. This is not a claim for every Windows machine/filesystem; Linux rendering remains unverified |
| `docs-claim-check` | Supported | Not yet claimed | Behavioral fixtures passed with Claude Code Fable and Sonnet |
| `github-release-guide` | Supported | Supported | Clean material parity (incl. protection fixtures), disposable first-public and Guided tag-ruleset live E2E, pinned `v0.5.0`/`v0.6.0` project installation/discovery, and release claim audits passed |
| `writing-quality-editor` | Supported | Supported | Four-mode, 21-scenario cross-runtime behavior, repository dogfood, and pinned `v0.7.0` project installation, package-equality, discovery, and final claim closeout passed |

For normal use, choose a Skill only when your runtime column says `Supported`.
`Pending` means you may evaluate it in an isolated test repository, but
Skillstead does not yet claim that runtime as supported.

## Install The acRelay Alpha Preview

The acRelay Skill is different from the other packages in this catalog: it is
a natural-language wrapper around the separately released
[acRelay engine](https://github.com/kyungseo/acrelay). Install the engine first,
then copy the complete Skill folder.

The current prebuilt engine is for macOS Apple Silicon (`darwin/arm64`). The
command works only after the exact tag and release assets are public:

```bash
curl -fsSL https://raw.githubusercontent.com/kyungseo/acrelay/v0.1.0-alpha.1/scripts/install.sh | bash
```

The installer is pinned to the exact engine release and checksum-verifies its
binary archive. For the review-first installer and pinned `go install` path,
see the
[engine installation guide](https://github.com/kyungseo/acrelay/blob/v0.1.0-alpha.1/docs/OPERATIONS.md).
Linux and Windows core runtime lanes are verified, while platform-specific
Claude Code/Codex review validation and any resulting patches remain the next
support-expansion step.

This preview is not included in `v0.8.0`. To evaluate the unreleased default
branch with Claude Code:

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/acrelay ~/.claude/skills/
```

For Codex:

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.agents/skills
cp -R /tmp/skillstead/skills/acrelay ~/.agents/skills/
```

Use a project path (`.claude/skills` or `.agents/skills`) instead when the
Skill should travel with one repository. Restart the runtime if it does not
recognize the newly copied Skill. The Skill never installs or upgrades the
engine and never falls back to calling a reviewer directly.

See the [acRelay Skill guide](../skills/acrelay/README.md) for the before/after
workflow, round limits, examples, and single-agent usage boundary.

## Where To Copy The Folder

| Runtime | Global | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

On Windows, `~` means `%USERPROFILE%`. If a newly copied Skill does not appear,
restart Claude Code or Codex and check again.

The commands below use `github-release-guide`. Replace the folder name with another supported skill when
needed.

## Global install

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.agents/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.agents/skills/
```

### Claude Code — Windows PowerShell

```powershell
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.claude\skills\"
```

### Codex — Windows PowerShell

```powershell
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.agents\skills\"
```

## Project install

Run from the target repository root. Commit the copied folder if the team should receive it on clone.

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .agents/skills
cp -R /tmp/skillstead/skills/github-release-guide .agents/skills/
```

### Windows PowerShell

Use `.claude\skills` for Claude Code or `.agents\skills` for Codex:

```powershell
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".agents\skills\"
```

## Use The Current Unreleased Version

Omit `--branch v0.8.0` to copy the current default branch. This is useful for evaluation, not reproducible
team installation. Pinned tags are recommended for teams and release evidence.

## Files That Must Stay Together

Keep the whole folder intact:

```text
github-release-guide/
├── README.md
├── README.ko.md
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── assessment.md
    ├── first-public.md
    └── version-release.md
```

The two installed README files explain the workflow in English and Korean.
Test fixtures and diagrams under `examples/github-release-guide/` are used to
develop and verify the Skill; they are not part of the installed folder.

`writing-quality-editor` follows the same complete-folder rule. Its package contains `SKILL.md`, English/Korean
READMEs, `agents/openai.yaml`, and three reference files; its repository-only fixtures remain under
`examples/writing-quality-editor/`.

The unpublished `acrelay` preview contains `SKILL.md`, English and Korean
READMEs, and `agents/openai.yaml`. It is not part of the published `v0.8.0`
tag. Do not present it as supported until its separate validation is complete.
It requires the separately installed acRelay command at exact version
`v0.1.0-alpha.1`; the Skill never installs or updates that command. Follow the
dedicated preview instructions above rather than adapting the
`github-release-guide` example by guesswork.

## Clean update

`cp -R` copies over existing files but does not remove files that disappeared
from a newer release. To avoid leaving obsolete files behind:

1. Clone the desired release tag into a new temporary directory.
2. Delete only the target installed skill folder.
3. Copy the complete replacement folder.
4. Restart Claude Code or Codex if needed and confirm that it finds the Skill.
5. For a project install, review and commit the replacement.

Do not delete a parent skills directory that may contain unrelated skills.

## Uninstall

Delete only the installed skill folder:

```bash
rm -rf ~/.claude/skills/github-release-guide
rm -rf ~/.agents/skills/github-release-guide
rm -rf .claude/skills/github-release-guide
rm -rf .agents/skills/github-release-guide
```

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\github-release-guide"
Remove-Item -Recurse -Force "$env:USERPROFILE\.agents\skills\github-release-guide"
Remove-Item -Recurse -Force ".claude\skills\github-release-guide"
Remove-Item -Recurse -Force ".agents\skills\github-release-guide"
```

Uninstalling removes the Skill from local discovery only. It does not undo a
GitHub release or any repository change that was previously approved and
performed.
