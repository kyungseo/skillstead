#!/usr/bin/env bash
# svg-infographic official regression path.
#
# Why a runner: some suites launch a headless browser (through render / measure-text).
# Running those concurrently exposes the wall-clock-timed steps to resource contention and
# the result stops being deterministic. So the contract is fixed: **suites that need no
# browser run in parallel, browser-dependent suites run serially.**
#
# Contract:
#   - No retries. A failure is reported as a failure.
#   - Full output per suite is kept as a log — a failing case must be identifiable afterwards.
#   - If any suite fails, the run exits non-zero.
#
# usage: bash scripts/run-tests.sh [--log-dir <dir>]
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --log-dir) log_dir="$2"; shift 2 ;;
    *) echo "usage: run-tests.sh [--log-dir <dir>]" >&2; exit 2 ;;
  esac
done
[ -n "$log_dir" ] || log_dir="$(mktemp -d "${TMPDIR:-/tmp}/svginfo-tests-XXXXXX")"
mkdir -p "$log_dir"

# These launch no browser — running them together causes no interference.
parallel_suites=(skin preflight check-svg check-layout route-orthogonal check-language)
# These launch a headless browser — strictly one at a time.
serial_suites=(font-probe render compose generate)

status=0
declare -a failed=()

run_suite() {
  local s="$1"
  node "$here/$s.test.mjs" >"$log_dir/$s.log" 2>&1
  echo "$?" >"$log_dir/$s.exit"
}

report() {
  local s="$1" code pass fail
  code="$(cat "$log_dir/$s.exit" 2>/dev/null || echo "?")"
  pass="$(grep -oE '^# pass [0-9]+' "$log_dir/$s.log" 2>/dev/null | tail -1 | grep -oE '[0-9]+')"
  fail="$(grep -oE '^# fail [0-9]+' "$log_dir/$s.log" 2>/dev/null | tail -1 | grep -oE '[0-9]+')"
  printf '  %-16s pass %-4s fail %-4s exit %s\n' "$s" "${pass:-?}" "${fail:-?}" "$code"
  if [ "$code" != "0" ]; then
    status=1
    failed+=("$s")
    grep -E '^not ok' "$log_dir/$s.log" | head -10 | sed 's/^/      /'
  fi
}

echo "svg-infographic regression — logs in $log_dir"
echo "parallel (no browser):"
for s in "${parallel_suites[@]}"; do run_suite "$s" & done
wait
for s in "${parallel_suites[@]}"; do report "$s"; done

echo "serial (browser-dependent — one at a time by contract):"
for s in "${serial_suites[@]}"; do run_suite "$s"; report "$s"; done

if [ "$status" != "0" ]; then
  echo "FAILED: ${failed[*]}"
  echo "full output per suite: $log_dir/<suite>.log"
else
  echo "all suites green"
fi
exit "$status"
