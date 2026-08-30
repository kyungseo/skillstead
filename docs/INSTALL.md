<a id="top"></a>

# Install a Skillstead skill

*English (canonical) · [한국어](./INSTALL.ko.md)*

Skillstead packages each skill as one portable folder. The quickest path is to open the section for the skill you
want and paste its pinned install request into a supported runtime. Manual filesystem commands remain available
later in this guide.

## Jump to a skill

- [`svg-infographic`](#svg-infographic) — editable technical SVG and verified PNG
- [`docs-claim-check`](#docs-claim-check) — evidence-bounded public claim review
- [`github-release-guide`](#github-release-guide) — approval-gated GitHub release guidance
- [`writing-quality-editor`](#writing-quality-editor) — natural, meaning-preserving user-facing writing
- [`street-portrait-artist`](#street-portrait-artist) — Street Caricature and Romance Watercolor portraits

Reference sections:

- [Manual filesystem installation](#manual-filesystem-installation)
- [Runtime support and recorded evidence](#runtime-support-and-recorded-evidence)
- [Evaluate the latest development state](#evaluate-the-latest-development-state)
- [Update, uninstall, and package integrity](#update-uninstall-and-package-integrity)

## Current releases

Each skill has its own release tag. The copy-ready requests below pin both the release tag and the complete skill
folder so they cannot drift apart.

| Skill | Current pinned tag | Supported runtime |
| --- | --- | --- |
| `svg-infographic` | `svg-infographic/v0.11.0` | Claude Code and Codex |
| `docs-claim-check` | `docs-claim-check/v0.9.1` | Claude Code |
| `github-release-guide` | `github-release-guide/v0.9.0` | Claude Code and Codex |
| `writing-quality-editor` | `writing-quality-editor/v0.13.0` | Claude Code and Codex |
| `street-portrait-artist` | `street-portrait-artist/v0.1.1` | ChatGPT and Codex |

The default request installs a personal/global skill. To keep a filesystem-installed skill inside the current
repository, replace `globally` with `in the current project`. ChatGPT manages its skill library in the product and
does not use the filesystem scopes in this guide.

---

<a id="svg-infographic"></a>

## `svg-infographic`

- Current release: `svg-infographic/v0.11.0`
- Supported runtime: Claude Code and Codex
- Package guide: [`skills/svg-infographic/README.md`](../skills/svg-infographic/README.md)

Paste this into Claude Code or Codex:

```text
Install this Skillstead skill globally from the pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/svg-infographic/v0.11.0/skills/svg-infographic
```

Copying or discovering `svg-infographic` does not require Node.js. Node.js 18+ is needed only for its automated
source lint and bundled render workflow. If Node.js is unavailable, the skill preserves its documented manual
source-check and Node-free Chromium visual-QA fallback.

[Back to the skill list](#jump-to-a-skill)

---

<a id="docs-claim-check"></a>

## `docs-claim-check`

- Current release: `docs-claim-check/v0.9.1`
- Supported runtime: Claude Code
- Package guide: [`skills/docs-claim-check/README.md`](../skills/docs-claim-check/README.md)

Paste this into Claude Code:

```text
Install this Skillstead skill globally from the pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/docs-claim-check/v0.9.1/skills/docs-claim-check
```

Codex runtime support is not yet claimed for this skill. Installing it experimentally in another runtime does not
establish a public support claim.

[Back to the skill list](#jump-to-a-skill)

---

<a id="github-release-guide"></a>

## `github-release-guide`

- Current release: `github-release-guide/v0.9.0`
- Supported runtime: Claude Code and Codex
- Package guide: [`skills/github-release-guide/README.md`](../skills/github-release-guide/README.md)

Paste this into Claude Code or Codex:

```text
Install this Skillstead skill globally from the pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/github-release-guide/v0.9.0/skills/github-release-guide
```

Installation adds the reusable guidance only. It does not approve a repository visibility change, tag, GitHub
Release, settings change, destructive cleanup, or credential action.

[Back to the skill list](#jump-to-a-skill)

---

<a id="writing-quality-editor"></a>

## `writing-quality-editor`

- Current release: `writing-quality-editor/v0.13.0`
- Supported runtime: Claude Code and Codex
- Package guide: [`skills/writing-quality-editor/README.md`](../skills/writing-quality-editor/README.md)

Paste this into Claude Code or Codex:

```text
Install this Skillstead skill globally from the pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/writing-quality-editor/v0.13.0/skills/writing-quality-editor
```

The package includes the complete English/Korean authoring and review references. Install the whole folder rather
than copying only `SKILL.md`.

[Back to the skill list](#jump-to-a-skill)

---

<a id="street-portrait-artist"></a>

## `street-portrait-artist`

- Current release: `street-portrait-artist/v0.1.1`
- Supported runtime: ChatGPT and Codex
- Package guide: [`skills/street-portrait-artist/README.md`](../skills/street-portrait-artist/README.md)

Paste this into ChatGPT:

```text
Install the street-portrait-artist skill from this pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/street-portrait-artist/v0.1.1/skills/street-portrait-artist
```

Paste this into Codex:

```text
Install this Skillstead skill globally from the pinned GitHub folder: https://github.com/kyungseo/skillstead/tree/street-portrait-artist/v0.1.1/skills/street-portrait-artist
```

ChatGPT may ask you to confirm the installation. If the current conversation still discovers an older cached
version, start a new conversation after installation. ChatGPT availability and workspace permissions are managed
by the product.

[Back to the skill list](#jump-to-a-skill)

---

## Manual filesystem installation

Use this section when you prefer direct commands or when an agent cannot complete the copy itself. Installation
means cloning the exact reviewed tag and copying the complete skill folder. No remote install script is executed.

### Runtime paths

| Runtime | Personal/global path | Project path |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.codex/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

On Windows, `~` means `%USERPROFILE%`. If the runtime does not discover a newly copied skill, start a new session.

The primary path is the copy-ready request in each skill section. If you need exact shell commands, expand the
worked `github-release-guide` examples below. Run only the example matching your runtime and scope, from a clean
temporary path. For another skill, replace the tag and folder together with the pair shown above.

<details>
<summary>Show exact macOS/Linux and Windows commands</summary>

### Personal/global install

#### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.claude/skills/
```

#### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.codex/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.codex/skills/
```

#### Claude Code — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.claude\skills\"
```

#### Codex — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.codex\skills\"
```

### Project install

Run these commands from the target repository root.

#### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

#### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .agents/skills
cp -R /tmp/skillstead/skills/github-release-guide .agents/skills/
```

#### Claude Code — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".claude\skills\"
```

#### Codex — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".agents\skills\"
```

</details>

Per-skill zip files are not currently published or checksum-verified. The pinned-tag clone remains the reproducible
manual installation path.

[Back to top](#top)

## Runtime support and recorded evidence

Runtime support is verified per skill:

| Skill | Claude Code | Codex | Other | Evidence boundary |
| --- | --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | — | Frozen fresh-context briefs passed on Claude Code and macOS Codex CLI; a fresh Codex App task also passed in a Windows 11 ARM64 VM. Linux rendering and every Windows machine/filesystem are not claimed |
| `docs-claim-check` | Supported | Not yet claimed | — | Behavioral fixtures passed with Claude Code Fable and Sonnet |
| `github-release-guide` | Supported | Supported | — | Material parity, disposable first-public and Guided tag-ruleset E2E, pinned installation/discovery, and release claim audits passed |
| `writing-quality-editor` | Supported | Supported | — | Four-mode cross-runtime behavior, repository dogfood, pinned installation, package equality, discovery, and claim closeout passed |
| `street-portrait-artist` | Not applicable | Supported | ChatGPT: Supported | Fresh published `0.1.0` package installation, discovery, invocation, synthetic reference-image generation, fail-visible size fallback, and output delivery established runtime support; `0.1.1` is the current install release |

Evidence recorded for an earlier release can establish a bounded runtime capability without making that older
release the current install target. For normal use, choose only a runtime marked `Supported`. `Not yet claimed`
means evaluation only; it is not a public support claim.

For `street-portrait-artist`, ChatGPT uses a product-managed skill interface rather than the filesystem paths
above. The observed ChatGPT and Codex runtime images were `1122 x 1402 px`; exact `1080 x 1350 px` export was
unavailable and reported rather than hidden. This evidence establishes runtime support and honest fallback, not
deterministic likeness or broad visual-quality maturity.

[Back to top](#top)

## Evaluate the latest development state

For evaluation only, replace the pinned tag with the default branch. This is not a reproducible team installation
and does not replace the current-release links above. Pinned tags remain the recommended path for normal use,
teams, and release evidence.

[Back to top](#top)

## Update, uninstall, and package integrity

### Keep the complete package

Copy the entire `skills/<name>/` folder. A package can include `SKILL.md`, bilingual READMEs, a changelog, license,
runtime metadata, scripts, and required references. Repository-only fixtures and gallery assets under `examples/`
are not part of the installed package unless a skill guide explicitly says otherwise.

### Update without stale files

`cp -R` can leave files that were removed upstream. For a clean update:

1. Clone the desired tag into a fresh temporary directory.
2. Remove only the installed folder for the target skill.
3. Copy the complete replacement folder.
4. Start a new runtime session and verify the discovered version.
5. For a project install, review and commit the replacement.

Do not remove a parent skills directory that may contain unrelated skills.

### Uninstall

Delete only the installed target folder:

```text
Claude Code personal: ~/.claude/skills/<name>
Claude Code project:  <repo>/.claude/skills/<name>
Codex personal:       ~/.codex/skills/<name>
Codex project:        <repo>/.agents/skills/<name>
```

Uninstall changes only local discovery. It does not undo a previously approved repository or GitHub mutation.

[Back to top](#top)
