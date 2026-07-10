<!-- 한국어는 아래 -->

# Example: Incident Response Loop — sketch preset

The first **sketch preset** example: an incident-response loop (detect → triage →
respond → recover → retro) drawn as a "tidy hand-drawn" note — paper background,
Korean-capable handwriting font, rough strokes, and a highlighter title. Minor
issues branch to the backlog; the retro feeds prevention back into detection.

| English | 한국어 |
| --- | --- |
| ![Incident response loop, sketch preset (EN)](./incident-response-sketch.en.png) | ![장애 대응 루프, sketch 프리셋 (KO)](./incident-response-sketch.ko.png) |

## What this example shows

- **Sketch preset ("tidy hand-drawn")** — hand-drawn *surface* (rough
  `feTurbulence`/`feDisplacementMap` strokes, paper grain, handwriting font,
  underline highlighter, open-V arrowheads), **computed layout** (the standard
  layout pass: aligned column, even spacing, arithmetic containment)
- **Subset font embed** — the OFL handwriting font is subset to the glyphs
  actually used (~69 KB) and embedded as a base64 data URI, so the SVG stays
  ~100 KB instead of ~4 MB and renders identically everywhere
- **Icon–label grouping** by formula (icon + gap + estimated text width, centered
  as one unit), gentle hand-drawn curves for branch and loop-back edges,
  dashed-leader side annotations kept clear of the long loop edge
- Mascots / character art remain out of scope — the sketch preset changes the
  surface, not the skill's boundaries

## Output files

| File | Role |
| --- | --- |
| `incident-response-sketch.en.svg` | English source (editable, subset font embedded) |
| `incident-response-sketch.en.png` | English 2× export (2000×1760) |
| `incident-response-sketch.ko.svg` | Korean source (editable, subset font embedded) |
| `incident-response-sketch.ko.png` | Korean 2× export (2000×1760) |

Both language variants share identical geometry — only the text differs.
**Editing note:** the embedded font is subset to the current text; if you change
any wording, re-subset (see the skill's `references/sketch.md` §3) or new
characters will render as tofu.

## Font license

The embedded handwriting font is **Nanum Pen Script** (© NAVER Corporation),
licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/) —
embedding and redistribution in this form are permitted; the font itself remains
under OFL.

## Provenance

Sample content is synthetic. Names, identifiers, tools, and environments are
placeholders; no customer or confidential identifiers are included.
(샘플 내용은 합성 예제입니다. 이름, 식별자, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic with the sketch preset to draw an incident-response
loop as a tidy hand-drawn note. Main column: Detect → Triage → Respond →
Recover → Retro. From Triage, a "minor" branch goes right to a "To backlog"
card; the main path continues as "major". A long loop-back edge
returns from Retro to Detect (prevention feeds back). Add short handwritten
side notes: make alert criteria explicit / mitigate first, root-cause after /
blameless retro / log it even if not now. Conclusion title like "An Incident
Ends at the Retro" with a highlighter under it. Korean handwriting font,
paper background, rough boxes. Subset the font before embedding. SVG + 2× PNG.
```

---

# 예제: 장애 대응 루프 — sketch 프리셋

첫 **sketch 프리셋** 예제입니다: 감지 → 분류 → 대응 → 복구 → 회고로 이어지는
장애 대응 루프를 "정돈된 손그림" 노트로 그렸습니다 — 종이 배경, 한글 손글씨
폰트, rough 스트로크, 형광펜 제목. 경미한 이슈는 백로그로 분기하고, 회고는
예방 항목으로 감지 단계에 되먹임됩니다.

## 이 예제가 보여주는 것

- **Sketch 프리셋("정돈된 손그림")** — *표면*은 손그림(rough
  `feTurbulence`/`feDisplacementMap` 스트로크, 종이 질감, 손글씨 폰트, 밑줄형
  형광펜, open-V 화살촉), **배치는 계산**(표준 layout pass: 정렬된 column,
  균등 간격, 산술 containment)
- **Subset 폰트 embed** — OFL 손글씨 폰트를 실제 사용 glyph만 subset(~69 KB)해
  base64 data URI로 embed → SVG가 ~4 MB가 아닌 ~100 KB로 유지되면서 어디서든
  동일하게 렌더
- **공식 기반 아이콘-라벨 그룹**(아이콘 + 간격 + 추정 텍스트 폭을 한 단위로
  중앙 정렬), 분기·loop-back 엣지의 완만한 손그림 곡선, 긴 loop 엣지와
  간섭하지 않게 배치한 점선 leader annotation
- 마스코트·캐릭터는 계속 범위 밖 — sketch 프리셋은 표면을 바꿀 뿐 skill의
  경계를 바꾸지 않습니다

## 폰트 라이선스

embed된 손글씨 폰트는 **나눔펜스크립트**(© NAVER Corporation)이며
[SIL Open Font License 1.1](https://openfontlicense.org/)을 따릅니다 — 이 형태의
embed·재배포는 허용되며, 폰트 자체는 OFL로 유지됩니다.

## 프롬프트 (한국어)

```text
svg-infographic의 sketch 프리셋으로 장애 대응 루프를 정돈된 손그림 노트로
그려줘. 메인 column: 감지 → 분류 → 대응 → 복구 → 회고. 분류에서 "경미"
분기가 오른쪽 "백로그 등록" 카드로 빠지고, 메인 경로는 "심각"으로 계속.
회고에서 감지로 돌아가는 긴 loop-back 엣지(예방 항목 반영). 짧은 손글씨
주석: 알림 기준을 명확히 / 임시 조치 먼저, 근본 원인은 그다음 / 비난 없는
회고 / 지금 아니어도 기록은 남긴다. 제목은 "장애는 회고까지 가야 끝난다"
같은 결론형으로, 아래에 형광펜. 한글 손글씨 폰트, 종이 배경, rough 박스.
폰트는 subset해서 embed. SVG + 2x PNG.
```
