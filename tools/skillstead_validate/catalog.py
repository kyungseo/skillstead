"""Root README catalog table reader (I-7).

Both ``README.md`` and ``README.ko.md`` carry a catalog table whose header and
Version column position are fixed by the baseline. A row may link to the skill
folder or directly to the README matching the catalog locale. The reader
locates the table by its exact header row and fails closed if the header, link,
or any row cannot be read.
"""

from __future__ import annotations

import re

EN_HEADER = "| Skill | Best for | Version | Runtime support | Maturity |"
KO_HEADER = "| 스킬 | 이런 작업에 적합 | 버전 | 지원 실행 환경 | 성숙도 |"

_ROW_SKILL = re.compile(r"^\|\s*\[`([^`]+)`\]\(\./skills/([^)]+)\)\s*\|")
_VERSION_CELL = re.compile(r"^`([^`]*)`$")


class CatalogError(ValueError):
    """Raised when the catalog table cannot be read under the fixed shape."""


def catalog_versions(text: str, header: str) -> dict[str, str]:
    """Return {skill name: version} from the table under ``header``."""
    lines = text.splitlines()
    try:
        start = lines.index(header)
    except ValueError:
        raise CatalogError(f"catalog header not found: {header!r}") from None

    versions: dict[str, str] = {}
    for line in lines[start + 2:]:  # skip header + separator row
        if not line.startswith("|"):
            break
        m = _ROW_SKILL.match(line)
        if not m:
            raise CatalogError(f"unparseable catalog row: {line!r}")
        name, target = m.group(1), m.group(2)
        locale_readme = "README.ko.md" if header == KO_HEADER else "README.md"
        allowed_targets = {name, f"{name}/{locale_readme}"}
        if target not in allowed_targets:
            raise CatalogError(
                f"catalog row name {name!r} has invalid target {target!r}; "
                f"expected one of {sorted(allowed_targets)!r}")
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 5:
            raise CatalogError(f"catalog row does not have 5 columns: {line!r}")
        v = _VERSION_CELL.match(cells[2])
        if not v:
            raise CatalogError(f"version cell not backtick-wrapped: {cells[2]!r}")
        if name in versions:
            raise CatalogError(f"duplicate catalog row for {name!r}")
        versions[name] = v.group(1)
    if not versions:
        raise CatalogError("catalog table has no rows")
    return versions
