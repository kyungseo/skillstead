"""Bump-step mechanics (DR-818 §D2-1 rules 2–4, 6; §D2-2 boundary).

The machine computes the path-default step and validates the proposed
version delta. Rule 1 (observable-behavior judgment) belongs to a human; an
adjustment away from the path default must carry a reason line in the
CHANGELOG entry (see ADJUSTMENT_MARKER in release_gate).
"""

from __future__ import annotations

import re

_FIXTURES = re.compile(r"^skills/[^/]+/scripts/(.+/)?fixtures/")
_MINOR = re.compile(r"^skills/[^/]+/(SKILL\.md$|references/|agents/|scripts/)")


def classify_path(path: str) -> str:
    """Path-default step for one changed payload path: 'minor' or 'patch'."""
    if _FIXTURES.match(path):
        return "patch"
    if _MINOR.match(path):
        return "minor"
    return "patch"


def default_step(changed_paths: list[str]) -> str:
    """Highest step wins; major is never automatic (rule 6)."""
    return "minor" if any(classify_path(p) == "minor" for p in changed_paths) else "patch"


def step_of(prev: str, proposed: str) -> str | None:
    """Step implied by the version delta, or None when the delta is not a
    single-step bump (skips and mixed increments are invalid)."""
    pa, pi, pp = (int(x) for x in prev.split("."))
    na, ni, np_ = (int(x) for x in proposed.split("."))
    if (na, ni, np_) == (pa, pi, pp + 1):
        return "patch"
    if (na, ni, np_) == (pa, pi + 1, 0):
        return "minor"
    if (na, ni, np_) == (pa + 1, 0, 0):
        return "major"
    return None
