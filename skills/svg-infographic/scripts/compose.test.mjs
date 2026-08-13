// compose.mjs 계약 테스트 — negative 실효성 + receipt 조작 방지 (composition CP1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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
  const sp = path.join(fd, "tree.spacious.svg");   // 최대-채움 정책으로 선택되는 variant를 변조
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

// ---- CP1 geometry correction 재현(R2) ----
test("R2-1: fragment 내부 nested translate는 fail-closed", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<g data-comp-entity="cards-1-card-1">/, '<g data-comp-entity="cards-1-card-1" transform="translate(900,0)">');
  const p = path.join(td, "r21.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-UNVERIFIED-GEOM .*transform .*fail-closed/);
});
test("R2-2a: composite text를 긴 문자열로 교체하면 content digest로 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(">핵심 1<", ">이 텍스트는 측정 이후에 몰래 바뀐 매우 매우 매우 매우 매우 매우 긴 한국어 문자열입니다 overflowing far beyond the page<");
  const p = path.join(td, "r22a.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text was altered after measurement/);
});
test("R2-2b: 긴 KO/EN 텍스트 fragment는 정직한 browser 측정으로 spill이 잡힌다 (browser)", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "summary-cards.svg");
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8").replace(">핵심 1<", ">이 카드 제목은 슬롯 오른쪽 경계를 한참 넘어가는 매우 긴 한국어와 English mixed 문자열입니다 and it keeps going<"));
  // 정직 재측정: measure-text로 textBounds·digest·sourceDigest 갱신
  const mt = spawnSync(process.execPath, [path.join(here, "measure-text.mjs"), sp], { encoding: "utf8", timeout: 60000 });
  assert.equal(mt.status, 0, mt.stdout + mt.stderr);
  const tm = JSON.parse(mt.stdout);
  const rcpP = path.join(fd, "summary-cards.receipt.json");
  const rcp = JSON.parse(fs.readFileSync(rcpP, "utf8"));
  const frag = fs.readFileSync(sp, "utf8");
  const crypto = require("node:crypto");
  const sha16 = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
  rcp.textBounds = tm.texts.map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h }));
  rcp.sourceDigest = sha16(frag);
  rcp.textMeasure = { method: "browser-getBBox", inputDigest: sha16(frag), texts: tm.texts.length };
  // textDigest·usedBounds도 정직 갱신
  const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
  const texts = [...body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  rcp.textDigest = sha16(texts.join("\u0001"));
  const maxX = Math.max(...rcp.textBounds.map((b) => b.x + b.w), rcp.usedBounds.x + rcp.usedBounds.w);
  rcp.usedBounds.w = maxX - rcp.usedBounds.x;
  fs.writeFileSync(rcpP, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r22b.svg"), "--receipt", path.join(td, "r22b.json")]);
  assert.notEqual(r.code, 0, r.out);   // 폭 초과 → needs-split(3) — 어느 쪽이든 non-zero
  assert.match(r.out, /needs-split|invalid/);
});
test("R2-3: 정상 KO text fragment는 evidence와 함께 통과", () => {
  // KO 대표 fixture — browser rebind 포함 verify
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});
test("R2-4: text-measure inputDigest가 fragment와 다르면 stale evidence로 거부", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const rcpP = path.join(fd, "tree.spacious.receipt.json");   // 최대-채움 정책이 선택하는 variant
  const rcp = JSON.parse(fs.readFileSync(rcpP, "utf8"));
  rcp.textMeasure.inputDigest = "beefbeefbeefbeef";
  fs.writeFileSync(rcpP, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r24.svg"), "--receipt", path.join(td, "r24.json")]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /stale text evidence/);
});

// ---- 최종 text-geometry binding 재현(R3) ----
test("R3-1: 내용 동일 + x=900 이동은 markup digest로 거부(정적 계층 단독)", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<text x="14" y="62"/, '<text x="900" y="62"');
  const p = path.join(td, "r31.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text markup digest mismatch/);
});
test("R3-2: 내용 동일 + font-size 확대는 markup digest로 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace('font-size="16"', 'font-size="34"');
  const p = path.join(td, "r32.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text markup digest mismatch/);
});
test("R3-3: tspan dx/dy 주입은 markup digest로 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(">핵심 1<", '><tspan dx="500">핵심 1</tspan><');
  const p = path.join(td, "r33.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT/);
});
test("R3-4: 상속 typography 변경(상위 g style)은 browser 재측정으로 거부", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<g data-comp-entity="cards-1-card-1">/, '<g data-comp-entity="cards-1-card-1" style="letter-spacing:8px">');
  const p = path.join(td, "r34.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-TEXT-RUNTIME .*drift beyond tolerance/);
});
test("R3-5: 정상 EN composite는 browser rebind 포함 전 경로 통과", () => {
  const o = path.join(td, "en.svg"), rc = path.join(td, "en.json");
  const r = run(["compose", path.join(FIX, "plan-cards-tree-en.yaml"), "--fragments", path.join(FIX, "fragments-en"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-cards-tree-en.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});

// ---- fail-closed 보정 재현(R4) ----
test("R4-1: textMarkupDigest 삭제 + x=900은 nested schema로 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  delete rcp.instances[0].textMarkupDigest;
  const rp = path.join(td, "r41.json");
  fs.writeFileSync(rp, JSON.stringify(rcp));
  const svg = fs.readFileSync(OUT, "utf8").replace(/<text x="14" y="62"/, '<text x="900" y="62"');
  const sp = path.join(td, "r41.svg");
  fs.writeFileSync(sp, svg);
  const r = run(["verify", sp, "--receipt", rp, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-SCHEMA instance "cards-1" missing field "textMarkupDigest"/);
});
test("R4-2: --no-browser는 clean artifact에서도 bounded non-success(exit 3)", () => {
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /static-only .*bounded, not acceptance-grade/);
});
test("R4-3: 기본 verify에서 browser 불가면 hard failure(exit 1)", () => {
  const r0 = spawnSync(process.execPath, [path.join(here, "compose.mjs"), "verify", OUT,
    "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M],
    { encoding: "utf8", env: { ...process.env, COMPOSE_TEXT_MEASURE_CLI: path.join(td, "no-such-cli.mjs") } });
  assert.equal(r0.status, 1, r0.stdout + r0.stderr);
  assert.match(r0.stdout, /E-COMP-TEXT-RUNTIME browser text re-measure unavailable/);
});
test("R4-4: 기본 verify + browser 측정은 완전 성공(exit 0)", () => {
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});

// ---- text-free fragment 계약(P2, release-blocking) ----
test("P2-1: icon-only fragment는 null 조합 receipt로 전 경로 통과", () => {
  const o = path.join(td, "ib.svg"), rc = path.join(td, "ib.json");
  const r = run(["compose", path.join(FIX, "plan-cards-iconband.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-cards-iconband.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});
test("P2-2: text-free fragment가 null 아닌 text evidence를 실으면 거부", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const rp = path.join(fd, "icon-band.receipt.json");
  const rcp = JSON.parse(fs.readFileSync(rp, "utf8"));
  rcp.textDigest = "deadbeefdeadbeef";
  fs.writeFileSync(rp, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-iconband.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "p22.svg"), "--receipt", path.join(td, "p22.json")]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /text-free fragment must record textDigest: null/);
});

// ---- residual-space 계약(R5) ----
test("R5-1: rhythm band 안 최대-채움 variant 자동 선택(spacious)과 residual receipt", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  const tree = rcp.instances.find((i) => i.instance_id === "tree-1");
  assert.equal(tree.variant, "spacious");
  assert.ok(rcp.contentFlowBounds && rcp.residual);
  assert.ok(Math.abs(rcp.residual.bottom - 143) <= 2, JSON.stringify(rcp.residual));
});
// ---- visual-rhythm band 계약(P1B) ----
test("P1B-1: connector run이 band를 벗어난 variant는 자동 선택 자격이 없다", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "tree.spacious.svg");
  // drop run 96 -> 152 (base와 receipt는 그대로) — band 56..108 위반이라 base로 후퇴하고,
  // base의 residual은 선언값과 어긋나므로 정직하게 non-success가 된다
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8").replaceAll(" 168 V264", " 168 V320"));
  const rc = path.join(td, "p1b1.json");
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "p1b1.svg"), "--receipt", rc]);
  assert.equal(r.code, 1, r.out);
  const rcp = JSON.parse(fs.readFileSync(rc, "utf8"));
  assert.equal(rcp.instances.find((i) => i.instance_id === "tree-1").variant, "base");
  assert.match(r.out, /residual_disposition\.bottom 143px != measured/);
});
test("P1B-2: 최종 SVG의 connector 신장은 verify 재측정으로 거부(E-COMP-RHYTHM)", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("V264", "V320");
  const p = path.join(td, "p1b2.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RHYTHM .*connector run 152px outside declared band 56\.\.108/);
});
test("R5-2: 선언 없는 page bottom residual은 non-success", () => {
  const r = run(["compose", path.join(FIX, "plan-residual-undeclared.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r52.svg"), "--receipt", path.join(td, "r52.json")]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /residual .*undeclared/);
});
test("R5-3: forged contentFlowBounds/residual은 재계산으로 거부", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.residual = { top: 0, bottom: 0 };
  const p = path.join(td, "r53.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-FORGED receipt residual/);
});

// ---- marker-label-row primitive(P2) ----
test("P2-3: compose header locator는 eyebrow line center에 정렬(52/56)", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  assert.match(svg, /cluster-locator[^>]*y="52"/);
});

// ---- title-keyline header treatment(P3) ----
const mkPlan = (name, mut) => {
  const src = fs.readFileSync(path.join(FIX, "plan-cards-tree.yaml"), "utf8");
  const p = path.join(td, name);
  fs.writeFileSync(p, mut(src));
  return p;
};
test("P3-1: title-keyline은 H1 line-box에서 파생되고 locator를 대체한다 (browser verify)", () => {
  const p = mkPlan("k2-1.yaml", (s2) => s2.replace("header:\n", "header:\n  style: title-keyline\n"));
  const o = path.join(td, "k2-1.svg"), rc = path.join(td, "k2-1.json");
  const r = run(["compose", p, "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const svg = fs.readFileSync(o, "utf8");
  // pageframe headerScale 파생: width 4, gap 12(x=24), pad 7(y=71, h=42)
  assert.match(svg, /cluster-keyline[^>]*x="24" y="71" width="4" height="42"/);
  assert.doesNotMatch(svg, /cluster-locator/);
  assert.match(svg, /cluster-eyebrow[^>]*x="40"/);
  const v = run(["verify", o, "--receipt", rc, "--plan", p, ...M]);
  assert.equal(v.code, 0, v.out);
});
test("P3-2: 2줄 H1 — keyline이 두 line-box를 덮고 slot 예산은 pageframe --h1-lines 2와 일치", () => {
  const p = mkPlan("k2-2.yaml", (s2) => s2
    .replace("header:\n", "header:\n  style: title-keyline\n")
    .replace('h1: "핵심 4가지와 전체 구조"', 'h1:\n    - "핵심 4가지 요약과"\n    - "전체 구조의 대응 관계"')
    .replace("slot-b: { height: 528 }", "slot-b: { height: 494 }")
    .replace("bottom: 143", "bottom: 109"));
  const o = path.join(td, "k2-2.svg"), rc = path.join(td, "k2-2.json");
  const r = run(["compose", p, "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const svg = fs.readFileSync(o, "utf8");
  assert.match(svg, /cluster-keyline[^>]*x="24" y="71" width="4" height="76"/);
  assert.equal([...svg.matchAll(/<tspan x="40"/g)].length, 2);
  const rcp = JSON.parse(fs.readFileSync(rc, "utf8"));
  assert.equal(rcp.resolvedSlots["slot-a"].y, 188);
});
test("P3-3: 2줄 초과 h1과 미지정 header style은 plan에서 거부", () => {
  const p3 = mkPlan("k2-bad.yaml", (s2) => s2.replace('h1: "핵심 4가지와 전체 구조"', 'h1:\n    - "one"\n    - "two"\n    - "three"'));
  const r = run(["plan", p3, ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /header\.h1 as a list must hold 1\.\.2/);
  const p4 = mkPlan("k2-bad2.yaml", (s2) => s2.replace("header:\n", "header:\n  style: fancy-rail\n"));
  const r2 = run(["plan", p4, ...M]);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /header\.style must be locator\|title-keyline/);
});
