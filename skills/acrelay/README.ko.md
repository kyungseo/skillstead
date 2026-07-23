# acRelay Skill

[English](./README.md) · **한국어**

이 Skill은 독립된
[acRelay engine](https://github.com/kyungseo/acrelay)을 쉽게 사용하도록 돕습니다.
Engine은 acRelay 전용 daemon, server 또는 database 없이 실행 파일 하나로
배포됩니다. Skill이 engine을 다시 구현하는 것이 아니라 자연어 요청을 engine의
review workflow로 연결합니다.

계획, 문서, 파일 하나, 선택한 구현 파일 또는 지정한 directory tree를 red-team
review해 달라고 요청할 수 있습니다. acRelay는 별도의 Claude Code 또는 Codex CLI
reviewer를 시작하고, 검토한 revision과 finding을 비공개 기록에 남기며, 모든
finding에 driver 응답을 요구하고, 승인과 Close는 사람 owner에게 맡깁니다.

## 어떤 수작업을 줄이는가

수동으로 진행하면 매 회차마다 요청을 reviewer에게 복사하고 결과를 다시 driver에게
복사해야 합니다. 3회차면 최대 6번을 복사·붙여넣게 됩니다.

| 사용 전 | acRelay Skill 사용 |
| --- | --- |
| Agent 사이에서 매 요청과 결과를 전달 | 자연어로 시작하면 Skill이 engine 호출 |
| 검토한 revision과 남은 finding을 직접 기억 | Revision, finding과 응답을 비공개 기록 하나에 보관 |
| 누군가 동의할 때까지 대화가 이어짐 | 1–5회(기본 3회) 안에서 검토하고 owner에게 결정 반환 |

One-shot은 범위가 정해진 review objective를 필요할 때 한 번 시작한다는 뜻입니다.
Prompt나 reviewer 회차가 한 번이라는 뜻은 아닙니다. acRelay는 호출할 때만
실행하며 백그라운드 service로 계속 동작하지 않습니다.

## 공개 상태

이 Skill은 flagship Alpha preview이며 아직 Claude Code나 Codex에서 지원되는
package로 공개하지 않았습니다. 필요한 파일, compatibility 안내와 offline 요청
routing은 지금 확인할 수 있습니다. 각 runtime에서 설치하고 Skill이 인식되는지
확인한 뒤 첫 review부터 종료 준비 확인까지 완주하는 검증은 아직 남아 있습니다.

## Engine 설치

Skill을 사용하려면 `PATH`에서 exact `v0.1.0-alpha.1` engine을 실행할 수 있어야
합니다. 현재 미리 build해 제공하는 binary는 macOS Apple
Silicon(`darwin/arm64`)용입니다.
아래 명령은 exact tag와 release asset이 공개된 뒤에만 동작합니다. 아직
열리지 않았다면 `latest`로 바꾸지 말고 중단하세요.

```sh
curl -fsSL https://raw.githubusercontent.com/kyungseo/acrelay/v0.1.0-alpha.1/scripts/install.sh | bash
```

Installer는 release에 고정돼 있으며 binary archive를 공개 checksum과 대조합니다.
실행 전에 installer 내용을 확인하거나 고정 version의 `go install`을 사용하려면
[acRelay 설치 안내](https://github.com/kyungseo/acrelay/blob/v0.1.0-alpha.1/docs/OPERATIONS.ko.md)를
따르세요.

Linux와 Windows core runtime lane은 이미 검증했습니다. Platform별 Claude
Code·Codex review는 다음 지원 확대 단계에서 검증하고, 필요한 patch는 근거 검토
후 release할 예정입니다. 그전까지 engine은 검증하지 않은 platform 조합에서
reviewer dispatch 전에 중단합니다.

## Skill preview 설치

Preview는 공개된 Skillstead `v0.7.0` tag에 포함되지 않습니다. 아직 공개하지 않은
변경을 의도적으로 평가할 때만 default branch를 사용하세요. `SKILL.md`만 복사하지
말고 `skills/acrelay` 폴더 전체를 복사합니다.

### Claude Code

```sh
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p "$HOME/.claude/skills"
cp -R /tmp/skillstead/skills/acrelay "$HOME/.claude/skills/"
```

### Codex

```sh
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p "$HOME/.agents/skills"
cp -R /tmp/skillstead/skills/acrelay "$HOME/.agents/skills/"
```

새로 복사한 Skill이 보이지 않으면 agent host를 재시작하세요. 프로젝트별 설치
경로, Windows 복사 명령, 깨끗한 update와 제거는
[Skillstead 설치 안내](../../docs/INSTALL.ko.md)를 참고하세요.

Skill은 engine을 자동으로 설치하거나 update하지 않습니다. Engine이 없거나
version이 다르면 이유를 설명하고 중단하며, acRelay를 우회해 reviewer를 직접
호출하지 않습니다.

## 요청 예시

### 계획에 반대 의견 받기

```text
acRelay로 Claude가 이 계획을 red-team하게 해줘. Review 기록은 비공개로 보관하고, 최대 3회차 안에서 진행한 뒤 owner가 결정할 내용만 보여줘.
```

### 파일 하나 review

```text
acRelay로 Codex가 이 파일을 review하게 해줘. 무엇을 확인했고 어떤 finding을 냈는지 기록하되 review는 종료하지 마.
```

### 구현 결과 review

```text
acRelay로 현재 checkout한 구현 파일들을 승인된 계획에 맞춰 review해줘. 종료 준비 요약을 보여주기 전에 모든 finding에 driver가 응답하게 해줘.
```

acRelay v0.1.0-alpha.1은 파일 하나, 명시한 여러 파일 또는 지정한 subtree를
받습니다. PR URL, staged patch, commit range 또는 branch comparison을 직접
선택하는 기능은 아직 없습니다. 원하는 revision을 checkout한 뒤 파일이나 subtree를
지정하세요.

### Agent 생태계 하나만 사용할 때

```text
지금 Claude Code에서 작업 중이야. acRelay로 별도의 Claude Code CLI reviewer를 사용하고, same-vendor review라 두 context에 같은 맹점이 있을 수 있다는 점도 기록해줘.
```

주로 agent 하나만 사용하는 사람도 별도의 CLI reviewer로 red-team을 가동할 수
있고, 지원하는 경우 같은 vendor의 별도 session도 사용할 수 있습니다. 다만 이는
host-native subagent 지원이 아닙니다. Host가 만든 subagent 결과를 직접 받아들이는
기능은 안정적인 host interface와 결과 형식이 마련될 때까지 지원하지 않으며
fail-closed합니다.

### 현재 사용할 수 있는 agent 경로

Alpha에서 가장 자연스러운 경로는 다음과 같습니다.

```text
Codex App, Claude Code CLI 또는 Codex CLI가 driver
  → acRelay Skill
  → 설치된 acrelay binary
  → Claude Code CLI 또는 Codex CLI가 reviewer
```

- Claude Code CLI와 Codex CLI는 검증된 engine platform 조합에서 driver 또는
  reviewer 역할을 맡을 수 있습니다.
- Codex App은 driver로서 로컬 Skill과 binary를 호출할 수 있지만 reviewer
  adapter는 아닙니다.
- Claude App에는 acRelay를 직접 사용하는 경로가 없습니다.
- Antigravity는 향후 driver 후보이지만 현재 driver 경로와 reviewer adapter
  모두 지원하지 않습니다.

Engine은 두 agent가 독립적이라고 추정하지 않습니다. 선언하거나 관측한 관계를
그대로 기록하고 해당 caution을 보여줍니다.

### 종료하지 않고 결과 확인

```text
기존 reviewer로 이 acRelay review를 이어가고 종료 준비 요약을 보여줘. 최종 결정과 Close는 owner에게 남겨줘.
```

## Review 전에 확인하는 내용

- Review할 정확한 파일, 파일 묶음 또는 subtree
- Review 질문
- Reviewer로 사용할 Claude Code 또는 Codex
- Owner가 누구인지
- 비공개 Markdown review 기록을 둘 위치
- Review 내용, 해석된 경로와 metadata를 선택한 reviewer service로 보내도 되는지
- Driver와 reviewer context의 관계
- 기본 3회차 제한을 사용할지

Reviewer CLI는 provider network와 model token을 사용할 수 있습니다. Review
기록이 로컬에 있다는 말은 model도 로컬에서 실행된다는 뜻이 아닙니다.

## 지켜지는 경계

- Review state, evidence, 복구, cleanup과 Close는 Skill이 아니라 binary가
  담당합니다.
- acRelay는 reviewer 실행만 자동화하며 driver 응답이나 owner 결정은 자동화하지
  않습니다.
- 별도의 context나 reviewer vendor를 사용해도 독립적인 판단이 증명되지는
  않습니다.
- 기록된 발췌문은 이해, 완전성 또는 정확성을 증명하지 않습니다.
- `briefing`은 현재 기록을 요약할 뿐 approval이 아닙니다.
- `UNKNOWN`으로 기록된 reviewer 실행은 자동으로 다시 시도하지 않습니다.
- Binary나 Skill을 제거해도 `~/.acrelay`, 비공개 review 기록 또는 reviewer
  vendor data는 삭제되지 않습니다.

정확한 command, format, platform 근거와 복구 규칙은
[acRelay engine 문서](https://github.com/kyungseo/acrelay)를 참고하세요.
