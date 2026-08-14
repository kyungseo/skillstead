#!/usr/bin/env bash
# svg-infographic 공식 회귀 실행 경로.
#
# 왜 runner가 필요한가: suite 중 일부는 headless browser를 띄운다(render·measure-text 경유).
# 이들을 동시에 돌리면 wall-clock timeout이 걸린 단계가 자원 경합에 노출돼 결과가 비결정적이 된다.
# 그래서 **browser 비의존 suite는 병렬, browser 의존 suite는 직렬**을 계약으로 고정한다.
#
# 계약:
#   - 재시도하지 않는다. 실패는 실패로 보고한다.
#   - suite마다 전체 출력을 로그로 남긴다 — 실패 항목을 사후에 특정할 수 있어야 한다.
#   - 한 suite라도 실패하면 non-zero로 끝난다.
#
# 사용: bash scripts/run-tests.sh [--log-dir <dir>]
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

# browser를 띄우지 않는다 — 동시에 돌려도 서로 간섭하지 않는다.
parallel_suites=(skin preflight check-svg check-layout route-orthogonal)
# headless browser를 띄운다 — 반드시 한 번에 하나씩.
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
