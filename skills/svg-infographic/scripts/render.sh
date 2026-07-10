#!/usr/bin/env bash
# render.sh — render an SVG to a crisp PNG with a headless Chromium-based browser,
# then verify the PNG dimensions match scale × viewBox.
#
# Usage:
#   render.sh input.svg [output.png] [--scale N] [--transparent]
#
# Defaults: output = input path with .png extension, scale = 2.
# Exit codes: 0 ok · 1 usage/input error · 2 no browser · 3 render failed · 4 dimension mismatch
set -euo pipefail

usage() { sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; }

SVG="" ; OUT="" ; SCALE=2 ; TRANSPARENT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --scale) SCALE="${2:?--scale needs a value}"; shift 2 ;;
    --transparent) TRANSPARENT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 1 ;;
    *) if [ -z "$SVG" ]; then SVG="$1"; elif [ -z "$OUT" ]; then OUT="$1"; else echo "unexpected argument: $1" >&2; exit 1; fi; shift ;;
  esac
done

[ -n "$SVG" ] || { usage >&2; exit 1; }
[ -f "$SVG" ] || { echo "input SVG not found: $SVG" >&2; exit 1; }
[ -n "$OUT" ] || OUT="${SVG%.svg}.png"

# --- 1. viewBox → W H -------------------------------------------------------
read -r W H < <(awk 'match($0, /viewBox="[ ]*[0-9.]+[ ]+[0-9.]+[ ]+[0-9.]+[ ]+[0-9.]+[ ]*"/) {
  vb = substr($0, RSTART+9, RLENGTH-10); gsub(/"/, "", vb);
  split(vb, a, /[ ]+/); printf "%d %d", a[3], a[4]; exit }' "$SVG") || true
[ -n "${W:-}" ] && [ -n "${H:-}" ] || { echo "could not parse viewBox from $SVG" >&2; exit 1; }

# --- 2. browser discovery ---------------------------------------------------
find_browser() {
  local c
  for c in google-chrome google-chrome-stable chromium chromium-browser msedge; do
    command -v "$c" 2>/dev/null && return 0
  done
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "/c/Program Files/Microsoft/Edge/Application/msedge.exe"; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}
BROWSER="$(find_browser)" || { echo "no Chromium-based browser found (Chrome/Edge/Chromium). Deliver the SVG only, or install one." >&2; exit 2; }

# --- 3. wrapper + render ----------------------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp "$SVG" "$TMP/diagram.svg"
cat > "$TMP/wrapper.html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:${W}px;height:${H}px;overflow:hidden}
img{display:block;width:${W}px;height:${H}px}
</style></head><body><img src="diagram.svg"></body></html>
EOF

# Git Bash / MSYS on Windows: convert POSIX paths to Windows form for Chrome
if command -v cygpath >/dev/null 2>&1; then
  URL="file:///$(cygpath -m "$TMP/wrapper.html")"
  SHOT="$(cygpath -m "$TMP/out.png")"
else
  URL="file://$TMP/wrapper.html"
  SHOT="$TMP/out.png"
fi

FLAGS=(--headless=new --disable-gpu --hide-scrollbars
  --force-device-scale-factor="$SCALE" --window-size="$W,$H"
  --screenshot="$SHOT")
[ "$TRANSPARENT" -eq 1 ] && FLAGS+=(--default-background-color=00000000)

"$BROWSER" "${FLAGS[@]}" "$URL" >/dev/null 2>&1 || {
  echo "render failed. If this is a locked-down Linux/CI environment, retry manually with --no-sandbox (see references/authoring.md §8)." >&2
  exit 3
}
[ -s "$TMP/out.png" ] || { echo "render produced no PNG" >&2; exit 3; }
mkdir -p "$(dirname "$OUT")"
mv "$TMP/out.png" "$OUT"

# --- 4. dimension verification ----------------------------------------------
png_dims() {  # prints "width height" from the PNG IHDR
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$1" <<'PY'
import struct, sys
with open(sys.argv[1], "rb") as f:
    f.seek(16)
    w, h = struct.unpack(">II", f.read(8))
print(w, h)
PY
  elif command -v sips >/dev/null 2>&1; then
    sips -g pixelWidth -g pixelHeight "$1" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w, h}'
  else
    return 1
  fi
}

EXP_W=$((W * SCALE)); EXP_H=$((H * SCALE))
if DIMS="$(png_dims "$OUT")"; then
  read -r PW PH <<< "$DIMS"
  if [ "$PW" -eq "$EXP_W" ] && [ "$PH" -eq "$EXP_H" ]; then
    echo "OK  $OUT  ${PW}x${PH}  (= ${SCALE}x of ${W}x${H} viewBox)"
  else
    echo "DIMENSION MISMATCH  $OUT is ${PW}x${PH}, expected ${EXP_W}x${EXP_H} (${SCALE}x of ${W}x${H})" >&2
    exit 4
  fi
else
  echo "OK? $OUT written, but no python3/sips available to verify dimensions (expected ${EXP_W}x${EXP_H})"
fi
