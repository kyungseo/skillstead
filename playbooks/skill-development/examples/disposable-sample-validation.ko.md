# Disposable Package Validation

Repository test `test_materialized_template_passes_production_m1`은 두 번째 validator나 reserved-name
bypass 없이 concrete package template을 유효한 active package로 만들 수 있음을 확인합니다.

## Procedure

1. M1을 이미 통과하는 disposable synthetic repository를 만듭니다.
2. `playbooks/skill-development/templates/skill-package/`을 복사합니다.
3. 모든 `sample-skill` identity를 `example-skill`로 교체합니다.
4. Synthetic repository의 root license를 package license에 덮어씁니다.
5. 일치하는 English·한국어 active catalog row를 추가합니다.
6. Production `run_repo_validation` entrypoint를 실행합니다.

예상 결과: finding 0건.

Control: `sample-skill`을 교체하지 않고 active inventory에 복사하면 `RESERVED-NAME` finding이
발생합니다.

## Evidence Boundary

이 fixture는 M1 기준 package shape, identity replacement, license byte equality,
changelog/version agreement, catalog coverage를 확인합니다. Trigger behavior, runtime support, release
readiness, public-user adoption은 증명하지 않습니다. 기록 output에는 repository-relative path만
사용하고 temporary-directory 이름을 공개하지 않습니다.
