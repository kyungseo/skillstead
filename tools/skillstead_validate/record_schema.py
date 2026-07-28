"""Cutover-record canonical constants (fixed by the versioning decision record).

These values are fixed by the decision record, not configuration. The full
S1~S10 schema validation belongs to the cutover evaluator; the subset checked
by the continuous tag checks (M3) must still refuse anything that could
widen the baseline exception (arbitrary refs, non-canonical schema).
"""

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
