# Install

A skill is a folder under your Claude Code skills directory (`~/.claude/skills/<name>/`, `%USERPROFILE%\.claude\skills\<name>\` on Windows). Install = copy the folder in. No remote script is executed.

## GitHub install (recommended)

Clone the repo and copy the one skill folder you want. We recommend **clone + copy** over `curl | bash` — running a remote script from a public repo is a trust barrier.

**Install latest — macOS / Linux:**

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p ~/.claude/skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

**Install latest — Windows (PowerShell):**

```powershell
git clone --depth 1 https://github.com/kyungseo/agent-skills.git "$env:TEMP\agent-skills"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\agent-skills\skills\svg-infographic" "$env:USERPROFILE\.claude\skills\"
```

**Install a pinned version** (reproducible — recommended for teams): add `--branch <tag>`.

```bash
git clone --depth 1 --branch v0.1.0 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

Restart Claude Code if the skill does not appear, then invoke it by name or ask for a matching task.

## Manual install

If you already have the files locally, copy the skill folder into your skills directory:

```text
<claude-skills-dir>/svg-infographic/SKILL.md
```

This doc uses a `<claude-skills-dir>` placeholder instead of a machine-specific absolute path.

## Update

Re-run the install (clone + copy) — it overwrites in place. To move to a new pinned version, clone that tag and copy again.

## Uninstall

Delete the skill folder:

```bash
rm -rf ~/.claude/skills/svg-infographic          # macOS / Linux
```
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\svg-infographic"   # Windows
```

## Rendering prerequisite

PNG export uses a headless Chromium-based browser (Chrome / Edge / Chromium) — see the skill's `SKILL.md` §6 for per-OS binary discovery and flags. Without one, the skill delivers the SVG only. On Linux, install Noto Sans CJK/KR if Korean text renders as tofu.

## Codex

Codex support is deferred for the first release. Revisit once (1) there is confirmed Codex demand and (2) browser-based PNG export is verified in the target Codex CLI / App environment.
