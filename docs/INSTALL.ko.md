# 설치

[English](./INSTALL.md) · **한국어**

Skillstead의 각 스킬은 필요한 안내와 지원 파일을 모두 담은 독립된 폴더입니다.
설치하려면 `v0.8.0`처럼 검증이 끝난 release tag를 clone한 뒤, 사용할 스킬의
폴더 전체를 Claude Code 또는 Codex가 읽는 위치에 복사합니다. 원격 설치
스크립트는 실행하지 않습니다.

> **Release 고정:** 아래 명령은 공개된 정확한 `v0.8.0` tag를 설치합니다.
> Default branch는 preview라고 명시한 package에만 사용하세요.

`svg-infographic`을 설치하거나 Agent가 발견하는 데는 Node.js가 필요하지 않습니다.
자동 source lint와 포함된 render workflow에만 Node.js 18 이상이 필요합니다.
Node가 없으면 Agent가 발견한 package manager로 설치하기 전에 먼저 승인을
요청합니다. 사용자가 거절해도 기존 수동 source 점검과 Node 없는 Chromium
PNG·visual QA 경로를 유지하며, 자동 lint만 사용할 수 없습니다.

## Runtime 지원

여기서 runtime은 스킬을 읽고 실행하는 agent host, 즉 Claude Code 또는 Codex를
뜻합니다. 지원 여부는 스킬과 runtime 조합마다 따로 검증합니다.

| 스킬 | Claude Code | Codex | 참고 |
| --- | --- | --- | --- |
| `svg-infographic` | 지원 | 지원 | Claude Code와 macOS Codex CLI의 고정 요구사항 검증을 통과했고, Windows 11 ARM64 VM의 새 Codex App 작업도 통과했습니다. 이 결과를 모든 Windows 장치나 파일 시스템에 일반화하지 않으며 Linux 렌더링은 아직 검증하지 않았습니다. |
| `docs-claim-check` | 지원 | 아직 지원을 주장하지 않음 | Claude Code Fable과 Sonnet으로 동작 fixture를 통과했습니다. |
| `github-release-guide` | 지원 | 지원 | Protection fixture를 포함해 두 runtime의 필수 동작이 일치했습니다. Disposable first-public 및 Guided tag-ruleset live test, `v0.5.0`/`v0.6.0` 고정 설치·스킬 인식과 release claim audit도 통과했습니다. |
| `writing-quality-editor` | 지원 | 지원 | 두 runtime에서 네 가지 mode와 21개 scenario를 통과했습니다. Repository dogfood, `v0.7.0` 고정 설치, 파일 일치, 스킬 인식과 최종 공개 문구 검증도 통과했습니다. |

일반적인 용도라면 사용하는 runtime 열이 `지원`인 스킬을 선택하세요.

## 폴더를 복사할 위치

| Runtime | 전역 | 프로젝트 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

Windows에서 `~`는 `%USERPROFILE%`을 뜻합니다. 새로 복사한 스킬이 보이지 않으면
Claude Code 또는 Codex를 재시작한 뒤 다시 확인하세요.

아래 명령은 `github-release-guide`를 예로 사용합니다. 다른 지원 스킬을 설치하려면 폴더 이름을
바꾸세요.

## 전역 설치

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

## 프로젝트 설치

대상 저장소의 root에서 실행하세요. 팀 구성원이 clone할 때도 스킬을 받게 하려면 복사한 폴더를
commit합니다.

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

## 아직 공개하지 않은 최신 변경 사용

현재 default branch를 복사하려면 `--branch v0.8.0`을 생략합니다. 이 방식은
공개 전 변경을 평가할 때는 유용하지만, 팀에서 같은 version을 재현하는 설치에는
적합하지 않습니다. 팀 설치와 release 검증에는 고정된 tag를 권장합니다.

## 함께 복사해야 하는 파일

폴더 전체를 그대로 유지하세요.

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

설치되는 README 두 파일은 workflow를 영어와 한국어로 설명합니다.
`examples/github-release-guide/` 아래의 test fixture와 diagram은 스킬을
개발하고 검증할 때 사용하며, 설치 폴더에는 포함되지 않습니다.

`writing-quality-editor`도 같은 전체 폴더 규칙을 따릅니다. 패키지에는 `SKILL.md`, 영문·한국어
README, `agents/openai.yaml`과 reference 파일 3개가 들어 있습니다. 저장소 전용 fixture는
`examples/writing-quality-editor/`에 남습니다.

## 깨끗한 업데이트

`cp -R`은 기존 파일 위에 새 파일을 복사하지만, 새 release에서 없어진 파일까지
삭제하지는 않습니다. 오래된 파일을 남기지 않으려면 다음 순서로 진행하세요.

1. 원하는 release tag를 새로운 임시 directory에 clone합니다.
2. 설치된 스킬 중 업데이트할 폴더만 삭제합니다.
3. 새 전체 폴더를 복사합니다.
4. 필요하면 Claude Code 또는 Codex를 재시작하고 스킬이 보이는지 확인합니다.
5. 프로젝트 설치라면 교체한 내용을 검토한 뒤 commit합니다.

관련 없는 스킬이 들어 있을 수 있으므로 상위 skills 디렉터리 전체를 삭제하지 마세요.

## 제거

설치한 스킬 폴더만 삭제하세요.

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

제거하면 로컬의 Claude Code 또는 Codex에서 해당 스킬이 보이지 않게 됩니다.
이전에 승인하고 실행한 GitHub release나 repository 변경까지 되돌리지는
않습니다.
