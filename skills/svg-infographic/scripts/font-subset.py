#!/usr/bin/env python3
"""font-subset.py — the glyph subset generator for portable artifacts (build only).

This wrapper exists for two reasons.

1) **It actually checks the version.** The policy declaring fonttools 4.53.1 says nothing
   about which executable ran. Here the running fontTools/brotli versions are read directly and
   compared with the declaration; on a mismatch no acceptance artifact is produced.

2) **It settles the Reserved Font Name.** Under the OFL a subset is a Modified Version, so
   changing the CSS alias alone is not enough — in the generated font's name table the
   **identity records** (family, unique ID, full name, PostScript name, typographic family) are
   deterministically rewritten to neutral names, while the copyright, trademark and license
   records are **preserved** as the legal notice they are. If a reserved name survives in an
   identity record after the rewrite, the run ends in failure.

usage:
  font-subset.py --face <font> --text-file <chars.txt> --out <woff2> --alias <Name>
                 --style <Regular|Bold> --weight <400|700>
                 --expect-fonttools <ver> --expect-brotli <ver> --rfn <Name> [--rfn <Name> ...]
exit: 0 ok / 2 usage / 4 tool or version problem / 5 RFN survived / 6 subset failed
"""
import argparse
import hashlib
import json
import sys

# identity — what the font is called. A subset may not use the original name.
IDENTITY_IDS = [1, 3, 4, 6, 16, 18, 20, 21, 22, 25]
# Legal notice — preserved (the OFL requires the copyright notice to be kept).
LEGAL_IDS = [0, 7, 8, 9, 11, 12, 13, 14]


def fail(code, msg):
    print(f"font-subset: {msg}", file=sys.stderr)
    sys.exit(code)


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--face", required=True)
    ap.add_argument("--text-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--alias", required=True)
    ap.add_argument("--style", required=True)
    ap.add_argument("--weight", required=True)
    ap.add_argument("--expect-fonttools", required=True)
    ap.add_argument("--expect-brotli", required=True)
    ap.add_argument("--rfn", action="append", default=[])
    try:
        a = ap.parse_args()
    except SystemExit:
        fail(2, __doc__.strip().splitlines()[-3])

    try:
        import fontTools
        from fontTools import subset
        from fontTools.ttLib import TTFont
        import brotli
    except ImportError as e:
        fail(4, f"pinned build dependency missing ({e}); portable artifacts cannot be produced here")

    ft_ver = getattr(fontTools, "version", None) or fontTools.__version__
    br_ver = getattr(brotli, "__version__", None) or getattr(brotli, "version", "unknown")
    if ft_ver != a.expect_fonttools:
        fail(4, f"fontTools {ft_ver} does not match the pinned {a.expect_fonttools} — acceptance artifacts must come from the pinned toolchain")
    if str(br_ver) != a.expect_brotli:
        fail(4, f"brotli {br_ver} does not match the pinned {a.expect_brotli}")

    with open(a.text_file, encoding="utf-8") as fh:
        text = fh.read()
    if not text:
        fail(6, "no text to subset")

    try:
        font = TTFont(a.face)
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.hinting = False
        opts.desubroutinize = True
        opts.drop_tables += ["DSIG"]
        opts.name_IDs = IDENTITY_IDS + LEGAL_IDS + [2, 5, 17]
        opts.name_legacy = True
        opts.notdef_outline = True
        subsetter = subset.Subsetter(options=opts)
        subsetter.populate(text=text)
        subsetter.subset(font)
    except Exception as e:  # noqa: BLE001 — a tool failure is never passed over quietly
        fail(6, f"subsetting failed: {e}")

    # Deterministically rewrite the identity records to neutral names (consistently for Regular and Bold).
    alias = a.alias
    family = alias
    full = f"{alias} {a.style}"
    ps = f"{alias}-{a.style}".replace(" ", "")
    unique = f"{full}; subset; weight {a.weight}"
    values = {1: family, 3: unique, 4: full, 6: ps, 16: family, 18: full, 21: family, 22: a.style}
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in values:
            name.setName(values[rec.nameID], rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (20, 25):
            name.removeNames(nameID=rec.nameID)

    # Check: a reserved name surviving in an identity record is a failure. The legal notice is not a subject of this check.
    leaked = []
    for rec in name.names:
        if rec.nameID in LEGAL_IDS:
            continue
        value = str(rec)
        for reserved in a.rfn:
            if reserved.lower() in value.lower():
                leaked.append(f"name ID {rec.nameID}: {value[:60]}")
    if leaked:
        fail(5, "reserved font name still present in identity records after rewrite:\n  " + "\n  ".join(leaked))

    # This **actually enforces** the delivery policy's on_glyph_missing: fail-closed.
    # If a requested character is absent from the subset's cmap the render leaks quietly to a
    # fallback face, breaking the portable artifact's claim of not depending on an installed font.
    cmap = set()
    for table in font["cmap"].tables:
        cmap.update(table.cmap.keys())
    missing = sorted({ch for ch in text if ord(ch) not in cmap and ch not in "\r\n\t"})
    if missing:
        fail(7, "the subset does not cover %d requested character(s) — an implicit fallback would be needed: %s"
             % (len(missing), " ".join(repr(c) for c in missing[:20])))

    try:
        font.save(a.out)
    except Exception as e:  # noqa: BLE001
        fail(6, f"writing the subset failed: {e}")

    with open(a.out, "rb") as fh:
        blob = fh.read()
    print(json.dumps({
        "schemaVersion": 1,
        "tool": {"fonttools": ft_ver, "brotli": str(br_ver), "python": sys.version.split()[0]},
        "identity": {"family": family, "fullName": full, "postScriptName": ps, "uniqueID": unique},
        "preservedLegalNameIDs": sorted({r.nameID for r in name.names if r.nameID in LEGAL_IDS}),
        "rfnGuard": "clean",
        "glyphCoverage": {"requested": len(set(text)), "missing": 0},
        "bytes": len(blob),
        "digest": "sha256:" + hashlib.sha256(blob).hexdigest(),
    }))


if __name__ == "__main__":
    main()
