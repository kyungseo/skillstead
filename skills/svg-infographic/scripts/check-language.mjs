#!/usr/bin/env node
// check-language.mjs — package language guard.
//
// This is NOT a "zero Hangul" check. Hangul is legitimate where it IS the data: rendered copy,
// locale fixtures, the registered Korean mirror. What must not drift back in is Korean
// *guidance* — comments, docstrings, diagnostics, test names, contract prose. So every Hangul
// line must match an allow entry that states its path AND its purpose; anything else fails closed.
//
// usage: node check-language.mjs [--json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./skin.mjs";
import { preflight } from "./preflight-lib.mjs";

preflight({ entrypointUrl: import.meta.url });

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
// The whole Hangul script, not just precomposed syllables: standalone Jamo (\u3131, \u314b and
// the like) reads as Korean to a person and would otherwise pass straight through a comment.
const HANGUL = /\p{Script=Hangul}/u;
const SKIP_DIRS = new Set([".git", "node_modules"]);
// Reading a binary as text makes arbitrary bytes look like Hangul — not a subject of this check.
const BINARY = new Set([".png", ".otf", ".ttf", ".woff2", ".jpg", ".jpeg", ".gif", ".pdf", ".zip"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else out.push(path.relative(root, abs).split(path.sep).join("/"));
  }
  return out;
}

// Minimal glob support only: `**` spans directories, `*` stays within one segment.
// One pass, so no placeholder is needed — a sentinel here once went in as a literal NUL and made
// this file read as binary data to `file`, `git diff` and code search.
const globToRe = (g) => new RegExp("^" + g.replace(
  /\*\*|\*|[.+^${}()|[\]\\]/g,
  (m) => (m === "**" ? ".*" : m === "*" ? "[^/]*" : "\\" + m)) + "$");


// --- line rules -------------------------------------------------------------------
// Each rule answers one question: is the Hangul on this line DATA, or is it guidance
// wearing a fixture's clothes? Anything that cannot prove it is data fails.
const isCommentLine = (l) => {
  const c = l.trimStart();
  return c.startsWith("//") || c.startsWith("*") || c.startsWith("/*") || c.startsWith("#") || c.startsWith("<!--");
};
const LINE_RULES = {
  // Deliberate Korean input in a test must SAY it is deliberate. A bare quoted string is
  // not enough — a Korean test name or an expected diagnostic would slip through as "data".
  "ko-marker": (l) => /\/\* lang-allow: ko-fixture \*\//.test(l) || /koFixture\s*\(/.test(l),
  // A KO payload line must itself be a ko value: `ko: ...`, `*_ko: ...`, or a value line of
  // a KO multiline scalar. A Korean comment or another field in the same file still fails.
  "ko-value": (l, n, text) => {
    if (isCommentLine(l)) return false;
    if (/^\s*(?:[a-z0-9_]*_)?ko\s*:/.test(l)) return true;
    // Walk back for the opener of a KO multiline scalar. Sibling value lines of the same block
    // are indented at least as far as this line, so they are stepped over; anything less indented
    // that is not the opener means this line belongs to a different key.
    const all = text.split("\n"), indent = (x) => x.match(/^\s*/)[0].length, mine = indent(l);
    for (let i = n - 2; i >= 0; i--) {
      const prev = all[i];
      if (!prev.trim()) continue;
      const open = /^(\s*)(?:[a-z0-9_]*_)?ko\s*:\s*[|>][-+]?\s*$/.exec(prev);
      if (open) return mine > open[1].length;
      if (indent(prev) < mine) return false;
    }
    return false;
  },
  // Korean the artifact itself renders, living in production code. A bare marker would leave the
  // exception open — anyone could keep adding production copy. So the line must name WHICH of the
  // anchors the policy declares it is. An unnamed or unknown anchor fails here, and the anchor
  // check in checkLanguage rejects a second claim on the same one. A Korean comment or diagnostic
  // still fails outright.
  "ko-copy": (l, n, text, hit) => {
    if (isCommentLine(l)) return false;
    const m = /\/\* lang-allow: ko-copy: ([a-z0-9-]+) \*\//.exec(l);
    return !!m && (hit.anchors ?? []).includes(m[1]);
  },
  // A fixture may carry Korean only as rendered/input text — never as a comment.
  "rendered-text": (l) => !isCommentLine(l) && !/<!--/.test(l),
};

export function checkLanguage() {
  const policy = parseYaml(readFileSync(path.join(root, "references", "language-policy.yaml"), "utf8"), "language-policy.yaml");
  const entries = (policy.allow ?? []).map((a) => ({
    ...a,
    res: (a.paths ?? []).map(globToRe),
    files: new Set(a.files ?? []),
    prefixes: a.match_prefixes ?? null,
    lineRule: a.line_rule ?? null,
    marker: a.require_marker_contains ?? null,
  }));
  for (const a of entries) if (!a.reason) throw new Error(`language-policy: allow entry "${a.id}" has no reason — an exception without a stated purpose is not auditable`);

  const findings = { violations: [], allowed: [] };
  for (const rel of walk(root)) {
    if (BINARY.has(path.extname(rel))) continue;
    let text;
    try { text = readFileSync(path.join(root, rel), "utf8"); } catch { continue; }
    const lines = text.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => HANGUL.test(l));
    if (!lines.length) continue;
    // Find the allow entry that covers this file — the path alone is not enough; the
    // purpose condition must hold too.
    const hit = entries.find((a) => {
      if (a.files.has(rel)) return true;
      if (!a.res.some((re) => re.test(rel))) return false;
      if (a.extensions && !a.extensions.includes(path.extname(rel))) return false;
      if (a.marker && !text.includes(a.marker)) return false;
      return true;
    });
    if (!hit) { findings.violations.push({ file: rel, lines: lines.length, reason: "no allow entry" }); continue; }
    // When an entry declares a line-level shape, only lines matching it are allowed.
    if (hit.prefixes) {
      const bad = lines.filter(([, l]) => !hit.prefixes.some((pre) => l.trim().startsWith(pre)));
      if (bad.length) {
        findings.violations.push({ file: rel, lines: bad.length, allow: hit.id,
          reason: `allow entry "${hit.id}" only covers lines matching its declared shape`,
          sample: bad.slice(0, 3).map(([n, l]) => `${n}: ${l.trim().slice(0, 70)}`) });
        continue;
      }
    }
    // Line rules decide per line, not per file. A path may open the door; the line still
    // has to prove it is data.
    if (hit.lineRule) {
      const bad = lines.filter(([n, l]) => !LINE_RULES[hit.lineRule](l, n, text, hit));
      if (bad.length) {
        findings.violations.push({ file: rel, lines: bad.length, allow: hit.id,
          reason: `allow entry "${hit.id}" (${hit.lineRule}) does not cover these lines — they read as guidance, not data`,
          sample: bad.slice(0, 3).map(([n, l]) => `${n}: ${l.trim().slice(0, 70)}`) });
        continue;
      }
    }
    // A named anchor is claimed once. Without this, three declared anchors would still permit any
    // number of lines, each re-using a name — the cap would be a formality.
    if (hit.anchors) {
      const seen = new Set(), dup = [];
      for (const [n, l] of lines) {
        const a = /\/\* lang-allow: ko-copy: ([a-z0-9-]+) \*\//.exec(l)?.[1];
        if (seen.has(a)) dup.push(`${n}: anchor "${a}" is already claimed`);
        seen.add(a);
      }
      if (dup.length) {
        findings.violations.push({ file: rel, lines: dup.length, allow: hit.id,
          reason: `allow entry "${hit.id}" grants each anchor once — adding another line needs a policy decision, not a marker`,
          sample: dup.slice(0, 3) });
        continue;
      }
    }
    if (hit.max_lines !== undefined && lines.length > Number(hit.max_lines)) {
      findings.violations.push({ file: rel, lines: lines.length, allow: hit.id,
        reason: `allow entry "${hit.id}" caps this file at ${hit.max_lines} Hangul line(s)` });
      continue;
    }
    findings.allowed.push({ file: rel, lines: lines.length, allow: hit.id });
  }
  return findings;
}

const f = checkLanguage();
const json = process.argv.includes("--json");
if (json) console.log(JSON.stringify({ schemaVersion: 1, command: "check-language", ...f }, null, 1));
else {
  const al = f.allowed.reduce((a, x) => a + x.lines, 0), vl = f.violations.reduce((a, x) => a + x.lines, 0);
  console.log(`check-language — allowed ${f.allowed.length} file(s) / ${al} line(s), violations ${f.violations.length} file(s) / ${vl} line(s)`);
  for (const v of f.violations) {
    console.error(`  ERROR ${v.file} (${v.lines} line(s)) — ${v.reason}`);
    for (const s of v.sample ?? []) console.error(`        ${s}`);
  }
}
process.exit(f.violations.length ? 1 : 0);
