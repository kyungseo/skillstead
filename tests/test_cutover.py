"""M4 cutover evaluator fixtures (record schema and ordered-evaluator contract)."""

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

from git_fixture import _git, build_unreleased_repo, commit_all  # noqa: E402
from skillstead_validate import install_pins, record_schema  # noqa: E402
from skillstead_validate.cutover import P3_MARKER, run_cutover  # noqa: E402
from skillstead_validate.transport import (TransportError, fetch_latest,  # noqa: E402
                                           fetch_releases)

SKILLS = {"alpha-skill": "1.2.3", "beta-skill": "0.4.0"}
FIX_TAGS = ("refs/tags/alpha-skill/v1.2.3", "refs/tags/beta-skill/v0.4.0")
FIX_PIN = "alpha-skill/v1.2.3"


def make_install(ref: str, skill: str = "alpha-skill", count: int = 7) -> str:
    block = (f"```bash\n"
             f"git clone --depth 1 --branch {ref} https://example.invalid/r.git /tmp/x\n"
             f"cp -R /tmp/x/skills/{skill} dest/\n"
             f"```\n")
    return "# Install\n\n" + "\n".join(f"## Way {i}\n\n{block}" for i in range(count))


def write_install_pair(repo: Path, text: str) -> None:
    for name in ("INSTALL.md", "INSTALL.ko.md"):
        (repo / "docs" / name).write_text(text, encoding="utf-8")


def make_release(tag: str, published: str, *, prerelease: bool = False,
                 title: str | None = None, body: str | None = None) -> dict:
    skill, version = tag.split("/v")
    return {"tag_name": tag, "draft": False, "prerelease": prerelease,
            "name": title if title is not None else f"{skill} {version}",
            "body": body if body is not None else P3_MARKER + "\n\nNotes.\n",
            "published_at": published}


class CutoverFixture(unittest.TestCase):
    """Synthetic cutover lifecycle; canonical constants patched to fixture
    values (guarded elsewhere by the D8-1 constants test)."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_unreleased_repo(Path(self._tmp.name) / "repo", dict(SKILLS))
        (self.repo / "docs").mkdir(exist_ok=True)
        write_install_pair(self.repo, make_install("v0.8.0"))
        self.base_sha = commit_all(self.repo, "legacy install")
        stack = ExitStack()
        stack.enter_context(patch.object(record_schema, "BASELINE_FINALIZATION_SHA", self.base_sha))
        stack.enter_context(patch.object(record_schema, "BASELINE_TAGS", FIX_TAGS))
        stack.enter_context(patch.object(record_schema, "LATEST_REF", FIX_TAGS[-1]))
        stack.enter_context(patch.object(install_pins, "BASELINE_PIN", FIX_PIN))
        self.addCleanup(stack.close)
        self.addCleanup(self._tmp.cleanup)

    # -- helpers --------------------------------------------------------
    def record(self, **overrides) -> dict:
        rec = {"schema": record_schema.SCHEMA, "attempt": 1, "phase": "prepared",
               "baseline_finalization_sha": self.base_sha,
               "latest_ref": FIX_TAGS[-1], "baseline_tags": list(FIX_TAGS)}
        rec.update(overrides)
        return rec

    def cutover_commit(self, record: dict | str | None = None, pin: str = FIX_PIN) -> str:
        write_install_pair(self.repo, make_install(pin))
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        record = self.record() if record is None else record
        text = record if isinstance(record, str) else json.dumps(record)
        (rec_dir / "cutover-record.json").write_text(text, encoding="utf-8")
        return commit_all(self.repo, "cutover commit")

    def create_tags(self, sha: str, refs=FIX_TAGS) -> None:
        for ref in refs:
            _git(self.repo, "tag", ref.removeprefix("refs/tags/"), sha)

    def now_at(self, sha: str, delta: int = 10) -> int:
        return int(_git(self.repo, "log", "-1", "--format=%ct", sha).strip()) + delta

    def verdict(self, releases=(), latest=None, now=None):
        head = _git(self.repo, "rev-parse", "HEAD").strip()
        return run_cutover(self.repo, "main", list(releases), latest,
                           now=now if now is not None else self.now_at(head))

    # -- Step 1 ---------------------------------------------------------
    def test_not_started(self) -> None:
        self.assertEqual(self.verdict().verdict, "not-started")

    def test_cv_orphan(self) -> None:
        write_install_pair(self.repo, make_install(FIX_PIN))
        commit_all(self.repo, "pins switched without record")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-ORPHAN"))

    # -- Step 2 (S1~S10) ------------------------------------------------
    def test_schema_violations(self) -> None:
        cases = {
            "S2": json.dumps({**self.record(), "extra": 1}),
            "S3": '{"schema": "x", "schema": "y"}',
            "S4": json.dumps(self.record(schema="wrong")),
            "S5": json.dumps(self.record(attempt=True)),
            "S6": json.dumps(self.record(phase="active")),
            "S7": json.dumps(self.record(baseline_finalization_sha="f" * 40)),
            "S8": json.dumps(self.record(baseline_tags=[FIX_TAGS[0]])),
            "S10": json.dumps(self.record(latest_ref=FIX_TAGS[0])),
        }
        for predicate, text in cases.items():
            with self.subTest(predicate):
                repo_state = _git(self.repo, "rev-parse", "HEAD").strip()
                self.cutover_commit(record=text)
                v = self.verdict()
                self.assertEqual((v.verdict, v.code), ("red", "CV-SCHEMA"))
                self.assertTrue(v.predicate.startswith(predicate), v)
                _git(self.repo, "reset", "-q", "--hard", repo_state)

    # -- Step 3 / Step 4 ------------------------------------------------
    def test_pending_green(self) -> None:
        self.cutover_commit()
        self.assertEqual(self.verdict().verdict, "pending-tags")

    def test_ko_only_stale_pin_is_cv_pin(self) -> None:
        (self.repo / "docs/INSTALL.md").write_text(
            make_install(FIX_PIN), encoding="utf-8")
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        (rec_dir / "cutover-record.json").write_text(
            json.dumps(self.record()), encoding="utf-8")
        commit_all(self.repo, "EN switched while KO stayed legacy")
        verdict = self.verdict()
        self.assertEqual((verdict.verdict, verdict.code), ("red", "CV-PIN"))

    def test_missing_ko_install_is_cv_pin(self) -> None:
        write_install_pair(self.repo, make_install(FIX_PIN))
        (self.repo / "docs/INSTALL.ko.md").unlink()
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        (rec_dir / "cutover-record.json").write_text(
            json.dumps(self.record()), encoding="utf-8")
        commit_all(self.repo, "cutover without KO INSTALL")
        verdict = self.verdict()
        self.assertEqual((verdict.verdict, verdict.code), ("red", "CV-PIN"))

    def test_cv_clock(self) -> None:
        sha = self.cutover_commit()
        v = self.verdict(now=self.now_at(sha, 4000))
        self.assertEqual((v.verdict, v.code), ("red", "CV-CLOCK"))

    def test_cv_pin_pending(self) -> None:
        self.cutover_commit(pin="v0.8.0")  # record present, pins still legacy
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-PIN"))

    def test_cv_same(self) -> None:
        write_install_pair(self.repo, make_install(FIX_PIN))
        commit_all(self.repo, "pins only")
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        (rec_dir / "cutover-record.json").write_text(json.dumps(self.record()), encoding="utf-8")
        commit_all(self.repo, "record only")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-SAME"))

    def test_cv_partial_tags(self) -> None:
        sha = self.cutover_commit()
        self.create_tags(sha, refs=FIX_TAGS[:1])
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-PARTIAL-TAGS"))

    def test_cv_attempt_t1(self) -> None:
        self.cutover_commit(record=self.record(attempt=2))
        v = self.verdict()
        self.assertEqual((v.verdict, v.code, v.predicate), ("red", "CV-ATTEMPT", "T1"))

    def test_cv_attempt_t3(self) -> None:
        self.cutover_commit()  # attempt 1, prepared
        self.cutover_commit(record=self.record(attempt=2))  # increase w/o aborted
        v = self.verdict()
        self.assertEqual((v.verdict, v.code, v.predicate), ("red", "CV-ATTEMPT", "T3"))

    def test_aborted_green_and_retry_fails_closed(self) -> None:
        self.cutover_commit()
        # revert: pins back to legacy + phase aborted, one commit
        write_install_pair(self.repo, make_install("v0.8.0"))
        (self.repo / ".skillstead/cutover-record.json").write_text(
            json.dumps(self.record(phase="aborted")), encoding="utf-8")
        commit_all(self.repo, "abort attempt 1")
        self.assertEqual(self.verdict().verdict, "aborted")
        # MR2-F3 owner 결정: 직전 attempt의 ref 부재는 기계 증명이 불가하므로
        # 정상 형태의 retry도 fail-closed — 해소는 cutover ⓪ owner gate(C5)
        self.cutover_commit(record=self.record(attempt=2))
        v = self.verdict()
        self.assertEqual((v.verdict, v.code, v.predicate),
                         ("red", "CV-ATTEMPT", "T3-unprovable"))

    def test_cv_abort_tags(self) -> None:
        sha = self.cutover_commit()
        self.create_tags(sha)
        (self.repo / ".skillstead/cutover-record.json").write_text(
            json.dumps(self.record(phase="aborted")), encoding="utf-8")
        write_install_pair(self.repo, make_install("v0.8.0"))
        commit_all(self.repo, "abort after tags")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-ABORT-TAGS"))

    # -- tags-ok / Step 6 -----------------------------------------------
    def _to_tags_ok(self) -> str:
        sha = self.cutover_commit()
        self.create_tags(sha)
        return sha

    def test_tags_ok_green(self) -> None:
        self._to_tags_ok()
        self.assertEqual(self.verdict().verdict, "tags-ok")

    def test_cv_target(self) -> None:
        self._to_tags_ok()
        (self.repo / "NOTES.md").write_text("later\n", encoding="utf-8")
        later = commit_all(self.repo, "later")
        _git(self.repo, "tag", "-f", FIX_TAGS[0].removeprefix("refs/tags/"), later)
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-TARGET"))

    def test_cv_frozen(self) -> None:
        self._to_tags_ok()
        (self.repo / ".skillstead/cutover-record.json").write_text(
            json.dumps(self.record(phase="prepared", attempt=1)) + "\n", encoding="utf-8")
        commit_all(self.repo, "touch record after tags")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-FROZEN"))

    def test_complete_initial_and_cv_latest_initial(self) -> None:
        self._to_tags_ok()
        releases = [make_release(t.removeprefix("refs/tags/"), f"2026-07-28T00:0{i}:00Z")
                    for i, t in enumerate(FIX_TAGS)]
        good = self.verdict(releases=releases, latest=FIX_TAGS[-1].removeprefix("refs/tags/"))
        self.assertEqual((good.verdict, good.detail), ("complete", "initial promotion"))
        bad = self.verdict(releases=releases, latest=FIX_TAGS[0].removeprefix("refs/tags/"))
        self.assertEqual((bad.verdict, bad.code), ("red", "CV-LATEST-INITIAL"))

    def test_cv_premature(self) -> None:
        self._to_tags_ok()
        releases = [make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "2026-07-28T00:00:00Z"),
                    make_release("alpha-skill/v1.3.0", "2026-07-28T01:00:00Z")]
        v = self.verdict(releases=releases, latest="alpha-skill/v1.3.0")
        self.assertEqual((v.verdict, v.code), ("red", "CV-PREMATURE"))

    def test_cv_release_p1_p3(self) -> None:
        self._to_tags_ok()
        p1 = [make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "2026-07-28T00:00:00Z",
                           prerelease=True)]
        v = self.verdict(releases=p1)
        self.assertEqual((v.verdict, v.code, v.predicate), ("red", "CV-RELEASE", "P1"))
        p3 = [make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "2026-07-28T00:00:00Z",
                           body="wrong first line\n")]
        v = self.verdict(releases=p3)
        self.assertEqual((v.verdict, v.code, v.predicate), ("red", "CV-RELEASE", "P3"))

    def test_steady_state_and_cv_latest_steady(self) -> None:
        self._to_tags_ok()
        # real successor release: payload + bookkeeping + tag on main
        skill_md = self.repo / "skills/alpha-skill/SKILL.md"
        skill_md.write_text(skill_md.read_text(encoding="utf-8").replace(
            "  version: 1.2.3", "  version: 1.3.0") + "\nBody.\n", encoding="utf-8")
        changelog = self.repo / "skills/alpha-skill/CHANGELOG.md"
        changelog.write_text(changelog.read_text(encoding="utf-8").replace(
            "## [1.2.3]", "## [1.3.0] — 2026-07-28\n\nEntry.\n\n## [1.2.3]", 1), encoding="utf-8")
        for fname in ("README.md", "README.ko.md"):
            f = self.repo / fname
            f.write_text(f.read_text(encoding="utf-8").replace("`1.2.3`", "`1.3.0`"), encoding="utf-8")
        succ_sha = commit_all(self.repo, "release alpha 1.3.0")
        _git(self.repo, "tag", "alpha-skill/v1.3.0", succ_sha)
        releases = [make_release(t.removeprefix("refs/tags/"), f"2026-07-28T00:0{i}:00Z")
                    for i, t in enumerate(FIX_TAGS)]
        releases.append(make_release("alpha-skill/v1.3.0", "2026-07-28T02:00:00Z"))
        good = self.verdict(releases=releases, latest="alpha-skill/v1.3.0")
        self.assertEqual((good.verdict, good.detail), ("complete", "steady state"))
        bad = self.verdict(releases=releases, latest=FIX_TAGS[0].removeprefix("refs/tags/"))
        self.assertEqual((bad.verdict, bad.code), ("red", "CV-LATEST-STEADY"))

    def test_dual_namespaced_pin_is_green_after_cutover(self) -> None:
        self._to_tags_ok()
        write_install_pair(
            self.repo, make_install("beta-skill/v0.4.0", skill="beta-skill"))
        commit_all(self.repo, "advance both install mirrors together")
        releases = [
            make_release(
                tag.removeprefix("refs/tags/"),
                f"2026-07-28T00:0{i}:00Z")
            for i, tag in enumerate(FIX_TAGS)
        ]
        verdict = self.verdict(
            releases=releases,
            latest=FIX_TAGS[-1].removeprefix("refs/tags/"))
        self.assertEqual(verdict.verdict, "complete")

    def test_dual_namespaced_version_drift_is_cv_pin(self) -> None:
        sha = self._to_tags_ok()
        _git(self.repo, "tag", "alpha-skill/v1.2.4", sha)
        (self.repo / "docs/INSTALL.md").write_text(
            make_install("alpha-skill/v1.2.3"), encoding="utf-8")
        (self.repo / "docs/INSTALL.ko.md").write_text(
            make_install("alpha-skill/v1.2.4"), encoding="utf-8")
        commit_all(self.repo, "drift EN and KO namespaced versions")
        releases = [
            make_release(
                tag.removeprefix("refs/tags/"),
                f"2026-07-28T00:0{i}:00Z")
            for i, tag in enumerate(FIX_TAGS)
        ]
        verdict = self.verdict(
            releases=releases,
            latest=FIX_TAGS[-1].removeprefix("refs/tags/"))
        self.assertEqual((verdict.verdict, verdict.code), ("red", "CV-PIN"))

    def test_dual_namespaced_count_drift_is_cv_pin(self) -> None:
        self._to_tags_ok()
        (self.repo / "docs/INSTALL.md").write_text(
            make_install(FIX_PIN, count=8), encoding="utf-8")
        (self.repo / "docs/INSTALL.ko.md").write_text(
            make_install(FIX_PIN, count=7), encoding="utf-8")
        commit_all(self.repo, "drift EN and KO namespaced pair counts")
        releases = [
            make_release(
                tag.removeprefix("refs/tags/"),
                f"2026-07-28T00:0{i}:00Z")
            for i, tag in enumerate(FIX_TAGS)
        ]
        verdict = self.verdict(
            releases=releases,
            latest=FIX_TAGS[-1].removeprefix("refs/tags/"))
        self.assertEqual((verdict.verdict, verdict.code), ("red", "CV-PIN"))

    def test_dual_namespaced_order_drift_is_cv_pin(self) -> None:
        self._to_tags_ok()
        alpha = make_install(FIX_PIN, count=1)
        beta = make_install(
            "beta-skill/v0.4.0", skill="beta-skill", count=1)
        (self.repo / "docs/INSTALL.md").write_text(
            alpha + beta, encoding="utf-8")
        (self.repo / "docs/INSTALL.ko.md").write_text(
            beta + alpha, encoding="utf-8")
        commit_all(self.repo, "drift EN and KO namespaced pair order")
        releases = [
            make_release(
                tag.removeprefix("refs/tags/"),
                f"2026-07-28T00:0{i}:00Z")
            for i, tag in enumerate(FIX_TAGS)
        ]
        verdict = self.verdict(
            releases=releases,
            latest=FIX_TAGS[-1].removeprefix("refs/tags/"))
        self.assertEqual((verdict.verdict, verdict.code), ("red", "CV-PIN"))

    # MR2-F1: 형식적 INSTALL 변경으로는 Q-SAME이 성립하지 않는다 —
    # 실제 PIN-LEGACY → PIN-BASELINE 전환이어야 한다
    def test_f1_cosmetic_install_edit_is_not_a_pin_switch(self) -> None:
        write_install_pair(
            self.repo, make_install("v0.8.0") + "\n<!-- cosmetic -->\n")
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        (rec_dir / "cutover-record.json").write_text(json.dumps(self.record()), encoding="utf-8")
        commit_all(self.repo, "record + cosmetic INSTALL edit")
        write_install_pair(self.repo, make_install(FIX_PIN))
        commit_all(self.repo, "actual pin switch, one commit too late")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-SAME"))

    # MR2-F2: frozen 구간 내 record 삭제·복원은 freeze 위반이다
    def test_f2_record_delete_and_restore_is_frozen_violation(self) -> None:
        sha = self.cutover_commit()
        self.create_tags(sha)
        original = (self.repo / ".skillstead/cutover-record.json").read_text(encoding="utf-8")
        (self.repo / ".skillstead/cutover-record.json").unlink()
        commit_all(self.repo, "delete record")
        (self.repo / ".skillstead").mkdir(exist_ok=True)
        (self.repo / ".skillstead/cutover-record.json").write_text(original, encoding="utf-8")
        commit_all(self.repo, "restore record verbatim")
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-FROZEN"))

    # MR2-F5: draft 필드가 없는 release 객체는 관측 불능 — CV-DOMAIN
    def test_f5_missing_draft_field_is_cv_domain(self) -> None:
        self._to_tags_ok()
        r = make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "2026-07-28T00:00:00Z")
        del r["draft"]
        v = self.verdict(releases=[r])
        self.assertEqual((v.verdict, v.code), ("red", "CV-DOMAIN"))

    # MR2R-F5: top-level 비배열 입력과 published_at 없는 published Release
    def test_f5r_non_array_input_is_cv_domain(self) -> None:
        sha = self._to_tags_ok()
        v = run_cutover(self.repo, "main", {}, None, now=self.now_at(sha))
        self.assertEqual((v.verdict, v.code), ("red", "CV-DOMAIN"))

    def test_f5r_published_without_timestamp_is_cv_domain(self) -> None:
        self._to_tags_ok()
        r = make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "x")
        r["published_at"] = None
        v = self.verdict(releases=[r])
        self.assertEqual((v.verdict, v.code), ("red", "CV-DOMAIN"))

    # -- multi-fault precedence (R0-F3) ---------------------------------
    def test_precedence_partial_tags_beats_identity(self) -> None:
        # Q-SAME broken (split commits) AND partial tags: Step 3 must win.
        write_install_pair(self.repo, make_install(FIX_PIN))
        commit_all(self.repo, "pins only")
        rec_dir = self.repo / ".skillstead"
        rec_dir.mkdir(exist_ok=True)
        (rec_dir / "cutover-record.json").write_text(json.dumps(self.record()), encoding="utf-8")
        sha = commit_all(self.repo, "record only")
        self.create_tags(sha, refs=FIX_TAGS[:1])
        v = self.verdict()
        self.assertEqual((v.verdict, v.code), ("red", "CV-PARTIAL-TAGS"))

    def test_precedence_release_beats_pin(self) -> None:
        # Invalid baseline release (Step 4 CV-RELEASE) AND legacy pins
        # (Step 6A CV-PIN): Step 4 must win.
        sha = self._to_tags_ok()
        write_install_pair(self.repo, make_install("v0.8.0"))
        commit_all(self.repo, "pins back to legacy (defect)")
        releases = [make_release(FIX_TAGS[0].removeprefix("refs/tags/"), "2026-07-28T00:00:00Z",
                                 body="not the marker\n")]
        v = self.verdict(releases=releases)
        self.assertEqual((v.verdict, v.code), ("red", "CV-RELEASE"))


class RealRepoInstallSurface(unittest.TestCase):
    EXPECTED_PAIR_COUNT = 8

    def test_real_install_pair_is_namespaced_equal_and_unambiguous(self) -> None:
        # This is an intentional documentation-shape tripwire. Any PR that
        # adds or removes a clone+copy example must update the expected count
        # in the same PR. Actual ref existence and Release currentness belong
        # to the hosted/live M4 check, not this pre-tag PR fixture.
        repo = Path(__file__).resolve().parent.parent
        inventories = [
            install_pins.parse_pins(
                (repo / path).read_text(encoding="utf-8"))
            for path in ("docs/INSTALL.md", "docs/INSTALL.ko.md")
        ]
        self.assertEqual(inventories[0].pins, inventories[1].pins)
        self.assertEqual(
            len(inventories[0].pins), self.EXPECTED_PAIR_COUNT)
        self.assertFalse(any(inv.ambiguous for inv in inventories))
        self.assertTrue(all(
            pin == install_pins.Pin(
                "github-release-guide/v0.9.0", "github-release-guide")
            for pin in inventories[0].pins))
        self.assertEqual(
            install_pins.classify(inventories[0], lambda _t: True),
            "PIN-NAMESPACED")


class InstallPinParsing(unittest.TestCase):
    def test_ambiguous_block_is_other(self) -> None:
        text = ("```bash\n"
                "git clone --branch v1 https://x /tmp/a\n"
                "git clone --branch v1 https://x /tmp/b\n"
                "cp -R /tmp/a/skills/alpha-skill dest/\n"
                "```\n")
        inv = install_pins.parse_pins(text)
        self.assertTrue(inv.ambiguous)
        self.assertEqual(install_pins.classify(inv, lambda _t: True), "PIN-OTHER")

    def test_clone_without_copy_is_other(self) -> None:
        text = ("```bash\n"
                "git clone --branch alpha-skill/v1.0.0 "
                "https://example.invalid/r.git /tmp/x\n"
                "```\n")
        inv = install_pins.parse_pins(text)
        self.assertTrue(inv.ambiguous)
        self.assertEqual(
            install_pins.classify(inv, lambda _t: True), "PIN-OTHER")

    def test_namespace_copy_mismatch_is_other(self) -> None:
        text = make_install("alpha-skill/v1.0.0", skill="beta-skill", count=2)
        inv = install_pins.parse_pins(text)
        self.assertEqual(install_pins.classify(inv, lambda _t: True), "PIN-OTHER")

    # MR2-F4: --branch 없는 clone block은 침묵이 아니라 모호성이다
    def test_f4_clone_without_branch_is_ambiguous(self) -> None:
        extra = ("```bash\n"
                 "git clone https://example.invalid/r.git /tmp/x\n"
                 "cp -R /tmp/x/skills/alpha-skill dest/\n"
                 "```\n")
        inv = install_pins.parse_pins(make_install("v0.8.0") + extra)
        self.assertTrue(inv.ambiguous)
        self.assertEqual(install_pins.classify(inv, lambda _t: True), "PIN-OTHER")

    def test_f4_duplicate_copy_lines_are_ambiguous(self) -> None:
        block = ("```bash\n"
                 "git clone --branch v1 https://example.invalid/r.git /tmp/x\n"
                 "cp -R /tmp/x/skills/alpha-skill a/\n"
                 "cp -R /tmp/x/skills/alpha-skill b/\n"
                 "```\n")
        inv = install_pins.parse_pins(block)
        self.assertTrue(inv.ambiguous)

    def test_f4_unclosed_candidate_fence_is_ambiguous(self) -> None:
        text = ("```bash\n"
                "git clone --branch v1 https://example.invalid/r.git /tmp/x\n"
                "cp -R /tmp/x/skills/alpha-skill dest/\n")
        inv = install_pins.parse_pins(text)
        self.assertTrue(inv.ambiguous)

    def test_valid_namespaced(self) -> None:
        text = make_install("alpha-skill/v1.0.0", skill="alpha-skill", count=2)
        inv = install_pins.parse_pins(text)
        self.assertEqual(install_pins.classify(inv, lambda _t: True), "PIN-NAMESPACED")
        self.assertEqual(install_pins.classify(inv, lambda _t: False), "PIN-OTHER")


class TransportSeam(unittest.TestCase):
    def test_two_page_success(self) -> None:
        pages = [json.dumps([{"id": i} for i in range(100)]), json.dumps([{"id": 100}])]
        calls = []

        def runner(args):
            calls.append(args)
            return pages[len(calls) - 1]
        out = fetch_releases("o/r", runner)
        self.assertEqual(len(out), 101)
        self.assertEqual(len(calls), 2)

    def test_mid_page_failure_fails_closed(self) -> None:
        def runner(args):
            if "page=2" in args[-1]:
                raise TransportError("boom")
            return json.dumps([{"id": i} for i in range(100)])
        with self.assertRaises(TransportError):
            fetch_releases("o/r", runner)

    def test_malformed_page_fails_closed(self) -> None:
        with self.assertRaises(TransportError):
            fetch_releases("o/r", lambda a: "not json")

    def test_latest_404_is_none(self) -> None:
        def runner(args):
            raise TransportError("HTTP 404: Not Found")
        self.assertIsNone(fetch_latest("o/r", runner))

    # A deadline that already passed must stop the call, not shorten it.
    def test_expired_deadline_never_starts_a_request(self) -> None:
        calls = []

        def runner(args, timeout=None):
            calls.append(args)
            return json.dumps([])
        with self.assertRaises(TransportError):
            fetch_releases("o/r", runner, deadline=5.0, monotonic=lambda: 5.0)
        self.assertEqual(calls, [])

    # Per-request timeouts alone would not bound a paging loop, so the
    # deadline is re-checked before every page.
    def test_deadline_stops_paging_midway(self) -> None:
        clock = {"t": 0.0}
        timeouts = []

        def runner(args, timeout=None):
            timeouts.append(timeout)
            clock["t"] += 4.0
            return json.dumps([{"id": i} for i in range(100)])
        with self.assertRaises(TransportError):
            fetch_releases("o/r", runner, deadline=10.0,
                           monotonic=lambda: clock["t"])
        # Every page is given exactly the time still left, so no single request
        # can outlive the deadline; once nothing is left the next page is never
        # requested at all.
        self.assertEqual(timeouts, [10.0, 6.0, 2.0])


if __name__ == "__main__":
    unittest.main()
