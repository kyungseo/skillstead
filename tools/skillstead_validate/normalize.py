"""Canonical payload normalization (see docs/VERSIONING.md).

Payload of ``skills/<name>/**`` excludes exactly two bookkeeping artifacts:
the ``metadata.version`` scalar inside ``SKILL.md`` (replaced by a fixed
sentinel — the body still counts) and ``CHANGELOG.md`` in its entirety.
"""

from __future__ import annotations

import re
from pathlib import Path

from .gitio import file_at, files_at

_SENTINEL = "@VERSION@"
_META_VERSION_LINE = re.compile(r"^(\s+version:\s*)\S+(\s*)$")


def normalize_skill_md(text: str) -> str:
    """Replace the frontmatter ``metadata.version`` scalar with a sentinel."""
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    delimiters = 0
    current_top: str | None = None
    for line in lines:
        stripped = line.strip()
        if stripped == "---" and delimiters < 2:
            delimiters += 1
            out.append(line)
            continue
        if delimiters == 1:
            if line and not line[0].isspace():
                current_top = line.split(":", 1)[0].strip()
            elif current_top == "metadata":
                m = _META_VERSION_LINE.match(line.rstrip("\n"))
                if m:
                    out.append(f"{m.group(1)}{_SENTINEL}{m.group(2)}\n")
                    continue
        out.append(line)
    return "".join(out)


def payload_changed(repo: Path, prev_commit: str, target_commit: str, skill: str) -> bool:
    """True when the skill's payload differs between the two commits."""
    prefix = f"skills/{skill}/"
    prev = files_at(repo, prev_commit, prefix)
    target = files_at(repo, target_commit, prefix)
    changelog = prefix + "CHANGELOG.md"
    skill_md = prefix + "SKILL.md"
    prev.pop(changelog, None)
    target.pop(changelog, None)

    if set(prev) != set(target):
        return True
    for path in prev:
        if path == skill_md:
            continue
        if prev[path] != target[path]:
            return True
    if skill_md in prev:
        a = file_at(repo, prev_commit, skill_md) or ""
        b = file_at(repo, target_commit, skill_md) or ""
        if normalize_skill_md(a) != normalize_skill_md(b):
            return True
    return False


def changed_payload_paths(repo: Path, prev_commit: str, target_commit: str, skill: str) -> list[str]:
    """Payload paths that differ (for bump-step classification)."""
    prefix = f"skills/{skill}/"
    prev = files_at(repo, prev_commit, prefix)
    target = files_at(repo, target_commit, prefix)
    changelog = prefix + "CHANGELOG.md"
    skill_md = prefix + "SKILL.md"
    prev.pop(changelog, None)
    target.pop(changelog, None)

    changed = set(prev) ^ set(target)
    for path in set(prev) & set(target):
        if path == skill_md:
            a = file_at(repo, prev_commit, skill_md) or ""
            b = file_at(repo, target_commit, skill_md) or ""
            if normalize_skill_md(a) != normalize_skill_md(b):
                changed.add(path)
        elif prev[path] != target[path]:
            changed.add(path)
    return sorted(changed)
