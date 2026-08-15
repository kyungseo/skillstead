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


def _git(dst: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run git and, on failure, surface what it said — a silent setUp failure hides its own cause."""
    r = subprocess.run(["git", *args], cwd=dst, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed ({r.returncode})\n"
                             f"stdout: {r.stdout.strip()}\nstderr: {r.stderr.strip()}")
    return r


def _copy_repo(dst: Path) -> Path:
    """A working copy that keeps git ownership, which source-development preflight requires.

    The source tree may be clean (a CI checkout) or carry uncommitted work (a local branch mid-edit).
    Both are legitimate, so the fixture commits only when the copy actually differs from HEAD —
    committing unconditionally failed on a clean checkout, and `--allow-empty` would paper over it
    by moving HEAD for no reason, muddying the provenance the model depends on.
    """
    subprocess.run(["git", "clone", "--quiet", "--no-hardlinks", str(REPO), str(dst)], check=True)
    # Bring the working tree to what is on disk, not what is committed — the model is built from
    # files, and an uncommitted example must still be catchable.
    for rel in ("gallery", EXAMPLES, "skills/svg-infographic", "tools"):
        src = REPO / rel
        if src.exists():
            shutil.rmtree(dst / rel, ignore_errors=True)
            shutil.copytree(src, dst / rel)
    _git(dst, "add", "-A")
    if _git(dst, "diff", "--cached", "--quiet", check=False).returncode != 0:
        _git(dst, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture")
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

    def test_clean_working_tree_builds(self):
        """Nothing uncommitted — what a CI checkout looks like.

        `_copy_repo` leaves the copy clean whether or not it had to make a fixture commit, so this
        is the state CI runs in regardless of how the source tree looked.
        """
        self.assertEqual(_git(self.repo, "status", "--porcelain").stdout.strip(), "",
                         "the fixture copy should be clean here")
        self.assertEqual(self.checks(), set())

    def test_dirty_working_tree_builds(self):
        """Uncommitted work present — a local branch mid-edit.

        The model is built from files on disk, so a dirty tree must not change the verdict. The
        change is deliberately something the model does not read: this asserts independence from
        cleanliness, not that edits go unnoticed (the drift fixtures cover that).
        """
        (self.repo / "NOTES.txt").write_text("uncommitted\n", encoding="utf-8")
        self.assertNotEqual(_git(self.repo, "status", "--porcelain").stdout.strip(), "")
        self.assertEqual(self.checks(), set())

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

    def test_absent_artifact_digest_is_refused(self):
        """Without the field there is nothing to compare against — hashing the file and agreeing
        with ourselves would make the check decorative."""
        r = self.a_receipt()
        d = json.loads(r.read_text())
        del d["artifactDigest"]
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        findings = run_gallery(self.repo)
        self.assertIn("GAL-VERIFY", {f.check for f in findings})
        self.assertTrue(any("records nothing" in f.detail for f in findings), findings)

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

    def test_missing_required_locale_field_is_refused(self):
        """A field CP3C will render must come from its authority — a null is a finding, not a gap
        to design around, because the gallery reads only this model."""
        r = self.a_receipt()
        d = json.loads(r.read_text())
        del d["preset"]
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        findings = run_gallery(self.repo)
        self.assertIn("GAL-FIELD", {f.check for f in findings})

    # ---- what the model must carry for CP3C ---------------------------------------------

    def test_model_carries_what_the_detail_view_needs(self):
        model, findings = build_model(self.repo)
        self.assertEqual(findings, [])
        for t in model["typepacks"]:
            self.assertTrue(t["feasibility"], f"{t['id']}: fit verdicts missing")
            self.assertTrue(t["stress"], f"{t['id']}: declared stress scenarios missing")
            # Every declared preset must have a verdict, and every scenario an expectation — that is
            # what makes the boundary drawable. Requiring a needs-split *per TypePack* would be
            # asserting a property of the catalog: three types legitimately fit in every declared
            # configuration, and the model should report that, not be failed for it.
            for f in t["feasibility"]:
                self.assertIn(f["result"], ("fits", "needs-split"), f"{t['id']}: {f}")
                self.assertIn(f["preset"], t["presets"], f"{t['id']}: verdict for an undeclared preset")
            for sc in t["stress"]:
                self.assertIn(sc["geometryExpected"], ("fits", "needs-split"), f"{t['id']}: {sc['id']}")
            for loc, e in t["locales"].items():
                for field in ("preset", "treatment", "fontDelivery", "geometry"):
                    self.assertIsNotNone(e[field], f"{t['id']}/{loc}: {field}")

    def test_the_catalog_boundary_is_representable(self):
        """Somewhere in the catalog a configuration must not fit — otherwise the detail view has no
        needs-split to explain, and the model would be hiding it rather than the catalog lacking it."""
        model, _ = build_model(self.repo)
        split = [(t["id"], s["id"]) for t in model["typepacks"] for s in t["stress"]
                 if s["geometryExpected"] == "needs-split"]
        split += [(t["id"], f["preset"]) for t in model["typepacks"] for f in t["feasibility"]
                  if f["result"] == "needs-split"]
        self.assertTrue(split, "no needs-split anywhere — the boundary would be undemonstrable")

    def test_png_is_inventory_not_a_verification_claim(self):
        model, _ = build_model(self.repo)
        for t in model["typepacks"]:
            for loc, e in t["locales"].items():
                self.assertTrue(e["verified"], f"{t['id']}/{loc}: the SVG carries the claim")
                self.assertIsNone(e["png"]["verified"],
                                  f"{t['id']}/{loc}: a PNG must never be called verified")
                self.assertTrue(e["png"]["digest"].startswith("sha256:"))

    def test_a_locale_difference_is_not_collapsed(self):
        """Today every TypePack happens to agree across locales, so the keep-per-locale branch never
        fires on real data. Forcing a disagreement is the only way to prove the lift is conditional
        rather than an unconditional copy of the KO value."""
        r = self.a_receipt("layer-stack", "en")
        d = json.loads(r.read_text())
        d["preset"] = "presentation-16x9"
        r.write_text(json.dumps(d, indent=1), encoding="utf-8")
        model, _ = build_model(self.repo)      # findings expected (verifier will object); the
        t = [x for x in model["typepacks"] if x["id"] == "layer-stack"][0]   # join still runs
        self.assertIsNone(t["preset"], "a differing preset must not be lifted to the TypePack")
        self.assertEqual(t["locales"]["ko"]["preset"], "document-compact")
        self.assertEqual(t["locales"]["en"]["preset"], "presentation-16x9")

    def test_locale_values_are_lifted_only_when_they_agree(self):
        model, _ = build_model(self.repo)
        for t in model["typepacks"]:
            ko, en = t["locales"]["ko"], t["locales"]["en"]
            for field in ("treatment", "fontDelivery", "preset"):
                if ko[field] == en[field]:
                    self.assertEqual(t[field], ko[field], f"{t['id']}: {field} should be lifted")
                else:
                    self.assertIsNone(t[field], f"{t['id']}: {field} differs and must stay per-locale")

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
