"""Regression cover for the README's own diagrams.

`examples/catalog-overview.{en,ko}.svg` is hand-authored, sits at the top of the public README, and is
not produced by `generate.mjs` — so nothing re-derives it and nothing re-checks it. Three defects that
had been shipping in it are pinned here:

  * a pill wider than the card it sat in, breaking out of the left edge,
  * English and Korean drawing the same diagram with different pill geometry and one connector styled
    differently,
  * lint warnings accumulating unread.

These live in the repository layer on purpose. Extending `check-svg.mjs`/`check-layout.mjs` would move
the package's runtime surface and drag every TypePack receipt with it; the invariants below are about
one public asset, not about the drawing contract in general.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
ASSET = "examples/catalog-overview.{}.svg"
CHECK_SVG = "skills/svg-infographic/scripts/check-svg.mjs"

# Elements whose attributes place or shape something. `text` is here deliberately: a label carries
# coordinates too, so comparing only boxes and paths would let a Korean caption drift unnoticed.
SHAPES = ("rect", "path", "circle", "line", "polyline", "use")
# Attributes that are the artifact's identity rather than its geometry or paint.
IDENTITY = re.compile(r'\s(?:id|class|aria-\w+)="[^"]*"')

# The one warning this asset is allowed to carry, named down to the marker it belongs to. Connector
# visual scale is deferred to Wave 3; until then the exemption is this arrowhead and nothing else.
ALLOWED_WARNING = ("W-HEADSIZE", "#arrow")
# Floor for the gap between a pill and the card holding it. The tightest one in the asset today
# measures 10; this is the line below which a pill reads as touching the border.
MIN_PILL_PAD = 8


@unittest.skipIf(NODE is None, "node not available")
class CatalogOverviewAsset(unittest.TestCase):
    def _svg(self, loc: str) -> str:
        return (REPO / ASSET.format(loc)).read_text(encoding="utf-8")

    def _lint(self, loc: str) -> str:
        out = subprocess.run([NODE, CHECK_SVG, ASSET.format(loc)],
                             cwd=REPO, capture_output=True, text=True)
        text = out.stdout + out.stderr
        # A crashed checker prints no W-TEXT either. Without this the absence of a warning and the
        # absence of a run look identical, and the fixture goes green for the wrong reason.
        self.assertEqual(out.returncode, 0,
                         f"{loc}: check-svg exited {out.returncode}\n{text}")
        return text

    def test_the_two_locales_are_the_same_drawing(self):
        """Same shapes, same coordinates, same paint — only the words differ."""
        alternation = "|".join(SHAPES)

        def shapes(t: str) -> list[str]:
            pat = r"<(?:" + alternation + r")\b[^>]*>"
            return [IDENTITY.sub("", m.group(0)) for m in re.finditer(pat, t)]

        en, ko = shapes(self._svg("en")), shapes(self._svg("ko"))
        self.assertEqual(len(en), len(ko), "the two locales draw a different number of elements")
        diff = [(a, b) for a, b in zip(en, ko) if a != b]
        self.assertEqual(diff, [], "geometry or paint differs between locales")

    def test_labels_sit_where_their_counterparts_sit(self):
        """A label's position is geometry: comparing only boxes would miss a caption that moved."""
        def anchors(t: str) -> list[tuple[str, str]]:
            return re.findall(r'<text[^>]*\sx="([-\d.]+)"[^>]*\sy="([-\d.]+)"', t)

        self.assertEqual(anchors(self._svg("en")), anchors(self._svg("ko")))

    def test_every_pill_sits_inside_the_card_that_holds_it(self):
        """The actual defect: a pill wider than its card, hanging past the left edge. `W-TEXT` says
        the text fits the pill, which is a different question — this one measures the pill itself."""
        BOX = re.compile(r'<rect[^>]*>')
        ATTR = r'(?:^|\s)(x|y|width|height|rx)="([-\d.]+)"'
        for loc in ("en", "ko"):
            rects = []
            for m in BOX.finditer(self._svg(loc)):
                d = dict(re.findall(ATTR, m.group(0)))
                if {"x", "y", "width", "height"} <= set(d):
                    rects.append(tuple(float(d[k]) for k in ("x", "y", "width", "height"))
                                 + (float(d.get("rx", 0)),))
            # a pill is a fully rounded bar: rx == half its height
            pills = [r for r in rects if r[3] <= 40 and abs(r[4] - r[3] / 2) < 0.01 and r[2] > 40]
            self.assertGreaterEqual(len(pills), 5, f"{loc}: the pills went missing from this asset")
            for px, py, pw, ph, _ in pills:
                # The card is chosen by *overlap*, not by containment. Picking the narrowest box that
                # already contains the pill is what lets the broken case pass: a pill hanging out of
                # its card is still inside the outer panel, so the search quietly falls back to that
                # and finds acres of room. Overlap keeps the real parent in the frame.
                holders = [r for r in rects if r[2] > pw
                           and r[1] <= py and r[1] + r[3] >= py + ph
                           and r[0] < px + pw and r[0] + r[2] > px]
                self.assertTrue(holders, f"{loc}: pill at x={px} has no card around it")
                cx, _, cw, _, _ = min(holders, key=lambda r: r[2])
                left, right = px - cx, (cx + cw) - (px + pw)
                self.assertGreaterEqual(min(left, right), MIN_PILL_PAD,
                                        f"{loc}: pill x∈[{px},{px + pw}] leaves {left}/{right} "
                                        f"inside card x∈[{cx},{cx + cw}]")

    def test_no_label_overflows_its_box(self):
        """Whether each label fits the box it is drawn in. Whether that box fits its card is the
        previous test — the two failed together in this asset but they are different questions."""
        for loc in ("en", "ko"):
            hits = [ln for ln in self._lint(loc).splitlines() if "W-TEXT" in ln]
            self.assertEqual(hits, [], f"{loc}: a label no longer fits its box")

    def test_only_the_deferred_arrowhead_warning_is_carried(self):
        """A blanket 'warnings are fine' would let the next one in unread. This names the one."""
        code, subject = ALLOWED_WARNING
        for loc in ("en", "ko"):
            warns = [ln for ln in self._lint(loc).splitlines() if re.search(r"\bwarn\b", ln)]
            self.assertEqual(len(warns), 1, f"{loc}: expected exactly one carried warning, got {warns}")
            self.assertIn(code, warns[0], f"{loc}: {warns[0]}")
            self.assertIn(subject, warns[0], f"{loc}: the exemption is for {subject} only")

    def test_background_matches_canvas_and_lint_has_no_errors(self):
        """The height was reduced to balance the margins, so the background has to follow the
        viewBox. Whether the *painted* bounds (shadow included) are balanced is not asserted here —
        that needs a general visual-paint-bounds contract, which does not exist yet."""
        for loc in ("en", "ko"):
            t = self._svg(loc)
            vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', t)
            self.assertIsNotNone(vb, f"{loc}: no viewBox")
            w, h = int(vb.group(1)), int(vb.group(2))
            bg = re.search(r'<rect width="(\d+)" height="(\d+)" rx="\d+" fill="var\(--bg\)"', t)
            self.assertIsNotNone(bg, f"{loc}: no background rect")
            self.assertEqual((int(bg.group(1)), int(bg.group(2))), (w, h),
                             f"{loc}: the background and the canvas disagree")
            self.assertNotIn("ERROR", self._lint(loc), f"{loc}: lint reports an error")
