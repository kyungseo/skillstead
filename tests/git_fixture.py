"""Synthetic git repositories for release-gate and tag-check fixtures.

Each fixture starts from a valid tree (fixture_builder) committed on ``main``
with a namespaced release tag per skill, so every negative fixture's failure
is attributable to the single defect it seeds afterwards.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from fixture_builder import build_valid_repo

SKILLS = {"alpha-skill": "1.2.3", "beta-skill": "0.4.0"}


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True, text=True, check=True).stdout


def commit_all(repo: Path, message: str) -> str:
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", message)
    return _git(repo, "rev-parse", "HEAD").strip()


def build_released_repo(root: Path, skills: dict[str, str] | None = None) -> Path:
    """Valid repo whose HEAD carries a namespaced release tag per skill."""
    skills = skills or dict(SKILLS)
    build_valid_repo(root, skills)
    _git_init(root)
    sha = commit_all(root, "baseline release")
    for name, version in skills.items():
        _git(root, "tag", f"{name}/v{version}", sha)
    return root


def build_unreleased_repo(root: Path, skills: dict[str, str] | None = None) -> Path:
    """Valid repo committed on main with NO namespaced tags (pre-cutover)."""
    build_valid_repo(root, skills or dict(SKILLS))
    _git_init(root)
    commit_all(root, "initial state, no releases")
    return root


def _git_init(repo: Path) -> None:
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)],
                   capture_output=True, text=True, check=True)
    _git(repo, "config", "user.email", "fixture@example.invalid")
    _git(repo, "config", "user.name", "Fixture")


def plan_json(target: str, entries: list[dict]) -> str:
    import json
    return json.dumps({"target_commit": target, "releases": entries})


def entry(skill: str, previous: str | None, version: str) -> dict:
    return {
        "skill": skill,
        "previous_ref": previous,
        "proposed_version": version,
        "proposed_ref": f"refs/tags/{skill}/v{version}",
    }
