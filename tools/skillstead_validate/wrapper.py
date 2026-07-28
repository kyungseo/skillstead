"""M5 canonical release wrapper (the only supported path for
GitHub Release operations).

Roles, fixed by the DR: run the ordered evaluator; check the requested
operation against the verdict's allowed-operation matrix (judged on the
combination verdict + CV code + action + recovery_mode); pre-publish checks
(tag must already exist — the wrapper never creates a tag implicitly; title;
P3 body marker; draft/prerelease flags); execute only the permitted
``gh release create``/``edit``; re-run the evaluator right after publishing
with the exact postcondition ``Latest == the tag just published`` (stronger
than the evaluator's steady-state ``∈ argmax``); emit verdict + detail to
the CI summary.

Tag mutation is NOT here — M2 ``apply-tags`` owns it. Direct ``gh`` calls
are an unsupported path; this is discipline, not a hard guarantee.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import record_schema
from .cutover import P3_MARKER, Verdict, _release_p123, run_cutover
from .gitio import GitError, git
from .tag_check import run_tag_checks

ACTIONS = ("create-draft", "publish", "edit-metadata")
RECOVERY_MODES = ("none", "premature-accept-forward", "metadata-correction")
_NAMESPACED_TAG = re.compile(r"^([a-z0-9][a-z0-9-]*)/v(\d+)\.(\d+)\.(\d+)$")


class RequestError(ValueError):
    pass


@dataclass(frozen=True)
class ReleaseOperationRequest:
    action: str
    recovery_mode: str
    tag: str
    title: str
    body: str
    draft: bool
    prerelease: bool
    latest_intent: bool
    owner_authorization: str | None


_KEYS = {"action", "recovery_mode", "tag", "title", "body", "draft",
         "prerelease", "latest_intent", "owner_authorization"}


def parse_request(text: str) -> ReleaseOperationRequest:
    def no_dup(pairs):
        d = {}
        for k, v in pairs:
            if k in d:
                raise RequestError(f"duplicate JSON key: {k!r}")
            d[k] = v
        return d
    try:
        raw = json.loads(text, object_pairs_hook=no_dup)
    except json.JSONDecodeError as e:
        raise RequestError(f"invalid JSON: {e}") from None
    if not isinstance(raw, dict) or set(raw) != _KEYS:
        raise RequestError(f"request keys must be exactly {sorted(_KEYS)}")
    if raw["action"] not in ACTIONS:
        raise RequestError(f"action must be one of {ACTIONS}")
    if raw["recovery_mode"] not in RECOVERY_MODES:
        raise RequestError(f"recovery_mode must be one of {RECOVERY_MODES}")
    for key in ("tag", "title", "body"):
        if not isinstance(raw[key], str) or not raw[key]:
            raise RequestError(f"{key} must be a non-empty string")
    for key in ("draft", "prerelease", "latest_intent"):
        if not isinstance(raw[key], bool):
            raise RequestError(f"{key} must be a boolean")
    auth = raw["owner_authorization"]
    if auth is not None and (not isinstance(auth, str) or not auth):
        raise RequestError("owner_authorization must be null or a non-empty string")
    needs_auth = raw["action"] == "edit-metadata" or raw["recovery_mode"] != "none"
    if needs_auth and auth is None:
        raise RequestError("owner_authorization is required for edit-metadata or any recovery_mode")
    return ReleaseOperationRequest(**raw)


@dataclass
class WrapperResult:
    pre_verdict: Verdict
    executed: bool
    commands: list[list[str]]
    post_verdict: Verdict | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None and self.executed


def _missing_baseline_tags(releases_raw: list[dict]) -> set[str]:
    """Baseline refs with no PUBLISHED Release. Drafts do not count — they
    are excluded from the verdict domain, and publishing an existing draft
    for a missing baseline ref is exactly the allowed operation."""
    present = {r.get("tag_name") for r in releases_raw
               if isinstance(r, dict) and r.get("draft") is False}
    return {ref.removeprefix("refs/tags/") for ref in record_schema.BASELINE_TAGS
            if ref.removeprefix("refs/tags/") not in present}


def _allowed(verdict: Verdict, req: ReleaseOperationRequest,
             releases_raw: list[dict]) -> str | None:
    """W2 — return a refusal reason, or None when the operation is allowed.

    The judgment key is the combination (verdict, CV code, action,
    recovery_mode); recovery is context, never a blanket bypass."""
    missing = _missing_baseline_tags(releases_raw)
    if verdict.verdict in ("not-started", "aborted", "pending-tags"):
        return f"no release operation is allowed in verdict {verdict.verdict!r}"
    if verdict.verdict == "tags-ok":
        if req.recovery_mode != "none":
            return "recovery_mode must be none in tags-ok"
        if req.action not in ("create-draft", "publish"):
            return "only create-draft/publish are allowed in tags-ok"
        if req.tag not in missing:
            return "tags-ok only allows the record-declared baseline refs whose Release is missing"
        return None
    if verdict.verdict == "complete":
        if req.recovery_mode != "none":
            return "recovery_mode must be none in complete"
        if req.action not in ("create-draft", "publish"):
            return "metadata corrections require a red/CV-* recovery context"
        return None
    # verdict == red — recovery binds to the OBSERVED defect (MR2-F8): the
    # request tag must be the offending object (or the Latest candidate),
    # never an arbitrary release.
    domain = [r for r in releases_raw
              if isinstance(r, dict) and r.get("draft") is False
              and isinstance(r.get("tag_name"), str) and _NAMESPACED_TAG.match(r["tag_name"])]
    stamps = [(r.get("published_at") or "") for r in domain]
    argmax = {r["tag_name"] for r in domain if (r.get("published_at") or "") == max(stamps)} if domain else set()
    if verdict.code == "CV-RELEASE":
        if req.action != "edit-metadata" or req.recovery_mode != "metadata-correction":
            return "CV-RELEASE allows owner-approved metadata correction only"
        offending = {r["tag_name"] for r in domain if _release_p123(r)}
        if req.tag not in offending:
            return f"CV-RELEASE correction must target an offending release, not {req.tag!r}"
        return None
    if verdict.code in ("CV-LATEST-INITIAL", "CV-LATEST-STEADY"):
        if req.action != "edit-metadata" or req.recovery_mode != "metadata-correction":
            return f"{verdict.code} allows owner-approved metadata correction only"
        if not req.latest_intent:
            return f"{verdict.code} correction is a Latest correction — latest_intent must be true"
        if verdict.code == "CV-LATEST-INITIAL":
            expected = record_schema.LATEST_REF.removeprefix("refs/tags/")
            if req.tag != expected:
                return f"CV-LATEST-INITIAL correction must target {expected!r}"
        elif req.tag not in argmax:
            return f"CV-LATEST-STEADY correction must target an argmax(published_at) candidate"
        return None
    if verdict.code == "CV-PREMATURE":
        if req.recovery_mode != "premature-accept-forward":
            return "CV-PREMATURE requires recovery_mode=premature-accept-forward"
        if req.action in ("create-draft", "publish") and req.tag in missing:
            return None
        if req.action == "edit-metadata":
            if not req.latest_intent:
                return "CV-PREMATURE Latest correction requires latest_intent=true"
            if req.tag not in argmax:
                return "CV-PREMATURE Latest correction must target an argmax(published_at) candidate"
            return None
        return "CV-PREMATURE allows missing baseline Releases and Latest correction only"
    return f"no release operation is allowed in red/{verdict.code}"


def _precheck(repo: Path, req: ReleaseOperationRequest) -> str | None:
    """W3 — pre-publish object checks. Never creates a tag implicitly."""
    try:
        git(repo, "rev-parse", "--verify", f"refs/tags/{req.tag}")
    except GitError:
        return f"tag {req.tag!r} does not exist — the wrapper never creates tags (M2 apply-tags owns that)"
    m = _NAMESPACED_TAG.match(req.tag)
    if not m:
        return f"tag {req.tag!r} violates the namespaced grammar"
    # P1~P3 hold for the INTENDED FINAL metadata of every action, including
    # metadata corrections (MR2-F6): a correction that produces an invalid
    # title/marker/prerelease state is not a correction.
    expected_title = f"{m.group(1)} {m.group(2)}.{m.group(3)}.{m.group(4)}"
    if expected_title not in req.title:
        return f"title must contain {expected_title!r} (P2)"
    first = next((l.strip().strip("\r") for l in req.body.splitlines() if l.strip()), "")
    if first != P3_MARKER:
        return "body's first non-empty line must be the exact Latest marker (P3)"
    if req.prerelease:
        return "prerelease releases are rejected (P1)"
    if req.action == "create-draft" and not req.draft:
        return "create-draft requires draft=true"
    if req.action == "edit-metadata" and req.draft:
        return "edit-metadata requires draft=false — the request must equal the intended final state (MR2R-F6)"
    if req.action == "publish":
        if req.draft:
            return "publish requires draft=false"
        if not req.latest_intent:
            return "publish requires latest_intent=true (every publish names --latest explicitly)"
    return None


def _default_execute(args: list[str]) -> None:
    subprocess.run(args, check=True, capture_output=True, text=True)


def _emit_summary(result: WrapperResult) -> None:
    lines = [f"wrapper pre-verdict: {result.pre_verdict}"]
    if result.post_verdict is not None:
        lines.append(f"wrapper post-verdict: {result.post_verdict}")
    if result.error:
        lines.append(f"wrapper error: {result.error}")
    text = "\n".join(lines)
    print(text)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def run_wrapper(repo: Path, req: ReleaseOperationRequest, fetch,
                main_ref: str = "main", now: int | None = None,
                execute=_default_execute, repo_slug: str | None = None,
                dry_run: bool = False) -> WrapperResult:
    """``fetch() -> (releases_raw, latest_tag)`` supplies the Release
    observation before and after the mutation (transport in live use,
    injected in tests). ``execute(argv)`` performs the permitted gh call.
    ``dry_run`` stops after the allowed-matrix and pre-publish checks."""
    releases_raw, latest_tag = fetch()
    pre = run_cutover(repo, main_ref, releases_raw, latest_tag, now=now)
    result = WrapperResult(pre_verdict=pre, executed=False, commands=[])

    refusal = _allowed(pre, req, releases_raw) or _precheck(repo, req)
    if refusal:
        result.error = refusal
        _emit_summary(result)
        return result

    # The whole tag surface must pass the pure normal tag gate right before
    # a create/publish (MR2-F7 · MR2R-F7) — the gate reports observation
    # failures and repo-wide defects as findings, not exceptions, so ANY
    # finding is fail-closed, not only ones naming the request tag.
    if req.action in ("create-draft", "publish"):
        try:
            gate_findings = run_tag_checks(repo, main_ref)
        except GitError as e:
            result.error = f"tag gate unobservable (fail-closed): {e}"
            _emit_summary(result)
            return result
        if gate_findings:
            result.error = f"normal tag gate is not green (fail-closed): {gate_findings[0]}"
            _emit_summary(result)
            return result

    if dry_run:
        _emit_summary(result)
        return result

    slug = ["--repo", repo_slug] if repo_slug else []
    existing_draft = any(isinstance(r, dict) and r.get("tag_name") == req.tag
                         and r.get("draft") is True for r in releases_raw)
    # Every command applies the VERIFIED request metadata exactly (MR2-F6):
    # --verify-tag stops gh from implicitly creating a missing remote tag,
    # and a draft publish re-applies title/notes/prerelease rather than
    # trusting whatever the draft happened to contain.
    if req.action == "create-draft":
        cmd = ["gh", "release", "create", req.tag, *slug, "--verify-tag", "--draft",
               "--title", req.title, "--notes", req.body]
    elif req.action == "publish":
        if existing_draft:
            cmd = ["gh", "release", "edit", req.tag, *slug, "--draft=false",
                   "--prerelease=false", "--title", req.title, "--notes", req.body,
                   "--latest"]
        else:
            cmd = ["gh", "release", "create", req.tag, *slug, "--verify-tag",
                   "--title", req.title, "--notes", req.body, "--latest"]
    else:  # edit-metadata
        cmd = ["gh", "release", "edit", req.tag, *slug, "--prerelease=false",
               "--title", req.title, "--notes", req.body]
        if req.latest_intent:
            cmd.append("--latest")
    try:
        execute(cmd)
    except subprocess.CalledProcessError as e:
        result.error = f"gh execution failed: {e.stderr or e}"
        _emit_summary(result)
        return result
    result.executed = True
    result.commands.append(cmd)

    # W5 — post-mutation evaluator + exact postcondition on publish.
    post_releases, post_latest = fetch()
    result.post_verdict = run_cutover(repo, main_ref, post_releases, post_latest, now=now)
    if req.action == "publish" and post_latest != req.tag:
        result.error = f"postcondition failed: Latest is {post_latest!r}, expected {req.tag!r}"
    elif result.post_verdict.verdict == "red":
        result.error = f"post-mutation verdict is red: {result.post_verdict}"
    _emit_summary(result)
    return result
