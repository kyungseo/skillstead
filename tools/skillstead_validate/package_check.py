"""M1 repo validation: package-structure axis + I-1 + I-7 + I-9.

Covers what the pinned spec reference validator does not check (measured):
license pointer resolution, license byte equality with the root LICENSE,
SemVer form of ``metadata.version``, I-1 CHANGELOG agreement, and the I-7
catalog Version columns. Every parse failure is itself a finding (fail-closed).
"""

from __future__ import annotations

import re
from pathlib import Path

from . import SEMVER_RE
from .catalog import EN_HEADER, KO_HEADER, CatalogError, catalog_versions
from .changelog import ChangelogError, topmost_released_version
from .findings import Finding
from .frontmatter import FrontmatterError, parse_skill_frontmatter

_SEMVER = re.compile(SEMVER_RE)


def active_inventory(repo_root: Path) -> list[str]:
    """Active package inventory: every directory under ``skills/``."""
    skills_dir = repo_root / "skills"
    if not skills_dir.is_dir():
        return []
    return sorted(p.name for p in skills_dir.iterdir() if p.is_dir())


def check_package(repo_root: Path, name: str) -> tuple[list[Finding], str | None]:
    """Validate one package. Returns (findings, declared version or None)."""
    findings: list[Finding] = []
    pkg = repo_root / "skills" / name

    skill_md = pkg / "SKILL.md"
    if not skill_md.is_file():
        findings.append(Finding("I-9", name, "SKILL.md missing"))
        return findings, None

    try:
        fm = parse_skill_frontmatter(skill_md.read_text(encoding="utf-8"))
    except (FrontmatterError, UnicodeDecodeError) as e:
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
    else:
        license_path = (pkg / license_ptr).resolve()
        if not str(license_path).startswith(str(pkg.resolve()) + "/"):
            findings.append(Finding("I-9", name, f"license pointer {license_ptr!r} escapes the package"))
        elif not license_path.is_file():
            findings.append(Finding("I-9", name, f"license pointer {license_ptr!r} does not resolve"))
        else:
            root_license = repo_root / "LICENSE"
            if not root_license.is_file():
                findings.append(Finding("LICENSE-BYTES", name, "root LICENSE missing"))
            elif license_path.read_bytes() != root_license.read_bytes():
                findings.append(Finding("LICENSE-BYTES", name, f"{license_ptr} differs from root LICENSE"))

    changelog = pkg / "CHANGELOG.md"
    if not changelog.is_file():
        findings.append(Finding("I-1", name, "CHANGELOG.md missing"))
    else:
        try:
            top = topmost_released_version(changelog.read_text(encoding="utf-8"))
        except (ChangelogError, UnicodeDecodeError) as e:
            findings.append(Finding("I-1", name, f"CHANGELOG unreadable: {e}"))
        else:
            if version is not None and top != version:
                findings.append(Finding("I-1", name, f"metadata.version {version} != CHANGELOG topmost {top}"))

    return findings, version


def check_catalog(repo_root: Path, versions: dict[str, str | None]) -> list[Finding]:
    """I-7: both catalog tables cover the inventory with matching versions."""
    findings: list[Finding] = []
    tables: dict[str, dict[str, str]] = {}
    for fname, header in (("README.md", EN_HEADER), ("README.ko.md", KO_HEADER)):
        path = repo_root / fname
        if not path.is_file():
            findings.append(Finding("I-7", fname, "file missing"))
            continue
        try:
            tables[fname] = catalog_versions(path.read_text(encoding="utf-8"), header)
        except (CatalogError, UnicodeDecodeError) as e:
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


def run_repo_validation(repo_root: Path) -> list[Finding]:
    """Full M1 pass over the repository."""
    findings: list[Finding] = []
    inventory = active_inventory(repo_root)
    if not inventory:
        return [Finding("INVENTORY", "skills/", "no packages found")]
    versions: dict[str, str | None] = {}
    for name in inventory:
        pkg_findings, version = check_package(repo_root, name)
        findings.extend(pkg_findings)
        versions[name] = version
    findings.extend(check_catalog(repo_root, versions))
    return findings
