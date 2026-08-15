// LEGACY suite — pre-kernel page-title rail contract tests, isolated from the
// canonical regression (design-kernel §6: the rail composition is rejected for new
// output; these keep legacy gallery examples honest until the Wave 1 regeneration).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintSvg } from "../check-svg.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "..", "fixtures", name), "utf8");
const lint = (name) => lintSvg(fixture(name), name);

test("page-title rail contract accepts one-line and two-line title stacks", () => {
  const { errors, warnings } = lint("title-rail-valid.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("page-title rail contract rejects a copied fixed height and subtitle intrusion", () => {
  const { errors } = lint("title-rail-invalid.svg");
  const layout = errors.filter((f) => f.rule === "E-LAYOUT");
  assert.equal(layout.length, 2);
  assert.ok(layout.every((f) => f.message.includes("page-title-header rail budget failed")));
  assert.ok(layout.some((f) => f.message.includes("final title line")));
  assert.ok(layout.some((f) => f.message.includes("before the subtitle")));
});

test("page-title rail contract warns when source geometry cannot be proved", () => {
  const { errors, warnings } = lint("title-rail-unverified.svg");
  assert.deepEqual(errors.filter((f) => f.rule === "E-LAYOUT"), []);
  const layout = warnings.filter((f) => f.rule === "W-LAYOUT");
  assert.equal(layout.length, 1);
  assert.match(layout[0].message, /title rail needs plain y\/height/);
});

test("page-title rail contract rejects negative budget values and a non-positive rail", () => {
  const source = fixture("title-rail-valid.svg")
    .replace('data-layout-rail-padding-top="12"', 'data-layout-rail-padding-top="-1"')
    .replace('height="145"', 'height="0"');
  const { errors } = lintSvg(source, "title-rail-invalid-contract.svg");
  const layout = errors.filter((f) => f.rule === "E-LAYOUT");
  assert.equal(layout.length, 2);
  assert.ok(layout.some((f) => f.message.includes("non-negative numeric")));
  assert.ok(layout.some((f) => f.message.includes("height must be greater than zero")));
});

test("page-title rail contract rejects zero width and warns on unsupported width", () => {
  const zeroWidth = fixture("title-rail-valid.svg").replace('width="6"', 'width="0"');
  const { errors: zeroErrors } = lintSvg(zeroWidth, "title-rail-zero-width.svg");
  assert.ok(zeroErrors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("width must be greater than zero")));

  const percentageWidth = fixture("title-rail-valid.svg").replace('width="6"', 'width="0%"');
  const { errors, warnings } = lintSvg(percentageWidth, "title-rail-percentage-width.svg");
  assert.deepEqual(errors.filter((f) => f.rule === "E-LAYOUT"), []);
  assert.ok(warnings.some((f) => f.rule === "W-LAYOUT" && f.message.includes("plain positive width")));

  const styleWidth = fixture("title-rail-valid.svg").replace('width="6"', 'width="6" style="width:0"');
  const { errors: styleErrors } = lintSvg(styleWidth, "title-rail-style-width.svg");
  assert.ok(styleErrors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("width must be greater than zero")));
});

test("page-title rail geometry uses the same local CSS precedence on every axis", () => {
  const inlineHeight = fixture("title-rail-valid.svg").replace('height="93" rx="3"', 'height="93" style="height:0" rx="3"');
  const { errors: inlineErrors } = lintSvg(inlineHeight, "title-rail-inline-height.svg");
  assert.ok(inlineErrors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("height must be greater than zero")));

  const classHeight = fixture("title-rail-valid.svg")
    .replace("  <title>", "  <style>.collapsed-rail { height: 0; }</style>\n  <title>")
    .replace('data-layout-role="title-rail" x="40" y="40"', 'data-layout-role="title-rail" class="collapsed-rail" x="40" y="40"');
  const { errors: classErrors } = lintSvg(classHeight, "title-rail-class-height.svg");
  assert.ok(classErrors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("height must be greater than zero")));

  const movedRail = fixture("title-rail-valid.svg")
    .replace("  <title>", "  <style>.moved-rail { y: 400; }</style>\n  <title>")
    .replace('data-layout-role="title-rail" x="40" y="40"', 'data-layout-role="title-rail" class="moved-rail" x="40" y="40"');
  const { errors: movedErrors } = lintSvg(movedRail, "title-rail-class-y.svg");
  assert.ok(movedErrors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("rail top differs")));
});

test("root svg geometry rules do not leak into a descendant title rail", () => {
  const source = fixture("title-rail-valid.svg").replace("  <title>", "  <style>svg { width: 100%; height: 100%; }</style>\n  <title>");
  const { errors, warnings } = lintSvg(source, "title-rail-root-svg-geometry.svg");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("page-title rail contract counts visual tspan lines, not only title elements", () => {
  const source = fixture("title-rail-valid.svg").replace(
    /* lang-allow: ko-fixture */ '<text data-layout-role="title-line" x="68" y="110" font-size="46" dominant-baseline="middle">한 줄 제목</text>',
    /* lang-allow: ko-fixture */ '<text data-layout-role="title-line" x="68" y="110" font-size="46" dominant-baseline="middle"><tspan x="68" dy="0">첫 줄</tspan><tspan x="68" dy="52">둘째 줄</tspan><tspan x="68" dy="52">셋째 줄</tspan></text>',
  );
  const { errors } = lintSvg(source, "title-rail-three-visual-lines.svg");
  assert.ok(errors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("found 3")));
});

test("an oversized page-title tolerance warns without hiding deterministic drift", () => {
  const source = fixture("title-rail-valid.svg")
    .replace('data-layout-subtitle-gap="16"', 'data-layout-subtitle-gap="16" data-layout-tolerance="999"')
    .replace('height="93"', 'height="84"');
  const { errors, warnings } = lintSvg(source, "title-rail-tolerance.svg");
  assert.ok(errors.some((f) => f.rule === "E-LAYOUT" && f.message.includes("final title line")));
  assert.ok(warnings.some((f) => f.rule === "W-LAYOUT" && f.message.includes("tolerance 999px")));
});
