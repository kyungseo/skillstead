"""M5 wrapper fixtures — request contract, allowed matrix (W2), pre-publish
checks (W3), execution shape (W4), post-verdict + exact postcondition (W5)."""

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
from skillstead_validate.cutover import P3_MARKER  # noqa: E402
from skillstead_validate.transport import TransportError  # noqa: E402
from skillstead_validate.wrapper import (RequestError, parse_request,  # noqa: E402
                                         run_wrapper)
from test_cutover import (FIX_PIN, FIX_TAGS, SKILLS, make_install,  # noqa: E402
                           make_release, write_install_pair)
from test_release_gate import _bump_alpha  # noqa: E402


def _bump_beta(repo: Path, version: str) -> None:
    """beta-skill counterpart of _bump_alpha: version + CHANGELOG + catalog."""
    skill_md = repo / "skills/beta-skill/SKILL.md"
    skill_md.write_text(
        skill_md.read_text(encoding="utf-8").replace("  version: 0.4.0", f"  version: {version}"),
        encoding="utf-8")
    changelog = repo / "skills/beta-skill/CHANGELOG.md"
    changelog.write_text(
        changelog.read_text(encoding="utf-8").replace(
            "## [0.4.0]", f"## [{version}] — 2026-07-28\n\nFixture entry.\n\n## [0.4.0]", 1)
        .replace(f"## [{version}] — 2026-07-28 — 2026-07-24", f"## [{version}] — 2026-07-28"),
        encoding="utf-8")
    for fname in ("README.md", "README.ko.md"):
        f = repo / fname
        f.write_text(f.read_text(encoding="utf-8").replace("`0.4.0`", f"`{version}`"),
                     encoding="utf-8")


def request_json(**overrides) -> str:
    req = {
        "action": "publish",
        "recovery_mode": "none",
        "tag": FIX_TAGS[0].removeprefix("refs/tags/"),
        "title": "alpha-skill 1.2.3",
        "body": P3_MARKER + "\n\nNotes.\n",
        "draft": False,
        "prerelease": False,
        "latest_intent": True,
        "owner_authorization": None,
    }
    req.update(overrides)
    return json.dumps(req)


class RequestContract(unittest.TestCase):
    def test_duplicate_key_rejected(self) -> None:
        with self.assertRaises(RequestError):
            parse_request('{"action": "publish", "action": "publish"}')

    def test_unknown_key_rejected(self) -> None:
        with self.assertRaises(RequestError):
            parse_request(json.dumps({**json.loads(request_json()), "extra": 1}))

    def test_recovery_requires_authorization(self) -> None:
        with self.assertRaises(RequestError):
            parse_request(request_json(recovery_mode="metadata-correction"))
        parse_request(request_json(recovery_mode="metadata-correction",
                                   action="edit-metadata",
                                   owner_authorization="owner-2026-07-28"))

    def test_edit_requires_authorization(self) -> None:
        with self.assertRaises(RequestError):
            parse_request(request_json(action="edit-metadata"))


class WrapperBase(unittest.TestCase):
    """tags-ok state fixture (record + baseline tags), constants patched."""

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
        # cutover commit + all baseline tags -> tags-ok
        write_install_pair(self.repo, make_install(FIX_PIN))
        (self.repo / ".skillstead").mkdir()
        (self.repo / ".skillstead/cutover-record.json").write_text(json.dumps({
            "schema": record_schema.SCHEMA, "attempt": 1, "phase": "prepared",
            "baseline_finalization_sha": self.base_sha,
            "latest_ref": FIX_TAGS[-1], "baseline_tags": list(FIX_TAGS)}), encoding="utf-8")
        self.cut_sha = commit_all(self.repo, "cutover commit")
        for ref in FIX_TAGS:
            _git(self.repo, "tag", ref.removeprefix("refs/tags/"), self.cut_sha)
        self.store: list[dict] = []
        self.latest: str | None = None
        self.commands: list[list[str]] = []

    def fetch(self, deadline=None):
        return list(self.store), self.latest

    def execute_and_apply(self, cmd: list[str]) -> None:
        """Fake gh that mutates the fake Release store like GitHub would."""
        self.commands.append(cmd)
        tag = cmd[3]
        if cmd[1:3] == ["release", "create"] and "--draft" in cmd:
            self.store.append({"tag_name": tag, "draft": True, "prerelease": False,
                               "name": cmd[cmd.index("--title") + 1],
                               "body": cmd[cmd.index("--notes") + 1],
                               "published_at": None})
        elif cmd[1:3] == ["release", "create"]:
            self.store.append(make_release(tag, "2026-07-28T03:00:00Z",
                                           title=cmd[cmd.index("--title") + 1],
                                           body=cmd[cmd.index("--notes") + 1]))
            self.latest = tag
        elif cmd[1:3] == ["release", "edit"] and "--draft=false" in cmd:
            for r in self.store:
                if r["tag_name"] == tag:
                    r["draft"] = False
                    r["published_at"] = "2026-07-28T03:00:00Z"
                    r["name"] = cmd[cmd.index("--title") + 1]
                    r["body"] = cmd[cmd.index("--notes") + 1]
            self.latest = tag

    def invoke(self, req_text: str, **kwargs):
        return run_wrapper(self.repo, parse_request(req_text), self.fetch,
                           now=int(_git(self.repo, "log", "-1", "--format=%ct").strip()) + 10,
                           execute=self.execute_and_apply, **kwargs)


class WrapperFixture(WrapperBase):
    # -- W2 allowed matrix ----------------------------------------------
    def test_publish_missing_baseline_release_in_tags_ok(self) -> None:
        result = self.invoke(request_json())
        self.assertIsNone(result.error, result.error)
        self.assertTrue(result.executed)
        self.assertEqual(result.post_verdict.verdict, "tags-ok")

    def test_non_baseline_tag_refused_in_tags_ok(self) -> None:
        result = self.invoke(request_json(tag="alpha-skill/v9.9.9",
                                       title="alpha-skill 9.9.9"))
        self.assertFalse(result.executed)
        self.assertIn("baseline", result.error)

    def test_blocked_in_pending(self) -> None:
        for ref in FIX_TAGS:
            _git(self.repo, "tag", "-d", ref.removeprefix("refs/tags/"))
        result = self.invoke(request_json())
        self.assertFalse(result.executed)
        self.assertIn("pending-tags", result.error)

    def test_cv_premature_requires_recovery_mode(self) -> None:
        # a successor release exists while baseline releases are incomplete
        self.store.append(make_release("alpha-skill/v1.3.0", "2026-07-28T01:00:00Z"))
        self.latest = "alpha-skill/v1.3.0"
        refused = self.invoke(request_json())
        self.assertFalse(refused.executed)
        self.assertIn("premature-accept-forward", refused.error)
        allowed = self.invoke(request_json(recovery_mode="premature-accept-forward",
                                        owner_authorization="owner-2026-07-28"))
        self.assertTrue(allowed.executed)

    def test_metadata_correction_only_in_cv_release(self) -> None:
        # invalid baseline release -> CV-RELEASE
        self.store.append(make_release(FIX_TAGS[0].removeprefix("refs/tags/"),
                                       "2026-07-28T00:00:00Z", body="wrong\n"))
        publish = self.invoke(request_json(tag=FIX_TAGS[1].removeprefix("refs/tags/"),
                                        title="beta-skill 0.4.0"))
        self.assertFalse(publish.executed)
        edit = self.invoke(request_json(action="edit-metadata",
                                     recovery_mode="metadata-correction",
                                     owner_authorization="owner-2026-07-28"))
        self.assertTrue(edit.executed)

    # -- W3 pre-publish checks ------------------------------------------
    def test_nonexistent_tag_never_created(self) -> None:
        _git(self.repo, "tag", "-d", FIX_TAGS[0].removeprefix("refs/tags/"))
        # state becomes CV-PARTIAL-TAGS -> blocked by matrix even earlier;
        # use recovery-free check via a tags-ok state with a bogus request tag
        result = self.invoke(request_json(tag="ghost-skill/v1.0.0", title="ghost-skill 1.0.0"))
        self.assertFalse(result.executed)

    def test_p3_marker_enforced_before_publish(self) -> None:
        result = self.invoke(request_json(body="not the marker\n"))
        self.assertFalse(result.executed)
        self.assertIn("P3", result.error)

    def test_publish_requires_latest_intent(self) -> None:
        result = self.invoke(request_json(latest_intent=False))
        self.assertFalse(result.executed)
        self.assertIn("latest_intent", result.error)

    # -- W4/W5 ----------------------------------------------------------
    def test_draft_then_publish_uses_edit(self) -> None:
        draft = self.invoke(request_json(action="create-draft", draft=True))
        self.assertTrue(draft.executed)
        self.assertIn("--draft", draft.commands[0])
        publish = self.invoke(request_json())
        self.assertTrue(publish.executed)
        self.assertIn("--draft=false", publish.commands[0])
        self.assertIn("--latest", publish.commands[0])

    def test_postcondition_latest_exact(self) -> None:
        def bad_execute(cmd):
            self.execute_and_apply(cmd)
            self.latest = "somebody-else/v1.0.0"  # postcondition must fail
        result = run_wrapper(self.repo, parse_request(request_json()), self.fetch,
                             now=int(_git(self.repo, "log", "-1", "--format=%ct").strip()) + 10,
                             execute=bad_execute)
        self.assertTrue(result.executed)
        self.assertIn("postcondition", result.error)

    # MR2-F6: 검증한 request가 명령에 그대로 실린다
    def test_f6_commands_carry_verified_metadata(self) -> None:
        publish = self.invoke(request_json())
        self.assertIn("--verify-tag", publish.commands[0])
        draft = self.invoke(request_json(action="create-draft", draft=True,
                                         tag=FIX_TAGS[1].removeprefix("refs/tags/"),
                                         title="beta-skill 0.4.0"))
        self.assertIn("--verify-tag", draft.commands[0])
        from_draft = self.invoke(request_json(tag=FIX_TAGS[1].removeprefix("refs/tags/"),
                                              title="beta-skill 0.4.0"))
        cmd = from_draft.commands[0]
        self.assertIn("--draft=false", cmd)
        self.assertIn("--prerelease=false", cmd)
        self.assertIn("--notes", cmd)

    # MR2-F7: complete여도 대상 tag가 normal gate를 통과해야 mutation한다
    def test_f7_complete_rechecks_target_tag(self) -> None:
        for i, ref in enumerate(FIX_TAGS):
            self.store.append(make_release(ref.removeprefix("refs/tags/"),
                                           f"2026-07-28T00:0{i}:00Z"))
        self.latest = FIX_TAGS[-1].removeprefix("refs/tags/")
        _git(self.repo, "tag", "alpha-skill/v9.9.9", self.cut_sha)  # ghost: 선언 version과 불일치
        result = self.invoke(request_json(tag="alpha-skill/v9.9.9",
                                          title="alpha-skill 9.9.9"))
        self.assertFalse(result.executed)
        self.assertIn("normal tag gate", result.error)
        self.assertEqual(self.commands, [])

    # MR2-F8: CV-RELEASE 정정은 offending Release에만 결속된다
    def test_f8_correction_bound_to_offending_release(self) -> None:
        self.store.append(make_release(FIX_TAGS[0].removeprefix("refs/tags/"),
                                       "2026-07-28T00:00:00Z", body="wrong\n"))
        self.store.append(make_release(FIX_TAGS[1].removeprefix("refs/tags/"),
                                       "2026-07-28T00:01:00Z"))
        wrong_target = self.invoke(request_json(action="edit-metadata",
                                                tag=FIX_TAGS[1].removeprefix("refs/tags/"),
                                                title="beta-skill 0.4.0",
                                                recovery_mode="metadata-correction",
                                                owner_authorization="owner-2026-07-28"))
        self.assertFalse(wrong_target.executed)
        self.assertIn("offending", wrong_target.error)

    # MR2R-F5: missing 판정은 draft is False만 발행본으로 센다
    def test_f5r_missing_counts_only_published(self) -> None:
        from skillstead_validate.wrapper import _missing_baseline_tags
        no_draft_field = {"tag_name": FIX_TAGS[0].removeprefix("refs/tags/")}
        missing = _missing_baseline_tags([no_draft_field])
        self.assertIn(FIX_TAGS[0].removeprefix("refs/tags/"), missing)

    # MR2R-F6: edit-metadata는 draft=false만 — request가 최종 상태와 같아야 한다
    def test_f6r_edit_metadata_rejects_draft_true(self) -> None:
        self.store.append(make_release(FIX_TAGS[0].removeprefix("refs/tags/"),
                                       "2026-07-28T00:00:00Z", body="wrong\n"))
        result = self.invoke(request_json(action="edit-metadata", draft=True,
                                          recovery_mode="metadata-correction",
                                          owner_authorization="owner-2026-07-28"))
        self.assertFalse(result.executed)
        self.assertIn("draft=false", result.error)

    # MR2R-F7: request tag와 무관한 finding도 fail-closed로 mutation을 막는다
    def test_f7r_any_gate_finding_blocks_mutation(self) -> None:
        _git(self.repo, "tag", "alpha-skill/v1.9.9-rc1", self.cut_sha)  # 문법 위반 tag
        result = self.invoke(request_json())
        self.assertFalse(result.executed)
        self.assertIn("not green", result.error)
        self.assertEqual(self.commands, [])

    def test_dry_run_makes_no_call(self) -> None:
        result = self.invoke(request_json(), dry_run=True)
        self.assertFalse(result.executed)
        self.assertIsNone(result.error)
        self.assertEqual(self.commands, [])


class WrapperPostRead(WrapperBase):
    """W5b — bounded re-read of a self-contradictory post-mutation read.

    A read issued right after a publish can come back without the release that
    was just created. That single case is retried; everything else keeps the
    original red, because a wrong observation is not a slow one.
    """

    def setUp(self) -> None:
        super().setUp()
        # Promoted steady state needs both baselines released AND at least one
        # earlier successor, so Step 6B compares published_at (CV-LATEST-STEADY)
        # instead of taking the initial-promotion branch.
        for i, ref in enumerate(FIX_TAGS):
            self.store.append(make_release(ref.removeprefix("refs/tags/"),
                                           f"2026-07-28T00:0{i}:00Z"))
        _bump_beta(self.repo, "0.5.0")
        prior_sha = commit_all(self.repo, "release beta-skill 0.5.0")
        _git(self.repo, "tag", "beta-skill/v0.5.0", prior_sha)
        self.store.append(make_release("beta-skill/v0.5.0", "2026-07-28T02:00:00Z"))
        self.latest = "beta-skill/v0.5.0"

        self.succ = "alpha-skill/v1.3.0"
        _bump_alpha(self.repo, "1.3.0")
        succ_sha = commit_all(self.repo, "release alpha-skill 1.3.0")
        _git(self.repo, "tag", self.succ, succ_sha)

        self.slept: list[float] = []
        self.clock = 0.0
        self.post_reads = 0
        self.last_deadline = None

    def _stale_store(self) -> list[dict]:
        """What the API returns while the new release is not visible yet."""
        return [r for r in self.store if r["tag_name"] != self.succ]

    def _sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.clock += seconds

    def _monotonic(self) -> float:
        return self.clock

    def _succ_release(self, published: str = "2026-07-28T04:00:00Z") -> dict:
        return make_release(self.succ, published)

    def _invoke_succ(self, fetch, **kwargs):
        """Publish the successor tag; `fetch` drives the post-mutation reads."""
        return run_wrapper(
            self.repo, parse_request(request_json(tag=self.succ,
                                                  title="alpha-skill 1.3.0")),
            fetch,
            now=int(_git(self.repo, "log", "-1", "--format=%ct").strip()) + 10,
            execute=self.execute_and_apply, sleep=self._sleep,
            monotonic=self._monotonic, **kwargs)

    def _reader(self, post):
        """Wrap a post-mutation reader; pre-mutation reads stay truthful.

        `post(n)` receives the 1-based post-read index and returns
        (releases, latest); the pre-mutation read always sees the real store.
        """
        def fetch(deadline=None):
            if self.latest != self.succ:      # still before the publish
                return list(self.store), self.latest
            self.post_reads += 1
            self.last_deadline = deadline
            return post(self.post_reads)
        return fetch

    # 1 — a fresh first read never enters the re-read path.
    def test_fresh_read_does_not_retry(self) -> None:
        result = self._invoke_succ(
            self._reader(lambda n: (list(self.store), self.latest)))
        self.assertIsNone(result.error, result.error)
        self.assertEqual(result.post_verdict.verdict, "complete")
        self.assertEqual(self.slept, [])
        self.assertEqual(result.post_read_notes, [])

    # 2 — stale first read, then the release appears: green, reason resolved.
    def test_stale_then_visible_resolves(self) -> None:
        seen = {}

        def post(n):
            if n == 1:
                stale = self._stale_store()
                seen["tag_absent"] = self.succ not in [r["tag_name"] for r in stale]
                seen["latest"] = self.latest
                return stale, self.latest
            return list(self.store), self.latest

        result = self._invoke_succ(self._reader(post))
        # The first observation really did contradict itself.
        self.assertTrue(seen["tag_absent"])
        self.assertEqual(seen["latest"], self.succ)
        self.assertIsNone(result.error, result.error)
        self.assertEqual(result.post_verdict.verdict, "complete")
        notes = " ".join(result.post_read_notes)
        self.assertIn("stale observation", notes)
        self.assertIn("re-read 1/3", notes)
        self.assertIn("-> resolved", notes)
        self.assertEqual(self.slept, [1.0])

    # 3 — a real misplacement is in the list and must never be retried.
    def test_real_latest_misplacement_stays_red(self) -> None:
        def post(n):
            # Everything visible, but Latest names an older, present release.
            return list(self.store), FIX_TAGS[0].removeprefix("refs/tags/")

        result = self._invoke_succ(self._reader(post))
        self.assertIn("postcondition failed", result.error)
        self.assertEqual(self.slept, [])
        self.assertEqual(result.post_read_notes, [])

    # 4 — Latest never becomes the requested tag: postcondition, no retry.
    def test_release_missing_stays_red(self) -> None:
        def post(n):
            return self._stale_store(), "beta-skill/v0.5.0"

        result = self._invoke_succ(self._reader(post))
        self.assertIn("postcondition failed", result.error)
        self.assertEqual(self.slept, [])

    # 5 — an observation failure is not staleness, and it is not a timeout
    #     either: it keeps the first red under its own end reason.
    def test_observation_failure_stays_red(self) -> None:
        def post(n):
            if n == 1:
                return self._stale_store(), self.latest
            raise TransportError("gh exploded")

        result = self._invoke_succ(self._reader(post))
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(result.post_verdict.code, "CV-LATEST-STEADY")
        notes = " ".join(result.post_read_notes)
        self.assertIn("gh exploded", notes)
        self.assertIn("-> observation-failed", notes)
        self.assertNotIn("total-cap", notes)

    # 6 — still stale after every retry: original red, reason retry-exhausted.
    def test_retry_exhausted_keeps_first_verdict(self) -> None:
        def post(n):
            return self._stale_store(), self.latest

        result = self._invoke_succ(self._reader(post))
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(result.post_verdict.code, "CV-LATEST-STEADY")
        notes = " ".join(result.post_read_notes)
        self.assertIn("re-read 3/3", notes)
        self.assertIn("-> retry-exhausted", notes)
        self.assertEqual(self.slept, [1.0, 2.0, 4.0])

    # 7a/7b — the tag IS listed but its published_at is unusable: CV-DOMAIN,
    # and the predicate must not read that as "not visible yet".
    def _published_at_case(self, value) -> None:
        def post(n):
            bad = self._succ_release()
            bad["published_at"] = value
            return self._stale_store() + [bad], self.succ

        result = self._invoke_succ(self._reader(post))
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(result.post_verdict.code, "CV-DOMAIN")
        self.assertEqual(self.slept, [])
        self.assertEqual(result.post_read_notes, [])

    def test_published_at_null_stays_red_without_retry(self) -> None:
        self._published_at_case(None)

    def test_published_at_empty_stays_red_without_retry(self) -> None:
        self._published_at_case("")

    # 8 — the wall clock runs out before the retry budget does.
    def test_total_cap_stops_before_retries_exhaust(self) -> None:
        def post(n):
            if n > 1:
                self.clock += 5.0     # each re-read costs real time
            return self._stale_store(), self.latest

        result = self._invoke_succ(self._reader(post))
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(result.post_verdict.code, "CV-LATEST-STEADY")
        notes = " ".join(result.post_read_notes)
        self.assertIn("re-read 2/3", notes)
        self.assertIn("-> total-cap", notes)
        # Two backoffs fit; the third would cross the cap, so it never happens.
        self.assertEqual(self.slept, [1.0, 2.0])

    # 9 — the deadline reaches the transport, and a fetch that trips it ends
    #     the loop instead of being retried.
    def test_fetch_deadline_exceeded_ends_with_total_cap(self) -> None:
        def post(n):
            if n == 1:
                return self._stale_store(), self.latest
            raise TransportError("deadline exceeded before request")

        result = self._invoke_succ(self._reader(post))
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(result.post_verdict.code, "CV-LATEST-STEADY")
        self.assertIn("-> total-cap", " ".join(result.post_read_notes))
        # The transport was actually handed a deadline to enforce.
        self.assertIsNotNone(self.last_deadline)


class WrapperPostReadInitial(WrapperBase):
    """W5b in the initial-promotion branch.

    Before any successor release exists, Step 6B judges promotion instead of
    comparing timestamps, so the same stale list reports CV-LATEST-INITIAL.
    The recovery predicate is unchanged; only the verdict code differs.
    """

    def setUp(self) -> None:
        super().setUp()
        self.slept: list[float] = []
        self.clock = 0.0
        self.post_reads = 0

    def _sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.clock += seconds

    def _monotonic(self) -> float:
        return self.clock

    def _invoke(self, tag: str, title: str, fetch):
        return run_wrapper(
            self.repo, parse_request(request_json(tag=tag, title=title)), fetch,
            now=int(_git(self.repo, "log", "-1", "--format=%ct").strip()) + 10,
            execute=self.execute_and_apply, sleep=self._sleep,
            monotonic=self._monotonic)

    def _reader(self, post):
        def fetch(deadline=None):
            if self.latest != self.pending:
                return list(self.store), self.latest
            self.post_reads += 1
            return post(self.post_reads)
        return fetch

    # B1 — the first ordinary release after the cutover, read too early.
    def test_first_successor_stale_read_resolves(self) -> None:
        for i, ref in enumerate(FIX_TAGS):          # every baseline published
            self.store.append(make_release(ref.removeprefix("refs/tags/"),
                                           f"2026-07-28T00:0{i}:00Z"))
        self.latest = FIX_TAGS[-1].removeprefix("refs/tags/")   # == LATEST_REF
        succ = "alpha-skill/v1.3.0"
        _bump_alpha(self.repo, "1.3.0")
        _git(self.repo, "tag", succ, commit_all(self.repo, "release alpha 1.3.0"))
        self.pending = succ
        seen = {}

        def post(n):
            if n == 1:
                stale = [r for r in self.store if r["tag_name"] != succ]
                seen["code_input"] = [r["tag_name"] for r in stale]
                return stale, self.latest
            return list(self.store), self.latest

        result = self._invoke(succ, "alpha-skill 1.3.0", self._reader(post))
        # The stale list held no successor at all, which is why the first
        # verdict took the initial-promotion branch.
        self.assertNotIn(succ, seen["code_input"])
        notes = " ".join(result.post_read_notes)
        self.assertIn("CV-LATEST-INITIAL", notes)      # first observation
        self.assertIn("-> resolved", notes)
        self.assertIsNone(result.error, result.error)
        self.assertEqual(result.post_verdict.verdict, "complete")
        self.assertEqual(self.slept, [1.0])

    # B2 — a genuine misplacement in the same branch: Latest lands on a
    #      baseline tag that is not the declared Latest ref. The tag IS listed,
    #      so the predicate declines and the red stands.
    def test_initial_promotion_misplacement_stays_red(self) -> None:
        wrong = FIX_TAGS[0].removeprefix("refs/tags/")   # not LATEST_REF
        self.store.append(make_release(FIX_TAGS[-1].removeprefix("refs/tags/"),
                                       "2026-07-28T00:00:00Z"))
        self.latest = FIX_TAGS[-1].removeprefix("refs/tags/")
        self.pending = wrong
        listed = {}

        def post(n):
            listed["tags"] = [r["tag_name"] for r in self.store]
            return list(self.store), self.latest

        result = self._invoke(wrong, "alpha-skill 1.2.3", self._reader(post))
        # Publishing the last missing baseline left Latest on the wrong tag.
        self.assertEqual(result.post_verdict.code, "CV-LATEST-INITIAL")
        self.assertEqual(self.latest, wrong)
        self.assertIn(wrong, listed["tags"])            # present, so not stale
        self.assertIn("post-mutation verdict is red", result.error)
        self.assertEqual(self.slept, [])                # never retried
        self.assertEqual(result.post_read_notes, [])


if __name__ == "__main__":
    unittest.main()
