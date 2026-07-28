"""Package-structure axis + I-1 + I-7 + I-9, over any Source.

Runs against the working tree (M1) or a specific commit (shared with the M2
release preflight — the release-gate axis of I-7·I-9 requires checking the
release target, not the checkout). Covers what the pinned spec reference
validator does not: license pointer resolution, license byte equality with
the root LICENSE, SemVer form, I-1 CHANGELOG agreement, and the catalog
Version columns. Every parse failure is itself a finding (fail-closed).
"""

from __future__ import annotations

import re
from pathlib import Path

from . import SEMVER_RE
from .catalog import EN_HEADER, KO_HEADER, CatalogError, catalog_versions
from .changelog import ChangelogError, topmost_released_version
from .findings import Finding
from .frontmatter import FrontmatterError, parse_skill_frontmatter
from .source import CommitSource, Source, WorktreeSource

_SEMVER = re.compile(SEMVER_RE)


def check_package(source: Source, name: str) -> tuple[list[Finding], str | None]:
    """Validate one package. Returns (findings, declared version or None)."""
    findings: list[Finding] = []
    pkg = f"skills/{name}"

    skill_md = source.read_text(f"{pkg}/SKILL.md")
    if skill_md is None:
        findings.append(Finding("I-9", name, "SKILL.md missing"))
        return findings, None

    try:
        fm = parse_skill_frontmatter(skill_md)
    except FrontmatterError as e:
        findings.append(Finding("PARSE", name, f"SKILL.md frontmatter: {e}"))
        return findings, None

    version = fm.get("metadata.version")
    if version is None:
        findings.append(Finding("VERSION", name, "metadata.version missing"))
    elif not _SEMVER.match(version):
        findings.append(Finding("VERSION", name, f"metadata.version {version!r} is not MAJOR.MINOR.PATCH"))
        version = None

    license_ptr = fm.get("license")
    if license_ptr is None:
        findings.append(Finding("I-9", name, "license field missing"))
    elif not Source.inside_package(name, license_ptr):
        findings.append(Finding("I-9", name, f"license pointer {license_ptr!r} escapes the package"))
    else:
        copy_id = source.blob_id(f"{pkg}/{license_ptr}")
        if copy_id is None:
            findings.append(Finding("I-9", name, f"license pointer {license_ptr!r} does not resolve"))
        else:
            root_id = source.blob_id("LICENSE")
            if root_id is None:
                findings.append(Finding("LICENSE-BYTES", name, "root LICENSE missing"))
            elif copy_id != root_id:
                findings.append(Finding("LICENSE-BYTES", name, f"{license_ptr} differs from root LICENSE"))

    changelog = source.read_text(f"{pkg}/CHANGELOG.md")
    if changelog is None:
        findings.append(Finding("I-1", name, "CHANGELOG.md missing"))
    else:
        try:
            top = topmost_released_version(changelog)
        except ChangelogError as e:
            findings.append(Finding("I-1", name, f"CHANGELOG unreadable: {e}"))
        else:
            if version is not None and top != version:
                findings.append(Finding("I-1", name, f"metadata.version {version} != CHANGELOG topmost {top}"))

    return findings, version


def check_catalog(source: Source, versions: dict[str, str | None]) -> list[Finding]:
    """I-7: both catalog tables cover the inventory with matching versions."""
    findings: list[Finding] = []
    tables: dict[str, dict[str, str]] = {}
    for fname, header in (("README.md", EN_HEADER), ("README.ko.md", KO_HEADER)):
        text = source.read_text(fname)
        if text is None:
            findings.append(Finding("I-7", fname, "file missing"))
            continue
        try:
            tables[fname] = catalog_versions(text, header)
        except CatalogError as e:
            findings.append(Finding("I-7", fname, str(e)))
    for fname, table in tables.items():
        if set(table) != set(versions):
            findings.append(Finding(
                "I-7", fname,
                f"catalog rows {sorted(table)} != inventory {sorted(versions)}"))
            continue
        for name, declared in versions.items():
            if declared is not None and table[name] != declared:
                findings.append(Finding(
                    "I-7", fname,
                    f"{name}: table version {table[name]} != metadata.version {declared}"))
    if len(tables) == 2:
        en, ko = tables["README.md"], tables["README.ko.md"]
        if en != ko:
            findings.append(Finding("I-7", "README.md/README.ko.md", f"EN table {en} != KO table {ko}"))
    return findings


def run_validation(source: Source) -> list[Finding]:
    """Full package + catalog pass over one repository state."""
    findings: list[Finding] = []
    inventory = source.skill_dirs()
    if not inventory:
        return [Finding("INVENTORY", "skills/", "no packages found")]
    versions: dict[str, str | None] = {}
    for name in inventory:
        pkg_findings, version = check_package(source, name)
        findings.extend(pkg_findings)
        versions[name] = version
    findings.extend(check_catalog(source, versions))
    return findings


def run_repo_validation(repo_root: Path) -> list[Finding]:
    """M1: validate the working tree."""
    return run_validation(WorktreeSource(repo_root))


def run_repo_validation_at(repo: Path, commit: str) -> list[Finding]:
    """Release-gate axis of I-1·I-7·I-9: validate a specific commit."""
    return run_validation(CommitSource(repo, commit))


def active_inventory(repo_root: Path) -> list[str]:
    """Active package inventory of the working tree."""
    return WorktreeSource(repo_root).skill_dirs()
