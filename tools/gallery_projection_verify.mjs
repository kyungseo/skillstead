#!/usr/bin/env node
// Cross-environment projection evidence check for the repository gallery.
//
// `projection.mjs verify` deliberately uses same-environment canonical PNG regeneration as its
// oracle. Gallery CI runs on Linux while the committed showcase receipts were produced on macOS,
// so claiming that exact regeneration here would contradict the public presentation contract.
// This checker instead re-establishes the contract's cross-environment boundary: receipt-bound
// input/output bytes, the registered manifest and asset, and the deterministic composed RGBA
// pixels. The receipt's producer-environment canonical verification remains an explicit recorded
// fact; it is not relabelled as a Linux render pass.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  CODEC,
  composeProjection,
  decodePng,
  projectedScale,
  renderSignature,
  sha256,
  validateSurfaceManifest,
} from "../skills/svg-infographic/scripts/projection-contract.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");

function fail(message) { throw new Error(message); }
function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { fail(`${label} is not valid JSON: ${error.message}`); }
}
function realFile(file, label) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`${label} not found: ${file ?? ""}`);
  return fs.realpathSync(file);
}
function contained(target, root, label) {
  const value = fs.realpathSync(target), base = fs.realpathSync(root);
  if (value !== base && !value.startsWith(`${base}${path.sep}`)) fail(`${label} escapes repository root`);
  return value;
}
function receiptLocator(receiptPath, value, root, label) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\"))
    fail(`${label} must be a relative locator`);
  return contained(realFile(path.resolve(path.dirname(receiptPath), value), label), root, label);
}
function same(actual, expected, label) {
  if (actual !== expected) fail(`${label}: ${actual} != ${expected}`);
}
function sameJson(actual, expected, label) {
  same(JSON.stringify(actual), JSON.stringify(expected), label);
}
function parseArgs(argv) {
  const out = { repoRoot: defaultRoot };
  const known = new Set(["--repo-root", "--receipt", "--out"]);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!known.has(key) || i + 1 >= argv.length) fail(`unknown or incomplete option: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (name in out && name !== "repoRoot") fail(`duplicate option: ${key}`);
    out[name] = argv[++i];
  }
  if (!out.receipt || !out.out) fail("--receipt and --out are required");
  return out;
}

export function verifyGalleryProjection({ repoRoot, receiptPath, outPath }) {
  const root = fs.realpathSync(repoRoot);
  const packageRoot = fs.realpathSync(path.join(root, "skills", "svg-infographic"));
  const receiptFile = contained(realFile(receiptPath, "projection receipt"), root, "projection receipt");
  const outputFile = contained(realFile(outPath, "projection output"), root, "projection output");
  const receipt = readJson(receiptFile, "projection receipt");
  sameJson(receipt.schema, { name: "svg-infographic-projection-receipt", version: 1 }, "receipt schema");
  same(receipt.status, "pass", "receipt status");
  same(receipt.classification, "projection-pass", "receipt classification");

  const svgPath = receiptLocator(receiptFile, receipt.inputs?.svg?.locator, root, "source SVG");
  const canonicalPath = receiptLocator(receiptFile, receipt.inputs?.canonical_png?.locator, root, "canonical PNG");
  const manifestPath = receiptLocator(receiptFile, receipt.surface?.manifest_locator, root, "surface manifest");
  contained(manifestPath, path.join(packageRoot, "references", "presentation", "surfaces"), "surface manifest");

  const svgBytes = fs.readFileSync(svgPath);
  const canonicalBytes = fs.readFileSync(canonicalPath);
  const manifestBytes = fs.readFileSync(manifestPath);
  const outputBytes = fs.readFileSync(outputFile);
  const manifest = validateSurfaceManifest(readJson(manifestPath, "surface manifest"));
  if (path.isAbsolute(manifest.asset.path) || manifest.asset.path.includes("\\") || manifest.asset.path.split("/").includes(".."))
    fail("surface asset path is unsafe");
  const assetPath = contained(realFile(path.resolve(packageRoot, manifest.asset.path), "surface asset"), packageRoot, "surface asset");
  const assetBytes = fs.readFileSync(assetPath);

  same(sha256(svgBytes), receipt.inputs?.svg?.sha256, "source SVG digest");
  same(sha256(canonicalBytes), receipt.inputs?.canonical_png?.sha256, "canonical PNG digest");
  same(sha256(manifestBytes), receipt.surface?.manifest_sha256, "surface manifest digest");
  same(sha256(assetBytes), receipt.surface?.asset_sha256, "surface asset digest");
  same(manifest.id, receipt.surface?.id, "surface id");
  same(sha256(outputBytes), receipt.output?.sha256, "projection output digest");
  same(outputBytes.length, receipt.output?.bytes, "projection output bytes");
  same(path.basename(outputFile), receipt.output?.path, "projection output path");

  const canonical = decodePng(canonicalBytes);
  const background = decodePng(assetBytes);
  const output = decodePng(outputBytes);
  same(background.width, manifest.asset.width, "surface asset width");
  same(background.height, manifest.asset.height, "surface asset height");
  sameJson(receipt.layers, manifest.layers, "receipt layers");
  same(receipt.blend_profile, manifest.blend_profile, "receipt blend profile");
  sameJson(receipt.geometry?.content_plane, manifest.content_plane, "receipt content plane");
  sameJson(receipt.geometry?.safe_area, manifest.safe_area, "receipt safe area");
  same(receipt.geometry?.minimum_projected_scale, manifest.minimum_projected_scale, "receipt scale floor");
  same(receipt.geometry?.projected_scale, projectedScale({ source: canonical, plane: manifest.content_plane }), "receipt projected scale");
  sameJson(receipt.canvas_adaptation?.declared ?? null, manifest.canvas_adaptation ?? null, "receipt canvas adaptation declaration");
  for (const [key, value] of Object.entries(CODEC)) {
    if (key === "accepted_color_types") sameJson(receipt.compositor?.[key], value, `compositor ${key}`);
    else same(receipt.compositor?.[key], value, `compositor ${key}`);
  }

  const canonicalEvidence = receipt.canonical_verification ?? {};
  same(canonicalEvidence.classification, "pass", "recorded canonical classification");
  same(canonicalEvidence.render_exit, 0, "recorded canonical render exit");
  same(canonicalEvidence.regenerated_png_sha256, sha256(canonicalBytes), "recorded regenerated canonical digest");
  same(canonicalEvidence.supplied_png_sha256, sha256(canonicalBytes), "recorded supplied canonical digest");
  if (typeof canonicalEvidence.renderer !== "string" || !canonicalEvidence.renderer)
    fail("recorded canonical renderer is missing");

  let recomposed = composeProjection({
    background,
    source: canonical,
    plane: manifest.content_plane,
    layers: manifest.layers,
    canvasAdaptation: manifest.canvas_adaptation ?? null,
    blendProfile: manifest.blend_profile,
  });
  const signature = receipt.signature ?? {};
  if (signature.requested === true) {
    same(signature.status, "rendered", "signature status");
    if (typeof signature.value !== "string") fail("signature value is missing");
    same(sha256(Buffer.from(signature.value, "utf8")), signature.sha256, "signature digest");
    recomposed = renderSignature(recomposed, manifest.signature_slot, signature.value);
  } else {
    sameJson(signature, { requested: false, status: "absent" }, "absent signature record");
  }
  sameJson(receipt.canvas_adaptation?.resolved ?? null, recomposed.canvas_adaptation ?? null, "resolved canvas adaptation");
  same(output.width, recomposed.width, "projection output width");
  same(output.height, recomposed.height, "projection output height");
  if (!output.data.equals(recomposed.data)) fail("projection output pixels differ from current invariant recomputation");
  return { classification: "invariant-pass", output_sha256: sha256(outputBytes) };
}

export function main(argv) {
  try {
    const opts = parseArgs(argv);
    const result = verifyGalleryProjection({
      repoRoot: path.resolve(opts.repoRoot), receiptPath: path.resolve(opts.receipt), outPath: path.resolve(opts.out),
    });
    console.log(`gallery projection invariant verify: pass  sha256:${result.output_sha256}`);
    return 0;
  } catch (error) {
    console.error(`gallery-projection-invalid: ${error.message}`);
    return 12;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)))
  process.exit(main(process.argv.slice(2)));
