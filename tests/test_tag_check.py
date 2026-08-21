"""M3 continuous tag-check fixtures: E7 ⓒⓔⓕ, I-2, baseline record branch."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from unittest.mock import patch  # noqa: E402

from fixture_builder import record_root_release  # noqa: E402
from git_fixture import _git, build_released_repo, commit_all  # noqa: E402
from skillstead_validate import record_schema  # noqa: E402
from skillstead_validate.gitio import GitError  # noqa: E402
from skillstead_validate.tag_check import RECORD_PATH, run_tag_checks  # noqa: E402

FIXTURE_BASELINE = ("refs/tags/alpha-skill/v1.2.3",)


def _fixture_record(**overrides) -> dict:
    record = {
        "schema": record_schema.SCHEMA,
        "attempt": 1,
        "phase": "prepared",
        "baseline_finalization_sha": "0" * 40,
        "latest_ref": FIXTURE_BASELINE[-1],
        "baseline_tags": list(FIXTURE_BASELINE),
    }
    record.update(overrides)
    return record


def _release_alpha(repo: Path, version: str, prev: str) -> str:
    """Valid release commit for alpha-skill on main + tag; returns sha."""
    skill_md = repo / "skills/alpha-skill/SKILL.md"
    skill_md.write_text(
        skill_md.read_text(encoding="utf-8").replace(f"  version: {prev}", f"  version: {version}")
        + "\nBody change.\n", encoding="utf-8")
    changelog = repo / "skills/alpha-skill/CHANGELOG.md"
    changelog.write_text(
        changelog.read_text(encoding="utf-8").replace(
            f"## [{prev}]", f"## [{version}] — 2026-07-28\n\nEntry.\n\n## [{prev}]", 1),
        encoding="utf-8")
    for fname in ("README.md", "README.ko.md"):
        f = repo / fname
        f.write_text(f.read_text(encoding="utf-8").replace(f"`{prev}`", f"`{version}`"),
                     encoding="utf-8")
    record_root_release(repo, "alpha-skill", version)
    sha = commit_all(repo, f"release alpha {version}")
    _git(repo, "tag", f"alpha-skill/v{version}", sha)
    return sha


def _retire_beta(repo: Path) -> str:
    import shutil
    shutil.rmtree(repo / "skills/beta-skill")
    path = repo / ".skillstead/retirements/beta-skill.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "schema_version": 1,
        "skill": "beta-skill",
        "last_release_ref": "beta-skill/v0.4.0",
        "authorization_id": "owner-20260729-fedcba9876543210",
        "approved_at": "2026-07-29",
        "reason": "The maintained replacement covers this use case.",
        "replacement": None,
    }), encoding="utf-8")
    return commit_all(repo, "retire beta-skill")


class TagCheckFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def checks(self) -> set[str]:
        return {f.check for f in run_tag_checks(self.repo)}

    def test_positive_state_is_green(self) -> None:
        _release_alpha(self.repo, "1.3.0", "1.2.3")
        self.assertEqual(run_tag_checks(self.repo), [])

    # E7-ⓒ: off-main tag — 유효한 release여도 main 밖이면 I-8
    def test_e7c_off_main_tag(self) -> None:
        _git(self.repo, "checkout", "-q", "-b", "side")
        _release_alpha(self.repo, "1.3.0", "1.2.3")
        _git(self.repo, "checkout", "-q", "main")
        self.assertIn("I-8", self.checks())

    # E7-ⓔ: 같은 version을 선언한 다른 main commit으로 repoint —
    # I-2·I-5·I-8 전부 통과하면서 I-3-ⓒ만 잡는다
    def test_e7e_repoint_same_version(self) -> None:
        (self.repo / "NOTES.md").write_text("root doc only\n", encoding="utf-8")
        sha2 = commit_all(self.repo, "root docs change, versions unchanged")
        _git(self.repo, "tag", "-f", "alpha-skill/v1.2.3", sha2)
        findings = run_tag_checks(self.repo)
        checks = {f.check for f in findings}
        self.assertIn("I-3-c", checks)
        self.assertNotIn("I-2", checks)
        self.assertNotIn("I-8", checks)
        self.assertNotIn("I-5", checks)

    # E7-ⓕ: multi-skill release tag의 부분 삭제 → I-5
    def test_e7f_partial_deletion_of_multi_skill_release(self) -> None:
        for skill, prev, version in (("alpha-skill", "1.2.3", "1.3.0"),
                                     ("beta-skill", "0.4.0", "0.5.0")):
            skill_md = self.repo / f"skills/{skill}/SKILL.md"
            skill_md.write_text(
                skill_md.read_text(encoding="utf-8").replace(
                    f"  version: {prev}", f"  version: {version}") + "\nBody.\n",
                encoding="utf-8")
            changelog = self.repo / f"skills/{skill}/CHANGELOG.md"
            changelog.write_text(
                changelog.read_text(encoding="utf-8").replace(
                    f"## [{prev}]", f"## [{version}] — 2026-07-28\n\nEntry.\n\n## [{prev}]", 1),
                encoding="utf-8")
            for fname in ("README.md", "README.ko.md"):
                f = self.repo / fname
                f.write_text(f.read_text(encoding="utf-8").replace(f"`{prev}`", f"`{version}`"),
                             encoding="utf-8")
            record_root_release(self.repo, skill, version)
        sha = commit_all(self.repo, "release alpha 1.3.0 + beta 0.5.0")
        _git(self.repo, "tag", "alpha-skill/v1.3.0", sha)
        _git(self.repo, "tag", "beta-skill/v0.5.0", sha)
        self.assertEqual(run_tag_checks(self.repo), [])
        _git(self.repo, "tag", "-d", "beta-skill/v0.5.0")
        self.assertIn("I-5", self.checks())

    # I-2: tag version과 선언 version 불일치
    def test_i2_tag_version_disagreement(self) -> None:
        head = _git(self.repo, "rev-parse", "HEAD").strip()
        _git(self.repo, "tag", "alpha-skill/v1.9.9", head)
        self.assertIn("I-2", self.checks())

    # tag 문법 위반 (suffix)
    def test_grammar_violation(self) -> None:
        head = _git(self.repo, "rev-parse", "HEAD").strip()
        _git(self.repo, "tag", "alpha-skill/v1.3.0-rc1", head)
        self.assertIn("D3-3", self.checks())


class RetirementHistoryFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def checks(self) -> set[str]:
        return {finding.check for finding in run_tag_checks(self.repo)}

    def test_durable_record_and_removed_package_are_green(self) -> None:
        _retire_beta(self.repo)
        self.assertNotIn("RETIREMENT-HISTORY", self.checks())

    def test_record_first_split_merge_is_permanently_red(self) -> None:
        import shutil
        path = self.repo / ".skillstead/retirements/beta-skill.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "schema_version": 1,
            "skill": "beta-skill",
            "last_release_ref": "beta-skill/v0.4.0",
            "authorization_id": "owner-20260729-8899aabbccddeeff",
            "approved_at": "2026-07-29",
            "reason": "Support ends with the coordinated removal.",
            "replacement": None,
        }), encoding="utf-8")
        commit_all(self.repo, "merge retirement record before removal")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

        shutil.rmtree(self.repo / "skills/beta-skill")
        commit_all(self.repo, "remove package in later merge")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_record_deletion_is_fail_closed(self) -> None:
        _retire_beta(self.repo)
        (self.repo / ".skillstead/retirements/beta-skill.json").unlink()
        commit_all(self.repo, "delete retirement record")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_record_mutation_is_fail_closed(self) -> None:
        _retire_beta(self.repo)
        record = self.repo / ".skillstead/retirements/beta-skill.json"
        record.write_text(
            record.read_text(encoding="utf-8").replace(
                "maintained replacement", "different replacement"),
            encoding="utf-8")
        commit_all(self.repo, "mutate retirement reason")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_delete_and_restore_is_fail_closed(self) -> None:
        _retire_beta(self.repo)
        record = self.repo / ".skillstead/retirements/beta-skill.json"
        original = record.read_text(encoding="utf-8")
        record.unlink()
        commit_all(self.repo, "delete retirement record")
        record.write_text(original, encoding="utf-8")
        commit_all(self.repo, "restore retirement record")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_record_rename_is_fail_closed(self) -> None:
        _retire_beta(self.repo)
        record = self.repo / ".skillstead/retirements/beta-skill.json"
        record.rename(record.with_name("beta-renamed.json"))
        commit_all(self.repo, "rename retirement record")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_package_reactivation_after_record_deletion_is_fail_closed(self) -> None:
        _retire_beta(self.repo)
        (self.repo / ".skillstead/retirements/beta-skill.json").unlink()
        _git(self.repo, "checkout", "HEAD~1", "--", "skills/beta-skill")
        commit_all(self.repo, "silently reactivate beta-skill")
        self.assertIn("RETIREMENT-HISTORY", self.checks())

    def test_history_observation_failure_is_not_skipped(self) -> None:
        _retire_beta(self.repo)
        with patch(
                "skillstead_validate.tag_check.files_at",
                side_effect=GitError("fixture failure")):
            self.assertIn("GIT", self.checks())


class DetachedHeadHydration(unittest.TestCase):
    """R0-F5: 검사들은 checkout 상태(detached HEAD 포함)와 무관하게 명시된
    main ref 기준으로 동작해야 한다 — CI가 PR merge ref나 tag event에서
    실행되기 때문이다."""

    def test_checks_are_checkout_independent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = build_released_repo(Path(tmp) / "repo")
            _release_alpha(repo, "1.3.0", "1.2.3")
            baseline = run_tag_checks(repo, "main")
            head = _git(repo, "rev-parse", "HEAD~1").strip()
            _git(repo, "checkout", "-q", "--detach", head)
            try:
                self.assertEqual(run_tag_checks(repo, "main"), baseline)
            finally:
                _git(repo, "checkout", "-q", "main")


class BaselineRecordBranch(unittest.TestCase):
    """I-3-ⓒ baseline 분기 — 예외는 version 문자열이 아니라 record의
    exact ref membership으로만 성립하며, record 자체는 canonical 값과
    일치해야만 신뢰된다(MR1-F5). fixture는 canonical 상수를 fixture 값으로
    patch하는 test seam을 쓴다."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo", {"alpha-skill": "1.2.3"})
        # 기존 tag 없는 상태에서 record + baseline tag를 만들기 위해 초기 tag 제거
        _git(self.repo, "tag", "-d", "alpha-skill/v1.2.3")
        record_dir = self.repo / ".skillstead"
        record_dir.mkdir()
        (record_dir / "cutover-record.json").write_text(
            json.dumps(_fixture_record()), encoding="utf-8")
        self.record_sha = commit_all(self.repo, "cutover commit with record")
        _git(self.repo, "tag", "alpha-skill/v1.2.3", self.record_sha)
        patcher = patch.object(record_schema, "BASELINE_TAGS", FIXTURE_BASELINE)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._tmp.cleanup)

    def test_baseline_tag_at_record_commit_is_green(self) -> None:
        self.assertEqual(run_tag_checks(self.repo), [])

    def test_baseline_tag_repoint_detected(self) -> None:
        (self.repo / "NOTES.md").write_text("later\n", encoding="utf-8")
        later = commit_all(self.repo, "later commit")
        _git(self.repo, "tag", "-f", "alpha-skill/v1.2.3", later)
        self.assertIn("I-3-c", {f.check for f in run_tag_checks(self.repo)})

    def test_unreadable_record_fails_closed(self) -> None:
        (self.repo / RECORD_PATH).write_text('{"attempt": 1, "attempt": 2}', encoding="utf-8")
        commit_all(self.repo, "corrupt record")
        self.assertIn("RECORD", {f.check for f in run_tag_checks(self.repo)})

    # MR1-F6: 후속 release tag의 "전체" 삭제 — 기존 tag 앵커로는 release
    # commit 자체가 사라져 미검출되던 경로를 record 앵커 파생이 잡는다
    def test_full_deletion_after_record_detected(self) -> None:
        _release_alpha(self.repo, "1.3.0", "1.2.3")
        self.assertEqual(run_tag_checks(self.repo), [])
        _git(self.repo, "tag", "-d", "alpha-skill/v1.3.0")
        self.assertIn("I-5", {f.check for f in run_tag_checks(self.repo)})

    # MR1-F5: 위조 record가 일반 tag를 baseline으로 선언 → RECORD fail-closed
    # + 예외 미적용으로 durable relation이 계속 동작한다
    def test_forged_baseline_list_rejected(self) -> None:
        (self.repo / RECORD_PATH).write_text(
            json.dumps(_fixture_record(baseline_tags=["refs/tags/alpha-skill/v9.9.9"])),
            encoding="utf-8")
        commit_all(self.repo, "forged record")
        checks = {f.check for f in run_tag_checks(self.repo)}
        self.assertIn("RECORD", checks)

    def test_bool_attempt_rejected(self) -> None:
        (self.repo / RECORD_PATH).write_text(
            json.dumps(_fixture_record(attempt=True)), encoding="utf-8")
        commit_all(self.repo, "bool attempt")
        self.assertIn("RECORD", {f.check for f in run_tag_checks(self.repo)})


class CanonicalConstantsGuard(unittest.TestCase):
    """record_schema 상수가 versioning decision record의 고정값과 일치하는지 고정한다."""

    def test_d8_1_values(self) -> None:
        self.assertEqual(record_schema.SCHEMA, "skillstead/cutover-record@1")
        self.assertEqual(record_schema.BASELINE_FINALIZATION_SHA,
                         "3f92c4b3209c26d0b65129965d3cac63b8a1e9dd")
        self.assertEqual(record_schema.BASELINE_TAGS, (
            "refs/tags/docs-claim-check/v0.8.0",
            "refs/tags/github-release-guide/v0.8.0",
            "refs/tags/svg-infographic/v0.8.0",
            "refs/tags/writing-quality-editor/v0.8.0",
        ))
        self.assertEqual(record_schema.LATEST_REF, record_schema.BASELINE_TAGS[-1])
        self.assertEqual(record_schema.PHASES, frozenset({"prepared", "aborted"}))


class ReleaseGraceWindow(unittest.TestCase):
    """Merge→tag window classification: pending is bounded and opt-in.

    Only the event workflow's push/PR job passes ``release_grace_minutes``;
    the default call (release gate, cutover, tag events, periodic) must keep
    today's red on the same state.
    """

    GRACE = 1440

    def setUp(self) -> None:
        # BaselineRecordBranch와 같은 record 앵커 설정 — 실제 repo처럼
        # record-anchored I-5 파생이 활성인 상태에서 window를 재현한다.
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo", {"alpha-skill": "1.2.3"})
        _git(self.repo, "tag", "-d", "alpha-skill/v1.2.3")
        record_dir = self.repo / ".skillstead"
        record_dir.mkdir()
        (record_dir / "cutover-record.json").write_text(
            json.dumps(_fixture_record()), encoding="utf-8")
        self.record_sha = commit_all(self.repo, "cutover commit with record")
        _git(self.repo, "tag", "alpha-skill/v1.2.3", self.record_sha)
        patcher = patch.object(record_schema, "BASELINE_TAGS", FIXTURE_BASELINE)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._tmp.cleanup)

    def _bump_alpha_untagged(self, version: str, prev: str) -> str:
        """Valid release commit for alpha-skill WITHOUT its tag (the
        merge→tag window state)."""
        skill_md = self.repo / "skills/alpha-skill/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8").replace(
                f"  version: {prev}", f"  version: {version}") + "\nBody change.\n",
            encoding="utf-8")
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(
            changelog.read_text(encoding="utf-8").replace(
                f"## [{prev}]", f"## [{version}] — 2026-07-28\n\nEntry.\n\n## [{prev}]", 1),
            encoding="utf-8")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(f.read_text(encoding="utf-8").replace(f"`{prev}`", f"`{version}`"),
                         encoding="utf-8")
        record_root_release(self.repo, "alpha-skill", version)
        return commit_all(self.repo, f"release alpha {version} (tag pending)")

    def _age_head(self, date: str) -> None:
        """Rewrite HEAD's committer (and author) timestamp."""
        import os
        import subprocess
        env = dict(os.environ, GIT_COMMITTER_DATE=date, GIT_AUTHOR_DATE=date)
        subprocess.run(
            ["git", "-C", str(self.repo), "commit", "-q", "--amend",
             "--no-edit", "--date", date],
            capture_output=True, text=True, check=True, env=env)

    def _graced(self) -> tuple[list, list]:
        pending: list = []
        findings = run_tag_checks(
            self.repo, release_grace_minutes=self.GRACE, pending=pending)
        return findings, pending

    def test_window_state_is_pending_with_grace_and_red_without(self) -> None:
        self._bump_alpha_untagged("1.3.0", "1.2.3")
        # Default call: today's fail-closed red is unchanged.
        self.assertIn("I-5", {f.check for f in run_tag_checks(self.repo)})
        # Opted-in event run: visible pending, zero red findings.
        findings, pending = self._graced()
        self.assertEqual(findings, [])
        self.assertEqual([p.check for p in pending], ["I-5-PENDING"])
        self.assertEqual(pending[0].subject, "alpha-skill/v1.3.0")

    def test_grace_expiry_hardens_to_red(self) -> None:
        self._bump_alpha_untagged("1.3.0", "1.2.3")
        self._age_head("2026-01-01T00:00:00 +0000")
        findings, pending = self._graced()
        self.assertIn("I-5", {f.check for f in findings})
        self.assertEqual(pending, [])

    def test_recent_deletion_is_pending_only_for_opted_in_runs(self) -> None:
        # A fresh tag deleted inside the window is indistinguishable from the
        # normal merge→tag gap for a push run; the delete event and the
        # periodic run call without grace and stay red immediately.
        _release_alpha(self.repo, "1.3.0", "1.2.3")
        self.assertEqual(run_tag_checks(self.repo), [])
        _git(self.repo, "tag", "-d", "alpha-skill/v1.3.0")
        self.assertIn("I-5", {f.check for f in run_tag_checks(self.repo)})
        findings, pending = self._graced()
        self.assertEqual(findings, [])
        self.assertEqual([p.check for p in pending], ["I-5-PENDING"])


if __name__ == "__main__":
    unittest.main()
