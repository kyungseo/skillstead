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

    def _resolve(self, rel: str) -> Path | None:
        """Reject any path with a symlink component (fail-closed): a
        symlinked licence or package directory would satisfy the checks
        while escaping the self-contained-package contract (R1-F3)."""
        path = self.root
        for part in Path(rel).parts:
            path = path / part
            if path.is_symlink():
                return None
        return path if path.is_file() else None

    def read_text(self, rel: str) -> str | None:
        path = self._resolve(rel)
        if path is None:
            return None
        try:
            return path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return None

    def blob_id(self, rel: str) -> str | None:
        path = self._resolve(rel)
        if path is None:
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

    def _is_symlink(self, rel: str) -> bool:
        """Symlinks live in git trees as mode-120000 blobs whose content is
        the link target — reading one would validate the target string, not
        a file. Reject them like the worktree source does (R1-F3)."""
        try:
            out = git(self.repo, "ls-tree", self.commit, "--", rel)
        except GitError:
            return False
        return out.startswith("120000 ")

    def read_text(self, rel: str) -> str | None:
        if self._is_symlink(rel):
            return None
        return file_at(self.repo, self.commit, rel)

    def blob_id(self, rel: str) -> str | None:
        if self._is_symlink(rel):
            return None
        try:
            return git(self.repo, "rev-parse", f"{self.commit}:{rel}").strip()
        except GitError:
            return None

    def skill_dirs(self) -> list[str]:
        try:
            return sorted(dirs_at(self.repo, self.commit, "skills"))
        except GitError:
            return []
