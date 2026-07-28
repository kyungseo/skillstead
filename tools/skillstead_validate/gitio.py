"""Git observation layer. Every query failure raises GitError (fail-closed)."""

from __future__ import annotations

import subprocess
from pathlib import Path


class GitError(RuntimeError):
    """A git query failed; callers must treat the observation as unavailable."""


def git(repo: Path, *args: str, input_text: str | None = None) -> str:
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True, text=True, check=True, input=input_text)
    except FileNotFoundError as e:
        raise GitError("git executable not found") from e
    except subprocess.CalledProcessError as e:
        raise GitError(f"git {' '.join(args)}: {e.stderr.strip()}") from e
    return proc.stdout


def peeled(repo: Path, ref: str) -> str:
    """Peeled commit SHA — identical for annotated and lightweight tags."""
    return git(repo, "rev-parse", f"{ref}^{{commit}}").strip()


def file_at(repo: Path, commit: str, path: str) -> str | None:
    """File content at a commit, or None when absent there."""
    try:
        return git(repo, "show", f"{commit}:{path}")
    except GitError:
        try:
            git(repo, "cat-file", "-e", f"{commit}:{path}")
        except GitError:
            return None
        raise


def files_at(repo: Path, commit: str, prefix: str) -> dict[str, str]:
    """{repo-relative path: blob sha} for files under ``prefix`` at ``commit``."""
    out = git(repo, "ls-tree", "-r", commit, "--", prefix)
    result: dict[str, str] = {}
    for line in out.splitlines():
        meta, path = line.split("\t", 1)
        _mode, otype, sha = meta.split()
        if otype == "blob":
            result[path] = sha
    return result


def dirs_at(repo: Path, commit: str, prefix: str) -> set[str]:
    """Top-level directory names under ``prefix`` at ``commit``."""
    out = git(repo, "ls-tree", commit, "--", prefix if prefix.endswith("/") else prefix + "/")
    dirs: set[str] = set()
    for line in out.splitlines():
        meta, path = line.split("\t", 1)
        if meta.split()[1] == "tree":
            dirs.add(path.rsplit("/", 1)[-1])
    return dirs


def tag_names(repo: Path, pattern: str = "*") -> list[str]:
    out = git(repo, "tag", "--list", pattern)
    return [l.strip() for l in out.splitlines() if l.strip()]


def first_parent_positions(repo: Path, tip: str) -> dict[str, int]:
    """{commit sha: index} along first-parent history from ``tip`` (0 = tip)."""
    out = git(repo, "log", "--first-parent", "--format=%H", tip)
    return {sha: i for i, sha in enumerate(out.split())}
