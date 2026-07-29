"""Release plan input for M2 (strict, fail-closed parsing).

Shape:
    {
      "target_commit": "<sha or ref>",
      "releases": [
        {"skill": ..., "previous_ref": <ref or null>,
         "proposed_version": "X.Y.Z", "proposed_ref": "refs/tags/<skill>/vX.Y.Z"}
      ]
    }

Duplicate JSON keys are rejected — parsers disagree on last-wins vs
first-wins, so a duplicated key has no single value.
"""

from __future__ import annotations

import json
from dataclasses import dataclass


class PlanError(ValueError):
    """Raised when the plan cannot be accepted as a single unambiguous value."""


def _no_duplicates(pairs: list[tuple[str, object]]) -> dict:
    d: dict = {}
    for k, v in pairs:
        if k in d:
            raise PlanError(f"duplicate JSON key: {k!r}")
        d[k] = v
    return d


@dataclass(frozen=True)
class PlanEntry:
    skill: str
    previous_ref: str | None
    proposed_version: str
    proposed_ref: str


@dataclass(frozen=True)
class ReleasePlan:
    target_commit: str
    releases: tuple[PlanEntry, ...]


_TOP_KEYS = {"target_commit", "releases"}
_ENTRY_KEYS = {"skill", "previous_ref", "proposed_version", "proposed_ref"}


def parse_plan(text: str) -> ReleasePlan:
    try:
        raw = json.loads(text, object_pairs_hook=_no_duplicates)
    except json.JSONDecodeError as e:
        raise PlanError(f"invalid JSON: {e}") from None
    if not isinstance(raw, dict) or set(raw) != _TOP_KEYS:
        raise PlanError(f"top-level keys must be exactly {sorted(_TOP_KEYS)}")
    if not isinstance(raw["target_commit"], str) or not raw["target_commit"]:
        raise PlanError("target_commit must be a non-empty string")
    if not isinstance(raw["releases"], list):
        raise PlanError("releases must be an array")
    entries: list[PlanEntry] = []
    seen: set[str] = set()
    for item in raw["releases"]:
        if not isinstance(item, dict) or set(item) != _ENTRY_KEYS:
            raise PlanError(f"release entry keys must be exactly {sorted(_ENTRY_KEYS)}")
        if not isinstance(item["skill"], str) or not item["skill"]:
            raise PlanError("skill must be a non-empty string")
        if item["previous_ref"] is not None and not isinstance(item["previous_ref"], str):
            raise PlanError("previous_ref must be a string or null")
        for key in ("proposed_version", "proposed_ref"):
            if not isinstance(item[key], str) or not item[key]:
                raise PlanError(f"{key} must be a non-empty string")
        expected_ref = f"refs/tags/{item['skill']}/v{item['proposed_version']}"
        if item["proposed_ref"] != expected_ref:
            raise PlanError(
                f"proposed_ref must be the fully-qualified tag ref {expected_ref!r}, "
                f"got {item['proposed_ref']!r} — write the ref exactly as "
                f"refs/tags/<skill>/v<proposed_version>")
        if item["skill"] in seen:
            raise PlanError(f"duplicate release entry for skill {item['skill']!r}")
        seen.add(item["skill"])
        entries.append(PlanEntry(
            skill=item["skill"], previous_ref=item["previous_ref"],
            proposed_version=item["proposed_version"], proposed_ref=item["proposed_ref"]))
    return ReleasePlan(target_commit=raw["target_commit"], releases=tuple(entries))
