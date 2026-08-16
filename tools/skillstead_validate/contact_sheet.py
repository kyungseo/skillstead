"""README contact sheet — one image showing what the skill produces.

The sheet is assembled as SVG and rendered to PNG through the package's existing renderer, so it
travels the same lint → render path every other artifact does rather than a second one built for
documentation.

`gallery --write` regenerates the SVG. The PNG the README actually displays is a browser render, so
it is produced by a separate step — the one that also writes `contact-sheet.render.json`:

    python3 -c "import json,pathlib,sys; sys.path.insert(0,'tools'); \
        from skillstead_validate.contact_sheet import render_sheets; \
        render_sheets(json.load(open('gallery/model.json')), pathlib.Path('.'))"

Keeping the receipt out of `--write` is the point. `--write` can only prove the SVG; if it also
stamped the receipt, a regenerated sheet would certify a PNG nobody re-rendered and the README would
go on showing the old picture with every check green.

**It shows the Featured six, not the nine TypePacks.** `gallery/featured.json` is the repository's
editorial selection, and the durable gallery already offers the full catalog under *Choose a
TypePack*. A different set in the README would give the project two image systems that drift apart;
consuming the same SSoT means a Wave 2 replacement edits one file and both surfaces follow.

**The locale boundary is intentional.** The KO sheet embeds KO artifacts and the EN sheet embeds EN artifacts,
but both keep the same English evidence frame and Latin entry names. This is a compact review surface, not the
localized gallery page. A locale caption inside the image would need a CJK face embedded in the sheet itself, which
means either a second font-subsetting path in the repository layer or a PNG that renders differently
on whichever machine built it. The words belong in the README, where GitHub renders them with its
own fonts and a screen reader can reach them.

**Cells are uniform; artifacts keep their shape.** The six range from 0.71 to 1.71 in aspect ratio.
Every cell is the same size and each artifact is fitted inside it — the same contain-fit the gallery
grid uses. A per-entry cell size would make the layout, rather than the work, the thing that varies.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path

SHEET_SVG = "gallery/contact-sheet.{loc}.svg"
SHEET_PNG = "gallery/contact-sheet.{loc}.png"
RENDER_RECEIPT = "gallery/contact-sheet.render.json"
RENDER_SCALE = 2
RENDERER = ("skills/svg-infographic/scripts/render.mjs",
            "skills/svg-infographic/scripts/render.sh")

# 3 x 2 holds the Featured six exactly, so no cell is left empty.
COLUMNS = 3
CELL_RATIO = 4 / 3          # near the middle of the six, so nothing is extremely letterboxed
SHEET_WIDTH = 1080.0
CAP_H = 34.0                # the name strip under each thumbnail
HEAD_H = 64.0


def _esc(s: object) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def embed_for_render(svg_text: str, root: Path) -> str:
    """Inline the referenced PNGs, for rendering only.

    The committed sheet references its artifacts by path and records their digests, which is what
    drift is detected from — embedding 6 legacy PNGs as base64 would put about 7 MB of duplicated
    bytes into the repository for a file nobody reads directly. The renderer, though, loads the SVG
    through a wrapper page in a temp directory, where a relative href resolves to nothing; so the
    bytes are inlined into a throwaway copy at render time and never committed.
    """
    def sub(m):
        rel = m.group(1)
        data = base64.b64encode((root / rel.replace("../", "", 1)).read_bytes()).decode("ascii")
        return f'href="data:image/png;base64,{data}"'
    return re.sub(r'href="(\.\./[^"]+\.png)"', sub, svg_text)


def _viewbox(svg: Path) -> tuple[float, float]:
    head = svg.read_text(encoding="utf-8")[:600]
    vb = head.split('viewBox="', 1)[1].split('"', 1)[0].split()
    return float(vb[2]), float(vb[3])


def _layout(n: int, tok: dict) -> dict:
    """Geometry derived from the tokens and the cell count — no per-file coordinates."""
    pad = float(tok["space"]["cardPad"])
    gap = float(tok["space"]["cardGap"])
    inner = float(tok["space"]["pairGap"])
    left = pad + inner
    cell_w = (SHEET_WIDTH - 2 * left - (COLUMNS - 1) * gap) / COLUMNS
    thumb_h = cell_w / CELL_RATIO
    rows = -(-n // COLUMNS)
    grid_h = rows * (thumb_h + CAP_H) + (rows - 1) * gap
    # The header sits in a declared top reservation and the grid starts one `inner` below it, so the
    # containment check measures a real gap on every side instead of a coincidence.
    reserve = inner + HEAD_H
    box = {"x": pad, "y": pad, "w": SHEET_WIDTH - 2 * pad,
           "h": reserve + inner + grid_h + inner, "reserve": reserve}
    return {"pad": pad, "gap": gap, "inner": inner, "left": left, "cellW": cell_w,
            "thumbH": thumb_h, "rows": rows, "box": box, "height": box["y"] + box["h"] + pad}


def render_sheet(model: dict, tokens: dict, loc: str, root: Path) -> str:
    entries = ((model.get("featured") or {}).get("entries")) or []
    g = _layout(len(entries), tokens)
    pal = tokens["palette"]
    mono = tokens["type"]["identifier"]["family"]
    r1 = lambda v: round(float(v), 1)

    cells = []
    for i, ent in enumerate(entries):
        a = ent["artifacts"][loc]
        svg_path = root / a["svg"]
        aw, ah = _viewbox(svg_path)
        col, row = i % COLUMNS, i // COLUMNS
        x = g["left"] + col * (g["cellW"] + g["gap"])
        y = g["box"]["y"] + g["box"]["reserve"] + g["inner"] + row * (g["thumbH"] + CAP_H + g["gap"])

        # contain: the artifact keeps its own proportions and the leftover is centred
        scale = min(g["cellW"] / aw, g["thumbH"] / ah)
        dw, dh = aw * scale, ah * scale
        ox, oy = x + (g["cellW"] - dw) / 2, y + (g["thumbH"] - dh) / 2
        members = min(COLUMNS, len(entries) - row * COLUMNS)
        align = (f' data-align-row="sheet-r{row}" data-align-row-count="{members}"'
                 if members >= 2 else "")
        cells.append(
            f'  <g data-cell="{_esc(ent["slug"])}" data-artifact-digest="{_esc(a["svgDigest"])}">\n'
            f'    <rect x="{r1(x)}" y="{r1(y)}" width="{r1(g["cellW"])}" height="{r1(g["thumbH"] + CAP_H)}"'
            f' rx="{tokens["shape"]["cardRadius"]}" fill="{pal["card"]}" stroke="{pal["cardEdge"]}"'
            f' stroke-width="{tokens["shape"]["hairline"]}" data-layout-parent="sheet"'
            f' data-layout-item="sheet-row-{row}"{align}/>\n'
            f'    <image href="../{_esc(a["svg"][:-4])}.png" x="{r1(ox)}" y="{r1(oy)}"'
            f' width="{r1(dw)}" height="{r1(dh)}" preserveAspectRatio="none"/>\n'
            f'    <text x="{r1(x + g["cellW"] / 2)}" y="{r1(y + g["thumbH"] + CAP_H / 2 + 1)}"'
            f' text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="600"'
            f' font-family="{_esc(mono)}" fill="{pal["ink"]}">{_esc(ent["name"])}</text>\n'
            f'  </g>')

    title = "What it can draw"
    # The evidence boundary travels with the picture: these clear the source gates and carry no
    # TypePack receipt, and the sheet says so rather than leaving the README to imply otherwise.
    sub = (f"{len(entries)} selected outputs · {loc.upper()} · lint, layout and typography gates "
           f"pass · no TypePack receipt")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {r1(SHEET_WIDTH)} {r1(g['height'])}" width="{r1(SHEET_WIDTH)}" height="{r1(g['height'])}" role="img" aria-label="{_esc(title)} — {_esc(sub)}">
  <title>{_esc(title)} — {_esc(sub)}</title>
  <rect width="{r1(SHEET_WIDTH)}" height="{r1(g['height'])}" fill="{pal['ground']}" data-fill-role="canvas"/>
  <rect data-layout-container="sheet" x="{r1(g['box']['x'])}" y="{r1(g['box']['y'])}" width="{r1(g['box']['w'])}" height="{r1(g['box']['h'])}" fill="none" stroke="none" data-min-pad="{r1(g['inner'])}" data-reserve-top="{r1(g['box']['reserve'])}" data-layout-count="{len(entries)}"/>
  <text x="{r1(g['left'])}" y="{r1(g['box']['y'] + g['inner'] + 20)}" font-size="20" font-weight="700" font-family="{_esc(mono)}" fill="{pal['ink']}" dominant-baseline="central">{_esc(title)}</text>
  <text x="{r1(g['left'])}" y="{r1(g['box']['y'] + g['inner'] + 44)}" font-size="13" font-family="{_esc(mono)}" fill="{pal['inkMuted']}" dominant-baseline="central">{_esc(sub)}</text>
{chr(10).join(cells)}
</svg>
"""


def sheet_paths(loc: str) -> tuple[str, str]:
    return SHEET_SVG.format(loc=loc), SHEET_PNG.format(loc=loc)


# --- render receipt ------------------------------------------------------------------------
# The README displays the PNG, but only the SVG is derived by `gallery --write`. Without a record
# tying one to the other, a regenerated sheet with a stale PNG passes every check while the README
# keeps showing the old picture. The receipt closes that: it is written by the render step — never
# by `--write` — so a regenerated SVG stays failing until the PNG is actually re-rendered.


def _sha(p: Path) -> str:
    return "sha256:" + hashlib.sha256(p.read_bytes()).hexdigest()


def _png_size(p: Path) -> list[int]:
    """Read IHDR directly. Pulling in an imaging library to learn two integers would add a
    dependency to the repository layer for something the file header already states."""
    b = p.read_bytes()
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{p}: not a PNG")
    w, h = struct.unpack(">II", b[16:24])
    return [w, h]


def _inputs(model: dict, loc: str) -> list[str]:
    """The Featured PNGs this locale's sheet draws, in sheet order."""
    entries = ((model.get("featured") or {}).get("entries")) or []
    return [e["artifacts"][loc]["svg"][:-4] + ".png" for e in entries]


def build_render_receipt(model: dict, root: Path) -> dict:
    locales = {}
    for loc in ("ko", "en"):
        svg_rel, png_rel = sheet_paths(loc)
        locales[loc] = {
            "sourceSvg": {"path": svg_rel, "digest": _sha(root / svg_rel)},
            "inputs": [{"path": rel, "digest": _sha(root / rel)} for rel in _inputs(model, loc)],
            "output": {"path": png_rel, "digest": _sha(root / png_rel),
                       "pixels": _png_size(root / png_rel)},
        }
    return {
        "schemaVersion": 1,
        "id": "contact-sheet-render",
        "note": "Written by the render step, not by `gallery --write`. A regenerated SVG stays "
                "failing here until its PNG is re-rendered.",
        "scale": RENDER_SCALE,
        "renderer": {rel: _sha(root / rel) for rel in RENDERER},
        "locales": locales,
    }


def render_sheets(model: dict, root: Path) -> None:
    """Render both locale PNGs and write the receipt that binds them to their inputs."""
    for loc in ("ko", "en"):
        svg_rel, png_rel = sheet_paths(loc)
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td) / f"sheet.{loc}.svg"
            tmp.write_text(embed_for_render((root / svg_rel).read_text(encoding="utf-8"), root),
                           encoding="utf-8")
            subprocess.run(["bash", str(root / RENDERER[1]), str(tmp), str(root / png_rel),
                            "--scale", str(RENDER_SCALE)], check=True,
                           capture_output=True, text=True)
    (root / RENDER_RECEIPT).write_text(
        json.dumps(build_render_receipt(model, root), indent=1, ensure_ascii=False) + "\n",
        encoding="utf-8")


def check_render(model: dict, root: Path) -> list[tuple[str, str]]:
    """Compare the recorded render against what is on disk. Returns (path, detail) pairs.

    Nothing is regenerated here — a check that rebuilt the receipt would agree with itself and
    prove nothing.
    """
    rec_path = root / RENDER_RECEIPT
    if not rec_path.exists():
        return [(RENDER_RECEIPT, "missing — re-render the contact sheet to record what produced it")]
    try:
        rec = json.loads(rec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [(RENDER_RECEIPT, f"unreadable: {e}")]

    out: list[tuple[str, str]] = []
    if rec.get("scale") != RENDER_SCALE:
        out.append((RENDER_RECEIPT, f"records scale {rec.get('scale')}, not {RENDER_SCALE}"))
    for rel, want in (rec.get("renderer") or {}).items():
        got = _sha(root / rel) if (root / rel).exists() else None
        if got != want:
            out.append((rel, "renderer changed since the sheet was rendered — re-render it"))
    for loc in ("ko", "en"):
        r = (rec.get("locales") or {}).get(loc)
        if not r:
            out.append((RENDER_RECEIPT, f"records no {loc} render"))
            continue
        svg_rel, png_rel = sheet_paths(loc)
        if _sha(root / svg_rel) != r["sourceSvg"]["digest"]:
            out.append((png_rel, "the sheet SVG changed after this PNG was rendered — re-render it"))
        want_inputs = [(i["path"], i["digest"]) for i in r["inputs"]]
        have_inputs = [(rel, _sha(root / rel)) for rel in _inputs(model, loc)]
        if want_inputs != have_inputs:
            out.append((png_rel, "the featured artifacts changed after this PNG was rendered "
                                 "(or the selection did) — re-render it"))
        if not (root / png_rel).exists():
            out.append((png_rel, "missing — re-render the contact sheet"))
        elif _sha(root / png_rel) != r["output"]["digest"]:
            out.append((png_rel, "does not match the digest recorded when it was rendered"))
        elif _png_size(root / png_rel) != r["output"]["pixels"]:
            out.append((png_rel, "pixel size differs from the recorded render"))
    return out
