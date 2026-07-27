"""CLI entrypoint.

Usage:
    python3 -m skillstead_validate repo [--repo-root PATH]

Exit status: 0 when no findings, 1 when findings exist, 2 on usage error.
Modes for release preflight, continuous tag checks, and the cutover evaluator
are added by later checkpoints of FEAT-20260728-001.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .package_check import run_repo_validation


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skillstead_validate")
    sub = parser.add_subparsers(dest="mode", required=True)
    repo = sub.add_parser("repo", help="package-structure + catalog validation (M1)")
    repo.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args(argv)

    if args.mode == "repo":
        findings = run_repo_validation(args.repo_root.resolve())
        for f in findings:
            print(f, file=sys.stderr)
        print(f"skillstead_validate repo: {len(findings)} finding(s)")
        return 1 if findings else 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
