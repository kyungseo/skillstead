#!/usr/bin/env python3
"""font-subset.py — portable artifact를 위한 glyph subset 생성기(빌드 전용).

이 wrapper가 존재하는 이유는 두 가지다.

1) **버전을 실제로 확인한다.** policy가 fonttools 4.53.1을 선언했다는 사실만으로는
   어떤 실행 파일이 돌았는지 알 수 없다. 여기서 실행 중인 fontTools/brotli 버전을 직접 읽어
   선언과 대조하고, 어긋나면 acceptance artifact를 만들지 않는다.

2) **Reserved Font Name을 정리한다.** subset은 OFL상 Modified Version이므로 CSS alias만
   바꾸는 것으로는 부족하다 — 생성된 font의 name table에서 **identity record**
   (family/unique ID/full name/PostScript name/typographic family)를 중립 명칭으로
   결정적으로 rewrite하고, copyright·trademark·license record는 법적 고지이므로 **보존**한다.
   rewrite 후 identity record에 예약 이름이 남아 있으면 실패로 끝낸다.

usage:
  font-subset.py --face <font> --text-file <chars.txt> --out <woff2> --alias <Name>
                 --style <Regular|Bold> --weight <400|700>
                 --expect-fonttools <ver> --expect-brotli <ver> --rfn <Name> [--rfn <Name> ...]
exit: 0 ok · 2 usage · 4 tool/version 문제 · 5 RFN 잔존 · 6 subset 실패
"""
import argparse
import hashlib
import json
import sys

# identity — 무엇이라 불리는 font인가. subset은 원래 이름을 쓸 수 없다.
IDENTITY_IDS = [1, 3, 4, 6, 16, 18, 20, 21, 22, 25]
# 법적 고지 — 보존한다(OFL은 저작권 고지 유지를 요구한다).
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
    except Exception as e:  # noqa: BLE001 — 도구 실패는 조용히 넘기지 않는다
        fail(6, f"subsetting failed: {e}")

    # identity record를 중립 명칭으로 결정적으로 rewrite한다(Regular/Bold 각각 일관되게).
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

    # 검사: identity record에 예약 이름이 남으면 실패. 법적 고지는 검사 대상이 아니다.
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
        "bytes": len(blob),
        "digest": "sha256:" + hashlib.sha256(blob).hexdigest(),
    }))


if __name__ == "__main__":
    main()
