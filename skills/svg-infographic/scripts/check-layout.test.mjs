// check-layout.mjs 계약 테스트 — positive 1 + negative 10 (design-kernel §8)
import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
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
test("4 우측 inset만 좁음 (x symmetry)", () => neg("ln-sym-x.svg", /E-LAYOUT-SYM container "p": geometric left\/right insets differ by 24px/));
test("5 nested container 하단 inset 비대칭 (y symmetry)", () => neg("ln-nested-bottom.svg", /E-LAYOUT-SYM container "n": geometric top\/bottom insets differ/));
test("6 3번 카드만 이동 → gap spread 초과", () => neg("ln-gap-drift.svg", /E-LAYOUT-GAP group "row": visual gap spread 12px .*reflow the whole group/));
test("7 outer inset 관계 붕괴", () => neg("ln-outer-inset.svg", /E-LAYOUT-OUTER group "row": outer insets 20px vs 56px/));
test("8 nested container 자체가 부모 padding 침범", () => neg("ln-nested-intrude.svg", /E-LAYOUT-PAD container "p"\/n: top inset 8px < declared min padding 24px/));
test("9 unsupported transform은 silent pass 금지", () => neg("ln-transform.svg", /E-LAYOUT-UNVERIFIED p: declared participant <rect> has a non-translate transform/));
test("10 선언 count와 annotated 수 불일치 fail-closed", () => neg("ln-missing-member.svg", /E-LAYOUT-COUNT group "row": declared 3 items, found 2/));
test("receipt --json에 geometric/visual inset·gap 수치가 모두 남는다", () => {
  const r = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const j = JSON.parse(r.out);
  const n = j.files[0].containers.find((c) => c.id === "n");
  assert.deepEqual(n.bindingInsets.geometric, { left: 24, right: 24, top: 24, bottom: 24 });
  assert.ok(n.bindingInsets.visual.left < 24);  // stroke/2 + shadow 보수범위 반영
  const g = j.files[0].groups.find((x) => x.id === "row");
  assert.deepEqual(g.gaps.geometric.map(Math.round), [24, 24]);
  assert.deepEqual(g.gaps.visual.map(Math.round), [5, 5]);
  assert.ok(g.outerInsets.start === g.outerInsets.end);
});
test("single-quoted annotation은 double-quote와 동등하게 참여한다 (silent-bypass 금지)", () => {
  const rd = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const rs = run([path.join(FIX, "lp-positive-squote.svg"), "--json"]);
  assert.equal(rs.code, 0, rs.out);
  const jd = JSON.parse(rd.out).files[0], js = JSON.parse(rs.out).files[0];
  assert.equal(js.containers.length, jd.containers.length);
  assert.deepEqual(js.containers.map((c) => c.bindingInsets), jd.containers.map((c) => c.bindingInsets));
});
test("F4 invalid number는 NaN silent-pass가 아니라 schema error", () => neg("ln-bad-minpad.svg", /E-LAYOUT-SCHEMA .*data-min-pad.*finite non-negative/));
test("F4 count 누락은 error (completeness 증명 필수)", () => neg("ln-missing-count.svg", /E-LAYOUT-SCHEMA .*missing required "data-layout-count"/));
test("F4 duplicate container id 거부", () => neg("ln-dup-id.svg", /E-LAYOUT-SCHEMA container "p": duplicate container id/));
test("F4 axis enum 검증", () => neg("ln-bad-axis.svg", /E-LAYOUT-SCHEMA .*data-axis must be x\|y/));
test("F4 미지원 distribution silent-accept 금지", () => neg("ln-bad-distribution.svg", /E-LAYOUT-SCHEMA .*data-distribution must be "equal-gap"/));
test("F5 title reservation과 카드 visual bounds 충돌 검출", () => neg("ln-title-collision.svg", /E-LAYOUT-RESERVE .*enters the title reservation/));
test("F1 이동한 frame이 icon circle을 두고 가면 error", () => neg("ln-cluster-misplaced.svg", /E-LAYOUT-CLUSTER .*component <circle>.*outside the item frame/));
test("F1 cluster 구성요소 누락 fail-closed", () => neg("ln-cluster-missing.svg", /E-LAYOUT-COUNT cluster "card": declared 3 components, found 2/));
test("data-layout-unverified는 exit 3 (명시적 검토 상태, 성공 아님)", () => {
  const p = path.join(FIX, "ln-transform.svg");
  const src = fs.readFileSync(p, "utf8");
  const tmp = path.join(FIX, "temp-unverified-fixture.svg");
  fs.writeFileSync(tmp, src.replace('data-layout-parent="p" ', 'data-layout-parent="p" data-layout-unverified="rotated badge — manual review" '));
  const r = run([tmp]);
  fs.unlinkSync(tmp);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /explicit review state, not a pass/);
});
