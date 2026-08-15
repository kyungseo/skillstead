// compose.mjs contract tests — whether the negatives bite, plus receipt-tamper resistance (composition CP1)
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
// Shared artifact: compose the representative fixture into tmp
const td = fs.mkdtempSync(path.join(os.tmpdir(), "compose-t-"));
const OUT = path.join(td, "c.svg"), RCP = path.join(td, "c.json");
const built = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", OUT, "--receipt", RCP]);

test("representative fixture: the whole plan-compose-verify path passes", () => {
  assert.equal(built.code, 0, built.out);
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});
test("plan: exceeding the limit of 1 primary plus 1-2 supporting is refused", () => {
  const r = run(["plan", path.join(FIX, "plan-too-many.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /supporting instances must be 1\.\.2/);
});
test("plan: a duplicate instance_id is refused", () => {
  const r = run(["plan", path.join(FIX, "plan-dup-instance.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate instance_id/);
});
test("plan: a non-composable typepack is refused (including on the nested path)", () => {
  const r = run(["plan", path.join(FIX, "plan-not-composable.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /is not composable/);
});
test("compose: referencing an actual port that does not exist fails", () => {
  const r = run(["compose", path.join(FIX, "plan-bad-port.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "x.svg"), "--receipt", path.join(td, "x.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /missing actual port/);
});
test("compose: when no variant fits the slot the result is a needs-split non-success", () => {
  const r = run(["compose", path.join(FIX, "plan-needs-split.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "y.svg"), "--receipt", path.join(td, "y.json")]);
  assert.equal(r.code, 3);
  assert.match(r.out, /needs-split/);
  assert.match(r.out, /splitting into a separate page/);
});
test("micro: two compatible ports joined by one real connector (positive routing)", () => {
  const o = path.join(td, "m.svg"), rc = path.join(td, "m.json");
  const r = run(["compose", path.join(FIX, "plan-connector-micro.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  assert.match(fs.readFileSync(o, "utf8"), /marker-end="url\(#comp-ah\)"/);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-connector-micro.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});
test("verify: tampering with receipt usedBounds is refused on re-measurement (receipt-tamper resistance)", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances[0].usedBounds.h -= 40;   // shrunk to look "as if it fits the slot"
  const bad = path.join(td, "bad1.json");
  fs.writeFileSync(bad, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", bad, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-RECEIPT .*receipts must reflect the artifact/);
});
test("verify: a declared instance missing from the composite is refused", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  const cut = svg.replace(/<g data-comp-instance="tree-1"[\s\S]*$/, "</svg>");
  const p = path.join(td, "bad2.svg");
  fs.writeFileSync(p, cut);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-MISSING instance "tree-1"/);
});
test("verify: a DOM order differing from the declared reading_order is refused", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  // swap the two instance group blocks wholesale
  const mA = svg.match(/<g data-comp-instance="cards-1"[\s\S]*?(?=<g data-comp-instance="tree-1")/);
  const mB = svg.match(/<g data-comp-instance="tree-1"[\s\S]*?(?=<\/svg>)/);
  const swapped = svg.replace(mA[0], "__A__").replace(mB[0], "__B__").replace("__A__", mB[0]).replace("__B__", mA[0]);
  const p = path.join(td, "bad3.svg");
  fs.writeFileSync(p, swapped);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-ORDER/);
});
test("verify: a duplicate SVG id across fragments is refused", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("</svg>", '<rect id="comp-dup" width="1" height="1" fill="#FFFFFF"/><rect id="comp-dup" width="1" height="1" fill="#FFFFFF"/></svg>');
  const p = path.join(td, "bad4.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-DUPID/);
});
test("verify: a module identity digest mismatch is refused", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances[1].identity.typographyProfileDigest = "cfx-typo-9999";
  const p = path.join(td, "bad5.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-IDENTITY/);
});
test("verify: an instance transform may be translation-only", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/, 'transform="translate($1,$2) scale(0.9)"');
  const p = path.join(td, "bad6.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-TRANSFORM/);
});
test("verify: the single-H1 page budget gate", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("</svg>", '<text font-size="30" x="40" y="880" fill="#252B35">second h1</text></svg>');
  const p = path.join(td, "bad7.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-H1/);
});

// ---- reproducing the CP1 interim review requirements (R1) ----
test("R1-1a: a forged planDigest is refused on recomputation", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.planDigest = "0000000000000000";
  const p = path.join(td, "r1a.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-FORGED receipt planDigest/);
});
test("R1-1b: putting the same fake digest on every instance is still refused against the live comparison", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  for (const i of rcp.instances) i.identity.typographyProfileDigest = "feedfeedfeedfeed";
  const p = path.join(td, "r1b.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-LIVE .*typographyProfileDigest .*!= live registry/);
});
test("R1-2a: deleting an instance row from the receipt is refused against the plan", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.instances = rcp.instances.slice(0, 1);
  const p = path.join(td, "r2a.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-MISSING receipt drops instance/);
});
test("R1-2b: a receipt whose status or problems are not clean is refused", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.problems = ["smuggled"];
  const p = path.join(td, "r2b.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-STATUS/);
});
test("R1-3: a ghost semantic entity is refused at compose", () => {
  const r = run(["compose", path.join(FIX, "plan-ghost-entity.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r3.svg"), "--receipt", path.join(td, "r3.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /ghost endpoint/);
});
test("R1-3b: one missing pair in the declared binding completeness is refused", () => {
  const r = run(["compose", path.join(FIX, "plan-missing-binding.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r3b.svg"), "--receipt", path.join(td, "r3b.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /binding coverage: .*is not bound/);
});
test("R1-4a: a path reaching outside the slot is refused on re-measurement", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace('<g data-comp-instance="tree-1"', '<g data-comp-instance="tree-1"').replace(/(<g data-comp-instance="tree-1"[^>]*>)/, '$1<path d="M10 10 L900 900" stroke="#B45A50" stroke-width="8" fill="none"/>');
  const p = path.join(td, "r4a.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-RECEIPT|E-COMP-BOUNDS/);
});
test("R1-4b: unsupported geometry (a curve) is an explicit failure, not a silent exclusion", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/(<g data-comp-instance="tree-1"[^>]*>)/, '$1<path d="M10 10 C 40 40 60 60 90 90" stroke="#636A75" fill="none"/>');
  const p = path.join(td, "r4b.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-UNVERIFIED-GEOM/);
});
test("R1-5a: an actual port from an undeclared capability template is refused", () => {
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
test("R1-5b: violating the capability cardinality (exactly 4) is refused", () => {
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
test("R1-5c: a fragment sourceDigest mismatch (a stale receipt) is refused", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "tree.spacious.svg");   // tamper with the variant the maximum-fill policy selects
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8") + "<!-- mutated -->");
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r5c.svg"), "--receipt", path.join(td, "r5c.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /sourceDigest mismatch/);
});

// ---- namespace adversarial (R1-P5) ----
test("R1-6: single-quote, spaced, xlink and multiple-ARIA namespace rewrites, plus the dangling check", async () => {
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

// ---- reproducing the CP1 geometry corrections (R2) ----
test("R2-1: a nested translate inside a fragment fails closed", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<g data-comp-entity="cards-1-card-1">/, '<g data-comp-entity="cards-1-card-1" transform="translate(900,0)">');
  const p = path.join(td, "r21.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-UNVERIFIED-GEOM .*transform .*fail-closed/);
});
test("R2-2a: replacing composite text with a long string is refused by the content digest", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/* lang-allow: ko-fixture */ ">핵심 1<", /* lang-allow: ko-fixture */ ">이 텍스트는 측정 이후에 몰래 바뀐 매우 매우 매우 매우 매우 매우 긴 한국어 문자열입니다 overflowing far beyond the page<");
  const p = path.join(td, "r22a.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text was altered after measurement/);
});
test("R2-2b: a long KO/EN text fragment has its spill caught by honest browser measurement (browser)", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "summary-cards.svg");
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8").replace(/* lang-allow: ko-fixture */ ">핵심 1<", /* lang-allow: ko-fixture */ ">이 카드 제목은 슬롯 오른쪽 경계를 한참 넘어가는 매우 긴 한국어와 English mixed 문자열입니다 and it keeps going<"));
  // honest re-measurement: refresh textBounds, digest and sourceDigest through measure-text
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
  // textDigest and usedBounds are refreshed honestly too
  const body = frag.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1];
  const texts = [...body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  rcp.textDigest = sha16(texts.join("\u0001"));
  const maxX = Math.max(...rcp.textBounds.map((b) => b.x + b.w), rcp.usedBounds.x + rcp.usedBounds.w);
  rcp.usedBounds.w = maxX - rcp.usedBounds.x;
  fs.writeFileSync(rcpP, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r22b.svg"), "--receipt", path.join(td, "r22b.json")]);
  assert.notEqual(r.code, 0, r.out);   // over width -> needs-split (3) — non-zero either way
  assert.match(r.out, /needs-split|invalid/);
});
test("R2-3: a sound KO text fragment passes together with its evidence", () => {
  // the representative KO fixture — verified including the browser rebind
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});
test("R2-4: a text-measure inputDigest differing from the fragment is refused as stale evidence", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const rcpP = path.join(fd, "tree.spacious.receipt.json");   // the variant the maximum-fill policy selects
  const rcp = JSON.parse(fs.readFileSync(rcpP, "utf8"));
  rcp.textMeasure.inputDigest = "beefbeefbeefbeef";
  fs.writeFileSync(rcpP, JSON.stringify(rcp));
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "r24.svg"), "--receipt", path.join(td, "r24.json")]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /stale text evidence/);
});

// ---- reproducing the final text-geometry binding (R3) ----
test("R3-1: same content moved to x=900 is refused by the markup digest (the static layer alone)", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<text x="14" y="62"/, '<text x="900" y="62"');
  const p = path.join(td, "r31.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text markup digest mismatch/);
});
test("R3-2: same content with an enlarged font-size is refused by the markup digest", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace('font-size="16"', 'font-size="34"');
  const p = path.join(td, "r32.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT .*text markup digest mismatch/);
});
test("R3-3: injecting tspan dx/dy is refused by the markup digest", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/* lang-allow: ko-fixture */ ">핵심 1<", /* lang-allow: ko-fixture */ '><tspan dx="500">핵심 1</tspan><');
  const p = path.join(td, "r33.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RECEIPT-TEXT/);
});
test("R3-4: changing inherited typography (an ancestor g style) is refused on browser re-measurement", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace(/<g data-comp-entity="cards-1-card-1">/, '<g data-comp-entity="cards-1-card-1" style="letter-spacing:8px">');
  const p = path.join(td, "r34.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-TEXT-RUNTIME .*drift beyond tolerance/);
});
test("R3-5: a sound EN composite passes the whole path including the browser rebind", () => {
  const o = path.join(td, "en.svg"), rc = path.join(td, "en.json");
  const r = run(["compose", path.join(FIX, "plan-cards-tree-en.yaml"), "--fragments", path.join(FIX, "fragments-en"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-cards-tree-en.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});

// ---- reproducing the fail-closed corrections (R4) ----
test("R4-1: deleting textMarkupDigest and moving to x=900 is refused by the nested schema", () => {
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
test("R4-2: --no-browser is a bounded non-success (exit 3) even on a clean artifact", () => {
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /static-only .*bounded, not acceptance-grade/);
});
test("R4-3: in the default verify, no browser is a hard failure (exit 1)", () => {
  // The absence of the measurer is reproduced by **breaking the measurer itself in a copy of the
  // package**, not by an env override — so that no injection switch sits on the production path
  // (CP0-R1-F2).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compose-pkg-"));
  const pkg = path.join(dir, "svg-infographic");
  assert.equal(spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" }).status, 0);
  fs.writeFileSync(path.join(pkg, "scripts", "measure-text.mjs"),
    'console.error("measure-text: browser unavailable in this environment");\nprocess.exit(6);\n');
  const env = { ...process.env };
  delete env.SVGINFO_EXPECTED_SKILL_ROOT; delete env.SVGINFO_EXECUTION_MODE;
  const r0 = spawnSync(process.execPath, [path.join(pkg, "scripts", "compose.mjs"), "verify", OUT,
    "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"),
    "--manifest", path.join(pkg, "scripts", "compose-fixtures", "manifest.yaml")],
    { encoding: "utf8", cwd: path.join(pkg, "scripts"), env });
  assert.equal(r0.status, 1, r0.stdout + r0.stderr);
  assert.match(r0.stdout, /E-COMP-TEXT-RUNTIME browser text re-measure unavailable/);
  fs.rmSync(dir, { recursive: true, force: true });
});
test("R4-4: the default verify plus browser measurement is a full success (exit 0)", () => {
  const r = run(["verify", OUT, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M]);
  assert.equal(r.code, 0, r.out);
});

// ---- the text-free fragment contract (P2, release-blocking) ----
test("P2-1: an icon-only fragment passes the whole path with an all-null receipt", () => {
  const o = path.join(td, "ib.svg"), rc = path.join(td, "ib.json");
  const r = run(["compose", path.join(FIX, "plan-cards-iconband.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const v = run(["verify", o, "--receipt", rc, "--plan", path.join(FIX, "plan-cards-iconband.yaml"), ...M]);
  assert.equal(v.code, 0, v.out);
});
test("P2-2: a text-free fragment carrying non-null text evidence is refused", () => {
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

// ---- the residual-space contract (R5) ----
test("R5-1: automatic selection of the maximum-fill variant within the rhythm band (spacious), and the residual receipt", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  const tree = rcp.instances.find((i) => i.instance_id === "tree-1");
  assert.equal(tree.variant, "spacious");
  assert.ok(rcp.contentFlowBounds && rcp.residual);
  assert.ok(Math.abs(rcp.residual.bottom - 143) <= 2, JSON.stringify(rcp.residual));
});
// ---- the visual-rhythm band contract (P1B) ----
test("P1B-1: a variant whose connector run leaves the band is not eligible for automatic selection", () => {
  const fd = fs.mkdtempSync(path.join(os.tmpdir(), "frag-"));
  for (const f of fs.readdirSync(path.join(FIX, "fragments"))) fs.copyFileSync(path.join(FIX, "fragments", f), path.join(fd, f));
  const sp = path.join(fd, "tree.spacious.svg");
  // drop run 96 -> 152 (base and receipt unchanged) — it violates the band 56..108 so it falls
  // back to base, and base's residual disagrees with the declared value, so it honestly becomes
  // a non-success
  fs.writeFileSync(sp, fs.readFileSync(sp, "utf8").replaceAll(" 168 V264", " 168 V320"));
  const rc = path.join(td, "p1b1.json");
  const r = run(["compose", path.join(FIX, "plan-cards-tree.yaml"), "--fragments", fd, ...M, "--out", path.join(td, "p1b1.svg"), "--receipt", rc]);
  assert.equal(r.code, 1, r.out);
  const rcp = JSON.parse(fs.readFileSync(rc, "utf8"));
  assert.equal(rcp.instances.find((i) => i.instance_id === "tree-1").variant, "base");
  assert.match(r.out, /residual_disposition\.bottom 143px != measured/);
});
test("P1B-2: stretching a connector in the final SVG is refused on verify re-measurement (E-COMP-RHYTHM)", () => {
  const svg = fs.readFileSync(OUT, "utf8").replace("V264", "V320");
  const p = path.join(td, "p1b2.svg");
  fs.writeFileSync(p, svg);
  const r = run(["verify", p, "--receipt", RCP, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /E-COMP-RHYTHM .*connector run 152px outside declared band 56\.\.108/);
});
test("R5-2: an undeclared page-bottom residual is a non-success", () => {
  const r = run(["compose", path.join(FIX, "plan-residual-undeclared.yaml"), "--fragments", path.join(FIX, "fragments"), ...M, "--out", path.join(td, "r52.svg"), "--receipt", path.join(td, "r52.json")]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /residual .*undeclared/);
});
test("R5-3: a forged contentFlowBounds or residual is refused on recomputation", () => {
  const rcp = JSON.parse(fs.readFileSync(RCP, "utf8"));
  rcp.residual = { top: 0, bottom: 0 };
  const p = path.join(td, "r53.json");
  fs.writeFileSync(p, JSON.stringify(rcp));
  const r = run(["verify", OUT, "--receipt", p, "--plan", path.join(FIX, "plan-cards-tree.yaml"), ...M, "--no-browser"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-COMP-FORGED receipt residual/);
});

// ---- the marker-label-row primitive (P2) plus the header default (settled in P3) ----
test("P2-3: the default is title-keyline; the locator variant follows the formula (52/56) when explicitly chosen", () => {
  const svg = fs.readFileSync(OUT, "utf8");
  assert.match(svg, /cluster-keyline/);
  assert.doesNotMatch(svg, /cluster-locator/);
  const p = mkPlan("k1-explicit.yaml", (s2) => s2.replace("header:\n", "header:\n  style: locator\n"));
  const o = path.join(td, "k1e.svg");
  const r = run(["compose", p, "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", path.join(td, "k1e.json")]);
  assert.equal(r.code, 0, r.out);
  const svg2 = fs.readFileSync(o, "utf8");
  assert.match(svg2, /cluster-locator[^>]*y="52"/);
  assert.doesNotMatch(svg2, /cluster-keyline/);
});

// ---- title-keyline header treatment(P3) ----
const mkPlan = (name, mut) => {
  const src = fs.readFileSync(path.join(FIX, "plan-cards-tree.yaml"), "utf8");
  const p = path.join(td, name);
  fs.writeFileSync(p, mut(src));
  return p;
};
test("P3-1: the canonical default (title-keyline) derives from the H1 line-box and replaces the locator (browser verify)", () => {
  const p = mkPlan("k2-1.yaml", (s2) => s2);
  const o = path.join(td, "k2-1.svg"), rc = path.join(td, "k2-1.json");
  const r = run(["compose", p, "--fragments", path.join(FIX, "fragments"), ...M, "--out", o, "--receipt", rc]);
  assert.equal(r.code, 0, r.out);
  const svg = fs.readFileSync(o, "utf8");
  // derived from the pageframe headerScale: width 4, gap 12 (x=24), pad 7 (y=71, h=42)
  assert.match(svg, /cluster-keyline[^>]*x="24" y="71" width="4" height="42"/);
  assert.doesNotMatch(svg, /cluster-locator/);
  assert.match(svg, /cluster-eyebrow[^>]*x="40"/);
  const v = run(["verify", o, "--receipt", rc, "--plan", p, ...M]);
  assert.equal(v.code, 0, v.out);
});
test("P3-2: a two-line H1 — the keyline covers both line-boxes and the slot budget matches pageframe --h1-lines 2", () => {
  const p = mkPlan("k2-2.yaml", (s2) => s2
    .replace("header:\n", "header:\n  style: title-keyline\n")
    .replace(/* lang-allow: ko-fixture */ 'h1: "핵심 4가지와 전체 구조"', /* lang-allow: ko-fixture */ 'h1:\n    - "핵심 4가지 요약과"\n    - "전체 구조의 대응 관계"')
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
test("P3-3: an h1 over two lines, or an unspecified header style, is refused at plan", () => {
  const p3 = mkPlan("k2-bad.yaml", (s2) => s2.replace(/* lang-allow: ko-fixture */ 'h1: "핵심 4가지와 전체 구조"', 'h1:\n    - "one"\n    - "two"\n    - "three"'));
  const r = run(["plan", p3, ...M]);
  assert.equal(r.code, 1);
  assert.match(r.out, /header\.h1 as a list must hold 1\.\.2/);
  const p4 = mkPlan("k2-bad2.yaml", (s2) => s2.replace("header:\n", "header:\n  style: fancy-rail\n"));
  const r2 = run(["plan", p4, ...M]);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /header\.style must be locator\|title-keyline/);
});
