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
import re
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
from skillstead_validate.contact_sheet import RENDER_RECEIPT, sheet_paths  # noqa: E402
from skillstead_validate.gallery_html import GALLERY_HTML, render  # noqa: E402

FEATURED = "gallery/featured.json"

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
    # Files as well as directories: the root READMEs are part of what these fixtures check, and a
    # clone alone would hand them back at HEAD while the rest of the copy is at working-tree state.
    #
    # This list is deliberately narrow, not exhaustive. Adding a fixture that reads a root document
    # not named here means adding it here too — otherwise the fixture silently checks the committed
    # version and passes while the working tree says something else.
    for rel in ("gallery", EXAMPLES, "skills/svg-infographic", "tools",
                "README.md", "README.ko.md"):
        src = REPO / rel
        if not src.exists():
            continue
        if src.is_dir():
            shutil.rmtree(dst / rel, ignore_errors=True)
            shutil.copytree(src, dst / rel)
        else:
            shutil.copy2(src, dst / rel)
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

    # ---- the rendered page ---------------------------------------------------------------

    def test_page_is_regenerated_with_the_model(self):
        """Both outputs come from one command, so neither can be refreshed while the other rots."""
        self.assertEqual(self.checks(), set())
        page = (self.repo / GALLERY_HTML)
        self.assertTrue(page.exists())
        page.write_text(page.read_text(encoding="utf-8") + "<!-- hand edit -->\n", encoding="utf-8")
        findings = run_gallery(self.repo)
        self.assertIn("GAL-DRIFT", {f.check for f in findings})
        self.assertTrue(any(GALLERY_HTML in f.subject for f in findings), findings)

    def test_a_token_change_moves_the_page(self):
        """Tokens are the source the page renders from, not a document describing it."""
        before = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        p = self.repo / TOKENS_PATH
        t = json.loads(p.read_text())
        t["palette"]["ground"] = "#123456"
        p.write_text(json.dumps(t, indent=1), encoding="utf-8")
        self.assertIn("GAL-DRIFT", {f.check for f in run_gallery(self.repo)})
        self.assertEqual(run_gallery(self.repo, write=True), [])
        after = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertNotEqual(before, after)
        self.assertIn("#123456", after)

    def test_page_makes_no_external_request(self):
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertNotIn("http://", h)
        self.assertNotIn("https://", h)
        self.assertNotIn("@import", h)

    def test_page_shows_both_locales_without_scripting(self):
        """The no-JS state is the complete view. Nothing is hidden unless scripting has put a locale
        on the root, the switch never appears without scripting, and detail opens on its own — so
        both sections and every prompt remain reachable."""
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertIn('id="switch" hidden', h)
        for rule in ('[data-locale="ko"] figure[data-loc="en"]', '[data-locale="en"] figure[data-loc="ko"]'):
            self.assertIn(rule, h)
        self.assertEqual(h.count("<details>"), 9)

    def test_featured_switches_locale_with_the_catalog(self):
        """The switch is one control for the whole page: featured artifacts carry data-loc exactly
        as catalog thumbnails do, so a locale choice cannot apply to one section only."""
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        import re
        feat = re.search(r'<div class="featured">(.*?)</div>\s*<p class="note">', h, re.S).group(1)
        self.assertEqual(feat.count('data-loc="ko"'), 6)
        self.assertEqual(feat.count('data-loc="en"'), 6)

    def test_page_alt_text_names_the_type_and_the_artifact(self):
        """Alt text describes the picture. The selection signal says when to reach for the type,
        which is a different sentence and would not describe anything."""
        import re
        model, _ = build_model(self.repo)
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        # Content images only. The zoom dialog holds an empty placeholder whose src and alt are
        # both copied from the clicked image, so it describes nothing until it has something to
        # describe — asserted separately below rather than counted here.
        content, _, shell = h.partition("<dialog")
        alts = re.findall(r'alt="([^"]*)"', content)
        expected = 2 * (len(model["typepacks"]) + len(model["featured"]["entries"]))
        self.assertEqual(len(alts), expected, "every image in both sections needs alt text")
        self.assertFalse([a for a in alts if not a.strip()])
        self.assertIn('alt = a.querySelector("img").alt', shell,
                      "the zoom placeholder must take the alt of the image it is showing")
        for t in model["typepacks"]:
            for loc, e in t["locales"].items():
                self.assertIn(f'{t["id"]} — {e["title"]} ({loc.upper()})', alts)
            signal = (t.get("selectionSignal") or "")[:25]
            self.assertFalse([a for a in alts if signal and signal in a],
                             f'{t["id"]}: the selection signal must not be used as alt text')
        for f in model["featured"]["entries"]:
            for loc in ("ko", "en"):
                self.assertIn(f'{f["name"]} — {f["caption"]} ({loc.upper()})', alts,
                              f'{f["slug"]}/{loc}: featured alt text describes the picture too')

    def test_page_shows_the_verified_svg_not_the_png(self):
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        import re
        model, _ = build_model(self.repo)
        srcs = re.findall(r'<img src="([^"]+)"', h)
        self.assertEqual(len(srcs), 2 * (len(model["typepacks"]) + len(model["featured"]["entries"])))
        self.assertTrue(all(s.endswith(".svg") for s in srcs),
                        "the SVG is what the gates and the verifier re-checked")

    def test_page_links_resolve(self):
        import os, re
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        links = set(re.findall(r'(?:src|href)="(\.\./[^"#]+)(?:#[^"]*)?"', h))
        missing = [l for l in sorted(links) if not (self.repo / "gallery" / l).exists()]
        self.assertEqual(missing, [], "repository -> package relative links must resolve")

    # ---- featured: an editorial list with only the claim its evidence supports -----------

    def test_featured_comes_from_the_editorial_file(self):
        model, _ = build_model(self.repo)
        declared = json.loads((self.repo / FEATURED).read_text())["entries"]
        got = model["featured"]["entries"]
        self.assertEqual([e["slug"] for e in got], [e["slug"] for e in declared],
                         "the model must publish exactly what the editorial file selects")
        for e in got:
            self.assertTrue(e["artifacts"].get("ko") and e["artifacts"].get("en"))
            self.assertTrue(e["reason"], f'{e["slug"]}: a selection without a reason is not editorial')

    def test_featured_claims_only_the_gates_it_passes(self):
        """These predate the TypePack receipts. Saying so explicitly is the point — `none` is a
        verdict, not a missing field."""
        model, _ = build_model(self.repo)
        for e in model["featured"]["entries"]:
            self.assertEqual(e["evidence"]["sourceGates"], "pass")
            self.assertEqual(e["evidence"]["typePackReceipt"], "none")
            self.assertEqual(e["evidence"]["dataAccuracy"], "not-applicable")

    def test_featured_verified_count_is_not_mixed_into_the_typepack_count(self):
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        model, _ = build_model(self.repo)
        n = sum(1 for t in model["typepacks"] for e in t["locales"].values() if e["verified"])
        self.assertIn(f"{n}/{n} TypePack canonical artifacts pass", h)
        self.assertNotIn(f"{n + len(model['featured']['entries'])}/", h)

    # --- README contact sheet ---------------------------------------------------------
    def test_the_contact_sheet_consumes_the_featured_selection_not_a_second_list(self):
        """One editorial selection feeds the gallery and the README, or the two drift apart."""
        model, _ = build_model(self.repo)
        slugs = [e["slug"] for e in model["featured"]["entries"]]
        for loc in ("ko", "en"):
            svg = (self.repo / sheet_paths(loc)[0]).read_text(encoding="utf-8")
            cells = re.findall(r'data-cell="([^"]+)"', svg)
            self.assertEqual(cells, slugs, f"{loc}: the sheet must follow featured.json in order")
            # and it must not quietly grow the catalog's nine into the README
            self.assertFalse([t["id"] for t in model["typepacks"] if t["id"] in cells])

    def test_every_contact_sheet_cell_carries_its_artifact_digest(self):
        model, _ = build_model(self.repo)
        for loc in ("ko", "en"):
            svg = (self.repo / sheet_paths(loc)[0]).read_text(encoding="utf-8")
            digests = re.findall(r'data-artifact-digest="([^"]+)"', svg)
            expected = [e["artifacts"][loc]["svgDigest"] for e in model["featured"]["entries"]]
            self.assertEqual(digests, expected, loc)

    def test_the_two_locale_sheets_share_one_geometry(self):
        """Only the pictures differ. A layout that moved with the language would mean the sheet
        was laid out around the words rather than the work."""
        geo = []
        for loc in ("ko", "en"):
            svg = (self.repo / sheet_paths(loc)[0]).read_text(encoding="utf-8")
            geo.append(re.findall(r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"', svg))
        self.assertTrue(geo[0], "no cells found")
        self.assertEqual(geo[0], geo[1])

    def test_the_sheet_states_its_evidence_boundary_in_the_image(self):
        """The picture gets quoted on its own, so the claim travels inside it."""
        for loc in ("ko", "en"):
            svg = (self.repo / sheet_paths(loc)[0]).read_text(encoding="utf-8")
            self.assertIn("no TypePack receipt", svg)
            self.assertIn("gates pass", svg)

    def test_no_cell_is_left_empty(self):
        model, _ = build_model(self.repo)
        n = len(model["featured"]["entries"])
        self.assertEqual(n % 3, 0, f"{n} entries do not fill a 3-wide grid")

    def test_the_root_readmes_link_the_sheet_to_the_gallery_with_locale_alt_text(self):
        alts = []
        for name, loc in (("README.md", "en"), ("README.ko.md", "ko")):
            t = (self.repo / name).read_text(encoding="utf-8")
            m = re.search(r'!\[([^\]]+)\]\(\./gallery/contact-sheet\.' + loc + r'\.png\)\]\(([^)]+)\)', t)
            self.assertIsNotNone(m, f"{name}: the sheet must be present and wrapped in a link")
            self.assertEqual(m.group(2), "./gallery/index.html", name)
            self.assertTrue((self.repo / "gallery/index.html").exists())
            alts.append(m.group(1))
        self.assertNotEqual(alts[0], alts[1], "each locale describes the picture in its own language")

    def test_no_readme_still_counts_fourteen_examples(self):
        """The count predates the TypePack catalog; the replacement states no number at all."""
        for name in ("README.md", "README.ko.md"):
            t = (self.repo / name).read_text(encoding="utf-8")
            self.assertNotRegex(t, r"14-example|fourteen examples|예시 14개|다이어그램 14개")

    # --- the PNG the README shows is bound to what produced it --------------------------
    def _render_findings(self) -> list:
        return [f for f in run_gallery(self.repo) if f.check == "GAL-RENDER"]

    def test_a_sheet_regenerated_without_re_rendering_its_png_fails(self):
        """The README displays the PNG, and only the SVG is derived — so this is the gap the
        receipt exists to close."""
        svg = self.repo / sheet_paths("ko")[0]
        svg.write_text(svg.read_text(encoding="utf-8") + "\n<!-- regenerated -->\n",
                       encoding="utf-8")
        details = " ".join(f.detail for f in self._render_findings())
        self.assertIn("SVG changed", details, details or "no GAL-RENDER finding")

    def test_a_changed_featured_artifact_without_re_rendering_fails(self):
        model, _ = build_model(self.repo)
        first = model["featured"]["entries"][0]["artifacts"]["ko"]["svg"][:-4] + ".png"
        png = self.repo / first
        png.write_bytes(png.read_bytes() + b"\x00")
        details = " ".join(f.detail for f in self._render_findings())
        self.assertIn("featured artifacts changed", details, details or "no GAL-RENDER finding")

    def test_a_replaced_output_png_fails(self):
        png = self.repo / sheet_paths("ko")[1]
        png.write_bytes(png.read_bytes() + b"\x00")
        details = " ".join(f.detail for f in self._render_findings())
        self.assertIn("digest recorded", details, details or "no GAL-RENDER finding")

    def test_a_renderer_change_since_the_render_fails(self):
        """Checked through the receipt rather than by editing the renderer: render.sh is a
        production shim, so touching it makes every receipt stale and the run stops upstream —
        the case that reaches here is a renderer change whose artifacts were regenerated."""
        rec = self.repo / RENDER_RECEIPT
        d = json.loads(rec.read_text(encoding="utf-8"))
        key = next(iter(d["renderer"]))
        d["renderer"][key] = "sha256:" + "0" * 64
        rec.write_text(json.dumps(d, indent=1) + "\n", encoding="utf-8")
        details = " ".join(f.detail for f in self._render_findings())
        self.assertIn("renderer changed", details, details or "no GAL-RENDER finding")

    def test_a_missing_receipt_fails_closed(self):
        (self.repo / RENDER_RECEIPT).unlink()
        details = " ".join(f.detail for f in self._render_findings())
        self.assertIn("missing", details, details or "no GAL-RENDER finding")

    # --- what surface_revision is actually bound to -------------------------------------
    def _digests(self) -> dict:
        out = subprocess.run([NODE, f"skills/svg-infographic/scripts/preflight.mjs", "--json"],
                             cwd=self.repo, capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        # preflight nests them; reading the nested object keeps the fixture honest about the shape
        # it actually consumes rather than a flattened convenience of its own.
        return json.loads(out.stdout)["digests"]

    def _revision(self) -> str:
        p = self.repo / "skills/svg-infographic/references/package-surface.yaml"
        return re.search(r"surface_revision:\s*(\d+)", p.read_text(encoding="utf-8")).group(1)

    def test_a_doc_only_edit_moves_the_tree_digest_and_nothing_else(self):
        """`kind: doc` is outside the runtime surface, so a README edit must not make the receipts
        stale. Bumping the revision for one would: the manifest is itself a profile, so the bump
        changes the runtime digest and forces every artifact to be regenerated for nothing."""
        before, rev = self._digests(), self._revision()
        readme = self.repo / "skills/svg-infographic/README.md"
        readme.write_text(readme.read_text(encoding="utf-8") + "\n<!-- doc-only edit -->\n",
                          encoding="utf-8")
        after = self._digests()
        self.assertNotEqual(before["packageTreeDigest"], after["packageTreeDigest"],
                            "an installed copy did change, so the tree digest must move")
        self.assertEqual(before["runtimeSurfaceDigest"], after["runtimeSurfaceDigest"])
        self.assertEqual(rev, self._revision(), "and no revision bump is owed for it")

    def test_a_runtime_kind_edit_moves_the_runtime_digest(self):
        """The other direction: touching a file the runtime surface covers must be visible there,
        which is what makes a revision bump owed."""
        before = self._digests()
        lib = self.repo / "skills/svg-infographic/scripts/generate.mjs"
        lib.write_text(lib.read_text(encoding="utf-8") + "\n// runtime-kind edit\n",
                       encoding="utf-8")
        after = self._digests()
        self.assertNotEqual(before["runtimeSurfaceDigest"], after["runtimeSurfaceDigest"])
        self.assertNotEqual(before["packageTreeDigest"], after["packageTreeDigest"])

    def test_the_catalog_count_does_not_claim_semantic_completeness(self):
        """Passing the verifier is not the same as drawing everything the receipt counts."""
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertNotIn("TypePack canonical examples verified", h)
        self.assertIn("pass the current package verifier", h)

    def test_every_entity_the_receipt_counts_is_actually_drawn(self):
        """The regression this guards: a receipt crediting an entity no artifact shows."""
        model, _ = build_model(self.repo)
        gaps = {f'{t["id"]}/{loc}': e["unrendered"]
                for t in model["typepacks"] for loc, e in t["locales"].items()
                if e.get("unrendered")}
        self.assertEqual(gaps, {}, "consumed but never drawn")
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertNotIn("Known limitation", h)
        self.assertNotIn("tracked separately", h,
                         "with no gap left, the page must not keep describing one")

    def test_a_gap_that_reappears_is_reported_on_the_page_not_hidden(self):
        """The note is derived, so an artifact that stops drawing an entity must resurface it."""
        tid = "topology-component"
        for loc in ("ko", "en"):
            svg = self.repo / EXAMPLES / tid / f"{tid}.{loc}.svg"
            t = svg.read_text(encoding="utf-8")
            # Take the entity marker back off the boundary — the artifact stops showing what the
            # receipt still counts. (The digest also stops matching; that is a side effect of the
            # stand-in, not the subject.)
            stripped = t.replace(' data-entity="boundary"', "", 1)
            self.assertNotEqual(stripped, t, "the fixture must actually remove the marker")
            svg.write_text(stripped, encoding="utf-8")

        model, _ = build_model(self.repo)
        pack = next(t for t in model["typepacks"] if t["id"] == tid)
        self.assertEqual(pack["locales"]["ko"].get("unrendered"), ["boundary"])
        tokens = json.loads((self.repo / TOKENS_PATH).read_text(encoding="utf-8"))
        h = render(model, tokens)
        self.assertEqual(h.count("Known limitation"), 1)
        self.assertIn("does not draw it", h)
        self.assertIn("tracked separately", h, "and the summary says so too")

    def test_a_caption_carrying_a_number_is_refused(self):
        """A count in a caption is a claim about the artifact that no gate checks."""
        p = self.repo / FEATURED
        d = json.loads(p.read_text())
        d["entries"][0]["caption"] = "20+ connectors"
        p.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
        findings = run_gallery(self.repo)
        self.assertIn("GAL-FEATURED", {f.check for f in findings})
        self.assertTrue(any("digit" in f.detail for f in findings), findings)

    def test_a_featured_entry_pointing_nowhere_is_refused(self):
        p = self.repo / FEATURED
        d = json.loads(p.read_text())
        d["entries"][0]["slug"] = "no-such-example"
        p.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
        self.assertIn("GAL-FEATURED", {f.check for f in run_gallery(self.repo)})

    def test_a_featured_artifact_failing_the_gates_is_refused(self):
        """The one claim featured entries make has to be re-established, not asserted.

        The mutation has to be something a gate genuinely rejects: an element outside the viewBox is
        an E-BOUNDS error the linter owns. An earlier attempt appended an empty rect, which changed
        the bytes without violating anything — the build then failed on drift instead, which would
        have let this test pass while proving nothing about the gates.
        """
        svg = self.repo / "examples/svg-infographic/zero-trust-onion/zero-trust-onion.ko.svg"
        svg.write_text(
            svg.read_text(encoding="utf-8").replace(
                "</svg>", '<rect x="9000" y="9000" width="200" height="200" fill="#000"/></svg>'),
            encoding="utf-8")
        findings = run_gallery(self.repo)
        self.assertIn("GAL-FEATURED", {f.check for f in findings})
        self.assertTrue(any("source gates failed" in f.detail for f in findings), findings)

    def test_editorial_file_missing_fails_the_build(self):
        (self.repo / FEATURED).unlink()
        self.assertIn("GAL-FEATURED", {f.check for f in run_gallery(self.repo)})

    # ---- evidence is facets, not a ranking ----------------------------------------------

    def test_evidence_is_three_independent_facets(self):
        """Nothing in the model orders these. A chart will add a data-accuracy verdict without
        becoming 'more verified' than a diagram that never had one to give."""
        model, _ = build_model(self.repo)
        holders = [e for t in model["typepacks"] for e in t["locales"].values()]
        holders += model["featured"]["entries"]
        allowed = {"pass", "none", "not-applicable"}
        for h in holders:
            ev = h["evidence"]
            self.assertEqual(set(ev), {"sourceGates", "typePackReceipt", "dataAccuracy"})
            for k, v in ev.items():
                self.assertIn(v, allowed, f"{k}={v}")
        # The two groups differ in exactly one facet, which is the distinction worth carrying.
        tp = model["typepacks"][0]["locales"]["ko"]["evidence"]
        ft = model["featured"]["entries"][0]["evidence"]
        self.assertEqual(tp["sourceGates"], ft["sourceGates"])
        self.assertNotEqual(tp["typePackReceipt"], ft["typePackReceipt"])

    def test_page_prints_facets_and_not_a_tier(self):
        import re
        h = (self.repo / GALLERY_HTML).read_text(encoding="utf-8")
        self.assertIn("source gates", h)
        self.assertIn("TypePack receipt", h)
        # not-applicable facets are omitted rather than shown as an empty claim
        self.assertNotIn("not-applicable", h)
        # No ranking vocabulary around the evidence. Matched as ordinals rather than as substrings:
        # "degrade receipt" is the generator's own term and contains "grade".
        self.assertNotIn("tier", h.lower())
        self.assertIsNone(re.search(r"\b(grade|level|rank)\s*\d", h, re.I))

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
