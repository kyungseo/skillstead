// check-layout.mjs contract tests — 1 positive + 10 negative (design-kernel §8)
import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "layout-fixtures");
// A derived fixture is written **outside** the package tree. Written next to its source it would
// appear and vanish inside a directory other suites walk while they run — check-language reads this
// same tree in parallel, and a file that disappears between readdir and stat crashed it. The
// directory is unique per call so parallel runs never share one, and the cleanup is in `finally`
// so a failing assertion still leaves the tree as it found it.
function withDerived(name, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-layout-"));
  try { return body(path.join(dir, name)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
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

test("positive: balanced insets + equal-gap row + two levels of nesting + shadow clearance", () => {
  const r = run([path.join(FIX, "lp-positive.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("1 contact: child edge touches parent edge", () => neg("ln-touch.svg", /E-LAYOUT-TOUCH/));
test("2 below min padding", () => neg("ln-minpad.svg", /E-LAYOUT-PAD .*left inset 4px < declared min padding 24px/));
test("3 the shadow intrudes on the visual clearance floor", () => neg("ln-shadow.svg", /E-LAYOUT-VISPAD .*bottom clearance/));
test("4 only the right inset is narrow (x symmetry)", () => neg("ln-sym-x.svg", /E-LAYOUT-SYM container "p": geometric left\/right insets differ by 24px/));
test("5 asymmetric bottom inset on a nested container (y symmetry)", () => neg("ln-nested-bottom.svg", /E-LAYOUT-SYM container "n": geometric top\/bottom insets differ/));
test("6 moving card 3 alone exceeds the gap spread", () => neg("ln-gap-drift.svg", /E-LAYOUT-GAP group "row": visual gap spread 12px .*reflow the whole group/));
test("7 the outer inset relation breaks down", () => neg("ln-outer-inset.svg", /E-LAYOUT-OUTER group "row": outer insets 20px vs 56px/));
test("8 the nested container itself intrudes on the parent padding", () => neg("ln-nested-intrude.svg", /E-LAYOUT-PAD container "p"\/n: top inset 8px < declared min padding 24px/));
test("9 an unsupported transform must not silently pass", () => neg("ln-transform.svg", /E-LAYOUT-UNVERIFIED p: declared participant <rect> has a non-translate transform/));
test("10 a declared count that disagrees with the annotated members fails closed", () => neg("ln-missing-member.svg", /E-LAYOUT-COUNT group "row": declared 3 items, found 2/));
test("receipt --json records both the geometric and the visual inset and gap numbers", () => {
  const r = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const j = JSON.parse(r.out);
  const n = j.files[0].containers.find((c) => c.id === "n");
  assert.deepEqual(n.bindingInsets.geometric, { left: 24, right: 24, top: 24, bottom: 24 });
  assert.ok(n.bindingInsets.visual.left < 24);  // reflects stroke/2 plus the conservative shadow range
  const g = j.files[0].groups.find((x) => x.id === "row");
  assert.deepEqual(g.gaps.geometric.map(Math.round), [24, 24]);
  assert.deepEqual(g.gaps.visual.map(Math.round), [5, 5]);
  assert.ok(g.outerInsets.start === g.outerInsets.end);
});
test("a single-quoted annotation participates just like a double-quoted one (no silent bypass)", () => {
  const rd = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const rs = run([path.join(FIX, "lp-positive-squote.svg"), "--json"]);
  assert.equal(rs.code, 0, rs.out);
  const jd = JSON.parse(rd.out).files[0], js = JSON.parse(rs.out).files[0];
  assert.equal(js.containers.length, jd.containers.length);
  assert.deepEqual(js.containers.map((c) => c.bindingInsets), jd.containers.map((c) => c.bindingInsets));
});
test("F4 an invalid number is a schema error, not a silent NaN pass", () => neg("ln-bad-minpad.svg", /E-LAYOUT-SCHEMA .*data-min-pad.*finite non-negative/));
test("F4 a missing count is an error (completeness must be proven)", () => neg("ln-missing-count.svg", /E-LAYOUT-SCHEMA .*missing required "data-layout-count"/));
test("F4 a duplicate container id is refused", () => neg("ln-dup-id.svg", /E-LAYOUT-SCHEMA container "p": duplicate container id/));
test("F4 the axis enum is verified", () => neg("ln-bad-axis.svg", /E-LAYOUT-SCHEMA .*data-axis must be x\|y/));
test("F4 an unsupported distribution must not be silently accepted", () => neg("ln-bad-distribution.svg", /E-LAYOUT-SCHEMA .*data-distribution must be "equal-gap"/));
test("F5 a collision between the title reservation and a card's visual bounds is detected", () => neg("ln-title-collision.svg", /E-LAYOUT-RESERVE .*enters the title reservation/));
test("F1 a moved frame that leaves its icon circle behind is an error", () => neg("ln-cluster-misplaced.svg", /E-LAYOUT-CLUSTER .*component <circle>.*outside the item frame/));
test("F1 a missing cluster component fails closed", () => neg("ln-cluster-missing.svg", /E-LAYOUT-COUNT cluster "card": declared 3 components, found 2/));
test("P1-3 spaced-equals and quote combinations participate just the same (closing the detection bypass)", () => {
  const rd = run([path.join(FIX, "lp-positive.svg"), "--json"]);
  const rs = run([path.join(FIX, "lp-positive-spaced.svg"), "--json"]);
  assert.equal(rs.code, 0, rs.out);
  const jd = JSON.parse(rd.out).files[0], js = JSON.parse(rs.out).files[0];
  assert.equal(js.containers.length, jd.containers.length);
  assert.deepEqual(js.containers.map((c) => c.bindingInsets), jd.containers.map((c) => c.bindingInsets));
});
test("P1-3 a defect in a spaced-equals annotation is still detected (no downgrade to treating it as unannotated)", () => {
  const src = fs.readFileSync(path.join(FIX, "ln-gap-drift.svg"), "utf8");
  const r = withDerived("spaced-neg.svg", (tmp) => {
    fs.writeFileSync(tmp, src.replace(/(data-[a-z-]+)="([^"]*)"/g, "$1 = \"$2\""));
    return run([tmp]);
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-LAYOUT-GAP/);
});
test("P1-4 small drift: moving the frame alone and leaving the components behind is a binding error", () => neg("ln-cluster-drift.svg", /E-LAYOUT-BINDING .*drifted from its declared offset/));
test("P1-4 an undeclared data-cluster-at is a schema error (containment alone cannot claim atomicity)", () => {
  const src = fs.readFileSync(path.join(FIX, "ln-cluster-drift.svg"), "utf8");
  const r = withDerived("noat.svg", (tmp) => {
    fs.writeFileSync(tmp, src.replace(/ data-cluster-at="[^"]*"/g, ""));
    return run([tmp]);
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /missing data-cluster-at/);
});
test("P1-2 a title overflowing its reservation is an error", () => neg("ln-title-overflow.svg", /E-LAYOUT-RESERVE .*title visual bottom .*overflows the reservation/));
test("P1-2 a measured title-to-content gap below the floor is an error", () => neg("ln-title-gap.svg", /E-LAYOUT-TITLE-GAP .*measured title→content visual gap/));
test("P1-2 titled mode with no title participant is an error", () => neg("ln-title-zero.svg", /E-LAYOUT-SCHEMA .*titled mode .*no data-layout-title participant/));
test("P1-2 a duplicate title participant is an error", () => neg("ln-title-dup.svg", /E-LAYOUT-SCHEMA .*2 data-layout-title participants/));
test("P1-2 a title referencing an undeclared container is an error", () => neg("ln-title-orphan.svg", /E-LAYOUT-SCHEMA title participant references undeclared container "ghost"/));
test("P1-3 declaring y-symmetry on a titled container is refused as a contradiction", () => neg("ln-titled-ysym.svg", /E-LAYOUT-SCHEMA .*y-symmetry is not applicable to a titled container/));
test("P1-3 a top inset below the floor against the contentBox is an error", () => neg("ln-content-pad.svg", /E-LAYOUT-PAD .*contentBox-adjusted top inset .*< declared data-content-pad-top/));
test("P2 an unknown CLI option exits 2", () => {
  const r = run(["--mdoe", path.join(FIX, "lp-positive.svg")]);
  assert.equal(r.code, 2);
  assert.match(r.out, /unknown option for check-layout/);
});
test("data-layout-unverified exits 3 (an explicit review state, not a success)", () => {
  const p = path.join(FIX, "ln-transform.svg");
  const src = fs.readFileSync(p, "utf8");
  const r = withDerived("unverified-fixture.svg", (tmp) => {
    fs.writeFileSync(tmp, src.replace('data-layout-parent="p" ', 'data-layout-parent="p" data-layout-unverified="rotated badge — manual review" '));
    return run([tmp]);
  });
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /explicit review state, not a pass/);
});

// --- horizontal reservation (data-reserve-left) — the axis mirror of vertical reservation ----
test("positive: reserving a label column makes symmetry judged against the reservation boundary", () => {
  const r = run([path.join(FIX, "lp-reserve-left.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("12 a child entering the reserved label column is refused", () =>
  neg("ln-reserve-left-breach.svg", /E-LAYOUT-RESERVE container "band"/));

// --- alignment grid: alignment plus **participation completeness** --------------------------
test("positive: a mirrored row and a grid column satisfy both alignment and participant count", () => {
  const r = run([path.join(FIX, "lp-align-grid.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("13 one side of a mirrored row is missing its annotation", () =>
  neg("ln-align-missing-mirror.svg", /E-LAYOUT-ALIGN-SCHEMA row "slot-1": declared 2 participant\(s\) but found 1/));
test("14 one grid cell is missing its align annotation", () =>
  neg("ln-align-missing-cell.svg", /E-LAYOUT-ALIGN-SCHEMA col "col-b": declared 2 participant\(s\) but found 1/));
test("15 y drift within the same row", () =>
  neg("ln-align-row-drift.svg", /E-LAYOUT-ALIGN row "slot-1": top edges differ by 6px/));
test("16 width drift within the same column", () =>
  neg("ln-align-col-drift.svg", /E-LAYOUT-ALIGN col "col-a": widths differ by 20px/));
test("17 a conflicting (forged) participant-count declaration", () =>
  neg("ln-align-count-forged.svg", /E-LAYOUT-ALIGN-SCHEMA row "slot-1": participants disagree/));
test("18 a singleton alignment group does not pass", () =>
  neg("ln-align-singleton.svg", /E-LAYOUT-ALIGN-SCHEMA row "lonely": data-align-row-count must be an integer ≥ 2/));

// --- alignment inventory: a whole group missing, or an unexpected group ---------------------
test("19 removing the annotation from both sides of a mirrored row is still caught by the inventory", () =>
  neg("ln-align-inventory-group-gone.svg", /alignment group "row:slot-2" is declared in the inventory but no participant carries it/));
test("20 a whole grid row group removed", () =>
  neg("ln-align-inventory-row-gone.svg", /alignment group "row:matrix-r1" is declared in the inventory but no participant carries it/));
test("21 a whole grid column group removed", () =>
  neg("ln-align-inventory-col-gone.svg", /alignment group "col:matrix-c1" is declared in the inventory but no participant carries it/));
test("22 a group added that is not in the inventory", () =>
  neg("ln-align-inventory-unexpected.svg", /alignment group "row:slot-9" exists in the artifact but is absent from the inventory/));
