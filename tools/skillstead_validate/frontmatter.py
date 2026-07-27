"""Constrained SKILL.md frontmatter reader.

This is deliberately not a YAML parser. The baseline (docs/VERSIONING.md) fixes
the frontmatter shape this repository uses; this reader accepts exactly that
shape and fails closed on anything else. Fields read: top-level ``name``,
top-level ``license``, and ``version`` nested directly under ``metadata:``.
"""

from __future__ import annotations

import re

_TOP_KEY = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):(.*)$")
_META_VERSION = re.compile(r"^\s+version:\s*(\S+)\s*$")


class FrontmatterError(ValueError):
    """Raised when the frontmatter cannot be read under the fixed shape."""


def parse_skill_frontmatter(text: str) -> dict:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise FrontmatterError("missing opening '---' delimiter")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        raise FrontmatterError("missing closing '---' delimiter") from None

    fields: dict[str, str] = {}
    current_top: str | None = None
    for raw in lines[1:end]:
        if not raw.strip():
            continue
        if not raw[0].isspace():
            m = _TOP_KEY.match(raw)
            if not m:
                raise FrontmatterError(f"unparseable top-level line: {raw!r}")
            current_top = m.group(1)
            value = m.group(2).strip()
            if value and value not in (">", "|", ">-", "|-"):
                if current_top in fields:
                    raise FrontmatterError(f"duplicate top-level key: {current_top}")
                fields[current_top] = value
        else:
            # Continuation or nested line; only metadata.version is contractual.
            if current_top == "metadata":
                m = _META_VERSION.match(raw)
                if m:
                    if "metadata.version" in fields:
                        raise FrontmatterError("duplicate metadata.version")
                    fields["metadata.version"] = m.group(1)
    return fields
