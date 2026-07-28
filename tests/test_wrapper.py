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
from skillstead_validate.wrapper import (RequestError, parse_request,  # noqa: E402
                                         run_wrapper)
from test_cutover import FIX_PIN, FIX_TAGS, SKILLS, make_install, make_release  # noqa: E402


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


class WrapperFixture(unittest.TestCase):
    """tags-ok state fixture (record + baseline tags), constants patched."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = build_unreleased_repo(Path(self._tmp.name) / "repo", dict(SKILLS))
        (self.repo / "docs").mkdir(exist_ok=True)
        (self.repo / "docs/INSTALL.md").write_text(make_install("v0.8.0"), encoding="utf-8")
        self.base_sha = commit_all(self.repo, "legacy install")
        stack = ExitStack()
        stack.enter_context(patch.object(record_schema, "BASELINE_FINALIZATION_SHA", self.base_sha))
        stack.enter_context(patch.object(record_schema, "BASELINE_TAGS", FIX_TAGS))
        stack.enter_context(patch.object(record_schema, "LATEST_REF", FIX_TAGS[-1]))
        stack.enter_context(patch.object(install_pins, "BASELINE_PIN", FIX_PIN))
        self.addCleanup(stack.close)
        self.addCleanup(self._tmp.cleanup)
        # cutover commit + all baseline tags -> tags-ok
        (self.repo / "docs/INSTALL.md").write_text(make_install(FIX_PIN), encoding="utf-8")
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

    def fetch(self):
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
                    r["body"] = P3_MARKER + "\n\nNotes.\n"
            self.latest = tag

    def invoke(self, req_text: str, **kwargs):
        return run_wrapper(self.repo, parse_request(req_text), self.fetch,
                           now=int(_git(self.repo, "log", "-1", "--format=%ct").strip()) + 10,
                           execute=self.execute_and_apply, **kwargs)

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

    def test_dry_run_makes_no_call(self) -> None:
        result = self.invoke(request_json(), dry_run=True)
        self.assertFalse(result.executed)
        self.assertIsNone(result.error)
        self.assertEqual(self.commands, [])


if __name__ == "__main__":
    unittest.main()
