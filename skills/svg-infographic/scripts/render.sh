#!/usr/bin/env bash
# render.sh — POSIX/Git-Bash wrapper for the canonical Node renderer.
#
# The single canonical implementation of source-lint gating, browser
# discovery, headless render, and exact 2× PNG verification lives in
# render.mjs (Node 18+ standard library). This wrapper only provides the
# familiar bash entrypoint and the actionable no-Node diagnostics — it adds
# no second discovery/path matrix (C5R1-CX-F1).
#
# Usage:
#   render.sh input.svg [output.png] [--scale N] [--transparent]
#
# Exit codes: 0 ok · 1 usage/input error · 2 no browser · 3 render failed ·
#             4 dimension mismatch · 5 source lint hard errors ·
#             6 gate unavailable (no Node 18+ / incomplete package)
#
# Windows note: with Node installed you do not need this wrapper or Git Bash —
# run the canonical entrypoint directly from CMD/PowerShell:
#   node .claude\skills\svg-infographic\scripts\render.mjs diagram.svg
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CORE="$SCRIPT_DIR/render.mjs"
LINT="$SCRIPT_DIR/check-svg.mjs"

if [ ! -f "$CORE" ] || [ ! -f "$LINT" ]; then
  echo "render gate unavailable: $SCRIPT_DIR is missing render.mjs/check-svg.mjs — the skill package is incomplete; re-install the complete svg-infographic folder." >&2
  exit 6
fi
if ! command -v node >/dev/null 2>&1; then
  echo "render gate unavailable: Node.js 18+ is required for the canonical lint+render path and was not found on PATH." >&2
  echo "Approve the skill's package-manager install prompt, or use its manual source-check + Chromium render fallback (references/authoring.md §8)." >&2
  exit 6
fi
NODE_VERSION="$(node --version 2>/dev/null || echo v0)"
NODE_MAJOR="${NODE_VERSION#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
case "$NODE_MAJOR" in (*[!0-9]*|'') NODE_MAJOR=0 ;; esac
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "render gate unavailable: Node $NODE_VERSION found, but the canonical path requires Node 18+ (ESM stdlib)." >&2
  echo "Approve the skill's package-manager upgrade prompt, or use its manual source-check + Chromium render fallback (references/authoring.md §8)." >&2
  exit 6
fi

exec node "$CORE" "$@"
