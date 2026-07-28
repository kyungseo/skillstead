"""Builds synthetic repositories for validator tests.

A fixture repo is a minimal tree that passes M1 (``run_repo_validation``)
before mutation. Negative fixtures are produced by mutating a valid tree; this
keeps each fixture's failure attributable to exactly one seeded defect.
"""

from __future__ import annotations

from pathlib import Path

LICENSE_TEXT = "Apache License stand-in body for fixtures.\n"

EN_HEADER = "| Skill | Best for | Version | Runtime support | Maturity |"
KO_HEADER = "| 스킬 | 이런 작업에 적합 | 버전 | 지원 실행 환경 | 성숙도 |"


def _skill_md(name: str, version: str, license_ptr: str = "LICENSE.txt") -> str:
    return (
        "---\n"
        f"name: {name}\n"
        "description: >\n"
        "  Fixture skill package used by validator tests.\n"
        f"license: {license_ptr}\n"
        "metadata:\n"
        f"  version: {version}\n"
        "---\n"
        f"\n# {name}\n"
    )


def _changelog(name: str, version: str) -> str:
    return (
        f"# Changelog — {name}\n\n"
        f"## [{version}] — 2026-07-24\n\n"
        "Fixture baseline entry.\n"
    )


def _catalog(header: str, rows: dict[str, str]) -> str:
    lines = [header, "| --- | --- | --- | --- | --- |"]
    for name, version in sorted(rows.items()):
        lines.append(f"| [`{name}`](./skills/{name}) | Fixture | `{version}` | Claude Code | Beta |")
    return "# Fixture catalog\n\n" + "\n".join(lines) + "\n"


def build_valid_repo(root: Path, skills: dict[str, str] | None = None) -> Path:
    """Create a valid fixture repo at ``root``; returns ``root``."""
    skills = skills or {"alpha-skill": "1.2.3", "beta-skill": "0.4.0"}
    root.mkdir(parents=True, exist_ok=True)
    (root / "LICENSE").write_text(LICENSE_TEXT, encoding="utf-8")
    (root / "README.md").write_text(_catalog(EN_HEADER, skills), encoding="utf-8")
    (root / "README.ko.md").write_text(_catalog(KO_HEADER, skills), encoding="utf-8")
    for name, version in skills.items():
        pkg = root / "skills" / name
        pkg.mkdir(parents=True)
        (pkg / "SKILL.md").write_text(_skill_md(name, version), encoding="utf-8")
        (pkg / "CHANGELOG.md").write_text(_changelog(name, version), encoding="utf-8")
        (pkg / "LICENSE.txt").write_text(LICENSE_TEXT, encoding="utf-8")
    return root
