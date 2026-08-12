// check-svg.test.mjs — dependency-free fixture tests for the source lint gate.
// Run with: node --test skills/svg-infographic/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { lintSvg } from "./check-svg.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");
const lint = (name) => lintSvg(fixture(name), name);
const rulesOf = (findings) => findings.map((f) => f.rule);

test("valid fixture passes with no errors and no warnings", () => {
  const { errors, warnings } = lint("valid.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("dangling attribute and CSS references are hard errors", () => {
  const { errors } = lint("dangling-ref.svg");
  const dangling = errors.filter((f) => f.rule === "E-REF");
  const targets = dangling.map((f) => f.message);
  assert.ok(targets.some((m) => m.includes("#missing-grad")), "fill url(#…) reference");
  assert.ok(targets.some((m) => m.includes("#missing-symbol")), "use href reference");
  assert.ok(targets.some((m) => m.includes("#missing-marker")), "CSS marker-end reference");
});

test("CSS dangling reference reports the real source line of its <style> content (R1-F2)", () => {
  const { errors } = lint("dangling-ref.svg");
  const cssRef = errors.find((f) => f.rule === "E-REF" && f.message.includes("#missing-marker"));
  assert.equal(cssRef.line, 2, "the CSS marker-end reference sits on line 2 of the fixture");
});

test("referenced marker without markerUnits=userSpaceOnUse is a hard error with a migration fix", () => {
  const { errors } = lint("missing-marker-units.svg");
  const marker = errors.filter((f) => f.rule === "E-MARKER");
  assert.equal(marker.length, 1);
  assert.match(marker[0].message, /effective head ≈ 30px at stroke-width 3/);
  assert.match(marker[0].fix, /multiply markerWidth\/markerHeight by 3/);
});

test("explicit user-space head far beyond the contract is a hard error", () => {
  const { errors } = lint("oversized-head.svg");
  assert.ok(rulesOf(errors).includes("E-HEADSIZE"));
});

test("visible-geometry contract: canonical open-V at 4.5× shaft viewport is clean (R2 correction)", () => {
  const { errors, warnings } = lint("valid.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("undersized visible head (old flat 8px recipe on 2.5px shaft) warns as too weak", () => {
  const { errors, warnings } = lint("undersized-head.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /below the ≈3× aim/);
  assert.match(w[0].message, /visible head ≈ 5.3px/);
});

test("oversized visible head (old sketch 22.5px recipe on 2.5px shaft) is a hard error", () => {
  const { errors } = lint("oversized-visible-head.svg");
  const e = errors.filter((f) => f.rule === "E-HEADSIZE");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /visible head ≈ 15px \(6× its 2.5px shaft/);
});

test("curve-glyph marker never hard-errors from control-point bounds; it warns as unverified (R2-P1)", () => {
  const { errors, warnings } = lint("curve-head-unverified.svg");
  assert.deepEqual(errors, [], "a normally sized curved glyph must not produce a false hard error");
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /unverified from source \(curve\/arc commands in glyph path\)/);
});

test("relative-path marker cannot pass silently regardless of size (R2-P1)", () => {
  const { errors, warnings } = lint("relative-path-oversized.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1, "an unproven referenced marker always carries an actionable warning");
  assert.match(w[0].message, /relative path commands in glyph/);
});

test("huge viewport with a proven small glyph is judged by visible ratio only — no viewport backstop error (R3-P1)", () => {
  const { errors, warnings } = lint("huge-viewport-small-glyph.svg");
  // markerWidth 40 (>36) but visible = 40 × 8/40 = 8px on a 2.5px shaft = 3.2× → clean.
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("unproven marker with an extreme viewport stays a warning, never a hard error (R3-P1)", () => {
  const { errors, warnings } = lint("unproven-extreme-viewport.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /viewport is extreme/);
});

test("exponent-notation coordinates are downgraded to unproven, not mis-computed (R3-P1)", () => {
  const { errors, warnings } = lint("exponent-coords.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /exponent notation in glyph coordinates/);
});

test("explicit preserveAspectRatio (slice) is downgraded to unproven, not run through meet arithmetic (R3-P1)", () => {
  const { errors, warnings } = lint("par-slice.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /explicit preserveAspectRatio "xMidYMid slice"/);
});

test("a shared marker is judged per stroke width — the thick shaft never masks the thin-shaft violation (R4-P1)", () => {
  const { errors } = lint("multi-stroke-thin-violation.svg");
  const e = errors.filter((f) => f.rule === "E-HEADSIZE");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /5× its 2px shaft/);
  assert.match(e[0].message, /also referenced at 4px/);
});

test("explicit exponent markerWidth is downgraded to unproven, never replaced by the default 3 (R4-P2)", () => {
  const { errors, warnings } = lint("exponent-markerwidth.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /explicit markerWidth\/markerHeight is not a plain decimal number/);
});

test("a reference with an unresolvable stroke width is surfaced separately, not silently passed (R4-P1)", () => {
  const { errors, warnings } = lint("unknown-stroke-ref.svg");
  assert.deepEqual(errors, []);
  const w = warnings.filter((f) => f.rule === "W-HEADSIZE");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /stroke-width could not be resolved/);
});

test("inline-style-only marker reference is collected — the R4 bypass hard-errors (R5)", () => {
  const { errors } = lint("inline-style-oversized.svg");
  const e = errors.filter((f) => f.rule === "E-HEADSIZE");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /6× its 2.5px shaft/);
});

test("marker-end and stroke-width in separate CSS rules compose to a known ratio (R5)", () => {
  const { errors, warnings } = lint("split-css-rules.svg");
  const e = errors.filter((f) => f.rule === "E-HEADSIZE");
  assert.equal(e.length, 1, "visible 10px on the 2px shaft must be a known 5× violation, not unknown");
  assert.match(e[0].message, /5× its 2px shaft/);
  assert.ok(!warnings.some((f) => f.message.includes("could not be resolved")));
});

test("known violation and unknown reference coexist: one hard error plus one unknown-use warning (R5)", () => {
  const { errors, warnings } = lint("mixed-known-unknown.svg");
  const e = errors.filter((f) => f.rule === "E-HEADSIZE");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /5× its 2px shaft/);
  const w = warnings.filter((f) => f.message.includes("could not be resolved"));
  assert.equal(w.length, 1);
});

test("a shared marker whose every known width sits in band is clean (R5)", () => {
  const { errors, warnings } = lint("multi-stroke-all-clean.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("an unused CSS marker rule creates no marker finding (R5)", () => {
  const { errors, warnings } = lint("unused-css-rule.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("a percentage filter on collinear horizontal connectors is a hard error (C4 filter-bounds)", () => {
  const { errors } = lint("filtered-horizontal-connectors.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /zero height \(collinear horizontal strokes\)/);
  assert.match(e[0].fix, /filterUnits="userSpaceOnUse"/);
});

test("a percentage filter on collinear vertical connectors is a hard error (C4 filter-bounds)", () => {
  const { errors } = lint("filtered-vertical-connectors.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /zero width \(collinear vertical strokes\)/);
});

test("a curved connector under the same filter produces no false finding (C4 filter-bounds)", () => {
  const { errors, warnings } = lint("filtered-curved-connector.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"));
  assert.ok(!warnings.some((f) => f.rule === "E-FILTERBOUNDS"));
});

test("an explicit userSpaceOnUse filter region on the same degenerate strokes is accepted (C4 filter-bounds)", () => {
  const { errors } = lint("filtered-safe-userspace.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"));
});

test("a userSpaceOnUse filter with an explicit zero-height region is a hard error (C4-R2-P1)", () => {
  const { errors } = lint("filtered-userspace-zero-region.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /non-positive height="0"/);
});

test("an unsafe CSS/id filter overriding a safe presentation attribute is caught (C4-R2-P1)", () => {
  const { errors } = lint("filtered-css-override-unsafe.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1, "CSS filter must win over the safe presentation attribute");
  assert.match(e[0].message, /references #rough/);
});

test("unpainted geometry (stroke=none) under a percentage filter produces no false finding (C4-R2-P2)", () => {
  const { errors } = lint("filtered-unpainted-strokes.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"), "stroke=none paints nothing, so nothing can be dropped");
});

test("a negative userSpaceOnUse region dimension is a hard error (C4-R3-P1)", () => {
  const { errors } = lint("filtered-userspace-negative-region.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /non-positive height="-1"/);
});

test("a 0% userSpaceOnUse region dimension is a hard error (C4-R3-P1)", () => {
  const { errors } = lint("filtered-userspace-percent-zero-region.svg");
  const e = errors.filter((f) => f.rule === "E-FILTERBOUNDS");
  assert.equal(e.length, 1);
  assert.match(e[0].message, /non-positive height="0%"/);
});

test("stroke-width:0 is unpainted, so a degenerate filtered group produces no false finding (C4-R3-P2)", () => {
  const { errors } = lint("filtered-zero-strokewidth.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"), "a zero-width stroke draws nothing");
});

test("an unresolved stroke-width is not assumed painted — no false hard error (C4-R3-P2)", () => {
  const { errors } = lint("filtered-unresolved-strokewidth.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"), "an unprovable stroke width must not force a finding");
});

test("an unsupported userSpaceOnUse region dimension (calc) is an unverified warning, never a silent pass (C4-R4)", () => {
  const { errors, warnings } = lint("filtered-userspace-calc-region.svg");
  assert.ok(!errors.some((f) => f.rule === "E-FILTERBOUNDS"), "calc() must not be a hard error — the lint has no calc evaluator");
  const w = warnings.filter((f) => f.rule === "W-FILTERBOUNDS");
  assert.equal(w.length, 1);
  assert.match(w[0].message, /unsupported height="calc\(0px\)"/);
});

test("clear Latin overflow is a hard error with measured values", () => {
  const { errors } = lint("latin-overflow.svg");
  const overflow = errors.filter((f) => f.rule === "E-TEXT");
  assert.equal(overflow.length, 1);
  assert.match(overflow[0].message, /overflows its box right edge/);
  assert.match(overflow[0].message, /est\. width/);
});

test("CJK weighting catches Korean overflow that a Latin-width estimate would miss", () => {
  const { errors } = lint("korean-overflow.svg");
  assert.ok(rulesOf(errors).includes("E-TEXT"));
  // Same character count in Latin at the same size would fit the 220px box:
  const text = "근거와 종료 조건이 남는 검토 워크플로";
  const latinEquivalent = "a".repeat([...text].length);
  const swapped = fixture("korean-overflow.svg").replace(text, latinEquivalent);
  const { errors: latinErrors } = lintSvg(swapped, "korean-as-latin.svg");
  assert.ok(!rulesOf(latinErrors).includes("E-TEXT"), "latin-width estimate alone must not trip the error");
});

test("non-translate transform degrades to a warning, never an error", () => {
  const { errors, warnings } = lint("warning-transform.svg");
  assert.deepEqual(errors, []);
  assert.ok(rulesOf(warnings).includes("W-TEXT"));
});

test("explicit layout budgets accept two headers and four centered icon-text cards", () => {
  const { errors, warnings } = lint("layout-budget-valid.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});










test("explicit layout budgets reject header collisions and card-center drift before rendering", () => {
  const { errors } = lint("layout-budget-invalid.svg");
  const layout = errors.filter((f) => f.rule === "E-LAYOUT");
  assert.equal(layout.length, 6, "two invalid headers plus four invalid cards");
  assert.equal(layout.filter((f) => f.message.includes("panel-header vertical budget failed")).length, 2);
  assert.equal(layout.filter((f) => f.message.includes("icon-text-card center alignment failed")).length, 4);
});

test("layout contracts reject multi-line collisions, frame drift, incomplete roles, and divider ink overflow", () => {
  const { errors, warnings } = lint("layout-budget-contract-invalid.svg");
  const layout = errors.filter((f) => f.rule === "E-LAYOUT");
  assert.equal(layout.length, 8);
  assert.equal(layout.filter((f) => f.message.includes("panel-header vertical budget failed")).length, 2);
  assert.equal(layout.filter((f) => f.message.includes("icon-text-card center alignment failed")).length, 2);
  assert.equal(layout.filter((f) => f.message.includes("icon-text-card contract requires")).length, 4);
  assert.ok(layout.some((f) => f.message.includes("at least one measurable line")));
  assert.deepEqual(warnings.filter((f) => f.rule === "W-LAYOUT"), []);
});

test("unsupported layout geometry warns while defs and explicit opt-outs stay outside the contract", () => {
  const { errors, warnings } = lint("layout-budget-unverified.svg");
  assert.deepEqual(errors.filter((f) => f.rule === "E-LAYOUT"), []);
  const layout = warnings.filter((f) => f.rule === "W-LAYOUT");
  assert.equal(layout.length, 5);
  assert.ok(layout.some((f) => f.message.includes("dominant-baseline")));
  assert.ok(layout.some((f) => f.message.includes("non-translate transform")));
  assert.ok(layout.some((f) => f.message.includes("tolerance 999px")));
  assert.ok(layout.some((f) => f.message.includes("below its divider")));
  assert.ok(layout.some((f) => f.message.includes("card frame needs plain y/height")));
});

test("CLI exits 0 on the valid fixture and 1 on a hard-error fixture", () => {
  const cli = join(here, "check-svg.mjs");
  const ok = spawnSync(process.execPath, [cli, join(here, "fixtures", "valid.svg")], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [cli, join(here, "fixtures", "missing-marker-units.svg")], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /E-MARKER/);
});

test("clean run writes the summary to stdout and nothing to stderr (PowerShell 5.1 noise guard)", () => {
  const cli = join(here, "check-svg.mjs");
  const ok = spawnSync(process.execPath, [cli, join(here, "fixtures", "valid.svg")], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /check-svg: 0 error\(s\), 0 warning\(s\)/);
  assert.equal(ok.stderr, "", "a clean run must not touch stderr");
});

// --- H-C header-cluster contract (canonical — replaces the legacy rail contract) --
test("header-cluster positive: KO one line with locator and subtitle", () => {
  const r = lint("header-cluster-ko1.svg");
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
});
test("header-cluster positive: KO two lines", () => {
  assert.equal(lint("header-cluster-ko2.svg").errors.length, 0);
});
test("header-cluster positive: subtitle omitted collapses cleanly", () => {
  assert.equal(lint("header-cluster-nosub.svg").errors.length, 0);
});
test("header-cluster positive: eyebrow omitted collapses locator too", () => {
  assert.equal(lint("header-cluster-collapse.svg").errors.length, 0);
});
test("header-cluster negative: locator without eyebrow fails closed", () => {
  const r = lint("header-cluster-locator-only.svg");
  assert.ok(r.errors.some((e) => /locator exists without an eyebrow/.test(e.message)));
});
test("header-cluster negative: locator outside the derived 0.5-0.7 band", () => {
  const r = lint("header-cluster-locator-ratio.svg");
  assert.ok(r.errors.some((e) => /derived band is 0.5–0.7×/.test(e.message)));
});
test("header-cluster negative: subtitle intruding into the H1", () => {
  const r = lint("header-cluster-subtitle-intrude.svg");
  assert.ok(r.errors.some((e) => /intrudes into the H1 bottom/.test(e.message)));
});
test("header-cluster negative: declared breathing budget violated", () => {
  const r = lint("header-cluster-breathing.svg");
  assert.ok(r.errors.some((e) => /breathing/.test(e.message)));
});

// --- CP3C: entrypoint parity, authoring bypass, palette profile matrix ----------
import { spawnSync as _spawn } from "node:child_process";
import { symlinkSync, mkdtempSync as _mkdtemp } from "node:fs";
import { tmpdir as _tmpdir } from "node:os";
const CLI = join(here, "check-svg.mjs");
const cli = (args) => { const r = _spawn(process.execPath, args.map((a) => (a.startsWith("--") || a.includes("/") || a.includes("current") || a.includes("legacy") ? a : join(here, "fixtures", a))), { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };
const cliRaw = (args) => { const r = _spawn(process.execPath, args, { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };

test("entrypoint guard: symlinked check-svg matches direct stdout and exit", () => {
  const dir = _mkdtemp(join(_tmpdir(), "sym-"));
  const link = join(dir, "check-svg-link.mjs");
  symlinkSync(CLI, link);
  const target = join(here, "fixtures", "missing-marker-units.svg");
  const direct = cliRaw([CLI, target]);
  const linked = cliRaw([link, target]);
  assert.equal(linked.code, direct.code);
  assert.equal(linked.code, 1, "invalid SVG must stay non-zero through the symlink");
  assert.equal(linked.out.replaceAll(link, CLI), direct.out);
});
test("entrypoint guard: symlinked render.mjs reaches main (usage parity)", () => {
  const RENDER = join(here, "render.mjs");
  const dir = _mkdtemp(join(_tmpdir(), "symr-"));
  const link = join(dir, "render-link.mjs");
  symlinkSync(RENDER, link);
  const direct = cliRaw([RENDER]);
  const linked = cliRaw([link]);
  assert.equal(linked.code, direct.code);
  assert.notEqual((linked.out || "").length, 0, "symlinked render must not exit silently");
});
test("bypass (a): paint on a defs group fails closed; direct paint passes", () => {
  const red = cliRaw([CLI, join(here, "fixtures", "bypass-defs-group-paint.svg")]);
  assert.equal(red.code, 1);
  assert.match(red.out, /E-BYPASS/);
  const ok = cliRaw([CLI, join(here, "fixtures", "bypass-defs-group-paint-ok.svg")]);
  assert.equal(ok.code, 0, ok.out);
});
test("bypass (b): font-size on a parent g is surfaced as a warning; own size stays clean", () => {
  const red = cliRaw([CLI, join(here, "fixtures", "bypass-g-font-size.svg")]);
  assert.match(red.out, /W-BYPASS/);
  const ok = cliRaw([CLI, join(here, "fixtures", "bypass-g-font-size-ok.svg")]);
  assert.ok(!/W-BYPASS/.test(ok.out));
});
const SKINFIX = join(here, "skin-fixtures");
test("palette matrix: baseline-red variable paint is explicitly rejected under current", () => {
  const r = cliRaw([CLI, "--palette-profile", "current", join(SKINFIX, "baseline-red-cssvar.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-PALETTE.*variable paint.*baseline-red/);
});
test("palette matrix: annotated portable positive passes under current (static exempt)", () => {
  const r = cliRaw([CLI, "--palette-profile", "current", join(SKINFIX, "portable-positive.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("palette matrix: unannotated canonical hex escalates to an error under current", () => {
  const r = cliRaw([CLI, "--palette-profile", "current", join(SKINFIX, "unannotated-canonical-hex.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-PALETTE.*without a role annotation/);
});
test("palette matrix: out-of-profile hex warns (error escalation waits for Wave 1)", () => {
  const r = cliRaw([CLI, "--palette-profile", "current", join(here, "fixtures", "palette-out-of-profile.svg")]);
  assert.equal(r.code, 0);
  assert.match(r.out, /W-PALETTE.*outside the current-v1 profile/);
});
test("palette matrix: the frozen legacy graphic passes its own allowlist and rejects foreign hex", () => {
  const legacy = join(here, "..", "..", "..", "examples", "svg-infographic", "release-announcement", "skillstead-v080-runtime-support.ko.svg");
  const ok = cliRaw([CLI, "--palette-profile", "legacy-v0.8", legacy]);
  assert.equal(ok.code, 0, ok.out);
  const red = cliRaw([CLI, "--palette-profile", "legacy-v0.8", join(SKINFIX, "unannotated-canonical-hex.svg")]);
  assert.equal(red.code, 1);
  assert.match(red.out, /outside the frozen legacy/);
});
test("palette matrix: an unknown profile fails closed", () => {
  const r = cliRaw([CLI, "--palette-profile", "nope", join(here, "fixtures", "valid.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown palette profile/);
});
test("palette matrix: omitted profile runs no palette checks in Wave 0 (default flips at Wave 1)", () => {
  const r = cliRaw([CLI, join(SKINFIX, "unannotated-canonical-hex.svg")]);
  assert.equal(r.code, 0);
});
