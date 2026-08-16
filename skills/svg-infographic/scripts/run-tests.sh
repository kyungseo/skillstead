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
# How much of a failing suite log to print. Enough for the assertion and its context; a whole
# browser-measurement log is not a build artifact.
dump_lines="${SVGINFO_DUMP_LINES:-400}"

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
  # A summary that names the suite but not the reason is not actionable anywhere the log_dir is
  # thrown away with the machine — CI, most of all. Only the suites that failed are dumped, and
  # the dump changes nothing about the exit code below.
  for s in "${failed[@]}"; do
    echo "----- $s.log (first ${dump_lines} lines) -----"
    # Token-shaped values are redacted rather than trusted not to appear: a test that echoed its
    # environment on failure would otherwise put them in a public build log.
    sed -E 's/((TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL)[A-Z_]*[=:] *)[^ ]+/\1<redacted>/Ig' \
      "$log_dir/$s.log" | head -n "$dump_lines"
    lines="$(wc -l <"$log_dir/$s.log" | tr -d ' ')"
    [ "$lines" -gt "$dump_lines" ] && echo "----- truncated: $s.log has $lines lines -----"
  done
else
  echo "all suites green"
fi
exit "$status"
