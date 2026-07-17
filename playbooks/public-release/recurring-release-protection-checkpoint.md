# Recurring Release Protection Checkpoint

이미 public인 repo가 새 버전을 release하기 전에 release surface protection을 확인하는 독립
checkpoint다. 첫 공개 전환 시점(§8)에만 확인하고 끝내면 이후 릴리스가 반복되는 동안 보호 상태가
다시 확인되지 않는다 — 이 checkpoint는 **매 version release 전에** 재사용한다.

## Applicability 판정 (매번 먼저)

- [ ] repo의 release convention을 확인한다: version tag로 release하는가? tag namespace는 무엇인가?
      (monorepo는 `pkg-a/v1.2.3`처럼 `/`를 포함할 수 있다 — ruleset fnmatch에서 `*`는 `/`를 넘지
      않으므로 별도 pattern이 필요하다.)
- [ ] immutable tag에 의존하는 release-critical consumer path가 있는지 확인한다 — pinned install,
      tag-pinned clone, dependency 참조, CI checkout.
- [ ] tag 없이(branch snapshot 등) release하는 repo라면 tag ruleset은 **not-applicable** — 근거를
      기록하고 branch 항목만 확인한다. 이는 위험 수용이 아니라 근거 있는 no-risk disposition이다.

## 확인 항목

- [ ] default branch ruleset/protection이 active다 (deletion 차단, non-fast-forward 차단, PR 필수,
      CI가 있으면 required checks).
- [ ] release tag ruleset이 active다 (기존 tag update/deletion 차단, creation 비제한, narrow admin
      bypass — `repo-settings-template.md` 기준).
- [ ] ruleset pattern이 실제 release tag namespace와 일치한다 (match/overreach를 tag 목록으로 확인).
- [ ] plan/permission 제약을 확인했다 (private repo의 rulesets·protected branches는
      Pro/Team/Enterprise 필요 — 2026-07-17 기준, `repo-settings-template.md` 참조).

## Gap 처분 (severity)

- **release-critical consumer path가 있는 repo의 tag ruleset 부재: Blocked** — 릴리스 전에 적용한다.
- 그 외 gap: **Needs attention** — 명시적 accepted risk와 다음 release 전 재검토 trigger를 남긴다.
- 적용을 거절했거나 권한이 없는 경우: 무변경 상태를 유지하고 accepted risk·revisit trigger를 기록한다.
  gap의 존재 자체가 설정 변경의 승인이 되지 않는다.
- not-applicable 판정: 근거와 함께 no-risk disposition으로 기록한다(accepted risk와 구분).

## 검증 명령

```bash
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/rules/branches/BRANCH
git ls-remote --tags origin
```
