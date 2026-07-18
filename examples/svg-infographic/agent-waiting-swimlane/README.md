<!-- 한국어는 아래 -->

# Example: Agent Waiting-Alert Swimlane

A two-lane swimlane flow produced by `svg-infographic`, in English and Korean.
The top lane tracks an **agent session's states** (working → waiting → resumed →
done); the bottom lane tracks the **user's actions** in parallel. Dashed
cross-lane arrows carry the waiting alert down and the one-click approval back
up — making the point that with alerts, the workflow never stalls at an approval.

| English | 한국어 |
| --- | --- |
| ![Agent waiting-alert swimlane (EN)](./agent-waiting-swimlane.en.png) | ![Agent 대기 알림 swimlane (KO)](./agent-waiting-swimlane.ko.png) |

## What this example shows

- **Flow archetype, swimlane variant** — two parallel lanes with **stage columns
  aligned across lanes** (same x-positions, computed once in the layout pass)
- **Lane pills** in a left gutter (saturated fill, light on-accent text)
- **Numbered step badges** on the primary lane only (sequence matters there)
- The key tension step (**Waiting**) emphasized with an amber family, stroke + shadow
- **Cross-lane dashed arrows with labels beside the lines** (alert down, approval up)
- A **legend** distinguishing state transitions from cross-lane alert/approval
- One composed icon (bell) extending the built-in set with the same 24×24 line grammar

## Output files

| File | Role |
| --- | --- |
| `agent-waiting-swimlane.en.svg` | English source (editable) |
| `agent-waiting-swimlane.en.png` | English 2× export (2800×1640) |
| `agent-waiting-swimlane.ko.svg` | Korean source (editable) |
| `agent-waiting-swimlane.ko.png` | Korean 2× export (2800×1640) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`). Both language variants share identical geometry — only the text differs.

## Provenance

Sample content is synthetic. Names, identifiers, tools, and environments are
placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to draw a swimlane flow with two lanes: "Agent state"
on top (Working → Waiting → Resumed → Done) and "User" below (Deep in
other work → One-click approve → Stays in flow → Reviews results). Align
the stage columns across lanes. Emphasize the Waiting step (amber) as the
key tension, and connect the lanes at that column with two dashed arrows:
a "waiting alert" going down and a "one-click approve" going back up.
Number the agent lane steps, add a legend (solid = state transition,
dashed = cross-lane alert/approval), and give it a conclusion title like
"Waiting Alerts Erase Agent Idle Time". Export SVG + 2× PNG.
```

---

# 예제: Agent 대기 알림 Swimlane

`svg-infographic`으로 영문판과 한국어판을 만든 두 줄짜리 swimlane 흐름도입니다. 위쪽은
**에이전트 세션 상태**(작업 중 → 승인 대기 → 작업 재개 → 완료), 아래쪽은 같은 시간대의
**사용자 행동**을 보여줍니다. 줄 사이의 점선 화살표는 대기 알림을 사용자에게 보내고 원클릭
승인을 에이전트에 돌려주는 흐름을 나타냅니다. 알림이 있으면 작업이 승인 대기에서 멈추지 않는다는
결론을 전달합니다.

## 이 예제가 보여주는 것

- **Swimlane으로 변형한 흐름도** — 두 줄의 단계를 같은 가로 위치에 맞췄습니다. 위치는 레이아웃
  계산 단계에서 한 번 정한 뒤 양쪽에 함께 사용했습니다.
- 왼쪽의 **구분 라벨**에 진한 배경과 밝은 글자 적용
- 순서가 중요한 에이전트 줄에만 **단계 번호** 표시
- 핵심 긴장 지점인 **승인 대기**를 호박색 계열, 테두리와 그림자로 강조
- 알림은 아래로, 승인은 위로 이어지는 **줄 사이의 점선 화살표**에 설명 라벨 배치
- 상태 변화와 줄 사이의 알림·승인을 구분하는 **범례**
- 내장 아이콘과 같은 24×24 선형 규칙으로 조합한 종 아이콘

## 프롬프트 (한국어)

```text
svg-infographic으로 두 lane swimlane flow를 그려줘. 위 lane은 "AGENT 상태"
(작업 중 → 승인 대기 → 작업 재개 → 완료), 아래 lane은 "사용자"(다른 작업 집중
→ 원클릭 승인 → 몰입 유지 → 결과 리뷰). 두 lane의 stage column을 같은 x좌표로
정렬해줘. 핵심 긴장인 승인 대기 단계를 amber로 강조하고, 그 column에서 두
lane을 점선 화살표 두 개로 연결: "waiting 알림"은 아래로, "원클릭 승인"은 다시
위로. agent lane에는 번호 badge, 하단에 legend(실선 = 상태 전이, 점선 = lane 간
알림·승인). 제목은 "대기 알림이 agent 유휴 시간을 없앤다"처럼 결론형으로.
SVG + 2x PNG로 export.
```
