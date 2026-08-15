// generate.mjs test suite — pins the fail-closed contracts of the canary generation path.
// The principles: the generator invents no content, never treats input it cannot hold as a
// success, and never lets undeclared dead space through quietly.
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

// The default is system delivery — what this suite checks is consumption, receipts and degrade,
// not font delivery, and the portable subsetter is a build-only dependency that verification must
// not require.
function build(pkg, tp, cse, loc, extra = []) {
  const svg = out(pkg, `${tp}-${cse}-${loc}.svg`), rcp = out(pkg, `${tp}-${cse}-${loc}.json`);
  const mode = extra.includes("--font-delivery") ? [] : ["--font-delivery", "system"];
  const r = runIn(pkg, ["build", "--typepack", tp, "--case", cse, "--locale", loc, "--out", svg, "--receipt", rcp, ...mode, ...extra]);
  return { ...r, svg, rcp };
}

// --- does the success path actually leave evidence? --------------------------------------
test("G-1: build consumes every payload entity and records the digests and residual in the receipt", () => {
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

// --- input that cannot be held is not a success --------------------------------------------
test("G-2: needs-split exits 3, produces no artifact, and records the degrade reasoning", () => {
  const pkg = pkgCopy();
  const rcp = out(pkg, "degrade.json"), svg = out(pkg, "degrade.svg");
  const r = runIn(pkg, ["build", "--typepack", "cards-kpi-grid", "--case", "stress-degrade",
    "--locale", "ko", "--out", svg, "--receipt", rcp]);
  assert.equal(r.code, 3, r.out);
  assert.equal(existsSync(svg), false, "needs-split produces no artifact");
  const rc = JSON.parse(readFileSync(rcp, "utf8"));
  assert.equal(rc.status, "needs-split");
  assert.equal(rc.artifact, null);
  assert.deepEqual(rc.consumed, []);
  assert.match(rc.degrade.reason, /needs .* against contentBox/);
  drop(pkg);
});

// --- it invents no content ---------------------------------------------------
test("G-3: with no title in the payload it fails rather than making up an H1", () => {
  const pkg = pkgCopy();
  const p = path.join(pkg, "references", "types", "inputs", "cards-kpi-grid.canonical.yaml");
  const src = readFileSync(p, "utf8");
  writeFileSync(p, src.replace(/title:\n  ko: "[^"]*"\n  en: "[^"]*"\n/, ""));
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko");
  assert.notEqual(b.code, 0);
  assert.match(b.out, /title/);
  drop(pkg);
});

// --- undeclared dead space does not pass -------------------------------
test("G-4: a bottom residual over the floor with no declaration fails", () => {
  const pkg = pkgCopy();
  // the topology canonical leaves declared breathing room on a fixed canvas — deleting that declaration must not pass
  editManifest(pkg, (m) => m.replace(/\n *residual_disposition:\n(?: +[^\n]*\n)+?(?= *routing_expected:)/, "\n"));
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /residual_disposition/);
  drop(pkg);
});

test("G-5: a declared residual that differs from the measurement fails", () => {
  const pkg = pkgCopy();
  editManifest(pkg, (m) => m.replace("{ treatment: flat, bottom: 194 }", "{ treatment: flat, bottom: 120 }"));
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /does not match the measured/);
  drop(pkg);
});

// --- an undeclared preset only through an audition --------------------------------------
test("G-6: an undeclared preset is refused without --audition, and an audition receipt is marked non-canonical", () => {
  const pkg = pkgCopy();
  // in a copy, drop document-compact from the declared list to create the "undeclared preset" situation
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

// --- does verify really cross-check all three places? -----------------------------------------
test("G-7: when the artifact changes, verify catches the digest mismatch", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "topology-component", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  writeFileSync(b.svg, readFileSync(b.svg, "utf8").replace("</svg>", "<!-- tamper --></svg>"));
  const v = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(v.code, 0, v.out);
  assert.match(v.out, /digest/i);
  drop(pkg);
});

test("G-8: when the KO and EN entity sets diverge, the pair verify catches it", () => {
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

// --- the font delivery boundary ---------------------------------------------------------
test("G-9: without the pinned toolchain, portable fails rather than leaking into a full embed or a system fallback", () => {
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
  // (1) when the interpreter itself is absent
  const missing = run(path.join(path.dirname(pkg), "no-such-python"));
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout + missing.stderr, /build-only dependency/);
  assert.equal(existsSync(svg), false, "an artifact must not survive a failure");
  // (2) when the interpreter is present but the pinned library is not
  const bare = run("/usr/bin/python3");
  assert.notEqual(bare.status, 0);
  assert.match(bare.stdout + bare.stderr, /pinned build dependency missing|does not match the pinned/);
  assert.equal(existsSync(svg), false);
  drop(pkg);
});

test("G-9b: when the declared tool version differs from the one actually running, acceptance generation fails", () => {
  const sub = process.env.SVGINFO_PYTHON;
  if (!sub || !existsSync(sub)) { console.error("  note: no pinned interpreter — the version comparison is unverified in this run"); return; }
  const pkg = pkgCopy();
  const pol = path.join(pkg, "references", "delivery", "font-delivery-v1.yaml");
  writeFileSync(pol, readFileSync(pol, "utf8").replace("version: 4.53.1", "version: 9.9.9"));
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--font-delivery", "portable"]);
  assert.notEqual(b.code, 0, b.out);
  assert.match(b.out, /does not match the pinned/);
  drop(pkg);
});

test("G-10: a system artifact is marked environment-dependent and is not acceptance-grade", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const fd = JSON.parse(readFileSync(b.rcp, "utf8")).fontDelivery;
  assert.equal(fd.mode, "system");
  assert.equal(fd.grade, "environment-dependent");
  assert.equal(fd.faces.length, 0);
  assert.ok(fd.policyDigest && fd.typographyProfileDigest, "which policy and font profile it was built with must be recorded");
  drop(pkg);
});

test("G-11: a portable artifact embeds the subset and records the evidence (when the pinned subsetter is present)", () => {
  const sub = process.env.SVGINFO_PYFTSUBSET;
  if (!sub || !existsSync(sub)) { console.error("  note: no pinned subsetter — the portable positive path is unverified in this run"); return; }
  const pkg = pkgCopy();
  const b = build(pkg, "cards-kpi-grid", "canonical", "ko", ["--font-delivery", "portable"]);
  assert.equal(b.code, 0, b.out);
  const rcv = JSON.parse(readFileSync(b.rcp, "utf8"));
  assert.equal(rcv.fontDelivery.grade, "acceptance");
  assert.equal(rcv.fontDelivery.faces.length, 2, "both declared faces, 400 and 700, must be embedded");
  const svg = readFileSync(b.svg, "utf8");
  assert.match(svg, /@font-face\{font-family:'[^']+'/);
  assert.ok(!/@font-face\{font-family:'[^']*Pretendard/i.test(svg), "a subset may not use the Reserved Font Name");
  drop(pkg);
});

test("G-12: disturbing the layer order of a connector-free artifact makes verify end non-zero", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "layer-stack", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const clean = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.equal(clean.code, 0, clean.out);
  // move the annotations layer to the very front — the geometry is unchanged and only the paint order breaks
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

test("G-13: deleting the SVG inventory along with it is still caught by a verify recomputed from the input", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "before-after", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  // remove the group annotation and the inventory entry **together** — the artifact is internally self-consistent
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

test("G-14: in an incomplete grid, an axis with a single participant forms no group", () => {
  const pkg = pkgCopy();
  // nine cells in three columns is a complete grid — every row and column has three
  const b = build(pkg, "decision-matrix", "stress-cardinality", "ko");
  assert.equal(b.code, 0, b.out);
  const svg = readFileSync(b.svg, "utf8");
  const inv = (svg.match(/data-align-inventory="([^"]*)"/) ?? [])[1];
  assert.ok(inv && !/=1(;|$)/.test(inv), `singleton group must not appear in the inventory: ${inv}`);
  drop(pkg);
});

// --- decision-matrix: axis direction and cell placement must derive from the axis values -----
// When position came from array order, the "low" row could rise to the top and no gate rang.
// The three tests below pin that regression at three different levels.

test("G-15: the axis values decide the position — swapping the high and low rows makes verify refuse", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  // swap only the y coordinates of the two rows — labels and axes are untouched, so the artifact looks fine on its own
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

test("G-16: an axis direction marker at the opposite end is refused", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  // move the y-axis marker to the bottom end — the line and the labels stay as they are
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

test("G-17: flipping the axis direction and the labels together is still refused when the cell placement disagrees", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  // Flip everything so the artifact is **entirely self-consistent** on its own: positive=down,
  // the marker at the bottom end, the two endpoint labels swapped, and the cell rows swapped too.
  // Without the "y grows upward" contract and the original axis values, this artifact would pass.
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
  // Two levels catch it together: the axis direction contract (up is positive) and the actual position the input axis values fix.
  assert.match(r.out, /E-GEN-AXIS/);
  assert.match(r.out, /E-GEN-MATRIX-PLACE/);
  drop(pkg);
});

test("G-18: an ordinal axis is not a connector — it is not a subject of the routing audit", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "decision-matrix", "canonical", "ko");
  const svg = readFileSync(b.svg, "utf8");
  const axisBlock = svg.slice(svg.indexOf('data-layout-role="axis"'));
  assert.ok(!/data-route-(id|from|to|kind)=/.test(axisBlock), "axis must not carry connector classification");
  assert.ok(!/marker-end="url\(#ah-/.test(axisBlock), "axis must not reuse the connector arrowhead marker");
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  drop(pkg);
});

// --- roadmap-timeline: the input fixes position, and status reads without colour ------------
// What this type means is "order". So coordinates, order and marker position are all **recomputed
// from the original input** and compared.

const skinManifest = (pkg) => {
  const r = spawnSync(process.execPath, [path.join(pkg, "scripts", "skin.mjs"), "manifest"],
    { encoding: "utf8", cwd: path.join(pkg, "scripts") });
  return { code: r.status, out: r.stdout + r.stderr };
};
const tlEdit = (pkg, tid, fn) => {
  const f = path.join(pkg, "references", "types", "inputs", `roadmap-timeline.${tid}.yaml`);
  writeFileSync(f, fn(readFileSync(f, "utf8")));
};

test("G-19: even spacing is a computed value — moving one phase alone makes verify refuse", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  assert.equal(runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]).code, 0);
  const svg = readFileSync(b.svg, "utf8");
  // move one phase wholesale (underlay, dot, ring and label) — a self-consistent displacement
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

test("G-20: after_phase fixes the now-marker position — moving it is refused", () => {
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

test("G-21: an after_phase naming a phase that does not exist, or one that is not current, is refused at input", () => {
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

test("G-22: a marker present while the last phase is current is refused", () => {
  const pkg = pkgCopy();
  // put the marker back into a tail-current input — there is no ordinal interval left to place it after
  const marker = ['now_marker:', '  after_phase: "phase-4"', '  label:', /* lang-allow: ko-fixture */ '    ko: "지금"', '    en: "Now"', ''].join("\n");
  tlEdit(pkg, "stress-tail-current", (s) => s.trimEnd() + "\n" + marker);
  const r = skinManifest(pkg);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /no ordinal interval follows it/);
  drop(pkg);
});

test("G-23: a status contradicting the temporal order is refused", () => {
  const pkg = pkgCopy();
  // change done to future so that a future comes before the current one
  tlEdit(pkg, "canonical", (s) => s.replace('status: "done"', 'status: "future"'));
  const r = skinManifest(pkg);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /done\* → current → future\*/);
  drop(pkg);
});

test("G-24: status is not distinguished by colour alone — an invisible ring is refused", () => {
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

test("G-25: the timeline receipt is an exact schema — omissions, additions, wrong types, wrong lengths and union contradictions are refused", () => {
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

test("G-26: the date domain does not belong to this type — an input bringing it is refused", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  tlEdit(pkg, "canonical", (s) => s.replace('  - id: "phase-1"', '  - id: "phase-1"\n    date: "2026-01-01"'));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  drop(pkg);
});

test("G-27: the axis must be drawn behind every state marker — reversing the order is refused", () => {
  const pkg = pkgCopy();
  const b = build(pkg, "roadmap-timeline", "canonical", "ko");
  assert.equal(b.code, 0, b.out);
  const svg = readFileSync(b.svg, "utf8");
  // move the axis rect after the dots — the coordinates are unchanged, so a geometry check alone would not catch it
  const ax = svg.match(/<rect[^>]*data-axis="x"[^>]*\/>/)[0];
  writeFileSync(b.svg, svg.replace(ax, "").replace("</svg>", `${ax}\n</svg>`));
  const r = runIn(pkg, ["verify", "--receipt", b.rcp, "--svg", b.svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TL-LAYER/);
  drop(pkg);
});

test("G-28: a transparent future dot is refused — the axis rail shows through", () => {
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

// --- the treatment axis: sketch is proven by the artifact, not by its name ------------------
// flat is canonical and the default; sketch is an opt-in experimental preview. The tests below pin
// whether that boundary holds in the **artifact** rather than in the name.

const TX = ["--treatment", "sketch", "--font-delivery", "portable"];
const hasSubsetter = () => Boolean(process.env.SVGINFO_PYTHON && existsSync(process.env.SVGINFO_PYTHON));

test("G-29: a treatment the registry does not allow is refused", () => {
  const pkg = pkgCopy();
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "watercolour", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /unknown treatment/);
  drop(pkg);
});

test("G-30: dark with sketch is refused as an unsupported combination", () => {
  const pkg = pkgCopy();
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "sketch", "--mode", "dark", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /unsupported combination: dark \+ sketch/);
  drop(pkg);
});

test("G-31: with the overlay missing from the registry, sketch cannot be selected", () => {
  const pkg = pkgCopy();
  const reg = path.join(pkg, "references", "skins", "registry.yaml");
  writeFileSync(reg, readFileSync(reg, "utf8").replace(/^overlays:\n  sketch: .*$/m, "overlays: {}"));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", "--treatment", "sketch", "--out", out(pkg, "x.svg"), "--receipt", out(pkg, "x.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /not selected by the skin registry/);
  drop(pkg);
});

test("G-32: even a partially missing sketch structure is refused by verify", () => {
  if (!hasSubsetter()) { console.error("  note: no pinned subsetter — the sketch-structure negative is unverified"); return; }
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

test("G-33: a sketch receipt cannot pass off a flat artifact (the silent flat fallback)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const fsvg = out(pkg, "f.svg"), frcp = out(pkg, "f.json");
  const ssvg = out(pkg, "s.svg"), srcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko",
    "--font-delivery", "portable", "--out", fsvg, "--receipt", frcp]).code, 0);
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko",
    ...TX, "--out", ssvg, "--receipt", srcp]).code, 0);
  // flat and sketch must genuinely be different artifacts — a changed name alone is not a treatment
  assert.notEqual(readFileSync(fsvg, "utf8"), readFileSync(ssvg, "utf8"));
  // a sketch receipt plus a flat artifact is the quiet fallback. It must be refused.
  const s = JSON.parse(readFileSync(srcp, "utf8"));
  s.artifactDigest = JSON.parse(readFileSync(frcp, "utf8")).artifactDigest;
  writeFileSync(srcp, JSON.stringify(s));
  const r = runIn(pkg, ["verify", "--receipt", srcp, "--svg", fsvg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TX-STRUCT|E-TX-FLAT/);
  drop(pkg);
});

test("G-34: in a portable sketch the embedded alias leads the stack (no implicit fallback)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]).code, 0);
  const text = readFileSync(svg, "utf8");
  assert.match(text, /style="font-family:'SkinSans-Subset','Hi Melody'/);
  assert.match(text, /@font-face/);
  // dropping the alias out of the stack makes it depend on an installed font — it must be refused
  writeFileSync(svg, text.replace(/font-family:'SkinSans-Subset',/, "font-family:"));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-TX-FONT/);
  drop(pkg);
});

// --- allowedPortInterval: the router consumes the interval the layout proved --------------------

test("G-35: a port outside the interval is refused by verify", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  assert.equal(runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]).code, 0);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  const pc = t.routing.portConstraints;
  assert.ok(pc?.length, "a sketch topology must declare its entry interval");
  // move the chosen port outside the interval (leaving the declaration alone) — re-measurement must catch it
  const text = readFileSync(svg, "utf8");
  const m = new RegExp(`data-route-id="${pc[0].edge}"[^>]*?\\sd="(M[^"]+)"`).exec(text);
  // shift the whole path left — the attach x must end up outside the interval
  const moved = m[1].replace(/([ML])([\d.]+)/g, (_, cmd, x) => `${cmd}${Number(x) - 200}`);
  writeFileSync(svg, text.replace(`d="${m[1]}"`, `d="${moved}"`));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /E-PORT-INTERVAL/);
  drop(pkg);
});

test("G-36: an interval declaration exceeding the node's port range is refused", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  t.routing.portConstraints[0].allowed.hi += 500;   // claiming to allow positions outside the node
  writeFileSync(rcp, JSON.stringify(t));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /leaves the port range|recomputes/);
  drop(pkg);
});

test("G-37: an interval that does not satisfy the label clearance is refused", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  t.routing.portConstraints[0].allowed.lo -= 120;   // claiming the interval was widened toward the label
  writeFileSync(rcp, JSON.stringify(t));
  const r = runIn(pkg, ["verify", "--receipt", rcp, "--svg", svg]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /recomputes/);
  drop(pkg);
});

test("G-38: routing succeeds even when the legal interval lies outside the old sweep (evidence the interval is consumed)", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const svg = out(pkg, "s.svg"), rcp = out(pkg, "s.json");
  const b = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", svg, "--receipt", rcp]);
  assert.equal(b.code, 0, b.out);
  const t = JSON.parse(readFileSync(rcp, "utf8"));
  // even as the handwriting grows and the labels widen, all three edges must survive
  assert.equal(t.routing.routes.length, 3, "every edge must still route at 1.8x");
  assert.equal(t.routing.problems.length, 0);
  for (const c of t.routing.portConstraints) assert.ok(c.allowed.hi > c.allowed.lo, "the interval is finite and non-empty");
  drop(pkg);
});

test("G-39: straight-first and determinism hold under the interval too", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  const a = out(pkg, "a.svg"), ar = out(pkg, "a.json"), c = out(pkg, "c.svg"), cr = out(pkg, "c.json");
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", a, "--receipt", ar]);
  runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical", "--locale", "ko", ...TX, "--out", c, "--receipt", cr]);
  assert.equal(readFileSync(a, "utf8"), readFileSync(c, "utf8"), "the same input must give the same artifact");
  const t = JSON.parse(readFileSync(ar, "utf8"));
  for (const rt of t.routing.routes) assert.equal(rt.path, "straight", `${rt.id} must be straight (no needless dogleg)`);
  assert.equal(t.routing.problems.length, 0);
  drop(pkg);
});

test("G-40: when the candidate count passes the safety cap it fails explicitly rather than truncating quietly", async () => {
  const { routeEdges, ROUTE_DEFAULTS } = await import("./route-orthogonal.mjs");
  const K = ROUTE_DEFAULTS;
  // derived candidate count = floor((hi-lo)/portSpreadStep)+1. Passing the cap of 64 needs an overlap wider than 768px.
  const W = (64 + 4) * K.portSpreadStep;                 // 816px -> 69 candidates
  const nodes = { a: { x: 0, y: 0, w: W, h: 60 }, b: { x: 0, y: 300, w: W, h: 60 } };
  const plan = { classified: [{ id: "e1", from: "a", to: "b", weight: "primary", dashed: false }] };
  const r = routeEdges({ nodes, zones: [], plan, frame: { x: -20, y: -20, w: W + 40, h: 420 }, degradeLevel: 0 });
  assert.ok(r.problems.some((p) => /safety cap/.test(p)),
    `passing the cap must be an explicit failure: problems=${JSON.stringify(r.problems)} routes=${r.routes.length}`);
  assert.ok((r.diagnostics ?? []).some((d) => d.code === "R-CANDIDATE-CAP"), "an R-CANDIDATE-CAP diagnostic must be recorded");
  assert.equal(r.routes.length, 0, "it is not treated as a success after truncation");
});

test("G-41: a residual declaration with no entry for the treatment fails closed", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  // delete the sketch entry — reusing the flat value to pass must not happen
  editManifest(pkg, (t) => t.replace(/\n *- \{ treatment: sketch, calibration: [^}]*\}/, ""));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", out(pkg, "s.svg"), "--receipt", out(pkg, "s.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /declares no entry for treatment "sketch"/);
  drop(pkg);
});

test("G-42: a differing calibration ID means the residual declaration is not used", () => {
  if (!hasSubsetter()) return;
  const pkg = pkgCopy();
  editManifest(pkg, (t) => t.replace("calibration: hi-melody-optical-v1", "calibration: hi-melody-optical-v0"));
  const r = runIn(pkg, ["build", "--typepack", "topology-component", "--case", "canonical",
    "--locale", "ko", ...TX, "--out", out(pkg, "s.svg"), "--receipt", out(pkg, "s.json")]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /declares no entry for treatment "sketch"/);
  drop(pkg);
});

test("G-43: the residual is an exact match — smaller than declared does not pass either", () => {
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
