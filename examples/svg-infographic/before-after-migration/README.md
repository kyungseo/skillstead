<!-- 한국어는 아래 -->

# Example: Before / After Migration

A two-panel before/after comparison — monolith vs. microservices — produced by `svg-infographic`, in English and Korean. Shows the skill beyond architecture diagrams.

| English | 한국어 |
| --- | --- |
| ![Monolith to microservices (EN)](./before-after-migration.en.png) | ![모놀리스에서 마이크로서비스로 (KO)](./before-after-migration.ko.png) |

Files: `*.en.svg` / `*.en.png` / `*.ko.svg` / `*.ko.png` — SVG is the editable source, PNG is the 2x export.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 합성 예제입니다. 이름, 식별자, digest, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

## Prompt

```text
Use svg-infographic to make a before/after migration comparison titled
"Monolith → Microservices" on a wide canvas. Two equal-height panels: left
"Before · Monolith" (a monolithic app box containing Auth/Orders/Billing) with
✕ downside points (single deploy, shared DB, scale all-or-nothing, one failure →
full outage); right "After · Microservices" (API Gateway fanning out to Auth/
Orders/Billing services each with its own DB) with ✓ benefit points. Semantic
colors: amber = legacy constraint, green = migration benefit. Export SVG + 2x PNG.
```

---

# 예제: Before / After 마이그레이션

모놀리스 vs 마이크로서비스를 비교하는 2패널 before/after — `svg-infographic`으로 영문·한글 두 본. 아키텍처 다이어그램을 넘어선 활용을 보여준다.

## 프롬프트

```text
svg-infographic으로 "모놀리스 → 마이크로서비스" 제목의 before/after 마이그레이션 비교를
와이드 캔버스로 만들어줘. 동등한 높이의 2패널: 왼쪽 "이전 · 모놀리스"(인증/주문/결제를 담은
모놀리식 앱 박스)에 ✕ 단점(단일 배포, 공유 DB, 전체 스케일만, 하나 장애 → 전체 중단); 오른쪽
"이후 · 마이크로서비스"(API Gateway가 인증/주문/결제 서비스로 분기, 각 전용 DB)에 ✓ 이점.
semantic 컬러: amber = 레거시 제약, green = 마이그레이션 이점. SVG + 2x PNG로 export해줘.
```
