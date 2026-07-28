"""CLI entrypoint.

Usage:
    python3 -m skillstead_validate repo [--repo-root PATH]
    python3 -m skillstead_validate preflight --plan PLAN.json [--repo-root PATH]
    python3 -m skillstead_validate apply-tags --plan PLAN.json [--repo-root PATH]
    python3 -m skillstead_validate tags [--main-ref REF] [--repo-root PATH]
    python3 -m skillstead_validate cutover (--releases-file F --latest-file F | --live --repo-slug OWNER/REPO) [...]

Exit status: 0 when no findings (cutover: non-red verdict), 1 otherwise,
2 on usage error.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import json

from .cutover import run_cutover
from .package_check import run_repo_validation
from .release_gate import apply_tags, preflight
from .release_plan import PlanError, parse_plan
from .tag_check import run_tag_checks
from .transport import TransportError, fetch_latest, fetch_releases
from .wrapper import RequestError, parse_request, run_wrapper


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skillstead_validate")
    sub = parser.add_subparsers(dest="mode", required=True)
    repo = sub.add_parser("repo", help="package-structure + catalog validation (M1)")
    repo.add_argument("--repo-root", type=Path, default=Path.cwd())
    for name in ("preflight", "apply-tags"):
        p = sub.add_parser(name, help=f"release gate {name} (M2)")
        p.add_argument("--plan", type=Path, required=True)
        p.add_argument("--repo-root", type=Path, default=Path.cwd())
    tags = sub.add_parser("tags", help="continuous tag checks (M3)")
    tags.add_argument("--main-ref", default="main")
    tags.add_argument("--repo-root", type=Path, default=Path.cwd())
    cut = sub.add_parser("cutover", help="cutover verdict evaluator (M4)")
    cut.add_argument("--repo-root", type=Path, default=Path.cwd())
    cut.add_argument("--main-ref", default="main")
    cut.add_argument("--releases-file", type=Path)
    cut.add_argument("--latest-file", type=Path)
    cut.add_argument("--live", action="store_true")
    cut.add_argument("--repo-slug")
    rel = sub.add_parser("release", help="canonical release wrapper (M5) — the only supported Release path")
    rel.add_argument("--request", type=Path, required=True)
    rel.add_argument("--repo-root", type=Path, default=Path.cwd())
    rel.add_argument("--main-ref", default="main")
    rel.add_argument("--repo-slug", required=True)
    rel.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    if args.mode == "release":
        try:
            request = parse_request(args.request.read_text(encoding="utf-8"))
        except (OSError, RequestError) as e:
            print(f"request rejected (fail-closed): {e}", file=sys.stderr)
            return 1

        def fetch():
            return fetch_releases(args.repo_slug), fetch_latest(args.repo_slug)
        try:
            result = run_wrapper(args.repo_root.resolve(), request, fetch,
                                 main_ref=args.main_ref, repo_slug=args.repo_slug,
                                 dry_run=args.dry_run)
        except TransportError as e:
            print(f"red CV-DOMAIN candidate=- predicate=transport — {e}", file=sys.stderr)
            return 1
        if result.error:
            return 1
        return 0

    if args.mode == "cutover":
        try:
            if args.live:
                if not args.repo_slug:
                    print("cutover --live requires --repo-slug", file=sys.stderr)
                    return 2
                releases = fetch_releases(args.repo_slug)
                latest = fetch_latest(args.repo_slug)
            elif args.releases_file and args.latest_file:
                releases = json.loads(args.releases_file.read_text(encoding="utf-8"))
                latest_raw = json.loads(args.latest_file.read_text(encoding="utf-8"))
                latest = latest_raw.get("tag_name") if isinstance(latest_raw, dict) else None
            else:
                print("cutover requires --live or both --releases-file/--latest-file", file=sys.stderr)
                return 2
        except (TransportError, OSError, json.JSONDecodeError) as e:
            print(f"red CV-DOMAIN candidate=- predicate=transport — {e}", file=sys.stderr)
            return 1
        verdict = run_cutover(args.repo_root.resolve(), args.main_ref, releases, latest)
        print(f"skillstead_validate cutover: {verdict}")
        return 1 if verdict.verdict == "red" else 0

    if args.mode == "tags":
        findings = run_tag_checks(args.repo_root.resolve(), args.main_ref)
        for f in findings:
            print(f, file=sys.stderr)
        print(f"skillstead_validate tags: {len(findings)} finding(s)")
        return 1 if findings else 0

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
