"""Contract tests for deterministic validator process sharding."""

from __future__ import annotations

import sys
import subprocess
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

from run_unittest_shard import select_ids  # noqa: E402


class UnittestShardSelection(unittest.TestCase):
    def test_round_robin_selection_uses_sorted_ids(self):
        ids = ["test.z", "test.a", "test.m", "test.b"]
        self.assertEqual(select_ids(ids, 0, 2), ["test.a", "test.m"])
        self.assertEqual(select_ids(ids, 1, 2), ["test.b", "test.z"])

    def test_every_test_is_selected_exactly_once(self):
        ids = [f"test.{index:03d}" for index in range(17)]
        selected = [
            test_id
            for shard_index in range(4)
            for test_id in select_ids(ids, shard_index, 4)
        ]
        self.assertCountEqual(selected, ids)
        self.assertEqual(len(selected), len(set(selected)))

    def test_invalid_shard_count_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "shard_count"):
            select_ids([], 0, 0)

    def test_invalid_shard_index_is_rejected(self):
        for index in (-1, 4):
            with self.subTest(index=index), self.assertRaisesRegex(ValueError, "shard_index"):
                select_ids([], index, 4)

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "unique"):
            select_ids(["test.same", "test.same"], 0, 2)

    def test_standalone_discovery_imports_repo_root_modules(self):
        proc = subprocess.run(
            [
                sys.executable,
                "tools/run_unittest_shard.py",
                "--shard-index", "0",
                "--shard-count", "1",
                "--list-only",
            ],
            cwd=REPO,
            text=True,
            capture_output=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertNotIn("_FailedTest", proc.stdout + proc.stderr)
        self.assertIn("test_runtime_canonicalization.RuntimeCanonicalizationParity", proc.stdout)
        self.assertIn("test_svg_release_artifacts.SvgReleaseArtifactGate", proc.stdout)


if __name__ == "__main__":
    unittest.main()
