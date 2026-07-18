# GitHub Repository Settings Template

[English](./repo-settings-template.md) · **한국어**

대상 repo에 맞게 조정해서 사용하는 GitHub settings 기본값이다.

## Basic

- Visibility: 공개 전 점검을 모두 마친 뒤에만 public.
- Default branch: `main`.
- Description: 짧고 정확하며, 과장 없이 프로젝트가 하는 일을 설명한다.
- Topics: language, domain, core technology, user task를 균형 있게 담는다.
- Homepage/About URL: 안정적이고 유용할 때만 설정한다.
- Issues: 공개 feedback을 받을 계획이면 enabled.
- Discussions: 가벼운 질문/피드백 채널이 유용하면 enabled.
- Wiki: 유지할 계획이 없으면 disabled.
- Projects: 선택.

## Pull Requests

- Merge commits: feature history 보존이 중요하면 enabled.
- Squash merge: 선택.
- Rebase merge: 선택. 단, workflow에서 비권장하면 끈다.
- Auto-merge: 선택.
- Allow update branch: enabled.
- Delete head branches automatically: 주의해서 사용.

`develop` 같은 장기 브랜치가 PR head로 쓰일 수 있다면, 자동 branch deletion을 켜기 전에
해당 브랜치의 deletion protection을 먼저 검증한다. 그렇지 않으면 release PR merge 후
장기 브랜치가 삭제될 수 있다.

초기 main-only repo에서는 `delete_branch_on_merge=true`가 합리적일 수 있다. 다만 long-lived branch를
나중에 추가하면 이 설정과 branch deletion protection을 함께 재검토한다.

## Branch Protection / Rulesets

권장 규칙:

| 대상 | 규칙 |
| --- | --- |
| `main` | deletion 차단, non-fast-forward 차단, PR 필수, CI가 있으면 required checks |
| `develop` | deletion 차단, non-fast-forward 차단, PR 필수 |
| Release tags | 기존 tag의 update/deletion을 막는다. 정상적인 새 release tag는 만들 수 있도록 creation은 제한하지 않는다. Admin bypass는 필요한 관리자에게만 허용한다. **적용 대상:** version tag로 release하는 repository. Tag 없이 release하는 repository만 근거를 남기고 not-applicable로 처리한다. **없을 때의 심각도:** pinned install, tag-pinned clone·dependency·CI처럼 변경되지 않는 tag에 의존하는 중요한 사용 경로가 있으면 `Blocked`. 그 밖에는 `Needs attention`으로 기록하고 accepted risk와 재검토 조건을 남긴다. |

tag pattern은 repo의 실제 release convention에서 도출한다. `v*`는 candidate default일 뿐이며,
GitHub ruleset의 `fnmatch`에서 `*`는 `/`를 넘지 않으므로 monorepo의 `pkg-a/v1.2.3` 같은 namespace에는
별도 pattern이 필요하다. 적용 전에 실제 tag 목록으로 누락과 과도 적용을 확인한다.

권장 bypass:

- solo maintainer workflow에서 긴급 복구나 release 후 branch sync가 필요하면 owner/admin bypass가 가능해야 한다.
- bypass는 가능한 좁게 둔다. 기본 권장값은 Admin bypass만 허용하는 것이다.
- 일반 contributor, GitHub App, broad team bypass는 필요성이 명확할 때만 추가한다.
- bypass 기록: push 응답의 `Bypassed rule violations`는 우회가 발생했다는 즉시 확인 근거다. 계속 남는
  감사 기록은 rule suites API로 확인한다. 일부 Insights 화면은 plan(Team/Enterprise)에 따라 제한될 수 있다.

### Legacy branch protection → rulesets 이전 (optional, overlap-first)

rulesets와 legacy branch protection은 함께 적용될 수 있으므로, 이전은 겹침을 유지한 채 진행한다:

1. 새 ruleset을 먼저 active로 만든다.
2. effective rules와 bypass가 legacy와 등가인지 검증한다 (`gh api repos/OWNER/REPO/rules/branches/BRANCH`).
3. legacy protection 제거는 별도 결정·승인 단계로 분리한다.
4. 제거 후 effective rules를 재검증한다. 실패하면 legacy를 유지하거나 복원한다.

등가성 검증 전에 기존 보호를 먼저 제거하지 않는다.

## Security

- Vulnerability alerts: enabled.
- Dependabot security updates: 프로젝트 선호에 따라 manual 또는 automated.
- Secret scanning: 가능하면 enabled.
- Secret scanning push protection: 가능하면 enabled.
- Private vulnerability reporting: public repo에 유용하면 enabled.

## Verification Commands

```bash
gh repo view OWNER/REPO --json defaultBranchRef,deleteBranchOnMerge,hasDiscussionsEnabled,visibility
gh api repos/OWNER/REPO
gh api repos/OWNER/REPO/vulnerability-alerts -i
gh api repos/OWNER/REPO/rulesets
```

plan 제약 (2026-07-17 확인 — GitHub 정책 변동 가능, 불가 시 확인 날짜와 함께 기록):
**GitHub Free와 Free for organizations는 public repo의 rulesets·protected branches를 지원하고,
private repo에는 Pro/Team/Enterprise가 필요하다.** private repo에서 설정을 시도하기 전에 visibility와
plan을 먼저 확인한다. 그 외 일부 security 기능도 plan·visibility에 따라 제한될 수 있다.
적용하지 못한 ruleset/protection은 공개 후 기록에 accepted risk와 재검토 조건으로 남긴다.

## Description And Topics

Description checklist:

- [ ] 구체적인 결과물이나 기능을 말한다.
- [ ] 내부 phase 이름이나 작업명에 의존하지 않는다.
- [ ] README가 뒷받침하지 못하는 과장을 피한다.
- [ ] GitHub repository description field에 자연스럽게 들어간다.

Topic checklist:

- [ ] Language: 예 `typescript`, `python`, `go`.
- [ ] Domain: 예 `presentation`, `automation`, `developer-tools`.
- [ ] Technology: 예 `pptx`, `pptxgenjs`, `cli`.
- [ ] User task: 예 `deck-generation`, `public-release`, `workflow`.
- [ ] AI/tooling tag는 검색에 도움이 되고 프로젝트와 정확히 맞을 때만 사용한다.

## Profile Pinning

- [ ] 공개 직후 profile pinned repository로 지정할지 결정한다.
- [ ] 대표 repo로 보여줄 만큼 README, examples, release, license가 정리되어 있다.
- [ ] pinned slot을 차지할 만큼 현재 집중 프로젝트 또는 장기 대표 프로젝트인지 확인한다.
