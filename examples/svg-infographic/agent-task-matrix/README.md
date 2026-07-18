<!-- 한국어는 아래 -->

# Example: AI Agent Task Selection Matrix

A 2×2 decision matrix produced by `svg-infographic`, in English and Korean. It
maps how to hand a task to an AI agent along two axes — **scope** (narrow ↔ broad)
and **uncertainty** (low ↔ high) — into four quadrants, each with a recommended
execution mode. `Design Review` (broad scope · high uncertainty) is the most
emphasized quadrant.

| English | 한국어 |
| --- | --- |
| ![AI agent task selection matrix (EN)](./agent-task-matrix.en.png) | ![AI Agent 작업 유형 선택 매트릭스 (KO)](./agent-task-matrix.ko.png) |

## What this example shows

- **2×2 decision matrix** with **quadrant cards** separated by a visible gutter
- **Axis labels + direction arrows** (Scope →, Uncertainty ↑) with Low/High and Narrow/Broad ends
- A **number badge + line icon** per quadrant, kept clear of one another in the corner
- A **highlighted quadrant** (`Design Review`) via stronger stroke, shadow, filled icon, and a `MOST CAUTION` tag
- **Recommendation pills** — light text on a saturated pill for the accent quadrant, dark text on a tinted pill elsewhere
- **Dense but readable** bilingual technical text (title, sub-tag, examples, recommendation) inside each card

## Output files

| File | Role |
| --- | --- |
| `agent-task-matrix.en.svg` | English source (editable) |
| `agent-task-matrix.en.png` | English 2× export (2600×2140) |
| `agent-task-matrix.ko.svg` | Korean source (editable) |
| `agent-task-matrix.ko.png` | Korean 2× export (2600×2140) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`).

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, digest, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to make a clean flat technical infographic: a 2×2 decision
matrix titled "AI Agent Task Selection Matrix". X-axis = Scope (narrow → broad),
Y-axis = Uncertainty (low → high), with axis labels and direction arrows. Four
rounded quadrant cards with a number badge and a line icon each: Quick Fix
(narrow · low) → run directly; Guided Change (broad · low) → plan, then execute;
Investigation (narrow · high) → gather evidence before editing; Design Review
(broad · high) → cross-agent / red-team review. Give each card a short examples
list and a recommendation pill. Emphasize the Design Review quadrant the most and
tag it "MOST CAUTION". Add a bottom note: "Rule of thumb: uncertainty decides
review depth; scope decides planning depth." Export SVG + 2× PNG.
```

---

# 예제: AI Agent 작업 유형 선택 매트릭스

AI 에이전트에게 작업을 어떻게 맡길지 **작업 범위**(좁음 ↔ 넓음)와 **불확실성**
(낮음 ↔ 높음)을 기준으로 나눈 2×2 의사결정 매트릭스입니다. 영문판과 한국어판을 함께 만들었으며,
각 사분면에 권장 실행 방식을 담았습니다. 그중 넓은 범위와 높은 불확실성이 만나는 `Design Review`를
가장 강하게 강조했습니다.

## 이 예제가 보여주는 것

- 사분면 카드 사이에 **충분한 간격**을 둔 **2×2 의사결정 매트릭스**
- **축 라벨 + 방향 화살표**(작업 범위 →, 불확실성 ↑), 낮음/높음·좁음/넓음 끝단 표시
- 사분면마다 **번호 배지와 선형 아이콘**을 모서리에서 겹치지 않게 배치
- **강조 사분면**(`Design Review`)에 굵은 테두리, 그림자, 채운 아이콘과 `MOST CAUTION` 태그 적용
- **권장 방식 라벨**은 강조 사분면에서 진한 배경과 밝은 글자, 나머지에서는 옅은 배경과 어두운 글자 사용
- 각 카드 안에 제목, 부제, 예시와 권장 방식을 **밀도는 높지만 읽을 수 있게** 배치

## 프롬프트 (한국어)

```text
svg-infographic으로 "AI Agent 작업 유형 선택 매트릭스" 제목의 깔끔한 flat technical
인포그래픽을 만들어줘. 2×2 decision matrix로, X축 = 작업 범위(좁음 → 넓음),
Y축 = 불확실성(낮음 → 높음), 축 라벨과 방향 화살표 표시. 둥근 사분면 카드 4개, 각각
number badge와 line 아이콘: Quick Fix(좁음·낮음) → 바로 실행 / Guided Change(넓음·낮음)
→ plan 후 실행 / Investigation(좁음·높음) → 증거 수집 후 최소 수정 / Design Review
(넓음·높음) → cross-agent·red-team review. 각 카드에 짧은 예시와 추천 pill을 넣고,
Design Review 사분면을 가장 강조하고 "MOST CAUTION" 태그. 하단 note:
"Rule of thumb: uncertainty decides review depth; scope decides planning depth."
SVG + 2x PNG로 export.
```
