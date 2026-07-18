# F17 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F17 — Compose Korean Onboarding Directly From A Brief
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + supplied facts inline
- Environment/delivery retry: 0
- Material corrective rerun: 0

## First-Run Raw Output

`Compose` 모드로 진행했습니다. Skill 규칙에 따라 review rubric을 로드했고, 제공된 사실만 invariant ledger로 삼아 한국어로 직접 작성했습니다.

## Drafted Text

---

# Acme Vault 시작하기

Acme Vault 설치부터 첫 폴더 초기화까지 안내합니다. 초기화 단계에서는 어떤 데이터도 업로드되지 않으니, 부담 없이 순서대로 따라 하면 됩니다.

현재 동작이 확인된 환경은 macOS 15입니다. Windows와 Linux에서는 아직 검증되지 않았습니다.

## 1. 설치

Homebrew로 설치합니다.

```
brew install acme-vault
```

## 2. 폴더 초기화

`~/Documents` 폴더를 초기화합니다.

```
acme-vault init ~/Documents
```

초기화가 끝나면 `.acme-vault/config.yml` 설정 파일이 생성됩니다. 이 파일이 만들어졌다면 초기화는 정상적으로 완료된 것입니다.

## 3. 업로드는 직접 실행하기 전까지 일어나지 않습니다

초기화를 마쳐도 데이터는 자동으로 업로드되지 않습니다. `acme-vault push`를 직접 실행하기 전까지는 어떤 데이터도 업로드되지 않으므로, 준비가 되었을 때 다음 명령으로 업로드를 시작하면 됩니다.

```
acme-vault push
```

---

## Source Notes

- 사용한 사실: `brew install acme-vault` 설치, `acme-vault init ~/Documents` 초기화, 초기화 시 `.acme-vault/config.yml` 생성, `acme-vault push` 실행 전까지 데이터 업로드 없음, 검증 플랫폼 macOS 15(Windows/Linux 미검증). 다섯 항목 모두 본문에 반영했습니다.
- 식별자(`brew install acme-vault`, `acme-vault init ~/Documents`, `.acme-vault/config.yml`, `acme-vault push`, macOS 15)는 원형 그대로 유지했습니다.
- "업로드는 push 실행 시 시작된다"는 문장은 "push 전까지 업로드 없음"이라는 제공 사실에서 직접 도출한 범위로만 서술했고, 업로드 대상·방식은 언급하지 않았습니다.
- 제한 사항(미검증 플랫폼)은 완곡하게 바꾸지 않고 "아직 검증되지 않았습니다"로 그대로 두었습니다.

## Needs Human

- 업로드 대상(어디로 업로드되는지)이 브리프에 없어 본문에서 다루지 못했습니다. 온보딩 독자가 자연스럽게 궁금해할 지점이므로, 사실이 확보되면 3번 섹션에 보강하는 것을 권합니다.
- 실패 상태와 복구 절차(초기화 실패 시 대처, config 재생성 등)가 제공되지 않아 온보딩 프로파일의 failure/recovery 섹션을 생략했습니다. 포함 여부와 내용은 사람 판단이 필요합니다.

## Assumptions And Omissions

- `brew` 명령 사용을 근거로 Homebrew가 설치되어 있다고 가정했습니다(신뢰도 높음). Homebrew 설치 절차 자체는 제공되지 않아 생략했습니다.
- `.acme-vault/config.yml`의 정확한 생성 위치가 브리프에 명시되지 않아 경로를 추가 해석 없이 그대로 표기했습니다.
- Acme Vault의 용도·기능 설명(무엇을 보관/동기화하는지)은 제공된 사실에 없어 의도적으로 서술하지 않았습니다.
