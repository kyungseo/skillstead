# Skill Package Standard

[English](./skill-package-standard.md) · **한국어**

Skillstead skill에 필요한 최소 package·evidence contract를 설명합니다. 각 규칙은 명시된 조건이
성립할 때만 적용하며, 일부 package에서 관측한 패턴을 모든 skill의 의무로 일반화하지 않습니다.

## Package 경계

설치 단위는 완전한 `skills/<name>/` 폴더입니다. 설치 뒤에는 `playbooks/`, repository 전용 example,
private note, package 밖의 파일에 의존하면 안 됩니다.

필수 항목:

- lowercase-hyphen `name`, 정확한 사용·비사용 경계, package 내부 license pointer,
  `MAJOR.MINOR.PATCH` 형식의 `metadata.version`을 가진 `SKILL.md`;
- 최상단 released version이 `metadata.version`과 같은 `CHANGELOG.md`;
- root Apache-2.0 license와 byte가 같은 사본;
- instruction에 필요한 모든 required reference, script, asset, agent file.

`SKILL.md` entrypoint는 얇게 유지합니다. 상세 내용이 entrypoint를 흐리게 할 때만 `references/`로
분리합니다. 안전하거나 정확한 행동에 reference가 필수라면 반드시 로드하도록 지시하고, 읽을 수 없으면
fail-closed합니다. Optional reference는 한계를 밝히고 degrade할 수 있습니다.

## Intent와 안전

문서를 쓰기 전에 다음을 기록합니다.

- 사용자 결과와 skill 이름을 직접 쓰는 예시;
- 자연어로 요청했을 때 skill을 선택해야 하는 사례;
- 비슷하지만 선택하면 안 되는 사례;
- ambiguous case와 read-only 또는 no-mutation 기본값;
- mutation, approval, destructive effect, recovery;
- 우선 적용해야 하는 host artifact workflow.

Description에는 skill이 하는 일과 하지 않는 일을 함께 적습니다. 자연어 요청만으로 mutation authority를
넓히면 안 됩니다. Host가 문서 분류, repository state, release approval 같은 artifact workflow를
소유한다면 package 내부의 writing·analysis guidance보다 먼저 그 workflow를 따릅니다.

## Naming lifecycle

1. intent와 trigger example을 작성합니다.
2. working name을 정합니다.
3. 행동의 명확성, collision, 64자 lowercase-hyphen 제한으로 후보를 비교합니다.
4. trigger-overlap fixture를 실행합니다.
5. folder, frontmatter, display text, README, install pin, index, release identity를 하나의 map으로 확인합니다.
6. Owner가 첫 public catalog 등록 또는 release 전에 canonical name을 유지하거나 변경합니다.
7. 이름을 바꾸면 승인된 한 변경에서 pre-publication rename cascade를 닫습니다.

Template identity `sample-skill`은 예약어입니다. `skills/` 아래에 materialize하기 전에 반드시
교체해야 합니다. V1은 공개 후 in-place identity rename을 지원하지 않습니다. 필요해지면 기존
identity의 retirement와 새 identity의 신규 skill 도입을 별도 승인 작업으로 다룹니다.

Naming example은 절차만 보여 주며 다른 product의 canonical name을 결정하지 않습니다.

## Validation과 claim

Scenario와 expected outcome을 분리합니다. 적용 가능한 경우 positive, negative, ambiguous, mutation,
host-precedence, fresh-context case를 포함합니다. 정확한 package revision, runtime/capability surface,
input, output, finding, residual risk를 기록합니다.

문서 리뷰가 성공했거나 참여 agent 수가 많다는 이유로 support를 추론하지 않습니다. Runtime, locale,
maturity claim은 관측한 evidence 범위로 제한합니다. Public evidence에는 repository-relative path를
사용하고 username, local absolute path, private tracker identifier, model/session identity, 무관한
comparison provenance를 제거합니다.

두 언어가 있으면 English package guidance가 canonical입니다. 한국어 문서는 claim, condition, risk,
identifier, link, limitation, approval, next action을 보존해야 하며 문장 수가 같을 필요는 없습니다.

## Independent review

Public behavior, approval·mutation boundary, release·retirement, 여러 consumer surface 또는 실질적인
reversal cost에 영향을 주는 변경에는 independent review를 사용합니다. 작은 기계적 변경은 대상
repository가 별도로 요구하지 않는 한 필수가 아닙니다.

도구 이름 대신 역할을 사용합니다.

- `driver`: scope, evidence, change, finding disposition 소유;
- `reviewer`: 전제, fixture, hidden cost, unsupported claim 검토;
- `specialist`: 필요할 때 한정된 concern 검토;
- `arbiter`: 미해결 정책, scope expansion, 최종 approval 결정.

Target revision, review scope, finding, driver response, residual risk, arbiter decision을 artifact로
남깁니다. Driver는 finding마다 `accept`, `revise`, `defend`, `needs-user`를 기록합니다. Recheck는
열린 named finding만 다루며 전체 설계를 다시 열지 않습니다. 시작 전에 round bound 또는 escalation
규칙을 정하고, bound에 도달해도 합의되지 않으면 무한 반복하지 않고 arbiter가 결정합니다.

Agent가 여러 명이라고 독립성이 증명되지는 않습니다. Reviewer의 fresh context 여부, answer key를
보지 않았는지, agent별 artifact 또는 격리된 tree를 사용했는지 기록합니다. Host review workflow나
review-recording tool이 이 contract를 실행할 수 있지만, package는 특정 product 하나를 요구하면
안 됩니다.

## Release, retirement, change control

[`docs/VERSIONING.ko.md`](../../docs/VERSIONING.ko.md)와
[`docs/VALIDATION.ko.md`](../../docs/VALIDATION.ko.md)를 따릅니다. Major transition에는 target-bound
tracked approval record가 필요합니다. 이 record는 version transition만 승인하며 payload approval은
exact pull request review·merge에 남습니다.

Active skill을 제거하려면 retirement record와 full-removal predicate가 필요합니다. Retirement
record는 durable evidence이므로 삭제·변경하거나 package를 조용히 다시 추가해 우회할 수 없습니다.
과거 문서는 맥락으로 남길 수 있지만 active install·support claim처럼 읽히면 안 됩니다.

Release가 INSTALL pin, validator lifecycle state, supported syntax를 바꾸면 production validator와
관련 real-repository fixture를 같은 pull request에서 갱신합니다.
