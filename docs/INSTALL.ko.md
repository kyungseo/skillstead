# 설치

[English](./INSTALL.md) · **한국어**

Skillstead의 각 스킬은 필요한 안내와 지원 파일을 모두 담은 독립된 폴더입니다.
설치하려면 `v0.8.0`처럼 검증이 끝난 release tag를 clone한 뒤, 사용할 스킬의
폴더 전체를 Claude Code 또는 Codex가 읽는 위치에 복사합니다. 원격 설치
스크립트는 실행하지 않습니다.

> **Release 고정:** 아래 명령은 공개된 `v0.8.0` tag를 사용합니다. Release
> closeout에서 익명 고정 tag clone, package 일치, source-lint test와 정확한
> 2× Chromium smoke render를 확인했습니다.

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
| `acrelay` | 검증 대기 | 검증 대기 | 아직 공개하지 않은 Alpha preview입니다. 필요한 파일과 compatibility 안내는 offline으로 확인했지만, 설치, runtime의 스킬 인식과 첫 review부터 종료 준비 확인까지의 완주 근거가 더 필요합니다. Exact acRelay `v0.1.0-alpha.1`이 필요합니다. |
| `svg-infographic` | 지원 | 지원 | Claude Code와 macOS Codex CLI의 고정 요구사항 검증을 통과했고, Windows 11 ARM64 VM의 새 Codex App 작업도 통과했습니다. 이 결과를 모든 Windows 장치나 파일 시스템에 일반화하지 않으며 Linux 렌더링은 아직 검증하지 않았습니다. |
| `docs-claim-check` | 지원 | 아직 지원을 주장하지 않음 | Claude Code Fable과 Sonnet으로 동작 fixture를 통과했습니다. |
| `github-release-guide` | 지원 | 지원 | Protection fixture를 포함해 두 runtime의 필수 동작이 일치했습니다. Disposable first-public 및 Guided tag-ruleset live test, `v0.5.0`/`v0.6.0` 고정 설치·스킬 인식과 release claim audit도 통과했습니다. |
| `writing-quality-editor` | 지원 | 지원 | 두 runtime에서 네 가지 mode와 21개 scenario를 통과했습니다. Repository dogfood, `v0.7.0` 고정 설치, 파일 일치, 스킬 인식과 최종 공개 문구 검증도 통과했습니다. |

일반적인 용도라면 사용하는 runtime 열이 `지원`인 스킬만 선택하세요. `검증
대기`는 격리된 테스트 repository에서 평가할 수는 있지만, Skillstead가 해당
runtime을 아직 지원한다고 보지는 않는다는 뜻입니다.

## acRelay Alpha preview 설치

acRelay Skill은 이 catalog의 다른 package와 구성이 조금 다릅니다. 별도로
release하는 [acRelay engine](https://github.com/kyungseo/acrelay)을 자연어로
사용하게 하는 wrapper이므로 engine을 먼저 설치하고 Skill 폴더 전체를
복사합니다.

현재 미리 build한 engine은 macOS Apple Silicon(`darwin/arm64`)용입니다. 아래
명령은 exact tag와 release asset이 공개된 뒤에만 동작합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/kyungseo/acrelay/v0.1.0-alpha.1/scripts/install.sh | bash
```

Installer는 exact engine release에 고정돼 있고 binary archive를 checksum으로
검증합니다. Installer 내용을 먼저 확인하는 경로와 고정 version의 `go install`은
[engine 설치 안내](https://github.com/kyungseo/acrelay/blob/v0.1.0-alpha.1/docs/OPERATIONS.ko.md)를
참고하세요. Linux와 Windows core runtime lane은 검증했으며, platform별 Claude
Code·Codex review 검증과 그 결과에 따른 patch는 다음 지원 확대 단계로 남아
있습니다.

이 preview는 `v0.8.0`에 포함되지 않습니다. 아직 공개하지 않은 default branch를
Claude Code에서 평가하려면 다음 명령을 사용합니다.

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/acrelay ~/.claude/skills/
```

Codex에서는 다음 경로에 복사합니다.

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.agents/skills
cp -R /tmp/skillstead/skills/acrelay ~/.agents/skills/
```

특정 repository에서만 사용할 경우 `.claude/skills` 또는 `.agents/skills`에
복사하세요. 새 Skill이 보이지 않으면 runtime을 재시작합니다. Skill은 engine을
설치하거나 update하지 않으며 reviewer를 직접 호출하는 경로로 우회하지 않습니다.

Before/after workflow, 회차 제한, 여러 요청 예시와 single-agent 사용 경계는
[acRelay Skill 안내](../skills/acrelay/README.ko.md)를 참고하세요.

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

아직 공개하지 않은 `acrelay` preview에는 `SKILL.md`, 영문·한국어 README와
`agents/openai.yaml`이 들어 있습니다. 공개된 `v0.8.0` tag에는 포함되지
않습니다. 별도 검증이 끝나기 전에는 지원되는 package로 소개하면 안 됩니다.
이 스킬에는 별도로 설치한 exact acRelay `v0.1.0-alpha.1`이 필요하며, 스킬
자체는 command를 설치하거나 업데이트하지 않습니다. `github-release-guide`
예시를 추측으로 바꾸지 말고 위의 preview 전용 설치 절차를 따르세요.

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
