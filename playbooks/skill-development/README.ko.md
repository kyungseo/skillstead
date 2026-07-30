# 스킬 개발 Playbook

[English](./README.md) · **한국어**

Skillstead 스킬을 설계하고 검증·리뷰·릴리스하며, 필요한 경우 지원을 종료할 때 사용하는 유지관리자
참고 문서입니다. 설치형 스킬이 아니며, 설치된 패키지는 이 디렉터리 없이도 완전해야 합니다.

## 시작 순서

1. [패키지 표준](./skill-package-standard.ko.md)을 읽습니다.
2. [개발 절차](./skill-development-procedure.ko.md)를 따릅니다.
3. [스킬 패키지 템플릿](./templates/skill-package/)을 일회용 작업 공간에 복사하고 예약된 이름을
   교체한 뒤, 실제 패키지 형태로 검증합니다.
4. 필요한 경우 시나리오, 예상 결과, 검증 원장, 리뷰 전달, 릴리스 노트 템플릿을 사용합니다.
5. 프로젝트별 결정과 원본 리뷰 근거는 대상 저장소에 남깁니다.

## 문서

| 경로 | 용도 |
| --- | --- |
| [`skill-package-standard.ko.md`](./skill-package-standard.ko.md) | 패키지, 의도, 이름, 안전, 근거, 두 언어 문서와 리뷰 기준 |
| [`skill-development-procedure.ko.md`](./skill-development-procedure.ko.md) | 의도 설명부터 릴리스 또는 지원 종료까지의 순서 |
| [`templates/skill-package/`](./templates/skill-package/) | 예약 이름을 사용하는 유효한 시작 패키지 |
| [`templates/scenarios.ko.md`](./templates/scenarios.ko.md) | 긍정·부정 시나리오 템플릿 |
| [`templates/expected-outcomes.ko.md`](./templates/expected-outcomes.ko.md) | 별도 정답표 템플릿 |
| [`templates/validation-ledger.ko.md`](./templates/validation-ledger.ko.md) | 반복 가능한 근거·주장 원장 |
| [`templates/cross-review-relay.ko.md`](./templates/cross-review-relay.ko.md) | 역할에 종속되지 않는 독립 리뷰 전달 자료와 제한된 회차 기록 |
| [`templates/release-note.ko.md`](./templates/release-note.ko.md) | 스킬별 릴리스 노트 템플릿 |
| [`examples/standard-gap-mapping.ko.md`](./examples/standard-gap-mapping.ko.md) | 현재 카탈로그와 표준의 대응 관계 |
| [`examples/disposable-sample-validation.ko.md`](./examples/disposable-sample-validation.ko.md) | 공식 검사기로 확인한 패키지 템플릿 검증 근거 |

영문이 최종 기준입니다. `.ko.md` 파일은 같은 핵심 주장, 조건, 위험과 행동을 자연스러운 한국어로
전달합니다. 의미가 바뀌는 내용은 같은 pull request에서 두 언어에 함께 반영합니다.

## 권위 경계

이 playbook은 작성 표준의 최종 기준입니다. 실행 가능한 저장소·릴리스 검사는
[`docs/VALIDATION.ko.md`](../../docs/VALIDATION.ko.md)가 정의합니다. 누가 변경을 승인할지는 대상
저장소의 승인 절차가 결정합니다. 리뷰 도구는 리뷰를 실행하거나 기록할 수 있지만, 해당 작업이 선언한
역할·근거·결정 경계를 대신하지 않습니다.

문서와 실행 가능한 검사가 충돌하면 중단합니다. 문서로 검사를 약화하거나 절차를 임의로 다시
해석하지 말고, 계약을 해결한 뒤 문서와 검증 자료를 함께 갱신합니다.
