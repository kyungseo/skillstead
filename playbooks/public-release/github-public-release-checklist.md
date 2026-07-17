# GitHub Public Release Checklist

private repo를 public repo로 전환하기 전에 사용하는 체크리스트다.

## 1. 범위와 소유권

- [ ] repository owner와 대상 repo를 확인한다.
- [ ] default branch를 확인한다.
- [ ] `develop` 같은 장기 integration branch를 쓰는지 확인한다.
- [ ] release path를 확인한다. 예: `feature/* -> develop -> main`
- [ ] public 전환 후 첫 release tag/version을 정한다. 예: `v1.0.0`
- [ ] README, install docs, package metadata가 특정 tag/version을 가리킨다면 visibility 변경 전에 해당 tag가 존재하는지 확인한다.
- [ ] visibility, settings, branch protection 변경 승인권자를 확인한다.
- [ ] 대상 repo에 audit trail용 Work item을 만들거나 기존 Work를 재사용한다.

## 2. Pre-public Clean Baseline

- [ ] release branch의 working tree가 clean이다.
- [ ] 대상 repo status dashboard에 Active Work가 없다.
- [ ] live Work directory에 archive-pending Done Work가 없다.
- [ ] archived Work 파일은 `status: Archived`를 사용한다.
- [ ] public-facing status 파일에 내부용 next action이 남아 있지 않다.
- [ ] backlog 항목은 public 노출에 안전하거나 비밀 정보가 없다.
- [ ] README가 최신이다.
- [ ] USER-MANUAL / SYSTEM-MANUAL / examples가 있다면 최신이다.
- [ ] LICENSE가 있고 의도한 라이선스다.
- [ ] CONTRIBUTING은 있거나, 아직 생략하기로 의도적으로 판단했다.

## 3. 민감정보 점검

`sensitive-info-sweep.md`를 함께 실행한다.

최소 기준:

- [ ] tracked file에 secret, credential, token이 없다.
- [ ] private endpoint나 내부 account identifier가 의도치 않게 노출되지 않는다.
- [ ] public-facing docs에 개인 local path가 불필요하게 남아 있지 않다.
- [ ] generated artifact가 공개 가능하다.
- [ ] commit history risk를 검토했다.

## 4. Dependency And Security Gate

- [ ] package manager audit에 unresolved critical 항목이 없다.
- [ ] GitHub Dependabot alerts를 검토했다.
- [ ] lockfile이 최신이다.
- [ ] runtime baseline 변경이 필요한 security fix는 문서에도 반영했다.
- [ ] accepted risk가 있으면 대상 repo에 기록했다.

## 5. GitHub Settings Before Visibility Change

- [ ] repository description이 정확하다.
- [ ] topics가 적절하다.
- [ ] repository description은 내부 용어보다 구체적인 사용자 가치와 산출물을 설명한다.
- [ ] topics는 language, domain, key technology, user task를 균형 있게 담는다.
- [ ] About URL은 안정적이고 유용할 때만 설정한다.
- [ ] default branch가 맞다.
- [ ] public feedback을 받을 계획이면 Issues를 켠다.
- [ ] 가벼운 Q&A나 피드백 채널이 필요하면 Discussions를 켠다.
- [ ] Wiki / Projects / Pages 설정은 의도한 상태다.
- [ ] merge method가 repo workflow와 맞다.
- [ ] `delete_branch_on_merge` 설정이 의도한 상태다.

중요: `develop` 같은 장기 브랜치가 PR head로 쓰일 수 있으면,
`delete_branch_on_merge=true`가 release PR merge 후 해당 장기 브랜치를 삭제할 수 있다.
branch deletion protection이 검증되기 전에는 끄거나, feature branch 삭제만 명시적으로 처리한다.

## 6. Public Positioning

- [ ] 한 문장 project description이 준비됐다.
- [ ] 3-5개 핵심 keyword/topic이 준비됐다.
- [ ] README 첫 화면이 같은 메시지를 뒷받침한다.
- [ ] 필요하다면 public limitations를 솔직하게 설명했다.
- [ ] 공개 후 공유할 예정이면 social release note draft가 있다.

공유 문구 초안은 `social-release-note-template.md`를 사용한다.

## 7. Visibility Change

- [ ] clean baseline을 마지막으로 다시 확인한다.
- [ ] public release를 막아야 할 open security alert가 없는지 확인한다.
- [ ] public README/install docs가 pinned tag를 안내한다면 tag가 이미 push되어 있고 checkout 가능한지 확인한다.
- [ ] visibility를 public으로 변경한다.
- [ ] 즉시 `post-public-verification.md`를 실행한다.

## 8. Post-public Settings

- [ ] branch protection 또는 ruleset이 active다.
- [ ] main branch deletion이 막혀 있다.
- [ ] integration branch를 쓴다면 deletion이 막혀 있다.
- [ ] protected branch에서 non-fast-forward push가 막혀 있다.
- [ ] protected branch는 PR을 요구한다.
- [ ] owner/admin bypass가 필요한 workflow라면 Admin bypass가 가능하다.
- [ ] CI가 있다면 required checks가 설정되어 있다.
- [ ] vulnerability alerts가 enabled다.
- [ ] secret scanning이 가능하다면 enabled다.
- [ ] secret scanning push protection이 가능하다면 enabled다.
- [ ] Dependabot automated security updates는 의도한 상태다.
- [ ] profile pinned repository로 지정할지 결정했다.

Ruleset이나 branch protection을 바로 적용하지 않기로 했다면 pass로 숨기지 말고 accepted risk로 기록한다.
예: solo maintainer, 초기 main-only repo, CI 없음. 이 경우 다음 release 전 재검토 trigger를 남긴다.

## 9. Post-public Verification

- [ ] public clone이 된다.
- [ ] clean environment에서 install이 된다.
- [ ] 핵심 validation command가 통과한다.
- [ ] test command가 통과한다.
- [ ] README quick start가 정확하다.
- [ ] public examples가 접근 가능하다.
- [ ] GitHub security alerts가 clean이거나 의도적으로 기록되어 있다.

## 10. Release 준비 — 타이틀과 노트

GitHub Release를 publish하기 전에 타이틀과 notes를 준비한다.
모든 커밋 내역을 그대로 붙이지 않는다 — 사용자에게 무엇이 바뀌었고 왜 중요한지를 중심으로 정리한다.

### 타이틀 관례

| 릴리즈 유형 | 권장 형식 | 예시 |
| --- | --- | --- |
| 최초 공개 | `vX.0.0` 또는 `vX.0.0 — <한 줄 요약>` | `v1.0.0 — First Public Release` |
| Minor (새 기능) | `vX.Y.0` 또는 `vX.Y.0 — <주요 변경 한 줄>` | `v1.2.0 — Blueprint validation 개선` |
| Patch (버그 수정) | `vX.Y.Z` (간결하게, 내용은 notes에) | `v1.0.1` |
| Breaking change 포함 | 타이틀에 명시 권장 | `v2.0.0 — Breaking: schema 구조 변경` |

### Notes 작성 원칙

- GitHub의 "Generate release notes" 자동 기능은 시작점으로만 사용한다. 그대로 publish하지 않는다.
- 커밋 메시지를 그대로 붙여넣지 않는다. 변경이 사용자에게 어떤 의미인지를 중심으로 재서술한다.
- 기술 용어는 필요할 때만 쓰고, 가능하면 짧은 설명을 함께 제공한다.
- Breaking change가 있으면 맨 위에 눈에 띄게 표시한다.
- 완료되지 않은 기능이나 과장된 표현을 넣지 않는다.

권장 섹션 구성 (해당 항목만 포함):

```
## Breaking Changes   ← breaking change가 있을 때만, 맨 위에
무엇이 바뀌었고 어떻게 대응해야 하는지 설명한다.

## What's New
새 기능과 개선사항을 사용자 관점에서 서술한다. 기술 구현 설명보다 "무엇을 할 수 있게 됐는가"를 우선한다.

## Bug Fixes
수정된 문제를 사용자가 체감하는 방식으로 서술한다. patch 릴리즈에서 주로 사용.

## Migration Guide   ← breaking change가 있을 때만
업그레이드 절차와 코드/설정 변경 필요 사항을 단계별로 안내한다.

## Known Issues   ← 있을 때만
알려진 한계와 다음 릴리즈에서 수정 예정인 사항을 명시한다.

**Full Changelog:** https://github.com/OWNER/REPO/compare/vX.Y.Z...vA.B.C
```

### 최초 릴리즈 (v1.0.0) 체크리스트

- [ ] 타이틀 형식을 정했다.
- [ ] 프로젝트가 무엇을 하는지 한두 문장으로 소개했다.
- [ ] What's New 또는 첫 공개 소개 문구가 있다.
- [ ] 설치 방법 또는 Quick start 링크가 있다.
- [ ] Known limitations을 솔직하게 명시했다.
- [ ] 초기 릴리즈임을 명시하거나 Full changelog 링크를 달았다.

### Minor / Patch 릴리즈 체크리스트

- [ ] 타이틀 형식을 정했다.
- [ ] Breaking change가 있으면 맨 위에 표시했다.
- [ ] Breaking change가 있으면 Migration guide가 있다.
- [ ] 변경 내용이 사용자 impact 기준으로 정리됐다 (커밋 로그 그대로가 아님).
- [ ] Known issues가 있으면 명시했다.
- [ ] Full Changelog 링크를 달았다.
- [ ] 이전 버전과의 비교 링크가 정확하다.

### 기타 고려사항

- [ ] Pre-release 태그(alpha, beta, rc) 사용 여부를 결정했다. 사용한다면 GitHub에서 "Pre-release"로 마킹한다.
- [ ] 이 릴리즈를 "Latest"로 표시하는 것이 맞는지 확인했다.
- [ ] 릴리즈 타이밍이 적절하다. 금요일 오후, 연휴 직전은 피한다.
- [ ] 시각 자료(screenshot, demo GIF)가 유용하면 첨부한다.
- [ ] CHANGELOG.md를 유지한다면 이 릴리즈 항목이 추가됐다.

## 11. Public Announcement

- [ ] §10에서 준비한 타이틀과 notes로 GitHub Release를 publish했다.
- [ ] announcement draft를 검토했다.
- [ ] 링크가 public repository를 가리킨다.
- [ ] 시각 자료가 유용한 프로젝트라면 screenshot, gallery, demo asset을 첨부한다.
- [ ] 주장과 표현은 과장 없이 정확하다.
- [ ] known limitation이 있다면 솔직하게 표현한다.
- [ ] 게시 채널과 타이밍을 정했다.

## 12. Rollback And Incident Notes

- [ ] repository를 다시 private으로 돌리는 방법을 알고 있다.
- [ ] secret이 노출됐다면 rotate 또는 revoke한다. visibility를 다시 private으로 바꾸는 것만으로는 충분하지 않다.
- [ ] history에 민감정보가 있으면 history rewrite가 필요한지 판단한다.
- [ ] incident note를 대상 repo 또는 private incident log에 남긴다.
