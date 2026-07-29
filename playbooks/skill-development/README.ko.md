# Skill Development Playbook

[English](./README.md) · **한국어**

Skillstead skill을 설계하고 검증·리뷰·릴리스하며, 필요한 경우 은퇴시킬 때 사용하는 maintainer
참고 문서입니다. 설치형 skill이 아니며, 설치된 package는 이 디렉터리 없이도 완전해야 합니다.

## 시작 순서

1. [package 표준](./skill-package-standard.ko.md)을 읽습니다.
2. [개발 절차](./skill-development-procedure.ko.md)를 따릅니다.
3. [skill-package template](./templates/skill-package/)을 disposable workspace에 복사하고 예약된
   identity를 교체한 뒤 materialized package를 검증합니다.
4. 필요한 경우 scenario, expected outcome, validation ledger, review relay, release note template을
   사용합니다.
5. 프로젝트별 결정과 raw review evidence는 대상 repository에 남깁니다.

## 문서

| 경로 | 용도 |
| --- | --- |
| [`skill-package-standard.ko.md`](./skill-package-standard.ko.md) | package, intent, naming, safety, evidence, bilingual, review 기준 |
| [`skill-development-procedure.ko.md`](./skill-development-procedure.ko.md) | intent brief부터 release 또는 retirement까지의 순서 |
| [`templates/skill-package/`](./templates/skill-package/) | 예약 identity를 사용하는 유효한 시작 package |
| [`templates/scenarios.ko.md`](./templates/scenarios.ko.md) | positive·negative scenario template |
| [`templates/expected-outcomes.ko.md`](./templates/expected-outcomes.ko.md) | 분리된 answer key template |
| [`templates/validation-ledger.ko.md`](./templates/validation-ledger.ko.md) | 반복 가능한 evidence·claim ledger |
| [`templates/cross-review-relay.ko.md`](./templates/cross-review-relay.ko.md) | 역할 중립 independent review packet과 bounded-round 기록 |
| [`templates/release-note.ko.md`](./templates/release-note.ko.md) | skill별 release note template |
| [`examples/standard-gap-mapping.ko.md`](./examples/standard-gap-mapping.ko.md) | 현재 catalog와 표준의 mapping |
| [`examples/disposable-sample-validation.ko.md`](./examples/disposable-sample-validation.ko.md) | package template의 official-validator proof |

English가 canonical입니다. `.ko.md` 파일은 동일한 핵심 주장·조건·위험·행동을 자연스러운 한국어로
전달합니다. 의미가 달라지는 변경은 두 언어에 같은 pull request로 반영합니다.

## 권위 경계

이 playbook은 authoring 표준을 소유합니다. 실행 가능한 repository·release gate는
[`docs/VALIDATION.ko.md`](../../docs/VALIDATION.ko.md)가 소유합니다. 누가 변경을 승인할지는 대상
repository의 approval workflow가 결정합니다. Review 도구는 리뷰를 실행하거나 기록할 수 있지만,
해당 작업이 선언한 역할·evidence·결정 경계를 대신하지 않습니다.

문서와 executable gate가 충돌하면 중단합니다. 문서로 gate를 약화하거나 절차를 임의로 다시 해석하지
말고, contract를 해결한 뒤 문서와 fixture를 함께 갱신합니다.
