#!/usr/bin/env node
// treatment.mjs — surface treatment resolver.
//
// 소유권 경계(이 파일이 지키는 것):
//   generator     : treatment 선택과 artifact 구조 생성        (generate.mjs)
//   treatment     : paper·rough filter·highlight 등 시각 처리   ← 이 파일
//   typography    : face·weight·subset·license                 (typography-v1.yaml)
//   materializer  : semantic paint 값 갱신만                    (skin.mjs materializeSvg)
//
// 그래서 여기서는 filter와 paper·highlight만 만들고 **글꼴을 고르지 않으며**,
// palette role 값을 다시 칠하지도 않는다. 반대로 materializer에 filter를 넣지 않는다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./skin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const refs = path.join(here, "..", "references");

export const TREATMENTS = ["flat", "sketch"];

// registry가 허용한 overlay만 treatment로 선택할 수 있다 — 파일이 있다고 쓰지 않는다.
export function loadTreatment(name, mode = "light") {
  if (!TREATMENTS.includes(name)) throw new Error(`unknown treatment "${name}" (${TREATMENTS.join("|")})`);
  if (name === "flat") return { name, mode, overlay: null, filters: [], paper: null, highlight: null };
  const reg = parseYaml(readFileSync(path.join(refs, "skins", "registry.yaml"), "utf8"), "registry.yaml");
  const sel = reg.overlays?.[name];
  if (!sel) throw new Error(`treatment "${name}" is not selected by the skin registry — an overlay file alone does not authorise it`);
  const overlay = parseYaml(readFileSync(path.join(refs, "skins", `${sel}.yaml`), "utf8"), `${sel}.yaml`);
  if (overlay.kind !== "surface-treatment") throw new Error(`registry selects "${sel}" for treatment "${name}" but it is not a surface-treatment overlay`);
  // dark × sketch는 시각 승인 전까지 거부한다(overlay가 선언한 제약).
  if (mode !== "light") throw new Error(`unsupported combination: ${mode} + ${name} (this kernel supports light only)`);
  const t = overlay.tokens ?? {};
  for (const k of ["paper", "sketch-ink", "highlight"])
    if (!t[k]) throw new Error(`overlay ${sel} is missing the "${k}" token`);
  return {
    name, mode, overlay: sel,
    paper: t.paper, ink: t["sketch-ink"], highlight: t.highlight,
    // 수치는 overlay 선언에서 읽는다 — 이 파일에 상수를 다시 적지 않는다.
    filters: ["rough-box", "rough-line"].map((id) => ({ id, spec: String(overlay.treatment?.[id] ?? "") })),
  };
}

const num = (spec, key, fallback) => {
  const m = new RegExp(`${key}=([\\d.]+)`).exec(spec);
  return m ? Number(m[1]) : fallback;
};

// filter defs는 treatment가 소유한다. 전면 userSpaceOnUse 영역을 쓰는 이유는
// authoring E-FILTERBOUNDS에 적혀 있다 — 퍼센트 영역은 직선에서 붕괴한다.
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

// paper는 canvas role을 **대체**하는 것이 아니라 그 위에 깔리는 treatment 표면이다.
export function paperRect(t, canvas) {
  return t.name === "flat" ? ""
    : `  <rect data-treatment-paper="1" x="0" y="0" width="${canvas.w}" height="${canvas.h}" fill="${t.paper}" data-paint-static="true"/>`;
}

// displacement가 실제로 얼마나 밀어낼 수 있는지 — containment 검사가 이 값을 쓴다.
export function displacementBound(t) {
  return t.name === "flat" ? 0 : Math.max(0, ...t.filters.map(({ spec }) => num(spec, "scale", 3)));
}

export const filterAttr = (t, kind) => (t.name === "flat" ? "" : ` filter="url(#tx-${kind})"`);
export const highlightOf = (t) => (t.name === "flat" ? null : t.highlight);
