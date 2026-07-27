"""Per-skill CHANGELOG parser (grammar fixed by docs/VERSIONING.md).

Released entries use the heading form ``## [X.Y.Z] — YYYY-MM-DD`` (em dash),
newest first. An optional ``## [Unreleased]`` section may sit above them. The
topmost released heading is the parser contract consumed by I-1.
"""

from __future__ import annotations

import re

_RELEASED = re.compile(
    r"^## \[(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\] — \d{4}-\d{2}-\d{2}\s*$"
)
_UNRELEASED = re.compile(r"^## \[Unreleased\]\s*$")
_ANY_H2 = re.compile(r"^## ")


class ChangelogError(ValueError):
    """Raised when no released heading can be read under the fixed grammar."""


def topmost_released_version(text: str) -> str:
    for line in text.splitlines():
        if _UNRELEASED.match(line):
            continue
        m = _RELEASED.match(line)
        if m:
            return f"{m.group(1)}.{m.group(2)}.{m.group(3)}"
        if _ANY_H2.match(line):
            raise ChangelogError(f"first '##' heading is not a released entry: {line!r}")
    raise ChangelogError("no released heading found")
