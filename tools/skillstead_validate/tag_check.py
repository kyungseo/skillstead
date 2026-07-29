"""M3 continuous tag checks (tag invariants and the durable expected-target relation).

Runs on every CI execution, not once at tag creation — tags are mutable, so
creation-time checks guarantee nothing durable. Checks:

* I-2  — the peeled target declares exactly the tag's version.
* I-8  — the peeled target is a commit on ``main``.
* I-3-ⓒ — durable relation: the expected target is derived *without looking
  at the tag*. General tags: the oldest ``main`` first-parent commit where the
  skill's declared version changed to the tag's version. Baseline tags (exact
  ref membership in the cutover record's ``baseline_tags``): the first-parent
  commit where the record with the current ``attempt`` was introduced.
* I-5  — partial deletion of a multi-skill release: every skill whose version
  changed at an observed release commit must still have its tag there.

Comparisons use peeled commit SHAs (annotated and lightweight tags mix in
this repository's history). Every unobservable input is a finding
(fail-closed).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from . import record_schema
from .evidence_records import (
    RETIREMENT_DIR,
    RecordError,
    RetirementRecord,
    parse_retirement_record,
)
from .findings import Finding
from .frontmatter import FrontmatterError, parse_skill_frontmatter
from .gitio import (
    GitError,
    dirs_at,
    file_at,
    files_at,
    git,
    peeled,
    tag_names,
)

RECORD_PATH = record_schema.RECORD_PATH
_TAG_RE = re.compile(r"^([a-z0-9][a-z0-9-]*)/v(\d+\.\d+\.\d+)$")
_TAG_SHAPE = re.compile(r"^[^/]+/v")


class _RecordError(ValueError):
    pass


def _no_duplicates(pairs: list[tuple[str, object]]) -> dict:
    d: dict = {}
    for k, v in pairs:
        if k in d:
            raise _RecordError(f"duplicate JSON key: {k!r}")
        d[k] = v
    return d


def _record_at(repo: Path, commit: str) -> dict | None:
    """Record read for M3. Full S1~S10 belongs to the cutover evaluator, but
    every field M3 *trusts* is validated against the canonical constants —
    an arbitrary ``baseline_tags`` array would let a forged record widen the
    baseline exception and bypass the durable relation (MR1-F5).
    Unacceptable content raises (fail-closed)."""
    text = file_at(repo, commit, RECORD_PATH)
    if text is None:
        return None
    try:
        raw = json.loads(text, object_pairs_hook=_no_duplicates)
    except (json.JSONDecodeError, _RecordError) as e:
        raise _RecordError(str(e)) from None
    if not isinstance(raw, dict):
        raise _RecordError("record is not a JSON object")
    if raw.get("schema") != record_schema.SCHEMA:
        raise _RecordError(f"schema must be {record_schema.SCHEMA!r}")
    if raw.get("phase") not in record_schema.PHASES:
        raise _RecordError("phase must be 'prepared' or 'aborted'")
    attempt = raw.get("attempt")
    if not isinstance(attempt, int) or isinstance(attempt, bool) or attempt < 1:
        raise _RecordError("attempt must be an integer >= 1")
    tags = raw.get("baseline_tags")
    if tags != list(record_schema.BASELINE_TAGS):
        raise _RecordError("baseline_tags must equal the canonical four refs in order")
    return {"baseline_tags": tags, "attempt": attempt}


class _History:
    """Cached first-parent observations along ``main``."""

    def __init__(self, repo: Path, main_tip: str) -> None:
        self.repo = repo
        out = git(repo, "log", "--first-parent", "--format=%H", main_tip)
        self.commits: list[str] = out.split()  # tip first
        self._versions: dict[tuple[str, str], str | None] = {}

    def version_at(self, commit: str, skill: str) -> str | None:
        key = (commit, skill)
        if key not in self._versions:
            text = file_at(self.repo, commit, f"skills/{skill}/SKILL.md")
            version: str | None = None
            if text is not None:
                try:
                    version = parse_skill_frontmatter(text).get("metadata.version")
                except FrontmatterError:
                    version = None
            self._versions[key] = version
        return self._versions[key]

    def oldest_version_change(self, skill: str, version: str) -> str | None:
        """Oldest first-parent commit where the skill's declared version
        changed to ``version`` (root counts as a change)."""
        found: str | None = None
        for i, commit in enumerate(self.commits):
            if self.version_at(commit, skill) != version:
                continue
            parent = self.commits[i + 1] if i + 1 < len(self.commits) else None
            if parent is None or self.version_at(parent, skill) != version:
                found = commit  # keep scanning: oldest (deepest) wins
        return found

    def record_intro(self, attempt: int) -> tuple[str | None, list[str]]:
        """Oldest first-parent commit whose record carries ``attempt``, plus
        the commits where a record exists but cannot be accepted — those are
        fail-closed findings, not silent skips (MR1-F5)."""
        found: str | None = None
        bad: list[str] = []
        for commit in self.commits:
            try:
                record = _record_at(self.repo, commit)
            except _RecordError:
                bad.append(commit)
                continue
            if record is not None and record["attempt"] == attempt:
                found = commit
        return found, bad


def _retirement_history_findings(
        repo: Path, history: _History) -> list[Finding]:
    """Continuous first-parent durability and reactivation checks.

    Once a valid record appears, every later first-parent state must preserve
    its path and semantic value. A current-tree-only check cannot distinguish a
    deleted record plus re-added package from a new skill.
    """
    findings: list[Finding] = []
    known: dict[str, RetirementRecord] = {}
    reported: set[tuple[str, str]] = set()

    def report(kind: str, skill: str, commit: str, detail: str) -> None:
        key = (kind, skill)
        if key not in reported:
            reported.add(key)
            findings.append(Finding(
                "RETIREMENT-HISTORY", skill,
                f"{detail} at {commit[:12]} (fail-closed)"))

    for commit in reversed(history.commits):  # oldest -> tip
        try:
            paths = files_at(repo, commit, RETIREMENT_DIR)
        except GitError as error:
            findings.append(Finding(
                "GIT", RETIREMENT_DIR,
                f"retirement history unobservable at {commit[:12]} "
                f"(fail-closed): {error}"))
            return findings

        current: dict[str, RetirementRecord] = {}
        prefix = RETIREMENT_DIR + "/"
        for path in sorted(paths):
            leaf = path.removeprefix(prefix)
            if "/" in leaf or not leaf.endswith(".json"):
                findings.append(Finding(
                    "RETIREMENT-HISTORY", path,
                    f"unexpected retirement record path at {commit[:12]} "
                    "(fail-closed)"))
                continue
            skill = leaf[:-5]
            text = file_at(repo, commit, path)
            if text is None:
                findings.append(Finding(
                    "RETIREMENT-HISTORY", path,
                    f"record content unobservable at {commit[:12]} "
                    "(fail-closed)"))
                continue
            try:
                current[skill] = parse_retirement_record(text, skill)
            except RecordError as error:
                findings.append(Finding(
                    "RETIREMENT-HISTORY", path,
                    f"record rejected at {commit[:12]} "
                    f"(fail-closed): {error}"))

        for skill, original in known.items():
            observed = current.get(skill)
            if observed is None:
                report(
                    "missing", skill, commit,
                    "retirement record disappeared or moved")
            elif observed != original:
                report(
                    "mutated", skill, commit,
                    "retirement record semantic value changed")

        for skill, record in current.items():
            known.setdefault(skill, record)

        if known:
            try:
                inventory = dirs_at(repo, commit, "skills")
            except GitError as error:
                findings.append(Finding(
                    "GIT", "skills/",
                    f"reactivation inventory unobservable at {commit[:12]} "
                    f"(fail-closed): {error}"))
                return findings
            for skill in sorted(set(known) & inventory):
                report(
                    "reactivated", skill, commit,
                    "active package coexists with historical retirement")
    return findings


def run_tag_checks(repo: Path, main_ref: str = "main") -> list[Finding]:
    findings: list[Finding] = []
    try:
        main_tip = peeled(repo, main_ref)
        history = _History(repo, main_tip)
    except GitError as e:
        return [Finding("GIT", main_ref, f"main history unobservable (fail-closed): {e}")]

    findings.extend(_retirement_history_findings(repo, history))

    record: dict | None = None
    try:
        record = _record_at(repo, main_tip)
    except _RecordError as e:
        findings.append(Finding("RECORD", RECORD_PATH, f"record unreadable (fail-closed): {e}"))
    baseline_refs = set(record["baseline_tags"]) if record else set()

    record_intro: str | None = None
    if record is not None:
        record_intro, bad_commits = history.record_intro(record["attempt"])
        for commit in bad_commits:
            findings.append(Finding("RECORD", RECORD_PATH, f"record at {commit[:12]} is unreadable or non-canonical (fail-closed)"))
        if record_intro is None:
            findings.append(Finding("RECORD", RECORD_PATH, f"no first-parent commit introduces attempt {record['attempt']} (fail-closed)"))

    try:
        all_tags = tag_names(repo)
    except GitError as e:
        findings.append(Finding("GIT", "tags", f"tag list unobservable (fail-closed): {e}"))
        return findings

    namespaced: dict[str, tuple[str, str]] = {}  # name -> (skill, version)
    for name in all_tags:
        m = _TAG_RE.match(name)
        if m:
            namespaced[name] = (m.group(1), m.group(2))
        elif _TAG_SHAPE.match(name):
            findings.append(Finding("D3-3", name, "tag violates <name>/vMAJOR.MINOR.PATCH grammar"))

    targets: dict[str, str] = {}
    for name, (skill, version) in sorted(namespaced.items()):
        try:
            target = peeled(repo, name)
        except GitError as e:
            findings.append(Finding("GIT", name, f"tag target unobservable (fail-closed): {e}"))
            continue
        targets[name] = target

        # I-8: target must be a commit on main.
        try:
            git(repo, "merge-base", "--is-ancestor", target, main_tip)
            on_main = True
        except GitError:
            on_main = False
        if not on_main:
            findings.append(Finding("I-8", name, f"target {target[:12]} is not on {main_ref}"))

        # I-2: declared version at the target equals the tag version.
        declared = history.version_at(target, skill)
        if declared != version:
            findings.append(Finding("I-2", name, f"metadata.version at target is {declared!r}, tag says {version!r}"))

        # I-3-ⓒ: expected target derived independently of the tag.
        full_ref = f"refs/tags/{name}"
        if full_ref in baseline_refs:
            if record_intro is not None and target != record_intro:
                findings.append(Finding("I-3-c", name, f"baseline tag target {target[:12]} != record introduction commit {record_intro[:12]}"))
        else:
            expected = history.oldest_version_change(skill, version) if on_main else None
            if expected is None:
                findings.append(Finding("I-3-c", name, f"no main first-parent commit introduces version {version} for {skill} (fail-closed)"))
            elif target != expected:
                findings.append(Finding("I-3-c", name, f"target {target[:12]} != expected {expected[:12]} (repoint suspected)"))

    # I-5: existence only — target correctness is I-3-ⓒ's job, and merging
    # the two would leak the baseline exception into I-5 (the contract requires
    # the separation). Two derivations of the expected set:
    #
    # 1. Existing-tag anchored (works pre-record): at every observed release
    #    commit, every skill whose version changed there must have its tag.
    # 2. Record anchored (MR1-F6 — catches FULL deletion): from the record
    #    introduction commit to the tip, every first-parent version change
    #    must have its tag. Derived without looking at existing tags.
    #
    # Baseline refs are checked directly against the record list: all four
    # must exist once any of them exists; zero existing baseline refs is the
    # pending window the cutover evaluator owns, so M3 stays silent there.
    reported_i5: set[str] = set()
    position = {c: i for i, c in enumerate(history.commits)}

    def _expect_changes_at(commit: str) -> None:
        idx = position[commit]
        parent = history.commits[idx + 1] if idx + 1 < len(history.commits) else None
        try:
            skills_here = dirs_at(repo, commit, "skills")
        except GitError as e:
            findings.append(Finding("GIT", commit[:12], f"inventory unobservable (fail-closed): {e}"))
            return
        for skill in sorted(skills_here):
            version = history.version_at(commit, skill)
            if version is None:
                continue
            if parent is not None and history.version_at(parent, skill) == version:
                continue
            tag = f"{skill}/v{version}"
            if f"refs/tags/{tag}" in baseline_refs:
                continue  # baseline existence is checked from the record list
            if tag not in targets and tag not in reported_i5:
                reported_i5.add(tag)
                findings.append(Finding("I-5", tag, f"version changed at {commit[:12]} but the tag does not exist (deletion suspected)"))

    for commit in sorted(set(targets.values())):
        if commit in position:  # off-main targets already reported via I-8
            _expect_changes_at(commit)

    if record is not None and record_intro is not None:
        existing_refs = {f"refs/tags/{name}" for name in namespaced}
        present = [r for r in baseline_refs if r in existing_refs]
        if present and len(present) < len(baseline_refs):
            for ref in sorted(set(baseline_refs) - set(present)):
                findings.append(Finding("I-5", ref, "baseline ref missing while others exist (partial deletion of the baseline set)"))
        intro_idx = position.get(record_intro, len(history.commits))
        for commit in history.commits[:intro_idx + 1]:
            _expect_changes_at(commit)

    return findings
