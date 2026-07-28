"""M1 package-structure fixtures.

Negative fixtures ①~④ are the package-structure defects the C3 fixture
contract requires this validator to catch, plus fail-closed parse coverage.
The positive fixture guards against false alarms.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_builder import build_valid_repo  # noqa: E402
from skillstead_validate.package_check import run_repo_validation  # noqa: E402


class PackageCheckFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_valid_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def checks(self) -> set[str]:
        return {f.check for f in run_repo_validation(self.repo)}

    def test_positive_fixture_is_green(self) -> None:
        self.assertEqual(run_repo_validation(self.repo), [])

    # ① license pointer 부재·외부 경로
    def test_license_pointer_missing_file(self) -> None:
        (self.repo / "skills/alpha-skill/LICENSE.txt").unlink()
        self.assertIn("I-9", self.checks())

    def test_license_pointer_escapes_package(self) -> None:
        skill_md = self.repo / "skills/alpha-skill/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8").replace(
                "license: LICENSE.txt", "license: ../../LICENSE"),
            encoding="utf-8")
        self.assertIn("I-9", self.checks())

    # ② metadata.version 비-SemVer
    def test_non_semver_version(self) -> None:
        skill_md = self.repo / "skills/alpha-skill/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8").replace(
                "  version: 1.2.3", "  version: not-a-semver"),
            encoding="utf-8")
        self.assertIn("VERSION", self.checks())

    # ③ metadata.version ↔ CHANGELOG 최상단 불일치 (I-1)
    def test_changelog_disagreement(self) -> None:
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(
            changelog.read_text(encoding="utf-8").replace("[1.2.3]", "[9.9.9]"),
            encoding="utf-8")
        self.assertIn("I-1", self.checks())

    # ④ 라이선스 사본 ↔ root LICENSE 바이트 불일치
    def test_license_byte_mismatch(self) -> None:
        (self.repo / "skills/alpha-skill/LICENSE.txt").write_text(
            "Apache License stand-in body for fixtures. \n", encoding="utf-8")
        self.assertIn("LICENSE-BYTES", self.checks())

    # I-9 gate failure: SKILL.md 자체 부재
    def test_skill_md_missing(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").unlink()
        self.assertIn("I-9", self.checks())

    # R1-F3: package 밖을 가리키는 symlink는 자기완결 계약 우회다
    def test_symlinked_license_rejected(self) -> None:
        import os
        target = self.repo / "skills/alpha-skill/LICENSE.txt"
        target.unlink()
        os.symlink("../../LICENSE", target)
        self.assertIn("I-9", self.checks())

    def test_symlinked_package_dir_rejected(self) -> None:
        import os, shutil
        pkg = self.repo / "skills/alpha-skill"
        moved = self.repo / "alpha-elsewhere"
        shutil.move(str(pkg), str(moved))
        os.symlink("../alpha-elsewhere", pkg)
        self.assertIn("I-9", self.checks())

    # fail-closed: 파싱 불가는 통과가 아니라 finding이다
    def test_unparseable_frontmatter_fails_closed(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            "no frontmatter at all\n", encoding="utf-8")
        self.assertIn("PARSE", self.checks())

    def test_changelog_first_heading_not_released_fails_closed(self) -> None:
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(
            "# Changelog\n\n## Something else\n\n## [1.2.3] — 2026-07-24\n",
            encoding="utf-8")
        self.assertIn("I-1", self.checks())


class CatalogFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_valid_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def checks(self) -> set[str]:
        return {f.check for f in run_repo_validation(self.repo)}

    def test_version_column_disagreement(self) -> None:
        readme = self.repo / "README.md"
        readme.write_text(
            readme.read_text(encoding="utf-8").replace("`1.2.3`", "`1.2.4`"),
            encoding="utf-8")
        self.assertIn("I-7", self.checks())

    def test_missing_catalog_row(self) -> None:
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(
                "\n".join(l for l in f.read_text(encoding="utf-8").splitlines()
                          if "beta-skill" not in l) + "\n",
                encoding="utf-8")
        self.assertIn("I-7", self.checks())

    def test_inventory_is_not_fixed_to_four(self) -> None:
        # A fifth package must be validated and demanded in the catalog.
        pkg = self.repo / "skills" / "gamma-skill"
        pkg.mkdir(parents=True)
        (pkg / "SKILL.md").write_text(
            "---\nname: gamma-skill\nlicense: LICENSE.txt\nmetadata:\n  version: 0.1.0\n---\n",
            encoding="utf-8")
        (pkg / "CHANGELOG.md").write_text(
            "# Changelog — gamma-skill\n\n## [0.1.0] — 2026-07-28\n\nInitial.\n",
            encoding="utf-8")
        (pkg / "LICENSE.txt").write_text(
            (self.repo / "LICENSE").read_text(encoding="utf-8"), encoding="utf-8")
        self.assertIn("I-7", self.checks())  # catalog rows now lag the inventory


if __name__ == "__main__":
    unittest.main()
