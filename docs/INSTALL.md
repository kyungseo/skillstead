# Install a Skillstead skill

*English (canonical) · [한국어](./INSTALL.ko.md)*

Skillstead packages each skill as a portable folder. Installation means cloning a reviewed ref and copying one
complete folder; no remote install script is executed.

## Choose a skill and version

Each skill has its own release tag. Choose the matching tag and folder as a pair:

| Skill folder | Current pinned tag | Runtime support |
| --- | --- | --- |
| `svg-infographic` | `svg-infographic/v0.8.3` | Claude Code and Codex |
| `docs-claim-check` | `docs-claim-check/v0.9.1` | Claude Code |
| `github-release-guide` | `github-release-guide/v0.8.2` | Claude Code and Codex |
| `writing-quality-editor` | `writing-quality-editor/v0.10.1` | Claude Code and Codex |

The commands below use `github-release-guide` as a worked example. To install another skill, replace both
`github-release-guide/v0.8.2` and `github-release-guide` with the matching values from the same row. Replacing
only the folder can install a package from the wrong release point.

## Ask Your AI

Not sure which commands or folders you need? Replace the placeholders and paste this prompt into Claude Code or
Codex:

```text
Install <skill> from Skillstead for <Claude Code or Codex> at <project or global> scope. Use the matching
current pinned tag in docs/INSTALL.md, copy the complete skill folder, and do not run a remote install script.
Before any system change, destructive cleanup, or credential action, show the exact action and ask for my
approval.
```

The agent follows the same pinned version, complete-folder copy, and approval boundaries shown below. This prompt
does not approve repository or system changes, and it does not turn Skillstead into a remote installer.

## Worked example: Claude Code project install on macOS/Linux

This example installs `github-release-guide`. Run it from the target repository root:

```bash
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

To install a different skill, use the tag-and-folder pair in
[Choose a skill and version](#choose-a-skill-and-version). The complete runtime, scope, and operating-system
matrix follows.

Prefer a download instead of git? Per-skill zip files are not available yet. The release checks do not currently
verify a zip file's identity and checksum, so the pinned-tag clone above is still the reliable way to install.

## Runtime support and recorded evidence

Runtime support is verified per skill:

| Skill | Claude Code | Codex | Notes |
| --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | Frozen fresh-context briefs passed on Claude Code and macOS Codex CLI; a fresh Codex App task also passed in a Windows 11 ARM64 VM. This is not a claim for every Windows machine/filesystem; Linux rendering remains unverified |
| `docs-claim-check` | Supported | Not yet claimed | Behavioral fixtures passed with Claude Code Fable and Sonnet |
| `github-release-guide` | Supported | Supported | Clean material parity (incl. protection fixtures), disposable first-public and Guided tag-ruleset live E2E, pinned `v0.5.0`/`v0.6.0` project installation/discovery, and release claim audits passed |
| `writing-quality-editor` | Supported | Supported | Four-mode, 21-scenario cross-runtime behavior, repository dogfood, and pinned `v0.7.0` project installation, package-equality, discovery, and final claim closeout passed |

The evidence notes above describe the checks recorded when each support label was established. Scenario counts
in historical evidence can differ from the current fixture inventory. For normal use, copy a skill only when its
column for your runtime says `Supported`. If that column says `Not yet claimed`, copy the skill only into an
isolated test repository for evaluation; this does not establish a public support claim.

## Skill-specific requirements

### `svg-infographic`

Copying or discovering `svg-infographic` does not install or require Node.js. Node.js 18+ is needed only for its
automated source-lint and bundled render workflow. If it is missing, the skill asks before using the detected
package manager to install it. If the user declines, the skill preserves its earlier manual source-check and
Node-free Chromium PNG/visual-QA path; only the automated lint is unavailable.

## Runtime paths

| Runtime | Global | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

On Windows, `~` means `%USERPROFILE%`. Restart the runtime if a newly copied skill is not discovered.

The commands below continue to use the `github-release-guide` example. When choosing another supported skill,
replace the release tag and folder together.

## Global install

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.agents/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.agents/skills/
```

### Claude Code — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.claude\skills\"
```

### Codex — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.agents\skills\"
```

## Project install

Run from the target repository root. Commit the copied folder if the team should receive it on clone.

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .agents/skills
cp -R /tmp/skillstead/skills/github-release-guide .agents/skills/
```

### Windows PowerShell

Use `.claude\skills` for Claude Code or `.agents\skills` for Codex:

```powershell
git clone --depth 1 --branch github-release-guide/v0.8.2 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".agents\skills\"
```

## Use the latest development state for evaluation

Omit `--branch github-release-guide/v0.8.2` to copy the current default branch. This is useful for evaluation, not reproducible
team installation. Pinned tags are recommended for teams and release evidence.

## Keep the complete package

Keep the whole folder intact:

```text
github-release-guide/
├── CHANGELOG.md
├── LICENSE.txt
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

`writing-quality-editor` follows the same complete-folder rule. Its package contains `CHANGELOG.md`,
`LICENSE.txt`, `SKILL.md`, English/Korean READMEs, `agents/openai.yaml`, and three reference files; its
repository-only fixtures remain under `examples/writing-quality-editor/`.

## Update without leaving removed files behind

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
