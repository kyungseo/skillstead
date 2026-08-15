"""CP3B gallery model fixtures.

The model's whole value is that it refuses to publish an example it cannot re-verify today. So the
negatives here are not "does it parse" — they are the four ways an example can look fine and not be
verified, plus the three ways the committed model can fall out of date with what it describes.

These run against a copy of the real repository rather than a synthetic fixture: the join is over
the actual manifest, payloads, receipts and artifacts, and a hand-built stand-in would prove the
join works on data shaped the way the test author imagined it.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from skillstead_validate.gallery import (  # noqa: E402
    EXAMPLES, MODEL_PATH, TOKENS_PATH, GalleryError, NodeRunner, build_model, run_gallery,
)

REPO = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")


def _copy_repo(dst: Path) -> Path:
    """A working copy that keeps git ownership, which source-development preflight requires."""
    subprocess.run(["git", "clone", "--quiet", "--no-hardlinks", str(REPO), str(dst)], check=True)
    # Bring the working tree to what is on disk, not what is committed — the model is built from
    # files, and an uncommitted example must still be catchable.
    for rel in ("gallery", EXAMPLES, "skills/svg-infographic"):
        src = REPO / rel
        if src.exists():
            shutil.rmtree(dst / rel, ignore_errors=True)
            shutil.copytree(src, dst / rel)
    subprocess.run(["git", "add", "-A"], cwd=dst, check=True, capture_output=True)
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture"],
                   cwd=dst, check=True, capture_output=True)
    return dst


@unittest.skipIf(NODE is None, "node is required: the digest framing and the verifier live in the package")
class GalleryModelFixtures(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = _copy_repo(Path(self._tmp.name) / "repo")
        self.addCleanup(self._tmp.cleanup)

    def checks(self, write: bool = False) -> set[str]:
        return {f.check for f in run_gallery(self.repo, write=write)}

    def a_receipt(self, tid: str = "cards-kpi-grid", loc: str = "ko") -> Path:
        return self.repo / EXAMPLES / tid / f"{tid}.{loc}.json"

    def an_svg(self, tid: str = "cards-kpi-grid", loc: str = "ko") -> Path:
        return self.repo / EXAMPLES / tid / f"{tid}.{loc}.svg"

    # ---- positive ----------------------------------------------------------------------

    def test_committed_model_is_current(self):
        self.assertEqual(self.checks(), set(), "the committed model must already match its sources")

    def test_model_joins_all_four_surfaces(self):
        model, findings = build_model(self.repo)
        self.assertEqual(findings, [])
        self.assertEqual(model["typepackCount"], 9)
        for t in model["typepacks"]:
            self.assertTrue(t["selectionSignal"], f"{t['id']}: manifest field missing")
            for loc, e in t["locales"].items():
                self.assertTrue(e["prompt"], f"{t['id']}/{loc}: payload prompt missing")
                self.assertTrue(e["title"], f"{t['id']}/{loc}: payload title missing")
                self.assertTrue(e["consumed"], f"{t['id']}/{loc}: receipt consumed missing")
                self.assertTrue(e["svgDigest"].startswith("sha256:"))
                self.assertTrue(e["verified"], f"{t['id']}/{loc}: should verify")

    # ---- the four verification facts, broken one at a time -----------------------------

    def test_stale_runtime_digest_is_refused(self):
        r = self.a_receipt()
        d = json.loads(r.read_text())
        d["provenance"]["runtimeSurfaceDigest"] = "sha256:" + "0" * 64
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        self.assertIn("GAL-VERIFY", self.checks())

    def test_receipt_missing_a_required_block_is_refused(self):
        r = self.a_receipt()
        d = json.loads(r.read_text())
        del d["treatment"]
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        self.assertIn("GAL-VERIFY", self.checks())

    def test_artifact_edited_after_the_receipt_is_refused(self):
        svg = self.an_svg()
        svg.write_text(svg.read_text(encoding="utf-8") + "<!-- edited -->\n", encoding="utf-8")
        self.assertIn("GAL-VERIFY", self.checks())

    def test_verifier_failure_is_refused(self):
        # Self-consistent to a shape check — the entity is renamed in both artifact and receipt —
        # but the verifier recomputes from the input and rejects it.
        svg = self.an_svg()
        svg.write_text(svg.read_text(encoding="utf-8").replace('data-entity="observability"',
                                                               'data-entity="ghost"'), encoding="utf-8")
        r = self.a_receipt()
        d = json.loads(r.read_text())
        d["consumed"] = ["ghost" if c == "observability" else c for c in d["consumed"]]
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        self.assertIn("GAL-VERIFY", self.checks())

    def test_an_unverified_example_is_never_written(self):
        r = self.a_receipt()
        d = json.loads(r.read_text())
        d["provenance"]["runtimeSurfaceDigest"] = "sha256:" + "0" * 64
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        before = (self.repo / MODEL_PATH).read_text(encoding="utf-8")
        self.assertTrue(self.checks(write=True))
        self.assertEqual((self.repo / MODEL_PATH).read_text(encoding="utf-8"), before,
                         "a failing build must leave the previous model untouched")

    # ---- drift: the committed model no longer describes its sources --------------------

    def test_forged_model_row_is_caught(self):
        p = self.repo / MODEL_PATH
        m = json.loads(p.read_text())
        m["typepacks"][0]["selectionSignal"] = "something the manifest never said"
        p.write_text(json.dumps(m, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        self.assertIn("GAL-DRIFT", self.checks())

    def test_artifact_byte_change_is_caught(self):
        png = self.repo / EXAMPLES / "layer-stack" / "layer-stack.en.png"
        png.write_bytes(png.read_bytes() + b"\n")
        self.assertIn("GAL-DRIFT", self.checks())

    def test_missing_receipt_is_caught(self):
        self.a_receipt("nested-scope", "en").unlink()
        self.assertIn("GAL-ARTIFACT", self.checks())

    def test_missing_model_is_caught(self):
        (self.repo / MODEL_PATH).unlink()
        self.assertIn("GAL-DRIFT", self.checks())

    # ---- tokens ------------------------------------------------------------------------

    def test_missing_required_token_is_caught(self):
        p = self.repo / TOKENS_PATH
        t = json.loads(p.read_text())
        del t["palette"]["ground"]
        p.write_text(json.dumps(t, indent=1), encoding="utf-8")
        self.assertIn("GAL-TOKEN", self.checks())

    def test_missing_tokens_file_fails_the_build(self):
        (self.repo / TOKENS_PATH).unlink()
        self.assertIn("GAL-BUILD", self.checks())

    # ---- the package must not be reached for through the repository --------------------

    def test_package_carries_no_reference_to_the_repository_gallery(self):
        # The direction contract: an installed package must run knowing nothing about gallery/.
        pkg = REPO / "skills/svg-infographic"
        offenders = []
        for p in pkg.rglob("*"):
            if not p.is_file() or p.suffix in {".png", ".otf", ".ttf", ".woff2"}:
                continue
            try:
                text = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if "gallery/model.json" in text or "gallery/tokens.json" in text:
                offenders.append(str(p.relative_to(REPO)))
        self.assertEqual(offenders, [], "the package must not depend on repository presentation files")


class GalleryWithoutNode(unittest.TestCase):
    def test_absent_node_fails_closed(self):
        """No Node means the digest and the verifier cannot be consulted — that is a refusal."""
        class Missing(NodeRunner):
            def runtime_surface_digest(self):
                raise GalleryError("node is unavailable")
        with self.assertRaises(GalleryError):
            build_model(REPO, runner=Missing(REPO))


if __name__ == "__main__":
    unittest.main()
