// generate.mjs test suite — canary 생성 경로의 fail-closed 계약을 고정한다.
// 원칙: 생성기는 내용을 발명하지 않고, 못 담는 입력을 성공으로 처리하지 않으며,
// 선언되지 않은 dead space를 조용히 통과시키지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function pkgCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "genpkg-"));
  const pkg = path.join(dir, "svg-infographic");
  const r = spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  spawnSync("chmod", ["-R", "u+w", pkg], { encoding: "utf8" });
  return pkg;
}
const drop = (pkg) => rmSync(path.dirname(pkg), { recursive: true, force: true });

function runIn(pkg, args) {
  const e = { ...process.env };
  for (const k of ["SVGINFO_EXPECTED_SKILL_ROOT", "SVGINFO_EXECUTION_MODE"]) delete e[k];
  const r = spawnSync(process.execPath, [path.join(pkg, "scripts", "generate.mjs"), ...args],
    { encoding: "utf8", cwd: path.join(pkg, "scripts"), env: e });
  return { code: r.status, out: r.stdout + r.stderr };
}
const out = (pkg, name) => path.join(path.dirname(pkg), name);
const manifestPath = (pkg) => path.join(pkg, "references", "types", "manifest.yaml");
const editManifest = (pkg, fn) => writeFileSync(manifestPath(pkg), fn(readFileSync(manifestPath(pkg), "utf8")));

// 기본은 system delivery다 — 이 suite가 검사하는 것은 소비·receipt·degrade이지 글꼴 전달이 아니고,
// portable subsetter는 build 전용 의존성이라 검증이 그것을 요구해서는 안 된다.
function build(pkg, tp, cse, loc, extra = []) {
  const svg = out(pkg, `${tp}-${cse}-${loc}.svg`), rcp = out(pkg, `${tp}-${cse}-${loc}.json`);
  const mode = extra.includes("--font-delivery") ? [] : ["--font-delivery", "system"];
  const r = runIn(pkg, ["build", "--typepack", tp, "--case", cse, "--locale", loc, "--out", svg, "--receipt", rcp, ...mode, ...extra]);
  return { ...r, svg, rcp };
}

// --- 성공 경로가 실제로 증거를 남기는가 --------------------------------------
test("G-1: build는 payload entity를 전량 소비하고 digest·잔여를 receipt에 남긴다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const rc = JSON.parse(readFileSync(b.rcp, "utf8"));
  assert.equal(rc.status, "ok");
  assert.deepEqual(rc.consumed, ["observability", "delivery", "cost", "security"]);
  assert.match(rc.inputDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(rc.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(rc.contentFlowBounds && typeof rc.residual.bottom === "number");
  const svg = readFileSync(b.svg, "utf8");
  for (const id of rc.consumed) assert.ok(svg.includes(`data-entity="${id}"`), `${id} must be stamped in the artifact`);
  drop(pkg);
});

// --- 못 담는 입력은 성공이 아니다 --------------------------------------------
test("G-2: needs-split은 exit 3 · artifact 없음 · degrade 근거를 남긴다", () => {
  const pkg = pkgCopy();
  const rcp = out(pkg, "degrade.json"), svg = out(pkg, "degrade.svg");
  const r = runIn(pkg, ["build", "--typepack", "cards-kpi-grid", "--case", "stress-degrade",
    "--locale", "ko", "--out", svg, "--receipt", rcp]);
  assert.equal(r.code, 3, r.out);
  assert.equal(existsSync(svg), false, "needs-split은 artifact를 만들지 않는다");
  const rc = JSON.parse(readFileSync(rcp, "utf8"));
  assert.equal(rc.status, "needs-split");
  assert.equal(rc.artifact, null);
  assert.deepEqual(rc.consumed, []);
  assert.match(rc.degrade.reason, /needs .* against contentBox/);
  drop(pkg);
});

// --- 내용을 발명하지 않는다 ---------------------------------------------------
test("G-3: payload에 title이 없으면 H1을 지어내지 않고 실패한다", () => {
  const pkg = pkgCopy();
  const p = path.join(pkg, "references", "types", "inputs", "cards-kpi-grid.canonical.yaml");
  const src = readFileSync(p, "utf8");
  writeFileSync(p, src.replace(/title:\n  ko: "[^"]*"\n  en: "[^"]*"\n/, ""));
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko");
  assert.notEqual(b.code, 0);
  assert.match(b.out, /title/);
  drop(pkg);
});

// --- 선언되지 않은 dead space는 통과하지 않는다 -------------------------------
test("G-4: 하단 잔여가 floor를 넘는데 선언이 없으면 실패한다", () => {
  const pkg = pkgCopy();
  // topology canonical은 고정 캔버스에서 선언된 breathing을 남긴다 — 그 선언을 지우면 통과하면 안 된다.
  editManifest(pkg, (m) => m.replace(/\n\s+residual_disposition: \{ bottom: 194[^\n]*\n/, "\n"));
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /residual_disposition/);
  drop(pkg);
});

test("G-5: 선언한 잔여가 측정치와 다르면 실패한다", () => {
  const pkg = pkgCopy();
  editManifest(pkg, (m) => m.replace("bottom: 194,", "bottom: 120,"));
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /does not match the measured/);
  drop(pkg);
});

// --- 선언되지 않은 preset은 audition으로만 --------------------------------------
test("G-6: 미선언 preset은 --audition 없이는 거부되고, audition receipt는 비정본으로 표시된다", () => {
  const pkg = pkgCopy();
  // 사본에서 document-compact를 선언 목록에서 빼 "선언되지 않은 preset" 상황을 만든다
  editManifest(pkg, (m) => m.replace("presets: [document-compact, social-4x5, presentation-16x9]",
                                     "presets: [social-4x5, presentation-16x9]"));
  const bad = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--preset", "document-compact"]);
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /--audition/);
  const ok = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--preset", "document-compact", "--audition"]);
  assert.equal(ok.code, 0, ok.out);
  const rc = JSON.parse(readFileSync(ok.rcp, "utf8"));
  assert.equal(rc.audition, true);
  assert.equal(rc.presetDeclared, false);
  drop(pkg);
});

// --- verify가 세 곳을 실제로 대조하는가 -----------------------------------------
test("G-7: artifact가 바뀌면 verify가 digest 불일치를 잡는다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  writeFileSync(b.svg, readFileSync(b.svg, "utf8").replace("</svg>", "<!-- tamper --></svg>"));
  const v = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(v.code, 0, v.out);
  assert.match(v.out, /digest/i);
  drop(pkg);
});

test("G-8: KO·EN entity 집합이 어긋나면 pair verify가 잡는다", () => {
  const pkg = pkgCopy();
  const ko = build(pkg, "cards-kpi-grid", "canonical", "ko");
  const en = build(pkg, "cards-kpi-grid", "canonical", "en");
  assert.equal(ko.code, 0, ko.out);
  assert.equal(en.code, 0, en.out);
  const rc = JSON.parse(readFileSync(en.rcp, "utf8"));
  rc.consumed = rc.consumed.slice(0, -1);
  writeFileSync(en.rcp, JSON.stringify(rc, null, 1));
  const v = runIn(pkg, ["verify", "--receipt", ko.rcp, "--svg", ko.svg, "--pair", en.rcp]);
  assert.notEqual(v.code, 0, v.out);
  drop(pkg);
});

// --- font delivery 경계 ---------------------------------------------------------
test("G-9: portable은 pinned toolchain이 없으면 full embed나 system fallback으로 새지 않고 실패한다", () => {
  const pkg = pkgCopy();
  const svg = out(pkg, "portable.svg"), rcp = out(pkg, "portable.json");
  const run = (python) => {
    const e = { ...process.env, SVGINFO_PYTHON: python };
    for (const k of ["SVGINFO_EXPECTED_SKILL_ROOT", "SVGINFO_EXECUTION_MODE"]) delete e[k];
    return spawnSync(process.execPath, [path.join(pkg, "scripts", "generate.mjs"), "build",
      "--typepack", "cards-kpi-grid", "--case", "canonical", "--locale", "ko",
      "--out", svg, "--receipt", rcp, "--font-delivery", "portable"],
      { encoding: "utf8", cwd: path.join(pkg, "scripts"), env: e });
  };
  // ① interpreter 자체가 없을 때
  const missing = run(path.join(path.dirname(pkg), "no-such-python"));
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout + missing.stderr, /build-only dependency/);
  assert.equal(existsSync(svg), false, "실패했는데 artifact가 남으면 안 된다");
  // ② interpreter는 있으나 pinned 라이브러리가 없을 때
  const bare = run("/usr/bin/python3");
  assert.notEqual(bare.status, 0);
  assert.match(bare.stdout + bare.stderr, /pinned build dependency missing|does not match the pinned/);
  assert.equal(existsSync(svg), false);
  drop(pkg);
});

test("G-9b: 선언한 tool 버전과 실제 실행 버전이 다르면 acceptance 생성이 실패한다", () => {
  const sub = process.env.SVGINFO_PYTHON;
  if (!sub || !existsSync(sub)) { console.error("  note: pinned interpreter 없음 — 버전 대조는 이 실행에서 미검증"); return; }
  const pkg = pkgCopy();
  const pol = path.join(pkg, "references", "delivery", "font-delivery-v1.yaml");
  writeFileSync(pol, readFileSync(pol, "utf8").replace("version: 4.53.1", "version: 9.9.9"));
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--font-delivery", "portable"]);
  assert.notEqual(b.code, 0, b.out);
  assert.match(b.out, /does not match the pinned/);
  drop(pkg);
});

test("G-10: system 산출물은 환경 의존으로 표시되고 acceptance가 아니다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const fd = JSON.parse(readFileSync(b.rcp, "utf8")).fontDelivery;
  assert.equal(fd.mode, "system");
  assert.equal(fd.grade, "environment-dependent");
  assert.equal(fd.faces.length, 0);
  assert.ok(fd.policyDigest && fd.typographyProfileDigest, "어느 정책·글꼴 profile로 만들었는지 남아야 한다");
  drop(pkg);
});

test("G-11: portable 산출물은 subset을 embed하고 근거를 남긴다 (pinned subsetter가 있을 때)", () => {
  const sub = process.env.SVGINFO_PYFTSUBSET;
  if (!sub || !existsSync(sub)) { console.error("  note: pinned subsetter 없음 — portable 양성 경로는 이 실행에서 미검증"); return; }
  const pkg = pkgCopy();
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--font-delivery", "portable"]);
  assert.equal(b.code, 0, b.out);
  const rcv = JSON.parse(readFileSync(b.rcp, "utf8"));
  assert.equal(rcv.fontDelivery.grade, "acceptance");
  assert.equal(rcv.fontDelivery.faces.length, 2, "선언된 400·700 face가 모두 embed돼야 한다");
  const svg = readFileSync(b.svg, "utf8");
  assert.match(svg, /@font-face\{font-family:'[^']+'/);
  assert.ok(!/@font-face\{font-family:'[^']*Pretendard/i.test(svg), "subset은 Reserved Font Name을 쓸 수 없다");
  drop(pkg);
});

test("G-12: connector 없는 산출물의 layer 순서를 흐트러뜨리면 verify가 non-zero로 끝난다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "layer-stack", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const clean = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.equal(clean.code, 0, clean.out);
  // annotations 레이어를 맨 앞으로 옮긴다 — 기하는 그대로이고 그리는 순서만 어긋난다
  const svg = readFileSync(b.svg, "utf8");
  const ann = svg.match(/  <g data-layer="annotations">[\s\S]*?<\/g>\n?/);
  assert.ok(ann, "annotations layer not found");
  const moved = svg.replace(ann[0], "").replace('  <g data-layer="containers">', ann[0] + '  <g data-layer="containers">');
  writeFileSync(b.svg, moved);
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /A-LAYER-ORDER/);
  drop(pkg);
});
