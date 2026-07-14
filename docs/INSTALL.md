# Install

This page documents the supported Claude Code install path for Skillstead v0.4.0. Skillstead is intended as a portable skill catalog over time, but this release ships a Claude Code package.

A Claude Code skill is a folder that Claude Code loads. Install = copy the folder into a skills directory; no remote script is executed. Claude Code reads skills from two places, so pick the scope you want:

| Scope | Location | Use it for |
| --- | --- | --- |
| **Global** | `~/.claude/skills/<name>/` (Windows: `%USERPROFILE%\.claude\skills\<name>\`) | your personal skills — available in every project on your machine |
| **Project** | `<repo>/.claude/skills/<name>/` | one repository — commit it so your whole team gets the skill on clone |

Both use the same **clone + copy** method below (recommended over `curl \| bash` — running a remote script from a public repo is a trust barrier). Restart Claude Code if the skill does not appear, then invoke it by name or ask for a matching task.

The commands below use `svg-infographic` as the example. Any other skill present in the checked-out ref installs the same way — replace the folder name in the copy step. Note that the catalog can differ per ref: a pinned tag contains only the skills that existed at that tag.

## Global install (all your projects)

**macOS / Linux:**

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/svg-infographic ~/.claude/skills/
```

**Windows (PowerShell):**

```powershell
git clone --depth 1 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\svg-infographic" "$env:USERPROFILE\.claude\skills\"
```

## Project install (one repo, shareable with your team)

Run from your project's root, so the skill lands in that repo's `.claude/skills/`.

**macOS / Linux:**

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/svg-infographic .claude/skills/
```

**Windows (PowerShell):**

```powershell
git clone --depth 1 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\svg-infographic" ".claude\skills\"
```

Then **commit `.claude/skills/svg-infographic/`** to your repo. Everyone who clones the project gets the skill automatically — no per-person install. (License is Apache-2.0, so vendoring the folder is fine; keep the `LICENSE`/attribution if you redistribute it.)

## Pinned version (reproducible — recommended for teams)

Add `--branch <tag>` to any clone above, then copy to the global or project location:

```bash
git clone --depth 1 --branch v0.4.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
cp -R /tmp/skillstead/skills/svg-infographic ~/.claude/skills/      # or .claude/skills/ for project scope
```

A shallow pinned-tag clone may print `refs/tags/v0.4.0 ... is not a commit`. It is harmless; the checkout still lands on the tagged commit.

## Manual install

If you already have the files locally, copy the whole skill folder into your skills directory. The skill is a multi-file package — keep the folder structure intact:

```text
<claude-skills-dir>/svg-infographic/
├── SKILL.md                    # core workflow (entry point)
├── README.md                   # skill overview (English)
├── README.ko.md                # skill overview (Korean)
├── references/
│   ├── archetypes.md           # archetype catalog: skeletons, premium recipe, checks
│   ├── authoring.md            # detailed rules, icon set, manual render fallback
│   └── sketch.md               # opt-in tidy hand-drawn preset (paper, handwriting, rough)
└── scripts/
    └── render.sh               # SVG → 2× PNG render + dimension verification
```

This doc uses a `<claude-skills-dir>` placeholder instead of a machine-specific absolute path.

## Update

Re-run the install (clone + copy) for the same scope — it overwrites in place. Note that `cp -R` merges into an existing folder: files removed upstream may remain locally. For a guaranteed clean update, delete the target skill folder first (see Uninstall) and copy again. To move to a new pinned version, clone that tag and copy again. For a project install, commit the updated folder.

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

PNG export uses a headless Chromium-based browser (Chrome / Edge / Chromium). The bundled `scripts/render.sh` discovers the browser and verifies output dimensions on macOS / Linux; the manual per-OS commands (including Windows PowerShell) are in the skill's `references/authoring.md` §8. Without a browser, the skill delivers the SVG only. On Linux, install Noto Sans CJK/KR if Korean text renders as tofu.

## Other Agent Runtimes

Codex / Codex CLI and other agent runtime support remains deferred. Revisit once (1) there is confirmed demand and (2) the target skill's verification requirements are met in that environment (for example, browser-based PNG export for `svg-infographic`).
