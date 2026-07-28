"""M4 cutover verdict — ordered evaluator over the cutover record.

Structure fixed by the DR: Step 0 builds an immutable observation snapshot;
a single sequential evaluator consumes Steps 1→6B; every step assumes only
what prior steps established; states are positive predicates; failures stop
in place with an error code plus ``candidate=``/``predicate=`` detail. The
verdict is never stored — every run re-derives it.

Deviation note (driver-defined, flagged for review): the DR fixes the CV-*
code list but assigns no code to a failed *git/history observation*; those
fail closed here as ``CV-OBSERVE``.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import install_pins, record_schema
from .gitio import GitError, file_at, git, peeled
from .tag_check import run_tag_checks

# P3 exact marker — fixed by the versioning decision record (English canonical, byte-exact).
P3_MARKER = ("> **Latest** refers to the most recently published individual "
             "skill release, not a catalog version.")

INSTALL_PATHS = ("docs/INSTALL.md", "docs/INSTALL.ko.md")
_NAMESPACED_TAG = re.compile(r"^([a-z0-9][a-z0-9-]*)/v(\d+)\.(\d+)\.(\d+)$")


class DomainError(ValueError):
    """Release observation cannot be normalized — maps to CV-DOMAIN."""


@dataclass(frozen=True)
class Verdict:
    verdict: str                 # not-started|aborted|pending-tags|tags-ok|complete|red
    code: str | None = None
    candidate: str | None = None
    predicate: str | None = None
    detail: str = ""

    def __str__(self) -> str:
        parts = [self.verdict]
        if self.code:
            parts.append(self.code)
            parts.append(f"candidate={self.candidate or '-'}")
            parts.append(f"predicate={self.predicate or '-'}")
        if self.detail:
            parts.append(f"— {self.detail}")
        return " ".join(parts)


def _red(code: str, candidate: str | None, predicate: str | None, detail: str) -> Verdict:
    return Verdict("red", code, candidate, predicate, detail)


@dataclass
class Observation:
    """Step 0 snapshot. Immutable by convention: built once, then read."""
    repo: Path
    main_ref: str
    main_tip: str
    commits: list[str]                    # first-parent, tip first
    pin_class: str
    record_text: str | None
    baseline_targets: dict[str, str]      # existing baseline ref -> peeled sha
    domain: list[dict]                    # public_namespaced_releases
    latest_tag: str | None
    now: int
    history_records: list[tuple[str, dict | str]] = field(default_factory=list)
    # (commit, parsed-record dict | error string) oldest→newest, record commits only


def _combined_pin_class(repo: Path, commit: str, ref_exists_on_main) -> str:
    """Classify the EN/KO INSTALL pair as one fail-closed pin surface.

    The ordered ``(ref, copy_skill)`` sequences and their individual classes
    must be identical. Missing files, ambiguity, sequence drift, or class
    drift all collapse to PIN-OTHER.
    """
    inventories = []
    classes = []
    for path in INSTALL_PATHS:
        text = file_at(repo, commit, path)
        if text is None:
            return "PIN-OTHER"
        inventory = install_pins.parse_pins(text)
        inventories.append(inventory)
        classes.append(install_pins.classify(inventory, ref_exists_on_main))
    if inventories[0].pins != inventories[1].pins or classes[0] != classes[1]:
        return "PIN-OTHER"
    return classes[0]


def build_observation(repo: Path, main_ref: str, releases_raw: list[dict],
                      latest_tag: str | None, now: int | None = None) -> Observation:
    main_tip = peeled(repo, main_ref)
    commits = git(repo, "log", "--first-parent", "--format=%H", main_tip).split()

    def ref_on_main(tag: str) -> bool:
        try:
            target = peeled(repo, tag)
            git(repo, "merge-base", "--is-ancestor", target, main_tip)
            return True
        except GitError:
            return False

    pin_class = _combined_pin_class(repo, main_tip, ref_on_main)

    record_text = file_at(repo, main_tip, record_schema.RECORD_PATH)

    baseline_targets: dict[str, str] = {}
    for ref in record_schema.BASELINE_TAGS:
        try:
            baseline_targets[ref] = peeled(repo, ref)
        except GitError:
            continue

    # Domain normalization is exact and fail-closed (MR2-F5 · MR2R-F5): the
    # input must be an array, and a release object whose draft/prerelease/
    # tag_name/published_at cannot be typed is not "probably published" —
    # it is an incomplete observation.
    if not isinstance(releases_raw, list):
        raise DomainError("releases input is not an array")
    domain = []
    for r in releases_raw:
        if not isinstance(r, dict):
            raise DomainError("release object is not a JSON object")
        if not isinstance(r.get("draft"), bool) or not isinstance(r.get("prerelease"), bool):
            raise DomainError(f"release {r.get('tag_name')!r}: draft/prerelease must be booleans")
        tag = r.get("tag_name")
        if not isinstance(tag, str):
            raise DomainError("release object has no string tag_name")
        if r["draft"] is False:
            if not isinstance(r.get("published_at"), str) or not r["published_at"]:
                raise DomainError(f"release {tag!r}: a published release must carry a non-empty published_at")
        elif not (r.get("published_at") is None or isinstance(r.get("published_at"), str)):
            raise DomainError(f"release {tag!r}: published_at must be a string or null")
        if r["draft"] is False and _NAMESPACED_TAG.match(tag):
            domain.append(r)

    history_records: list[tuple[str, dict | str]] = []
    for commit in reversed(commits):  # oldest first
        text = file_at(repo, commit, record_schema.RECORD_PATH)
        if text is not None:
            history_records.append((commit, record_schema.parse(text)))

    return Observation(
        repo=repo, main_ref=main_ref, main_tip=main_tip, commits=commits,
        pin_class=pin_class, record_text=record_text,
        baseline_targets=baseline_targets, domain=domain,
        latest_tag=latest_tag, now=int(now if now is not None else time.time()),
        history_records=history_records)


# --- predicate helpers (each returns None when satisfied, else a Verdict) ---

def _attempt_transitions(obs: Observation) -> list[tuple[str, int, dict | str]]:
    """(commit, attempt, parent-record) for each first introduction of an
    attempt value, oldest first. Parse errors surface as error strings."""
    out: list[tuple[str, int, dict | str]] = []
    prev: dict | str | None = None
    for commit, rec in obs.history_records:
        if isinstance(rec, str):
            out.append((commit, -1, rec))
            prev = rec
            continue
        if not isinstance(prev, dict) or prev["attempt"] != rec["attempt"]:
            out.append((commit, rec["attempt"], prev if prev is not None else {}))
        prev = rec
    return out


def _check_attempts(obs: Observation, candidate: str) -> Verdict | None:
    transitions = _attempt_transitions(obs)
    if not transitions:
        return _red("CV-ATTEMPT", candidate, "T1", "record present at tip but never introduced on first-parent history")
    attempts = []
    for commit, attempt, prev in transitions:
        if attempt == -1:
            return _red("CV-SCHEMA", candidate, "historical", f"unreadable record at {commit[:12]}: {prev}")
        attempts.append((commit, attempt, prev))
    if attempts[0][1] != 1:
        return _red("CV-ATTEMPT", candidate, "T1", f"first attempt is {attempts[0][1]}, must be 1")
    for i in range(1, len(attempts)):
        commit, attempt, prev = attempts[i]
        if attempt != attempts[i - 1][1] + 1:
            return _red("CV-ATTEMPT", candidate, "T2", f"attempt {attempts[i - 1][1]} -> {attempt} at {commit[:12]}")
        if not (isinstance(prev, dict) and prev.get("phase") == "aborted"):
            return _red("CV-ATTEMPT", candidate, "T3", f"attempt increased at {commit[:12]} without an aborted predecessor")
        idx = obs.commits.index(commit)
        parent = obs.commits[idx + 1] if idx + 1 < len(obs.commits) else None
        if parent is not None:
            if _combined_pin_class(obs.repo, parent, lambda _t: False) != "PIN-LEGACY":
                return _red("CV-ATTEMPT", candidate, "T3", f"attempt increased at {commit[:12]} while parent pins were not PIN-LEGACY")
        # T3's third condition — the previous attempt created NO refs — is
        # not provable from any current git observation (deleted tags leave
        # no trace). Owner decision 2026-07-28 (MR2-F3): retries fail closed
        # and are released only through the cutover ⓪ owner procedure
        # (owned by the cutover execution work), which verifies ref absence directly.
        return _red("CV-ATTEMPT", candidate, "T3-unprovable",
                    f"attempt increase at {commit[:12]} cannot be machine-verified (previous attempt's ref absence is unobservable); owner gate required — see cutover step ⓪")
    return None


def _expected_target(obs: Observation, attempt: int) -> str | None:
    """First-parent commit where the record first carried ``attempt``."""
    for commit, a, _prev in _attempt_transitions(obs):
        if a == attempt:
            return commit
    return None


def _prepared_identity(obs: Observation, record: dict, candidate: str) -> Verdict | None:
    fail = _check_attempts(obs, candidate)
    if fail:
        return fail
    expected = _expected_target(obs, record["attempt"])
    if expected is None:
        return _red("CV-ATTEMPT", candidate, "T1", f"no commit introduces attempt {record['attempt']}")
    idx = obs.commits.index(expected)
    parent = obs.commits[idx + 1] if idx + 1 < len(obs.commits) else None
    if parent is None:
        return _red("CV-SAME", candidate, "Q-SAME", "cutover commit has no first parent")
    try:
        changed = git(obs.repo, "diff", "--name-only", parent, expected).splitlines()
    except GitError as e:
        return _red("CV-OBSERVE", candidate, "Q-SAME", f"diff unobservable (fail-closed): {e}")
    if record_schema.RECORD_PATH not in changed or not all(path in changed for path in INSTALL_PATHS):
        return _red("CV-SAME", candidate, "Q-SAME", "record transition and pin switch are not in the same commit")
    # Q-SAME requires the ACTUAL pin switch, not any INSTALL edit (MR2-F1):
    # the cutover commit must take the inventory from PIN-LEGACY to exactly
    # PIN-BASELINE.
    def _class_at(commit: str) -> str:
        return _combined_pin_class(obs.repo, commit, lambda _t: False)
    if _class_at(parent) != "PIN-LEGACY" or _class_at(expected) != "PIN-BASELINE":
        return _red("CV-SAME", candidate, "Q-SAME",
                    f"cutover commit does not switch pins PIN-LEGACY -> PIN-BASELINE (parent={_class_at(parent)}, target={_class_at(expected)})")
    try:
        git(obs.repo, "cat-file", "-e", f"{record_schema.BASELINE_FINALIZATION_SHA}^{{commit}}")
        git(obs.repo, "merge-base", "--is-ancestor", record_schema.BASELINE_FINALIZATION_SHA, obs.main_tip)
    except GitError:
        return _red("CV-BASE", candidate, "Q-BASE", "baseline finalization SHA missing or not reachable from main")
    try:
        tree_a = git(obs.repo, "rev-parse", f"{expected}:skills").strip()
        tree_b = git(obs.repo, "rev-parse", f"{record_schema.BASELINE_FINALIZATION_SHA}:skills").strip()
    except GitError as e:
        return _red("CV-OBSERVE", candidate, "Q-TREE", f"skills tree unobservable (fail-closed): {e}")
    if tree_a != tree_b:
        return _red("CV-TREE", candidate, "Q-TREE", "skills/ tree differs from the baseline finalization tree")
    return None


def _clock(obs: Observation, candidate: str) -> Verdict | None:
    """Public-breakage clock: onset = committer time of the most recent
    first-parent commit that left PIN-LEGACY. pending-tags only, cap 1h."""
    onset_sha = None
    for i, commit in enumerate(obs.commits):
        cls = _combined_pin_class(obs.repo, commit, lambda _t: True)
        if cls == "PIN-LEGACY":
            continue
        parent = obs.commits[i + 1] if i + 1 < len(obs.commits) else None
        if parent is None:
            onset_sha = commit
            break
        parent_cls = _combined_pin_class(obs.repo, parent, lambda _t: True)
        if parent_cls == "PIN-LEGACY":
            onset_sha = commit
            break
    if onset_sha is None:
        return _red("CV-OBSERVE", candidate, "clock", "no PIN-LEGACY departure found on first-parent history (fail-closed)")
    try:
        onset = int(git(obs.repo, "log", "-1", "--format=%ct", onset_sha).strip())
    except (GitError, ValueError) as e:
        return _red("CV-OBSERVE", candidate, "clock", f"onset time unobservable (fail-closed): {e}")
    if obs.now - onset > 3600:
        return _red("CV-CLOCK", candidate, "clock", f"public breakage window exceeded 1h (onset {onset_sha[:12]})")
    return None


def _release_p123(release: dict) -> str | None:
    """Return the violated predicate name, or None."""
    if release.get("prerelease") is True:
        return "P1"
    tag = release.get("tag_name", "")
    m = _NAMESPACED_TAG.match(tag)
    if not m:
        return "P2"
    expected_title = f"{m.group(1)} {m.group(2)}.{m.group(3)}.{m.group(4)}"
    if expected_title not in (release.get("name") or ""):
        return "P2"
    body = release.get("body") or ""
    first = next((l.strip().strip("\r") for l in body.splitlines() if l.strip()), "")
    if first != P3_MARKER:
        return "P3"
    return None


# --- the ordered evaluator ---

def evaluate(obs: Observation) -> Verdict:
    baseline_refs = set(record_schema.BASELINE_TAGS)
    ref_count = len(obs.baseline_targets)

    # Step 1 — record-absence classifier.
    if obs.record_text is None:
        if obs.pin_class == "PIN-LEGACY" and ref_count == 0 and not obs.domain:
            return Verdict("not-started")
        return _red("CV-ORPHAN", None, "pre-start",
                    f"no record but pins={obs.pin_class}, baseline refs={ref_count}, releases={len(obs.domain)}")

    # Step 2 — schema validation (record exists).
    record = record_schema.parse(obs.record_text)
    if isinstance(record, str):
        return _red("CV-SCHEMA", None, record.split(":", 1)[0], record)

    # Step 3 — candidate classification (phase × ref count).
    phase = record["phase"]
    if phase == "aborted" and ref_count == 0:
        candidate = "aborted"
    elif phase == "aborted":
        return _red("CV-ABORT-TAGS", "aborted", "ref-count", f"{ref_count} baseline refs exist under an aborted record")
    elif ref_count == 0:
        candidate = "pending-tags"
    elif ref_count < len(baseline_refs):
        return _red("CV-PARTIAL-TAGS", "pending-tags", "ref-count", f"{ref_count}/{len(baseline_refs)} baseline refs exist — atomic contract violated")
    else:
        candidate = "tags-ok"

    # Step 4 — positive predicates per candidate (Step 5: fail in place).
    if candidate == "aborted":
        if obs.pin_class != "PIN-LEGACY":
            return _red("CV-ABORT-PIN", candidate, "pin", f"pins={obs.pin_class}, aborted requires PIN-LEGACY")
        fail = _check_attempts(obs, candidate)
        if fail:
            return fail
        return Verdict("aborted")

    if candidate == "pending-tags":
        if obs.pin_class != "PIN-BASELINE":
            return _red("CV-PIN", candidate, "pin", f"pins={obs.pin_class}, pending-tags requires PIN-BASELINE")
        fail = _prepared_identity(obs, record, candidate) or _clock(obs, candidate)
        if fail:
            return fail
        return Verdict("pending-tags")

    # candidate == tags-ok
    fail = _prepared_identity(obs, record, candidate)
    if fail:
        return fail
    expected = _expected_target(obs, record["attempt"])
    assert expected is not None  # _prepared_identity established it
    for ref, target in obs.baseline_targets.items():
        if target != expected:
            return _red("CV-TARGET", candidate, "baseline-target", f"{ref} -> {target[:12]} != expected {expected[:12]}")
    # Freeze spans the whole attempt (MR2-F2): with refs in existence, the
    # record must exist unchanged at EVERY first-parent commit from its
    # introduction to the tip — a delete-and-restore inside the span is a
    # freeze violation, not a wash.
    intro_idx = obs.commits.index(expected)
    for commit in obs.commits[:intro_idx + 1]:
        span_record = file_at(obs.repo, commit, record_schema.RECORD_PATH)
        if span_record is None:
            return _red("CV-FROZEN", candidate, "record-freeze", f"record absent at {commit[:12]} inside the frozen span")
        if span_record != obs.record_text:
            return _red("CV-FROZEN", candidate, "record-freeze", f"record differs at {commit[:12]} inside the frozen span")
    baseline_releases = [r for r in obs.domain if f"refs/tags/{r.get('tag_name')}" in baseline_refs]
    successors = [r for r in obs.domain if f"refs/tags/{r.get('tag_name')}" not in baseline_refs]
    for r in obs.domain:
        violated = _release_p123(r)
        if violated:
            return _red("CV-RELEASE", candidate, violated, f"release {r.get('tag_name')!r} violates {violated}")
    if successors:
        try:
            tag_findings = run_tag_checks(obs.repo, obs.main_ref)
        except GitError as e:
            return _red("CV-OBSERVE", candidate, "tag-gate", f"tag checks unobservable (fail-closed): {e}")
        successor_tags = {r.get("tag_name") for r in successors}
        for f in tag_findings:
            if f.subject in successor_tags or f.subject.removeprefix("refs/tags/") in successor_tags:
                return _red("CV-RELEASE", candidate, "tag-gate", f"successor tag fails the normal tag gate: {f}")

    # Step 6A — pin gate, chosen by baseline Release count.
    if len(baseline_releases) < len(baseline_refs):
        if obs.pin_class != "PIN-BASELINE":
            return _red("CV-PIN", candidate, "pin-6A", f"pins={obs.pin_class}, cutover in progress requires PIN-BASELINE")
    else:
        if obs.pin_class not in ("PIN-NAMESPACED", "PIN-BASELINE"):
            return _red("CV-PIN", candidate, "pin-6A", f"pins={obs.pin_class}, promoted state requires PIN-NAMESPACED")

    # Step 6B — promotion and steady state.
    latest_expected = record_schema.LATEST_REF.removeprefix("refs/tags/")
    if len(baseline_releases) < len(baseline_refs):
        if successors:
            return _red("CV-PREMATURE", candidate, "promotion", "an ordinary release was published before the cutover completed")
        return Verdict("tags-ok")
    if not successors:
        if obs.latest_tag == latest_expected:
            return Verdict("complete", detail="initial promotion")
        return _red("CV-LATEST-INITIAL", candidate, "promotion", f"Latest is {obs.latest_tag!r}, expected {latest_expected!r}")
    stamps = [(r.get("published_at") or "") for r in obs.domain]
    argmax = {r.get("tag_name") for r in obs.domain if (r.get("published_at") or "") == max(stamps)}
    if obs.latest_tag in argmax:
        return Verdict("complete", detail="steady state")
    return _red("CV-LATEST-STEADY", candidate, "promotion", f"Latest {obs.latest_tag!r} not in argmax(published_at) {sorted(argmax)}")


def run_cutover(repo: Path, main_ref: str, releases_raw: list[dict],
                latest_tag: str | None, now: int | None = None) -> Verdict:
    try:
        obs = build_observation(repo, main_ref, releases_raw, latest_tag, now)
    except DomainError as e:
        return _red("CV-DOMAIN", None, "normalization", f"release domain unnormalizable (fail-closed): {e}")
    except GitError as e:
        return _red("CV-OBSERVE", None, "step-0", f"observation failed (fail-closed): {e}")
    return evaluate(obs)
