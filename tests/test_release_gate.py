"""M2 release-gate fixtures: E7 ⓐⓑⓓ, I-6, E14, §D3-3, plan fail-closed."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from git_fixture import (_git, add_bare_remote, build_released_repo,  # noqa: E402
                         build_unreleased_repo, commit_all, entry, plan_json)
from fixture_builder import record_root_release  # noqa: E402
from skillstead_validate import record_schema  # noqa: E402
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
    record_root_release(repo, "alpha-skill", version)


def _write_major_record(
        repo: Path, *, previous_ref: str = "alpha-skill/v1.2.3",
        proposed_version: str = "2.0.0",
        reason: str = "The breaking transition is intentional.") -> None:
    path = repo / ".skillstead/major-approvals" / (
        f"alpha-skill-v{proposed_version}.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "schema_version": 1,
        "skill": "alpha-skill",
        "previous_ref": previous_ref,
        "proposed_version": proposed_version,
        "authorization_id": "owner-20260729-0123456789abcdef",
        "approved_at": "2026-07-29",
        "reason": reason,
    }), encoding="utf-8")


def _write_initial_target_record(
        repo: Path, target: str, *, skill: str = "gamma-skill",
        version: str = "0.1.0") -> None:
    path = repo / ".skillstead/initial-release-targets" / (
        f"{skill}-v{version}.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "schema_version": 1,
        "skill": skill,
        "version": version,
        "target_commit": target,
        "authorization_id": "owner-20260830-0123456789abcdef",
        "approved_at": "2026-08-30",
        "reason": "The reviewed amendments are bound to this initial release target.",
    }), encoding="utf-8")


def _retire_beta(
        repo: Path, *, last_release_ref: str | None = "beta-skill/v0.4.0",
        include_record: bool = True) -> None:
    import shutil
    shutil.rmtree(repo / "skills/beta-skill")
    for fname, heading, header in (
            ("README.md", "## Retired skills",
             "| Skill | Last release | Evidence |"),
            ("README.ko.md", "## 은퇴한 스킬",
             "| 스킬 | 마지막 릴리스 | 증거 |")):
        file = repo / fname
        text = "\n".join(
            line for line in file.read_text(encoding="utf-8").splitlines()
            if "beta-skill" not in line) + "\n"
        if include_record:
            release = last_release_ref or "unreleased"
            text += (
                f"\n{heading}\n\n"
                f"{header}\n"
                "| --- | --- | --- |\n"
                f"| `beta-skill` | `{release}` | "
                "[record](./.skillstead/retirements/beta-skill.json) |\n")
        file.write_text(text, encoding="utf-8")
    docs = repo / "docs"
    docs.mkdir(exist_ok=True)
    for fname in ("INSTALL.md", "INSTALL.ko.md"):
        (docs / fname).write_text(
            "# Install\n\nNo active pin for the retired fixture.\n",
            encoding="utf-8")
    if include_record:
        record = repo / ".skillstead/retirements/beta-skill.json"
        record.parent.mkdir(parents=True, exist_ok=True)
        record.write_text(json.dumps({
            "schema_version": 1,
            "skill": "beta-skill",
            "last_release_ref": last_release_ref,
            "authorization_id": "owner-20260729-fedcba9876543210",
            "approved_at": "2026-07-29",
            "reason": "The maintained replacement covers the supported use case.",
            "replacement": None,
        }), encoding="utf-8")


def _add_unreleased_gamma(repo: Path) -> None:
    pkg = repo / "skills/gamma-skill"
    pkg.mkdir(parents=True)
    (pkg / "SKILL.md").write_text(
        "---\n"
        "name: gamma-skill\n"
        "description: >\n"
        "  Fixture skill package used by validator tests.\n"
        "license: LICENSE.txt\n"
        "metadata:\n"
        "  version: 0.1.0\n"
        "---\n"
        "\n# gamma-skill\n",
        encoding="utf-8")
    (pkg / "CHANGELOG.md").write_text(
        "# Changelog — gamma-skill\n\n"
        "## [0.1.0] — 2026-07-29\n\n"
        "Unreleased fixture package.\n",
        encoding="utf-8")
    (pkg / "LICENSE.txt").write_text(
        (repo / "LICENSE").read_text(encoding="utf-8"),
        encoding="utf-8")
    for fname in ("README.md", "README.ko.md"):
        file = repo / fname
        file.write_text(
            file.read_text(encoding="utf-8").replace(
                "| --- | --- | --- | --- | --- |",
                "| --- | --- | --- | --- | --- |\n"
                "| [`gamma-skill`](./skills/gamma-skill) | "
                "Fixture | `0.1.0` | Claude Code | Beta |",
                1),
            encoding="utf-8")
    record_root_release(repo, "gamma-skill", "0.1.0")
    commit_all(repo, "add unreleased gamma-skill")


def _remove_unreleased_gamma(
        repo: Path, *, include_record: bool) -> None:
    import shutil
    shutil.rmtree(repo / "skills/gamma-skill")
    for fname, heading, header in (
            ("README.md", "## Retired skills",
             "| Skill | Last release | Evidence |"),
            ("README.ko.md", "## 은퇴한 스킬",
             "| 스킬 | 마지막 릴리스 | 증거 |")):
        file = repo / fname
        text = "\n".join(
            line for line in file.read_text(encoding="utf-8").splitlines()
            if "gamma-skill" not in line) + "\n"
        if include_record:
            text += (
                f"\n{heading}\n\n"
                f"{header}\n"
                "| --- | --- | --- |\n"
                "| `gamma-skill` | `unreleased` | "
                "[record](./.skillstead/retirements/gamma-skill.json) |\n")
        file.write_text(text, encoding="utf-8")
    if include_record:
        docs = repo / "docs"
        docs.mkdir(exist_ok=True)
        for fname in ("INSTALL.md", "INSTALL.ko.md"):
            (docs / fname).write_text(
                "# Install\n\nNo active pin for the retired fixture.\n",
                encoding="utf-8")
        record = repo / ".skillstead/retirements/gamma-skill.json"
        record.parent.mkdir(parents=True, exist_ok=True)
        record.write_text(json.dumps({
            "schema_version": 1,
            "skill": "gamma-skill",
            "last_release_ref": None,
            "authorization_id": "owner-20260729-0011223344556677",
            "approved_at": "2026-07-29",
            "reason": "The unreleased package is no longer maintained.",
            "replacement": None,
        }), encoding="utf-8")


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

    def test_major_bump_without_approval_record_fails_closed(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nBreaking.\n", encoding="utf-8")
        _bump_alpha(self.repo, "2.0.0")
        commit_all(self.repo, "major bump")
        self.assertIn("MAJOR-APPROVAL", self._preflight([
            entry("alpha-skill", "alpha-skill/v1.2.3", "2.0.0")]))

    def test_major_bump_with_transition_record_is_green(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(
                encoding="utf-8") + "\nBreaking.\n",
            encoding="utf-8")
        _bump_alpha(self.repo, "2.0.0")
        _write_major_record(self.repo)
        commit_all(self.repo, "major bump with transition approval")
        self.assertEqual(self._preflight([
            entry("alpha-skill", "alpha-skill/v1.2.3", "2.0.0")]), set())

    def test_major_record_wrong_ref_and_private_reason_rejected(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(
                encoding="utf-8") + "\nBreaking.\n",
            encoding="utf-8")
        _bump_alpha(self.repo, "2.0.0")
        _write_major_record(
            self.repo, previous_ref="alpha-skill/v1.1.0",
            reason="Approved in PRIVATE-REF-123.")
        commit_all(self.repo, "major bump with invalid record")
        self.assertIn("MAJOR-APPROVAL", self._preflight([
            entry("alpha-skill", "alpha-skill/v1.2.3", "2.0.0")]))

    def test_intervening_release_invalidates_major_record(self) -> None:
        _git(self.repo, "tag", "alpha-skill/v1.3.0", "HEAD")
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(
                encoding="utf-8") + "\nBreaking.\n",
            encoding="utf-8")
        _bump_alpha(self.repo, "2.0.0")
        _write_major_record(self.repo)  # stale previous_ref 1.2.3
        commit_all(self.repo, "major bump after intervening release")
        self.assertIn("MAJOR-APPROVAL", self._preflight([
            entry("alpha-skill", "alpha-skill/v1.3.0", "2.0.0")]))

    def test_retirement_record_closes_inventory_reduction(self) -> None:
        _retire_beta(self.repo)
        commit_all(self.repo, "retire beta-skill")
        self.assertEqual(self._preflight([]), set())

    def test_retirement_requires_full_predicate(self) -> None:
        _retire_beta(self.repo)
        install = self.repo / "docs/INSTALL.md"
        install.write_text(
            "```bash\n"
            "git clone --branch beta-skill/v0.4.0 repo\n"
            "cp -R repo/skills/beta-skill target\n"
            "```\n", encoding="utf-8")
        commit_all(self.repo, "retire beta but retain install pin")
        self.assertIn("RETIREMENT", self._preflight([]))

    def test_retirement_row_outside_named_table_is_rejected(self) -> None:
        _retire_beta(self.repo)
        readme = self.repo / "README.ko.md"
        readme.write_text(
            readme.read_text(encoding="utf-8").replace(
                "## 은퇴한 스킬", "## Historical notes"),
            encoding="utf-8")
        commit_all(self.repo, "move retirement row outside named table")
        self.assertIn("RETIREMENT", self._preflight([]))

    def test_unreleased_skill_can_retire_with_null_and_zero_tags(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = build_unreleased_repo(Path(tmp) / "repo")
            _retire_beta(repo, last_release_ref=None)
            commit_all(repo, "retire unreleased beta-skill")
            plan = parse_plan(plan_json("HEAD", []))
            self.assertEqual(preflight(repo, plan), [])

    def test_unreleased_skill_cannot_claim_release_ref(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = build_unreleased_repo(Path(tmp) / "repo")
            _retire_beta(repo, last_release_ref="beta-skill/v0.4.0")
            commit_all(repo, "retire unreleased beta with false ref")
            plan = parse_plan(plan_json("HEAD", []))
            self.assertIn(
                "RETIREMENT", {finding.check for finding in preflight(repo, plan)})

    def test_post_release_unreleased_removal_requires_record(self) -> None:
        _add_unreleased_gamma(self.repo)
        _remove_unreleased_gamma(self.repo, include_record=False)
        commit_all(self.repo, "remove unreleased gamma without record")
        self.assertIn("I-10", self._preflight([]))

    def test_post_release_unreleased_retirement_with_null_is_green(self) -> None:
        _add_unreleased_gamma(self.repo)
        _remove_unreleased_gamma(self.repo, include_record=True)
        commit_all(self.repo, "retire unreleased gamma with record")
        self.assertEqual(self._preflight([]), set())

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

    def test_new_skill_amendment_target_requires_exact_binding(self) -> None:
        _add_unreleased_gamma(self.repo)
        skill_md = self.repo / "skills/gamma-skill/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8")
            + "\nReviewed wording amendment.\n",
            encoding="utf-8")
        for fname in ("README.md", "README.ko.md"):
            readme = self.repo / fname
            readme.write_text(
                readme.read_text(encoding="utf-8").replace(
                    "| [`gamma-skill`](./skills/gamma-skill) | Fixture |",
                    "| [`gamma-skill`](./skills/gamma-skill) | Reviewed fixture |"),
                encoding="utf-8")
        target = commit_all(
            self.repo, "amend unreleased gamma package and catalogs")
        plan = parse_plan(plan_json(
            target, [entry("gamma-skill", None, "0.1.0")]))
        self.assertIn(
            "INITIAL-RELEASE-TARGET",
            {finding.check for finding in preflight(self.repo, plan)})

        _write_initial_target_record(self.repo, target)
        commit_all(self.repo, "bind reviewed initial release target")
        self.assertEqual(
            preflight(self.repo, plan), [])

    def test_new_skill_target_binding_rejects_different_target(self) -> None:
        _add_unreleased_gamma(self.repo)
        skill_md = self.repo / "skills/gamma-skill/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8") + "\nReviewed amendment.\n",
            encoding="utf-8")
        target = commit_all(self.repo, "amend unreleased gamma")
        _write_initial_target_record(self.repo, "a" * 40)
        commit_all(self.repo, "bind wrong initial target")
        plan = parse_plan(plan_json(
            target, [entry("gamma-skill", None, "0.1.0")]))
        self.assertIn(
            "INITIAL-RELEASE-TARGET",
            {finding.check for finding in preflight(self.repo, plan)})

    def test_new_skill_rejects_package_gap_before_first_tag(self) -> None:
        import shutil

        _add_unreleased_gamma(self.repo)
        pkg = self.repo / "skills/gamma-skill"
        saved = {
            path.name: path.read_text(encoding="utf-8")
            for path in pkg.iterdir()
        }
        shutil.rmtree(pkg)
        commit_all(self.repo, "temporarily remove unreleased gamma package")
        pkg.mkdir()
        for name, content in saved.items():
            (pkg / name).write_text(content, encoding="utf-8")
        commit_all(self.repo, "restore unreleased gamma package")
        self.assertIn(
            "D3-3",
            self._preflight([entry("gamma-skill", None, "0.1.0")]))

    def test_new_skill_rejects_catalog_gap_before_first_tag(self) -> None:
        _add_unreleased_gamma(self.repo)
        originals = {}
        for fname in ("README.md", "README.ko.md"):
            readme = self.repo / fname
            originals[fname] = readme.read_text(encoding="utf-8")
            readme.write_text(
                "\n".join(
                    line for line in originals[fname].splitlines()
                    if "gamma-skill" not in line) + "\n",
                encoding="utf-8")
        commit_all(self.repo, "temporarily remove unreleased gamma catalog rows")
        for fname, content in originals.items():
            (self.repo / fname).write_text(content, encoding="utf-8")
        commit_all(self.repo, "restore unreleased gamma catalog rows")
        self.assertIn(
            "D3-3",
            self._preflight([entry("gamma-skill", None, "0.1.0")]))

    # apply-tags: preflight 위반 시 거부, green이면 계획된 tag를 생성
    def test_apply_tags_refuses_on_findings(self) -> None:
        _bump_alpha(self.repo, "1.2.4")
        commit_all(self.repo, "bookkeeping-only bump")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.2.4")]))
        with self.assertRaises(RuntimeError):
            apply_tags(self.repo, plan)

    def test_apply_tags_publishes_to_remote(self) -> None:
        bare = add_bare_remote(self.repo)
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nNew body paragraph.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.3.0")
        commit_all(self.repo, "release alpha 1.3.0")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))
        self.assertEqual(apply_tags(self.repo, plan), ["alpha-skill/v1.3.0"])
        remote_tags = _git(self.repo, "ls-remote", "--tags", str(bare))
        self.assertIn("refs/tags/alpha-skill/v1.3.0", remote_tags)

    # R1R-F1: 빈 plan은 엄격한 no-op — branch도 tag도 원격으로 밀지 않는다
    def test_empty_plan_apply_is_strict_noop(self) -> None:
        bare = add_bare_remote(self.repo)
        (self.repo / "AHEAD.md").write_text("local-only commit\n", encoding="utf-8")
        commit_all(self.repo, "local main ahead of remote")
        before_branches = _git(self.repo, "ls-remote", "--heads", str(bare))
        before_tags = _git(self.repo, "ls-remote", "--tags", str(bare))
        plan = parse_plan(plan_json("HEAD", []))
        self.assertEqual(apply_tags(self.repo, plan), [])
        self.assertEqual(_git(self.repo, "ls-remote", "--heads", str(bare)), before_branches)
        self.assertEqual(_git(self.repo, "ls-remote", "--tags", str(bare)), before_tags)

    # R1-F1: 발행 실패 시 local ref rollback — 재시도가 막히지 않는다
    def test_apply_tags_rolls_back_on_push_failure(self) -> None:
        (self.repo / "skills/alpha-skill/SKILL.md").write_text(
            (self.repo / "skills/alpha-skill/SKILL.md").read_text(encoding="utf-8")
            + "\nNew body paragraph.\n", encoding="utf-8")
        _bump_alpha(self.repo, "1.3.0")
        commit_all(self.repo, "release alpha 1.3.0")
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", "alpha-skill/v1.2.3", "1.3.0")]))
        with self.assertRaises(RuntimeError):  # no origin remote yet
            apply_tags(self.repo, plan)
        self.assertNotIn("alpha-skill/v1.3.0", _git(self.repo, "tag", "--list"))
        add_bare_remote(self.repo)
        self.assertEqual(apply_tags(self.repo, plan), ["alpha-skill/v1.3.0"])


class BaselineReleaseFixtures(unittest.TestCase):
    """The M2 exception is bound to one canonical four-skill cutover plan."""

    SKILLS = {
        "docs-claim-check": "0.8.0",
        "github-release-guide": "0.8.0",
        "svg-infographic": "0.8.0",
        "writing-quality-editor": "0.8.0",
    }

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_unreleased_repo(
            Path(self._tmp.name) / "repo", dict(self.SKILLS))
        self.baseline_sha = _git(self.repo, "rev-parse", "HEAD").strip()
        stack = ExitStack()
        stack.enter_context(patch.object(
            record_schema, "BASELINE_FINALIZATION_SHA", self.baseline_sha))
        self.addCleanup(stack.close)
        self.addCleanup(self._tmp.cleanup)
        self._write_record()
        self.cutover_sha = commit_all(self.repo, "introduce baseline attempt 1")

    def _record(self, **overrides) -> dict:
        value = {
            "schema": record_schema.SCHEMA,
            "attempt": 1,
            "phase": "prepared",
            "baseline_finalization_sha": self.baseline_sha,
            "latest_ref": record_schema.LATEST_REF,
            "baseline_tags": list(record_schema.BASELINE_TAGS),
        }
        value.update(overrides)
        return value

    def _write_record(self, **overrides) -> None:
        path = self.repo / record_schema.RECORD_PATH
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(self._record(**overrides)), encoding="utf-8")

    def _entries(self) -> list[dict]:
        return [
            entry(
                ref.removeprefix("refs/tags/").rsplit("/v", 1)[0],
                None,
                "0.8.0")
            for ref in record_schema.BASELINE_TAGS
        ]

    def _findings(self, entries: list[dict] | None = None,
                  target: str = "HEAD"):
        plan = parse_plan(plan_json(
            target, self._entries() if entries is None else entries))
        return preflight(self.repo, plan)

    def test_exact_baseline_plan_is_green(self) -> None:
        self.assertEqual(self._findings(), [])

    def test_baseline_apply_tags_is_atomic_and_published(self) -> None:
        add_bare_remote(self.repo)
        plan = parse_plan(plan_json("HEAD", self._entries()))
        self.assertEqual(
            apply_tags(self.repo, plan),
            [ref.removeprefix("refs/tags/")
             for ref in record_schema.BASELINE_TAGS])
        for ref in record_schema.BASELINE_TAGS:
            self.assertEqual(
                _git(self.repo, "ls-remote", "origin", ref).split()[0],
                self.cutover_sha)

    def test_missing_record_does_not_activate_exception(self) -> None:
        (self.repo / record_schema.RECORD_PATH).unlink()
        commit_all(self.repo, "remove record")
        self.assertTrue(self._findings())

    def test_partial_extra_and_wrong_order_are_red(self) -> None:
        cases = {
            "partial": self._entries()[:-1],
            "extra": self._entries() + [entry("extra-skill", None, "0.8.0")],
            "wrong-order": list(reversed(self._entries())),
        }
        for label, entries in cases.items():
            with self.subTest(label):
                self.assertTrue(self._findings(entries))

    def test_wrong_target_and_version_are_red(self) -> None:
        (self.repo / "later.txt").write_text("later\n", encoding="utf-8")
        commit_all(self.repo, "later commit carrying the same record")
        self.assertTrue(self._findings())
        wrong = self._entries()
        wrong[0] = entry(wrong[0]["skill"], None, "0.8.1")
        self.assertTrue(self._findings(wrong, target=self.cutover_sha))

    def test_attempt_two_structure_is_green(self) -> None:
        self._write_record(phase="aborted")
        commit_all(self.repo, "abort attempt 1")
        self._write_record(attempt=2)
        commit_all(self.repo, "introduce attempt 2")
        self.assertEqual(self._findings(), [])

    def test_attempt_skip_is_red(self) -> None:
        self._write_record(phase="aborted")
        commit_all(self.repo, "abort attempt 1")
        self._write_record(attempt=3)
        commit_all(self.repo, "skip attempt 2")
        self.assertTrue(self._findings())

    def test_baseline_inventory_reduction_is_i10(self) -> None:
        import shutil
        shutil.rmtree(self.repo / "skills/docs-claim-check")
        commit_all(self.repo, "remove baseline package")
        checks = {finding.check for finding in self._findings()}
        self.assertIn("I-10", checks)

    def test_post_cutover_ordinary_release_reaches_ordinary_gate(self) -> None:
        for ref in record_schema.BASELINE_TAGS:
            _git(
                self.repo, "tag",
                ref.removeprefix("refs/tags/"),
                self.cutover_sha)

        skill = "docs-claim-check"
        skill_md = self.repo / f"skills/{skill}/SKILL.md"
        skill_md.write_text(
            skill_md.read_text(encoding="utf-8").replace(
                "  version: 0.8.0", "  version: 0.8.1"),
            encoding="utf-8")
        (self.repo / f"skills/{skill}/README.md").write_text(
            "Post-cutover payload correction.\n", encoding="utf-8")
        changelog = self.repo / f"skills/{skill}/CHANGELOG.md"
        changelog.write_text(
            changelog.read_text(encoding="utf-8").replace(
                "## [0.8.0]",
                "## [0.8.1] — 2026-07-28\n\n"
                "Post-cutover patch.\n\n"
                "## [0.8.0]",
                1),
            encoding="utf-8")
        for name in ("README.md", "README.ko.md"):
            path = self.repo / name
            lines = path.read_text(encoding="utf-8").splitlines()
            path.write_text(
                "\n".join(
                    line.replace("`0.8.0`", "`0.8.1`")
                    if skill in line else line
                    for line in lines) + "\n",
                encoding="utf-8")
        record_root_release(self.repo, skill, "0.8.1")
        commit_all(self.repo, "ordinary release after cutover")

        plan = parse_plan(plan_json("HEAD", [
            entry(skill, f"{skill}/v0.8.0", "0.8.1")]))
        self.assertEqual(preflight(self.repo, plan), [])


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
            record_root_release(self.repo, skill, version)
        commit_all(self.repo, "dual release")
        add_bare_remote(self.repo)
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

    # MR1R-F3: parent catalog가 손상돼 같은 commit 도입을 증명할 수 없으면
    # fail-closed다 — silent skip으로 green이 되면 안 된다
    def test_f3_unreadable_parent_catalog_fails_closed(self) -> None:
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(f.read_text(encoding="utf-8").replace("| Skill |", "| Broken |")
                         .replace("| 스킬 |", "| 깨짐 |"), encoding="utf-8")
        commit_all(self.repo, "corrupt catalog headers")
        pkg = self.repo / "skills/gamma-skill"
        pkg.mkdir(parents=True)
        (pkg / "SKILL.md").write_text(
            "---\nname: gamma-skill\nlicense: LICENSE.txt\nmetadata:\n  version: 0.1.0\n---\n",
            encoding="utf-8")
        (pkg / "CHANGELOG.md").write_text(
            "# Changelog — gamma-skill\n\n## [0.1.0] — 2026-07-28\n\nInitial.\n", encoding="utf-8")
        (pkg / "LICENSE.txt").write_text(
            (self.repo / "LICENSE").read_text(encoding="utf-8"), encoding="utf-8")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(f.read_text(encoding="utf-8").replace("| Broken |", "| Skill |")
                         .replace("| 깨짐 |", "| 스킬 |")
                         .replace("| --- | --- | --- | --- | --- |",
                                  "| --- | --- | --- | --- | --- |\n| [`gamma-skill`](./skills/gamma-skill) | Fixture | `0.1.0` | Claude Code | Beta |",
                                  1), encoding="utf-8")
        commit_all(self.repo, "repair headers + add gamma in one commit")
        self.assertIn("D3-3", self._preflight([entry("gamma-skill", None, "0.1.0")]))

    # MR1R-F8: record 흔적이 있으면 tag 전량 삭제 상태를 pre-cutover로
    # 오인하지 않는다 — I-10 fail-closed
    def test_f8_full_deletion_with_record_trace_not_mistaken_for_pre_cutover(self) -> None:
        import shutil
        record_dir = self.repo / ".skillstead"
        record_dir.mkdir()
        (record_dir / "cutover-record.json").write_text("{}", encoding="utf-8")
        commit_all(self.repo, "record trace")
        for tag in ("alpha-skill/v1.2.3", "beta-skill/v0.4.0"):
            _git(self.repo, "tag", "-d", tag)
        shutil.rmtree(self.repo / "skills/beta-skill")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(
                "\n".join(l for l in f.read_text(encoding="utf-8").splitlines()
                          if "beta-skill" not in l) + "\n", encoding="utf-8")
        commit_all(self.repo, "remove beta after deleting all tags")
        self.assertIn("I-10", self._preflight([]))


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

    # proposed_ref is checked here rather than left to the gate, so a plan that
    # names the tag loosely is refused with the expected form in the message.
    def _reject_ref(self, ref: str) -> str:
        bad = entry("alpha-skill", None, "0.1.0")
        bad["proposed_ref"] = ref
        with self.assertRaises(PlanError) as caught:
            parse_plan(plan_json("HEAD", [bad]))
        return str(caught.exception)

    def test_short_tag_name_rejected(self) -> None:
        message = self._reject_ref("alpha-skill/v0.1.0")
        self.assertIn("refs/tags/alpha-skill/v0.1.0", message)
        self.assertIn("refs/tags/<skill>/v<proposed_version>", message)

    def test_ref_naming_another_skill_rejected(self) -> None:
        self._reject_ref("refs/tags/beta-skill/v0.1.0")

    def test_ref_disagreeing_with_version_rejected(self) -> None:
        self._reject_ref("refs/tags/alpha-skill/v0.2.0")

    def test_well_formed_ref_accepted(self) -> None:
        plan = parse_plan(plan_json("HEAD", [entry("alpha-skill", None, "0.1.0")]))
        self.assertEqual(plan.releases[0].proposed_ref,
                         "refs/tags/alpha-skill/v0.1.0")


if __name__ == "__main__":
    unittest.main()
