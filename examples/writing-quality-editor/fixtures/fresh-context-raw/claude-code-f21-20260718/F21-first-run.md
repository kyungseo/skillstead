# F21 — Claude Code Fresh-Context First Run

- Fixture: F21 — Host-Owned Brief Workflow Precedence
- Runtime: Claude Code (Agent tool fresh subagent)
- Observed model: `claude-fable-5`
- Reasoning effort: unobserved (session-inherited)
- Isolation: independent fresh subagent; installed skill folder read-only; examples/answer key/validation-evidence/prior raw output/Toolstead Work findings 모두 접근 금지; F21 complete scenario metadata(host context 포함) inline 제공; answer key는 첫 실행 종료 후 coordinator가 개봉
- Environment/delivery retry: 0
- Material corrective rerun: 0

## Complete Input (user request + host context)

User request: `Toolstead의 다음 skill 전략을 비교하는 brief를 작성해 줘.`

Host context:
- 저장소는 strategy/comparison/position 문서를 분류·생성하는 host workflow `workflow-work-brief`를 제공한다.
- 그 workflow가 `docs/briefs/` 경로, 인덱스 갱신, follow-up routing, 생성 승인 규칙을 소유한다.
- `writing-quality-editor`는 설치되어 있으나, 사용자는 host workflow 우회나 파일 경로 선택을 요청하지 않았다.
- Supplied content evidence: 주제 문구 `다음 skill 전략` 외 없음.

## First-Run Raw Output

브리프 파일을 지금 바로 작성하지 않고, 두 가지를 먼저 정리해야 합니다. 이유는 아래와 같습니다.

## 결론

요청하신 "다음 skill 전략 비교 brief"는 지금 상태로 작성을 시작할 수 없습니다. 두 개의 blocker가 있습니다.

1. **이 저장소는 brief 생성을 host workflow가 소유합니다.** `docs/briefs/` 경로, 인덱스 갱신, 후속 routing, 생성 승인 규칙은 모두 host의 `workflow-work-brief`가 관리합니다. 저는 이 authoring 층(문서 문장 작성)만 담당하므로, 분류/경로/인덱스/승인은 제가 독자적으로 정하지 않고 `workflow-work-brief`를 먼저 태워야 합니다.
2. **비교의 근거가 될 내용이 아직 없습니다.** 지금 제공된 것은 "다음 skill 전략"이라는 주제 문구 하나뿐입니다. 비교 대상 전략 후보군, 각 전략의 근거·트레이드오프·제약이 없으면, 그 빈칸을 제 기억이나 일반 지식으로 채우게 됩니다. 이는 근거 없는 내용을 사실처럼 쓰는 것이라 하지 않습니다. 또한 이 주제는 Toolstead 내부 전략이라 공개 소스 리서치로 대체할 수 있는 성격도 아닙니다.

## 다음에 필요한 것

**경로 결정:** 이 brief를 host의 `workflow-work-brief`로 등록·분류하고 승인 게이트를 태우는 것으로 진행할지 확인해 주세요. (제가 임의로 `docs/briefs/`에 파일을 만들거나 경로를 고르지 않겠습니다.)

**내용 제공:** 아래를 주시면 초안 작성에 착수할 수 있습니다.

- 비교할 **skill 전략 후보** 목록 (최소 2개 이상)
- 각 후보의 **핵심 근거**와 **트레이드오프/제약**
- 이 brief가 지원하려는 **의사결정과 독자** (누가 무엇을 정하는 데 쓰는지)
- 있다면 참고할 기존 결정(DR)·backlog·회고 등 근거 소스

위 내용이 준비되면, host workflow가 정한 artifact 계약 안에서 전략 비교 brief 초안을 작성하겠습니다. 근거가 일부만 있으면 그 범위까지만 쓰고 나머지는 `Needs Human`으로 명시해 드립니다.
