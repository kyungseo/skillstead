# Independent Review Relay Template

Skill 변경에 independent review가 필요한 경우 사용합니다. 이 template은 portable evidence contract를
정의하며 host workflow나 review-recording tool이 실행할 수 있습니다.

## Setup

Target:

- Package와 exact revision:
- Review purpose:

Roles:

- Driver:
- Reviewer:
- Specialist, optional:
- Arbiter:

Round rule:

- Initial review:
- Named-finding recheck 최대 횟수 또는 escalation 조건:

Non-goals:

- ...

Artifact ownership:

- Driver 소유 파일:
- Reviewer output 경로:
- Isolation 또는 separate-tree 규칙:

## Relay Packet

Current state:

- 변경 파일:
- 완료한 validation:
- Known limitation:

Review objective:

- ...

Must check:

1. intent와 trigger selection;
2. negative, ambiguous, mutation, host-precedence behavior;
3. package self-containment와 official-validator evidence;
4. claim, bilingual parity, public sanitation;
5. 적용 가능한 release, retirement, rollback, hidden cost.

Do not re-litigate:

- ...

Independence:

- Fresh context: yes / no
- Answer key 미열람: yes / no / not applicable
- Shared working tree: no / controlled exception

## Reviewer Findings

Verdict: approve / conditional / request-changes / reject

| ID | Severity | Finding | Evidence | Must-fix | Recommendation |
| --- | --- | --- | --- | --- | --- |
|  | P1 / P2 / P3 |  |  |  |  |

Residual risk:

- ...

## Driver Response

| Finding | Decision | Response | Follow-up |
| --- | --- | --- | --- |
|  | accept / revise / defend / needs-user |  |  |

`needs-user`, defend한 blocker, scope expansion, round bound 소진은 관련 변경을 계속하기 전에 arbiter에게
올립니다.

## Round And Consensus Log

| Round | Objective | Verdict | Status |
| --- | --- | --- | --- |
|  |  |  | open / closed / escalated |

| Topic | Status | Notes |
| --- | --- | --- |
|  | agreed / deferred / arbiter-decided |  |

Review approval은 commit, publication, tag 변경, release operation, destructive action을 자동 승인하지
않습니다. 대상 repository의 일반 approval gate를 별도로 적용합니다.
