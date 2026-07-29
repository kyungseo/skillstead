# Disposable Package Validation

The repository test `test_materialized_template_passes_production_m1` proves that the concrete package template
can become a valid active package without a second validator or a reserved-name bypass.

## Procedure

1. Create a disposable synthetic repository that already passes M1.
2. Copy `playbooks/skill-development/templates/skill-package/`.
3. Replace every `sample-skill` identity with `example-skill`.
4. Copy the synthetic repository's root license over the package license.
5. Add matching English and Korean active catalog rows.
6. Run the production `run_repo_validation` entrypoint.

Expected result: zero findings.

Control: copying the package into active inventory without replacing `sample-skill` produces
`RESERVED-NAME`.

## Evidence Boundary

This fixture proves package shape, identity replacement, license byte equality, changelog/version agreement, and
catalog coverage under M1. It does not prove trigger behavior, runtime support, release readiness, or public-user
adoption. Paths in recorded output must be repository-relative; do not publish temporary-directory names.
