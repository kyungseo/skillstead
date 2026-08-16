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
import { ICON_IDS } from "./icon-registry.mjs";
import { KIND_PALETTE_FAMILY, NODE_KINDS, TOPOLOGY_LIMITS } from "./topology-contract.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKIN = path.join(here, "skin.mjs");
const FIX = path.join(here, "skin-fixtures");
const NEG = path.join(FIX, "skins-negative");
const CUR = path.join(here, "..", "references", "skins", "current-v1.yaml");
const AUTHORING = path.join(here, "..", "references", "authoring.md");

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [SKIN, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}
// A negative that needs the profile set swapped inside the package makes a **copy of the package**
// and runs that copy's entrypoint from its own root — reproducing the same defect without turning
// containment off (so no fixture bypass path sits on the shipped surface).
function pkgCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "skinpkg-"));
  const pkg = path.join(dir, "svg-infographic");
  const r = spawnSync("cp", ["-R", path.join(here, ".."), pkg], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  // The copy must be mutable even where the source checkout is read-only (the tests never touch the source)
  spawnSync("chmod", ["-R", "u+w", pkg], { encoding: "utf8" });
  return pkg;
}
function runIn(pkg, args, env = {}) {
  // Clear the inherited root and mode, but preserve whatever the test gave **explicitly**.
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
// The negative profile set already lives inside the package (scripts/skin-fixtures/skins-negative),
// so pointing straight at it clears containment — only a path leaving the package is refused.
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
  // Change profiles only inside the negative tree of the package copy (the whole tree is
  // classified, so adding or replacing a file does not break the classification gate).
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
test("icon registry is the exact 22-id SSoT exposed to authoring", () => {
  const expected = ["activity", "api", "check", "clock", "cloud", "coins", "database", "doc",
    "flag", "gauge", "gear", "layers", "lock", "loop", "network", "queue", "rocket", "route",
    "server", "shield", "terminal", "users"];
  assert.deepEqual(ICON_IDS, expected);
  const r = run(["icons", "--json"]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.count, expected.length);
  assert.deepEqual(j.ids, expected);
  assert.deepEqual(j.icons.map((entry) => entry.id), expected);
  assert.ok(j.icons.every((entry) => entry.viewBox === "0 0 24 24" && entry.path.length > 0));
  const authoring = readFileSync(AUTHORING, "utf8");
  assert.match(authoring, /skin\.mjs icons --json/);
  assert.doesNotMatch(authoring, /id=["']ic-/,
    "authoring must query the registry rather than maintain a second icon-id list");
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
  fs.chmodSync(f, 0o644);   // it must stay writable even when copied from a read-only checkout
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
// This block **never modifies the source tree** — any reproduction needing mutation happens in a
// package copy (the suite must pass on a read-only checkout too).
const typesOf = (pkg) => path.join(pkg, "references", "types");
const readManifest = (pkg) => fs.readFileSync(path.join(typesOf(pkg), "manifest.yaml"), "utf8");
const writeManifest = (pkg, text) => fs.writeFileSync(path.join(typesOf(pkg), "manifest.yaml"), text);
const drop = (pkg) => fs.rmSync(path.dirname(pkg), { recursive: true, force: true });

// Mutate inside ONE TypePack's block and prove the mutation actually happened.
//
// A whole-file `String.replace` takes the first match wherever it lands. That was survivable while
// every pack shared the same placeholder text, but once the catalog registered per-pack examples and
// bound prompts, the first match often belongs to a different pack — so a "negative" fixture could
// mutate nothing, leave the manifest valid, and still pass. Both assertions below exist to make that
// failure mode impossible: the edit must match exactly once inside the target block, and the file
// must actually change.
const mutatePack = (pkg, id, edits) => {
  const text = readManifest(pkg);
  const heads = [...text.matchAll(/^  - id: (\S+)$/gm)];
  const i = heads.findIndex((m) => m[1] === id);
  assert.ok(i >= 0, `manifest has no TypePack "${id}"`);
  const start = heads[i].index, end = i + 1 < heads.length ? heads[i + 1].index : text.length;
  let block = text.slice(start, end);
  for (const [from, to] of edits) {
    const hits = block.split(from).length - 1;
    assert.equal(hits, 1,
      `${id}: expected exactly 1 occurrence of ${JSON.stringify(from.slice(0, 60))} in its own block, found ${hits}`);
    block = block.replace(from, to);
  }
  const next = text.slice(0, start) + block + text.slice(end);
  assert.notEqual(next, text, `${id}: the mutation changed nothing — this negative would prove nothing`);
  writeManifest(pkg, next);
  return next;
};
// The registered example block a pack carries at baseline, and the prompt binding beside it.
const exampleBlock = (id) => `    examples:\n      - { id: ${id}-canonical, gallery_anchor: PROMPT-GALLERY.md#${id} }\n`;
const promptLine = (id, status = "bound") => `    canonical_prompt: { status: ${status}, anchor: PROMPT-GALLERY.md#${id} }`;

test("the selection view derives from the manifest and --check catches drift (mutated in a copy)", () => {
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

test("R1-7: reversing the manifest row order leaves the selection view identical", () => {
  const base = run(["selection"]);
  assert.equal(base.code, 0, base.out);
  const pkg = pkgCopy();
  const text = readManifest(pkg);
  const head = text.slice(0, text.indexOf("  - id: "));
  const entries = text.slice(text.indexOf("  - id: ")).split(/(?=^  - id: )/m).filter(Boolean);
  assert.ok(entries.length >= 2, `there are ${entries.length} registered TypePacks`);
  writeManifest(pkg, head + entries.reverse().join(""));
  const reordered = runIn(pkg, ["selection"]);
  assert.equal(reordered.code, 0, reordered.out);
  assert.equal(reordered.out, base.out, "the sort key must be independent of the manifest order");
  drop(pkg);
});

test("R1-6: selection --write is allowed only in development mode, and --check passes after the write", () => {
  const denied = run(["selection", "--write"]);
  assert.equal(denied.code, 1, denied.out);
  assert.match(denied.out, /requires source-development execution/);

  // a real write-then-check round trip in a temporary package built as an owning repository
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
  assert.equal(j.driftedAfter, false, "no drift may remain after the write");
  assert.equal(runIn(pkg, ["selection", "--check"]).code, 0, "the check right after the write must pass");
  fs.rmSync(repo, { recursive: true, force: true });
});

test("manifest: spec identity, sections and inventory closure for registered TypePacks", () => {
  const m = run(["manifest", "--json"]);
  assert.equal(m.code, 0, m.out);
  assert.equal(JSON.parse(m.out).errors.length, 0);
  for (const id of ["cards-kpi-grid", "layer-stack"]) {
    const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", `${id}.md`), "utf8");
    assert.match(spec, new RegExp(`typepack_id: ${id}`));
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.match(spec, new RegExp(`^## ${n}\\. `, "m"), `${id} §${n}`);
  }
});

test("R1-1 and R1-2: a duplicate spec path, an identity mismatch, an empty spec and an orphan spec are refused", () => {
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

test("R1-3: promotion to core without promotion evidence is refused", () => {
  // The catalog now ships a registered example per pack, so claiming core is only interesting once
  // the evidence is explicitly taken away — otherwise this would test a pack that already has some.
  const pkg = pkgCopy();
  mutatePack(pkg, "cards-kpi-grid", [
    ["    support: experimental\n", "    support: core\n"],
    [exampleBlock("cards-kpi-grid"), "    examples: []\n"],
  ]);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires at least one registered example/);
  assert.match(r.out, /requires a positive fixture for preset/);
  assert.match(r.out, /requires at least one baseline-red fixture/);
  drop(pkg);
});

test("R1B-1: a fake gallery id or a non-fixture file cannot promote to core", () => {
  // Replace the real example with one naming a gallery entry that does not exist, and offer a spec
  // document as a fixture. Both are shaped correctly; neither is evidence.
  const pkg = pkgCopy();
  mutatePack(pkg, "cards-kpi-grid", [
    ["    support: experimental\n", "    support: core\n"],
    ["    fixtures: []\n", "    fixtures:\n      - { id: fake-fx, kind: positive, preset: social-4x5, path: types/specs/cards-kpi-grid.md }\n"],
    [exampleBlock("cards-kpi-grid"),
     "    examples:\n      - { id: fake-gallery-id, gallery_anchor: PROMPT-GALLERY.md#fake-gallery-id }\n"],
  ]);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /must point at an \.svg artifact or \.json receipt/, "a spec document cannot serve as a fixture");
  // Now that the gallery exists, the anchor is checked against its real headings rather than merely
  // noting the file is absent — a stronger refusal than the one this assertion used to make.
  assert.match(r.out, /anchor "#fake-gallery-id" is not in PROMPT-GALLERY\.md/, "a fake gallery id is not evidence");
  drop(pkg);
});

test("R1B-2: missing positive or baseline-red evidence for a supported preset blocks core", () => {
  const pkg = pkgCopy();
  const svg = "scripts/skin-fixtures/portable-positive.svg";
  writeManifest(pkg, readManifest(pkg)
    .replace("    support: experimental\n    spec: types/specs/layer-stack.md",
             "    support: core\n    spec: types/specs/layer-stack.md")
    .replace("    verifier: null\n    receipt_schema: null\n    fixtures: []\n    examples: []\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: { status: reserved, anchor: PROMPT-GALLERY.md#layer-stack }",
             `    verifier: null\n    receipt_schema: null\n    fixtures:\n      - {{ id: ls-social, kind: positive, preset: social-4x5, path: ${svg} }}\n    examples:\n      - {{ id: ls-ex, gallery_anchor: PROMPT-GALLERY.md#layer-stack }}\n    required_roles: [canvas, surface, ink, muted, rule, focus]\n    optional_aliases: []\n    canonical_prompt: {{ status: reserved, anchor: PROMPT-GALLERY.md#layer-stack }}`.replace(/{{/g, "{").replace(/}}/g, "}")));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires a positive fixture for preset "presentation-16x9"/, "every declared preset needs a positive");
  assert.match(r.out, /requires at least one baseline-red fixture/);
  drop(pkg);
});

test("R1B-3: an annex that is only a heading is refused", () => {
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

test("R1B-4: a data-accuracy annex requires a verifier and a receipt schema to promote to core", () => {
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

test("R1B-5: the legacy_section null bypass and appending a rule sentence to a tombstone are refused", () => {
  // (1) a legacy origin with an empty legacy_section is refused
  let pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace('legacy_section: "Layer stack"', "legacy_section: null"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /migration_origin "legacy" requires legacy_section/);
  drop(pkg);

  // (2) slipping past the check by switching origin to new leaves an ownerless tombstone
  pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg)
    .replace("    migration_origin: legacy\n    legacy_section: \"Layer stack\"", "    migration_origin: new\n    legacy_section: null"));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no typepack claims it via legacy_section/);
  drop(pkg);

  // (3) appending a rule sentence to a tombstone is refused on the canonical body mismatch
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

test("R1-4: a gated TypePack drops out of routing but keeps its id, reason and release condition", () => {
  const pkg = pkgCopy();
  // switching to gated without a gate is refused
  writeManifest(pkg, readManifest(pkg).replace("    support: experimental\n    spec: types/specs/layer-stack.md",
    "    support: gated\n    spec: types/specs/layer-stack.md"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /gated typepacks require gate/);
  // filling the gate passes, and it appears in the view only as an audit row
  writeManifest(pkg, readManifest(pkg).replace("    gate: null\n    migration_origin: legacy\n    legacy_section: \"Layer stack\"",
    "    gate: { reason: \"machine verifier incomplete\", release: \"once verifier + receipt schema are settled\" }\n    migration_origin: legacy\n    legacy_section: \"Layer stack\""));
  assert.equal(runIn(pkg, ["manifest"]).code, 0, runIn(pkg, ["manifest"]).out);
  const view = runIn(pkg, ["selection"]);
  assert.equal(view.code, 0, view.out);
  assert.doesNotMatch(view.out.split("## Registered but not routable")[0], /layer-stack/,
    "a gated type must not appear in the routing table");
  assert.match(view.out, /Registered but not routable/);
  assert.match(view.out, /layer-stack.*machine verifier incomplete.*verifier \+ receipt schema/s);
  drop(pkg);
});

test("R1-5: a bound canonical prompt must resolve to a real file and a real anchor", () => {
  // reserved -> bound is a transition the catalog has already completed, so re-enacting it proves
  // nothing about today's package. What still has to hold is the standing invariant: every routable
  // pack declares `bound`, and that binding resolves. Each step below breaks exactly one half of it.
  const pkg = pkgCopy();
  const gallery = path.join(pkg, "references", "PROMPT-GALLERY.md");
  const surf = path.join(pkg, "references", "package-surface.yaml");
  // Match whatever kind the surface files it under: hardcoding one here made the removal a silent
  // no-op the moment the classification changed, and preflight failed in place of the check below.
  const surfRe = /^ {2}- \{ path: references\/PROMPT-GALLERY\.md, kind: [a-z-]+ \}\n/m;
  const dropSurfEntry = () => {
    const before = fs.readFileSync(surf, "utf8");
    assert.match(before, surfRe, "the gallery must be registered in package-surface to begin with");
    fs.writeFileSync(surf, before.replace(surfRe, ""));
    return before.match(surfRe)[0];
  };

  // Every routable pack is bound at baseline — the invariant this test guards.
  const base = readManifest(pkg);
  const bound = [...base.matchAll(/canonical_prompt: \{ status: (\w+), anchor:/g)].map((m) => m[1]);
  assert.ok(bound.length >= 9 && bound.every((b) => b === "bound"),
    `every routable pack must be bound, saw ${JSON.stringify([...new Set(bound)])}`);

  // (1) The target file is gone. Its surface entry goes with it, so preflight is not the failure.
  fs.rmSync(gallery);
  const surfEntry = dropSurfEntry();
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /bound but PROMPT-GALLERY\.md does not exist/);

  // (2) The file is back and registered, but this pack's anchor names no heading in it.
  fs.writeFileSync(gallery, "# Prompt Gallery\n\n## some-other-anchor\n");
  fs.writeFileSync(surf, fs.readFileSync(surf, "utf8").replace(
    "  - { path: references/types/selection.md, kind: normative-doc }\n",
    "  - { path: references/types/selection.md, kind: normative-doc }\n" + surfEntry));
  assert.match(fs.readFileSync(surf, "utf8"), surfRe, "the entry must be back before this step means anything");
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /anchor "#[a-z0-9-]+" not found/);

  // (3) With every declared anchor present it resolves and passes.
  const ids = [...base.matchAll(/^  - id: (\S+)$/gm)].map((m) => m[1]);
  fs.writeFileSync(gallery, "# Prompt Gallery\n\n" + ids.map((id) => `## ${id}\n`).join("\n"));
  const ok = runIn(pkg, ["manifest"]);
  assert.equal(ok.code, 0, ok.out);
  drop(pkg);
});

test("a duplicate canonical_prompt anchor is caught by the manifest validator itself", () => {
  // `#layer-stack` now appears twice inside its own block (the prompt anchor and the example's
  // gallery_anchor), so a first-match replace would rewrite the example instead and never create the
  // duplicate this test is named for. Only the canonical_prompt line is touched.
  const pkg = pkgCopy();
  mutatePack(pkg, "layer-stack", [[promptLine("layer-stack"), promptLine("cards-kpi-grid")]]);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /duplicate canonical_prompt anchor/);
  drop(pkg);
});

test("R1-5b: a revived legacy archetype section on a registered TypePack is refused", () => {
  const pkg = pkgCopy();
  const ap = path.join(pkg, "references", "archetypes.md");
  fs.writeFileSync(ap, fs.readFileSync(ap, "utf8").replace(
    "**Migrated to TypePack `layer-stack`.**", "**Skeleton:** legacy rules are back"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /is not the canonical tombstone/);
  drop(pkg);
});

// --- CP1B: migrating the whole catalogue -------------------------------------------------
test("CP1B: all nine archetypes are registered as TypePacks and appear in the selection view", () => {
  const m = run(["manifest", "--json"]);
  assert.equal(m.code, 0, m.out);
  const j = JSON.parse(m.out);
  assert.equal(j.errors.length, 0, JSON.stringify(j.errors));
  assert.equal(j.count, 9, "all nine archetypes must be registered");
  const sel = JSON.parse(run(["selection", "--check", "--json"]).out);
  assert.equal(sel.registered, 9);
  assert.equal(sel.shown, 9);
  assert.equal(sel.driftedBefore, false);
  const view = fs.readFileSync(path.join(here, "..", "references", "types", "selection.md"), "utf8");
  for (const id of ["approval-gate", "before-after", "cards-kpi-grid", "decision-matrix", "layer-stack",
                    "nested-scope", "process-flow", "roadmap-timeline", "topology-component"])
    assert.match(view, new RegExp(`\\\`${id}\\\``), `there must be a row for ${id}`);
});

test("CP1B: every per-type section in archetypes.md is a tombstone", () => {
  const arch = fs.readFileSync(path.join(here, "..", "references", "archetypes.md"), "utf8");
  const blocks = arch.split(/^## /m).slice(1);
  const shared = blocks.filter((b) => !/Migrated to TypePack/.test(b)).map((b) => b.split("\n")[0].trim());
  assert.deepEqual(shared, ["Premium base recipe (applies to every archetype)"],
    "beyond the shared cross-type recipe, no per-type normative section may remain");
});

test("the tombstones command regenerates from the canonical template and catches drift", () => {
  assert.equal(run(["tombstones", "--check"]).code, 0);
  // --write needs development mode, so this is verified in a temporary package built as an owning repository
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
  // once regenerated it passes the manifest closure too
  const w = runIn(pkg, ["tombstones", "--write"], { SVGINFO_EXECUTION_MODE: "source-development" });
  assert.equal(w.code, 0, w.out);
  assert.equal(runIn(pkg, ["manifest"]).code, 0, runIn(pkg, ["manifest"]).out);
  fs.rmSync(repo, { recursive: true, force: true });
});

test("tombstones --write is likewise allowed only in development mode", () => {
  const r = run(["tombstones", "--write"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires source-development execution/);
});

test("a TypePack declaring a topology annex carries every required subsection", () => {
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  for (const sub of ["Entity identity", "Edge kind and direction", "Cardinality", "Cycle policy",
                     "Traversal and reading order", "Topology verifier and receipt boundary"])
    assert.match(spec, new RegExp(`^### ${sub}$`, "m"), sub);
});

// --- CP1B-R1: the executability of the fit contract and its binding to evidence --------------------------------
test("R1-1 and R1-2: the fit footprint is recomputed from params and feasibility is checked against the live contentBox", () => {
  const m = JSON.parse(run(["manifest", "--json"]).out);
  assert.equal(m.errors.length, 0, JSON.stringify(m.errors));
  // disturbing the declared footprint numbers must be caught by the params recomputation
  let pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(/w: 644, h: 124/, "w: 500, h: 124"));
  let r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares 500×124 but the params compute 644×124/);
  drop(pkg);

  // flipping the feasibility outcome must be caught by the live contentBox recomputation
  pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(
    "{ preset: social-4x5, orientation: portrait, count: 5, layout: row, result: needs-split }",
    "{ preset: social-4x5, orientation: portrait, count: 5, layout: row, result: fits }"));
  r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares "fits" but .* computes "needs-split"/);
  drop(pkg);
});

test("R1-2b: every TypePack has a maximum-cardinality feasibility for each declared preset", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  const blocks = doc.split(/^  - id: /m).slice(1);
  assert.equal(blocks.length, 9, `registered TypePack count ${blocks.length}`);
  for (const b of blocks) {
    const id = b.split("\n")[0].trim();
    assert.match(b, /fit:/, `${id}: a fit block is required`);
    for (const preset of ["social-4x5", "presentation-16x9"])
      assert.ok(b.includes(`preset: ${preset}`), `${id}: a ${preset} feasibility is required`);
  }
  // missing coverage is refused
  const pkg = pkgCopy();
  // create the missing coverage using a type with a single entry for that preset at maximum cardinality (topology zones)
  writeManifest(pkg, readManifest(pkg).replace(
    "        - { preset: presentation-16x9, orientation: landscape, count: 4, layout: zones, result: fits }\n", ""));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /must cover preset "presentation-16x9" at the maximum cardinality/);
  drop(pkg);
});

test("R1-4: a TypePack declaring a topology annex cannot become core without a verifier and a receipt", () => {
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

test("R1-5: an unrelated gallery heading or a reused artifact does not constitute core evidence", () => {
  // Both mutations are well-formed and would satisfy a shape check: an anchor into a real document
  // that simply is not the gallery, and two fixture roles pointing at one artifact.
  const pkg = pkgCopy();
  const svg = "scripts/skin-fixtures/portable-positive.svg";
  mutatePack(pkg, "cards-kpi-grid", [
    ["    support: experimental\n", "    support: core\n"],
    ["    fixtures: []\n",
     `    fixtures:\n      - {{ id: fx-a, kind: positive, preset: social-4x5, path: ${svg} }}\n      - {{ id: fx-b, kind: baseline-red, preset: social-4x5, path: ${svg} }}\n`
       .replace(/{{/g, "{").replace(/}}/g, "}")],
    [exampleBlock("cards-kpi-grid"),
     "    examples:\n      - { id: ex-a, gallery_anchor: archetypes.md#layer-stack }\n"],
  ]);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /gallery_anchor must be PROMPT-GALLERY\.md/, "any document's heading is not example evidence");
  assert.match(r.out, /is registered more than once — one artifact proves one/, "one artifact cannot be reused in two roles");
  drop(pkg);
});

test("R1-3 and R1-6: the topology spec matches its evidence level to the implementation and separates the edge axes", () => {
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  assert.match(spec, /\*\*Machine \(what the generic guards actually check\)/);
  assert.match(spec, /no dedicated path\s*\nthat understands the topology semantic model|that understands the topology semantic model/);
  assert.match(spec, /Not yet proved \(no registered fixture\)/);
  assert.match(spec, /node → zone \*\*semantic\*\* ownership/);
  // R1C-P1: arrow-target clearance belongs on the unproven list, not the machine list
  const machine = spec.split("**Machine (what the generic guards actually check)**")[1].split("**Visual / manual")[0];
  const manual = spec.split("**Visual / manual")[1];
  // no machine **list item** may claim clearance (a sentence stating its absence is allowed)
  const machineBullets = machine.split("\n").filter((l) => l.startsWith("- ")).join("\n");
  assert.doesNotMatch(machineBullets, /clearance|tip/, "target clearance must not be claimed as a machine item");
  assert.match(machine, /no path that measures the gap between an arrow tip and its target node/, "the absence must be stated explicitly");
  assert.match(machine, /visible arrowhead size and its ratio to the shaft/, "only the arrowhead size rule is machine-checked");
  assert.match(manual, /arrow tip–target 8–12px gap/, "target clearance is an unproven, manual item");
  for (const axis of ["kind: request \\| dependency", "delivery: sync \\| async", "visibility: public \\| private"])
    assert.match(spec, new RegExp(axis), axis);
  assert.match(spec, /The line style derives from these three/);
});

test("R1B-P2: the fit schema refuses a negative gap, a wrong orientation and a duplicate tuple", () => {
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
    // R1C-P2: rendered cannot be promoted by self-declaration without the CP2B evidence contract
    [(t) => t.replace("floor_basis: geometry", "floor_basis: rendered"), /requires the CP2B floor_evidence contract/],
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

test("R1B-P1: the topology fit is computed as a hierarchical bounding box including the zone interior", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  const b = doc.split(/^  - id: topology-component$/m)[1].split(/^  - id: /m)[0];
  assert.match(b, /layout: zones/, "it must use the zones layout");
  for (const k of ["maxNodesPerZone", "zonePad", "zoneLabelBand", "zoneGap"])
    assert.ok(b.includes(k), `the ${k} parameter is required`);
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  assert.match(spec, /9 nodes in total/, "the per-zone cap and the total cap must both be stated");
  assert.doesNotMatch(spec, /4 zones × 4 nodes per zone hold in both presets/, "wording conflicting with the total-of-9 contract is removed");
});

test("Wave2 CP2: topology cardinality is an exact spec-validator-manifest fixture ledger", () => {
  const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", "topology-component.md"), "utf8");
  assert.match(spec, new RegExp(`${TOPOLOGY_LIMITS.nodesPerZone[0]}–${TOPOLOGY_LIMITS.nodesPerZone[1]} per zone`));
  assert.match(spec, new RegExp(`\\*\\*${TOPOLOGY_LIMITS.nodesTotal} in total or fewer\\*\\*`));
  assert.match(spec, new RegExp(`At most ${TOPOLOGY_LIMITS.maxEdges} edges and ${TOPOLOGY_LIMITS.nodesTotal} nodes`));
  assert.match(spec, new RegExp(`exactly ${TOPOLOGY_LIMITS.specimenNodesTotal} nodes`));
  assert.match(spec, /`full-primitive-specimen` \\| `wave1-reference`/);
  for (const [kind, family] of Object.entries(KIND_PALETTE_FAMILY))
    assert.ok(spec.includes(`| \`${kind}\` | \`${family}\` |`), `${kind} → ${family} must be documented`);
  const stress = fs.readFileSync(path.join(here, "..", "references", "types", "inputs", "topology-component.stress-cardinality.yaml"), "utf8");
  assert.equal((stress.match(/^      - id:/gm) ?? []).length, TOPOLOGY_LIMITS.nodesTotal);
  assert.equal((stress.match(/^  - id: "e\d+"/gm) ?? []).length, TOPOLOGY_LIMITS.maxEdges);
  const manifest = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  const topo = manifest.split(/^  - id: topology-component$/m)[1].split(/^  - id: /m)[0];
  assert.match(topo, /path: types\/inputs\/topology-component\.stress-cardinality\.yaml/);
  assert.match(topo, /covers: \[cardinality-max, edge-density\]/);
});

test("Wave2 R1-F1: full specimen purpose, exact kind set, and transient policy fail closed", () => {
  const input = (pkg) => path.join(typesOf(pkg), "inputs", "topology-component.stress-primitive-coverage.yaml");
  const cases = [
    ["missing purpose", (pkg) => {
      const f = input(pkg), src = fs.readFileSync(f, "utf8");
      const changed = src.replace("purpose: full-primitive-specimen\n", "");
      assert.notEqual(changed, src, "the fixture must remove the purpose declaration");
      fs.writeFileSync(f, changed);
    }, /standard contract caps it at 9/],
    ["incomplete kind set", (pkg) => {
      const f = input(pkg), src = fs.readFileSync(f, "utf8");
      const changed = src.replace('kind: "database"\n        icon: "database"', 'kind: "cache"\n        icon: "layers"');
      assert.notEqual(changed, src, "the fixture must replace one canonical kind with a duplicate");
      fs.writeFileSync(f, changed);
    }, /full primitive specimen kind set must equal the canonical vocabulary/],
    ["non-transient artifact policy", (pkg) => {
      const f = path.join(typesOf(pkg), "manifest.yaml"), src = fs.readFileSync(f, "utf8");
      const marker = "        - id: topology-component-stress-primitive-coverage";
      const at = src.indexOf(marker);
      assert.notEqual(at, -1, "the manifest must contain the specimen scenario");
      const head = src.slice(0, at), tail = src.slice(at);
      const changedTail = tail.replace("          artifact_policy: transient", "          artifact_policy: tracked");
      assert.notEqual(changedTail, tail, "the fixture must change the specimen artifact policy");
      fs.writeFileSync(f, head + changedTail);
    }, /full-primitive-specimen must declare artifact_policy: transient/],
  ];
  for (const [label, mutate, expected] of cases) {
    const pkg = pkgCopy();
    mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${label}: ${r.out}`);
    assert.match(r.out, expected, label);
    drop(pkg);
  }
});

test("Wave2 CP3: node kind is separate from icon, aliases normalize, and event direction is a distinct axis", () => {
  const F = (pkg) => path.join(typesOf(pkg), "inputs", "topology-component.canonical.yaml");
  const cases = [
    ["unknown kind", (t) => t.replace('kind: "gateway"', 'kind: "vendor-router"'), /not in the architecture vocabulary/],
    ["kind-icon mismatch", (t) => t.replace('icon: "route"', 'icon: "database"'), /not allowed for kind "gateway"/],
    ["event must be async", (t) => t.replace('kind: "request"', 'kind: "event"'), /event edge "request-client-gateway" must use async delivery/],
  ];
  for (const [label, mutate, re] of cases) {
    const pkg = pkgCopy(), f = F(pkg);
    fs.writeFileSync(f, mutate(fs.readFileSync(f, "utf8")));
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${label}: ${r.out}`);
    assert.match(r.out, re, label);
    drop(pkg);
  }
  const pkg = pkgCopy(), f = F(pkg);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8")
    .replace('kind: "gateway"\n        icon: "route"', 'kind: "client"\n        icon: "users"')
    .replace('kind: "request"\n    delivery: "sync"', 'kind: "event"\n    delivery: "async"'));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 0, r.out);
  drop(pkg);
  assert.equal(NODE_KINDS.length, 10);
});

test("R1B-P1c: content floors are distinguished by name and carry their evidence level", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  assert.equal((doc.match(/floor_basis: geometry/g) ?? []).length, 9, "every Wave 1 number is a geometric assumption");
  const cards = doc.split(/^  - id: cards-kpi-grid$/m)[1].split(/^  - id: /m)[0];
  assert.match(cards, /itemMinW: 149, itemMinH: 124/, "the base floor is at least the existing visual evidence");
  assert.match(cards, /compactItemMinW: 132, compactItemMinH: 104/, "compact has its own floor");
  const layer = doc.split(/^  - id: layer-stack$/m)[1].split(/^  - id: /m)[0];
  assert.match(layer, /floor: wide, result: needs-split/, "four chips do not hold at 4:5");
  for (const f of ["cards-kpi-grid", "layer-stack", "process-flow"]) {
    const spec = fs.readFileSync(path.join(here, "..", "references", "types", "specs", `${f}.md`), "utf8");
    assert.match(spec, /`fit\.floor_basis` reads `geometry`, these numbers are a\s*\n\s*\*\*geometric assumption\*\*/, f);
  }
});

// --- CP2A: the typed payload plus stress scenario contract (with R1 applied) ---------------------
test("CP2A: input is a structured payload and KO/EN are bound inside the same entity", () => {
  const m = JSON.parse(run(["manifest", "--json"]).out);
  assert.equal(m.errors.length, 0, JSON.stringify(m.errors));
  const dir = path.join(here, "..", "references", "types", "inputs");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  assert.ok(files.length >= 27, `${files.length} input files (9 canonical plus the stress scenarios)`);
  const cards = fs.readFileSync(path.join(dir, "cards-kpi-grid.canonical.yaml"), "utf8");
  assert.match(cards, /^cards:$/m, "it must have a per-type collection");
  assert.match(cards, /^ {4}title:\n {6}ko: /m, "locales are bound inside the entity");
  assert.doesNotMatch(cards, /^items_ko:/m, "the parallel-array approach is retired");
  const topo = fs.readFileSync(path.join(dir, "topology-component.canonical.yaml"), "utf8");
  for (const k of ["zones:", "nodes:", "edges:", "boundary:"]) assert.ok(topo.includes(k), k);
  const appr = fs.readFileSync(path.join(dir, "approval-gate.canonical.yaml"), "utf8");
  assert.match(appr, /^gate:$/m, "approval carries gate as a real field");
});

test("CP2A: a missing payload, an over-budget value, a missing locale and a wrong reference are refused", () => {
  const F = (pkg, f) => path.join(typesOf(pkg), "inputs", f);
  const cases = [
    [(pkg) => { const f = F(pkg, "approval-gate.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^gate:\n(?: {2}.*\n| {4}.*\n| {6}.*\n)+/m, "")); },
     /payload — approval payload requires a gate/],
    [(pkg) => { const f = F(pkg, "cards-kpi-grid.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('      en: "Observability in place"', '      en: "' + "x".repeat(60) + '"')); },
     /title\.en is 60 graphemes, over the 44/],
    [(pkg) => { const f = F(pkg, "cards-kpi-grid.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('      en: "Observability in place"\n', "")); },
     /is missing the en value/],
    [(pkg) => { const f = F(pkg, "topology-component.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('    to: "service"', '    to: "ghost-node"')); },
     /is not an existing node/],
    [(pkg) => { const f = F(pkg, "roadmap-timeline.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('status: "future"', 'status: "current"')); },
     /exactly one phase must be "current"/],
    [(pkg) => { const f = F(pkg, "cards-kpi-grid.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('  - id: "security"', '  - id: "observability"')); },
     /duplicate cards entity id/],
  ];
  for (const [mutate, re] of cases) {
    const pkg = pkgCopy();
    mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${re}: ${r.out}`);
    assert.match(r.out, re);
    drop(pkg);
  }
});

test("CP2A-R1B: eight payload negatives for the canaries (cards and topology)", () => {
  const F = (pkg, f) => path.join(typesOf(pkg), "inputs", f);
  const cards = "cards-kpi-grid.canonical.yaml", topo = "topology-component.stress-cardinality.yaml";
  const edit = (pkg, f, from, to) => {
    const p2 = F(pkg, f);
    fs.writeFileSync(p2, fs.readFileSync(p2, "utf8").replace(from, to));
  };
  const cases = [
    ["a wrong icon id", (pkg) => edit(pkg, cards, 'icon: "activity"', 'icon: "../../evil.svg"'), /is not a bundled icon id/],
    ["a numeral over the 5-glyph budget", (pkg) => edit(pkg, cards, '    icon: "activity"', '    numeral:\n      ko: "123456"\n      en: "123456"'), /numeral\.(ko|en) is 6 graphemes, over the 5 budget/],
    ["a missing body locale", (pkg) => edit(pkg, cards, '      en: "Logs, metrics and traces as one"\n', ""), /body is missing the en value/],
    ["an over-budget body", (pkg) => edit(pkg, cards, '      en: "Logs, metrics and traces as one"', '      en: "' + "x".repeat(60) + '"'), /body\.en is 60 graphemes, over the 48/],
    ["five nodes in one zone", (pkg) => edit(pkg, topo, '      - id: "queue"', '      - id: "extra1"\n        name:\n          ko: "추가"\n          en: "Extra"\n      - id: "extra2"\n        name:\n          ko: "추가2"\n          en: "Extra2"\n      - id: "extra3"\n        name:\n          ko: "추가3"\n          en: "Extra3"\n      - id: "queue"'), /holds \d+ nodes; the contract allows 1–4|caps it at 9/],  /* lang-allow: ko-fixture */
    ["a missing node name locale", (pkg) => edit(pkg, topo, '          en: "Gateway"\n', ""), /node "gw" name is missing the en value/],
    ["thirteen edges", (pkg) => edit(pkg, topo, '  - id: "e12"', '  - id: "e13"\n    from: "gw"\n    to: "cache"\n    kind: "dependency"\n    delivery: "sync"\n    visibility: "private"\n  - id: "e12"'), /over the 12 cap/],
    ["duplicate edge id", (pkg) => edit(pkg, topo, '  - id: "e12"', '  - id: "e11"'), /duplicate edge id "e11"/],
    ["a missing boundary label locale", (pkg) => edit(pkg, topo, '    en: "System boundary"\n', ""), /boundary label is missing the en value/],
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

test("CP2A-R1B: covers must be observed in the payload (false coverage is refused)", () => {
  const pkg = pkgCopy();
  // attaching copy-boundary-candidate to a short-copy scenario is refused because it is not observed
  writeManifest(pkg, readManifest(pkg).replace(
    "          covers: [cardinality-max]\n", "          covers: [cardinality-max, copy-boundary-candidate]\n"));
  const short = path.join(typesOf(pkg), "inputs", "layer-stack.stress-cardinality.yaml");
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares covers "copy-boundary-candidate" but the payload does not exhibit it/);
  assert.ok(fs.existsSync(short));
  drop(pkg);
});

test("CP2A-R1B: an unknown field at root or entity level fails closed", () => {
  const cases = [
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "cards-kpi-grid.canonical.yaml");
      fs.appendFileSync(f, 'extra_root:\n  - id: "x"\n'); }, /payload root has unknown field "extra_root"/],
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "cards-kpi-grid.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('    icon: "activity"', '    icon: "activity"\n    rogue: "x"')); },
     /entity "observability" has unknown field "rogue"/],
  ];
  for (const [mutate, re] of cases) {
    const pkg = pkgCopy();
    mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${re}: ${r.out}`);
    assert.match(r.out, re);
    drop(pkg);
  }
});

test("CP2A-R1B: before-after separates the panel count from the mirrored slot count", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "inputs", "before-after.stress-cardinality.yaml"), "utf8");
  assert.match(doc, /^panels:$/m);
  assert.match(doc, /^slots:$/m);
  assert.equal((doc.match(/^ {2}- id: /gm) ?? []).length >= 7, true, "panel 2 + slot 5");
  const pkg = pkgCopy();
  const f = path.join(typesOf(pkg), "inputs", "before-after.canonical.yaml");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^slots:\n(?: {2}- id.*\n| {4}.*\n| {6}.*\n)+/m, 'slots:\n  - id: "only"\n    before:\n      ko: "하나"\n      en: "One"\n    after:\n      ko: "둘"\n      en: "Two"\n'));  /* lang-allow: ko-fixture */
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /requires 2–5 mirrored slots \(got 1\)/);
  drop(pkg);
});

test("CP2A: stress is a list of scenarios declaring their covers axes, and geometry_expected must agree with the computation", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  for (const b of doc.split(/^  - id: /m).slice(1)) {
    const id = b.split("\n")[0].trim();
    assert.match(b, /covers: \[cardinality-max/, `${id}: a cardinality-max scenario is required`);
    assert.ok(/covers: \[[^\]]*copy-boundary-candidate/.test(b), `${id}: a copy-boundary-candidate scenario is required`);
    assert.match(b, /geometry_expected: (fits|needs-split)/, `${id}: the geometric verdict must be stated`);
  }
  const cases = [
    [(t) => t.replace(/          covers: \[cardinality-max\]\n/, "          covers: []\n"), /must declare the risk axes it covers/],
    [(t) => t.replace("          geometry_expected: fits\n          covers: [cardinality-max]",
                      "          geometry_expected: needs-split\n          covers: [cardinality-max]"),
     /declares geometry_expected "needs-split" but computes "fits"/],
    [(t) => t.replace(/          covers: \[cardinality-max[^\]]*\]/g, "          covers: [copy-boundary-candidate]"), /must cover "cardinality-max"/],
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

test("CP2A: an input file case is bound 1:1 to its scenario", () => {
  const pkg = pkgCopy();
  const f = path.join(typesOf(pkg), "inputs", "cards-kpi-grid.stress-copy.yaml");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("case: stress-copy", "case: stress-cardinality"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /input file case "stress-cardinality" != scenario "stress-copy"/);
  drop(pkg);
});

// --- closing the CP2A conditional approval: the eight required negatives ----------------------
test("CA-1 and CA-2: a topology node icon and a roadmap milestone card are required", () => {
  const cases = [
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "topology-component.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('        icon: "route"\n', "")); },
     /node "gateway" is missing its icon/],
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "roadmap-timeline.canonical.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^    card:\n(?: {6}.*\n| {8}.*\n)+/m, "")); },
     /is missing its required milestone card/],
  ];
  for (const [mutate, re] of cases) {
    const pkg = pkgCopy(); mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${re}: ${r.out}`);
    assert.match(r.out, re);
    drop(pkg);
  }
});

test("CA-3: the IDs of sub-entities (chip, example, delta, edge) must also be kebab-case and unique", () => {
  const cases = [
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "before-after.stress-cardinality.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('  - id: "d2"', '  - id: "d1"')); }, /duplicate delta id "d1"/],
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "layer-stack.stress-degrade.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('      - id: "chip-1-2"', '      - id: "chip-1-1"')); }, /duplicate chip of "layer-1" id/],
    [(pkg) => { const f = path.join(typesOf(pkg), "inputs", "decision-matrix.stress-cardinality.yaml");
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('  - id: "cell-2"', '  - id: "CELL_2"')); }, /must be kebab-case/],
  ];
  for (const [mutate, re] of cases) {
    const pkg = pkgCopy(); mutate(pkg);
    const r = runIn(pkg, ["manifest"]);
    assert.equal(r.code, 1, `${re}: ${r.out}`);
    assert.match(r.out, re);
    drop(pkg);
  }
});

test("CA-4: an observed audited axis missing from covers is refused (both ways)", () => {
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace("covers: [cardinality-max, edge-density]", "covers: [cardinality-max]"));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /payload exhibits "edge-density" but it is not declared in covers/);
  drop(pkg);
});

test("CA-5: a copy boundary needs a witness in KO and in EN", () => {
  const pkg = pkgCopy();
  // leaving only the EN witness and shortening the KO means it is not observed as a candidate
  const f = path.join(typesOf(pkg), "inputs", "cards-kpi-grid.stress-copy.yaml");
  let t = fs.readFileSync(f, "utf8").replace(/^      ko: ".*"$/gm, '      ko: "짧음"');  /* lang-allow: ko-fixture */
  fs.writeFileSync(f, t);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /declares covers "copy-boundary-candidate" but the payload does not exhibit it/);
  drop(pkg);
});

test("CA-6: a TypePack with a needs-split tuple must carry a degrade input", () => {
  const doc = fs.readFileSync(path.join(here, "..", "references", "types", "manifest.yaml"), "utf8");
  assert.ok((doc.match(/geometry_expected: needs-split/g) ?? []).length >= 5, "every type holding a needs-split tuple has a degrade input");
  const pkg = pkgCopy();
  writeManifest(pkg, readManifest(pkg).replace(/        - id: cards-kpi-grid-stress-degrade\n(?:          .*\n)+/, ""));
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /at least one stress input must exercise the degrade path/);
  drop(pkg);
});

test("CA-7: the canonical input count must equal fit.cardinality.canonical", () => {
  const pkg = pkgCopy();
  const m0 = readManifest(pkg);
  const m1 = m0.replace("        id: cards-kpi-grid-canonical\n", "        id: cards-kpi-grid-canonical\n        count: 3\n").replace("        count: 4\n", "");
  assert.notEqual(m1, m0, "manifest mutation must actually apply — a silent no-op would make this test vacuous");
  writeManifest(pkg, m1);
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /inputs\.canonical count 3 != fit\.cardinality\.canonical \(4\)/);
  drop(pkg);
});

test("CA-8: a roadmap label is an authoring sanity ceiling, not a hard budget", () => {
  const pkg = pkgCopy();
  const f = path.join(typesOf(pkg), "inputs", "roadmap-timeline.canonical.yaml");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace('      ko: "준비"', '      ko: "' + "가".repeat(20) + '"'));  /* lang-allow: ko-fixture */
  const r = runIn(pkg, ["manifest"]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /label\.ko is 20 graphemes, over the 16 authoring sanity ceiling/);
  drop(pkg);
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
  // verify the ratio against the real preset values (the receipt canvas) — if the YAML drifts again this fails here
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
test("typography: the registry selects current.typography", () => {
  const r = run(["registry", "--json"]);
  assert.equal(JSON.parse(r.out).errors.length, 0, r.out);
});
test("typography: an attempt to allow synthetic is refused", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-synthetic.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /synthetic must be "forbidden"/);
});
test("typography: a non-numeric weight is refused", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-bad-weight.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /weights must be a non-empty list of numeric weights/);
});
test("typography: an unknown field is refused", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-unknown-field.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown field "letter-spacing"/);
});
test("typography: a missing locale is refused", () => {
  const r = run(["typography", path.join(FIX, "typography", "typo-missing-locale.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /missing locale "en"/);
});
test("typography: the deterministic stack rides along in the resolve receipt", () => {
  const r = run(["resolve", "current", "--mode", "light", "--treatment", "sketch", "--json"]);
  const j = JSON.parse(r.out);
  assert.equal(j.typography.stack, '"Hi Melody", Pretendard, sans-serif');
  assert.equal(j.typography.weightPolicy, "normalize-400");
  assert.equal(j.typography.synthetic, "forbidden");
  assert.ok(j.typography.profileDigest);
  const r2 = run(["resolve", "current", "--mode", "light", "--json"]);
  assert.equal(JSON.parse(r2.out).typography.stack.startsWith("Pretendard, Inter"), true);
});

// --- typography-check (preventing a lost composite wrapper) -----------------------
const TFIX = path.join(FIX, "typography");
test("typography-check: positive (alias kept, explicit secondary, weight 400)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-positive.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("typography-check: a lost wrapper font-family fails closed", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-wrapper-lost.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST .*wrapper lost the typography alias/);
});
test("typography-check: weight 700 on a regular-only face is an error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-weight-700.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-WEIGHT .*synthetic weights are forbidden/);
});
test("typography-check: a secondary fallback without annotation is an error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-secondary-unannotated.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST/);
});
test("typography-check: a remote font src is an error", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-remote-font.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-REMOTE/);
});
test("typography-check: a weight 700 inherited from an ancestor g is detected too (F2)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-inherited-weight.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-WEIGHT .*inherited cascade included/);
});
test("typography-check: a spaced or single-quote scope is recognised, so the loss is still detected (F2)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-single-quote-scope.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST/);
});
test("typography-check: a sound spaced double-quote combination passes (F2 equivalence)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-spaced-scope-ok.svg")]);
  assert.equal(r.code, 0, r.out);
});
test("typography-check: a marker present with zero scope text fails closed (F2)", () => {
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
test("typography-check: a single-quote root sketch is also subject to the gate (R1B2-1)", () => {
  const r = run(["typography-check", path.join(TFIX, "tf-sq-sketch-root.svg")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /E-TYPO-LOST|E-TYPO-WEIGHT/);
});
test("typography: bundled with license.evidence missing is an error (F8)", () => {
  const r = run(["typography", path.join(TFIX, "typo-missing-license-evidence.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /bundled asset requires license.evidence/);
});
test("typography: a digest mismatch on a bundled asset is an error", () => {
  const pkg = pkgCopy();
  const tp = path.join(pkg, "references", "typography", "typography-v1.yaml");
  fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/digest: [0-9a-f]{64}/, "digest: " + "f".repeat(64)));
  const r = runIn(pkg, ["typography", tp]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /asset\.faces\[0\] digest mismatch/);   // it must say which face mismatched
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
test("manifest v2: an unknown composition field is refused", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-unknown.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /composition unknown field "max_modules"/);
});
test("manifest v2: a preferred_slot_aspect with min > max is refused", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-bad-aspect.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /preferred_slot_aspect must be \{min, max\}/);
});
test("manifest v2: a bad port direction enum is refused", () => {
  const r = run(["manifest", path.join(FIX, "manifest-comp-bad-port.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /direction must be out\|in\|bidir/);
});
test("manifest v2: a v1 manifest is refused under the atomic upgrade policy", () => {
  const r = run(["manifest", path.join(FIX, "manifest-v1-rejected.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /schema_version must be 2/);
});
test("manifest: missing spec path fails closed", () => {
  const r = run(["manifest", path.join(FIX, "manifest-missing-spec.yaml")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /spec path not found/);
});
