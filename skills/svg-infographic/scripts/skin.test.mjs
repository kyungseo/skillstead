// skin.mjs test suite — materializer parity + schema/profile negative fixtures.
// Durable fixtures live in scripts/skin-fixtures/ (skins-negative/ mirrors the real
// profiles plus deliberate defects and is consumed via the SKIN_SKINS_DIR override).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKIN = path.join(here, "skin.mjs");
const FIX = path.join(here, "skin-fixtures");
const NEG = path.join(FIX, "skins-negative");
const CUR = path.join(here, "..", "references", "skins", "current-v1.yaml");

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [SKIN, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}

// --- CLI strictness -----------------------------------------------------------
test("option typo is rejected non-zero", () => {
  const r = run(["resolve", CUR, "--mdoe", "dark"]);
  assert.equal(r.code, 2);
  assert.match(r.out, /unknown option/);
});
test("duplicate option is rejected", () => {
  const r = run(["resolve", CUR, "--mode", "light", "--mode", "dark"]);
  assert.equal(r.code, 2);
});
test("valueless option is rejected", () => {
  const r = run(["resolve", CUR, "--mode"]);
  assert.equal(r.code, 2);
});
test("dark + sketch is an unsupported combination", () => {
  const r = run(["resolve", CUR, "--mode", "dark", "--treatment", "sketch"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unsupported combination/);
});

// --- profile negatives (SKIN_SKINS_DIR isolation) ------------------------------
const neg = (file, re, extraEnv = {}) => {
  const r = run(["validate", path.join(NEG, file)], { SKIN_SKINS_DIR: NEG, ...extraEnv });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, re);
};
test("candidate palette failing a contrast gate is rejected", () => neg("bad-contrast.yaml", /contrast on-focus\/focus/));
test("missing required role is rejected", () => neg("missing-role.yaml", /missing required role "canvas"/));
test("unknown anchor key is rejected", () => neg("anchors-unknown.yaml", /anchors: unknown key "tertiary"/));
test("extends with a non-kebab id is rejected", () => neg("extends-bad-id.yaml", /extends: invalid id/));
test("derivation with an invalid alias target is rejected", () => neg("bad-alias-target.yaml", /invalid source "rainbow"/));
test("derivation ratio out of [0,1] is rejected", () => neg("ratio-oob.yaml", /out of range/));
test("overlay missing a required token is rejected", () => neg("overlay-missing-token.yaml", /missing token "highlight"/));
test("overlay with an unexpected token is rejected", () => neg("overlay-unexpected-token.yaml", /unexpected token "glitter"/));
test("palette validation fails when the sibling derivation is defective", () => {
  // registry in NEG selects derivation-v1 (valid); point a copy at the broken one
  const dir = mkdtempSync(path.join(tmpdir(), "skins-"));
  for (const f of ["current-v1.yaml", "sketch-overlay-v1.yaml", "legacy-v0.8.yaml"]) copyFileSync(path.join(NEG, f), path.join(dir, f));
  copyFileSync(path.join(NEG, "bad-alias-target.yaml"), path.join(dir, "derivation-v1.yaml"));
  writeFileSync(path.join(dir, "derivation-v1.yaml"),
    readFileSync(path.join(NEG, "bad-alias-target.yaml"), "utf8").replace("id: bad-alias-target", "id: derivation-v1"));
  writeFileSync(path.join(dir, "registry.yaml"), readFileSync(path.join(NEG, "registry.yaml"), "utf8"));
  const r = run(["validate", path.join(dir, "current-v1.yaml")], { SKIN_SKINS_DIR: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /invalid source/);
});

// --- registry ------------------------------------------------------------------
test("registry validates slots and current uniqueness", () => {
  const r = run(["registry"]);
  assert.equal(r.code, 0, r.out);
});
test("resolve current uses the registry selection and reports it", () => {
  const r = run(["resolve", "current", "--mode", "light", "--json"]);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.registry.selectionBasis, "registry-current");
  assert.ok(j.contrast.light.length > 0, "resolve receipt must include the selected-mode contrast matrix");
  assert.ok(j.resolvedDigest);
});

// --- materializer --------------------------------------------------------------
test("portable positive fixture verifies with zero updates", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive.svg"), "--check", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.errors.length, 0);
  assert.ok(j.verified >= 5);
  assert.equal(j.staticKept, 1); // data-paint-static preserved, not flagged
});
test("check mode fails closed on annotated paint mismatch", () => {
  const r = run(["materialize", path.join(FIX, "materialize-mismatch.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /paint mismatch: surface/);
});
test("unknown role annotation fails closed", () => {
  const r = run(["materialize", path.join(FIX, "materialize-unknown-role.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown role annotation/);
});
test("hand-typed canonical hex without annotation is warned", () => {
  const r = run(["materialize", path.join(FIX, "unannotated-canonical-hex.svg"), "--check", "--json"]);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.warnings.length, 1);
  assert.match(j.warnings[0], /unannotated canonical hex #2E6DA4/);
});
test("materialize rewrites mismatched paint deterministically (write path, temp copy)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mat-"));
  const f = path.join(dir, "m.svg");
  copyFileSync(path.join(FIX, "materialize-mismatch.svg"), f);
  const r = run(["materialize", f, "--json"]);
  assert.equal(r.code, 0, r.out);
  const after = readFileSync(f, "utf8");
  assert.match(after, /data-fill-role="surface" fill="#FFFFFF"/);
  const r2 = run(["materialize", f, "--check"]);
  assert.equal(r2.code, 0, "after materialize, check must pass (deterministic roundtrip)");
});
test("baseline-red CSS-variable fixture fails closed under --check (zero annotations)", () => {
  const r = run(["materialize", path.join(FIX, "baseline-red-cssvar.svg"), "--check", "--json"]);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.verified, 0);
  assert.match(j.errors[0], /zero recognized annotations/);
});
test("single-quoted annotations are recognized (positive)", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive-sq.svg"), "--check", "--json"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(JSON.parse(r.out).verified >= 2);
});
test("single-quoted annotated mismatch fails closed", () => {
  const r = run(["materialize", path.join(FIX, "materialize-mismatch-sq.svg"), "--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /paint mismatch: surface/);
});
test("materialize receipt carries kernelVersion and sourceDigest", () => {
  const r = run(["materialize", path.join(FIX, "portable-positive.svg"), "--check", "--json"]);
  const j = JSON.parse(r.out);
  assert.equal(j.kernelVersion, "kernel-v1");
  assert.match(j.sourceDigest, /^[0-9a-f]{16}$/);
});

// --- pageframe + 4 layout-family micro-fixtures -----------------------------------
function pageframe(args = []) {
  const r = run(["pageframe", "social-4x5", "--json", ...args]);
  assert.equal(r.code, 0, r.out);
  return JSON.parse(r.out);
}
test("pageframe reproduces the approved 4:5 header height (82px, B anchor)", () => {
  const j = pageframe();
  assert.equal(j.regions.headerRegion.h, 82);
  assert.equal(j.regions.footerRule, "bottom-safe-aligned");
});
test("pageframe collapse: no eyebrow + no subtitle shrinks the header and shifts content up", () => {
  const base = pageframe();
  const collapsed = pageframe(["--eyebrow", "off", "--subtitle", "off"]);
  assert.ok(collapsed.regions.headerRegion.h < base.regions.headerRegion.h - 30);
  assert.ok(collapsed.regions.contentBox.y < base.regions.contentBox.y);
});
test("pageframe side support splits contentBox + supportBox and shrinks width", () => {
  const j = pageframe(["--support", "side"]);
  assert.ok(j.regions.supportBox);
  assert.equal(j.regions.contentBox.w + 16 + 180, 648);
});
test("pageframe fluid document flows the footer after content", () => {
  const r = run(["pageframe", "document-compact", "--json"]);
  const j = JSON.parse(r.out);
  assert.equal(j.regions.fluid, true);
  assert.equal(j.regions.contentBox.h, null);
  assert.equal(j.regions.footerRule, "flows-after-content");
});
test("pageframe rejects an unknown preset", () => {
  const r = run(["pageframe", "nope"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown preset/);
});

const FAMILIES = ["mf-connector.svg", "mf-grid.svg", "mf-nested.svg", "mf-longcopy.svg"];
function shapes(file) {
  const text = readFileSync(path.join(FIX, file), "utf8");
  const out = [];
  for (const m of text.matchAll(/<(rect|text|path)\b[^>]*data-reading-order="(\d+)"[^>]*>/g)) {
    const tag = m[0];
    const g = (a) => { const mm = tag.match(new RegExp(`${a}="([^"]+)"`)); return mm ? mm[1] : null; };
    out.push({ tag: m[1], order: Number(m[2]), x: Number(g("x")), y: Number(g("y")),
               w: Number(g("width") ?? 0), h: Number(g("height") ?? 0), d: g("d"), sw: Number(g("stroke-width") ?? 0) });
  }
  return { text, els: out };
}
test("micro-fixtures: region containment inside the pageframe contentBox", () => {
  const cb = pageframe().regions.contentBox;
  for (const f of FAMILIES) {
    for (const e of shapes(f).els) {
      if (e.tag === "path") continue;
      assert.ok(e.x >= cb.x - 0.01 && e.y >= cb.y - 0.01 && e.x + e.w <= cb.x + cb.w + 0.01 && e.y + e.h <= cb.y + cb.h + 0.01,
        `${f}: element order ${e.order} escapes contentBox`);
    }
  }
});
test("micro-fixtures: DOM order matches declared reading order", () => {
  for (const f of FAMILIES) {
    const orders = shapes(f).els.map((e) => e.order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b), `${f}: DOM order != reading order`);
  }
});
test("micro-fixtures: direct-paint portability (materialize --check passes)", () => {
  for (const f of FAMILIES) {
    const r = run(["materialize", path.join(FIX, f), "--check"]);
    assert.equal(r.code, 0, `${f}: ${r.out}`);
  }
});
test("micro-fixtures: connector shafts and visible heads meet the preset minimums", () => {
  const arrow = pageframe().arrow;
  const { text, els } = shapes("mf-connector.svg");
  for (const e of els.filter((e) => e.tag === "path")) {
    assert.ok(e.sw >= arrow["min-shaft"], `shaft ${e.sw} below minimum`);
  }
  const mw = Number(text.match(/markerWidth="([\d.]+)"/)[1]);
  assert.ok(mw * 8 / 12 >= arrow["min-visible-head"], "visible head below minimum");
});

// --- pageframe fail-closed schema + fluid two-phase -------------------------------
function pfNeg(file, args, re) {
  const dir = mkdtempSync(path.join(tmpdir(), "pf-"));
  copyFileSync(path.join(NEG, file), path.join(dir, "pageframe-v1.yaml"));
  const r = run(["pageframe", "social-4x5", ...args], { SKIN_SKINS_DIR: dir });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, re);
}
test("pageframe rejects a non-numeric header size", () => pfNeg("pf-bad-number.yaml", [], /header\.h1 must be a positive number/));
test("pageframe rejects a missing gap subfield", () => pfNeg("pf-missing-subfield.yaml", [], /gaps\.breathing must be a positive number/));
test("pageframe rejects a reversed scale band", () => pfNeg("pf-band-order.yaml", [], /min < max/));
test("pageframe rejects broken arrow minimum relations", () => pfNeg("pf-arrow-order.yaml", [], /min-shaft <= secondary-shaft <= primary-shaft/));
test("pageframe rejects a canvas too small for the requested regions", () => pfNeg("pf-too-small.yaml", ["--support", "bottom", "--footer", "on"], /contentBox height is not positive/));
test("pageframe rejects an unknown preset field", () => pfNeg("pf-unknown-field.yaml", [], /unknown field "mystery"/));
test("fluid preset computes footer coordinates from --content-height (two-phase contract)", () => {
  const r = run(["pageframe", "document-compact", "--content-height", "600", "--support", "bottom", "--footer", "on", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out).regions;
  assert.equal(j.contentBox.h, 600);
  assert.ok(j.supportBottom.y > j.contentBox.y + 600 - 1);
  assert.ok(j.footerBox.y > j.supportBottom.y + j.supportBottom.h - 1);
  assert.ok(j.documentHeight > j.footerBox.y + j.footerBox.h - 1);
});
test("--content-height on a fixed canvas is rejected", () => {
  const r = run(["pageframe", "social-4x5", "--content-height", "500"]);
  assert.equal(r.code, 2);
});

test("pageframe rejects a preset missing header-internal", () => pfNeg("pf-missing-header-internal.yaml", [], /missing "header-internal"/));
test("pageframe rejects a negative header-internal gap", () => pfNeg("pf-bad-header-internal.yaml", [], /header-internal\.eyebrow-gap/));
test("canonical presets carry exact aspect ratios", () => {
  const s = pageframe();
  assert.equal(s.regions.headerRegion.w + 2 * 36, 720);
  const r45 = run(["pageframe", "social-4x5", "--json"]);
  const r169 = run(["pageframe", "presentation-16x9", "--json"]);
  const j45 = JSON.parse(r45.out), j169 = JSON.parse(r169.out);
  // 실제 preset 값(receipt canvas)으로 비율을 검증 — YAML이 다시 틀어지면 여기서 실패한다
  assert.equal(j45.canvas.width / j45.canvas.height, 4 / 5);
  assert.equal(j169.canvas.width / j169.canvas.height, 16 / 9);
  assert.equal(j45.orientation, "portrait");
  assert.equal(j169.orientation, "landscape");
});
test("pageframe regions never overlap (content/support/footer non-overlap fixture)", () => {
  for (const preset of ["social-4x5", "presentation-16x9"]) {
    for (const extra of [["--support", "bottom"], ["--support", "bottom", "--footer", "true"], ["--footer", "true"], []]) {
      const r = run(["pageframe", preset, ...extra, "--json"]);
      assert.equal(r.code, 0, r.out);
      const j = JSON.parse(r.out);
      const R = j.regions;
      const hdr = R.headerRegion, cb = R.contentBox;
      assert.ok(hdr.y + hdr.h <= cb.y, `${preset}: header overlaps content`);
      let after = j.canvas.height;
      if (R.footerBox) { assert.ok(R.footerBox.y + R.footerBox.h <= after, `${preset}: footer past canvas`); after = R.footerBox.y; }
      if (R.supportBottom) {
        assert.ok(R.supportBottom.y + R.supportBottom.h <= after, `${preset}: support overlaps footer/canvas`);
        after = R.supportBottom.y;
      }
      assert.ok(cb.y + cb.h <= after, `${preset} ${extra.join(" ")}: contentBox overlaps next region (${cb.y + cb.h} > ${after})`);
    }
  }
});

// --- typography profile SSoT -----------------------------------------------------
test("typography: canonical profile validates (fail-closed schema)", () => {
  const r = run(["typography"]);
  assert.equal(r.code, 0, r.out);
});
test("typography: registry가 current.typography를 선택한다", () => {
  const r = run(["registry", "--json"]);
  assert.equal(JSON.parse(r.out).errors.length, 0, r.out);
});
test("typography: synthetic 허용 시도는 거부", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-synthetic.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /synthetic must be "forbidden"/);
});
test("typography: 비수치 weight 거부", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-bad-weight.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /weights must be a non-empty list of numeric weights/);
});
test("typography: unknown field 거부", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-unknown-field.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown field "letter-spacing"/);
});
test("typography: locale 누락 거부", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-missing-locale.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /missing locale "en"/);
});
test("typography: resolve receipt에 결정적 stack이 동봉된다", () => {
  const r = run(["resolve", "current", "--mode", "light", "--treatment", "sketch", "--json"]);
  const j = JSON.parse(r.out);
  assert.equal(j.typography.stack, '"Hi Melody", Pretendard, sans-serif');
  assert.equal(j.typography.weightPolicy, "normalize-400");
  assert.equal(j.typography.synthetic, "forbidden");
  assert.ok(j.typography.profileDigest);
  const r2 = run(["resolve", "current", "--mode", "light", "--json"]);
  assert.equal(JSON.parse(r2.out).typography.stack.startsWith("Pretendard, Inter"), true);
});

// --- typography-check (composite wrapper 유실 방지) -----------------------
const TFIX = path.join(FIX, "typography");
test("typography-check: positive (alias 유지 + 명시적 secondary + weight 400)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-positive.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("typography-check: wrapper font-family 유실은 fail-closed", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-wrapper-lost.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST .*wrapper lost the typography alias/);
});
test("typography-check: regular-only face에 weight 700은 error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-weight-700.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-WEIGHT .*synthetic weights are forbidden/);
});
test("typography-check: annotation 없는 secondary fallback은 error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-secondary-unannotated.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST/);
});
test("typography-check: remote font src는 error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-remote-font.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-REMOTE/);
});
test("typography-check: 상위 g 상속 weight 700도 검출(F2)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-inherited-weight.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-WEIGHT .*inherited cascade included/);
});
test("typography-check: spaced/single-quote scope도 인식되어 유실 검출(F2)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-single-quote-scope.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST/);
});
test("typography-check: spaced double-quote 정상 조합은 통과(F2 동등성)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-spaced-scope-ok.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("typography-check: marker 존재 + scope text 0은 fail-closed(F2)", () => {
  const td = fs.mkdtempSync(path.join(os.tmpdir(), "typo-empty-"));
  const tmp = path.join(td, "empty.svg");
  let r;
  try {
    fs.writeFileSync(tmp, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-treatment="sketch"><rect width="10" height="10" fill="#FAF4EB"/></svg>');
    r = run(["typography-check", tmp]);
  } finally { fs.rmSync(td, { recursive: true, force: true }); }
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-EMPTY/);
});
test("typography-check: single-quote root sketch도 gate 대상(R1B2-1)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-sq-sketch-root.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST|E-TYPO-WEIGHT/);
});
test("typography: bundled인데 license.evidence 누락은 error(F8)", () => {
  const r = run(["typography", path.join(TFIX, "typo-missing-license-evidence.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /bundled asset requires license.evidence/);
});
test("typography: bundled asset의 digest mismatch는 error", () => {
  const base = fs.readFileSync(path.join(here, "..", "references", "typography", "typography-v1.yaml"), "utf8");
  const td = fs.mkdtempSync(path.join(os.tmpdir(), "typo-fixture-"));
  const tmp = path.join(td, "temp-digest.yaml");
  let r;
  try {
    fs.writeFileSync(tmp, base.replace(/digest: [0-9a-f]{64}/, "digest: " + "f".repeat(64)));
    r = run(["typography", tmp]);
  } finally { fs.rmSync(td, { recursive: true, force: true }); }
  assert.equal(r.code, 1);
  assert.match(r.out, /asset digest mismatch/);
});

// --- TypePack manifest validator -----------------------------------------
test("manifest: shipped (empty) manifest validates", () => {
  const r = run(["manifest"]);
  assert.equal(r.code, 0, r.out);
});
test("manifest: fixture-only typepack positive validates (full locked schema)", () => {
  const r = run(["manifest", path.join(FIX, "manifest-positive.yaml")]);
  assert.equal(r.code, 0, r.out);
});
test("manifest: unknown field is rejected (locked schema)", () => {
  const r = run(["manifest", path.join(FIX, "manifest-unknown-field.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown field "palette_hex"/);
});
test("manifest: unknown Foundation role is rejected", () => {
  const r = run(["manifest", path.join(FIX, "manifest-bad-role.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown role "brand-red"/);
});
test("manifest: duplicate id fails closed", () => {
  const r = run(["manifest", path.join(FIX, "manifest-dup-id.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate typepack id/);
});
test("manifest v2: composition capability positive", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-positive.yaml")]);
  assert.equal(r.code, 0, r.out);
});
test("manifest v2: composition unknown field 거부", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-unknown.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /composition unknown field "max_modules"/);
});
test("manifest v2: preferred_slot_aspect min>max 거부", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-bad-aspect.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /preferred_slot_aspect must be \{min, max\}/);
});
test("manifest v2: port direction enum 거부", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-bad-port.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /direction must be out\|in\|bidir/);
});
test("manifest v2: v1 manifest는 atomic upgrade 정책으로 거부", () => {
  const r = run(["manifest", path.join(FIX, "manifest-v1-rejected.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /schema_version must be 2/);
});
test("manifest: missing spec path fails closed", () => {
  const r = run(["manifest", path.join(FIX, "manifest-missing-spec.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /spec path not found/);
});
