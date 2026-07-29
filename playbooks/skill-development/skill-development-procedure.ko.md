# Skill Development Procedure

[English](./skill-development-procedure.md) · **한국어**

사용자 권한이나 public support claim을 실수로 넓히지 않으면서 intent를 self-contained,
evidence-backed skill로 만드는 절차입니다.

## 1. 작업 범위 설정

사용자 결과, non-goal, 변경 파일, validation, risk, reversal cost, approval owner를 기록합니다.
Package 내부 guidance를 적용하기 전에 host repository의 artifact·state·release·mutation workflow를
확인합니다.

Intent가 구체화된 뒤에만 working name을 정합니다. 아직 public catalog row, install pin, release
identity는 만들지 않습니다.

## 2. Intent contract 작성

Named, natural-language, negative, ambiguous, mutation, host-precedence scenario를 작성합니다.
Expected outcome은 별도 answer key에 둡니다. Fresh reviewer가 볼 수 있는 input 범위를 명시합니다.

다음을 확인합니다.

- skill을 선택해야 하는 요청과 선택하면 안 되는 요청;
- read-only 또는 no-mutation 기본값;
- explicit approval이 필요한 행동;
- 안전한 failure·recovery;
- runtime·locale evidence가 필요한 claim.

## 3. 공개 전 identity 확정

Working-name 후보를 행동의 명확성, collision, folder/frontmatter 정합성, 길이로 비교합니다.
Trigger-overlap case를 실행합니다. 그다음 Owner가 첫 public catalog 등록 또는 release 전에 canonical
name을 유지하거나 변경합니다.

이름을 바꾸면 folder, frontmatter, display text, README link, install command, example, index,
validation fixture, 예정된 release identity를 승인된 한 변경에서 갱신합니다. V1은 공개 후 in-place
rename을 지원하지 않습니다.

## 4. Package materialization

`templates/skill-package/`을 disposable repository에 복사합니다. `skills/`로 옮기기 전에 모든
`sample-skill` identity를 교체해야 합니다. Production validator는 active inventory의 예약 이름을
거부합니다.

Package를 self-contained하게 유지합니다. Repository root license를 byte-for-byte로 복사합니다.
Entrypoint 사용성이 나빠질 때만 required reference를 추가합니다. 동작에 꼭 필요하고 symlink
invocation positive·negative fixture가 준비되지 않았다면 executable script를 추가하지 않습니다.

## 5. 사용자 문서 작성

그럴듯한 일반 설명이 아니라 intent·evidence ledger를 근거로 작성합니다. Use·do-not-use case,
approval·mutation boundary, failure behavior, host-workflow precedence를 적습니다. 관측한 evidence보다
runtime, locale, maturity를 확대하지 않습니다.

English를 canonical로 작성합니다. 한국어 mirror는 문장 구조를 복사하지 않고 핵심 의미를 보존하면서
한국어 독자에게 자연스럽게 구성합니다.

## 6. Validation

최소 검증:

1. materialized disposable repository에 official M1 repository validator 실행;
2. 적용 가능한 positive, negative, ambiguous, mutation, host-precedence scenario 실행;
3. package license containment와 byte equality 확인;
4. folder/frontmatter/catalog/install/release identity 확인;
5. English·한국어 claim, condition, link, limitation, next action 확인;
6. public evidence를 repository-relative path로 정리;
7. raw result와 residual risk를 validation ledger에 기록.

Template 안에 두 번째 package validator를 만들지 않습니다.

## 7. Review

Independent review가 변경 위험에 비례할 때 `templates/cross-review-relay.ko.md`를 사용합니다.
Repository의 기존 review workflow나 review-recording tool이 relay를 실행할 수 있습니다.

Reviewer는 문장뿐 아니라 contract와 evidence를 검토합니다. Driver는 모든 finding을 disposition합니다.
Recheck는 열린 named finding만 다룹니다. Blocker, scope expansion, round bound 소진 뒤 미합의는
arbiter에게 올립니다. Review approval 자체는 commit, publication, tag 변경, release operation을
승인하지 않습니다.

## 8. Integration과 release

Package, fixture, evidence가 일치한 뒤 root catalog와 maintainer entrypoint를 갱신합니다. Per-skill
versioning·release gate를 따릅니다. INSTALL pin, validator lifecycle state, supported syntax가 바뀌면
production validator와 관련 real-repository fixture를 같은 pull request에서 회전합니다.

Publish 전에 release note를 준비합니다. Versioned unit은 하나의 `skills/<name>/` package입니다.
GitHub source archive는 repository snapshot이며 standalone package artifact가 아닙니다.

Merge-to-tag 구간의 임시 red를 숨기지 않습니다. 실제 merge target과 remote ref를 관측한 뒤 문서에
정한 bounded path만 다시 실행합니다. 예상하지 못한 code나 partial ref는 Owner가 결정합니다.

Publish 단계 자체에는 그런 판단이 필요하지 않습니다. Release wrapper는 발행 직후의 관측이 스스로
모순될 때에 **한해서만** 정해진 예산 안에서 재관측하고 그 결과를 보고합니다. 따라서 wrapper가 돌려준
red는 이미 그 재시도를 견딘 결과이므로, 타이밍 문제가 아니라 실제 finding으로 읽고 red를 없애려고
publish를 다시 실행하지 않습니다.

## 9. 지원 종료 시 retirement

Retirement는 active skill에 적용하며 disposable pre-publication material에는 적용하지 않습니다.

1. Package, 양쪽 active catalog row, 양쪽 INSTALL 문서, reference, support claim을 inventory합니다.
2. [`docs/VALIDATION.ko.md`](../../docs/VALIDATION.ko.md)의 strict schema를 따르는
   `.skillstead/retirements/<skill>.json`, package·catalog·pin 제거, 양쪽 retired-table row를 하나의
   merge candidate로 준비합니다.
3. Record가 full removal과 동일한 `main` first-parent merge commit에서 처음 나타나는지 확인합니다.
   Record만 먼저 merge하면 permanent M3 red history가 생깁니다.
4. Current `main`을 기반으로 한 disposable repository에서 예상 merge tree를 한 commit으로 만든 뒤
   M1, M2 preflight, 해당 commit을 `--main-ref`로 지정한 M3, link, public-hygiene check를 실행합니다.
5. Owner가 merge 전에 exact record, 예상 merge commit, full-removal diff를 검토합니다.

Tracked record는 변경 없이 남깁니다. 같은 identity로 package를 다시 추가하는 것은 지원하지 않습니다.
False positive나 contract defect는 Owner가 승인한 contract amendment로 해결하며, history를 수정하거나
record를 직접 고치는 것은 지원되는 recovery가 아닙니다.
