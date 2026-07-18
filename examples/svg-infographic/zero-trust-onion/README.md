<!-- 한국어는 아래 -->

# Example: Zero Trust Onion Model

A nested "onion" model produced by `svg-infographic`, in English and Korean. Four
concentric rings — network edge, identity & access, device & workload, and a
least-privilege **data core** — show that in a zero-trust design, trust is
established per request at every ring and never inherited from the outer layer.

| English | 한국어 |
| --- | --- |
| ![Zero trust onion model (EN)](./zero-trust-onion.en.png) | ![Zero Trust 온니언 모델 (KO)](./zero-trust-onion.ko.png) |

## What this example shows

- **Nested / onion archetype** — concentric rounded rings with a **uniform inset**
  (computed in the layout pass, not eyeballed)
- Ring labels centered in each ring's **visible top strip**, in that ring's own ink color
- **Light (outer) → saturated (inner)** color progression toward the emphasized core
- An emphasized **core card** (stroke + soft shadow + white icon circle + shield icon)
- A muted **rule-of-thumb footer strip** below the diagram
- A **conclusion-style title** ("nothing inherits trust") instead of a topic label

## Output files

| File | Role |
| --- | --- |
| `zero-trust-onion.en.svg` | English source (editable) |
| `zero-trust-onion.en.png` | English 2× export (2800×1800) |
| `zero-trust-onion.ko.svg` | Korean source (editable) |
| `zero-trust-onion.ko.png` | Korean 2× export (2800×1800) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`). Both language variants share identical geometry — only the text differs.

## Provenance

Sample content is synthetic. Names, identifiers, tools, and environments are
placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to draw a nested onion model of zero-trust access.
Four rings, outside in: Network edge (reachability grants nothing) →
Identity & access (authenticate every request) → Device & workload
(posture checked continuously) → Data core (least-privilege by default).
Make the title a conclusion, not a topic — something like "Zero Trust:
Every Layer Verifies, Nothing Inherits Trust". Go light on the outer ring
and saturated on the core, emphasize the core with a shield icon, and add
a small rule-of-thumb strip at the bottom: verify explicitly · assume
breach · least privilege. Wide 1400×900 canvas. Export SVG + 2× PNG.
```

---

# 예제: Zero Trust 온니언 모델

Zero Trust 접근 구조를 중첩된 "온니언" 모델로 표현한 영문·한국어 예제입니다. 네트워크 경계 →
Identity & Access → 디바이스와 워크로드 → 최소 권한 **데이터 코어**를 네 개의 동심 링으로
배치했습니다. 신뢰는 바깥 계층에서 상속되지 않으며, 각 계층에서 요청마다 다시 확인해야 한다는
결론을 보여줍니다.

## 이 예제가 보여주는 것

- **중첩·온니언 유형** — 균일한 안쪽 간격을 계산해 배치한 동심 링
- 각 링에서 보이는 위쪽 영역 가운데에 해당 링의 색으로 배치한 라벨
- 강조한 코어를 향해 **밝음(바깥) → 진함(안쪽)**으로 변하는 색
- 테두리, 부드러운 그림자, 흰색 아이콘 원과 방패 아이콘으로 강조한 **코어 카드**
- 다이어그램 아래에 배치한 차분한 **핵심 원칙 영역**
- 주제 라벨이 아닌 **결론형 제목**("신뢰는 상속되지 않는다")

## 프롬프트 (한국어)

```text
svg-infographic으로 zero-trust 접근을 nested onion 모델로 그려줘.
바깥부터 링 4개: 네트워크 경계(도달했다고 신뢰하지 않음) → Identity & Access
(모든 요청 인증) → 디바이스 & 워크로드(상태 상시 점검) → 데이터 코어(기본값은
최소 권한). 제목은 주제가 아니라 결론으로 — "Zero Trust — 신뢰는 상속되지
않는다" 같은 형태. 외곽 링은 밝게, 코어는 진하게 하고 코어를 shield 아이콘으로
강조해줘. 하단에 작은 rule-of-thumb strip: 명시적 검증 · 침해 전제 · 최소 권한.
wide 1400×900 캔버스. SVG + 2x PNG로 export.
```
