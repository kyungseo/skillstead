# Skillstead 스킬 설치하기

*[English (canonical)](./INSTALL.md) · 한국어*

Skillstead의 각 스킬은 폴더 하나로 설치할 수 있는 독립 패키지입니다. 검토된 Git 참조를 복제한 뒤
스킬 폴더 전체를 복사하며, 원격 설치 스크립트는 실행하지 않습니다.

## 스킬과 버전 선택하기

스킬마다 릴리스 태그가 다릅니다. 같은 표의 태그와 폴더를 한 쌍으로 사용하세요.

| 스킬 폴더 | 현재 고정 태그 | 지원 실행 환경 |
| --- | --- | --- |
| `svg-infographic` | `svg-infographic/v0.9.0` | Claude Code와 Codex |
| `docs-claim-check` | `docs-claim-check/v0.9.1` | Claude Code |
| `github-release-guide` | `github-release-guide/v0.9.0` | Claude Code와 Codex |
| `writing-quality-editor` | `writing-quality-editor/v0.10.1` | Claude Code와 Codex |

아래 명령은 `github-release-guide`를 설치하는 예시입니다. 다른 스킬을 설치하려면
`github-release-guide/v0.9.0`과 `github-release-guide`를 같은 행에 있는 값으로 함께 바꾸세요.
폴더 이름만 바꾸면 의도한 릴리스 시점과 다른 패키지를 설치할 수 있습니다.

## AI에게 맡기기

어떤 명령과 폴더를 골라야 할지 막막하다면, 아래 요청의 빈칸을 바꿔 Claude Code나 Codex에 붙여
넣으세요.

```text
Skillstead의 <스킬>을 <Claude Code 또는 Codex>용으로 <프로젝트 또는 전역> 범위에 설치해 줘.
docs/INSTALL.ko.md에서 해당 스킬의 현재 고정 태그를 확인하고 스킬 폴더 전체를 복사해 줘.
원격 설치 스크립트는 실행하지 마. 시스템 변경, 파괴적 정리 또는 인증 정보 작업이 필요하면
정확한 작업을 먼저 보여 주고 내 승인을 받아 줘.
```

에이전트는 아래에 안내된 고정 버전과 전체 폴더 복사 방식을 따르고, 변경 전에 승인을 받습니다. 이
요청은 저장소나 시스템 변경을 미리 승인하지 않으며, Skillstead를 원격 설치 프로그램으로 바꾸지도
않습니다.

## 전체 예시: macOS/Linux에서 Claude Code 프로젝트에 설치

아래 예시는 `github-release-guide`를 설치합니다. 대상 저장소의 최상위 디렉터리에서 실행하세요.

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

다른 스킬을 설치하려면 [스킬과 버전 선택하기](#스킬과-버전-선택하기)에 있는 태그와 폴더를 한 쌍으로
바꾸세요. 아래에서 실행 환경·설치 범위·운영체제별 명령을 확인할 수 있습니다.

파일을 직접 내려받아 설치하는 방식은 아직 지원하지 않습니다. 스킬별 zip 파일을 제공하지 않기
때문입니다. 현재 릴리스 검사는 zip 파일이 해당 스킬과 태그에 맞는지, checksum이 일치하는지 확인하지
못하므로, 지금은 검증된 태그를 지정해 `git clone`하는 방법으로 설치해 주세요.

## 실행 환경 지원과 기록된 근거

실행 환경 지원은 스킬별로 검증합니다.

| 스킬 | Claude Code | Codex | 참고 |
| --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | 고정된 fresh-context 요구 사항을 Claude Code와 macOS Codex CLI에서 통과했고, Windows 11 ARM64 VM에서 시작한 새 Codex App 작업도 통과했습니다. 모든 Windows 장치와 파일 시스템을 지원한다는 의미는 아니며 Linux 렌더링은 아직 검증하지 않았습니다 |
| `docs-claim-check` | Supported | Not yet claimed | Claude Code Fable과 Sonnet에서 동작 검증 자료를 통과했습니다 |
| `github-release-guide` | Supported | Supported | 보호 설정 검증 자료를 포함한 핵심 행동 일치 검증, 일회용 first-public과 Guided tag-ruleset 실제 E2E, 고정 `v0.5.0`/`v0.6.0` 프로젝트 설치·발견, 릴리스 주장 검토를 통과했습니다 |
| `writing-quality-editor` | Supported | Supported | 4개 mode, 21개 시나리오의 실행 환경 간 동작 검증, 저장소 문서 적용, 고정 `v0.7.0` 프로젝트 설치, 패키지 일치, 발견과 최종 주장 검토를 통과했습니다 |

위 근거는 각 지원 표시를 확정할 때 기록한 검사 내용을 설명합니다. 과거 근거에 적힌 시나리오 수는
현재 검증 자료의 개수와 다를 수 있습니다. 일반적인 용도에서는 사용하는 실행 환경 열이
`Supported`인 스킬만 복사하세요. 해당 열이 `Not yet claimed`이면 격리된 테스트 저장소에 평가용으로만
복사할 수 있으며, 이것만으로 공개 지원 표시가 성립하지 않습니다.

## 스킬별 요구 사항

### `svg-infographic`

`svg-infographic`을 복사하거나 실행 환경이 스킬을 발견하는 데는 Node.js가 필요하지 않습니다.
Node.js 18 이상은 자동 원본 검사와 패키지에 포함된 렌더링 절차에만 필요합니다. Node.js가 없으면
스킬은 감지한 패키지 관리자로 설치하기 전에 사용자에게 확인합니다. 사용자가 거부해도 수동 원본 검사와
Node 없이 실행하는 Chromium PNG 시각 검토 경로는 사용할 수 있으며, 자동 검사만 사용할 수 없습니다.

## 실행 환경별 설치 경로

| 실행 환경 | 전역 | 프로젝트 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.agents/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

Windows에서 `~`는 `%USERPROFILE%`을 뜻합니다. 새로 복사한 스킬이 발견되지 않으면 실행 환경을
재시작하세요.

아래 명령도 `github-release-guide`를 사용합니다. 다른 지원 스킬을 설치하려면 릴리스 태그와 폴더를
함께 바꾸세요.

## 전역 설치

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.agents/skills
cp -R /tmp/skillstead/skills/github-release-guide ~/.agents/skills/
```

### Claude Code — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.claude\skills\"
```

### Codex — Windows PowerShell

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" "$env:USERPROFILE\.agents\skills\"
```

## 프로젝트 설치

대상 저장소의 최상위 디렉터리에서 실행하세요. 팀원이 저장소를 복제할 때도 이 폴더를 받아야 한다면
복사한 폴더를 커밋하세요.

### Claude Code — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .claude/skills
cp -R /tmp/skillstead/skills/github-release-guide .claude/skills/
```

### Codex — macOS/Linux

```bash
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p .agents/skills
cp -R /tmp/skillstead/skills/github-release-guide .agents/skills/
```

### Windows PowerShell

Claude Code는 `.claude\skills`, Codex는 `.agents\skills`를 사용합니다.

```powershell
git clone --depth 1 --branch github-release-guide/v0.9.0 https://github.com/kyungseo/skillstead.git "$env:TEMP\skillstead"
New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "$env:TEMP\skillstead\skills\github-release-guide" ".agents\skills\"
```

## 평가용으로 최신 개발 상태 사용하기

현재 기본 브랜치를 복사하려면 `--branch github-release-guide/v0.9.0`을 빼세요. 평가할 때는 유용하지만
팀에서 재현할 수 있는 설치 방식은 아닙니다. 팀 설치와 릴리스 근거에는 고정 태그를 권장합니다.

## 패키지 전체 유지하기

폴더 전체를 그대로 유지하세요.

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

설치된 영문·한국어 README는 작업 흐름을 사용자 관점에서 설명합니다. 저장소에만 있는 검증 자료와
다이어그램은 Skillstead 저장소의 `examples/github-release-guide/`에 남으며 스킬과 함께 복사되지
않습니다.

`writing-quality-editor`에도 같은 전체 폴더 규칙이 적용됩니다. 패키지에는 `CHANGELOG.md`,
`LICENSE.txt`, `SKILL.md`, 영문·한국어 README, `agents/openai.yaml`, 참고 파일 3개가 들어 있습니다.
저장소 전용 검증 자료는 `examples/writing-quality-editor/`에 남습니다.

## 삭제된 파일을 남기지 않고 업데이트하기

`cp -R`을 사용하면 원본에서 삭제된 파일이 설치 위치에는 남을 수 있습니다. 빠진 파일 없이 정확히
업데이트하려면
다음 순서로 진행하세요.

1. 원하는 태그를 새 임시 디렉터리에 복제합니다.
2. 설치된 대상 스킬 폴더만 삭제합니다.
3. 새 스킬 폴더 전체를 복사합니다.
4. 필요하면 실행 환경을 재시작하고 스킬이 발견되는지 확인합니다.
5. 프로젝트 설치라면 변경 내용을 검토하고 커밋합니다.

관련 없는 스킬이 들어 있을 수 있는 상위 `skills` 디렉터리는 삭제하지 마세요.

## 제거

설치된 스킬 폴더만 삭제하세요.

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

제거하면 로컬 실행 환경에서 해당 스킬을 더 이상 발견하지 못합니다. 이전에 승인하고 수행한 GitHub
릴리스나 저장소 변경은 되돌리지 않습니다.
