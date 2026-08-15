#!/usr/bin/env node
// treatment.mjs — surface treatment resolver.
//
// Ownership boundary (what this file keeps):
//   generator     : selects the treatment and builds the artifact structure (generate.mjs)
//   treatment     : paper, rough filters, highlight — the visual surface     <- this file
//   typography    : face, weight, subset, license                 (typography-v1.yaml)
//   materializer  : semantic paint values only                    (skin.mjs materializeSvg)
//
// So this file makes filters, paper and highlight and **never picks a font**, nor repaints
// palette role values. Conversely, filters never move into the materializer.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./skin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const refs = path.join(here, "..", "references");

export const TREATMENTS = ["flat", "sketch"];

// Only an overlay the registry selects may be used as a treatment — a file existing is not authorisation.
export function loadTreatment(name, mode = "light") {
  if (!TREATMENTS.includes(name)) throw new Error(`unknown treatment "${name}" (${TREATMENTS.join("|")})`);
  if (name === "flat") return { name, mode, overlay: null, filters: [], paper: null, highlight: null };
  const reg = parseYaml(readFileSync(path.join(refs, "skins", "registry.yaml"), "utf8"), "registry.yaml");
  const sel = reg.overlays?.[name];
  if (!sel) throw new Error(`treatment "${name}" is not selected by the skin registry — an overlay file alone does not authorise it`);
  const overlay = parseYaml(readFileSync(path.join(refs, "skins", `${sel}.yaml`), "utf8"), `${sel}.yaml`);
  if (overlay.kind !== "surface-treatment") throw new Error(`registry selects "${sel}" for treatment "${name}" but it is not a surface-treatment overlay`);
  // dark x sketch stays refused until it is visually approved (the overlay declares this).
  if (mode !== "light") throw new Error(`unsupported combination: ${mode} + ${name} (this kernel supports light only)`);
  const t = overlay.tokens ?? {};
  for (const k of ["paper", "sketch-ink", "highlight"])
    if (!t[k]) throw new Error(`overlay ${sel} is missing the "${k}" token`);
  return {
    name, mode, overlay: sel,
    paper: t.paper, ink: t["sketch-ink"], highlight: t.highlight,
    // Numbers come from the overlay declaration — no constants are restated here.
    filters: ["rough-box", "rough-line"].map((id) => ({ id, spec: String(overlay.treatment?.[id] ?? "") })),
  };
}

const num = (spec, key, fallback) => {
  const m = new RegExp(`${key}=([\\d.]+)`).exec(spec);
  return m ? Number(m[1]) : fallback;
};

// The treatment owns its filter defs. The reason for a full-canvas userSpaceOnUse region is
// recorded in authoring E-FILTERBOUNDS — percentage regions collapse on straight strokes.
export function treatmentDefs(t, canvas) {
  if (t.name === "flat") return "";
  const region = ` x="0" y="0" width="${canvas.w}" height="${canvas.h}" filterUnits="userSpaceOnUse"`;
  return t.filters.map(({ id, spec }) => {
    const bf = num(spec, "baseFrequency", 0.05), oc = num(spec, "numOctaves", 2), sc = num(spec, "scale", 3);
    return `    <filter id="tx-${id}"${region}>
      <feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="${oc}" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
  }).join("\n");
}

// Paper does not **replace** the canvas role; it is the treatment surface laid over it.
export function paperRect(t, canvas) {
  return t.name === "flat" ? ""
    : `  <rect data-treatment-paper="1" x="0" y="0" width="${canvas.w}" height="${canvas.h}" fill="${t.paper}" data-paint-static="true"/>`;
}

// How far the displacement can actually push — the containment check consumes this.
export function displacementBound(t) {
  return t.name === "flat" ? 0 : Math.max(0, ...t.filters.map(({ spec }) => num(spec, "scale", 3)));
}

export const filterAttr = (t, kind) => (t.name === "flat" ? "" : ` filter="url(#tx-${kind})"`);
export const highlightOf = (t) => (t.name === "flat" ? null : t.highlight);
