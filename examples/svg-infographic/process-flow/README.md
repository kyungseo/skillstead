<!-- 한국어는 아래 -->

# Example: Process / Data Flow

A left-to-right process flow — a RAG (retrieval-augmented generation) query pipeline — produced by `svg-infographic`, in English and Korean.

| English | 한국어 |
| --- | --- |
| ![RAG query pipeline (EN)](./process-flow.en.png) | ![RAG 질의 파이프라인 (KO)](./process-flow.ko.png) |

Files: `*.en.svg` / `*.en.png` / `*.ko.svg` / `*.ko.png` — SVG is the editable source, PNG is the 2x export.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 합성 예제입니다. 이름, 식별자, digest, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

## Prompt

```text
Use svg-infographic to draw a left-to-right process flow titled "RAG Query
Pipeline" with five nodes — User Query → Embed → Vector Search → Augment →
Generate — each a card with a line icon and a one-line sub-label, connected by
solid arrows. Highlight the final "Generate" node in green. Add a one-line
caption. Export SVG + 2x PNG.
```

---

# 예제: 프로세스 / 데이터 플로우

좌→우 프로세스 플로우 — RAG(검색 증강 생성) 질의 파이프라인 — 을 `svg-infographic`으로 영문·한글 두 본으로 만들었다.

## 프롬프트

```text
svg-infographic으로 "RAG 질의 파이프라인" 제목의 좌→우 프로세스 플로우를 그려줘. 5개 노드 —
사용자 질의 → 임베딩 → 벡터 검색 → 컨텍스트 결합 → 생성 — 각각 line 아이콘과 한 줄 부제를 가진
카드로, 실선 화살표로 연결. 마지막 "생성" 노드는 초록으로 강조. 한 줄 캡션 추가. SVG + 2x PNG로 export.
```
