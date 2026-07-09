<!-- 한국어는 아래 -->

# Example: Issue Tracker ↔ CI/CD Approval Flow

A vertical five-step flow with a parallel issue-state rail, produced by
`svg-infographic`, in English and Korean. A single issue key (`TICKET-123`)
threads a change from the developer's commit, through the CI pipeline's build and
the test environment, to an **approval gate that is an issue-state transition**,
and finally a prod deploy of the same digest. The right-hand rail shows the
ticket moving Open → In Progress → In Test → Approved → Deployed in step with the
flow.

| English | 한국어 |
| --- | --- |
| ![Issue tracker CI/CD approval flow (EN)](./issue-tracker-cicd-approval-flow.en.png) | ![이슈 트래커 CI/CD 승인 연동 흐름 (KO)](./issue-tracker-cicd-approval-flow.ko.png) |

## Output files

| File | Role |
| --- | --- |
| `issue-tracker-cicd-approval-flow.en.svg` | English source (editable) |
| `issue-tracker-cicd-approval-flow.en.png` | English 2× export (2120×1360) |
| `issue-tracker-cicd-approval-flow.ko.svg` | Korean source (editable) |
| `issue-tracker-cicd-approval-flow.ko.png` | Korean 2× export (2120×1360) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`) for slides, docs, and social.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 합성 예제입니다. 이름, 식별자, digest, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to make a clean flat technical infographic titled "Issue
Tracker ↔ CI/CD Approval Flow". A vertical numbered flow of five steps on the
left, connected by a spine: 1 Developer registers a ticket and references the key
in branch & commits (feature/TICKET-123); 2 CI Pipeline builds, records the
artifact digest, and changes state; 3 Environment deploys the same @digest to
test and attaches QA result; 4 Issue Tracker approval gate — an approver
transitions the ticket, approver & time auto-logged; 5 CI Pipeline deploys the
same @digest to prod after checking the approval state. On the right, a parallel
"Issue state" rail for TICKET-123 showing Open → In Progress → In Test → Approved
→ Deployed aligned to each step. Footer: the pipeline records/queries via API &
webhooks; manual-approval variant uses an email/checklist sign-off plus a
pipeline input gate. Icon-first, semantic colors. Export SVG + 2× PNG.
```

---

# 예제: 이슈 트래커 ↔ CI/CD 승인 연동 흐름

이슈 키 하나가 개발자의 커밋에서 CI 파이프라인 빌드와 test 환경을 거쳐 **이슈 상태 전이인
승인 게이트**, 그리고 동일 digest의 prod 배포까지 이어지는 흐름을 좌측 5단계 세로 플로우와
우측 이슈-상태 rail로 그린 예제다. `svg-infographic`으로 영문·한글 두 본을 만들었다. 오른쪽
rail은 티켓이 Open → In Progress → In Test → Approved → Deployed로 흐름과 나란히 전이되는
것을 보여준다.

## 프롬프트 (한국어)

```text
svg-infographic으로 "이슈 트래커 ↔ CI/CD 승인 연동 흐름" 제목의 깔끔한 flat technical
인포그래픽을 만들어줘. 왼쪽에 spine으로 연결된 세로 5단계 numbered 플로우: 1 개발자가 이슈를
등록하고 브랜치·커밋에 이슈 키 참조(feature/TICKET-123); 2 CI 파이프라인이 빌드하고 아티팩트
digest를 기록하며 상태를 전이; 3 환경이 동일 @digest로 test 배포하고 QA 결과 첨부; 4 이슈
트래커 승인 게이트 — 승인자가 티켓을 전이하고 승인자·시각 자동 기록; 5 CI 파이프라인이 승인
상태 확인 후 동일 @digest를 prod 배포. 오른쪽에 TICKET-123의 "이슈 상태" rail을 두고 각
단계에 맞춰 Open → In Progress → In Test → Approved → Deployed 표시. footer: 파이프라인이
API·webhook으로 기록·조회, 수동 승인 변형은 이메일/체크리스트 서명 + 파이프라인 input 게이트.
icon-first, 의미 색상. SVG + 2x PNG로 export.
```
