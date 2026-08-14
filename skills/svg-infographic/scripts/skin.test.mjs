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
// package 안에서 profile 집합을 바꿔 끼워야 하는 negative는 **package 사본**을 만들어
// 그 사본의 entrypoint를 자기 root에서 실행한다 — containment를 끄지 않고도 동일한
// 결함 상황을 재현한다(shipped 표면에 fixture 우회 경로를 두지 않기 위함).
function pkgCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "skinpkg-"));
  const pkg = path.join(dir, "svg-infographic");
  const r = spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  // source checkout이 read-only여도 사본은 변조 가능해야 한다(테스트는 source를 만지지 않는다)
  spawnSync("chmod", ["-R", "u+w", pkg], { encoding: "utf8" });
  return pkg;
}
function runIn(pkg, args, env = {}) {
  // 상속된 root/mode는 지우되, 테스트가 **명시적으로 준** 값은 보존한다.
  const e = { ...process.env, ...env };
  for (const k of ["SVGINFO_EXPECTED_SKILL_ROOT", "SVGINFO_EXECUTION_MODE"]) if (!(k in env)) delete e[k];
  const r = spawnSync(process.execPath, [path.join(pkg, "scripts", "skin.mjs"), ...args],
    { encoding: "utf8", cwd: path.join(pkg, "scripts"), env: e });
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
// negative profile 집합은 이미 package 안(scripts/skin-fixtures/skins-negative)에 있으므로
// 그대로 가리켜도 containment를 통과한다 — package 밖으로 나가는 경로만 거부된다.
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
  // package 사본의 negative 트리 안에서만 profile을 바꾼다(트리 전체가 분류돼 있어
  // 파일 추가·교체가 분류 gate를 깨지 않는다).
  const pkg = pkgCopy();
  const skins = path.join(pkg, "scripts", "skin-fixtures", "skins-negative");
  writeFileSync(path.join(skins, "derivation-v1.yaml"),
    readFileSync(path.join(NEG, "bad-alias-target.yaml"), "utf8").replace("id: bad-alias-target", "id: derivation-v1"));
  const r = runIn(pkg, ["validate", path.join(skins, "current-v1.yaml")], { SKIN_SKINS_DIR: skins });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /invalid source/);
  fs.rmSync(path.dirname(pkg), { recursive: true, force: true });
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
  fs.chmodSync(f, 0o644);   // read-only checkout에서 복사해도 쓰기 가능해야 한다
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

// --- TypePack registration closure + derived selection view (Wave 1 CP1A) ----
// 이 블록은 **source tree를 절대 수정하지 않는다** — 변조가 필요한 재현은 package
// 사본에서 수행한다(read-only checkout에서도 suite가 통과해야 한다).
const typesOf = (pkg) => path.join(pkg, "references", "types");
const readManifest = (pkg) => fs.readFileSync(path.join(typesOf(pkg), "manifest.yaml"), "utf8");
const writeManifest = (pkg, text) => fs.writeFileSync(path.join(typesOf(pkg), "manifest.yaml"), text);
const drop = (pkg) => fs.rmSync(path.dirname(pkg), { recursive: true, force: true });

test("selection view는 manifest에서 파생되고 drift는 --check가 잡는다(사본에서 변조)", () => {
  const ok = run(["selection", "--check", "--json"]);
  assert.equal(ok.code, 0, ok.out);
  const j = JSON.parse(ok.out);
  assert.equal(j.driftedBefore, false);
  assert.equal(j.driftedAfter, false);
  assert.equal(j.shown, j.registered - j.gated);

  const pkg = pkgCopy();
  const view = path.join(typesOf(pkg), "selection.md");
  fs.writeFileSync(view, fs.readFileSync(view, "utf8").replace("constrained-layout", "editorial-composition"));
  const drift = runIn(pkg, ["selection", "--check"]);
  assert.equal(drift.code, 1, drift.out);
  assert.match(drift.out, /out of date with the manifest/);
  drop(pkg);
});

test("R1-7: manifest row 순서를 뒤집어도 selection view는 동일하다", () => {
  const base = run(["selection"]);
  assert.equal(base.code, 0, base.out);
  const pkg = pkgCopy();
  const text = readManifest(pkg);
  const head = text.slice(0, text.indexOf("  - id: "));
  const entries = text.slice(text.indexOf("  - id: ")).split(/(?=^  - id: )/m).filter(Boolean);
  assert.ok(entries.length >= 2, `등록 TypePack이 ${entries.length}종이다`);
  writeManifest(pkg, head + entries.reverse().join(""));
  const reordered = runIn(pkg, ["selection"]);
  assert.equal(reordered.code, 0, reordered.out);
  assert.equal(reordered.out, base.out, "정렬 기준이 manifest 순서와 무관해야 한다");
  drop(pkg);
});

test("R1-6: selection --write는 개발 모드에서만 허용되고, write 후 --check가 통과한다", () => {
  const denied = run(["selection", "--write"]);
  assert.equal(denied.code, 1, denied.out);
  assert.match(denied.out, /requires source-development execution/);

  // 소유 repository로 만든 임시 package에서 실제 write → check 왕복
  const repo = mkdtempSync(path.join(tmpdir(), "seldev-"));
  spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  fs.mkdirSync(path.join(repo, "skills"), { recursive: true });
  const pkg = path.join(repo, "skills", "svg-infographic");
  assert.equal(spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" }).status, 0);
  spawnSync("chmod", ["-R", "u+w", pkg], { encoding: "utf8" });
  spawnSync("git", ["add", "-A"], { cwd: repo, encoding: "utf8" });
  const view = path.join(typesOf(pkg), "selection.md");
  fs.writeFileSync(view, "stale\n");
  const env = { SVGINFO_EXECUTION_MODE: "source-development" };
  const w = runIn(pkg, ["selection", "--write", "--json"], env);
  assert.equal(w.code, 0, w.out);
  const j = JSON.parse(w.out);
  assert.equal(j.driftedBefore, true);
  assert.equal(j.wrote, true);
  assert.equal(j.driftedAfter, false, "write 후에도 drift가 남으면 안 된다");
  assert.equal(runIn(pkg, ["selection", "--check"]).code, 0, "write 직후 check는 통과해야 한다");
  fs.rmSync(repo, { recursive: true, force: true });
});

test("manifest: 등록된 TypePack의 spec identity·섹션·inventory closure", () => {
  const m = run(["manifest", "--json"]);
  assert.equal(m.code, 0, m.out);
  assert.equal(JSON.parse(m.out).errors.length, 0);
  for (const id of ["cards-kpi-grid", "layer-stack"]) {
    const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", `${id}.md`), "utf8");
    assert.match(spec, new RegExp(`typepack_id: ${id}`));
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.match(spec, new RegExp(`^## ${n}\\. `, "m"), `${id} §${n}`);
  }
});

test("R1-1·R1-2: 중복 spec 경로·identity 불일치·빈 spec·orphan spec은 거부된다", () => {
  const cases = [
    ["duplicate spec path", (pkg) => writeManifest(pkg, readManifest(pkg).replace("types/specs/layer-stack.md", "types/specs/cards-kpi-grid.md")), /is already claimed by/],
    ["identity mismatch", (pkg) => {
      const f = path.join(typesOf(pkg), "specs", "layer-stack.md");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("typepack_id: layer-stack", "typepack_id: something-else"));
    }, /spec declares typepack_id/],
    ["profile mismatch", (pkg) => {
      const f = path.join(typesOf(pkg), "specs", "layer-stack.md");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("profile: constrained-layout", "profile: exact-parametric"));
    }, /spec declares profile/],
    ["empty spec", (pkg) => fs.writeFileSync(path.join(typesOf(pkg), "specs", "layer-stack.md"), ""), /missing its identity frontmatter/],
    ["missing section", (pkg) => {
      const f = path.join(typesOf(pkg), "specs", "layer-stack.md");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("## 3. Semantic model and invariants", "## 3. Something else"));
    }, /missing required section "3\. Semantic model/],
    ["orphan spec", (pkg) => fs.writeFileSync(path.join(typesOf(pkg), "specs", "ghost-type.md"), "---\nspec_schema_version: 1\n---\n"), /orphan spec "types\/specs\/ghost-type\.md"/],
  ];
  for (const [label, mutate, re] of cases) {
    const pkg = pkgCopy();
    mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${label}: ${r.out}`);
    assert.match(r.out, re, label);
    drop(pkg);
  }
});

test("R1-3: promotion evidence 없는 core 승격은 거부된다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace("support: experimental", "support: core"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires at least one registered example/);
  assert.match(r.out, /requires a positive fixture for preset/);
  assert.match(r.out, /requires at least one baseline-red fixture/);
  drop(pkg);
});

test("R1B-1: 가짜 gallery id·비fixture 파일로는 core 승격이 불가능하다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg)
    .replace("    support: experimental\n    spec: types/specs/cards-kpi-grid.md",
             "    support: core\n    spec: types/specs/cards-kpi-grid.md")
    .replace("    examples: []\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: { status: reserved, anchor: PROMPT-GALLERY.md#cards-kpi-grid }",
             "    examples:\n      - { id: fake-gallery-id, gallery_anchor: PROMPT-GALLERY.md#fake-gallery-id }\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: { status: reserved, anchor: PROMPT-GALLERY.md#cards-kpi-grid }")
    .replace("    fixtures: []\n    examples:", "    fixtures:\n      - { id: fake-fx, kind: positive, preset: social-4x5, path: types/specs/cards-kpi-grid.md }\n    examples:"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /must point at an \.svg artifact or \.json receipt/, "spec 문서를 fixture로 쓸 수 없다");
  assert.match(r.out, /does not exist — "core" requires a real gallery entry/, "가짜 gallery id는 증거가 아니다");
  drop(pkg);
});

test("R1B-2: 지원 preset의 positive·baseline-red 증거 누락은 core를 막는다", () => {
  const pkg = pkgCopy();
  const svg = "scripts/skin-fixtures/portable-positive.svg";
  writeManifest(pkg, readManifest(pkg)
    .replace("    support: experimental\n    spec: types/specs/layer-stack.md",
             "    support: core\n    spec: types/specs/layer-stack.md")
    .replace("    verifier: null\n    receipt_schema: null\n    fixtures: []\n    examples: []\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: { status: reserved, anchor: PROMPT-GALLERY.md#layer-stack }",
             `    verifier: null\n    receipt_schema: null\n    fixtures:\n      - {{ id: ls-social, kind: positive, preset: social-4x5, path: ${svg} }}\n    examples:\n      - {{ id: ls-ex, gallery_anchor: PROMPT-GALLERY.md#layer-stack }}\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: {{ status: reserved, anchor: PROMPT-GALLERY.md#layer-stack }}`.replace(/{{/g, "{").replace(/}}/g, "}")));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires a positive fixture for preset "presentation-16x9"/, "선언한 preset 전부에 positive가 필요하다");
  assert.match(r.out, /requires at least one baseline-red fixture/);
  drop(pkg);
});

test("R1B-3: heading만 있는 annex는 거부된다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace("    annexes: []\n    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\"",
    "    annexes: [topology]\n    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\""));
  const spec = path.join(typesOf(pkg), "specs", "layer-stack.md");
  fs.appendFileSync(spec, "\n## A1. Topology contract\n");
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /topology annex is missing "### Entity identity"/);
  assert.match(r.out, /topology annex is missing "### Cycle policy"/);
  drop(pkg);
});

test("R1B-4: data-accuracy annex는 core 승격 시 verifier와 receipt schema를 요구한다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg)
    .replace("    annexes: []\n    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\"",
      "    annexes: [data-accuracy]\n    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\"")
    .replace(/(- id: layer-stack[\s\S]*?)support: experimental/, "$1support: core"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires a machine verifier/);
  assert.match(r.out, /requires a receipt_schema locator/);
  drop(pkg);
});

test("R1B-5: legacy_section null 우회와 tombstone 규칙 문장 추가는 거부된다", () => {
  // (1) legacy origin인데 legacy_section을 비우면 거부
  let pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace('legacy_section: "Layer stack"', "legacy_section: null"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /migration_origin "legacy" requires legacy_section/);
  drop(pkg);

  // (2) origin을 new로 바꿔 검사를 빠져나가면 주인 없는 tombstone이 남는다
  pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg)
    .replace("    migration_origin: legacy\n    legacy_section: \"Layer stack\"", "    migration_origin: new\n    legacy_section: null"));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no typepack claims it via legacy_section/);
  drop(pkg);

  // (3) tombstone에 규칙 문장을 덧붙이면 canonical body 불일치로 거부
  pkg = pkgCopy();
  const ap = path.join(pkg, "references", "archetypes.md");
  fs.writeFileSync(ap, fs.readFileSync(ap, "utf8").replace(
    "routing: [`types/selection.md`](types/selection.md).",
    "routing: [`types/selection.md`](types/selection.md).\n\nBands stay 72–110px tall and gaps stay equal."));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /is not the canonical tombstone/);
  drop(pkg);
});

test("R1-4: gated TypePack은 라우팅에서 빠지되 id·사유·해제 조건이 남는다", () => {
  const pkg = pkgCopy();
  // gate 없이 gated로 바꾸면 거부
  writeManifest(pkg, readManifest(pkg).replace("    support: experimental\n    spec: types/specs/layer-stack.md",
    "    support: gated\n    spec: types/specs/layer-stack.md"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /gated typepacks require gate/);
  // gate를 채우면 통과하고, view에는 audit 행으로만 남는다
  writeManifest(pkg, readManifest(pkg).replace("    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\"",
    "    gate: { reason: \"machine verifier 미완\", release: \"verifier + receipt schema 확정 시\" }\n    migration_origin: legacy\n    legacy_section: \"Layer stack\""));
  assert.equal(runIn(pkg, ["manifest"]).code, 0, runIn(pkg, ["manifest"]).out);
  const view = runIn(pkg, ["selection"]);
  assert.equal(view.code, 0, view.out);
  assert.doesNotMatch(view.out.split("## Registered but not routable")[0], /layer-stack/,
    "gated 타입은 라우팅 표에 없어야 한다");
  assert.match(view.out, /Registered but not routable/);
  assert.match(view.out, /layer-stack.*machine verifier 미완.*verifier \+ receipt schema/s);
  drop(pkg);
});

test("R1-5: canonical prompt는 reserved→bound 전이를 요구하고 bound 대상 부재를 거부한다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace("{ status: reserved, anchor: PROMPT-GALLERY.md#layer-stack }",
    "{ status: bound, anchor: PROMPT-GALLERY.md#layer-stack }"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /bound but PROMPT-GALLERY\.md does not exist/);
  // 파일은 있으나 anchor가 없으면 여전히 거부.
  // 파일 추가와 package membership 등록은 같은 변경에서 이뤄져야 한다(CP3 원자 확장 계약).
  fs.writeFileSync(path.join(pkg, "references", "PROMPT-GALLERY.md"), "# Prompt gallery\n\n## other anchor\n");
  const surf = path.join(pkg, "references", "package-surface.yaml");
  fs.writeFileSync(surf, fs.readFileSync(surf, "utf8").replace(
    "  - { path: references/types/selection.md, kind: normative-doc }",
    "  - { path: references/types/selection.md, kind: normative-doc }\n  - { path: references/PROMPT-GALLERY.md, kind: normative-doc }"));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /anchor "#layer-stack" not found/);
  // anchor가 있으면 통과
  fs.appendFileSync(path.join(pkg, "references", "PROMPT-GALLERY.md"), "\n## layer stack\n");
  assert.equal(runIn(pkg, ["manifest"]).code, 0, runIn(pkg, ["manifest"]).out);
  drop(pkg);
});

test("중복 canonical_prompt anchor는 manifest validator가 직접 잡는다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace("PROMPT-GALLERY.md#layer-stack", "PROMPT-GALLERY.md#cards-kpi-grid"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /duplicate canonical_prompt anchor/);
  drop(pkg);
});

test("R1-5b: 등록된 TypePack의 legacy archetype section이 되살아나면 거부된다", () => {
  const pkg = pkgCopy();
  const ap = path.join(pkg, "references", "archetypes.md");
  fs.writeFileSync(ap, fs.readFileSync(ap, "utf8").replace(
    "**Migrated to TypePack `layer-stack`.**", "**Skeleton:** legacy rules are back"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /is not the canonical tombstone/);
  drop(pkg);
});

// --- CP1B: 카탈로그 전수 이행 -------------------------------------------------
test("CP1B: 9종 archetype이 모두 TypePack으로 등록되고 selection view에 노출된다", () => {
  const m = run(["manifest", "--json"]);
  assert.equal(m.code, 0, m.out);
  const j = JSON.parse(m.out);
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
  assert.equal(j.count, 9, "archetype 9종이 모두 등록되어야 한다");
  const sel = JSON.parse(run(["selection", "--check", "--json"]).out);
  assert.equal(sel.registered, 9);
  assert.equal(sel.shown, 9);
  assert.equal(sel.driftedBefore, false);
  const view = fs.readFileSync(path.join(here, "..", "references", "types", "selection.md"), "utf8");
  for (const id of ["approval-gate", "before-after", "cards-kpi-grid", "decision-matrix", "layer-stack",
                    "nested-scope", "process-flow", "roadmap-timeline", "topology-component"])
    assert.match(view, new RegExp(`\\\`${id}\\\``), `${id} 행이 있어야 한다`);
});

test("CP1B: archetypes.md의 per-type section은 모두 tombstone이다", () => {
  const arch = fs.readFileSync(path.join(here, "..", "references", "archetypes.md"), "utf8");
  const blocks = arch.split(/^## /m).slice(1);
  const shared = blocks.filter((b) => !/Migrated to TypePack/.test(b)).map((b) => b.split("\n")[0].trim());
  assert.deepEqual(shared, ["Premium base recipe (applies to every archetype)"],
    "cross-type 공통 recipe 외에는 per-type normative section이 남으면 안 된다");
});

test("tombstones 명령은 canonical template에서 재생성하고 drift를 잡는다", () => {
  assert.equal(run(["tombstones", "--check"]).code, 0);
  // --write는 개발 모드가 필요하므로 소유 repository로 만든 임시 package에서 검증한다
  const repo = mkdtempSync(path.join(tmpdir(), "tsdev-"));
  spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  fs.mkdirSync(path.join(repo, "skills"), { recursive: true });
  const pkg = path.join(repo, "skills", "svg-infographic");
  assert.equal(spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" }).status, 0);
  spawnSync("chmod", ["-R", "u+w", pkg], { encoding: "utf8" });
  spawnSync("git", ["add", "-A"], { cwd: repo, encoding: "utf8" });
  const ap = path.join(pkg, "references", "archetypes.md");
  fs.writeFileSync(ap, fs.readFileSync(ap, "utf8").replace(
    "routing: [`types/selection.md`](types/selection.md).",
    "routing: [`types/selection.md`](types/selection.md).\n\nExtra prose."));
  const drift = runIn(pkg, ["tombstones", "--check"]);
  assert.equal(drift.code, 1, drift.out);
  assert.match(drift.out, /do not match the canonical template/);
  // 재생성하면 manifest closure까지 통과한다
  const w = runIn(pkg, ["tombstones", "--write"], { SVGINFO_EXECUTION_MODE: "source-development" });
  assert.equal(w.code, 0, w.out);
  assert.equal(runIn(pkg, ["manifest"]).code, 0, runIn(pkg, ["manifest"]).out);
  fs.rmSync(repo, { recursive: true, force: true });
});

test("tombstones --write도 개발 모드에서만 허용된다", () => {
  const r = run(["tombstones", "--write"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires source-development execution/);
});

test("topology annex를 선언한 TypePack은 필수 하위 절을 모두 갖춘다", () => {
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  for (const sub of ["Entity identity", "Edge kind and direction", "Cardinality", "Cycle policy",
                     "Traversal and reading order", "Topology verifier and receipt boundary"])
    assert.match(spec, new RegExp(`^### ${sub}$`, "m"), sub);
});

// --- CP1B-R1: fit 계약 실행 가능성과 증거 결합 --------------------------------
test("R1-1·R1-2: fit footprint는 params에서 재계산되고 feasibility는 live contentBox와 대조된다", () => {
  const m = JSON.parse(run(["manifest", "--json"]).out);
  assert.equal(m.errors.length, 0, JSON.stringify(m.errors));
  // 선언된 footprint 수치를 흔들면 params 재계산이 잡아야 한다
  let pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(/w: 644, h: 124/, "w: 500, h: 124"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares 500×124 but the params compute 644×124/);
  drop(pkg);

  // feasibility 결과를 뒤집으면 live contentBox 재계산이 잡아야 한다
  pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(
    "{ preset: social-4x5, orientation: portrait, count: 5, layout: row, result: needs-split }",
    "{ preset: social-4x5, orientation: portrait, count: 5, layout: row, result: fits }"));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares "fits" but .* computes "needs-split"/);
  drop(pkg);
});

test("R1-2b: 모든 TypePack이 선언 preset의 최대 cardinality feasibility를 갖는다", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  const blocks = doc.split(/^  - id: /m).slice(1);
  assert.equal(blocks.length, 9, `등록 TypePack 수 ${blocks.length}`);
  for (const b of blocks) {
    const id = b.split("\n")[0].trim();
    assert.match(b, /fit:/, `${id}: fit 블록 필요`);
    for (const preset of ["social-4x5", "presentation-16x9"])
      assert.ok(b.includes(`preset: ${preset}`), `${id}: ${preset} feasibility 필요`);
  }
  // 커버리지 누락은 거부된다
  const pkg = pkgCopy();
  // 최대 cardinality에서 해당 preset 항목이 하나뿐인 타입(topology zones)으로 커버리지 누락을 만든다
  writeManifest(pkg, readManifest(pkg).replace(
    "        - { preset: presentation-16x9, orientation: landscape, count: 4, layout: zones, result: fits }\n", ""));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /must cover preset "presentation-16x9" at the maximum cardinality/);
  drop(pkg);
});

test("R1-4: topology annex를 선언한 TypePack은 verifier·receipt 없이 core가 될 수 없다", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(
    "  - id: topology-component\n    selection_signal:", "  - id: topology-component\n    selection_signal:")
    .replace(/(- id: topology-component[\s\S]*?)support: experimental/, "$1support: core"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /semantic-claim typepack .* requires a machine verifier/);
  assert.match(r.out, /requires a receipt_schema locator/);
  drop(pkg);
});

test("R1-5: unrelated gallery heading·재사용 artifact로는 core 증거가 되지 않는다", () => {
  const pkg = pkgCopy();
  const svg = "scripts/skin-fixtures/portable-positive.svg";
  writeManifest(pkg, readManifest(pkg)
    .replace(/(- id: cards-kpi-grid[\s\S]*?)support: experimental/, "$1support: core")
    .replace(/(- id: cards-kpi-grid[\s\S]*?)    fixtures: \[\]\n    examples: \[\]/,
      `$1    fixtures:\n      - {{ id: fx-a, kind: positive, preset: social-4x5, path: ${svg} }}\n      - {{ id: fx-b, kind: baseline-red, preset: social-4x5, path: ${svg} }}\n    examples:\n      - {{ id: ex-a, gallery_anchor: archetypes.md#layer-stack }}`
        .replace(/{{/g, "{").replace(/}}/g, "}")));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /gallery_anchor must be PROMPT-GALLERY\.md/, "아무 문서의 heading은 example 증거가 아니다");
  assert.match(r.out, /is registered more than once — one artifact proves one/, "같은 artifact를 두 역할로 재사용할 수 없다");
  drop(pkg);
});

test("R1-3·R1-6: topology spec은 증거 수준을 구현에 맞추고 edge 축을 분리한다", () => {
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  assert.match(spec, /\*\*Machine \(generic guard가 실제로 검사하는 것\)/);
  assert.match(spec, /topology\s*\n의미 모델을 아는 전용 경로는 Wave 1에 없다|의미 모델을 아는 전용 경로는 Wave 1에 없다/);
  assert.match(spec, /아직 증명되지 않음\(등록 fixture 없음\)/);
  assert.match(spec, /node → zone \*\*semantic\*\* ownership/);
  for (const axis of ["kind: request \\| dependency", "delivery: sync \\| async", "visibility: public \\| private"])
    assert.match(spec, new RegExp(axis), axis);
  assert.match(spec, /선 스타일은 이 셋에서 파생된다/);
});

test("R1B-P2: fit schema는 음수 gap·잘못된 orientation·중복 tuple을 거부한다", () => {
  const cases = [
    [(t) => t.replace("gapX: 44", "gapX: -44"), /fit\.params\.gapX must be >= 0/],
    [(t) => t.replace("{ preset: presentation-16x9, orientation: landscape, count: 5, layout: row, result: fits }",
                      "{ preset: presentation-16x9, orientation: portrait, count: 5, layout: row, result: fits }"),
     /declares orientation "portrait" but the preset is "landscape"|orientation "portrait" is not declared/],
    [(t) => t.replace("        - { preset: social-4x5, orientation: portrait, count: 5, layout: row, result: needs-split }",
                      "        - { preset: social-4x5, orientation: portrait, count: 5, layout: row, result: needs-split }\n        - { preset: social-4x5, orientation: portrait, count: 5, layout: row, result: needs-split }"),
     /duplicate fit\.feasibility entry/],
    [(t) => t.replace("cardinality: { min: 3, canonical: 4, max: 5 }", "cardinality: { min: 3, canonical: 4, max: 5.5 }"),
     /fit\.cardinality\.max must be a positive integer/],
    [(t) => t.replace("floor_basis: geometry", "floor_basis: proven"), /floor_basis must be geometry\|rendered/],
  ];
  for (const [mutate, re] of cases) {
    const pkg = pkgCopy();
    writeManifest(pkg, mutate(readManifest(pkg)));
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${re}: ${r.out}`);
    assert.match(r.out, re);
    drop(pkg);
  }
});

test("R1B-P1: topology fit은 zone 내부 구조를 포함한 계층형 경계 상자로 계산된다", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  const b = doc.split("  - id: topology-component")[1].split(/^  - id: /m)[0];
  assert.match(b, /layout: zones/, "zones layout을 써야 한다");
  for (const k of ["maxNodesPerZone", "zonePad", "zoneLabelBand", "zoneGap"])
    assert.ok(b.includes(k), `${k} 파라미터 필요`);
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  assert.match(spec, /총 node ≤ 9/, "zone당 상한과 총량 상한이 함께 적혀야 한다");
  assert.doesNotMatch(spec, /4 zone × zone당 4 node까지 두 preset에서 성립/, "총 9개 계약과 충돌하는 문구 제거");
});

test("R1B-P1c: content floor는 이름으로 구분되고 근거 수준이 표시된다", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  assert.equal((doc.match(/floor_basis: geometry/g) ?? []).length, 9, "Wave 1 수치는 전부 기하 가정이다");
  const cards = doc.split("  - id: cards-kpi-grid")[1].split(/^  - id: /m)[0];
  assert.match(cards, /itemMinW: 149, itemMinH: 124/, "base floor는 기존 시각 증거 이상");
  assert.match(cards, /compactItemMinW: 132, compactItemMinH: 104/, "compact는 별도 floor");
  const layer = doc.split("  - id: layer-stack")[1].split(/^  - id: /m)[0];
  assert.match(layer, /floor: wide, result: needs-split/, "chip 4개는 4:5에서 성립하지 않는다");
  for (const f of ["cards-kpi-grid", "layer-stack", "process-flow"]) {
    const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", `${f}.md`), "utf8");
    assert.match(spec, /floor_basis`가 `geometry`인 동안 이 수치는 \*\*기하 가정\*\*/, f);
  }
});

// --- pageframe fail-closed schema + fluid two-phase -------------------------------
function pfNeg(file, args, re) {
  const pkg = pkgCopy();
  copyFileSync(path.join(NEG, file), path.join(pkg, "references", "skins", "pageframe-v1.yaml"));
  const r = runIn(pkg, ["pageframe", "social-4x5", ...args]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, re);
  fs.rmSync(path.dirname(pkg), { recursive: true, force: true });
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
  const pkg = pkgCopy();
  const tp = path.join(pkg, "references", "typography", "typography-v1.yaml");
  fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/digest: [0-9a-f]{64}/, "digest: " + "f".repeat(64)));
  const r = runIn(pkg, ["typography", tp]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /asset digest mismatch/);
  fs.rmSync(path.dirname(pkg), { recursive: true, force: true });
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
