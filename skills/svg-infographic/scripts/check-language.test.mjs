// check-language.test.mjs — does the language guard actually bite?
//
// A "zero Hangul" check would be trivially correct and useless: Hangul is legitimate wherever it
// IS the data. The whole value of this guard is in the line rules, so what has to be proven is
// that a path opening the door does not let guidance through behind data's cover. Every negative
// below is a real bypass that used to pass.
//
// The mutations happen in a **copy of the package** — the source tree is never touched, so the
// suite passes on a read-only checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

const pkgCopy = () => {
  const dst = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "w1-lang-"))), "svg-infographic");
  assert.equal(spawnSync("cp", ["-R", ROOT, dst], { encoding: "utf8" }).status, 0);
  spawnSync("chmod", ["-R", "u+w", dst], { encoding: "utf8" });
  return dst;
};
const runIn = (pkg) => {
  const env = { ...process.env };
  for (const k of ["SVGINFO_EXPECTED_SKILL_ROOT", "SVGINFO_EXECUTION_MODE"]) delete env[k];
  const r = spawnSync(process.execPath, [path.join(pkg, "scripts", "check-language.mjs")],
    { encoding: "utf8", cwd: pkg, env });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};
// Append a line to a file inside the copy and report what the guard makes of it.
const withLine = (rel, line) => {
  const pkg = pkgCopy(), f = path.join(pkg, rel);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8") + line + "\n");
  return runIn(pkg);
};

const TEST_FILE = "scripts/check-svg.test.mjs";
const KO_PAYLOAD = "references/types/inputs/cards-kpi-grid.canonical.yaml";

test("the package as committed is clean — no violation, and every allow entry is reachable", () => {
  const r = runIn(ROOT);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /violations 0 file\(s\) \/ 0 line\(s\)/);
});

// ---- inline test string: the marker is what grants the exception, not the file path ----

test("positive: Korean marked as deliberate test input passes", () => {
  const r = withLine(TEST_FILE, 'const koGlyphSample = /* lang-allow: ko-fixture */ "한글 표본";');
  assert.equal(r.code, 0, r.out);
});

test("negative: a Korean test name fails — it is guidance, not input under test", () => {
  const r = withLine(TEST_FILE, 'test("한국어 테스트 이름", () => {});');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /inline-locale-test-input.*ko-marker/);
  assert.match(r.out, /read as guidance, not data/);
});

test("negative: a Korean comment in a test file fails", () => {
  const r = withLine(TEST_FILE, "// 한국어 주석은 데이터가 아니다");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /inline-locale-test-input/);
});

test("negative: an unmarked Korean diagnostic expectation fails", () => {
  const r = withLine(TEST_FILE, 'assert.match(r.out, /한글 진단 문구/);');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /inline-locale-test-input/);
});

test("negative: the marker does not cover the whole file — one bad line is enough", () => {
  const pkg = pkgCopy(), f = path.join(pkg, TEST_FILE);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8")
    + 'const ok = /* lang-allow: ko-fixture */ "한글 표본";\n'
    + '// 같은 파일의 한국어 주석\n');  /* lang-allow: ko-fixture */
  const r = runIn(pkg);
  assert.equal(r.code, 1, r.out);
});

// ---- TypePack input: the path opens the door, but each line still has to be a ko value ----

test("positive: KO values in a canonical payload pass, including a multiline scalar", () => {
  const r = withLine(KO_PAYLOAD, 'note:\n  ko: |\n    여러 줄 KO 문안\n    두 번째 줄\n  en: "note"');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 0, r.out);
});

test("negative: a Korean comment inside a valid KO payload fails", () => {
  const r = withLine(KO_PAYLOAD, "# 이 주석은 렌더되지 않는다");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /typepack-input-payload.*ko-value/);
});

test("negative: Korean in another normative field of a KO payload fails", () => {
  const r = withLine(KO_PAYLOAD, 'verifier_note: "축 값이 자리를 정한다"');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /typepack-input-payload/);
});

test("negative: an unmarked Korean value under an en key fails", () => {
  const r = withLine(KO_PAYLOAD, '    en: "한국어"');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /typepack-input-payload/);
});

// ---- rendered locale copy in production code ----

test("negative: Korean in generate.mjs without the ko-copy marker fails", () => {
  const r = withLine("scripts/generate.mjs", 'const label = "직접 넣은 문안";');  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /rendered-locale-copy.*ko-copy/);
});

test("negative: a fourth marked ko-copy line fails — the exception is closed, not open", () => {
  // Naming an anchor that the policy does not declare.
  const unknown = withLine("scripts/generate.mjs",
    'const extra = "네 번째 문안";   /* lang-allow: ko-copy: extra-copy */');  /* lang-allow: ko-fixture */
  assert.equal(unknown.code, 1, unknown.out);
  assert.match(unknown.out, /rendered-locale-copy.*ko-copy/);
  // Re-using a declared anchor to smuggle a fourth line past the name check.
  const reused = withLine("scripts/generate.mjs",
    'const extra = "네 번째 문안";   /* lang-allow: ko-copy: page-eyebrow */');  /* lang-allow: ko-fixture */
  assert.equal(reused.code, 1, reused.out);
  assert.match(reused.out, /grants each anchor once/);
  assert.match(reused.out, /anchor "page-eyebrow" is already claimed/);
});

test("negative: a Korean comment in generate.mjs fails even with the marker on it", () => {
  const r = withLine("scripts/generate.mjs", "// 한국어 주석 /* lang-allow: ko-copy */");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /rendered-locale-copy/);
});

// ---- the generated Prompt Gallery: KO prompts are payload data, everything else is prose ----

const GALLERY = "references/PROMPT-GALLERY.md";

test("positive: the generated ko: prompt lines pass", () => {
  // The committed gallery already carries one KO prompt per routable TypePack, read verbatim from
  // the canonical payloads. If those did not pass, the view could not exist at all.
  const r = runIn(ROOT);
  assert.equal(r.code, 0, r.out);
  const ko = fs.readFileSync(path.join(ROOT, GALLERY), "utf8")
    .split("\n").filter((l) => /^ko: /.test(l) && /\p{Script=Hangul}/u.test(l));
  assert.ok(ko.length >= 9, `expected a KO prompt per routable TypePack, found ${ko.length}`);
});

test("negative: a Korean heading in the gallery fails", () => {
  const r = withLine(GALLERY, "## 한국어 제목");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /generated-gallery-prompt.*ko-value/);
});

test("negative: Korean prose in the gallery fails", () => {
  const r = withLine(GALLERY, "이 문단은 payload가 아니라 손으로 쓴 산문이다.");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /generated-gallery-prompt/);
  assert.match(r.out, /read as guidance, not data/);
});

test("negative: Korean landing in the en: field of the gallery fails", () => {
  // The KO/EN split is the point — Korean under `en:` means the payload or the generator is wrong,
  // and letting it pass would have the view claim an English prompt the package does not carry.
  const r = withLine(GALLERY, "en: 한국어가 en 필드에 들어갔다");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /generated-gallery-prompt/);
});

// ---- an unlisted file has no door at all ----

test("negative: Korean in a file with no allow entry fails", () => {
  const r = withLine("scripts/skin.mjs", "// 허용 목록에 없는 파일의 한국어");  /* lang-allow: ko-fixture */
  assert.equal(r.code, 1);
  assert.match(r.out, /no allow entry/);
});

test("negative: standalone Jamo in guidance fails — the check is the Hangul script, not just syllables", () => {
  // U+3131 and U+314B are compatibility Jamo: outside the precomposed AC00-D7A3 range, but
  // Korean to anyone reading the comment. Written escaped, so this file stays clear of the
  // very thing it is testing for.
  const r = withLine("scripts/skin.mjs", "// \u3131\u314b sound effect in a normative comment");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no allow entry/);
});

test("an allow entry without a stated reason is refused — an exception must be auditable", () => {
  const pkg = pkgCopy(), f = path.join(pkg, "references", "language-policy.yaml");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8") + '\n  - id: no-reason\n    paths: ["nowhere/*"]\n');
  const r = runIn(pkg);
  assert.equal(r.code, 1);
  assert.match(r.out, /has no reason/);
});
