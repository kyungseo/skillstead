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
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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
  editManifest(pkg, (m) => m.replace(/\n *residual_disposition:\n(?: +[^\n]*\n)+?(?= *routing_expected:)/, "\n"));
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /residual_disposition/);
  drop(pkg);
});

test("G-5: 선언한 잔여가 측정치와 다르면 실패한다", () => {
  const pkg = pkgCopy();
  editManifest(pkg, (m) => m.replace("{ treatment: flat, bottom: 194 }", "{ treatment: flat, bottom: 120 }"));
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

test("G-13: SVG inventory까지 함께 지워도 입력에서 다시 계산한 verify가 잡는다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "before-after", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  // group annotation과 inventory 항목을 **함께** 제거한다 — 산출물 내부는 자기 일관적이다
  const svg = readFileSync(b.svg, "utf8");
  const stripped = svg
    .replace(/data-align-inventory="[^"]*"/, 'data-align-inventory="row:slot-deploy=2"')
    .replace(/ data-align-row="slot-rollback" data-align-row-count="2"/g, "");
  writeFileSync(b.svg, stripped);
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-GEN-ALIGN/);
  drop(pkg);
});

test("G-14: 불완전 격자에서 participant가 1인 축은 group을 만들지 않는다", () => {
  const pkg = pkgCopy();
  // 3열에 셀 9개는 완전 격자 — 모든 행·열이 3이다
  const b = build(pkg, "decision-matrix", "stress-cardinality", "ko");
  assert.equal(b.code, 0, b.out);
  const svg = readFileSync(b.svg, "utf8");
  const inv = (svg.match(/data-align-inventory="([^"]*)"/) ?? [])[1];
  assert.ok(inv && !/=1(;|$)/.test(inv), `singleton group must not appear in the inventory: ${inv}`);
  drop(pkg);
});

// --- decision-matrix: 축 방향과 cell 배치는 축 값에서 파생돼야 한다 -----------------
// 배열 순서로 자리를 정하면 "낮음" 행이 위로 올라가도 아무 gate가 울리지 않았다.
// 아래 3종은 그 회귀를 각각 다른 층위에서 고정한다.

test("G-15: 축 값이 자리를 정한다 — high/low 행을 뒤집으면 verify가 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  // 두 행의 y좌표만 맞바꾼다 — 라벨도 축도 그대로라 산출물만 보면 멀쩡하다.
  const svg = readFileSync(b.svg, "utf8");
  const ys = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)"[^>]*data-align-row="matrix-r(\d)"/g)];
  const top = ys.find((m) => m[2] === "0")[1], bot = ys.find((m) => m[2] === "1")[1];
  writeFileSync(b.svg, svg.replace(new RegExp(`y="${top}"`, "g"), 'y="__T__')
    .replace(new RegExp(`y="${bot}"`, "g"), `y="${top}"`).replace(/y="__T__/g, `y="${bot}"`));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-GEN-MATRIX-PLACE/);
  drop(pkg);
});

test("G-16: 축 방향 marker가 반대 끝에 있으면 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  // y축 marker를 아래 끝으로 옮긴다 — 선도 라벨도 그대로다.
  const line = svg.match(/<path data-axis="y"[^>]*d="M([\d.]+) ([\d.]+) V([\d.]+)"/);
  const [, ax, bot, top] = line;
  const moved = svg.replace(/<path data-axis-marker="y" d="[^"]*"/,
    `<path data-axis-marker="y" d="M${Number(ax) - 3.4} ${Number(bot) - 6.8} L${ax} ${bot} L${Number(ax) + 3.4} ${Number(bot) - 6.8}"`);
  assert.notEqual(moved, svg);
  void top;
  writeFileSync(b.svg, moved);
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-GEN-AXIS-DIR/);
  drop(pkg);
});

test("G-17: 축 방향과 라벨을 함께 뒤집어도 cell 배치가 어긋나면 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  // 산출물만 보면 **완전히 자기 일관적**이 되도록 전부 뒤집는다: positive=down,
  // marker를 아래 끝으로, 두 끝 라벨 교환, 그리고 cell 행까지 교환.
  // "y는 위로 자란다"는 계약과 원본 축 값이 없으면 이 산출물은 통과해버린다.
  const line = svg.match(/<path data-axis="y"[^>]*d="M([\d.]+) ([\d.]+) V([\d.]+)"/);
  const [, ax, bot] = line;
  const hi = svg.match(/<text data-axis-end="y:high"[^>]*>([^<]*)</)[1];
  const lo = svg.match(/<text data-axis-end="y:low"[^>]*>([^<]*)</)[1];
  const ys = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)"[^>]*data-align-row="matrix-r(\d)"/g)];
  const top = ys.find((m) => m[2] === "0")[1], low = ys.find((m) => m[2] === "1")[1];
  const f = svg.replace('data-axis-positive="up"', 'data-axis-positive="down"')
    .replace(/<path data-axis-marker="y" d="[^"]*"/,
      `<path data-axis-marker="y" d="M${Number(ax) - 3.4} ${Number(bot) - 6.8} L${ax} ${bot} L${Number(ax) + 3.4} ${Number(bot) - 6.8}"`)
    .replace(/(<text data-axis-end="y:high"[^>]*>)[^<]*</, `$1${lo}<`)
    .replace(/(<text data-axis-end="y:low"[^>]*>)[^<]*</, `$1${hi}<`)
    .replace(new RegExp(`y="${top}"`, "g"), 'y="__T__')
    .replace(new RegExp(`y="${low}"`, "g"), `y="${top}"`)
    .replace(/y="__T__/g, `y="${low}"`);
  writeFileSync(b.svg, f);
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  // 두 층위가 함께 걸린다: 축 방향 계약(위가 positive)과 입력 축 값이 정한 실제 자리.
  assert.match(r.out, /E-GEN-AXIS/);
  assert.match(r.out, /E-GEN-MATRIX-PLACE/);
  drop(pkg);
});

test("G-18: ordinal 축은 connector가 아니다 — routing audit 대상이 되지 않는다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  const axisBlock = svg.slice(svg.indexOf('data-layout-role="axis"'));
  assert.ok(!/data-route-(id|from|to|kind)=/.test(axisBlock), "axis must not carry connector classification");
  assert.ok(!/marker-end="url\(#ah-/.test(axisBlock), "axis must not reuse the connector arrowhead marker");
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  drop(pkg);
});

// --- roadmap-timeline: 위치는 입력이 정하고, 상태는 색 없이도 구분된다 -----------------
// 이 타입의 뜻은 "순서"다. 그래서 좌표·순서·marker 위치를 모두 **원본 입력에서 재계산해** 대조한다.

const skinManifest = (pkg) => {
  const r = spawnSync(process.execPath, [path.join(pkg, "scripts", "skin.mjs"), "manifest"],
    { encoding: "utf8", cwd: path.join(pkg, "scripts") });
  return { code: r.status, out: r.stdout + r.stderr };
};
const tlEdit = (pkg, tid, fn) => {
  const f = path.join(pkg, "references", "types", "inputs", `roadmap-timeline.${tid}.yaml`);
  writeFileSync(f, fn(readFileSync(f, "utf8")));
};

test("G-19: 등간격은 계산값이다 — 한 phase만 옮기면 verify가 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  const svg = readFileSync(b.svg, "utf8");
  // phase 하나를 통째로 옮긴다(underlay·dot·ring·label 전부) — 자기 일관적인 이동이다.
  const grp = svg.match(/<g data-comp-entity="phase-3"[\s\S]*?<\/g>/)[0];
  const cx = Number(grp.match(/<circle[^>]*cx="([\d.]+)"/)[1]);
  const moved = grp.replace(new RegExp(`cx="${cx}"`, "g"), `cx="${cx + 24}"`)
    .replace(new RegExp(`x="${cx}"`, "g"), `x="${cx + 24}"`);
  writeFileSync(b.svg, svg.replace(grp, moved));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TL-POSITION/);
  drop(pkg);
});

test("G-20: now marker 위치는 after_phase가 정한다 — 옮기면 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  const d = svg.match(/data-marker-stem="now" d="M([\d.]+)/)[1];
  writeFileSync(b.svg, svg.replace(`d="M${d}`, `d="M${Number(d) + 20}`));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TL-MARKER/);
  drop(pkg);
});

test("G-21: after_phase가 없는 phase이거나 current가 아니면 입력에서 거부한다", () => {
  for (const [mutate, why] of [
    [(s) => s.replace('after_phase: "phase-2"', 'after_phase: "phase-9"'), /not an existing phase id/],
    [(s) => s.replace('after_phase: "phase-2"', 'after_phase: "phase-3"'), /must name the phase whose status is "current"/],
  ]) {
    const pkg = pkgCopy();
    tlEdit(pkg, "canonical", mutate);
    const r = skinManifest(pkg);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, why);
    drop(pkg);
  }
});

test("G-22: 마지막 phase가 current인데 marker가 있으면 거부한다", () => {
  const pkg = pkgCopy();
  // tail-current 입력에 marker를 되돌려 넣는다 — 뒤에 놓을 ordinal interval이 없다.
  const marker = ['now_marker:', '  after_phase: "phase-4"', '  label:', '    ko: "지금"', '    en: "Now"', ''].join("\n");
  tlEdit(pkg, "stress-tail-current", (s) => s.trimEnd() + "\n" + marker);
  const r = skinManifest(pkg);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /no ordinal interval follows it/);
  drop(pkg);
});

test("G-23: status가 시간 순서와 모순이면 거부한다", () => {
  const pkg = pkgCopy();
  // done → future 로 바꿔 future 가 current 앞에 오게 만든다.
  tlEdit(pkg, "canonical", (s) => s.replace('status: "done"', 'status: "future"'));
  const r = skinManifest(pkg);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /done\* → current → future\*/);
  drop(pkg);
});

test("G-24: 상태는 색만으로 구분되지 않는다 — ring이 안 보이면 거부한다", () => {
  for (const [mutate, code] of [
    [(s) => s.replace(/(data-dot-ring="current"[^>]*stroke-width=")[\d.]+/, "$10"), /ring stroke 0 is below the visible floor/],
    [(s) => s.replace(/(<circle data-dot-ring="current" cx="[\d.]+" cy="[\d.]+" r=")[\d.]+/, "$19"), /leaves no visible gap/],
    [(s) => s.replace(/<circle data-dot-ring="current"[^>]*\/>/, ""), /carries no ring/],
  ]) {
    const pkg = pkgCopy();
    const b = build(pkg, "roadmap-timeline", "canonical", "ko");
    writeFileSync(b.svg, mutate(readFileSync(b.svg, "utf8")));
    const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, code);
    drop(pkg);
  }
});

test("G-25: timeline receipt는 exact schema다 — 누락·추가·타입·길이·union 모순을 거부한다", () => {
  const muts = [
    [(t) => { delete t.timeline.axis.step; }, /missing required field "step"/],
    [(t) => { t.timeline.extra = 1; }, /undeclared field "extra"/],
    [(t) => { t.timeline.axis.step = "wide"; }, /axis.step must be a finite number/],
    [(t) => { t.timeline.phases[0].x = Infinity; }, /phases\[0\]\.x must be a finite number/],
    [(t) => { t.timeline.phases.pop(); }, /holds 3 entries but the input declares 4/],
    [(t) => { t.timeline.marker = null; }, /but the input declares now_marker/],
    [(t) => { t.timeline.kind = "proportional"; }, /kind must be "ordinal"/],
  ];
  for (const [mutate, why] of muts) {
    const pkg = pkgCopy();
    const b = build(pkg, "roadmap-timeline", "canonical", "ko");
    const t = JSON.parse(readFileSync(b.rcp, "utf8"));
    mutate(t);
    writeFileSync(b.rcp, JSON.stringify(t));
    const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
    assert.notEqual(r.code, 0, `${why}\n${r.out}`);
    assert.match(r.out, why);
    drop(pkg);
  }
});

test("G-26: 날짜 domain은 이 타입에 없다 — 입력이 들고 오면 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  tlEdit(pkg, "canonical", (s) => s.replace('  - id: "phase-1"', '  - id: "phase-1"\n    date: "2026-01-01"'));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  drop(pkg);
});

test("G-27: 축은 모든 state marker 뒤에 그려져야 한다 — 순서를 뒤집으면 거부한다", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const svg = readFileSync(b.svg, "utf8");
  // 축 rect를 dot 뒤로 옮긴다 — 좌표는 그대로라 기하 검사만으로는 잡히지 않는다.
  const ax = svg.match(/<rect[^>]*data-axis="x"[^>]*\/>/)[0];
  writeFileSync(b.svg, svg.replace(ax, "").replace("</svg>", `${ax}\n</svg>`));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TL-LAYER/);
  drop(pkg);
});

test("G-28: 투명한 future dot은 거부한다 — 축 rail이 비친다", () => {
  for (const [mutate, why] of [
    [(s) => s.replace(/(<circle cx="[\d.]+" cy="[\d.]+" r="[\d.]+" )fill="#F7F7F5" data-fill-role="canvas"( stroke="#636A75")/, '$1fill="none"$2'), /no fill — the axis rail shows through/],
    [(s) => s.replace(/<circle[^>]*data-dot-underlay="future"[^>]*\/>/, ""), /carries no background underlay/],
  ]) {
    const pkg = pkgCopy();
    const b = build(pkg, "roadmap-timeline", "canonical", "ko");
    const before = readFileSync(b.svg, "utf8");
    const after = mutate(before);
    assert.notEqual(after, before, "fixture mutation did not apply");
    writeFileSync(b.svg, after);
    const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, why);
    drop(pkg);
  }
});

// --- treatment axis: sketch는 이름이 아니라 산출물로 증명된다 -------------------------
// flat이 canonical/default이고 sketch는 opt-in experimental preview다. 아래는 그 경계를
// 이름이 아니라 **산출물**에서 지키는지 고정한다.

const TX = ["--treatment", "sketch", "--font-delivery", "portable"];
const hasSubsetter = () => Boolean(process.env.SVGINFO_PYTHON && existsSync(process.env.SVGINFO_PYTHON));

test("G-29: registry가 허용하지 않는 treatment는 거부한다", () => {
  const pkg = pkgCopy();
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "watercolour", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /unknown treatment/);
  drop(pkg);
});

test("G-30: dark × sketch는 미지원 조합으로 거부한다", () => {
  const pkg = pkgCopy();
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "sketch", "--mode", "dark", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /unsupported combination: dark \+ sketch/);
  drop(pkg);
});

test("G-31: overlay가 registry에서 빠지면 sketch를 선택할 수 없다", () => {
  const pkg = pkgCopy();
  const reg = path.join(pkg, "references", "skins", "registry.yaml");
  writeFileSync(reg, readFileSync(reg, "utf8").replace(/^overlays:\n  sketch: .*$/m, "overlays: {}"));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "sketch", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /not selected by the skin registry/);
  drop(pkg);
});

test("G-32: sketch 구조가 일부만 빠져도 verify가 거부한다", () => {
  if (!hasSubsetter()) { console.error("  note: pinned subsetter 없음 — sketch 구조 negative 미검증"); return; }
  const muts = [
    [(s) => s.replace(/ data-treatment-paper="1"/, " data-was-paper=\"1\""), /no treatment paper surface/],
    [(s) => s.replace(/<defs data-treatment-defs="sketch">/, "<defs>"), /does not declare the "sketch" treatment defs/],
    [(s) => s.replace(/filterUnits="userSpaceOnUse"/g, 'filterUnits="objectBoundingBox"'), /must use userSpaceOnUse/],
    [(s) => s.replace(/(<filter id="tx-rough-box"[^>]*?)width="\d+"/, '$1width="40"'), /does not cover the/],
  ];
  for (const [mutate, why] of muts) {
    const pkg = pkgCopy();
    const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
    const b = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
      "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
    assert.equal(b.code, 0, b.out);
    const before = readFileSync(svg, "utf8"), after = mutate(before);
    assert.notEqual(after, before, `fixture mutation did not apply for ${why}`);
    writeFileSync(svg, after);
    const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, why);
    drop(pkg);
  }
});

test("G-33: sketch receipt로 flat 산출물을 통과시킬 수 없다 (silent flat fallback)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const fsvg = out(pkg, "f.svg"), frcp = out(pkg, "f.json");
  const ssvg = out(pkg, "s.svg"), srcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko",
    "--font-delivery", "portable", "--out", fsvg, "--receipt", frcp]).code, 0);
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko",
    ...TX, "--out", ssvg, "--receipt", srcp]).code, 0);
  // flat과 sketch가 실제로 다른 산출물이어야 한다 — 이름만 바뀐 것은 treatment가 아니다.
  assert.notEqual(readFileSync(fsvg, "utf8"), readFileSync(ssvg, "utf8"));
  // sketch receipt + flat artifact = 조용한 fallback. 거부돼야 한다.
  const s = JSON.parse(readFileSync(srcp, "utf8"));
  s.artifactDigest = JSON.parse(readFileSync(frcp, "utf8")).artifactDigest;
  writeFileSync(srcp, JSON.stringify(s));
  const r = runIn(pkg, ["verify", "--receipt", srcp, "--svg", fsvg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TX-STRUCT|E-TX-FLAT/);
  drop(pkg);
});

test("G-34: portable sketch는 embedded alias가 stack을 이끈다 (implicit fallback 금지)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]).code, 0);
  const text = readFileSync(svg, "utf8");
  assert.match(text, /style="font-family:'SkinSans-Subset','Hi Melody'/);
  assert.match(text, /@font-face/);
  // alias를 stack에서 떨어뜨리면 설치 글꼴에 의존하게 된다 — 거부돼야 한다.
  writeFileSync(svg, text.replace(/font-family:'SkinSans-Subset',/, "font-family:"));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TX-FONT/);
  drop(pkg);
});

// --- allowedPortInterval: layout이 증명한 구간을 router가 소비한다 --------------------

test("G-35: interval 밖 port는 verify가 거부한다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]).code, 0);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  const pc = t.routing.portConstraints;
  assert.ok(pc?.length, "sketch topology는 entry interval을 선언해야 한다");
  // 선택된 port를 구간 밖으로 옮긴다(선언은 그대로) — 재측정이 잡아야 한다.
  const text = readFileSync(svg, "utf8");
  const m = new RegExp(`data-route-id="${pc[0].edge}"[^>]*?\\sd="(M[^"]+)"`).exec(text);
  // 경로 전체를 왼쪽으로 옮긴다 — attach x가 구간 밖으로 나가야 한다.
  const moved = m[1].replace(/([ML])([\d.]+)/g, (_, cmd, x) => `${cmd}${Number(x) - 200}`);
  writeFileSync(svg, text.replace(`d="${m[1]}"`, `d="${moved}"`));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-PORT-INTERVAL/);
  drop(pkg);
});

test("G-36: node port 범위를 벗어난 interval 선언은 거부한다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  t.routing.portConstraints[0].allowed.hi += 500;   // node 밖까지 허용한다고 주장
  writeFileSync(rcp, JSON.stringify(t));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /leaves the port range|recomputes/);
  drop(pkg);
});

test("G-37: label clearance를 만족하지 않는 interval은 거부한다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  t.routing.portConstraints[0].allowed.lo -= 120;   // label 쪽으로 구간을 넓혔다고 주장
  writeFileSync(rcp, JSON.stringify(t));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /recomputes/);
  drop(pkg);
});

test("G-38: 합법 구간이 기존 sweep 밖에 있어도 라우팅된다 (interval 소비 증거)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  const b = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  assert.equal(b.code, 0, b.out);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  // 큰 손글씨에서 label이 넓어져도 3개 edge가 모두 살아 있어야 한다.
  assert.equal(t.routing.routes.length, 3, "1.8x에서도 전 edge가 라우팅돼야 한다");
  assert.equal(t.routing.problems.length, 0);
  for (const c of t.routing.portConstraints) assert.ok(c.allowed.hi > c.allowed.lo, "구간은 finite이고 비어 있지 않다");
  drop(pkg);
});

test("G-39: straight-first와 결정성은 interval 아래에서도 유지된다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const a = out(pkg, "a.svg"), ar = out(pkg, "a.json"), c = out(pkg, "c.svg"), cr = out(pkg, "c.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", a, "--receipt", ar]);
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", c, "--receipt", cr]);
  assert.equal(readFileSync(a, "utf8"), readFileSync(c, "utf8"), "같은 입력은 같은 산출물이어야 한다");
  const t = JSON.parse(readFileSync(ar, "utf8"));
  for (const rt of t.routing.routes) assert.equal(rt.path, "straight", `${rt.id}은 직선이어야 한다(불필요한 dogleg 금지)`);
  assert.equal(t.routing.problems.length, 0);
  drop(pkg);
});

test("G-40: 후보 수가 안전 상한을 넘으면 조용히 자르지 않고 명시 실패한다", async () => {
  const { routeEdges, ROUTE_DEFAULTS } = await import("./route-orthogonal.mjs");
  const K = ROUTE_DEFAULTS;
  // 파생 후보 수 = floor((hi-lo)/portSpreadStep)+1. 상한 64를 넘기려면 겹치는 구간 폭 > 768px.
  const W = (64 + 4) * K.portSpreadStep;                 // 816px → 후보 69개
  const nodes = { a: { x: 0, y: 0, w: W, h: 60 }, b: { x: 0, y: 300, w: W, h: 60 } };
  const plan = { classified: [{ id: "e1", from: "a", to: "b", weight: "primary", dashed: false }] };
  const r = routeEdges({ nodes, zones: [], plan, frame: { x: -20, y: -20, w: W + 40, h: 420 }, degradeLevel: 0 });
  assert.ok(r.problems.some((p) => /safety cap/.test(p)),
    `cap 초과가 명시 실패여야 한다: problems=${JSON.stringify(r.problems)} routes=${r.routes.length}`);
  assert.ok((r.diagnostics ?? []).some((d) => d.code === "R-CANDIDATE-CAP"), "R-CANDIDATE-CAP 진단이 남아야 한다");
  assert.equal(r.routes.length, 0, "잘라낸 뒤 성공으로 처리하지 않는다");
});

test("G-41: treatment 항목이 없는 잔여 선언은 fail-closed다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  // sketch 항목을 지운다 — flat 값을 재사용해 통과시키면 안 된다.
  editManifest(pkg, (t) => t.replace(/\n *- \{ treatment: sketch, calibration: [^}]*\}/, ""));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", out(pkg, "s.svg"), "--receipt", out(pkg, "s.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /declares no entry for treatment "sketch"/);
  drop(pkg);
});

test("G-42: calibration ID가 다르면 잔여 선언을 쓰지 않는다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  editManifest(pkg, (t) => t.replace("calibration: hi-melody-optical-v1", "calibration: hi-melody-optical-v0"));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", out(pkg, "s.svg"), "--receipt", out(pkg, "s.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /declares no entry for treatment "sketch"/);
  drop(pkg);
});

test("G-43: 잔여는 exact-match다 — 선언보다 작아도 통과하지 않는다", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  editManifest(pkg, (t) => t.replace("{ treatment: sketch, calibration: hi-melody-optical-v1, bottom: 93 }",
    "{ treatment: sketch, calibration: hi-melody-optical-v1, bottom: 300 }"));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", out(pkg, "s.svg"), "--receipt", out(pkg, "s.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /does not match the measured/);
  drop(pkg);
});
