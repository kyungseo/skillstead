# sample-skill

[English](./README.md) · **한국어**

Validator와 호환되는 구체적인 authoring template이며, catalog에 설치하는 skill이 아닙니다.
`skills/` 아래에 materialize하기 전에 모든 `sample-skill` identity를 교체하고 intent·procedure를
다시 작성하며 repository root license를 byte-for-byte로 복사합니다.

Target repository root에서 해당 저장소의 production M1 명령(Skillstead에서는
`PYTHONPATH=tools python3 -m skillstead_validate repo`)으로 materialized disposable repository를
검증합니다. Active inventory는 예약 이름 `sample-skill`을 거부합니다.
