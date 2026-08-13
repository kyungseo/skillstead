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

// ---- CP1 중간 리뷰 요구 재현(R1) ----
test("R1-1a: forged planDigest는 재계산 대조로 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.planDigest = "0000000000000000";
  const p = path.join(td, "r1a.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-FORGED receipt planDigest/);
});
test("R1-1b: 전 instance에 동일한 가짜 digest를 넣어도 live 대조로 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  for (const i of rcp.instances) i.identity.typographyProfileDigest = "feedfeedfeedfeed";
  const p = path.join(td, "r1b.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-LIVE .*typographyProfileDigest .*!= live registry/);
});
test("R1-2a: receipt에서 instance 행 삭제는 plan 대조로 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances = rcp.instances.slice(0, 1);
  const p = path.join(td, "r2a.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-MISSING receipt drops instance/);
});
test("R1-2b: receipt status/problems가 clean이 아니면 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.problems = ["smuggled"];
  const p = path.join(td, "r2b.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-STATUS/);
});
test("R1-3: ghost semantic entity는 compose에서 거부", () => {
  const r = run(["compose", path.join(FIX, "plan-ghost-entity.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r3.svg"), "--receipt", path.join(td, "r3.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /ghost endpoint/);
});
test("R1-3b: 선언된 binding 완전성에서 한 쌍이 빠지면 거부", () => {
  const r = run(["compose", path.join(FIX, "plan-missing-binding.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r3b.svg"), "--receipt", path.join(td, "r3b.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /binding coverage: .*is not bound/);
});
test("R1-4a: slot 밖으로 뻗는 path는 재측정으로 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace('<g data-comp-instance="tree-1"', '<g data-comp-instance="tree-1"').replace(/(<g data-comp-instance="tree-1"[^>]*>)/, '$1<path d="M10 10 L900 900" stroke="#B45A50" stroke-width="8" fill="none"/>');
  const p = path.join(td, "r4a.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-RECEIPT|E-COMP-BOUNDS/);
});
test("R1-4b: 미지원 geometry(곡선)는 silent 제외가 아니라 명시 실패", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/(<g data-comp-instance="tree-1"[^>]*>)/, '$1<path d="M10 10 C 40 40 60 60 90 90" stroke="#636A75" fill="none"/>');
  const p = path.join(td, "r4b.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-UNVERIFIED-GEOM/);
});
test("R1-5a: 미선언 capability template의 actual port는 거부", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const rp = path.join(fd, "summary-cards.receipt.json");
  const rcp = JSON.parse(fs.readFileSync(rp, "utf8"));
  rcp.ports[0].template = "ghost-template";
  fs.writeFileSync(rp, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r5a.svg"), "--receipt", path.join(td, "r5a.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /undeclared capability template/);
});
test("R1-5b: capability cardinality(정확히 4) 위반은 거부", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const rp = path.join(fd, "summary-cards.receipt.json");
  const rcp = JSON.parse(fs.readFileSync(rp, "utf8"));
  rcp.ports = rcp.ports.slice(0, 3);
  fs.writeFileSync(rp, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r5b.svg"), "--receipt", path.join(td, "r5b.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /cardinality is "4"/);
});
test("R1-5c: fragment sourceDigest mismatch(stale receipt)는 거부", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "tree.svg");
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8") + "<!-- mutated -->");
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r5c.svg"), "--receipt", path.join(td, "r5c.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /sourceDigest mismatch/);
});

// ---- namespace adversarial (R1-P5) ----
test("R1-6: single quote·spaced·xlink·복수 ARIA namespace rewrite + dangling 검사", async () => {
  const { namespaceBody, checkRefs } = await import("./compose.mjs");
  const adv = `<defs><clipPath id = 'clip-x'><rect width="10" height="10"/></clipPath></defs>
<g clip-path="url(#clip-x)"><rect id='r-one' width="5" height="5" fill="#FFFFFF"/>
<use xlink:href='#r-one'/><text aria-labelledby='r-one clip-x' x="1" y="1">t</text></g>`;
  const out = namespaceBody(adv, "inst1");
  assert.match(out, /id="inst1-clip-x"/);
  assert.match(out, /url\(#inst1-clip-x\)/);
  assert.match(out, /xlink:href="#inst1-r-one"/);
  assert.match(out, /aria-labelledby="inst1-r-one inst1-clip-x"/);
  assert.equal(checkRefs(out).length, 0, JSON.stringify(checkRefs(out)));
  const dangling = checkRefs(out.replace(/<rect id="inst1-r-one"[^>]*\/>/, ""));
  assert.ok(dangling.some((e) => e.includes('dangling reference "#inst1-r-one"')), JSON.stringify(dangling));
});
