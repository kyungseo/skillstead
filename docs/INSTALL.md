# Install

A skill is a folder that Claude Code loads. Install = copy the folder into a skills directory; no remote script is executed. Claude Code reads skills from two places, so pick the scope you want:

| Scope | Location | Use it for |
| --- | --- | --- |
| **Global** | `~/.claude/skills/<name>/` (Windows: `%USERPROFILE%\.claude\skills\<name>\`) | your personal skills — available in every project on your machine |
| **Project** | `<repo>/.claude/skills/<name>/` | one repository — commit it so your whole team gets the skill on clone |

Both use the same **clone + copy** method below (recommended over `curl \| bash` — running a remote script from a public repo is a trust barrier). Restart Claude Code if the skill does not appear, then invoke it by name or ask for a matching task.

## Global install (all your projects)

**macOS / Linux:**

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p ~/.claude/skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

**Windows (PowerShell):**

```powershell
git clone --depth 1 https://github.com/kyungseo/agent-skills.git "$env:TEMP\agent-skills"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\agent-skills\skills\svg-infographic" "$env:USERPROFILE\.claude\skills\"
```

## Project install (one repo, shareable with your team)

Run from your project's root, so the skill lands in that repo's `.claude/skills/`.

**macOS / Linux:**

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p .claude/skills
cp -R /tmp/agent-skills/skills/svg-infographic .claude/skills/
```

**Windows (PowerShell):**

```powershell
git clone --depth 1 https://github.com/kyungseo/agent-skills.git "$env:TEMP\agent-skills"
New-Item -ItemType Directory -Force ".claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\agent-skills\skills\svg-infographic" ".claude\skills\"
```

Then **commit `.claude/skills/svg-infographic/`** to your repo. Everyone who clones the project gets the skill automatically — no per-person install. (License is Apache-2.0, so vendoring the folder is fine; keep the `LICENSE`/attribution if you redistribute it.)

## Pinned version (reproducible — recommended for teams)

Add `--branch <tag>` to any clone above, then copy to the global or project location:

```bash
git clone --depth 1 --branch v0.1.0 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/      # or .claude/skills/ for project scope
```

## Manual install

If you already have the files locally, copy the skill folder into your skills directory:

```text
<claude-skills-dir>/svg-infographic/SKILL.md
```

This doc uses a `<claude-skills-dir>` placeholder instead of a machine-specific absolute path.

## Update

Re-run the install (clone + copy) for the same scope — it overwrites in place. To move to a new pinned version, clone that tag and copy again. For a project install, commit the updated folder.

## Uninstall

Delete the skill folder from whichever scope you installed:

```bash
rm -rf ~/.claude/skills/svg-infographic     # global (macOS / Linux)
rm -rf .claude/skills/svg-infographic       # project (from repo root)
```
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\svg-infographic"   # global (Windows)
Remove-Item -Recurse -Force ".claude\skills\svg-infographic"                    # project (Windows)
```

## Rendering prerequisite

PNG export uses a headless Chromium-based browser (Chrome / Edge / Chromium) — see the skill's `SKILL.md` §6 for per-OS binary discovery and flags. Without one, the skill delivers the SVG only. On Linux, install Noto Sans CJK/KR if Korean text renders as tofu.

## Codex

Codex support is deferred for the first release. Revisit once (1) there is confirmed Codex demand and (2) browser-based PNG export is verified in the target Codex CLI / App environment.
