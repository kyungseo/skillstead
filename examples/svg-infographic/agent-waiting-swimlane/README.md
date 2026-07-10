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
(샘플 내용은 합성 예제입니다. 이름, 식별자, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

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

`svg-infographic`으로 만든 두 lane swimlane flow입니다(영문·한글). 위 lane은
**agent 세션 상태**(작업 중 → 승인 대기 → 작업 재개 → 완료), 아래 lane은 같은
시간의 **사용자 행동**을 나란히 추적합니다. 점선 cross-lane 화살표가 대기 알림을
아래로, 원클릭 승인을 다시 위로 연결해 — 알림이 있으면 workflow가 승인에서
멈추지 않는다는 결론을 전달합니다.

## 이 예제가 보여주는 것

- **Flow archetype의 swimlane 변형** — 두 lane의 **stage column을 동일 x좌표로
  정렬**(layout pass에서 한 번 계산해 양쪽에 재사용)
- 왼쪽 gutter의 **lane pill**(saturated 배경 + light on-accent 텍스트)
- 주 lane에만 붙인 **번호 badge**(순서가 의미 있는 lane)
- 핵심 긴장 단계(**승인 대기**)를 amber 계열 + stroke + shadow로 강조
- **선 옆에 라벨을 둔 cross-lane 점선 화살표**(알림은 아래로, 승인은 위로)
- 상태 전이와 lane 간 알림/승인을 구분하는 **legend**
- 내장 세트와 같은 24×24 line 문법으로 **조합한 아이콘**(종) 1종

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
