// check-layout.mjs 계약 테스트 — positive 1 + negative 10 (design-kernel §8)
import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "layout-fixtures");
function run(files) {
  try {
    return { code: 0, out: execFileSync("node", [path.join(here, "check-layout.mjs"), ...files], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}
const neg = (file, re) => {
  const r = run([path.join(FIX, file)]);
  assert.equal(r.code, 1, `${file} must fail: ${r.out}`);
  assert.match(r.out, re, r.out);
};

test("positive: balanced insets + equal-gap row + nested 2단계 + shadow clearance", () => {
  const r = run([path.join(FIX, "lp-positive.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("1 접촉: child edge touches parent edge", () => neg("ln-touch.svg", /E-LAYOUT-TOUCH/));
test("2 min padding 미달", () => neg("ln-minpad.svg", /E-LAYOUT-PAD .*left inset 4px < declared min padding 24px/));
test("3 shadow가 visual clearance floor 침범", () => neg("ln-shadow.svg", /E-LAYOUT-VISPAD .*bottom clearance/));
test("4 우측 inset만 좁음 (x symmetry)", () => neg("ln-sym-x.svg", /E-LAYOUT-SYM p: left\/right insets differ by 24px/));
test("5 nested container 하단 inset 비대칭 (y symmetry)", () => neg("ln-nested-bottom.svg", /E-LAYOUT-SYM n: top\/bottom insets differ/));
test("6 3번 카드만 이동 → gap spread 초과", () => neg("ln-gap-drift.svg", /E-LAYOUT-GAP group row: gap spread 12px .*reflow the whole group/));
test("7 outer inset 관계 붕괴", () => neg("ln-outer-inset.svg", /E-LAYOUT-OUTER group row: outer insets 20px vs 56px/));
test("8 nested container 자체가 부모 padding 침범", () => neg("ln-nested-intrude.svg", /E-LAYOUT-PAD p\/n: top inset 8px < declared min padding 24px/));
test("9 unsupported transform은 silent pass 금지", () => neg("ln-transform.svg", /E-LAYOUT-UNVERIFIED p: declared participant <rect> has a non-translate transform/));
test("10 선언 count와 annotated 수 불일치 fail-closed", () => neg("ln-missing-member.svg", /E-LAYOUT-COUNT group row: declared 3 items, found 2/));
test("receipt --json에 inset/gap 수치가 남는다", () => {
  const r = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const j = JSON.parse(r.out);
  const n = j.files[0].containers.find((c) => c.id === "n");
  assert.deepEqual(n.bindingInsets, { left: 24, right: 24, top: 24, bottom: 24 });
  const g = j.files[0].groups.find((x) => x.id === "row");
  assert.deepEqual(g.gaps.map(Math.round), [5, 5]);  // visual gap = 24 - stroke/2 - shadow 보수범위
  assert.ok(g.outerInsets.start === g.outerInsets.end);
});
