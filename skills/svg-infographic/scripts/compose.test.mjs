// compose.mjs 계약 테스트 — negative 실효성 + receipt 조작 방지 (composition CP1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "compose-fixtures");
const M = ["--manifest", path.join(FIX, "manifest.yaml")];
const run = (args) => {
  const r = spawnSync(process.execPath, [path.join(here, "compose.mjs"), ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};
// 공용 산출물: 대표 fixture를 tmp에 compose
const td = fs.mkdtempSync(path.join(os.tmpdir(), "compose-t-"));
const OUT = path.join(td, "c.svg"), RCP = path.join(td, "c.json");
const built = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", OUT, "--receipt", RCP]);

test("대표 fixture: plan-compose-verify 전 경로 통과", () => {
  assert.equal(built.code, 0, built.out);
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});
test("plan: primary 1 + supporting 1~2 한도 초과 거부", () => {
  const r = run(["plan", path.join(FIX, "plan-too-many.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /supporting instances must be 1\.\.2/);
});
test("plan: 중복 instance_id 거부", () => {
  const r = run(["plan", path.join(FIX, "plan-dup-instance.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate instance_id/);
});
test("plan: 비composable typepack 거부 (nested 포함 경로)", () => {
  const r = run(["plan", path.join(FIX, "plan-not-composable.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /is not composable/);
});
test("compose: 존재하지 않는 실제 port 참조는 실패", () => {
  const r = run(["compose", path.join(FIX, "plan-bad-port.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "x.svg"), "--receipt", path.join(td, "x.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /missing actual port/);
});
test("compose: 어떤 variant도 slot에 맞지 않으면 needs-split non-success", () => {
  const r = run(["compose", path.join(FIX, "plan-needs-split.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "y.svg"), "--receipt", path.join(td, "y.json")]);
  assert.equal(r.code, 3);
  assert.match(r.out, /needs-split/);
  assert.match(r.out, /splitting into a separate page/);
});
test("micro: 호환 port 2개를 실제 connector 1개로 연결 (positive routing)", () => {
  const o = path.join(td, "m.svg"), rc = path.join(td, "m.json");
  const r = run(["compose", path.join(FIX, "plan-connector-micro.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  assert.match(fs.readFileSync(o, "utf8"), /marker-end="url\(#comp-ah\)"/);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-connector-micro.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});
test("verify: receipt usedBounds 조작은 재측정으로 거부 (receipt 조작 방지)", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances[0].usedBounds.h -= 40;   // "슬롯에 맞는 것처럼" 축소 조작
  const bad = path.join(td, "bad1.json");
  fs.writeFileSync(bad, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", bad, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-RECEIPT .*receipts must reflect the artifact/);
});
test("verify: 선언 instance가 composite에서 빠지면 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  const cut = svg.replace(/<g data-comp-instance="tree-1"[\s\S]*$/, "</svg>");
  const p = path.join(td, "bad2.svg");
  fs.writeFileSync(p, cut);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-MISSING instance "tree-1"/);
});
test("verify: DOM 순서가 선언 reading_order와 다르면 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  // 두 instance group 블록을 통째로 교환
  const mA = svg.match(/<g data-comp-instance="cards-1"[\s\S]*?(?=<g data-comp-instance="tree-1")/);
  const mB = svg.match(/<g data-comp-instance="tree-1"[\s\S]*?(?=<\/svg>)/);
  const swapped = svg.replace(mA[0], "__A__").replace(mB[0], "__B__").replace("__A__", mB[0]).replace("__B__", mA[0]);
  const p = path.join(td, "bad3.svg");
  fs.writeFileSync(p, swapped);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-ORDER/);
});
test("verify: fragment 간 duplicate SVG id 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("</svg>", '<rect id="comp-dup" width="1" height="1" fill="#FFFFFF"/><rect id="comp-dup" width="1" height="1" fill="#FFFFFF"/></svg>');
  const p = path.join(td, "bad4.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-DUPID/);
});
test("verify: module identity digest 불일치 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances[1].identity.typographyProfileDigest = "cfx-typo-9999";
  const p = path.join(td, "bad5.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-IDENTITY/);
});
test("verify: instance transform은 translation-only만 허용", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/, 'transform="translate($1,$2) scale(0.9)"');
  const p = path.join(td, "bad6.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-TRANSFORM/);
});
test("verify: H1 단일성 page budget gate", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("</svg>", '<text font-size="30" x="40" y="880" fill="#252B35">second h1</text></svg>');
  const p = path.join(td, "bad7.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-H1/);
});
