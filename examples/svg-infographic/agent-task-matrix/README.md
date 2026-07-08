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

Originally authored synthetic example. Non-client, non-confidential. A generic
decision aid for scoping AI-agent work, not derived from any engagement artifact.
(오리지널 합성 예제. 특정 고객·기밀과 무관하며 실제 프로젝트 산출물에서 파생하지 않았다.)

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

작업을 AI agent에 어떻게 맡길지 두 축 — **작업 범위**(좁음 ↔ 넓음)와 **불확실성**
(낮음 ↔ 높음) — 으로 나눈 2×2 decision matrix를 `svg-infographic`으로 영문·한글
두 본으로 만들었다. 각 사분면에 추천 실행 방식을 함께 담고, `Design Review`(넓은
범위 · 높은 불확실성) 사분면을 가장 강하게 강조한다.

## 이 예제가 보여주는 것

- 사분면 카드가 **충분한 gutter**로 분리된 **2×2 decision matrix**
- **축 라벨 + 방향 화살표**(작업 범위 →, 불확실성 ↑), 낮음/높음·좁음/넓음 끝단 표시
- 사분면마다 **number badge + line icon**, 코너에서 서로 겹치지 않게 배치
- **강조 사분면**(`Design Review`): 굵은 stroke·shadow·채워진 icon·`MOST CAUTION` 태그
- **추천 pill** — accent 사분면은 saturated 배경 위 light text, 나머지는 옅은 tint 위 dark text
- 각 카드 안의 **밀도 높지만 읽히는** 기술 텍스트(제목·부제·예시·추천)

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
