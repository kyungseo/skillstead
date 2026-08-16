"""Release-only svg-infographic artifact provenance and copy gates."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.skillstead_validate.svg_release_artifacts import (
    EXAMPLES, check_release_artifacts, expected_inventory,
)


DIGEST = "sha256:" + "a" * 64


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True,
                          text=True).stdout.strip()


def _sha(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


class SvgReleaseArtifactGate(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.repo, self.staging = self.root / "repo", self.root / "staging"
        self.repo.mkdir()
        _git(self.repo, "init", "-q")
        _git(self.repo, "config", "user.email", "t@example.invalid")
        _git(self.repo, "config", "user.name", "test")
        (self.repo / "seed").write_text("seed\n")
        _git(self.repo, "add", "seed")
        _git(self.repo, "commit", "-qm", "source")
        self.source = _git(self.repo, "rev-parse", "HEAD")
        self.ids = {f"pack-{i}" for i in range(9)}
        for root in (self.repo, self.staging):
            for tid in self.ids:
                directory = root / EXAMPLES / tid
                directory.mkdir(parents=True, exist_ok=True)
                for loc in ("ko", "en"):
                    svg = directory / f"{tid}.{loc}.svg"
                    svg.write_text(f"<svg><title>{tid}-{loc}</title></svg>\n")
                    receipt = {
                        "artifactDigest": _sha(svg),
                        "provenance": {
                            "schema": {"canonicalization": 2},
                            "executionMode": "source-development",
                            "package": {"surfaceRevision": 17},
                            "runtimeSurfaceDigest": DIGEST,
                            "source": {"headCommit": self.source, "repoDirty": False,
                                       "runtimeSurfaceDirty": False},
                        },
                    }
                    (directory / f"{tid}.{loc}.json").write_text(json.dumps(receipt))
                    (directory / f"{tid}.{loc}.png").write_bytes(b"png")
        self.addCleanup(self.tmp.cleanup)

    def check(self, **kwargs):
        return check_release_artifacts(
            self.repo, self.staging, self.source, typepack_ids=self.ids,
            runtime_digest=DIGEST, verify_pairs=False, **kwargs,
        )

    def test_exact_clean_staging_and_copy_pass(self) -> None:
        self.assertEqual(len(expected_inventory(self.ids)), 54)
        self.assertEqual(self.check(compare_repository=True), [])

    def test_dirty_receipt_fails(self) -> None:
        path = next((self.staging / EXAMPLES).glob("*/*.json"))
        receipt = json.loads(path.read_text())
        receipt["provenance"]["source"]["runtimeSurfaceDirty"] = True
        path.write_text(json.dumps(receipt))
        findings = self.check()
        self.assertTrue(any(f.check == "SVG-REL-RECEIPT" and
                            "runtimeSurfaceDirty" in f.detail for f in findings), findings)

    def test_extra_file_and_copy_drift_fail(self) -> None:
        (self.staging / EXAMPLES / "extra.txt").write_text("extra")
        target = next((self.repo / EXAMPLES).glob("*/*.png"))
        target.write_bytes(b"changed")
        checks = {f.check for f in self.check(compare_repository=True)}
        self.assertIn("SVG-REL-INVENTORY", checks)
        self.assertIn("SVG-REL-COPY", checks)

    def test_artifact_commit_must_be_the_exact_descendant_delta(self) -> None:
        (self.repo / "gallery").mkdir()
        (self.repo / "gallery/model.json").write_text("{}\n")
        (self.repo / "gallery/index.html").write_text("<html></html>\n")
        _git(self.repo, "add", "examples", "gallery")
        _git(self.repo, "commit", "-qm", "artifacts")
        artifact = _git(self.repo, "rev-parse", "HEAD")
        self.assertEqual(self.check(compare_repository=True, artifact_commit=artifact), [])

    def test_deterministic_artifacts_need_not_appear_in_the_commit_delta(self) -> None:
        _git(self.repo, "add", "examples")
        _git(self.repo, "commit", "-qm", "baseline artifacts")
        self.source = _git(self.repo, "rev-parse", "HEAD")
        for root in (self.repo, self.staging):
            for receipt_path in (root / EXAMPLES).glob("*/*.json"):
                receipt = json.loads(receipt_path.read_text())
                receipt["provenance"]["source"]["headCommit"] = self.source
                receipt_path.write_text(json.dumps(receipt))
        (self.repo / "gallery").mkdir()
        (self.repo / "gallery/model.json").write_text("{}\n")
        (self.repo / "gallery/index.html").write_text("<html></html>\n")
        _git(self.repo, "add", "examples", "gallery")
        _git(self.repo, "commit", "-qm", "deterministic artifact refresh")
        artifact = _git(self.repo, "rev-parse", "HEAD")

        changed = set(_git(self.repo, "diff", "--name-only", self.source, artifact).splitlines())
        self.assertFalse(any(path.endswith((".svg", ".png")) for path in changed))
        self.assertEqual(self.check(compare_repository=True, artifact_commit=artifact), [])


if __name__ == "__main__":
    unittest.main()
