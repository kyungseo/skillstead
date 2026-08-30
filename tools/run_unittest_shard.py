#!/usr/bin/env python3
"""Run one deterministic process shard of the repository unittest suite."""

from __future__ import annotations

import argparse
import sys
import unittest
from collections.abc import Iterable, Sequence
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def iter_cases(suite: unittest.TestSuite) -> Iterable[unittest.TestCase]:
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from iter_cases(item)
        else:
            yield item


def select_ids(test_ids: Sequence[str], shard_index: int, shard_count: int) -> list[str]:
    if shard_count < 1:
        raise ValueError("shard_count must be at least 1")
    if shard_index < 0 or shard_index >= shard_count:
        raise ValueError("shard_index must satisfy 0 <= index < shard_count")

    ordered = sorted(test_ids)
    if len(set(ordered)) != len(ordered):
        raise ValueError("test IDs must be unique")
    return [test_id for position, test_id in enumerate(ordered)
            if position % shard_count == shard_index]


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shard-index", type=int, required=True)
    parser.add_argument("--shard-count", type=int, required=True)
    parser.add_argument("--start-directory", default="tests")
    parser.add_argument("--list-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        select_ids([], args.shard_index, args.shard_count)
    except ValueError as exc:
        parser.error(str(exc))
    return args


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    discovered = unittest.defaultTestLoader.discover(args.start_directory)
    cases = sorted(iter_cases(discovered), key=lambda case: case.id())
    selected_ids = set(select_ids(
        [case.id() for case in cases], args.shard_index, args.shard_count))
    selected = [case for case in cases if case.id() in selected_ids]

    print(
        f"unittest shard {args.shard_index + 1}/{args.shard_count}: "
        f"{len(selected)}/{len(cases)} tests",
        flush=True,
    )
    if args.list_only:
        for case in selected:
            print(case.id())
        return 0
    result = unittest.TextTestRunner(verbosity=1).run(unittest.TestSuite(selected))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
