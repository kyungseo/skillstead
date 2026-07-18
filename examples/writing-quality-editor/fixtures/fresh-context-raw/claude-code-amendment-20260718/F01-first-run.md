# F01 — Post-R2 Amendment First Run (Claude Code)

- Fixture: F01 — README Front Door (intent inference: unnamed ambiguous review `이 README 좀 봐 줘.`)
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key forbidden; complete scenario metadata + user request (skill/mode 미명명)
- Environment/delivery retry: 0
- Material corrective rerun: 0

## First-Run Raw Output

`Assess` 모드로 검토했습니다("봐 줘" 요청이므로 대체 텍스트 없이 진단만 제공합니다).

## Scope And Assumptions

- 문서 프로필: README. 독자: Acme Relay를 처음 평가하는 비개발자.
- 요청은 검토("봐 줘")이므로 수정문 작성 없이 문제 진단과 방향만 제시합니다. 파일은 변경하지 않았습니다.
- 문서 언어는 영어이며, 영어 유지를 가정합니다(신뢰도: 높음).
- 제품에 대한 추가 사실 자료가 제공되지 않았으므로, 내용 보강에 필요한 사실은 발명하지 않고 `Needs Human`으로 넘깁니다.

## Preserve

- 식별자 표기가 정확합니다: `acme-relay start` 명령, `core/`·`adapters/`·`state/` 경로. 어떤 수정에서도 이 식별자들은 그대로 유지해야 합니다.
- 전체 길이가 간결한 점은 README로서 장점입니다. 문제는 분량이 아니라 내용의 선택과 순서입니다.
- Repository Structure의 항목 자체(경로 + 한 줄 설명 형식)는 유지 가치가 있습니다. 문제는 내용이 아니라 위치와 독자 적합성입니다(아래 Findings 참조).

## Findings

**1. [Major] 첫 문장 — 제품 정체성 대신 내부 아키텍처 추상화**
- 위치: "Acme Relay uses a three-surface orchestration model with policy-driven adapter convergence."
- 문제: README의 첫 문장인데 "three-surface orchestration model", "policy-driven adapter convergence"가 아무 설명 없이 등장합니다. 이 제품이 무엇이고 어떤 문제를 해결하는지가 문서 전체에 없습니다.
- 독자 영향: 비개발자 평가자는 첫 문장에서 이해를 포기하거나, 제품을 평가할 근거 자체를 얻지 못합니다. 평가 목적의 첫 접촉 문서로서 핵심 기능이 작동하지 않습니다.
- 권장 방향: 첫 문단을 "이 제품이 누구의 어떤 문제를 어떻게 해결하는가"를 평이한 언어로 서술하는 내용으로 교체하고, 아키텍처 용어는 삭제하거나 첫 사용 시 설명을 붙여 뒤로 이동합니다. 단, 가치 서술에 필요한 사실이 현재 문서에 없으므로 발명할 수 없습니다 — `Needs Human` 1번 참조.

**2. [Major] 정보 순서 — 독자가 제품의 가치를 알기 전에 저장소 내부 구조가 먼저 등장**
- 위치: "Repository Structure" 섹션 전체.
- 문제: README 프로필에서 저장소 구조·유지보수 내부 정보는 독자가 "왜 이 제품이 중요한가"를 이해한 뒤에 와야 합니다. 게다가 이 독자(비개발자)에게 디렉터리 구조는 평가 판단에 거의 기여하지 않습니다.
- 독자 영향: 문서의 가장 좋은 자리를 독자에게 무의미한 정보가 차지하고, 정작 필요한 가치 설명은 존재하지 않습니다.
- 권장 방향: 이 섹션을 문서 하단으로 옮기거나 기여자용 문서로 분리하고, 상단은 제품 소개와 성공 경로에 할당합니다.

**3. [Major] Getting Started — 실행 불가능한 시작 경로**
- 위치: "Run `acme-relay start` and inspect the generated workspace."
- 문제: (a) 설치·전제조건이 없습니다 — 비개발자는 `acme-relay` 명령을 어떻게 얻는지 알 수 없습니다. (b) 성공 신호가 없습니다 — 명령이 잘 실행됐는지 판단할 기준이 없습니다. (c) "inspect the generated workspace"는 무엇을 왜 확인하라는 것인지 알려주지 않습니다.
- 독자 영향: 첫 실행 시도가 시작 단계에서 실패할 가능성이 높고, 실패해도 독자는 원인을 알 수 없습니다.
- 권장 방향: 설치/전제조건 → 실행 명령 → 성공 시 기대 결과 순으로 재구성합니다. 필요한 사실(설치 방법, 성공 기준)이 문서에 없으므로 `Needs Human` 2·3번 참조. `acme-relay start` 명령 자체는 그대로 보존합니다.

**4. [Minor] 제한·지원 경계·다음 문서 부재**
- 문제: README 프로필이 요구하는 제한 사항, 지원 경계, 다음에 읽을 문서 안내가 없습니다.
- 독자 영향: 평가자가 "이 제품이 무엇을 못 하는가"와 "다음 단계"를 판단할 수 없어 평가 신뢰도가 낮아집니다.
- 권장 방향: 제품 이해에 필요한 최소한의 경계 서술과 다음 문서 링크를 추가합니다(추가할 사실은 관리자 확인 필요).

위 Findings 중 의미·주장 변경(fidelity) 문제는 없습니다 — 현재 문서에 틀린 주장이 있다기보다, 독자에게 필요한 내용이 없거나 잘못된 순서로 있는 구조·실행 가능성 문제입니다.

## Needs Human

1. **제품 가치 사실**: Acme Relay가 누구의 어떤 문제를 해결하는지에 대한 사실 자료. 이것 없이는 첫 문단을 안전하게 다시 쓸 수 없습니다.
2. **설치·전제조건**: `acme-relay` 명령을 얻는 방법(설치 절차, 요구 환경). 문서에 없고 발명할 수 없습니다.
3. **성공 기준**: `acme-relay start` 실행 성공 시 독자가 보게 되는 결과와 "generated workspace"에서 확인해야 할 것.
4. **아키텍처 용어 처분**: "three-surface orchestration model" 등 용어를 설명해 유지할지 삭제할지 — 설명하려면 실제 의미 정보가 필요합니다.

## Overall Judgment

현재 README는 비개발자 첫 평가자에게 필요한 세 가지 — 이 제품이 무엇인지, 왜 쓰는지, 어떻게 시작하는지 — 를 모두 제공하지 못합니다. 문장은 짧고 식별자는 정확하지만, 내용 선택이 유지보수자 관점에 맞춰져 있어 대상 독자에게는 사실상 읽히지 않는 문서입니다. 필요한 수정은 문장 다듬기가 아니라 (1) 가치 중심의 도입부 신설, (2) 정보 순서 재배치, (3) 시작 경로의 실행 가능성 확보이며, 이 중 (1)과 (3)은 위 `Needs Human`의 사실 확인이 선행되어야 안전하게 작성할 수 있습니다. 해당 사실을 주시면 `Revise`(개정문 작성)로 이어서 진행할 수 있습니다.
