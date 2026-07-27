"""CLI entrypoint.

Usage:
    python3 -m skillstead_validate repo [--repo-root PATH]
    python3 -m skillstead_validate preflight --plan PLAN.json [--repo-root PATH]
    python3 -m skillstead_validate apply-tags --plan PLAN.json [--repo-root PATH]

Exit status: 0 when no findings, 1 when findings exist, 2 on usage error.
Continuous tag checks and the cutover evaluator are added by later
checkpoints of FEAT-20260728-001.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .package_check import run_repo_validation
from .release_gate import apply_tags, preflight
from .release_plan import PlanError, parse_plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skillstead_validate")
    sub = parser.add_subparsers(dest="mode", required=True)
    repo = sub.add_parser("repo", help="package-structure + catalog validation (M1)")
    repo.add_argument("--repo-root", type=Path, default=Path.cwd())
    for name in ("preflight", "apply-tags"):
        p = sub.add_parser(name, help=f"release gate {name} (M2)")
        p.add_argument("--plan", type=Path, required=True)
        p.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args(argv)

    if args.mode == "repo":
        findings = run_repo_validation(args.repo_root.resolve())
        for f in findings:
            print(f, file=sys.stderr)
        print(f"skillstead_validate repo: {len(findings)} finding(s)")
        return 1 if findings else 0

    try:
        plan = parse_plan(args.plan.read_text(encoding="utf-8"))
    except (OSError, PlanError) as e:
        print(f"plan rejected (fail-closed): {e}", file=sys.stderr)
        return 1
    root = args.repo_root.resolve()
    if args.mode == "preflight":
        findings = preflight(root, plan)
        for f in findings:
            print(f, file=sys.stderr)
        print(f"skillstead_validate preflight: {len(findings)} finding(s)")
        return 1 if findings else 0
    if args.mode == "apply-tags":
        try:
            created = apply_tags(root, plan)
        except RuntimeError as e:
            print(str(e), file=sys.stderr)
            return 1
        for name in created:
            print(f"created {name}")
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
