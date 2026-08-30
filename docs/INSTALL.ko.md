<a id="top"></a>

# Skillstead 스킬 설치하기

*[English (canonical)](./INSTALL.md) · 한국어*

Skillstead의 각 스킬은 폴더 하나로 설치하는 독립 패키지입니다. 가장 빠른 방법은 원하는 스킬 섹션으로
이동해 현재 고정 버전의 설치 요청을 지원 실행 환경에 붙여 넣는 것입니다. 직접 복사해야 할 때를 위한
파일 시스템 명령도 문서 뒤쪽에 유지합니다.

## 스킬 바로가기

- [`svg-infographic`](#svg-infographic) — 편집 가능한 기술 SVG와 검증된 PNG
- [`docs-claim-check`](#docs-claim-check) — 근거 범위가 분명한 공개 주장 검토
- [`github-release-guide`](#github-release-guide) — 승인 단계를 지키는 GitHub 릴리스 안내
- [`writing-quality-editor`](#writing-quality-editor) — 의미를 보존하는 자연스러운 사용자 문서
- [`street-portrait-artist`](#street-portrait-artist) — Street Caricature와 Romance Watercolor 초상화

참고 섹션:

- [파일 시스템에서 직접 설치하기](#파일-시스템에서-직접-설치하기)
- [실행 환경 지원과 기록된 근거](#실행-환경-지원과-기록된-근거)
- [최신 개발 상태 평가하기](#최신-개발-상태-평가하기)
- [업데이트·제거·패키지 무결성](#업데이트제거패키지-무결성)

## 현재 릴리스

스킬마다 릴리스 태그가 다릅니다. 아래 복사·붙여넣기 요청은 릴리스 태그와 전체 스킬 폴더를 하나의
고정 GitHub 경로로 묶어, 서로 다른 버전이 섞이지 않게 합니다.

| 스킬 | 현재 고정 태그 | 지원 실행 환경 |
| --- | --- | --- |
| `svg-infographic` | `svg-infographic/v0.11.0` | Claude Code와 Codex |
| `docs-claim-check` | `docs-claim-check/v0.9.1` | Claude Code |
| `github-release-guide` | `github-release-guide/v0.9.0` | Claude Code와 Codex |
| `writing-quality-editor` | `writing-quality-editor/v0.13.0` | Claude Code와 Codex |
| `street-portrait-artist` | `street-portrait-artist/v0.1.1` | ChatGPT와 Codex |

기본 요청은 개인 전역 범위에 설치합니다. 파일 시스템에 설치하는 스킬을 현재 저장소 안에서만 쓰려면
`전역으로`를 `현재 프로젝트에`로 바꾸세요. ChatGPT는 제품 안에서 스킬을 관리하므로 이 문서의 파일
시스템 설치 범위를 사용하지 않습니다.

---

<a id="svg-infographic"></a>

## `svg-infographic`

- 현재 릴리스: `svg-infographic/v0.11.0`
- 지원 실행 환경: Claude Code와 Codex
- 패키지 안내: [`skills/svg-infographic/README.ko.md`](../skills/svg-infographic/README.ko.md)

Claude Code나 Codex에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 Skillstead 스킬을 전역으로 설치해 줘: https://github.com/kyungseo/skillstead/tree/svg-infographic/v0.11.0/skills/svg-infographic
```

`svg-infographic`을 복사하거나 실행 환경이 발견하는 데는 Node.js가 필요하지 않습니다. Node.js 18 이상은
자동 원본 검사와 패키지에 포함된 렌더링 절차에만 필요합니다. Node.js를 사용할 수 없으면 문서화된 수동
원본 검사와 Node 없이 실행하는 Chromium 시각 검토 경로를 유지합니다.

[스킬 목록으로 돌아가기](#스킬-바로가기)

---

<a id="docs-claim-check"></a>

## `docs-claim-check`

- 현재 릴리스: `docs-claim-check/v0.9.1`
- 지원 실행 환경: Claude Code
- 패키지 안내: [`skills/docs-claim-check/README.ko.md`](../skills/docs-claim-check/README.ko.md)

Claude Code에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 Skillstead 스킬을 전역으로 설치해 줘: https://github.com/kyungseo/skillstead/tree/docs-claim-check/v0.9.1/skills/docs-claim-check
```

이 스킬은 아직 Codex 지원을 표시하지 않습니다. 다른 실행 환경에 평가용으로 설치하더라도 그것만으로
공개 지원 근거가 되지는 않습니다.

[스킬 목록으로 돌아가기](#스킬-바로가기)

---

<a id="github-release-guide"></a>

## `github-release-guide`

- 현재 릴리스: `github-release-guide/v0.9.0`
- 지원 실행 환경: Claude Code와 Codex
- 패키지 안내: [`skills/github-release-guide/README.ko.md`](../skills/github-release-guide/README.ko.md)

Claude Code나 Codex에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 Skillstead 스킬을 전역으로 설치해 줘: https://github.com/kyungseo/skillstead/tree/github-release-guide/v0.9.0/skills/github-release-guide
```

설치는 재사용 가능한 안내만 추가합니다. 저장소 공개 전환, tag, GitHub Release, 설정 변경, 파괴적 정리,
인증 정보 작업을 승인하지 않습니다.

[스킬 목록으로 돌아가기](#스킬-바로가기)

---

<a id="writing-quality-editor"></a>

## `writing-quality-editor`

- 현재 릴리스: `writing-quality-editor/v0.13.0`
- 지원 실행 환경: Claude Code와 Codex
- 패키지 안내: [`skills/writing-quality-editor/README.ko.md`](../skills/writing-quality-editor/README.ko.md)

Claude Code나 Codex에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 Skillstead 스킬을 전역으로 설치해 줘: https://github.com/kyungseo/skillstead/tree/writing-quality-editor/v0.13.0/skills/writing-quality-editor
```

패키지에는 영문·한글 작성과 검토에 필요한 참고 문서가 함께 들어 있습니다. `SKILL.md`만 따로 복사하지
말고 폴더 전체를 설치하세요.

[스킬 목록으로 돌아가기](#스킬-바로가기)

---

<a id="street-portrait-artist"></a>

## `street-portrait-artist`

- 현재 릴리스: `street-portrait-artist/v0.1.1`
- 지원 실행 환경: ChatGPT와 Codex
- 패키지 안내: [`skills/street-portrait-artist/README.ko.md`](../skills/street-portrait-artist/README.ko.md)

ChatGPT에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 street-portrait-artist 스킬을 설치해 줘: https://github.com/kyungseo/skillstead/tree/street-portrait-artist/v0.1.1/skills/street-portrait-artist
```

Codex에 다음 한 줄을 붙여 넣으세요.

```text
다음 고정 GitHub 폴더의 Skillstead 스킬을 전역으로 설치해 줘: https://github.com/kyungseo/skillstead/tree/street-portrait-artist/v0.1.1/skills/street-portrait-artist
```

ChatGPT가 설치 확인을 요청할 수 있습니다. 현재 대화에서 이전에 캐시한 버전이 계속 발견되면 설치 후
새 대화를 시작하세요. ChatGPT의 사용 가능 여부와 workspace 권한은 제품에서 관리합니다.

[스킬 목록으로 돌아가기](#스킬-바로가기)

---

## 파일 시스템에서 직접 설치하기

직접 명령을 실행하고 싶거나 agent가 복사를 완료할 수 없을 때 사용하는 참고 절차입니다. 정확한 검토
태그를 복제한 뒤 스킬 폴더 전체를 복사하며, 원격 설치 스크립트는 실행하지 않습니다.

### 실행 환경별 경로

| 실행 환경 | 개인 전역 경로 | 프로젝트 경로 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `<repo>/.claude/skills/<name>/` |
| Codex | `~/.codex/skills/<name>/` | `<repo>/.agents/skills/<name>/` |

Windows에서 `~`는 `%USERPROFILE%`을 뜻합니다. 새로 복사한 스킬이 발견되지 않으면 새 세션을 시작하세요.

기본 설치 경로는 각 스킬 섹션의 복사·붙여넣기 요청입니다. 정확한 shell 명령이 필요하면 아래의
`github-release-guide` 예시를 펼치세요. 실행 환경과 범위에 맞는 예시 하나만 깨끗한 임시 경로에서
실행하세요. 다른 스킬은 위에 표시된 태그와 폴더를 한 쌍으로 바꿉니다.

<details>
<summary>macOS/Linux와 Windows 명령 모두 보기</summary>

### 개인 전역 설치

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

### 프로젝트 설치

대상 저장소의 최상위 디렉터리에서 실행하세요.

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

현재 스킬별 zip 파일은 게시하거나 checksum으로 검증하지 않습니다. 고정 tag를 지정한 clone이 재현 가능한
직접 설치 경로입니다.

[맨 위로](#top)

## 실행 환경 지원과 기록된 근거

실행 환경 지원은 스킬별로 검증합니다.

| 스킬 | Claude Code | Codex | 기타 | 근거 범위 |
| --- | --- | --- | --- | --- |
| `svg-infographic` | Supported | Supported | — | 고정 fresh-context 요구 사항을 Claude Code와 macOS Codex CLI에서 통과했고 Windows 11 ARM64 VM의 새 Codex App 작업도 통과했습니다. Linux 렌더링과 모든 Windows 장치·파일 시스템을 지원한다는 의미는 아닙니다 |
| `docs-claim-check` | Supported | Not yet claimed | — | Claude Code Fable과 Sonnet에서 동작 검증 자료를 통과했습니다 |
| `github-release-guide` | Supported | Supported | — | 핵심 행동 일치, 일회용 first-public과 Guided tag-ruleset 실제 E2E, 고정 설치·발견, 릴리스 주장 검토를 통과했습니다 |
| `writing-quality-editor` | Supported | Supported | — | 4개 mode의 실행 환경 간 동작, 저장소 문서 적용, 고정 설치, 패키지 일치, 발견과 주장 종결을 확인했습니다 |
| `street-portrait-artist` | Not applicable | Supported | ChatGPT: Supported | 공개된 `0.1.0` package의 새 설치·발견·호출·합성 reference-image 생성·fail-visible 크기 fallback·결과 전달로 실행 환경 지원을 확인했으며, 현재 설치 릴리스는 `0.1.1`입니다 |

이전 릴리스에서 기록한 근거가 제한된 실행 능력을 뒷받침할 수 있지만, 해당 릴리스가 현재 설치 대상이라는
뜻은 아닙니다. 일반적인 용도에서는 사용하는 실행 환경이 `Supported`인 스킬을 선택하세요. `Not yet
claimed`는 평가용이라는 뜻이며 공개 지원 표시는 아닙니다.

`street-portrait-artist`는 ChatGPT의 제품 관리형 스킬 interface를 사용하므로 위 파일 시스템 경로에 포함하지
않습니다. ChatGPT와 Codex에서 관찰한 결과는 `1122 x 1402 px`였고 exact `1080 x 1350 px` export를 사용할
수 없다는 사실을 숨기지 않고 보고했습니다. 이 근거는 실행 환경 지원과 정직한 fallback을 보여 주지만,
결정론적 얼굴 유사성이나 폭넓은 시각 품질 성숙도를 보장하지 않습니다.

[맨 위로](#top)

## 최신 개발 상태 평가하기

평가할 때만 고정 tag 대신 기본 branch를 사용할 수 있습니다. 이 방식은 팀이 재현할 수 있는 설치가 아니며
위의 현재 릴리스 링크를 대체하지 않습니다. 일반 사용, 팀 설치, 릴리스 근거에는 고정 tag를 권장합니다.

[맨 위로](#top)

## 업데이트·제거·패키지 무결성

### 패키지 전체 유지하기

`skills/<name>/` 폴더 전체를 복사하세요. 패키지에는 `SKILL.md`, 영문·한글 README, changelog, license,
실행 환경 metadata, script, 필수 참고 문서가 들어갈 수 있습니다. `examples/` 아래의 저장소 전용 fixture와
gallery asset은 해당 스킬 안내에서 별도로 명시하지 않는 한 설치 패키지에 포함되지 않습니다.

### 오래된 파일을 남기지 않고 업데이트하기

`cp -R`은 원본에서 삭제된 파일을 설치 위치에 남길 수 있습니다. 정확히 업데이트하려면 다음 순서를 따르세요.

1. 원하는 tag를 새 임시 디렉터리에 복제합니다.
2. 설치된 대상 스킬 폴더만 제거합니다.
3. 새 스킬 폴더 전체를 복사합니다.
4. 새 실행 환경 세션을 시작하고 발견된 버전을 확인합니다.
5. 프로젝트 설치라면 변경 내용을 검토하고 커밋합니다.

관련 없는 스킬이 들어 있을 수 있는 상위 skills 디렉터리는 제거하지 마세요.

### 제거

설치된 대상 폴더만 제거하세요.

```text
Claude Code 개인: ~/.claude/skills/<name>
Claude Code 프로젝트: <repo>/.claude/skills/<name>
Codex 개인: ~/.codex/skills/<name>
Codex 프로젝트: <repo>/.agents/skills/<name>
```

제거하면 로컬 실행 환경의 발견 상태만 바뀝니다. 이전에 승인하고 수행한 저장소나 GitHub 변경은 되돌리지
않습니다.

[맨 위로](#top)
