# Post-public Verification

repository visibility를 public으로 바꾼 직후 실행한다.

## GitHub State

- [ ] Repository visibility가 public이다.
- [ ] Default branch가 맞다.
- [ ] Description과 topics가 보이고 정확하다.
- [ ] Issues / Discussions 설정이 의도한 상태다.
- [ ] Branch protection 또는 ruleset이 active다.
- [ ] Release tag ruleset이 applicability에 맞게 active이거나, not-applicable 근거가 기록되어 있다
      (판정 기준: `recurring-release-protection-checkpoint.md`).
- [ ] Branch protection/ruleset을 아직 두지 않는다면 이유와 재검토 trigger를 accepted risk로 기록했다.
- [ ] owner/admin bypass가 필요한 workflow라면 실제 bypass 가능 상태다.
- [ ] 장기 브랜치가 실수로 삭제되지 않도록 보호되어 있다.
- [ ] Vulnerability alerts가 enabled다.
- [ ] Secret scanning이 가능하다면 enabled다.
- [ ] Secret scanning push protection이 가능하다면 enabled다.
- [ ] Open security alerts를 검토했다.

## Fresh Clone

임시 디렉토리에 public clone을 받고 README quick start를 실행한다.

```bash
tmpdir=$(mktemp -d)
git clone https://github.com/OWNER/REPO.git "$tmpdir/REPO"
cd "$tmpdir/REPO"
```

그 다음 대상 repo의 documented setup과 verification command를 실행한다.

## Public Surface

- [ ] README가 GitHub에서 잘 렌더링된다.
- [ ] 링크가 동작한다.
- [ ] 이미지와 gallery가 렌더링된다.
- [ ] examples가 접근 가능하다.
- [ ] license가 올바르게 표시된다.
- [ ] 내부용 문서가 public 첫 화면에 과하게 드러나지 않는다.
- [ ] profile pinned repository로 지정할지 결정했다.

## Release Tag

최종 정비가 끝난 뒤 첫 public release version을 확정하고 tag와 GitHub Release를 생성한다.
타이틀·notes 작성 기준은 `github-public-release-checklist.md` §10을 따른다.

README, install docs, package metadata가 특정 tag/version을 가리키는 repo라면 visibility 변경 전에 tag를 먼저 준비한다.
GitHub Release 객체는 public 전후 상황에 맞게 publish할 수 있지만, public 전환 직후 사용자가 따라 하는 pinned command가 깨지면 안 된다.

- [ ] release version을 정했다. 예: `v1.0.0`
- [ ] tag가 default branch의 public-ready commit을 가리킨다.
- [ ] §10 체크리스트에 따라 타이틀과 notes를 준비했다.
- [ ] GitHub Release를 publish했다.

## Security Follow-up

- [ ] Dependabot alerts가 clean이거나 의도적으로 기록되어 있다.
- [ ] public visibility 이후 새로 사용 가능해진 security feature를 설정했다.
- [ ] public 전환 후에만 보이는 alert가 생기면 즉시 triage한다.

## Record

최종 결과를 대상 repo에 기록한다.

- visibility 변경일
- 확인한 settings
- 사용할 수 없던 settings와 이유
- validation commands
- accepted risks
