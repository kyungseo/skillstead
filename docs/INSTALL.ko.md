# 설치

*[English (canonical)](./INSTALL.md) · 한국어*

Skillstead는 각 skill을 portable folder로 패키징합니다. 설치할 때는 검토된 ref를 clone한 뒤 완전한
folder 하나를 복사하며, 원격 install script는 실행하지 않습니다.

> **Release pin:** 아래 명령은 `v0.8.0`을 대상으로 합니다. release candidate는 공개 전에 Claude Code와
> Codex에서 새 project 설치, discovery, source lint, 정확한 2× Chromium render 검사를 통과했습니다.
> tag 발행 후 release closeout에서도 anonymous pinned-tag clone과 package equality를 확인합니다.

`svg-infographic`을 복사하거나 discovery해도 Node.js가 설치되지 않으며, 필요하지도 않습니다. Node.js 18+는
자동화된 source lint와 bundled render workflow에만 필요합니다. Node.js가 없으면 skill이 감지한 package
manager로 설치하기 전에 사용자에게 확인합니다. 사용자가 거부하면 기존의 manual source check와 Node
없이 실행하는 Chromium PNG/visual QA 경로는 그대로 사용할 수 있으며, 자동 lint만 사용할 수 없습니다.

## Runtime 지원

Runtime 지원은 skill별로 검증합니다.

| Skill | Claude Code | Codex | 참고 |
| --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | 고정된 fresh-context brief가 Claude Code와 macOS Codex CLI에서 통과했고, Windows 11 ARM64 VM에서 시작한 새로운 Codex App task도 통과했습니다. 모든 Windows machine/filesystem을 지원한다는 의미는 아니며, Linux rendering은 아직 검증하지 않았습니다 |
| `docs-claim-check` | Supported | Not yet claimed | Claude Code Fable과 Sonnet에서 behavioral fixture를 통과했습니다 |
| `github-release-guide` | Supported | Supported | protection fixture를 포함한 material parity를 문제없이 검증했고, disposable first-public과 Guided tag-ruleset live E2E, 고정 `v0.5.0`/`v0.6.0` project 설치·discovery, release claim audit을 통과했습니다 |
| `writing-quality-editor` | Supported | Supported | 4개 mode, 21개 scenario의 cross-runtime behavior, repository dogfood, 고정 `v0.7.0` project 설치, package equality, discovery와 최종 claim closeout을 통과했습니다 |

일반적인 용도에는 runtime 열이 Supported인 skill만 복사하세요. Pending skill은 public support claim을
얻지 않은 상태로 isolated test repository에 복사해 평가할 수 있습니다.

## Runtime 경로

| Runtime | Global | Project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

Windows에서 `~`는 `%USERPROFILE%`을 뜻합니다. 새로 복사한 skill이 discovery되지 않으면 runtime을
재시작하세요.

아래 명령은 `github-release-guide`를 사용합니다. 다른 supported skill을 설치하려면 folder 이름을
바꾸세요.

## Global 설치

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

## Project 설치

대상 repository root에서 실행하세요. Team이 clone할 때도 이 folder를 받아야 한다면 복사한 folder를
commit하세요.

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

Claude Code는 `.claude\skills`, Codex는 `.agents\skills`를 사용합니다.

```powershell
git clone --depth 1 --branch v0.8.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".agents\skills\"
```

## 최신 Development Ref

현재 default branch를 복사하려면 `--branch v0.8.0`을 빼세요. 평가할 때는 유용하지만 재현 가능한 team
설치 방식은 아닙니다. Team 설치와 release evidence에는 고정된 tag를 권장합니다.

## Manual Package 구조

Folder 전체를 그대로 유지하세요.

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

설치된 README pair는 workflow를 사용자 관점의 언어로 설명합니다. Repository에만 있는 fixture와
diagram은 Skillstead repository의 `examples/github-release-guide/`에 남으며 skill과 함께 복사되지
않습니다.

`writing-quality-editor`에도 같은 complete-folder 규칙이 적용됩니다. Package에는 `CHANGELOG.md`,
`LICENSE.txt`, `SKILL.md`, English/Korean README, `agents/openai.yaml`, reference file 3개가 들어 있습니다.
Repository 전용 fixture는 `examples/writing-quality-editor/`에 남습니다.

## 깨끗하게 Update하기

`cp -R`을 사용하면 upstream에서 삭제된 file이 남을 수 있습니다. 확실하게 깨끗한 상태로 update하려면
다음 순서로 진행하세요.

1. 원하는 tag를 새로운 temporary directory에 clone합니다.
2. 설치된 target skill folder만 삭제합니다.
3. 완전한 replacement folder를 복사합니다.
4. 필요하면 runtime을 재시작하고 discovery를 확인합니다.
5. Project 설치라면 replacement를 검토하고 commit합니다.

관련 없는 skill이 들어 있을 수 있는 상위 skills directory는 삭제하지 마세요.

## 제거

설치된 skill folder만 삭제하세요.

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

제거는 local discovery만 바꿉니다. 이전에 승인하고 수행한 GitHub release나 repository mutation을
되돌리지 않습니다.
