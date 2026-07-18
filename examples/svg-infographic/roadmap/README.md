<!-- 한국어는 아래 -->

# Example: Roadmap / Timeline

A four-phase product roadmap on a timeline with a "now" marker — produced by `svg-infographic`, in English and Korean.

| English | 한국어 |
| --- | --- |
| ![Product roadmap (EN)](./roadmap.en.png) | ![제품 로드맵 (KO)](./roadmap.ko.png) |

Files: `*.en.svg` / `*.en.png` / `*.ko.svg` / `*.ko.png` — SVG is the editable source, PNG is the 2x export.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, digest, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt

```text
Use svg-infographic to draw a product roadmap on a horizontal timeline with four
phases — Discovery (done), Alpha (now), Beta (next), GA (later). Timeline dots by
status (filled = done/now, hollow = future), a dashed "NOW" marker between Alpha
and Beta, and a card per phase with a status pill and three milestone bullets.
Highlight the current phase. Phases over exact dates. Export SVG + 2x PNG.
```

---

# 예제: 로드맵 / 타임라인

네 단계로 구성한 제품 로드맵과 "현재" 표시를 타임라인 위에 배치했습니다. `svg-infographic`으로
영문판과 한국어판을 함께 만들었습니다.

## 프롬프트

```text
svg-infographic으로 가로 타임라인 위에 4단계 제품 로드맵을 그려줘 — 발견(완료), 알파(현재),
베타(다음), 정식출시(이후). 상태별 타임라인 dot(채움 = 완료/현재, 빈 원 = 이후), 알파와 베타
사이 점선 "현재" 마커, 각 단계마다 상태 pill과 마일스톤 3개 불릿 카드. 현재 단계 강조. 정확한
날짜보다 단계 중심. SVG + 2x PNG로 export.
```
