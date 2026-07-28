"""M2 release-gate fixtures: E7 ⓐⓑⓓ, I-6, E14, §D3-3, plan fail-closed."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from git_fixture import (_git, build_released_repo, build_unreleased_repo,  # noqa: E402
                         commit_all, entry, plan_json)
from skillstead_validate.release_gate import apply_tags, preflight  # noqa: E402
from skillstead_validate.release_plan import PlanError, parse_plan  # noqa: E402


def _bump_alpha(repo: Path, version: str, *, adjustment: bool = False) -> None:
    """Write bookkeeping for an alpha-skill release: version + CHANGELOG + catalog."""
    skill_md = repo / "skills/alpha-skill/SKILL.md"
    skill_md.write_text(
        skill_md.read_text(encoding="utf-8").replace("  version: 1.2.3", f"  version: {version}"),
        encoding="utf-8")
    changelog = repo / "skills/alpha-skill/CHANGELOG.md"
    reason = "Bump-Adjustment: path default overridden — fixture reason.\n\n" if adjustment else ""
    changelog.write_text(
        changelog.read_text(encoding="utf-8").replace(
            "## [1.2.3]", f"## [{version}] — 2026-07-28\n\n{reason}Fixture entry.\n\n## [1.2.3]", 1)
        .replace(f"## [{version}] — 2026-07-28 — 2026-07-24", f"## [{version}] — 2026-07-28"),
        encoding="utf-8")
    for fname in ("README.md", "README.ko.md"):
        f = repo / fname
        f.write_text(f.read_text(encoding="utf-8").replace("`1.2.3`", f"`{version}`"), encoding="utf-8")


class ReleaseGateFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def _preflight(self, entries: list[dict]) -> set[str]:
        plan = parse_plan(plan_json("HEAD", entries))
        return {f.check for f in preflight(self.repo, plan)}

    # 정상 release: payload 변경(minor 경로) + minor bump + CHANGELOG + catalog
    def test_positive_release_is_green(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nNew body paragraph.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.3.0")
        commit_all(self.repo, "release alpha 1.3.0")
        self.assertEqual(self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]), set())

    # E7-ⓐ: payload 변경 + 미bump (plan에 없음) → I-3
    def test_e7a_payload_change_without_release(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nChanged.\n", encoding="utf-8")
        commit_all(self.repo, "change payload without bump")
        self.assertIn("I-3", self._preflight([]))

    # E7-ⓑ: bookkeeping-only bump → I-4
    def test_e7b_bookkeeping_only_bump(self) -> None:
        _bump_alpha(self.repo, "1.2.4")
        commit_all(self.repo, "bookkeeping-only bump")
        self.assertIn("I-4", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))

    # E7-ⓓ: marker 없는 inventory 감소 → I-10 (fail-closed)
    def test_e7d_inventory_reduction_without_marker(self) -> None:
        import shutil
        shutil.rmtree(self.repo / "skills/beta-skill")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(
                "\n".join(l for l in f.read_text(encoding="utf-8").splitlines()
                          if "beta-skill" not in l) + "\n", encoding="utf-8")
        commit_all(self.repo, "remove beta-skill without marker")
        self.assertIn("I-10", self._preflight([]))

    # I-6: 경로 기본값 minor를 patch로 내렸는데 사유 없음 → I-6; 사유 있으면 green
    def test_i6_adjustment_requires_reason(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nTypo fix.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.2.4")
        commit_all(self.repo, "patch bump for minor-default path")
        self.assertIn("I-6", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))

    def test_i6_adjustment_with_reason_is_green(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nTypo fix.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.2.4", adjustment=True)
        commit_all(self.repo, "patch bump with recorded reason")
        self.assertEqual(self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]), set())

    # E14: major bump는 승인 증거 형식 확정 전 무조건 거부
    def test_e14_major_bump_fail_closed(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nBreaking.\n", encoding="utf-8")
        _bump_alpha(self.repo, "2.0.0")
        commit_all(self.repo, "major bump")
        self.assertIn("E14", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "2.0.0")]))

    # §D3-3 tag 고유성: 동일 precedence tag 재사용 거부
    def test_tag_uniqueness(self) -> None:
        self.assertIn("D3-3", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.3")]))

    # §D3-3 신규 skill 최초 release: catalog 행 누락 → I-7
    def test_new_skill_requires_catalog_rows(self) -> None:
        pkg = self.repo / "skills/gamma-skill"
        pkg.mkdir(parents=True)
        (pkg / "SKILL.md").write_text(
            "---\nname: gamma-skill\nlicense: LICENSE.txt\nmetadata:\n  version: 0.1.0\n---\n",
            encoding="utf-8")
        (pkg / "CHANGELOG.md").write_text(
            "# Changelog — gamma-skill\n\n## [0.1.0] — 2026-07-28\n\nInitial.\n", encoding="utf-8")
        (pkg / "LICENSE.txt").write_text(
            (self.repo / "LICENSE").read_text(encoding="utf-8"), encoding="utf-8")
        commit_all(self.repo, "add gamma without catalog rows")
        self.assertIn("I-7", self._preflight([entry("gamma-skill", None, "0.1.0")]))

    # apply-tags: preflight 위반 시 거부, green이면 계획된 tag를 생성
    def test_apply_tags_refuses_on_findings(self) -> None:
        _bump_alpha(self.repo, "1.2.4")
        commit_all(self.repo, "bookkeeping-only bump")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))
        with self.assertRaises(RuntimeError):
            apply_tags(self.repo, plan)

    def test_apply_tags_creates_planned_tags(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nNew body paragraph.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.3.0")
        commit_all(self.repo, "release alpha 1.3.0")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))
        self.assertEqual(apply_tags(self.repo, plan), ["alpha-skill/v1.3.0"])


class MR1Fixtures(unittest.TestCase):
    """중간 리뷰 ①의 probe 재현 fixture — 회귀 고정."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_released_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def _release_body_change(self, version: str = "1.3.0") -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nNew body paragraph.\n", encoding="utf-8")
        _bump_alpha(self.repo, version)

    def _preflight(self, entries: list[dict]) -> set[str]:
        plan = parse_plan(plan_json("HEAD", entries))
        return {f.check for f in preflight(self.repo, plan)}

    # MR1-F1: 기존 skill release에서 license 삭제 → I-9
    def test_f1_license_deletion_caught_at_target(self) -> None:
        self._release_body_change()
        (self.repo / "skills/alpha-skill/LICENSE.txt").unlink()
        commit_all(self.repo, "release without licence copy")
        self.assertIn("I-9", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))

    # MR1-F1: KO catalog stale → I-7
    def test_f1_stale_ko_catalog_caught_at_target(self) -> None:
        self._release_body_change()
        ko = self.repo / "README.ko.md"
        ko.write_text(ko.read_text(encoding="utf-8").replace("`1.3.0`", "`1.2.3`"),
                      encoding="utf-8")
        commit_all(self.repo, "release with stale KO version cell")
        self.assertIn("I-7", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))

    # MR1-F2: off-main target은 mutation 전에 거부된다
    def test_f2_off_main_target_rejected(self) -> None:
        _git(self.repo, "checkout", "-q", "-b", "side")
        self._release_body_change()
        commit_all(self.repo, "release on side branch")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))
        checks = {f.check for f in preflight(self.repo, plan, main_ref="main")}
        _git(self.repo, "checkout", "-q", "main")
        self.assertIn("I-8", checks)

    # MR1-F2: 동일 SemVer precedence alias(+build) 검출
    def test_f2_precedence_alias_rejected(self) -> None:
        head = _git(self.repo, "rev-parse", "HEAD").strip()
        _git(self.repo, "tag", "alpha-skill/v1.3.0+build", head)
        self._release_body_change()
        commit_all(self.repo, "release 1.3.0")
        self.assertIn("D3-3", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))

    # MR1-F2: 다중 tag는 단일 transaction으로 생성된다 (positive)
    def test_f2_multi_tag_transaction(self) -> None:
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
        commit_all(self.repo, "dual release")
        plan = parse_plan(plan_json("HEAD", [
            entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0"),
            entry("beta-skill", "beta-skill/v0.4.0", "0.5.0")]))
        self.assertEqual(apply_tags(self.repo, plan),
                         ["alpha-skill/v1.3.0", "beta-skill/v0.5.0"])

    # MR1-F3: package가 이전 commit에 먼저 들어온 신규 skill → D3-3
    def test_f3_new_skill_split_across_commits_rejected(self) -> None:
        pkg = self.repo / "skills/gamma-skill"
        pkg.mkdir(parents=True)
        (pkg / "SKILL.md").write_text(
            "---\nname: gamma-skill\nlicense: LICENSE.txt\nmetadata:\n  version: 0.1.0\n---\n",
            encoding="utf-8")
        (pkg / "CHANGELOG.md").write_text(
            "# Changelog — gamma-skill\n\n## [0.1.0] — 2026-07-28\n\nInitial.\n", encoding="utf-8")
        (pkg / "LICENSE.txt").write_text(
            (self.repo / "LICENSE").read_text(encoding="utf-8"), encoding="utf-8")
        commit_all(self.repo, "add gamma package only")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(f.read_text(encoding="utf-8").replace(
                "| --- | --- | --- | --- | --- |",
                "| --- | --- | --- | --- | --- |\n| [`gamma-skill`](./skills/gamma-skill) | Fixture | `0.1.0` | Claude Code | Beta |",
                1), encoding="utf-8")
        commit_all(self.repo, "add gamma catalog rows later")
        self.assertIn("D3-3", self._preflight([entry("gamma-skill", None, "0.1.0")]))

    # MR1-F4: 빈 marker는 사유가 아니다
    def test_f4_empty_adjustment_marker_rejected(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nTypo fix.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.2.4")
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(
            changelog.read_text(encoding="utf-8").replace(
                "Fixture entry.", "Bump-Adjustment:\n\nFixture entry."),
            encoding="utf-8")
        commit_all(self.repo, "patch bump with empty marker")
        self.assertIn("I-6", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))

    # MR1-F4: 다른 entry의 marker는 이 release의 사유가 아니다
    def test_f4_marker_in_other_entry_rejected(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nTypo fix.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.2.4")
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(
            changelog.read_text(encoding="utf-8").replace(
                "## [1.2.3] — 2026-07-24",
                "## [1.2.3] — 2026-07-24\n\nBump-Adjustment: reason recorded on the wrong entry."),
            encoding="utf-8")
        commit_all(self.repo, "marker on previous entry")
        self.assertIn("I-6", self._preflight([entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))

    # MR1-F8: pre-cutover + 빈 plan = 진짜 no-op green
    def test_f8_pre_cutover_empty_plan_is_green(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = build_unreleased_repo(Path(tmp) / "repo")
            plan = parse_plan(plan_json("HEAD", []))
            self.assertEqual(preflight(repo, plan), [])


class GitFailClosed(unittest.TestCase):
    # 경계 (b): git/history 조회 실패는 통과가 아니라 finding이다
    def test_unresolvable_target_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = build_released_repo(Path(tmp) / "repo")
            plan = parse_plan(plan_json("deadbeef" * 5, []))
            checks = {f.check for f in preflight(repo, plan)}
            self.assertIn("GIT", checks)


class PlanParsingFailClosed(unittest.TestCase):
    def test_duplicate_json_key_rejected(self) -> None:
        text = '{"target_commit": "HEAD", "target_commit": "HEAD", "releases": []}'
        with self.assertRaises(PlanError):
            parse_plan(text)

    def test_unknown_key_rejected(self) -> None:
        with self.assertRaises(PlanError):
            parse_plan('{"target_commit": "HEAD", "releases": [], "extra": 1}')

    def test_duplicate_skill_rejected(self) -> None:
        entries = [entry("alpha-skill", None, "0.1.0"), entry("alpha-skill", None, "0.1.0")]
        with self.assertRaises(PlanError):
            parse_plan(plan_json("HEAD", entries))


if __name__ == "__main__":
    unittest.main()
