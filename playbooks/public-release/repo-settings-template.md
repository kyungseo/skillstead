# GitHub Repository Settings Template

대상 repo에 맞게 조정해서 사용하는 GitHub settings 기본값이다.

## Basic

- Visibility: clean baseline 이후에만 public.
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

| Branch | Rules |
| --- | --- |
| `main` | deletion 차단, non-fast-forward 차단, PR 필수, CI가 있으면 required checks |
| `develop` | deletion 차단, non-fast-forward 차단, PR 필수 |

권장 bypass:

- solo maintainer workflow에서 긴급 복구나 release 후 branch sync가 필요하면 owner/admin bypass가 가능해야 한다.
- bypass는 가능한 좁게 둔다. 기본 권장값은 Admin bypass만 허용하는 것이다.
- 일반 contributor, GitHub App, broad team bypass는 필요성이 명확할 때만 추가한다.

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

일부 security/ruleset 기능은 repo가 private이거나 account plan이 지원하지 않으면 사용할 수 없다.
적용하지 못한 ruleset/protection은 post-public record에 accepted risk와 revisit trigger로 남긴다.

## Description And Topics

Description checklist:

- [ ] 구체적인 output 또는 capability를 말한다.
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
