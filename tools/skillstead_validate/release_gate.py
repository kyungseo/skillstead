"""M2 release preflight and apply-tags (the payload-diff release gate).

Preflight judges a proposed release plan against the observed repository
without mutating anything. ``apply_tags`` is the only supported tag-mutation
path and re-runs preflight before creating refs. All observation failures are
findings (fail-closed).
"""

from __future__ import annotations

import re
from pathlib import Path

from . import SEMVER_RE, record_schema
from .bump import default_step, step_of
from .changelog import ChangelogError, topmost_released_version
from .catalog import EN_HEADER, KO_HEADER, CatalogError, catalog_versions
from .evidence_records import (
    RecordError,
    major_approval_path,
    parse_major_approval_record,
    parse_retirement_record,
    retirement_path,
)
from .findings import Finding
from .frontmatter import FrontmatterError, parse_skill_frontmatter
from .gitio import (GitError, dirs_at, file_at, first_parent_positions, git,
                    peeled, tag_names)
from .install_pins import parse_pins
from .normalize import changed_payload_paths, payload_changed
from .package_check import run_repo_validation_at
from .release_plan import ReleasePlan

_SEMVER = re.compile(SEMVER_RE)
_TAG_RE = re.compile(r"^([a-z0-9][a-z0-9-]*)/v(\d+\.\d+\.\d+)$")

# D2-2: a human adjustment away from the path-default step must record its
# reason. The reason must be a standalone, non-empty marker line inside the
# release's CHANGELOG entry (documented in docs/VERSIONING.md by this Work).
ADJUSTMENT_MARKER = "Bump-Adjustment:"
_ADJUSTMENT_LINE = re.compile(r"^Bump-Adjustment:[ \t]+\S.*$", re.MULTILINE)


def namespace_tags(repo: Path, skill: str) -> dict[str, str]:
    """{version: tag name} for one skill namespace; grammar violations excluded."""
    result: dict[str, str] = {}
    for name in tag_names(repo, f"{skill}/v*"):
        m = _TAG_RE.match(name)
        if m and m.group(1) == skill:
            result[m.group(2)] = name
    return result


def previous_release(repo: Path, skill: str) -> tuple[str, str] | None:
    """(version, tag name) of the previous release — highest version lineage
    (version lineage, not creation time — see docs/VERSIONING.md)."""
    tags = namespace_tags(repo, skill)
    if not tags:
        return None
    version = max(tags, key=lambda v: tuple(int(x) for x in v.split(".")))
    return version, tags[version]


def _latest_release_commit(repo: Path, target: str) -> str | None:
    """Target commit of the most recent namespaced release, by first-parent
    order from ``target`` (I-10 baseline)."""
    positions = first_parent_positions(repo, target)
    best: tuple[int, str] | None = None
    for name in tag_names(repo):
        if not _TAG_RE.match(name):
            continue
        sha = peeled(repo, name)
        if sha in positions:
            if best is None or positions[sha] < best[0]:
                best = (positions[sha], sha)
    return best[1] if best else None


def _entry_section(changelog_text: str, version: str) -> str | None:
    lines = changelog_text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.startswith(f"## [{version}]"):
            start = i
            break
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("## "):
            end = j
            break
    return "\n".join(lines[start:end])


def _retired_row(skill: str, last_release_ref: str | None) -> str:
    release = last_release_ref or "unreleased"
    path = retirement_path(skill)
    return f"| `{skill}` | `{release}` | [record](./{path}) |"


_RETIRED_TABLES = {
    "README.md": (
        "## Retired skills",
        "| Skill | Last release | Evidence |",
        "| --- | --- | --- |",
    ),
    "README.ko.md": (
        "## 은퇴한 스킬",
        "| 스킬 | 마지막 릴리스 | 증거 |",
        "| --- | --- | --- |",
    ),
}


def _retired_table_contains(text: str, fname: str, expected_row: str) -> bool:
    """Require the evidence row inside one explicit retired-skills table."""
    heading, header, separator = _RETIRED_TABLES[fname]
    lines = text.splitlines()
    positions = [i for i, line in enumerate(lines) if line == heading]
    if len(positions) != 1:
        return False
    start = positions[0] + 1
    end = next(
        (i for i in range(start, len(lines)) if lines[i].startswith("## ")),
        len(lines),
    )
    section = lines[start:end]
    for i in range(len(section) - 1):
        if section[i] == header and section[i + 1] == separator:
            return expected_row in section[i + 2:]
    return False


def _retirement_findings(
        repo: Path, target: str, skill: str) -> list[Finding]:
    """I-10 target-tree half of the retirement contract."""
    findings: list[Finding] = []
    path = retirement_path(skill)
    text = file_at(repo, target, path)
    if text is None:
        return [Finding(
            "I-10", skill,
            f"inventory decreased without retirement record {path}")]
    try:
        record = parse_retirement_record(text, skill)
    except RecordError as error:
        return [Finding(
            "RETIREMENT", path, f"record rejected (fail-closed): {error}")]

    previous = previous_release(repo, skill)
    if previous is None:
        if record.last_release_ref is not None:
            findings.append(Finding(
                "RETIREMENT", path,
                "unreleased skill must use last_release_ref null"))
    elif record.last_release_ref != previous[1]:
        findings.append(Finding(
            "RETIREMENT", path,
            f"last_release_ref {record.last_release_ref!r} != latest "
            f"observable release {previous[1]!r}"))

    for fname in ("docs/INSTALL.md", "docs/INSTALL.ko.md"):
        install = file_at(repo, target, fname)
        if install is None:
            findings.append(Finding(
                "RETIREMENT", fname,
                "install document missing; active-pin removal unobservable"))
            continue
        pins = parse_pins(install)
        if pins.ambiguous:
            findings.append(Finding(
                "RETIREMENT", fname,
                "install pin inventory is ambiguous (fail-closed)"))
        if any(pin.copy_skill == skill for pin in pins.pins):
            findings.append(Finding(
                "RETIREMENT", fname,
                f"active install pin remains for retired skill {skill}"))

    expected_row = _retired_row(skill, record.last_release_ref)
    for fname in ("README.md", "README.ko.md"):
        root = file_at(repo, target, fname)
        if root is None or not _retired_table_contains(
                root, fname, expected_row):
            findings.append(Finding(
                "RETIREMENT", fname,
                f"localized retired table must contain exact material row "
                f"{expected_row!r}"))
    return findings


def _major_approval_findings(
        repo: Path, target: str, skill: str, previous_ref: str,
        proposed_version: str) -> list[Finding]:
    path = major_approval_path(skill, proposed_version)
    text = file_at(repo, target, path)
    if text is None:
        return [Finding(
            "MAJOR-APPROVAL", path,
            "single-step major transition requires a tracked approval record")]
    try:
        record = parse_major_approval_record(
            text, skill, proposed_version)
    except RecordError as error:
        return [Finding(
            "MAJOR-APPROVAL", path,
            f"record rejected (fail-closed): {error}")]
    if record.previous_ref != previous_ref:
        return [Finding(
            "MAJOR-APPROVAL", path,
            f"previous_ref {record.previous_ref!r} != latest observable "
            f"release {previous_ref!r}")]
    return []


def _baseline_record_at(repo: Path, target: str,
                        plan: ReleasePlan) -> dict | None:
    """Return the record only when this is the exact baseline plan."""
    text = file_at(repo, target, record_schema.RECORD_PATH)
    if text is None:
        return None
    record = record_schema.parse(text)
    if isinstance(record, str) or record["phase"] != "prepared":
        return None
    if [entry.proposed_ref for entry in plan.releases] != record["baseline_tags"]:
        return None
    return record


def _baseline_findings(repo: Path, plan: ReleasePlan, target: str,
                       inventory: set[str], ordered: list[str],
                       target_idx: int, record: dict) -> list[Finding]:
    """One-time M2 baseline branch, bound to the exact cutover record."""
    findings: list[Finding] = []
    expected_refs = list(record["baseline_tags"])
    actual_refs = [entry.proposed_ref for entry in plan.releases]
    if actual_refs != expected_refs:
        findings.append(Finding(
            "D3-3", "baseline plan",
            "release entries must equal cutover-record baseline_tags in canonical order"))

    for entry, expected_ref in zip(plan.releases, expected_refs):
        expected_skill = expected_ref.removeprefix("refs/tags/").rsplit("/v", 1)[0]
        if (entry.skill != expected_skill or entry.previous_ref is not None
                or entry.proposed_version != "0.8.0"
                or entry.proposed_ref != expected_ref):
            findings.append(Finding(
                "D3-3", entry.skill,
                "baseline entry must use the canonical skill/ref, previous_ref null, and version 0.8.0"))

    # The target is the first commit on main's first-parent history where the
    # current attempt N appears. A later commit carrying the same record is not
    # eligible for the exception.
    intro = None
    previous_attempt = None
    previous_record = None
    attempt_sequence: list[int] = []
    for commit in reversed(ordered[target_idx:]):
        text = file_at(repo, commit, record_schema.RECORD_PATH)
        parsed = record_schema.parse(text) if text is not None else None
        if isinstance(parsed, str):
            findings.append(Finding(
                "D3-3", "baseline history",
                f"record at {commit[:12]} is unreadable: {parsed}"))
            continue
        attempt = parsed.get("attempt") if isinstance(parsed, dict) else None
        if attempt is not None and attempt != previous_attempt:
            attempt_sequence.append(attempt)
        if attempt == record["attempt"] and previous_attempt != attempt and intro is None:
            intro = commit
            if attempt > 1 and not (
                    isinstance(previous_record, dict)
                    and previous_record.get("phase") == "aborted"):
                findings.append(Finding(
                    "D3-3", "baseline attempt",
                    f"attempt {attempt} must follow an aborted predecessor"))
        previous_attempt = attempt
        previous_record = parsed
    if attempt_sequence and (
            attempt_sequence[0] != 1
            or any(current != previous + 1
                   for previous, current in zip(
                       attempt_sequence, attempt_sequence[1:]))):
        findings.append(Finding(
            "D3-3", "baseline attempt",
            f"attempt sequence must start at 1 and increase by one: {attempt_sequence}"))
    if intro != target:
        findings.append(Finding(
            "D3-3", "baseline target",
            f"target must introduce attempt {record['attempt']} on main first-parent history"))

    # I-10 remains active in the baseline branch: the frozen baseline
    # inventory may not shrink before the cutover target.
    try:
        baseline_inventory = dirs_at(
            repo, record["baseline_finalization_sha"], "skills")
    except GitError as error:
        findings.append(Finding(
            "GIT", "skills/",
            f"I-10 baseline inventory unobservable (fail-closed): {error}"))
    else:
        removed = baseline_inventory - inventory
        if removed:
            findings.append(Finding(
                "I-10", ",".join(sorted(removed)),
                "inventory decreased from baseline_finalization_sha"))
    return findings


def preflight(repo: Path, plan: ReleasePlan, main_ref: str = "main") -> list[Finding]:
    findings: list[Finding] = []
    try:
        target = peeled(repo, plan.target_commit)
    except GitError as e:
        return [Finding("GIT", plan.target_commit, f"target unresolvable (fail-closed): {e}")]

    # The tag target must be a main first-parent commit (I-8 pre-mutation).
    try:
        positions = first_parent_positions(repo, main_ref)
    except GitError as e:
        return [Finding("GIT", main_ref, f"main history unobservable (fail-closed): {e}")]
    if target not in positions:
        return [Finding("I-8", plan.target_commit, f"target {target[:12]} is not on {main_ref} first-parent history")]
    ordered = sorted(positions, key=positions.__getitem__)
    idx = positions[target]
    target_parent = ordered[idx + 1] if idx + 1 < len(ordered) else None

    try:
        inventory = dirs_at(repo, target, "skills")
    except GitError as e:
        return [Finding("GIT", "skills/", f"inventory unobservable (fail-closed): {e}")]
    baseline_record = _baseline_record_at(repo, target, plan)

    # Per-entry structural checks.
    for e in plan.releases:
        if not _SEMVER.match(e.proposed_version):
            findings.append(Finding("D3-3", e.skill, f"proposed_version {e.proposed_version!r} is not MAJOR.MINOR.PATCH"))
            continue
        expected_ref = f"refs/tags/{e.skill}/v{e.proposed_version}"
        if e.proposed_ref != expected_ref:
            findings.append(Finding("D3-3", e.skill, f"proposed_ref {e.proposed_ref!r} != {expected_ref!r}"))
        if e.skill not in inventory:
            findings.append(Finding("I-9", e.skill, "package absent at target commit"))
            continue
        # Tag uniqueness: no existing tag may share the SemVer precedence —
        # including grammar-violating aliases like `v1.3.0+build` (build
        # metadata does not change precedence).
        for name in tag_names(repo, f"{e.skill}/v*"):
            rest = name[len(e.skill) + 2:]
            if rest == e.proposed_version or rest.startswith(e.proposed_version + "+") \
                    or rest.startswith(e.proposed_version + "-"):
                findings.append(Finding("D3-3", e.skill, f"tag {name!r} shares the precedence of {e.proposed_version}"))
        prev = previous_release(repo, e.skill)
        if e.previous_ref is None:
            if prev is not None:
                findings.append(Finding("D3-3", e.skill, f"previous_ref null but namespace has releases (latest {prev[1]})"))
        else:
            if prev is None:
                findings.append(Finding("D3-3", e.skill, f"previous_ref {e.previous_ref!r} but namespace is empty"))
            elif e.previous_ref not in (prev[1], f"refs/tags/{prev[1]}"):
                findings.append(Finding("D3-3", e.skill, f"previous_ref {e.previous_ref!r} is not the previous release {prev[1]!r}"))
    if findings and baseline_record is None:
        return findings

    # Release-gate axis of I-1·I-7·I-9: the target commit must satisfy the
    # full package + catalog validation (MR1-F1 — a deleted licence copy or a
    # stale KO Version cell is a release defect, not only a CI-axis one).
    findings.extend(run_repo_validation_at(repo, target))

    # Canonical cutover records activate a one-time baseline branch. It keeps
    # the shared structure/package/tag checks above, replaces the ordinary
    # new-skill and payload-diff rules, and retains I-10 with the frozen
    # baseline inventory as its independent source.
    if baseline_record is not None:
        findings.extend(_baseline_findings(
            repo, plan, target, inventory, ordered, idx, baseline_record))
        return findings

    # Changed-set equality (I-3 missing / I-4 extra) over previously released skills.
    changed: set[str] = set()
    for skill in sorted(inventory):
        prev = previous_release(repo, skill)
        if prev is None:
            continue
        try:
            prev_target = peeled(repo, prev[1])
            if payload_changed(repo, prev_target, target, skill):
                changed.add(skill)
        except GitError as e:
            findings.append(Finding("GIT", skill, f"payload diff unobservable (fail-closed): {e}"))
    planned_prior = {e.skill for e in plan.releases if e.previous_ref is not None}
    for skill in sorted(changed - planned_prior):
        findings.append(Finding("I-3", skill, "payload changed since previous release but not in release plan"))
    for skill in sorted(planned_prior - changed):
        findings.append(Finding("I-4", skill, "in release plan but payload unchanged (bookkeeping-only release)"))

    # Per-entry release content checks.
    for e in plan.releases:
        skill_md = file_at(repo, target, f"skills/{e.skill}/SKILL.md")
        changelog = file_at(repo, target, f"skills/{e.skill}/CHANGELOG.md")
        if skill_md is None or changelog is None:
            findings.append(Finding("I-9", e.skill, "SKILL.md or CHANGELOG.md absent at target"))
            continue
        try:
            declared = parse_skill_frontmatter(skill_md).get("metadata.version")
        except FrontmatterError as err:
            findings.append(Finding("PARSE", e.skill, f"SKILL.md at target: {err}"))
            continue
        if declared != e.proposed_version:
            findings.append(Finding("I-3", e.skill, f"metadata.version at target {declared!r} != proposed {e.proposed_version!r}"))
        try:
            top = topmost_released_version(changelog)
        except ChangelogError as err:
            findings.append(Finding("I-3", e.skill, f"CHANGELOG at target unreadable: {err}"))
            continue
        if top != e.proposed_version:
            findings.append(Finding("I-3", e.skill, f"CHANGELOG topmost {top} != proposed {e.proposed_version} (new entry required)"))
            continue

        if e.previous_ref is not None:
            prev = previous_release(repo, e.skill)
            assert prev is not None  # structural checks passed
            step = step_of(prev[0], e.proposed_version)
            if step is None:
                findings.append(Finding("I-6", e.skill, f"{prev[0]} -> {e.proposed_version} is not a single-step bump"))
                continue
            if step == "major":
                findings.extend(_major_approval_findings(
                    repo, target, e.skill, prev[1], e.proposed_version))
                continue
            try:
                prev_target = peeled(repo, prev[1])
                paths = changed_payload_paths(repo, prev_target, target, e.skill)
            except GitError as err:
                findings.append(Finding("GIT", e.skill, f"changed paths unobservable (fail-closed): {err}"))
                continue
            default = default_step(paths)
            if step != default:
                section = _entry_section(changelog, e.proposed_version) or ""
                if not _ADJUSTMENT_LINE.search(section):
                    findings.append(Finding("I-6", e.skill, f"step {step} != path default {default} and CHANGELOG entry has no standalone non-empty '{ADJUSTMENT_MARKER}' reason line"))
        else:
            # New-skill initial release (all artifacts land in one commit).
            if e.proposed_version != "0.1.0":
                findings.append(Finding("D3-3", e.skill, f"initial release must be 0.1.0, got {e.proposed_version}"))
            license_ok = False
            try:
                fm = parse_skill_frontmatter(skill_md)
                ptr = fm.get("license")
                if ptr and file_at(repo, target, f"skills/{e.skill}/{ptr}") is not None:
                    license_ok = True
            except FrontmatterError:
                pass
            if not license_ok:
                findings.append(Finding("I-9", e.skill, "license pointer must resolve at target (initial release)"))
            for fname, header in (("README.md", EN_HEADER), ("README.ko.md", KO_HEADER)):
                text = file_at(repo, target, fname)
                if text is None:
                    findings.append(Finding("I-7", e.skill, f"{fname} absent at target"))
                    continue
                try:
                    table = catalog_versions(text, header)
                except CatalogError as err:
                    findings.append(Finding("I-7", e.skill, f"{fname}: {err}"))
                    continue
                if table.get(e.skill) != e.proposed_version:
                    findings.append(Finding("I-7", e.skill, f"{fname} catalog row missing or version != {e.proposed_version} (initial release must add it in the same commit)"))
            # §D3-3 ⓒ~ⓔ land in ONE commit: neither the package nor a catalog
            # row may predate the target commit (MR1-F3).
            if target_parent is not None:
                try:
                    parent_dirs = dirs_at(repo, target_parent, "skills")
                except GitError as err:
                    findings.append(Finding("GIT", e.skill, f"parent inventory unobservable (fail-closed): {err}"))
                    parent_dirs = set()
                if e.skill in parent_dirs:
                    findings.append(Finding("D3-3", e.skill, "package existed before the target commit — initial release must introduce ⓒ~ⓔ in one commit"))
                for fname, header in (("README.md", EN_HEADER), ("README.ko.md", KO_HEADER)):
                    parent_text = file_at(repo, target_parent, fname)
                    if parent_text is None:
                        continue
                    try:
                        parent_table = catalog_versions(parent_text, header)
                    except CatalogError as err:
                        # Unobservable parent state cannot prove the
                        # same-commit condition (fail-closed — MR1R-F3).
                        findings.append(Finding("D3-3", e.skill, f"parent {fname} catalog unreadable, same-commit introduction unprovable (fail-closed): {err}"))
                        continue
                    if e.skill in parent_table:
                        findings.append(Finding("D3-3", e.skill, f"{fname} catalog row existed before the target commit"))

    # I-10: inventory reduction requires a target-bound retirement record and
    # the complete target-tree removal predicate.
    # No-op green must be activation-aware (MR1R-F8): "no namespaced release"
    # is only pre-cutover when there is also no cutover-record trace in
    # first-parent history — otherwise a full tag deletion would masquerade
    # as the pre-cutover state and silence I-10.
    baseline_commit = _latest_release_commit(repo, target)
    before: set[str] = set()
    before_observed = False
    if baseline_commit is None:
        try:
            record_trace = git(repo, "log", "--first-parent", "--format=%H",
                               target, "--", record_schema.RECORD_PATH).strip()
        except GitError as e:
            findings.append(Finding("GIT", record_schema.RECORD_PATH, f"record history unobservable (fail-closed): {e}"))
            record_trace = "unobservable"
        if plan.releases or record_trace:
            findings.append(Finding("I-10", "skills/", "no prior namespaced release observable from target, but the state is not provably pre-cutover (fail-closed)"))
    else:
        try:
            before.update(dirs_at(repo, baseline_commit, "skills"))
            before_observed = True
        except GitError as e:
            findings.append(Finding("GIT", "skills/", f"I-10 baseline unobservable (fail-closed): {e}"))

    # The latest release baseline protects released inventory. The immediate
    # parent independently protects a never-released package introduced after
    # that baseline and removed by this target.
    if target_parent is not None:
        try:
            before.update(dirs_at(repo, target_parent, "skills"))
            before_observed = True
        except GitError as e:
            findings.append(Finding(
                "GIT", "skills/",
                f"I-10 parent inventory unobservable (fail-closed): {e}"))

    if before_observed:
        for removed_skill in sorted(before - inventory):
            findings.extend(_retirement_findings(
                repo, target, removed_skill))

    return findings


def apply_tags(repo: Path, plan: ReleasePlan, main_ref: str = "main",
               remote: str = "origin") -> list[str]:
    """The only supported tag-mutation path: re-verify, create the planned
    tags locally in a single ref transaction, then PUBLISH them to the
    remote with ``git push --atomic`` (R1-F1 — a local-only ref is not a
    release, and the wrapper's ``--verify-tag`` checks the remote). A push
    failure rolls the local refs back so the attempt leaves no half-state
    and a retry is not blocked. Raises on any preflight finding or
    publication failure (fail-closed)."""
    findings = preflight(repo, plan, main_ref)
    if findings:
        raise RuntimeError("apply-tags refused; preflight findings:\n" + "\n".join(map(str, findings)))
    names = [f"{e.skill}/v{e.proposed_version}" for e in plan.releases]
    refs = [f"refs/tags/{name}" for name in names]
    if not refs:
        # A refspec-less `git push` falls back to the default push behavior
        # and would move the CURRENT BRANCH on the remote — an empty plan
        # must be a strict no-op (R1R-F1).
        return []
    target = peeled(repo, plan.target_commit)
    git(repo, "update-ref", "--stdin",
        input_text="".join(f"create {ref} {target}\n" for ref in refs))
    try:
        git(repo, "push", "--atomic", remote, *refs)
    except GitError as e:
        git(repo, "update-ref", "--stdin",
            input_text="".join(f"delete {ref} {target}\n" for ref in refs))
        raise RuntimeError(f"apply-tags: atomic publication to {remote!r} failed; local refs rolled back (fail-closed): {e}") from None
    return names
