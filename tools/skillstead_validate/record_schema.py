"""Cutover-record canonical constants and strict parser.

These values are fixed by the decision record, not configuration. The full
S1~S10 schema is shared by the M2 baseline branch and M4 cutover evaluator so
the one-time exception cannot accept a record that the lifecycle evaluator
would reject. The subset checked by continuous tag checks (M3) must still
refuse anything that could widen the baseline exception.
"""

from __future__ import annotations

import json
import re

RECORD_PATH = ".skillstead/cutover-record.json"

SCHEMA = "skillstead/cutover-record@1"

PHASES = frozenset({"prepared", "aborted"})

BASELINE_FINALIZATION_SHA = "3f92c4b3209c26d0b65129965d3cac63b8a1e9dd"

BASELINE_TAGS = (
    "refs/tags/docs-claim-check/v0.8.0",
    "refs/tags/github-release-guide/v0.8.0",
    "refs/tags/svg-infographic/v0.8.0",
    "refs/tags/writing-quality-editor/v0.8.0",
)

LATEST_REF = "refs/tags/writing-quality-editor/v0.8.0"

_SHA40 = re.compile(r"^[0-9a-f]{40}$")


def parse(text: str) -> dict | str:
    """Return the canonical record or the first S2~S10 error string."""
    class Dup(ValueError):
        pass

    def no_dup(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise Dup(key)
            result[key] = value
        return result

    try:
        raw = json.loads(text, object_pairs_hook=no_dup)
    except Dup as error:
        return f"S3: duplicate key {error}"
    except json.JSONDecodeError as error:
        return f"S2: invalid JSON ({error.msg})"
    if not isinstance(raw, dict):
        return "S2: not an object"
    expected_keys = {"schema", "attempt", "phase", "baseline_finalization_sha",
                     "latest_ref", "baseline_tags"}
    if set(raw) != expected_keys:
        return f"S2: keys must be exactly {sorted(expected_keys)}"
    if raw["schema"] != SCHEMA:
        return "S4: schema mismatch"
    if not isinstance(raw["attempt"], int) or isinstance(raw["attempt"], bool) or raw["attempt"] < 1:
        return "S5: attempt must be an integer >= 1"
    for key in ("schema", "phase", "baseline_finalization_sha", "latest_ref"):
        if not isinstance(raw[key], str):
            return f"S5: {key} must be a string"
    if not isinstance(raw["baseline_tags"], list) or not all(
            isinstance(tag, str) for tag in raw["baseline_tags"]):
        return "S5: baseline_tags must be a string array"
    if raw["phase"] not in PHASES:
        return "S6: phase must be prepared|aborted"
    sha = raw["baseline_finalization_sha"]
    if sha != BASELINE_FINALIZATION_SHA or not _SHA40.match(sha):
        return "S7: baseline_finalization_sha mismatch"
    if raw["baseline_tags"] != list(BASELINE_TAGS):
        return "S8: baseline_tags must equal the canonical refs in order"
    if not all(tag.startswith("refs/tags/") for tag in raw["baseline_tags"]):
        return "S9: baseline_tags must be full refs"
    if raw["latest_ref"] != LATEST_REF or raw["latest_ref"] != raw["baseline_tags"][-1]:
        return "S10: latest_ref mismatch"
    return raw
