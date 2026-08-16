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

// --- featured: the repository's editorial selection ------------------------------------
// Validated here so a bad entry fails the build rather than rendering a broken card. The rules are
// deliberately few: the artifact must exist in both locales, and a caption may not carry digits —
// a number in a caption is a claim about the picture that no gate verifies.
const featuredPath = path.join(root, "gallery", "featured.json");
const featured = { source: "gallery/featured.json", entries: [], errors: [] };
if (!existsSync(featuredPath)) {
  featured.errors.push("gallery/featured.json is missing — the featured showcase has no source");
} else {
  let doc;
  try { doc = JSON.parse(readFileSync(featuredPath, "utf8")); }
  catch (e) { featured.errors.push(`gallery/featured.json is unreadable: ${e.message}`); doc = null; }
  const seen = new Set();
  for (const entry of (doc?.entries ?? [])) {
    const slug = String(entry.slug ?? "");
    if (!slug) { featured.errors.push("featured entry has no slug"); continue; }
    if (seen.has(slug)) { featured.errors.push(`featured "${slug}" is listed twice`); continue; }
    seen.add(slug);
    for (const field of ["name", "name_ko", "caption", "caption_ko", "reason"])
      if (!entry[field]) featured.errors.push(`featured "${slug}" is missing ${field}`);
    for (const field of ["caption", "caption_ko"])
      if (/\d/.test(String(entry[field] ?? "")))
        featured.errors.push(`featured "${slug}" ${field} carries a digit — captions stay qualitative `
          + `because a count is a claim no gate checks (got "${entry[field]}")`);
    // The palette profile is declared per entry and never inherited. `legacy-unprofiled` is a dated
    // exception for the six v0.8-era entries, not a default a new one can drift into.
    const PALETTE = new Set(["current", "legacy-unprofiled"]);
    if (!PALETTE.has(entry.paletteProfile ?? ""))
      featured.errors.push(`featured "${slug}" must declare paletteProfile (current | legacy-unprofiled) `
        + `— a new entry passes the current gate, and an exception has to be stated, not assumed`);
    if (entry.paletteProfile === "legacy-unprofiled" && !entry.paletteNote)
      featured.errors.push(`featured "${slug}" claims legacy-unprofiled without paletteNote — `
        + `an exception carries its reason and its disposition condition`);
    if (entry.span !== undefined)
      featured.errors.push(`featured "${slug}" declares span — the grid sizes every entry the same, `
        + `so a per-entry size control would be a field nothing reads`);
    const dir = path.join(root, "examples", "svg-infographic", slug);
    const art = {};
    for (const loc of ["ko", "en"]) {
      const rel = `examples/svg-infographic/${slug}/${slug}.${loc}.svg`;
      if (!existsSync(path.join(root, rel))) featured.errors.push(`featured "${slug}": ${rel} is missing`);
      else art[loc] = rel;
    }
    // Recorded, not required: these are hand-authored examples that predate the TypePack receipts.
    const receipt = existsSync(path.join(dir, `${slug}.ko.json`));
    featured.entries.push({ slug, name: entry.name, nameKo: entry.name_ko,
                            caption: entry.caption, captionKo: entry.caption_ko,
                            reason: entry.reason,
                            artifacts: art, hasReceipt: receipt,
                            paletteProfile: entry.paletteProfile,
                            paletteNote: entry.paletteNote ?? null });
  }
  if (!featured.entries.length && !featured.errors.length)
    featured.errors.push("gallery/featured.json declares no entry");
}

process.stdout.write(JSON.stringify({ schemaVersion: 1, typepacks: packs, payloads, featured }, null, 1) + "\n");
