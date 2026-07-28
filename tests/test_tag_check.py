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

from git_fixture import _git, build_released_repo, commit_all  # noqa: E402
from skillstead_validate import record_schema  # noqa: E402
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
    sha = commit_all(repo, f"release alpha {version}")
    _git(repo, "tag", f"alpha-skill/v{version}", sha)
    return sha


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
    """record_schema 상수가 DR-819 D8-1의 고정값과 일치하는지 고정한다."""

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


if __name__ == "__main__":
    unittest.main()
