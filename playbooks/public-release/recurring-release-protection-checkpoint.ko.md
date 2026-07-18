# Recurring Release Protection Checkpoint

[English](./recurring-release-protection-checkpoint.md) · **한국어**

이미 public인 repository가 새 버전을 release하기 전에 branch와 tag의 보호 상태를 확인하는 독립
checkpoint다. 첫 공개 전환 시점(§8)에만 확인하고 끝내면 이후 릴리스에서는 보호 상태를 다시 확인하지
않게 된다. 이 checkpoint는 **version release를 할 때마다** 실행한다.

## 적용 여부 판정 (매번 먼저)

- [ ] repo의 release convention을 확인한다: version tag로 release하는가? tag namespace는 무엇인가?
      (monorepo는 `pkg-a/v1.2.3`처럼 `/`를 포함할 수 있다 — ruleset `fnmatch`에서 `*`는 `/`를 넘지
      않으므로 별도 pattern이 필요하다.)
- [ ] 변경되지 않는 tag를 전제로 동작하는 중요한 사용 경로가 있는지 확인한다 — pinned install,
      tag-pinned clone, dependency 참조, CI checkout.
- [ ] tag 없이(branch snapshot 등) release하는 repo라면 tag ruleset은 **not-applicable** — 근거를
      기록하고 branch 항목만 확인한다. 이는 위험을 감수하는 결정이 아니라, tag 관련 위험이 없다는
      근거 기반 결론이다.

## 확인 항목

- [ ] default branch ruleset/protection이 active다 (deletion 차단, non-fast-forward 차단, PR 필수,
      CI가 있으면 required checks).
- [ ] release tag ruleset이 active다 (기존 tag update/deletion 차단, creation 비제한, narrow admin
      bypass — `repo-settings-template.ko.md` 기준).
- [ ] ruleset pattern이 실제 release tag namespace와 일치한다(tag 목록으로 누락과 과도 적용을 확인).
- [ ] plan/permission 제약을 확인했다 (private repo의 rulesets·protected branches는
      Pro/Team/Enterprise 필요 — 2026-07-17 기준, `repo-settings-template.ko.md` 참조).

## 미비점의 심각도와 처리

- **중요한 사용 경로가 변경되지 않는 tag에 의존하는데 tag ruleset이 없음: Blocked** — 릴리스 전에
  ruleset을 적용한다.
- 그 밖의 미비점: **Needs attention** — accepted risk와 다음 release 전에 다시 검토할 조건을 남긴다.
- 적용을 거절했거나 권한이 없는 경우: 설정을 바꾸지 않고 accepted risk와 재검토 조건을 기록한다.
  gap의 존재 자체가 설정 변경의 승인이 되지 않는다.
- not-applicable 판정: 근거와 함께 위험 없음으로 기록한다(accepted risk와 구분).

## 검증 명령

```bash
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/rules/branches/BRANCH
git ls-remote --tags origin
```
