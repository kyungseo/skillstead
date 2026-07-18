<!-- 한국어는 아래 -->

# Example: Technical Infographic

A non-architecture technical infographic — "The 4 Layers of AI Engineering" — produced by `svg-infographic`, in English and Korean.

| English | 한국어 |
| --- | --- |
| ![4 Layers of AI Engineering (EN)](./technical-infographic.en.png) | ![AI 엔지니어링의 4가지 레이어 (KO)](./technical-infographic.ko.png) |

Files: `*.en.svg` / `*.en.png` / `*.ko.svg` / `*.ko.png` — SVG is the editable source, PNG is the 2x export.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, digest, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt

```text
Use svg-infographic to make a 4:5 social infographic titled "The 4 Layers of AI
Engineering". Show four nested rounded rectangles (an onion): Loop wraps Harness
wraps Context wraps Prompt, shaded from light to saturated blue with each layer
labeled. Below, a 2x2 card grid with numbered badges — 1 Prompt, 2 Context,
3 Harness, 4 Loop Engineering — each with a one-line description. Flat vector style,
muted blue palette. Export SVG + 2x PNG.
```

This example uses the **flat, structural** style. The separate sketch preset supports tidy hand-drawn notes;
character illustration remains out of scope.

---

# 예제: 기술 인포그래픽

"AI 엔지니어링의 4가지 레이어"를 설명하는 기술 인포그래픽입니다. 아키텍처 구성도가 아닌 개념
설명에도 스킬을 활용할 수 있음을 보여주며, 영문판과 한국어판을 함께 만들었습니다.

## 프롬프트

```text
svg-infographic으로 "AI 엔지니어링의 4가지 레이어" 제목의 4:5 소셜 인포그래픽을 만들어줘.
중첩된 둥근 사각형 4개(양파 구조): 루프가 하네스를, 하네스가 컨텍스트를, 컨텍스트가 프롬프트를
감싸고, 밝은 파랑에서 진한 파랑으로 음영을 주고 각 레이어에 라벨을 달아줘. 아래에는 넘버 badge가
있는 2x2 카드 그리드 — 1 프롬프트, 2 컨텍스트, 3 하네스, 4 루프 엔지니어링 — 각각 한 줄 설명.
flat 벡터 스타일, muted 블루 팔레트. SVG + 2x PNG로 export해줘.
```

이 예제는 **평면형 구조 스타일**을 사용했습니다. 정돈된 손그림 노트는 별도의 sketch 프리셋으로
만들 수 있지만, 캐릭터 일러스트는 계속 지원 범위 밖입니다.
