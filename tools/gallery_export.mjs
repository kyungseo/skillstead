#!/usr/bin/env node
// gallery_export.mjs — normalized machine export of the two YAML surfaces the gallery joins on.
//
// The gallery model needs the manifest and the canonical input payloads. Re-parsing that YAML in
// Python would create a second parser free to disagree with the one that actually gates the
// package: quoted values, multiline scalars and in-sentence punctuation are exactly where two
// hand-rolled parsers drift. So this imports the package's OWN parser and emits what it produced.
//
// It lives in tools/ rather than in the package. That keeps the direction contract intact — nothing
// under skills/ learns about the repository's presentation layer — and, just as importantly, adding
// an export command inside the package would change its runtime surface digest and stale every
// example receipt. Reading the package from outside costs nothing.
//
// usage: node tools/gallery_export.mjs [--repo-root PATH]   → JSON on stdout
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../skills/svg-infographic/scripts/skin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--repo-root");
const root = path.resolve(i > -1 ? process.argv[i + 1] : path.join(here, ".."));
const REF = path.join(root, "skills", "svg-infographic", "references");

const read = (p, label) => parseYaml(readFileSync(p, "utf8"), label);

const manifest = read(path.join(REF, "types", "manifest.yaml"), "manifest.yaml");
const packs = (manifest.typepacks ?? []).filter((p) => p.support !== "gated");

const payloads = {};
for (const p of packs) {
  const entries = [p.inputs?.canonical, ...(p.inputs?.stress ?? [])].filter(Boolean);
  for (const e of entries) {
    const abs = path.join(REF, String(e.path));
    if (!existsSync(abs)) continue;                    // absence is the model's finding to report
    payloads[e.path] = read(abs, String(e.path));
  }
}

process.stdout.write(JSON.stringify({ schemaVersion: 1, typepacks: packs, payloads }, null, 1) + "\n");
