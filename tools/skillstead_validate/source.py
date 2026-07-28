"""File-source abstraction so the same package checks run against a working
tree (M1) or an arbitrary commit (M2 preflight at the release target)."""

from __future__ import annotations

import hashlib
import posixpath
from pathlib import Path

from .gitio import GitError, dirs_at, file_at, git


class Source:
    """Read-only view of a repository state."""

    def read_text(self, rel: str) -> str | None:
        raise NotImplementedError

    def blob_id(self, rel: str) -> str | None:
        """Content identity token: equal ids ⟺ byte-equal content."""
        raise NotImplementedError

    def skill_dirs(self) -> list[str]:
        raise NotImplementedError

    @staticmethod
    def inside_package(skill: str, pointer: str) -> bool:
        """Path-containment check for license pointers (no filesystem)."""
        joined = posixpath.normpath(posixpath.join("skills", skill, pointer))
        return joined.startswith(f"skills/{skill}/")


class WorktreeSource(Source):
    def __init__(self, root: Path) -> None:
        self.root = root

    def read_text(self, rel: str) -> str | None:
        path = self.root / rel
        if not path.is_file():
            return None
        try:
            return path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return None

    def blob_id(self, rel: str) -> str | None:
        path = self.root / rel
        if not path.is_file():
            return None
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def skill_dirs(self) -> list[str]:
        skills = self.root / "skills"
        if not skills.is_dir():
            return []
        return sorted(p.name for p in skills.iterdir() if p.is_dir())


class CommitSource(Source):
    def __init__(self, repo: Path, commit: str) -> None:
        self.repo = repo
        self.commit = commit

    def read_text(self, rel: str) -> str | None:
        return file_at(self.repo, self.commit, rel)

    def blob_id(self, rel: str) -> str | None:
        try:
            return git(self.repo, "rev-parse", f"{self.commit}:{rel}").strip()
        except GitError:
            return None

    def skill_dirs(self) -> list[str]:
        try:
            return sorted(dirs_at(self.repo, self.commit, "skills"))
        except GitError:
            return []
