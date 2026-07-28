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
from .findings import Finding
from .frontmatter import FrontmatterError, parse_skill_frontmatter
from .gitio import (GitError, dirs_at, file_at, first_parent_positions, git,
                    peeled, tag_names)
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
    if findings:
        return findings

    # Release-gate axis of I-1·I-7·I-9: the target commit must satisfy the
    # full package + catalog validation (MR1-F1 — a deleted licence copy or a
    # stale KO Version cell is a release defect, not only a CI-axis one).
    findings.extend(run_repo_validation_at(repo, target))

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
                findings.append(Finding("E14", e.skill, "major bump requires owner approval evidence; no evidence format exists yet (fail-closed)"))
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

    # I-10: inventory reduction requires an approved retirement marker; no
    # marker format exists until the playbook defines one — fail-closed.
    # No-op green must be activation-aware (MR1R-F8): "no namespaced release"
    # is only pre-cutover when there is also no cutover-record trace in
    # first-parent history — otherwise a full tag deletion would masquerade
    # as the pre-cutover state and silence I-10.
    baseline_commit = _latest_release_commit(repo, target)
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
            before = dirs_at(repo, baseline_commit, "skills")
        except GitError as e:
            findings.append(Finding("GIT", "skills/", f"I-10 baseline unobservable (fail-closed): {e}"))
            before = None
        if before is not None:
            removed = before - inventory
            if removed:
                findings.append(Finding("I-10", ",".join(sorted(removed)), "inventory decreased without an approved retirement marker (fail-closed until the marker format is defined)"))

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
    target = peeled(repo, plan.target_commit)
    names = [f"{e.skill}/v{e.proposed_version}" for e in plan.releases]
    refs = [f"refs/tags/{name}" for name in names]
    git(repo, "update-ref", "--stdin",
        input_text="".join(f"create {ref} {target}\n" for ref in refs))
    try:
        git(repo, "push", "--atomic", remote, *refs)
    except GitError as e:
        git(repo, "update-ref", "--stdin",
            input_text="".join(f"delete {ref} {target}\n" for ref in refs))
        raise RuntimeError(f"apply-tags: atomic publication to {remote!r} failed; local refs rolled back (fail-closed): {e}") from None
    return names
