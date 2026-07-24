# Install

Skillstead packages each skill as a portable folder. Installation means cloning a reviewed ref and copying one
complete folder; no remote install script is executed.

> **Release pin:** The commands below target `v0.8.0`. The release candidate passed fresh project installation,
> discovery, source-lint, and exact 2× Chromium-render checks on Claude Code and Codex before publication.
> After the tag is published, release closeout still verifies an anonymous pinned-tag clone and package equality.

Copying or discovering `svg-infographic` does not install or require Node.js. Node.js 18+ is needed only for its
automated source-lint and bundled render workflow. If it is missing, the skill asks before using the detected
package manager to install it. If the user declines, the skill preserves its earlier manual source-check and
Node-free Chromium PNG/visual-QA path; only the automated lint is unavailable.

## Runtime support

Runtime support is verified per skill:

| Skill | Claude Code | Codex | Notes |
| --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | Frozen fresh-context briefs passed on Claude Code and macOS Codex CLI; a fresh Codex App task also passed in a Windows 11 ARM64 VM. This is not a claim for every Windows machine/filesystem; Linux rendering remains unverified |
| `docs-claim-check` | Supported | Not yet claimed | Behavioral fixtures passed with Claude Code Fable and Sonnet |
| `github-release-guide` | Supported | Supported | Clean material parity (incl. protection fixtures), disposable first-public and Guided tag-ruleset live E2E, pinned `v0.5.0`/`v0.6.0` project installation/discovery, and release claim audits passed |
| `writing-quality-editor` | Supported | Supported | Four-mode, 21-scenario cross-runtime behavior, repository dogfood, and pinned `v0.7.0` project installation, package-equality, discovery, and final claim closeout passed |

Copy only a skill whose runtime column says Supported for normal use. A Pending skill may be copied into an
isolated test repository for evaluation without earning a public support claim.

## Runtime paths

| Runtime | Global | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

On Windows, `~` means `%USERPROFILE%`. Restart the runtime if a newly copied skill is not discovered.

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

## Latest development ref

Omit `--branch v0.8.0` to copy the current default branch. This is useful for evaluation, not reproducible
team installation. Pinned tags are recommended for teams and release evidence.

## Manual package shape

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

The installed README pair explains the workflow in user-facing language. Repository-only fixtures and
diagrams remain at `examples/github-release-guide/` in the Skillstead repository and are not copied with the
skill.

`writing-quality-editor` follows the same complete-folder rule. Its package contains `SKILL.md`, English/Korean
READMEs, `agents/openai.yaml`, and three reference files; its repository-only fixtures remain under
`examples/writing-quality-editor/`.

## Clean update

`cp -R` can leave files that were removed upstream. For a guaranteed clean update:

1. Clone the desired tag into a fresh temporary directory.
2. Delete only the target installed skill folder.
3. Copy the complete replacement folder.
4. Restart the runtime if needed and verify discovery.
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

Uninstall changes only local discovery. It does not undo a GitHub release or any repository mutation that
was previously approved and performed.
