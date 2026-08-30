"""Focused contract tests for Skillstead's event-driven CI routing."""

from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

from skillstead_validate.ci_scope import OUTPUT_KEYS, SELF_PATH, classify  # noqa: E402


class CiScopeClassifier(unittest.TestCase):
    def assert_scope(self, paths, *, svg: bool, validator: bool) -> None:
        self.assertEqual(
            classify(paths),
            {"svg_infographic": svg, "validator": validator},
        )

    def test_output_key_set_is_exact(self):
        self.assertEqual(OUTPUT_KEYS, ("svg_infographic", "validator"))
        self.assertEqual(tuple(classify([])), OUTPUT_KEYS)

    def test_non_svg_surfaces_skip_both_heavy_suites(self):
        for path in (
            "skills/writing-quality-editor/SKILL.md",
            "examples/writing-quality-editor/fixture.md",
            "docs/VALIDATION.md",
            "gallery/index.html",
        ):
            with self.subTest(path=path):
                self.assert_scope([path], svg=False, validator=False)

    def test_svg_package_and_repository_examples_run_both_suites(self):
        for path in (
            "skills/svg-infographic/README.md",
            "examples/svg-infographic/release-announcement/example.svg",
            "examples/svg-infographic/typepacks/process-flow/example.svg",
        ):
            with self.subTest(path=path):
                self.assert_scope([path], svg=True, validator=True)

    def test_validator_implementation_and_tests_run_only_validator_suite(self):
        for path in ("tools/run_skills_ref.py", "tests/test_gallery.py"):
            with self.subTest(path=path):
                self.assert_scope([path], svg=False, validator=True)

    def test_workflow_and_classifier_changes_fail_closed_to_both(self):
        for path in (".github/workflows/pages.yml", ".github/FUNDING.yml", SELF_PATH):
            with self.subTest(path=path):
                self.assert_scope([path], svg=True, validator=True)

    def test_git_quoted_path_fails_closed_to_both(self):
        self.assert_scope(
            ['"skills/svg-infographic/\\355\\225\\234.svg"'],
            svg=True,
            validator=True,
        )

    def test_empty_and_mixed_path_sets(self):
        self.assert_scope([], svg=False, validator=False)
        self.assert_scope(
            ["docs/VALIDATION.md", "tools/run_skills_ref.py", "skills/svg-infographic/x"],
            svg=True,
            validator=True,
        )

    def test_cli_emits_exact_github_output(self):
        proc = subprocess.run(
            [sys.executable, "-m", "skillstead_validate.ci_scope"],
            cwd=REPO,
            env={"PYTHONPATH": str(REPO / "tools")},
            input="skills/writing-quality-editor/SKILL.md\n",
            text=True,
            capture_output=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout, "svg_infographic=false\nvalidator=false\n")


class WorkflowContract(unittest.TestCase):
    def test_validate_wires_the_exact_scope_output_and_rejects_unknown_values(self):
        text = (REPO / ".github/workflows/validate.yml").read_text(encoding="utf-8")
        self.assertIn("name: validate / ${{ github.event_name }}", text)
        self.assertIn("`validate / pull_request` is the", text)
        self.assertIn("name: validator-suite / ${{ matrix.shard }}", text)
        self.assertIn("fail-fast: false", text)
        self.assertIn("max-parallel: 4", text)
        self.assertIn("shard: [0, 1, 2, 3]", text)
        self.assertIn(
            'tools/run_unittest_shard.py --shard-index "${{ matrix.shard }}" '
            "--shard-count 4",
            text,
        )
        self.assertIn("svg_infographic: ${{ steps.diff.outputs.svg_infographic }}", text)
        self.assertIn("if: needs.scope.outputs.svg_infographic == 'true'", text)
        self.assertIn('"${{ needs.scope.outputs.svg_infographic }}"', text)
        self.assertNotIn("needs.scope.outputs.package", text)
        self.assertIn('*) fail "$name has unknown scope decision', text)
        self.assertIn("git -c core.quotePath=off diff --name-only --no-renames", text)

    def test_periodic_validation_uses_the_same_four_process_shards(self):
        text = (REPO / ".github/workflows/validate-periodic.yml").read_text(
            encoding="utf-8")
        self.assertIn("name: validator-suite / ${{ matrix.shard }}", text)
        self.assertIn("fail-fast: false", text)
        self.assertIn("max-parallel: 4", text)
        self.assertIn("shard: [0, 1, 2, 3]", text)
        self.assertIn(
            'tools/run_unittest_shard.py --shard-index "${{ matrix.shard }}" '
            "--shard-count 4",
            text,
        )
        self.assertIn("  checks:\n    runs-on: ubuntu-latest", text)

    def test_main_push_uses_observed_ancestor_diff_and_fails_closed(self):
        text = (REPO / ".github/workflows/validate.yml").read_text(encoding="utf-8")
        self.assertIn("GITHUB_EVENT_BEFORE: ${{ github.event.before }}", text)
        self.assertIn("0000000000000000000000000000000000000000) run_all", text)
        self.assertIn('git cat-file -e "${GITHUB_EVENT_BEFORE}^{commit}"', text)
        self.assertIn(
            'git merge-base --is-ancestor "${GITHUB_EVENT_BEFORE}" HEAD || run_all',
            text,
        )
        self.assertIn('diff_base="${GITHUB_EVENT_BEFORE}"', text)
        self.assertNotIn(
            'if [ "${GITHUB_EVENT_NAME}" != "pull_request" ]; then', text)
        self.assertNotIn(
            "if: github.event_name == 'pull_request'\n        with:\n          fetch-depth: 0",
            text,
        )

    def test_pull_request_m3_checks_candidate_while_push_checks_main(self):
        text = (REPO / ".github/workflows/validate.yml").read_text(encoding="utf-8")
        self.assertIn("main_ref=origin/main", text)
        self.assertIn(
            'if [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then', text)
        self.assertIn("main_ref=HEAD", text)
        self.assertEqual(text.count('--main-ref "$main_ref"'), 1)

    def test_pages_automatic_deploy_is_canonical_only_and_manual_is_explicit(self):
        text = (REPO / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn(
            "if: github.repository == 'kyungseo/skillstead' || "
            "github.event_name == 'workflow_dispatch'",
            text,
        )


if __name__ == "__main__":
    unittest.main()
