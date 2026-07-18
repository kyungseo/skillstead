<!-- 한국어는 아래 -->

# Example: Agent System Map — sketch preset

A **sketch preset** component map built around one conclusion: an agent is a
system, not a prompt. Context, memory, tools, guardrails, and evaluation connect
to an orchestrator; evaluation feeds corrections back into the loop.

| English | 한국어 |
| --- | --- |
| ![Agent system map, sketch preset (EN)](./agent-system-sketch.en.png) | ![Agent system map, sketch preset (KO)](./agent-system-sketch.ko.png) |

## What this example shows

- **Sketch preset across a component architecture** — the hand-drawn appearance
  is not limited to process flows; a computed topology stays readable with
  paper grain, rough borders, handwriting, and curved connectors
- **One clear center of gravity** — the orchestrator is the visual hub, with
  five supporting capabilities placed on a fixed grid and a dashed evaluation
  feedback edge returning to the center
- **Identical bilingual geometry** — EN/KO variants share all coordinates,
  routing, card dimensions, and icon placement; only text and font subsets differ
- **Subset font embed** — the OFL handwriting font is subset per language and
  embedded in the SVG (~41 KB EN / ~76 KB KO font subsets)

## Output files

| File | Role |
| --- | --- |
| `agent-system-sketch.en.svg` | English source (editable, subset font embedded) |
| `agent-system-sketch.en.png` | English 2× export (2400×1800) |
| `agent-system-sketch.ko.svg` | Korean source (editable, subset font embedded) |
| `agent-system-sketch.ko.png` | Korean 2× export (2400×1800) |

Both language variants share identical geometry. **Editing note:** the embedded
font is subset to the current text; if wording changes, re-subset before rendering
or new glyphs may appear as tofu.

## Font license

The embedded handwriting font is **Nanum Pen Script** (© NAVER Corporation),
licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/) —
embedding and redistribution in this form are permitted; the font itself remains
under OFL.

## Provenance

Sample content is synthetic. Names, identifiers, tools, and environments are
placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic with the sketch preset to show that an agent is a system,
not a prompt. Draw a tidy hand-drawn component map with an Orchestrator in the
center. Context, Memory, and Tools feed into it from the top. Guardrails and
Evaluation sit below. Add a dashed feedback edge from Evaluation back to the
Orchestrator, labelled "learn & correct". Use a conclusion title, paper grain,
rough pastel boxes, a Korean-capable handwriting font, real editable text, and
computed alignment. Keep mascots and character art out. English + Korean SVG
with identical geometry, subset the font per language, then export 2× PNG.
```

---

# 예제: Agent System Map — sketch 프리셋

“Agent는 Prompt가 아니라 System이다”라는 결론을 중심으로 만든 **sketch 프리셋** 구성도입니다.
Context, Memory, Tool, Guardrail과 평가 기능이 Orchestrator에 연결되고, 평가 결과는 다시
Orchestrator로 돌아가 다음 작업을 보정합니다.

## 이 예제가 보여주는 것

- **구성도에 적용한 sketch 프리셋** — 계산된 토폴로지 위에 종이 질감, 거친 테두리,
  손글씨와 곡선 연결선을 적용해 프로세스 흐름이 아닌 구성도에서도 읽기 쉽게 표현했습니다.
- **분명한 시각 중심** — Orchestrator를 중심에 두고 다섯 가지 지원 기능을 고정 격자에 배치했습니다.
  평가 결과가 중심으로 돌아가는 점선은 보정 흐름을 나타냅니다.
- **두 언어에서 같은 배치** — 영문판과 한국어판은 좌표, 연결선 경로, 카드 크기와 아이콘 위치가
  같고 글자와 포함된 폰트만 다릅니다.
- **필요한 글자만 포함한 폰트** — OFL 손글씨 폰트에서 각 언어에 필요한 글자만 추려 SVG에
  포함했습니다. 폰트 데이터 크기는 영문판 약 41 KB, 한국어판 약 76 KB입니다.

## 폰트 라이선스

포함된 손글씨 폰트는 **나눔펜스크립트**(© NAVER Corporation)이며
[SIL Open Font License 1.1](https://openfontlicense.org/)을 따릅니다. 이 형태로 포함하고 재배포할 수
있으며, 폰트 자체의 라이선스는 OFL로 유지됩니다.

## 프롬프트 (한국어)

```text
svg-infographic의 sketch 프리셋으로 “Agent는 Prompt가 아니라 System이다”를
보여줘. 중앙에 Orchestrator를 둔 정돈된 손그림 component map. 위에서는
Context, Memory, Tool이 연결되고, 아래에는 Guardrail과 평가를 둔다. 평가에서
Orchestrator로 돌아가는 점선 feedback edge에 “학습 · 보정” label. 결론형 제목,
종이 질감, rough pastel box, 한글 손글씨 폰트, 실제 편집 가능한 text, 계산된
정렬을 사용한다. 마스코트·캐릭터는 제외. EN/KO 동일 geometry SVG를 만들고
언어별 font subset 후 2× PNG로 export.
```
