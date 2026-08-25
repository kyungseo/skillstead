"""Classify a pull-request diff into the heavy CI suites it must run.

Input is one repository-relative path per line on stdin.  Output is exactly
the two GitHub Actions output keys consumed by validate.yml.  Diff discovery
and its fail-closed fallback stay in the workflow; this module only classifies
an observed path set.
"""

from __future__ import annotations

import sys
from collections.abc import Iterable


OUTPUT_KEYS = ("svg_infographic", "validator")
SELF_PATH = "tools/skillstead_validate/ci_scope.py"


def classify(paths: Iterable[str]) -> dict[str, bool]:
    svg_infographic = False
    validator = False

    for raw in paths:
        path = raw.strip()
        if not path:
            continue

        # Git normally quotes paths containing non-ASCII or control bytes.
        # The workflow disables that behavior, but an unexpected quoted input
        # is still unclassifiable and therefore must fail closed to run-all.
        if path.startswith('"'):
            return {"svg_infographic": True, "validator": True}

        # A classifier change changes the authority that decides what may skip.
        # Treat it exactly like a workflow change: no suite may trust the old
        # classifier to rule the new classifier out.
        if path == SELF_PATH or path.startswith(".github/"):
            return {"svg_infographic": True, "validator": True}

        if (path.startswith("skills/svg-infographic/") or
                path.startswith("examples/svg-infographic/")):
            # Repository validator fixtures invoke the SVG package scripts and
            # consume its examples, so this dependency runs in both directions.
            svg_infographic = True
            validator = True
        elif path.startswith("tools/") or path.startswith("tests/"):
            validator = True

    return {"svg_infographic": svg_infographic, "validator": validator}


def format_outputs(decisions: dict[str, bool]) -> str:
    if tuple(decisions) != OUTPUT_KEYS:
        raise ValueError(f"unexpected output keys: {tuple(decisions)!r}")
    return "\n".join(
        f"{key}={'true' if decisions[key] else 'false'}" for key in OUTPUT_KEYS)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args:
        print("usage: python3 -m skillstead_validate.ci_scope < changed-paths", file=sys.stderr)
        return 2
    print(format_outputs(classify(sys.stdin)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
