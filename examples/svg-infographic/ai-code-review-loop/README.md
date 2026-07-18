<!-- 한국어는 아래 -->

# Example: AI Code Review Loop

A left-to-right process flow showing an AI-assisted pull-request review cycle —
from opening a PR, through an AI review agent and a human reviewer, to patch &
verify and a merge-ready state — produced by `svg-infographic`, in English and
Korean. The AI review step is emphasized, and a dashed feedback loop shows
re-review after a patch.

| English | 한국어 |
| --- | --- |
| ![AI code review loop (EN)](./ai-code-review-loop.en.png) | ![AI 코드 리뷰 루프 (KO)](./ai-code-review-loop.ko.png) |

## Output files

| File | Role |
| --- | --- |
| `ai-code-review-loop.en.svg` | English source (editable) |
| `ai-code-review-loop.en.png` | English 2× export (3200×1440) |
| `ai-code-review-loop.ko.svg` | Korean source (editable) |
| `ai-code-review-loop.ko.png` | Korean 2× export (3200×1440) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`) for slides, docs, and social.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 모두 가상입니다. 이름, 식별자, digest, 도구와 환경은 예시용이며,
고객 정보나 기밀 식별자를 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to make a clean flat technical infographic titled "AI Code
Review Loop": a left-to-right process flow with five rounded cards, each with a
line icon — Open PR → AI Review Agent → Human Reviewer → Patch & Verify → Merge
Ready. Emphasize the AI Review Agent card with an accent color. Connect the cards
with solid arrows for the normal path, and add a dashed feedback loop from Patch
& Verify back to AI Review Agent. Add a small legend: solid = normal path, dashed
= feedback loop. Export SVG + 2× PNG.
```

---

# 예제: AI 코드 리뷰 루프

개발자가 PR을 올리고 AI 리뷰 에이전트와 사람 검토자를 거쳐 수정 사항을 반영하는 과정을 왼쪽에서
오른쪽으로 이어지는 흐름도로 표현했습니다. 영문판과 한국어판을 함께 만들었으며, AI 검토 단계는
강조색으로 표시하고 수정 후 재검토 과정은 점선으로 되돌아오게 했습니다.

## 프롬프트 (한국어)

```text
svg-infographic으로 "AI 코드 리뷰 루프" 제목의 깔끔한 flat technical 인포그래픽을 만들어줘.
좌→우 프로세스 플로우로, 각 단계는 line 아이콘이 있는 둥근 카드 5개 —
PR 생성 → AI 리뷰 에이전트 → 사람 리뷰어 → 수정 & 검증 → 병합 준비 완료.
AI 리뷰 에이전트 카드는 강조 색으로 표시. 카드는 정상 경로를 나타내는 실선 화살표로 연결하고,
수정 & 검증에서 AI 리뷰 에이전트로 돌아가는 점선 피드백 루프를 추가. 작은 legend 추가:
실선 = 정상 경로, 점선 = 피드백 루프. SVG + 2x PNG로 export.
```
