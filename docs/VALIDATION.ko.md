# 검증·릴리스 도구 체계

*[English (canonical)](./VALIDATION.md) · 한국어*

이 문서는 `tools/skillstead_validate/`의 검증 도구 체계와 그것이 지키는 릴리스 경로를 설명합니다.
버전 규칙 자체는 [`VERSIONING.ko.md`](./VERSIONING.ko.md)에 있고, 이 문서는 그 규칙을 어떻게 검사하고
릴리스를 어떻게 실행하는지를 다룹니다.

> **유지관리자용 참고 문서:** 스킬을 설치하거나 사용하는 데 이 도구 체계를 알 필요는 없습니다.
> Skillstead 자체를 변경하거나 릴리스하는 것이 아니라면 [설치 안내](./INSTALL.ko.md)부터 읽으세요.

모든 판정 로직은 Python 3.11+ 표준 라이브러리만 사용하며 **fail-closed** 방식으로 동작합니다. 도구가
해석하거나 관측할 수 없는 항목은 조용히 통과되지 않고 finding 또는 red verdict가 됩니다.

## 모드

| Mode | 내용 | 실행 시점 | 명령 |
| --- | --- | --- | --- |
| M1 | 저장소 검증 — package 구조, `metadata.version` ↔ 스킬별 CHANGELOG 일치와 루트 CHANGELOG의 현재 버전 수록 여부(I-1), 카탈로그 `Version` 열(I-7), package 완전성(I-9), 라이선스 사본 바이트 일치, active identity 예약어 | 모든 PR, `main` push, 매일 schedule | `PYTHONPATH=tools python3 -m skillstead_validate repo` |
| M2 | 릴리스 preflight와 tag 생성 — 통상 payload diff gate와 exact-record baseline 분기, bump 단계 검사(I-6), inventory·retirement 보호(I-10), major transition 승인, 신규 skill 최초 릴리스, tag 고유성 | 릴리스 제안 시. dry-run 가능 | `… preflight --plan PLAN.json` / `… apply-tags --plan PLAN.json` (`git push --atomic`으로 remote에 발행. push 실패 시 local ref rollback) |
| M2-SVG | `svg-infographic` artifact release gate — exact canonical inventory, clean source identity, package pair 검증, 2× PNG 크기, staging→repository byte 동일성과 source/artifact commit 경계 | 해당 스킬의 M2 preflight 전. read-only | `… svg-release-artifacts --staging STAGING --source-commit SHA [--compare-repository] [--artifact-commit SHA]` |
| M3 | tag·retirement history 지속 검사 — 모든 namespaced tag의 I-2·I-5·I-8, durable expected-target 관계, retirement record 지속성과 identity 재활성화를 매 실행 검사 | 모든 PR, push, tag 생성/삭제, 매일 schedule | `… tags --main-ref origin/main` |
| M4 | cutover verdict — cutover record·INSTALL pin·baseline ref·GitHub Releases에 대한 ordered evaluator | CI 상시 + 모든 릴리스 작업 전후 | `… cutover --live --repo-slug OWNER/REPO` |
| M5 | canonical release wrapper — **GitHub Release 작업의 유일한 지원 경로** | 수동 또는 `release` workflow | `… release --request REQUEST.json --repo-slug OWNER/REPO [--dry-run]` |

종료 코드: green이면 `0`(M4는 red가 아닌 모든 verdict), finding·red verdict·request 거부/실패는
`1`, usage 오류(알 수 없는 mode·필수 인자 누락)는 `2`입니다.

action별 request boolean 제약(request는 의도한 최종 상태와 같아야 합니다):

| action | draft | prerelease | latest_intent | owner_authorization |
| --- | --- | --- | --- | --- |
| create-draft | `true` 필수 | `false` 필수 | 자유 | `recovery_mode != none`이면 필수 |
| publish | `false` 필수 | `false` 필수 | `true` 필수 | `recovery_mode != none`이면 필수 |
| edit-metadata | `false` 필수 | `false` 필수 | Latest 정정 시 `true` | 필수 |

**순서:** `M2 preflight green → M2 apply-tags → M3 → M5`. tag 변경은 preflight를 재실행하는
`apply-tags`를 통해서만 일어납니다. wrapper는 tag를 만들지 않습니다(모든 create에
`--verify-tag`). `gh release …` 직접 호출은 **지원되지 않는 경로**입니다 — 저장소 ruleset에는
admin bypass가 있으므로 이 경계는 hard guarantee가 아니라 discipline입니다.

`svg-infographic`은 M2 전에 clean source commit에서 만든 repository 밖 staging directory를 M2-SVG로
검사합니다. canonical file은 정확히 54개(아홉 TypePack × 두 locale × SVG·receipt·PNG)여야 하며,
receipt canonicalization v2, surface revision 17, 선택한 source commit, clean source flag, live runtime digest,
package verifier 통과와 SVG viewBox의 정확히 두 배인 PNG 크기를 요구합니다. `--compare-repository`는 복사한
byte의 완전 일치를 추가로 검사합니다. artifact commit 뒤 `--artifact-commit`을 사용하면 source commit의
descendant인지, canonical artifact delta가 source snapshot과 staging의 byte가 실제로 다른 파일과 정확히
일치하는지 확인합니다. 추가 delta는 `gallery/model.json`·`gallery/index.html`만 허용합니다. 결정론적으로
같은 SVG·PNG byte는 Git delta에 나타날 필요가 없습니다. package runtime과 contact sheet는 움직일 수
없습니다. 이 명령은 검사만 수행합니다. 생성·복사·commit·tag는 계속 별도 승인 단계입니다.

**발행 직후 재관측 (M5).** 발행 직후에 보낸 읽기는 아직 따라잡지 못한 replica에서 응답할 수 있어,
방금 만든 release가 빠진 목록이 돌아오기도 합니다. wrapper는 **그 경우만** 재시도하며, 판별 기준은
스스로 모순되는 관측입니다 — `Latest`가 요청한 tag를 가리키는데 정작 그 tag가 release 목록에 없는
상태입니다. 목록이 `Latest`가 가리키는 release를 빠뜨릴 수는 없으므로, 목록이 아직 보이지 않는
것뿐입니다.

이 판정은 promotion verdict 두 가지를 모두 덮습니다. stale 목록이 둘 중 무엇을 내는지는 successor
release가 하나라도 보이는지에만 달려 있으므로, cutover 이후 **첫** 통상 release는 같은 staleness를
`CV-LATEST-STEADY`가 아니라 `CV-LATEST-INITIAL`로 보고합니다. baseline Release가 아직 덜 보이는
목록은 두 검사에 닿기 전에 판정되므로, cutover 진행 중에는 이 재시도가 적용되지 않습니다.

그 밖의 경우는 red를 그대로 유지합니다. **실제 Latest 오배치**는 모양이 다릅니다 — `Latest`가 목록에
존재하되 기대한 tag가 아닙니다. Release 누락, 정규화할 수 없는 release 객체(`CV-DOMAIN` — 발행된
release의 `published_at`이 null이거나 빈 문자열인 경우 포함), transport 실패도 마찬가지입니다.

재시도는 세 가지로 제한됩니다: 최대 **3회** 재관측, **1초 / 2초 / 4초** backoff, 첫 stale 읽기부터
측정하는 **10초** wall-clock 상한. 이 상한은 deadline으로 transport까지 전달되어 페이지 단위 release
호출의 **매 페이지 직전에 다시 검사**되므로, 이미 시작된 요청 하나도 상한을 넘길 수 없습니다 —
요청당 timeout만으로는 한 페이지만 제한할 뿐 루프 전체를 제한하지 못합니다. wrapper는 재관측이 어떻게
끝났는지를 최초 stale verdict와 함께 보고하며, `resolved`가 아닌 경우 그 최초 verdict를 그대로
반환합니다.

| 종료 이유 | 의미 |
| --- | --- |
| `resolved` | 재관측이 더 이상 스스로 모순되지 않아 verdict를 다시 계산했습니다 |
| `retry-exhausted` | 세 번의 재관측이 모두 여전히 stale이었습니다 |
| `total-cap` | wall-clock 상한에 도달했거나, deadline이 지나 transport가 요청을 시작하지 않았습니다 |
| `observation-failed` | deadline과 무관한 이유로 재관측이 실패했습니다(예: CLI 자체 오류) |

마지막 두 값을 나눈 것은 의도적입니다. transport 오류를 timeout으로 보고하면 실행이 관측하지 않은
사실을 말하게 됩니다.

## CI workflow

| 파일 | trigger | 목적 |
| --- | --- | --- |
| `validate.yml` | PR, `main` push, tag 생성/삭제 | event 기반 검증을 병렬 job으로 실행 — package suite와 validator self-test suite가 경량 검사(M1+gallery+M3+M4+skills-ref) 옆에서 돌고, `validate` aggregate job이 기존 check 이름을 유지. PR에서는 diff가 해당 suite의 입력을 건드릴 때만 무거운 두 suite를 실행(`skills/**` / `tools/**`+`tests/**`; workflow 변경은 둘 다 실행, diff 판독 불가 시 전체 실행). push는 항상 전체 실행. tag event는 명시적 `main` checkout으로 M3+M4 실행, branch 생성/삭제 event는 아무것도 실행하지 않음 |
| `validate-periodic.yml` | 매일 schedule(`17 3 * * *` UTC), 수동 dispatch | event가 발생하지 않는 상태 변화(예: push 밖의 tag repoint)를 잡는 주기적 안전망 |
| `release.yml` | 수동 dispatch 전용 | M5 wrapper 진입점. dry-run이 기본값이며 checkout이 `main`에 고정되어 있어 dispatch가 미검토 wrapper나 request를 write token으로 실행할 수 없음 |

두 검증 workflow는 별도 파일입니다 — 어느 한쪽의 비활성화(저장소 60일 미활동 시 GitHub의
schedule workflow 자동 비활성화 포함)가 다른 쪽을 침묵시키지 않도록 하기 위해서입니다.
event 없는 변경의 명목상 최대 탐지 지연은 schedule 주기 1회(~24시간) + 스케줄러 지연입니다.
schedule workflow가 자동 비활성화되면 다음 활동 후 Actions 탭에서 재활성화하거나 수동
dispatch로 1회 실행하십시오.

모든 job은 전체 이력과 tag를 checkout합니다(`fetch-depth: 0`) — 아래의 first-parent 파생이
이를 요구합니다.

## Release plan (M2 입력)

```json
{
  "target_commit": "<main 위의 sha 또는 ref>",
  "releases": [
    {"skill": "<name>", "previous_ref": "<name>/vX.Y.Z 또는 null",
     "proposed_version": "X.Y.Z", "proposed_ref": "refs/tags/<name>/vX.Y.Z"}
  ]
}
```

preflight는 직전 릴리스 이후 **payload**가 변한 skill 집합과 plan의 집합이 정확히 일치할 때만
green입니다 — plan에서 빠진 변경 skill은 I-3, payload가 변하지 않았는데 plan에 있는 skill은
I-4 finding입니다. payload는 정확히 두 개의 bookkeeping 산출물(`metadata.version` scalar,
`CHANGELOG.md`)을 제외합니다(`VERSIONING.ko.md` 참조).

추가 검사: target commit은 전체 M1 검증을 통과하고 `main` first-parent history에 있어야 합니다.
bump 단계는 major transition 분기가 적용되는 경우를 제외하면 경로 기본값과 일치해야 합니다.
한 단계 major transition에는 아래의 정확한 추적 승인 record가 필요하고, inventory 감소에는 아래의
정확한 retirement record와 전체 제거 predicate가 필요합니다. 신규 skill의 최초 릴리스는 package와
양쪽 카탈로그 행을 target commit에서 함께 도입해야 하고, 기존 tag와 SemVer precedence가 같은
버전(`+build` alias 포함)은 만들 수 없습니다.

일회성 baseline 분기는 target에 canonical prepared cutover record가 있을 때만 활성화됩니다. Plan은
record의 `baseline_tags` 네 항목과 순서까지 같아야 하고, 모든 항목은 `previous_ref: null`과 버전
`0.8.0`을 사용해야 하며, target은 현재 attempt가 `main` first-parent history에 처음 등장한
commit이어야 합니다. T1과 T2도 유지되어 최초 attempt는 `1`, 이후 값은 정확히 1씩 증가해야 합니다.
이 baseline에는 통상 I-3/I-4/I-6과 신규 skill의 `0.1.0`·same-commit 규칙을 적용하지 않습니다.
하지만 package·catalog 검사, tag 문법과 고유성, `main` ancestry, 네 ref의 exact atomicity, I-10은
그대로 적용합니다. Baseline I-10은 target inventory를 `baseline_finalization_sha:skills`와 비교하며,
감소가 하나라도 있으면 finding입니다.

## 추적 transition 증거

두 증거 유형은 모두 strict JSON object입니다. 알 수 없거나 중복된 key, 잘못된 type,
path/content identity 불일치, 잘못된 날짜와 관측 불가 상태는 fail-closed입니다.
`authorization_id`는 `owner-YYYYMMDD-<16 lowercase hex>` 형식이어야 하고 그 날짜는
`approved_at`과 같아야 합니다. 이 식별자는 저장소 안에서 사용하는 allowlist handle이지 승인자를
암호학적으로 증명하지 않습니다. Identity 권한은 owner가 통제하는 review와 merge 경계에 남습니다.

자유 서술인 `reason`은 비어 있지 않은 중립 설명이어야 합니다. 비공개 tracker 식별자, local
absolute path, 저장소·외부 URL을 포함할 수 없습니다. Validator는 이 한정된 hygiene pattern을
검사합니다. 그 밖의 민감하거나 식별 가능한 내용은 owner가 정확한 record와 diff를 검토하는 것이
최종 기준입니다.

### Retirement record

경로: `.skillstead/retirements/<skill>.json`

```json
{
  "schema_version": 1,
  "skill": "<skill>",
  "last_release_ref": "<skill>/vX.Y.Z 또는 null",
  "authorization_id": "owner-YYYYMMDD-<16 lowercase hex>",
  "approved_at": "YYYY-MM-DD",
  "reason": "<중립적이고 공개 가능한 설명>",
  "replacement": null
}
```

Package, 양쪽 active catalog row, 양쪽 INSTALL pin은 같은 target tree에서 모두 사라져야 합니다.
`README.md`에는 `## Retired skills`, `README.ko.md`에는 `## 은퇴한 스킬` table과 각 언어의
3열 header가 있어야 합니다. 두 table에는 다음 material row를 정확히 추가해야 합니다.

```text
| `<skill>` | `<last_release_ref 또는 unreleased>` | [record](./.skillstead/retirements/<skill>.json) |
```

`last_release_ref`는 관측 가능한 최신 namespaced release와 같아야 합니다. 그런 release가 하나도
없을 때만 `null`이어야 하므로, release가 있는데 `null`인 경우와 release가 없는데 string인 경우를
모두 fail-closed합니다.

M2는 target inventory를 관측 가능한 최신 release commit과 target의 immediate parent inventory
합집합에 비교합니다. Parent 비교는 최신 release 뒤 도입됐지만 아직 release되지 않은 package를 이
target에서 제거하는 경우를 포함하며, 이때 `last_release_ref: null`을 사용해야 합니다.

Record는 package, 양쪽 active catalog row, 양쪽 INSTALL pin을 제거하고 두 retired-table row를
추가하는 동일한 `main` first-parent commit에서 처음 나타나야 합니다. Record만 먼저 merge하면 안
됩니다. Split merge는 active package와 retirement record가 공존한 이력을 영구히 남기므로 이후
모든 M3가 red를 유지합니다. Record 삭제나 재작성으로는 이 history를 복구할 수 없습니다.

그 뒤 M3가 전체 `main` first-parent history를 읽습니다. 유효한 retirement record가 한 번
나타나면 고정 path와 semantic value가 계속 존재해야 합니다. 삭제, rename, mutation,
delete-and-restore, retired identity 재활성화는 finding입니다. M3는 지속적인 release-operation
gate이므로 required check가 없는 환경에서 위반이 이미 merge되면 merge 후 red가 됩니다. 이 문서는
validator가 모든 merge를 막는다고 주장하지 않습니다. False positive나 contract 결함의 복구에는
owner 승인 contract amendment가 필요합니다. Record 직접 수정이나 history 편집은 지원하지 않습니다.

V1은 공개 전 identity 변경만 지원합니다. 공개 후 이름 변경은 in-place rename이 아닙니다. 기존
identity는 retirement로 처리하고 새 identity는 별도 승인된 skill로 도입합니다.

### Major transition 승인 record

경로: `.skillstead/major-approvals/<skill>-v<proposed_version>.json`

```json
{
  "schema_version": 1,
  "skill": "<skill>",
  "previous_ref": "<skill>/vX.Y.Z",
  "proposed_version": "X.Y.Z",
  "authorization_id": "owner-YYYYMMDD-<16 lowercase hex>",
  "approved_at": "YYYY-MM-DD",
  "reason": "<중립적이고 공개 가능한 설명>"
}
```

이 record는 제안이 한 단계 major transition일 때만 적용됩니다. Path, `skill`, `previous_ref`,
`proposed_version`이 해당 transition에 결속합니다. Payload는 여전히 정확한 pull request review와
merge로 승인하며, 이 record가 임의 payload를 승인하지는 않습니다. 그 사이 다른 release가 생기면
관측되는 최신 `previous_ref`가 바뀌므로 record는 fail-closed로 무효가 됩니다.

V1에서 major-approval record에는 retirement record와 달리 first-parent 지속성 권한을 부여하지
않습니다. Immutable version tag target이 승인된 transition 증거를 보존하고, tag precedence가
version 재사용을 막으며, M3가 tag 삭제와 retarget을 차단합니다. 이 lifecycle 비대칭은 의도한
것입니다. Retirement record는 현재 inventory의 부재를 계속 승인하지만 major-approval record는
완료된 transition 하나만 승인합니다.

### Template identity와 validator 회전

`templates/skill-package/`는 disposable scaffold입니다. `sample-skill`은 예약 identity이므로 active
`skills/` 아래에 있으면 M1이 거부합니다. Materialized package를 검증하기 전에 모든 identity
surface를 바꾸십시오. Template 안에는 두 번째 package validator가 없습니다.

INSTALL pin, lifecycle-state syntax 또는 다른 production validator contract를 회전하는 변경은 같은
pull request에서 production validator와 관련 real-repository fixture를 함께 갱신해야 합니다.
그러면 문서, 실행 gate, consumer 형태 example이 한 revision에 유지됩니다.

**Bump-Adjustment marker.** 제안된 단계가 경로 기본값과 다르면 해당 릴리스의 CHANGELOG entry에
독립된, 비어 있지 않은 사유 줄이 있어야 합니다:

```text
Bump-Adjustment: <기본 단계를 조정한 이유>
```

빈 marker, 다른 entry 안의 marker, 긴 줄 속에 섞인 marker는 인정되지 않습니다.

## tag 지속 검사 (M3)

모든 `<name>/vX.Y.Z` tag에 대해 매 실행:

* **문법** — `<name>/vMAJOR.MINOR.PATCH`만. pre-release·build suffix 금지.
* **I-2** — peeled target commit이 tag의 버전을 정확히 선언한다.
* **I-8** — peeled target이 `main` 위의 commit이다.
* **I-5** — 관측된 릴리스 commit에서 버전이 바뀐 모든 skill의 tag가 존재한다(존재만 검사 —
  대상 정확성은 다음 검사의 몫). cutover record가 생긴 뒤에는 `main` first-parent 버전 변경에서
  기대 tag 집합을 독립적으로 파생하므로 릴리스의 tag를 *전부* 삭제해도 검출된다.
* **release grace window (event run 한정)** — 릴리스 절차는 version-bump commit이 merge된 뒤에야
  tag를 만들기 때문에, merge와 tag 생성 사이에 실행되는 push/PR run은 구조적으로 tag 부재를
  관측합니다. 그 job만 `--release-grace-minutes 1440`을 전달합니다: version-change commit이
  window보다 젊은 누락 tag는 red run 대신 가시적 `I-5-PENDING` 통지 + exit 0으로 분류됩니다.
  그 외는 전부 fail-closed red를 유지합니다 — window보다 오래된 변경, 관측 불가 timestamp,
  그리고 flag 없이 실행되는 모든 경로(release gate, cutover evaluator, tag 생성/삭제 event,
  periodic schedule. branch 생성/삭제 event는 tag 상태와 무관하므로 이제 M3를 실행하지
  않습니다). 따라서 실제로 삭제된 tag는 delete event에서 즉시 red가 되고, 끝내 생성되지 않은
  tag는 window 경과 후 다음 periodic run에서 red로 굳습니다.
* **expected target** — tag를 보지 않고 파생한다: 일반 tag는 `main` first-parent에서 해당
  skill의 선언 버전이 그 버전으로 바뀐 가장 오래된 commit, baseline tag 4개(record의 exact ref
  membership으로만 판정 — 버전 문자열 비교 아님)는 record가 도입된 commit. 다른 곳을 가리키는
  tag는 repoint finding이다.

비교는 peeled commit SHA로 합니다 — 이 저장소 이력에는 annotated와 lightweight tag가 섞여
있어 tag object SHA는 같은 tag를 다르게 판정할 수 있습니다.

## Cutover verdict (M4)

evaluator는 매 실행 관측에서 cutover 상태를 재산출하며 verdict를 저장하지 않습니다. 입력:
`docs/INSTALL.md`와 `docs/INSTALL.ko.md`를 합친 pin inventory,
`.skillstead/cutover-record.json`의 record, baseline ref 4개, GitHub Releases 목록(전체 페이지 —
pagination 미완주나 타입을 정할 수 없는 release 객체는 `CV-DOMAIN`), 저장소 Latest, `main`
first-parent history.

두 INSTALL 파일은 하나의 normative 관측 표면입니다. 양쪽의 ordered `(ref, copy_skill)` sequence와
개별 pin class가 모두 같아야 하며, 하나라도 다르면 combined class는 `PIN-OTHER`입니다. `Q-SAME`은
record와 두 파일의 실제 `PIN-LEGACY → PIN-BASELINE` 전환이 같은 commit에 있어야 합니다. Public
breakage clock도 combined history를 사용하며, combined `PIN-LEGACY`에서 가장 최근에 벗어난 시점부터
기산합니다. 한국어 mirror가 생기기 전 commit은 `PIN-OTHER`로 분류되지만, 이후 관측 가능한 cutover
departure보다 clock을 과거로 당기지는 않습니다.

verdict: `not-started` · `pending-tags` · `tags-ok` · `complete` · `aborted` · `red`(error
code 포함). 실패에는 `candidate=`/`predicate=` detail이 붙습니다.

| Code | 의미 | 해소 |
| --- | --- | --- |
| CV-ORPHAN | record 없이 pin·ref·release가 움직임 | 되돌리거나 정식 cutover commit 생성 |
| CV-SCHEMA | record가 schema(S1~S10) 위반 | record 교체(baseline ref가 없는 동안만) |
| CV-ATTEMPT | attempt sequence 위반. **모든 attempt 증가는 `T3-unprovable`** — 직전 attempt의 ref 부재는 기계 증명이 불가하므로 재시도는 cutover ⓪의 owner gate를 요구 | owner 절차 |
| CV-ABORT-TAGS / CV-ABORT-PIN | aborted record인데 ref 존재 / pin이 legacy가 아님 | owner 판단 / pin 되돌리기 |
| CV-PARTIAL-TAGS | baseline ref 4개 중 1~3개만 존재 | 집합 완성 — atomic 실패 잔재라면 owner 판단 선행 |
| CV-PIN | combined EN/KO pin inventory가 단계와 불일치 | 두 INSTALL 파일을 같은 commit에서 수정 |
| CV-SAME / CV-BASE / CV-TREE | cutover commit이 record와 두 INSTALL inventory를 함께 전환하지 않음 / baseline SHA 도달 불가 / `skills/` tree drift | cutover commit 재생성(ref 0개일 때만) |
| CV-CLOCK | public breakage 구간(pin 전환 후 tag 생성 전)이 1시간 초과 | tag 생성 완료 또는 revert |
| CV-TARGET / CV-FROZEN | baseline tag repoint / ref 존재 후 record 변경(삭제·복원 포함) | owner 결정 — tag는 삭제하지 않음 |
| CV-RELEASE | 발행된 release가 P1(prerelease 금지)·P2(제목에 `<skill> X.Y.Z` 포함)·P3(본문 첫 줄 exact Latest marker) 위반, 또는 후속 tag가 tag gate 실패 | wrapper를 통한 owner 승인 metadata 정정 |
| CV-PREMATURE | cutover 완료 전에 통상 release가 발행됨 | wrapper를 통한 owner accept-forward |
| CV-LATEST-INITIAL / CV-LATEST-STEADY | 저장소 Latest가 기대 release가 아님 | wrapper를 통한 owner 승인 Latest 정정 |
| CV-DOMAIN | Releases 관측을 완주·정규화할 수 없음 | 재실행. transport 실패 해소 |
| CV-OBSERVE | git 관측 실패(이 code는 도구가 정의한 것이고 나머지는 상위 decision record가 고정) | 재실행. 저장소 접근 해소 |

P3의 exact marker(고정, English, trim 후 바이트 비교):

```text
> **Latest** refers to the most recently published individual skill release, not a catalog version.
```

### Abort, 재시도, forward recovery

baseline ref가 하나도 없을 때는 두 INSTALL 파일을 `PIN-LEGACY`로 복구하고 record를
`phase: aborted`로 바꾸는 commit 하나로 attempt를 중단할 수 있습니다. `skills/**`는 바꾸지
않습니다. 재시도는 새 cutover commit과 `attempt: N+1`로 시작합니다. 도구는 T1, T2, aborted
predecessor, combined legacy pin 복구를 검사합니다. 하지만 이전 attempt가 현재는 삭제된 ref를 만든
적이 없는지는 증명할 수 없습니다. 따라서 owner가 cutover ⓪에서 ref 부재를 직접 확인하고 기록할
때까지 M4는 `CV-ATTEMPT` / `T3-unprovable`로 fail-closed 상태를 유지합니다. 이 절차적 승인을 기계
증명이라고 보고하지 않습니다.

baseline ref가 하나라도 생긴 뒤에는 record, tag, target을 바꿀 수 없습니다. Recovery는
forward-only입니다. Tag를 삭제하거나 retarget하지 말고 record를 다시 쓰지 마세요.
`CV-PREMATURE`가 발생하면 다음 7단계를 따릅니다.

1. 추가 release 발행을 중지합니다.
2. premature Release와 tag를 통상 gate와 P1–P3로 검사합니다.
3. 유효하면 owner의 accept-forward 승인을 받습니다. 되돌리지 않습니다.
4. metadata만 틀렸다면 owner 승인 후 wrapper로 정정합니다.
5. immutable target 자체가 틀렸다면 중단하고 별도 remediation으로 escalation합니다.
6. 기존 객체를 삭제하거나 retarget하지 않고 빠진 baseline Release를 모두 발행합니다.
7. **Latest**를 실제 최신 public Release에 맞춘 뒤 M3, M4, wrapper postcondition을 다시 실행합니다.

## Release wrapper (M5)

request 파일:

```json
{
  "action": "create-draft | publish | edit-metadata",
  "recovery_mode": "none | premature-accept-forward | metadata-correction",
  "tag": "<name>/vX.Y.Z",
  "title": "…",
  "body": "…",
  "draft": false,
  "prerelease": false,
  "latest_intent": true,
  "owner_authorization": null
}
```

`owner_authorization`은 `edit-metadata`와 `none`이 아닌 모든 `recovery_mode`에 필수입니다.
wrapper는: evaluator를 실행하고, 아래 허용 행렬로 작업을 판정하고(판정 키는 verdict·error
code·action·recovery mode의 조합 — recovery는 포괄 우회가 될 수 없음), tag 실재·P1~P3·전체
tag 표면의 M3 green(어떤 finding이든 mutation 차단)을 확인하고, 허용된 `gh release
create`/`edit`만 검증된 metadata를 정확히 적용해 실행하고, evaluator를 재실행해 publish
후에는 **Latest가 방금 발행한 tag와 정확히 같을 것**을 요구합니다 — evaluator의 steady-state
검사보다 강한 조건입니다.

| Verdict | 허용 |
| --- | --- |
| not-started / aborted / pending-tags | 없음 |
| tags-ok | record가 선언한 baseline ref 중 release가 없는 것의 create-draft/publish |
| complete | 통상 gate를 통과하는 release의 create-draft/publish |
| red / CV-RELEASE | offending release의 owner 승인 metadata 정정 |
| red / CV-LATEST-* | 기대 release의 owner 승인 Latest 정정 |
| red / CV-PREMATURE | owner accept-forward: 빠진 baseline release와 Latest 정정 |
| red / 그 밖 | 없음 |

## 규격 reference validator (skills-ref)

`tools/run_skills_ref.py`는 agent skills 규격의 reference validator를 보조 검사로 실행하며
정확한 upstream commit에 pin되어 있습니다:

| 항목 | 값 |
| --- | --- |
| Source | `https://github.com/agentskills/agentskills` — `skills-ref/` subdirectory |
| Pin | commit `38a2ff82958afee88dadf4831509e6f7e9d8ef4e` (exact. 업그레이드는 의도적·검토된 pin 변경으로만) |
| Upstream license | Apache-2.0 |
| 제약 | upstream 스스로 demonstration-only reference 구현이며 production 용도가 아니라고 명시 |
| 이것이 검사하는 것 | frontmatter 필수 필드와 name↔folder 일치 |
| 검사하지 않는 것 | 라이선스 pointer resolution, 라이선스 바이트 일치, SemVer 형식, CHANGELOG 일치, 카탈로그 열 — 전부 `skillstead_validate` 소관 |

교체 조건 — 다음 중 하나가 성립하면 pin을 올리거나 의존을 제거합니다: upstream이 production
준비를 선언하거나 규격이 실질 개정되어 pin이 더 이상 규격을 반영하지 못할 때, pin을 통한
조달이 반복 실패할 때, `skillstead_validate`가 규격 수준 검사를 흡수해 reference 실행이
불필요해질 때. pin된 validator의 조달·실행 실패는 빌드를 실패시킵니다(fail-closed).
