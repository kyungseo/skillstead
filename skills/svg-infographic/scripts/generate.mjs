#!/usr/bin/env node
// generate.mjs — produces an artifact from a TypePack input payload (the Wave 1 CP2B canary).
//
// The contract: the generator **consumes only the input payload** and invents no content. To make
// that evidence rather than a claim, it
//   1) plants the payload's semantic ID on every entity in the artifact as `data-entity`,
//   2) records every consumed entity ID and the input digest in the receipt, and
//   3) has verify cross-check all three — payload, receipt and artifact.
// Input whose geometry is needs-split is **not treated as a successful render** — it writes a
// degrade receipt and ends non-success (exit 3).
//
// usage:
//   node generate.mjs build  --typepack <id> --case <case> --locale ko|en --out <svg> --receipt <json>
//   node generate.mjs verify --receipt <json> [--svg <svg>] [--pair <other-locale-receipt>]
// exit: 0 ok / 1 error / 2 usage / 3 needs-split (not a success; a degrade receipt is written) / 7 preflight
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preflight, guardPackagePath, provenance, SKILL_LOCATOR } from "./preflight-lib.mjs";
import { parseYaml, derivePanelFloor, deriveAlignInventory, serializeAlignInventory, deriveMatrixPlacement } from "./skin.mjs";
import { loadTreatment, treatmentDefs, paperRect, displacementBound, filterAttr } from "./treatment.mjs";
import { estimateWidth } from "./check-svg.mjs";
import { planChannels, routeEdges, pathData, auditTopology, alignRows, ROUTE_DEFAULTS } from "./route-orthogonal.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skinCli = path.join(here, "skin.mjs");
const sha = (b) => `sha256:${createHash("sha256").update(b).digest("hex")}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => Math.round(n * 10) / 10;

function spawnJson(args, label) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) { console.error(`generate: ${label} failed (exit ${r.status})\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trimEnd()); process.exit(1); }
  try { return JSON.parse(r.stdout); } catch { console.error(`generate: ${label} did not return JSON`); process.exit(1); }
}
const readYamlFile = (p) => {
  const buf = readFileSync(guardPackagePath(p, "package-owned yaml"));
  return { doc: parseYaml(buf.toString("utf8"), path.basename(p)), digest: sha(buf) };
};

// ---------- shared: the manifest entry plus the input scenario ----------
function loadCase(tid, caseId) {
  const mPath = path.join(here, "..", "references", "types", "manifest.yaml");
  const { doc: man } = readYamlFile(mPath);
  const tp = (man.typepacks ?? []).find((p) => p.id === tid);
  if (!tp) { console.error(`generate: unknown typepack "${tid}"`); process.exit(2); }
  const all = [tp.inputs?.canonical, ...(tp.inputs?.stress ?? [])].filter(Boolean);
  const sc = all.find((x) => String(x.id).endsWith(caseId) || x.id === `${tid}-${caseId}`);
  if (!sc) { console.error(`generate: unknown case "${caseId}" for ${tid} (have: ${all.map((x) => x.id).join(", ")})`); process.exit(2); }
  const { doc: input, digest: inputDigest } = readYamlFile(path.join(here, "..", "references", sc.path));
  return { tp, sc, input, inputDigest };
}

// The geometric verdict is computed from the manifest fit params (never re-copy constants from the docs)
function computeFit(tp, sc) {
  const prm = tp.fit.params;
  // It also applies whatever extra the same configuration's footprint declared (axis labels and the like) — the same numbers the validator uses.
  const fp = (Array.isArray(tp.fit.footprint) ? tp.fit.footprint : []).find((f) =>
    Number(f.count) === Number(sc.count) && f.layout === sc.layout
    && String(f.cols ?? "") === String(sc.cols ?? "") && String(f.floor ?? "base") === String(sc.floor ?? "base"));
  const ex = { w: Number(fp?.extraW ?? 0), h: Number(fp?.extraH ?? 0) };
  const fl = sc.floor && sc.floor !== "base" ? sc.floor : null;
  const iw = Number(fl ? prm[`${fl}ItemMinW`] : prm.itemMinW);
  const ih = Number(fl ? prm[`${fl}ItemMinH`] : prm.itemMinH);
  const gx = Number(prm.gapX ?? 0), gy = Number(prm.gapY ?? 0), n = Number(sc.count);
  if (sc.layout === "row") return { w: n * iw + (n - 1) * gx + ex.w, h: ih + ex.h };
  if (sc.layout === "column") return { w: iw + ex.w, h: n * ih + (n - 1) * gy + ex.h };
  if (sc.layout === "grid") {
    const cols = Number(sc.cols), rows = Math.ceil(n / cols);
    return { w: cols * iw + (cols - 1) * gx + ex.w, h: rows * ih + (rows - 1) * gy + ex.h };
  }
  if (sc.layout === "zones") {
    const npz = Number(prm.maxNodesPerZone), pad = Number(prm.zonePad), band = Number(prm.zoneLabelBand), zg = Number(prm.zoneGap);
    return { w: npz * iw + (npz - 1) * gx + 2 * pad, h: n * (band + ih + 2 * pad) + (n - 1) * zg };
  }
  if (sc.layout === "concentric") {
    // Concentric rings take the same inset on all four sides per ring (the same formula the
    // manifest validator uses). The label sits inside that top inset band — no separate strip is
    // added.
    const inset = Number(prm.inset);
    return { w: iw + 2 * (n - 1) * inset, h: ih + 2 * (n - 1) * inset };
  }
  console.error(`generate: unsupported layout "${sc.layout}"`); process.exit(1);
}

// ---------- header (design-kernel §6: computed title-keyline default) ----------
function header(pf, title, eyebrow, subtitle, contentTop) {
  const hs = pf.headerScale, kl = hs.keyline, hr = pf.regions.headerRegion;
  // PageFrame does not expose the header cluster's row baselines, so they are derived to fill the headerRegion.
  const x = hr.x + kl.width + kl.gap;
  // Distribute three rows within the headerRegion: eyebrow, the H1 line-box (= the keyline), and
  // the subtitle. The keyline derives from the H1 line-box alone, so the gaps are computed to keep
  // it clear of the eyebrow and subtitle.
  const eyeRow = hs.eyebrow * 1.2, keyRow = hs.h1 + 2 * kl.pad, subRow = hs.subtitle * 1.1;
  const gap = Math.max(3, (hr.h - (eyeRow + keyRow + subRow)) / 2);
  const eyeY = hr.y + eyeRow / 2;
  const h1y = hr.y + eyeRow + gap + keyRow / 2;
  const subY = hr.y + eyeRow + gap + keyRow + gap + subRow / 2;
  const top = h1y - hs.h1 / 2 - kl.pad, bottom = h1y + hs.h1 / 2 + kl.pad;
  return `  <g data-layout-role="header-cluster" data-layout-content-top="${r1(contentTop)}" data-layout-breathing="${pf.regions.breathing}" data-layout-tolerance="2">
    <rect data-layout-role="cluster-keyline" data-fill-role="focus" x="${r1(hr.x)}" y="${r1(top)}" width="${kl.width}" height="${r1(bottom - top)}" rx="${kl.width / 2}" fill="#2E6DA4"/>
    <text data-layout-role="cluster-eyebrow" data-fill-role="muted" x="${r1(x)}" y="${r1(eyeY)}" font-size="${hs.eyebrow}" font-weight="700" letter-spacing="0.10em" fill="#636A75" dominant-baseline="central">${esc(eyebrow)}</text>
    <text data-layout-role="cluster-h1" data-fill-role="ink" x="${r1(x)}" y="${r1(h1y)}" font-size="${hs.h1}" font-weight="700" fill="#252B35" dominant-baseline="central">${esc(title)}</text>
    <text data-layout-role="cluster-subtitle" data-fill-role="muted" x="${r1(x)}" y="${r1(subY)}" font-size="${hs.subtitle}" fill="#636A75" dominant-baseline="central">${esc(subtitle)}</text>
  </g>`;
}
const ICON_PATH = {   // the bundled line-icon set (simple geometry — palette roles only)
  activity: "M2 12 L7 12 L10 5 L14 19 L17 12 L22 12", rocket: "M12 3 C15 7 15 13 12 21 C9 13 9 7 12 3",
  coins: "M4 8 A8 4 0 1 0 20 8 A8 4 0 1 0 4 8 M4 8 L4 15 A8 4 0 0 0 20 15 L20 8",
  shield: "M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z",
  database: "M4 6 A8 3 0 1 0 20 6 A8 3 0 1 0 4 6 M4 6 V18 A8 3 0 0 0 20 18 V6",
  cloud: "M6 17 A4 4 0 1 1 8 9 A5 5 0 0 1 18 10 A4 4 0 1 1 18 17 Z",
  lock: "M6 11 H18 V20 H6 Z M9 11 V8 A3 3 0 0 1 15 8 V11", gauge: "M4 17 A8 8 0 1 1 20 17 M12 17 L16 10",
  layers: "M12 3 L21 8 L12 13 L3 8 Z M3 13 L12 18 L21 13", route: "M5 19 H12 A4 4 0 0 0 12 11 H8 A4 4 0 0 1 8 3 H19",
  flag: "M6 3 V21 M6 4 H18 L15 8 L18 12 H6", check: "M4 12 L10 18 L20 6", clock: "M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4 M12 8 V12 L15 14",
  users: "M8 11 A3 3 0 1 0 8 5 A3 3 0 1 0 8 11 M2 20 A6 6 0 0 1 14 20 M16 6 A3 3 0 0 1 16 11 M15 20 A6 6 0 0 0 22 20",
  server: "M4 5 H20 V10 H4 Z M4 14 H20 V19 H4 Z M8 7.5 H8.01 M8 16.5 H8.01",
  queue: "M4 7 H20 M4 12 H20 M4 17 H14",
};
// Line breaking is computed with the same estimator lint uses — if the generator and the guard
// measured with different rulers, "it generated but the check rejects it" would keep recurring.
// Exceeding the permitted line count is an error.
function wrapLines(text, maxW, fontSize, bold, maxLines) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (estimateWidth(cand, fontSize, bold, 0) <= maxW || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return { lines, overflow: lines.length > maxLines || lines.some((l) => estimateWidth(l, fontSize, bold, 0) > maxW) };
}
const tspans = (lines, x, yStart, lh = 19) => lines.map((l, i) =>
  `<tspan x="${r1(x)}" y="${r1(yStart + i * lh)}">${esc(l)}</tspan>`).join("");

const icon = (id, cx, cy, s = 18) => {
  const d = ICON_PATH[id] ?? ICON_PATH.check;
  return `<g transform="translate(${r1(cx - s / 2)},${r1(cy - s / 2)}) scale(${r1(s / 24)})"><path d="${d}" fill="none" data-stroke-role="focus" stroke="#2E6DA4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

// ---------- TypePack renderers (they consume the payload only) ----------
function renderCards(input, loc, cb, sc, tp) {
  const cards = input.cards, n = cards.length;
  const cols = sc.layout === "grid" ? Number(sc.cols) : n, rows = Math.ceil(n / cols);
  const gx = 16, gy = 16;
  // The grid does not sit flush against the contentBox boundary — a last-row border touching it reads as a cropped panel
  const gw = cb.w, gh = cb.h;
  const w = (gw - (cols - 1) * gx) / cols;
  const padY = 22, itemMinH = Number(tp.fit?.params?.itemMinH ?? 0) || 0;
  const layFor = (lc) => cards.map((c, i) => {
    const hasIcon = c.icon !== undefined;
    const textX = (i % cols) * 0 + (hasIcon ? 62 : 20);   // card-local coordinates
    const maxW = w - 16 - textX;
    const t = wrapLines(c.title[lc], maxW, 15, true, 2);
    const b = c.body ? wrapLines(c.body[lc], maxW, 12.5, false, 2) : { lines: [], overflow: false };
    if (t.overflow || b.overflow) { console.error(`generate: card "${c.id}" copy exceeds the §2 line budget at this layout (${lc})`); process.exit(1); }
    return { c, hasIcon, textX, t, b, block: t.lines.length * 19 + b.lines.length * 16 };
  });
  const laid = layFor(loc);
  // The geometry must be stable across locales — so KO and EN read at the same size, the card
  // height derives from whichever locale is longer.
  const laidAll = ["ko", "en"].map(layFor);
  // The card height derives from the longest card's content plus breathing room, with the declared floor as its lower bound.
  const contentH = Math.max(...laidAll.flat().map((l) => Math.max(l.block, l.hasIcon ? 34 : 0)));
  const h = Math.max(itemMinH, contentH + 2 * padY);
  const body = [], consumed = [];
  // Declare the row groups so the layout guard cannot pass without proof — zero groups is not green
  for (let ri = 0; ri < rows; ri++) {
    const cnt = Math.min(cols, n - ri * cols);
    body.push(`  <g data-layout-group="cards-row-${ri}" data-distribution="equal-gap" data-axis="x" data-group-count="${cnt}"></g>`);
  }
  laid.forEach((L, i) => {
    const c = L.c, t = L.t, b = L.b;
    const cx = cb.x + (i % cols) * (w + gx), cy = cb.y + Math.floor(i / cols) * (h + gy);
    consumed.push(c.id);
    const hasIcon = L.hasIcon;
    const textX = cx + L.textX;
    const center = cy + h / 2;
    const ty = center - L.block / 2 + 9;
    body.push(`  <g data-comp-entity="${c.id}" data-entity="${c.id}">
    <rect x="${r1(cx)}" y="${r1(cy)}" width="${r1(w)}" height="${r1(h)}" rx="12" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-item="cards-row-${Math.floor(i / cols)}"/>
    ${hasIcon ? `<circle cx="${r1(cx + 36)}" cy="${r1(center)}" r="17" fill="#E4EDF3" data-fill-role="surface-tint"/>${icon(c.icon, cx + 36, center)}` : ""}
    <text font-size="15" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${tspans(t.lines, textX, ty)}</text>
    ${b.lines.length ? `<text font-size="12.5" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${tspans(b.lines, textX, ty + t.lines.length * 19 + 2, 16)}</text>` : ""}
  </g>`);
  });
  const blockH = rows * h + (rows - 1) * gy;
  return { body: body.join("\n"), consumed,
    bounds: { x: cb.x, y: cb.y, w: gw, h: blockH } };
}

function renderTopology(input, loc, cb, sc, tp, degradeLevel = 0, F = { fs: (n) => n }) {
  const zones = input.zones, nz = zones.length;
  // The zone label band comes from the **actual label size**, not from a constant. When optical
  // calibration enlarges the text the band must grow with it, or the routing corridor cuts across
  // the label. (The text is not shrunk back to fit the old band — that would undo the point of the
  // calibration.)
  const pad = 12;
  // A zone is a **label band plus a node area**. The band height is no constant: it comes from the
  // resolved label line-box and the shared padding (at scale 1.0 it yields the old value of 22).
  // The band must also leave an **entry corridor** for connectors to come through — the corridor
  // width is computed from the lane count and the clearance, with no per-file coordinates. When a
  // label does not fit that width it **wraps** rather than shrinking.
  const K = ROUTE_DEFAULTS;
  // entry corridor: the width in which a connector crosses the band **outside** the label bounds.
  // Computed from the lane spacing and the clearance, with no per-file coordinates.
  const corridorReserve = 2 * K.labelPad + K.laneGap + K.outerClearance;
  const labelLineH = (n) => Math.round(F.fs(12) * 1.5 * n + 4);

  // A declared boundary is a **container, not an overlay**. It reserves its padding and label band
  // first and the zone layout then runs inside what is left; reserving afterwards would put the
  // frame on top of the zone borders or push it past the content box, because the first zone starts
  // at the content-box top and the zones already span its full width minus the side channels.
  // The label is measured on whichever of KO and EN is wider, for the same reason the zone labels
  // are: the geometry must not vary by language.
  const bpad = 12;
  let bband = 0, bWrap = null;
  if (input.boundary) {
    const bMaxW = cb.w - 2 * bpad - 2 * K.labelPad;
    bWrap = ["ko", "en"].map((lc) => wrapLines(String(input.boundary.label?.[lc] ?? ""), bMaxW, F.fs(12), true, 1));
    if (bWrap.some((x) => x.overflow)) {
      console.error(`generate: boundary label does not fit the ${r1(bMaxW)}px band on one line — shorten it or widen the preset`);
      process.exit(1);
    }
    bband = Math.round(F.fs(12) * 1.5 + 4);
  }
  // The box the zone layout actually gets. With no boundary it **is** the content box, so a diagram
  // that declares none keeps its existing geometry to the pixel.
  const ib = input.boundary
    ? { x: cb.x + bpad, y: cb.y + bband + bpad, w: cb.w - 2 * bpad, h: cb.h - bband - 2 * bpad }
    : cb;

  // 1) Ask for the routing demand first — if the layout sets first, the lines end up cutting through or overlapping.
  const nodeZone = new Map(), nodeIndex = new Map();
  zones.forEach((z) => (z.nodes ?? []).forEach((nd, i) => { nodeZone.set(nd.id, z.id); nodeIndex.set(nd.id, i); }));
  const edgesIn = (input.edges ?? []).map((e) => ({
    id: e.id, from: e.from, to: e.to,
    dashed: e.delivery === "async" || e.visibility === "private",
    weight: e.kind === "request" ? "primary" : "secondary",
  }));
  // The layout first orders the slots within each row so primary edges can run straight.
  const aligned = alignRows({ zoneOrder: zones.map((z) => z.id), nodeZone,
    nodeOrder: new Map(zones.map((z) => [z.id, (z.nodes ?? []).map((n) => n.id)])), edges: edgesIn });
  const nodeById = new Map();
  for (const z of zones) for (const nd of z.nodes ?? []) nodeById.set(nd.id, nd);
  const rowOf = (z) => (aligned.order.get(z.id) ?? (z.nodes ?? []).map((n) => n.id)).map((id) => nodeById.get(id));
  for (const z of zones) (z.nodes ?? []).forEach((nd, i) => nodeIndex.set(nd.id, rowOf(z).findIndex((x) => x.id === nd.id)));
  const plan = planChannels({ zoneOrder: zones.map((z) => z.id), nodeZone, nodeIndex, edges: edgesIn });

  // 2) The layout widens to meet that demand: side channels come out of the width, corridor lanes out of the height.
  const chL = plan.channelWidth("left"), chR = plan.channelWidth("right");
  const zoneX = ib.x + chL, zoneW = ib.w - chL - chR;
  const corridors = [];
  for (let i = 0; i + 1 < nz; i++) corridors.push(plan.corridorHeight(i));
  const corridorTotal = corridors.reduce((a, b) => a + b, 0);
  const intraH = (zid) => (plan.intraLanes.get(zid) ?? 0) * K.laneGap;
  const maxIntra = Math.max(0, ...zones.map((z) => intraH(z.id)));
  // A label **wraps** within the width left after the corridor — it is never shrunk to be forced
  // onto one line. The corridor must sit within the **node's port range**, not merely within the
  // zone width, because a line descending from the zone above attaches to the top of the target
  // node. So the label width ceiling derives from the node width.
  const nwProbe = (zoneW - 2 * pad - (Math.max(...zones.map((z) => (z.nodes ?? []).length)) - 1) * K.laneGap) / Math.max(...zones.map((z) => (z.nodes ?? []).length));
  const labelMaxW = Math.min(zoneW - 2 * pad - corridorReserve,
    nwProbe - K.portInset - K.outerClearance - 2 * K.labelPad);
  if (process.env.SVGINFO_DEBUG_TOPOLOGY) console.error(`[topo] zoneW=${r1(zoneW)} nwProbe=${r1(nwProbe)} labelMaxW=${r1(labelMaxW)} fs=${F.fs(12)}`);
  const labelWrap = new Map();
  for (const z of zones) {
    const w = ["ko", "en"].map((lc) => wrapLines(String(z.label[lc] ?? ""), labelMaxW, F.fs(12), true, 2));
    if (w.some((x) => x.overflow)) { console.error(`generate: zone label "${z.id}" does not fit the ${r1(labelMaxW)}px label band even wrapped — widen the preset or shorten the label`); process.exit(1); }
    labelWrap.set(z.id, w);
  }
  const labelLines = Math.max(1, ...[...labelWrap.values()].flat().map((x) => x.lines.length));
  const band = labelLines === 1 ? Math.round(F.fs(12) * 1.5 + 4) : labelLineH(labelLines);
  const nodeH = Math.min(96, (ib.h - corridorTotal - nz * (band + 2 * pad + maxIntra)) / nz);
  const zoneH = (zid) => band + 2 * pad + nodeH + intraH(zid);

  // One spacing serves every row — differing per row would misalign the columns of the same slot and break the straight runs.
  const nodeGap = Math.max(...zones.map((z) => plan.nodeGap(z.id)));
  const containers = [], connectors = [], nodeArt = [], consumed = [], nodeBox = {}, zoneBoxes = [];
  let zy = ib.y;
  zones.forEach((z, zi) => {
    const zh = zoneH(z.id);
    consumed.push(z.id);
    const ns = rowOf(z);
    const nw = (zoneW - 2 * pad - (ns.length - 1) * nodeGap) / ns.length;
    ns.forEach((nd, ni) => {
      nodeBox[nd.id] = { x: zoneX + pad + ni * (nw + nodeGap), y: zy + band + pad, w: nw, h: nodeH };
      consumed.push(nd.id);
    });
    // A label's width as an obstacle is measured with the same estimator lint uses, not guessed
    // from a character count, and is fixed at **whichever of KO and EN is wider** — the routing
    // geometry must not vary by language.
    const labelTextW = Math.max(...labelWrap.get(z.id).flatMap((w) => w.lines.map((l) => estimateWidth(l, F.fs(12), true, 0))));
    const labelW = Math.min(labelMaxW, labelTextW * 1.08 + 2 * ROUTE_DEFAULTS.labelPad);
    zoneBoxes.push({ id: z.id, x: zoneX, y: zy, w: zoneW, h: zh,
      labelBox: { x: zoneX + pad, y: zy + 4, w: labelW, h: band - 4 } });
    zy += zh + (corridors[zi] ?? 0);
  });
  const contentBottom = zy;   // no corridor is added after the last zone

  // 3) Routing — the router fixes the coordinates. If problems remain, walk the spec §6 ladder.
  const ladder = [];
  // The layout computes the **legal port interval** from label bounds, node bounds and clearance
  // and hands it to the router, which generates candidates only inside it. With no interval (that
  // is, nothing entering from outside the zone) the router is unconstrained.
  const zoneOf = new Map();
  for (const zb of zoneBoxes) for (const nd of (zones.find((z) => z.id === zb.id)?.nodes ?? [])) zoneOf.set(nd.id, zb);
  const entryInterval = (nid) => {
    const zb = zoneOf.get(nid), nb = nodeBox[nid];
    if (!zb || !zb.labelBox || !nb) return null;
    const lb = zb.labelBox;
    // The label is a hard obstacle — the interval starts at the label's right edge plus the
    // clearance. What the layout guarantees goes as far as "the port is not underneath the label";
    // the spacing between line and label is enforced by the router's own obstacle rules. Being
    // stricter here would move the routing of existing (unconstrained) artifacts for no reason.
    const lo = Math.max(nb.x + K.portInset, lb.x + lb.w);
    const hi = nb.x + nb.w - K.portInset;
    if (!(lo <= hi)) return null;                    // with no legal interval, declare nothing (which differs from declaring no constraint)
    return { lo: r1(lo), hi: r1(hi), axis: "x" };
  };
  const constrain = (list) => list.map((e) => {
    const from = zoneOf.get(e.from), to = zoneOf.get(e.to);
    if (!from || !to || from.id === to.id) return e;   // routing within one zone does not cross the band
    const iv = entryInterval(e.to);
    if (!iv) return e;
    // The constraint applies **only when needed**. If the natural port (the midpoint of the two
    // nodes) already lies clear of the label, no interval is declared — that keeps the candidates,
    // their order and the artifact of an existing call unchanged.
    const src = nodeBox[e.from], dst = nodeBox[e.to];
    const natural = src && dst ? (src.x + src.w / 2 + dst.x + dst.w / 2) / 2 : null;
    if (natural != null && natural >= iv.lo && natural <= iv.hi) return e;
    return { ...e, allowedPortInterval: { to: iv } };
  });
  plan.classified = constrain(plan.classified);
  const portConstraints = plan.classified.filter((e) => e.allowedPortInterval)
    .map((e) => ({ edge: e.id, endpoint: "to", node: e.to, allowed: e.allowedPortInterval.to }));
  let routed = routeEdges({ nodes: nodeBox, zones: zoneBoxes, plan, frame: cb, degradeLevel });
  if (routed.problems.length) {
    ladder.push({ step: 1, action: "drop edge labels to the legend", applied: false, reason: "this TypePack draws no edge labels — there is no slack to reclaim" });
    ladder.push({ step: 2, action: "merge co-located nodes into one frame", applied: false, reason: "that would change the semantic structure of the input, which the generator does not do on its own" });
    const demotedTry = routeEdges({ nodes: nodeBox, zones: zoneBoxes, plan, frame: cb, degradeLevel: 3 });
    const kept = demotedTry.routes.length, total = plan.classified.length;
    const acceptable = !demotedTry.problems.length && kept * 2 >= total;   // losing more than half the meaning is not a success
    ladder.push({ step: 3, action: "reduce to the primary request path", applied: acceptable,
      reason: acceptable ? `demote ${total - kept} secondary edge(s) to the legend and draw only the ${kept} primary one(s)`
        : `demoting the secondaries would leave only ${kept} of ${total}, and the meaning would be gone` });
    if (acceptable) routed = demotedTry;
    else {
      ladder.push({ step: 4, action: "return needs-split", applied: true, reason: "it cannot be held on one page without crossings or cut-throughs" });
      return { needsSplit: true, consumed: [],
        routing: { degradeLevel: 3, problems: routed.problems, hops: routed.hopCount, ladder,
          diagnostics: routed.diagnostics, attempts: routed.attempts,
          unrouted: routed.diagnostics.map((d) => d.subject), edgeCount: plan.classified.length,
          demoted: demotedTry.demoted.map((e) => e.id) } };
    }
  }

  // Draw in the order zone frame (background) -> connector -> node (the z-order: connectors go
  // before the cards so a line is not hidden behind one, though the rule remains that the routing
  // itself avoids the cards).
  // Paint order: boundary frame -> zone frame -> connector -> node -> label.
  // The label goes on last, sitting **above** the lines with an opaque mask (the lines pass behind it).
  const labels = [];
  // The boundary goes in first so every zone sits on top of it, and it is declared as the layout
  // parent of the zones rather than merely drawn around them — the containment is then checked
  // rather than assumed. (Nesting a container inside a container is the same shape nested-scope
  // already uses for its rings.)
  const bFrame = input.boundary
    ? { x: cb.x, y: cb.y, w: cb.w, h: contentBottom + bpad - cb.y }
    : null;
  if (bFrame) {
    containers.push(`  <g data-comp-entity="boundary" data-entity="boundary" data-layout-role="boundary">
    <rect x="${r1(bFrame.x)}" y="${r1(bFrame.y)}" width="${r1(bFrame.w)}" height="${r1(bFrame.h)}" rx="18" fill="none" stroke="#B9C2CC" stroke-width="1.5" stroke-dasharray="7 5" data-stroke-role="rule" data-layout-container="boundary" data-min-pad="${bpad}" data-reserve-top="${bband}" data-layout-count="${nz}"/>
  </g>`);
  }
  zoneBoxes.forEach((zb, zi) => {
    const z = zones[zi], ns = rowOf(z);
    containers.push(`  <g data-comp-entity="${z.id}" data-entity="${z.id}" data-layout-role="zone">
    <rect x="${r1(zb.x)}" y="${r1(zb.y)}" width="${r1(zb.w)}" height="${r1(zb.h)}" rx="14" fill="#F4F8FC" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule" data-layout-container="${z.id}"${bFrame ? ' data-layout-parent="boundary"' : ""} data-min-pad="${pad}" data-reserve-top="${band}" data-layout-count="${ns.length}"/>
    <g data-layout-group="${z.id}-row" data-distribution="equal-gap" data-axis="x" data-group-count="${ns.length}"></g>
  </g>`);
    labels.push(`  <g data-layout-role="zone-label" data-label-bounds="${r1(zb.labelBox.x)},${r1(zb.labelBox.y)},${r1(zb.labelBox.w)},${r1(zb.labelBox.h)}">
    <rect x="${r1(zb.labelBox.x)}" y="${r1(zb.labelBox.y)}" width="${r1(zb.labelBox.w)}" height="${r1(zb.labelBox.h)}" rx="4" fill="#F4F8FC" data-fill-role="surface-tint"/>
    ${(() => { const L = labelWrap.get(z.id)[loc === "ko" ? 0 : 1].lines, lh = F.fs(12) * 1.5,
        y0 = zb.y + (band - (L.length - 1) * lh) / 2 + 4;
      // On a single line, keep the existing single-text form — changing the markup where there is
      // no wrapping would break the flat baseline for no reason.
      return L.length === 1
        ? `<text x="${r1(zb.x + pad)}" y="${r1(y0)}" font-size="${F.fs(12)}" font-weight="700" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(L[0])}</text>`
        : `<text font-size="${F.fs(12)}" font-weight="700" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${tspans(L, zb.x + pad, y0, lh)}</text>`; })()}
  </g>`);
  });
  if (bFrame) {
    const bText = bWrap[loc === "ko" ? 0 : 1].lines[0] ?? "";
    labels.push(`  <g data-layout-role="boundary-label">
    <text x="${r1(bFrame.x + bpad + K.labelPad)}" y="${r1(bFrame.y + bband / 2 + 2)}" font-size="${F.fs(12)}" font-weight="700" fill="#8A939E" data-fill-role="muted" dominant-baseline="central">${esc(bText)}</text>
  </g>`);
  }

  const EDGE = "#7C93AB";
  for (const rt of routed.routes) {
    consumed.push(rt.id);
    const shaft = rt.weight === "primary" ? 2.5 : 2.2;
    const mk = rt.weight === "primary" ? "ah-primary" : "ah-secondary";
    connectors.push(`  <g data-comp-entity="${rt.id}" data-entity="${rt.id}"><path data-route-id="${rt.id}" data-route-from="${rt.from}" data-route-to="${rt.to}" data-route-kind="${rt.kindPath}" data-route-weight="${rt.weight}" d="${pathData(rt)}" fill="none" data-stroke-role="edge-line" stroke="${EDGE}" stroke-width="${shaft}" stroke-linecap="round" stroke-linejoin="round"${rt.style === "dashed" ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${mk})"/></g>`);
  }
  for (const z of zones) for (const nd of rowOf(z)) {
    const b = nodeBox[nd.id];
    nodeArt.push(`  <g data-comp-entity="${nd.id}" data-entity="${nd.id}">
    <rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="10" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-parent="${nodeZone.get(nd.id)}" data-layout-item="${nodeZone.get(nd.id)}-row"/>
    ${icon(nd.icon, b.x + b.w / 2, b.y + b.h / 2 - 14, 20)}
    <text x="${r1(b.x + b.w / 2)}" y="${r1(b.y + b.h / 2 + 16)}" font-size="${F.fs(12)}" fill="#252B35" data-fill-role="ink" text-anchor="middle" dominant-baseline="central">${esc(nd.name[loc])}</text>
  </g>`);
  }

  // legend — required when solid and dashed appear together (it explains the axis, not the style)
  let legendH = 0;
  if (routed.legendRequired) {
    const ly = contentBottom + 22, lx = zoneX + pad;
    const keys = loc === "ko"
      ? [["solid", "요청 흐름 (동기·공개)"], ["dashed", "비동기 또는 내부 전용"]]   /* lang-allow: ko-copy: legend-keys */
      : [["solid", "request flow (sync, public)"], ["dashed", "async or private"]];
    const items = keys.map(([style, label], i) => {
      const x = lx + i * 260;
      return `    <g data-layout-role="legend-key">
      <path d="M${r1(x)} ${r1(ly)} L${r1(x + 34)} ${r1(ly)}" fill="none" stroke="${EDGE}" stroke-width="2.2"${style === "dashed" ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#ah-secondary)"/>
      <text x="${r1(x + 56)}" y="${r1(ly)}" font-size="${F.fs(12)}" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(label)}</text>
    </g>`;
    }).join("\n");
    labels.push(`  <g data-layout-role="legend" data-entity="legend">\n${items}\n  </g>`);
    legendH = 34;
  }
  if (input.boundary) consumed.push("boundary");
  const defs = `  <defs>
    ${["ah-primary", "ah-secondary"].map((id, i) => {
      const shaft = i === 0 ? 2.5 : 2.2, mw = r1(4.5 * shaft);
      return `<marker id="${id}" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="${mw}" markerHeight="${mw}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M2 2 L10 6 L2 10" fill="none" data-stroke-role="edge-line" stroke="${EDGE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
    }).join("\n    ")}
  </defs>`;
  const body = [
    `  <g data-layer="containers">`, ...containers, `  </g>`,
    `  <g data-layer="connectors">`, ...connectors, `  </g>`,
    `  <g data-layer="nodes">`, ...nodeArt, `  </g>`,
    `  <g data-layer="annotations">`, ...labels, `  </g>`,
  ];
  return {
    body: defs + "\n" + body.join("\n"), consumed,
    // The frame is content: the bounds (and through them contentFlowBounds and the residual)
    // must include it, or the page would report breathing room the diagram is already using.
    bounds: { x: cb.x, y: cb.y, w: cb.w, h: (bFrame ? bFrame.y + bFrame.h : contentBottom) - cb.y + legendH },
    routing: {
      degradeLevel: routed.degradeLevel, ladder, portConstraints, problems: routed.problems, hops: routed.hopCount,
      alignment: aligned.moves, attempts: routed.attempts, diagnostics: routed.diagnostics,
      legend: routed.legendRequired,
      demoted: routed.demoted.map((e) => e.id),
      routes: routed.routes.map((rt) => ({ id: rt.id, from: rt.from, to: rt.to, path: rt.kindPath,
        ports: [rt.sideFrom, rt.sideTo], bends: rt.bends, style: rt.style, targetGap: rt.targetGap,
        hops: rt.hops.length })),
    },
  };
}



// ---------- process-flow (one main-path axis, with feedback as the return) ----------
function renderProcessFlow(input, loc, cb, sc, tp) {
  const steps = input.steps, n = steps.length;
  const column = sc.layout === "column";
  const P = tp.fit?.params ?? {};
  const gap = column ? Number(P.gapY ?? 36) : Number(P.gapX ?? 44);
  const badge = 26;

  // Card size: derived from the content with the declared floor as its lower bound (the max across
  // both locales — the geometry must be stable across languages).
  const w = column ? Math.min(cb.w, Math.max(Number(P.itemMinW ?? 132), cb.w * 0.62))
    : (cb.w - (n - 1) * gap) / n;
  const textW = w - badge - 36;
  const linesFor = (lc) => steps.map((st) => wrapLines(st.name[lc], textW, 15, true, 2));
  const maxLines = Math.max(...["ko", "en"].flatMap((lc) => linesFor(lc).map((r) => r.lines.length)));
  if (["ko", "en"].some((lc) => linesFor(lc).some((r) => r.overflow))) {
    console.error(`generate: a step name exceeds the §2 line budget at this layout`); process.exit(1);
  }
  const h = Math.max(Number(P.itemMinH ?? 88), maxLines * 20 + 40);
  const x0 = column ? cb.x + (cb.w - w) / 2 : cb.x;
  const nodes = {}, consumed = [];
  steps.forEach((st, i) => {
    nodes[st.id] = column ? { x: x0, y: cb.y + i * (h + gap), w, h }
      : { x: cb.x + i * (w + gap), y: cb.y, w, h };
    consumed.push(st.id);
  });
  // The main path joins adjacent steps. Any feedback becomes a return (secondary, dashed) from the last step to the first.
  const edges = [];
  for (let i = 0; i + 1 < n; i++) edges.push({ id: `flow-${i + 1}`, from: steps[i].id, to: steps[i + 1].id, weight: "primary" });
  if (input.feedback) edges.push({ id: "feedback", from: steps[n - 1].id, to: steps[0].id, weight: "secondary", dashed: true });

  const plan = planChannels({ zoneOrder: [], nodeZone: new Map(), nodeIndex: new Map(), edges });
  const blockH = column ? n * h + (n - 1) * gap : h;
  const frame = { x: cb.x, y: cb.y, w: cb.w, h: Math.max(blockH + 2 * ROUTE_DEFAULTS.outerClearance, cb.h) };
  const routed = routeEdges({ nodes, zones: [], plan, frame });

  const laid = linesFor(loc);
  const nodeArt = steps.map((st, i) => {
    const b = nodes[st.id], t = laid[i];
    const ty = b.y + b.h / 2 - (t.lines.length - 1) * 10;
    return `  <g data-comp-entity="${st.id}" data-entity="${st.id}">
    <rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="12" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-item="flow-column"/>
    <circle cx="${r1(b.x + 24)}" cy="${r1(b.y + b.h / 2)}" r="13" fill="#E4EDF3" data-fill-role="surface-tint"/>
    <text x="${r1(b.x + 24)}" y="${r1(b.y + b.h / 2)}" font-size="12" font-weight="700" fill="#2E6DA4" data-fill-role="focus" text-anchor="middle" dominant-baseline="central">${i + 1}</text>
    <text font-size="15" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${tspans(t.lines, b.x + badge + 24, ty, 20)}</text>
  </g>`;
  });
  return assemble({ routed, consumed, nodes, zoneArt: [`  <g data-layout-group="flow-column" data-distribution="equal-gap" data-axis="${column ? "y" : "x"}" data-group-count="${n}"></g>`],
    nodeArt, labels: [], loc, bounds: { x: cb.x, y: cb.y, w: cb.w, h: blockH } });
}

// ---------- approval-gate (one row plus the gate pill and its criteria caption) ----------
function renderApprovalGate(input, loc, cb, sc, tp) {
  const list = input.nodes, n = list.length, g = input.gate;
  const P = tp.fit?.params ?? {};
  const gap = Number(P.gapX ?? 56);
  const w = (cb.w - (n - 1) * gap) / n;
  const textW = w - 24;
  const linesFor = (lc) => list.map((nd) => wrapLines(nd.name[lc], textW, 14, true, 2));
  if (["ko", "en"].some((lc) => linesFor(lc).some((r) => r.overflow))) {
    console.error("generate: a node name exceeds the §2 line budget at this layout"); process.exit(1);
  }
  const maxLines = Math.max(...["ko", "en"].flatMap((lc) => linesFor(lc).map((r) => r.lines.length)));
  const h = Math.max(Number(P.itemMinH ?? 88), maxLines * 19 + 44);
  // The gate pill sits **above** the arrow it guards, reaching down to it with a dotted line (spec §5).
  const pillH = 26, pillGap = 18;
  const rowY = cb.y + pillH + pillGap;
  const nodes = {}, consumed = [];
  list.forEach((nd, i) => { nodes[nd.id] = { x: cb.x + i * (w + gap), y: rowY, w, h }; consumed.push(nd.id); });
  const edges = list.slice(0, -1).map((nd, i) => ({ id: `step-${i + 1}`, from: nd.id, to: list[i + 1].id, weight: "primary" }));
  const plan = planChannels({ zoneOrder: [], nodeZone: new Map(), nodeIndex: new Map(), edges });
  const routed = routeEdges({ nodes, zones: [], plan, frame: { x: cb.x, y: cb.y, w: cb.w, h: cb.h } });

  const laid = linesFor(loc);
  const nodeArt = list.map((nd, i) => {
    const b = nodes[nd.id], t = laid[i];
    const ty = b.y + b.h / 2 - (t.lines.length - 1) * 9.5;
    return `  <g data-comp-entity="${nd.id}" data-entity="${nd.id}">
    <rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="12" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-item="gate-row"/>
    <text font-size="14" font-weight="700" fill="#252B35" data-fill-role="ink" text-anchor="middle" dominant-baseline="central">${tspans(t.lines, b.x + b.w / 2, ty, 19)}</text>
  </g>`;
  });

  // Find the guarded arrow, stand the pill above its midpoint, and drop the dotted line.
  const guarded = routed.routes.find((r) => r.from === g.from && r.to === g.to);
  const labels = [];
  if (guarded) {
    const pts = guarded.points;
    const mid = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
    const label = String(g.label[loc]);
    const pw = 28 + estimateWidth(label, 12, true, 0) + 16;   // room for the icon (28) + the text + the right margin
    const px = mid.x - pw / 2, py = rowY - pillGap - pillH;
    labels.push(`  <g data-comp-entity="${g.id}" data-entity="${g.id}" data-layout-role="gate">
    <path d="M${r1(mid.x)} ${r1(py + pillH)} V${r1(mid.y)}" fill="none" stroke="#B07A31" stroke-width="1.4" stroke-dasharray="3 3" data-stroke-role="warning"/>
    <rect x="${r1(px)}" y="${r1(py)}" width="${r1(pw)}" height="${pillH}" rx="${pillH / 2}" fill="#FBF3E6" stroke="#D8B075" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="warning"/>
    ${icon("check", px + 16, py + pillH / 2, 13)}
    <text x="${r1(px + 28)}" y="${r1(py + pillH / 2)}" font-size="12" font-weight="700" fill="#8A5D22" data-fill-role="warning" dominant-baseline="central">${esc(label)}</text>
  </g>`);
    consumed.push(g.id);
  }
  // The criteria are a caption below the band, not text inside the pill (spec §5).
  const capY = rowY + h + 26;
  labels.push(`  <g data-layout-role="gate-caption">
    <text x="${r1(cb.x)}" y="${r1(capY)}" font-size="12.5" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(g.criterion[loc])}</text>
  </g>`);
  return assemble({ routed, consumed, nodes,
    zoneArt: [`  <g data-layout-group="gate-row" data-distribution="equal-gap" data-axis="x" data-group-count="${n}"></g>`],
    nodeArt, labels, loc, bounds: { x: cb.x, y: cb.y, w: cb.w, h: capY + 10 - cb.y } });
}

// The assembly the two renderers share — layer order and the routing receipt are produced in one place only.
function assemble({ routed, consumed, zoneArt, nodeArt, labels, bounds }) {
  const EDGE = "#7C93AB";
  const connectors = routed.routes.map((rt) => {
    const shaft = rt.weight === "primary" ? 2.5 : 2.2;
    return `  <g data-comp-entity="${rt.id}"><path data-route-id="${rt.id}" data-route-from="${rt.from}" data-route-to="${rt.to}" data-route-kind="${rt.kindPath}" data-route-weight="${rt.weight}" data-route-role="${rt.role ?? "flow"}" d="${pathData(rt)}" fill="none" data-stroke-role="edge-line" stroke="${EDGE}" stroke-width="${shaft}" stroke-linecap="round" stroke-linejoin="round"${rt.style === "dashed" ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${rt.weight === "primary" ? "ah-primary" : "ah-secondary"})"/></g>`;
  });
  const defs = `  <defs>
    ${["ah-primary", "ah-secondary"].map((id, i) => {
      const shaft = i === 0 ? 2.5 : 2.2, mw = r1(4.5 * shaft);
      return `<marker id="${id}" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="${mw}" markerHeight="${mw}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M2 2 L10 6 L2 10" fill="none" data-stroke-role="edge-line" stroke="${EDGE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
    }).join("\n    ")}
  </defs>`;
  const body = [defs,
    `  <g data-layer="containers">`, ...zoneArt, `  </g>`,
    `  <g data-layer="connectors">`, ...connectors, `  </g>`,
    `  <g data-layer="nodes">`, ...nodeArt, `  </g>`,
    `  <g data-layer="annotations">`, ...labels, `  </g>`];
  if (routed.problems.length) {
    return { needsSplit: true, consumed: [], routing: { degradeLevel: 0, ladder: [], problems: routed.problems,
      diagnostics: routed.diagnostics, attempts: routed.attempts, hops: routed.hopCount,
      unrouted: routed.diagnostics.map((d) => d.subject), edgeCount: routed.routes.length + routed.diagnostics.length } };
  }
  return { body: body.join("\n"), consumed, bounds,
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: routed.hopCount, legend: routed.legendRequired,
      alignment: [], attempts: routed.attempts, diagnostics: routed.diagnostics, demoted: [],
      routes: routed.routes.map((rt) => ({ id: rt.id, from: rt.from, to: rt.to, path: rt.kindPath,
        ports: [rt.sideFrom, rt.sideTo], bends: rt.bends, style: rt.style, targetGap: rt.targetGap, hops: rt.hops.length })) } };
}


// ---------- layer-stack (no connectors — adjacency is the relation) ----------
function renderLayerStack(input, loc, cb, sc, tp) {
  const layers = input.layers, n = layers.length;
  const P = tp.fit?.params ?? {};
  const gapY = Number(P.gapY ?? 20), pad = 18, chipGap = 12;
  const bandW = cb.w;
  const labelW = Math.max(...["ko", "en"].flatMap((lc) => layers.map((L) => estimateWidth(L.label[lc], 15, true, 0))));
  // The chip width does not derive from the band alone — the **actual chip copy** (max across both locales) has to fit.
  const chipPad = 12;
  const maxChips = Math.max(0, ...layers.map((L) => (L.items ?? []).length));
  const chipTextW = Math.max(0, ...["ko", "en"].flatMap((lc) =>
    layers.flatMap((L) => (L.items ?? []).map((c) => estimateWidth(c?.label?.[lc] ?? "", 12, false, 0)))));
  const chipNeed = maxChips ? chipTextW + 2 * chipPad : 0;
  const chipRunNeed = maxChips ? maxChips * chipNeed + (maxChips - 1) * chipGap : 0;
  // A chip is sized by its content width — never stretched to fill leftover space. Instead the run
  // is pushed right so the **right edge of the last chip** meets the band's inner edge by
  // computation (spec §5).
  const chipW = maxChips ? Math.max(chipNeed, 72) : 0;
  const runW = maxChips ? maxChips * chipW + (maxChips - 1) * chipGap : 0;
  const runStart = cb.x + bandW - pad - runW;
  // Everything left of the run is reserved for the label column plus its margin (a span content cannot use).
  const labelCol = maxChips ? runStart - pad - cb.x : Math.min(bandW * 0.42, labelW + 2 * pad);
  if (maxChips && labelCol < labelW + pad) {
    console.error(`generate: the layer label needs ${r1(labelW + pad)}px but the chip run leaves ${r1(labelCol)}px — shorten the label or the chips (spec §6), or choose a wider preset`);
    process.exit(1);
  }
  const h = Math.max(Number(P.itemMinH ?? 88), 64);
  const consumed = [], bandArt = [], chipArt = [];
  layers.forEach((L, i) => {
    const y = cb.y + i * (h + gapY);
    consumed.push(L.id);
    const chips = L.items ?? [];
    // The last chip's right edge meets the band's inner edge by computation (no manual coordinates, spec §5)
    const m = chips.length;

    const chipY = y + h / 2 - 13;
    bandArt.push(`  <g data-comp-entity="${L.id}" data-entity="${L.id}" data-layout-role="band">
    <rect x="${r1(cb.x)}" y="${r1(y)}" width="${r1(bandW)}" height="${r1(h)}" rx="12" fill="#F4F8FC" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule" data-layout-item="layer-stack" data-layout-container="${L.id}" data-min-pad="${pad}" data-layout-count="${m}"${m ? ` data-reserve-left="${r1(labelCol)}" data-symmetry="x"` : ""}/>
    <text x="${r1(cb.x + pad)}" y="${r1(y + h / 2)}" font-size="15" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${esc(L.label[loc])}</text>
  </g>`);
    if (m) {
      chipArt.push(`  <g data-layout-group="${L.id}-chips" data-distribution="equal-gap" data-axis="x" data-group-count="${m}"></g>`);
      chips.forEach((c, k) => {
        // A chip is the contract {id, label{ko,en}}. With no copy it fails rather than quietly
        // drawing "undefined" (the geometry gate does not look at text content, so it is stopped here).
        consumed.push(c.id);
        const chipText = c?.label?.[loc];
        if (!chipText) { console.error(`generate: chip "${c?.id ?? k + 1}" in layer "${L.id}" has no ${loc} label`); process.exit(1); }
        const cx = runStart + k * (chipW + chipGap);
        chipArt.push(`  <g data-comp-entity="${c.id}" data-entity="${c.id}">
    <rect x="${r1(cx)}" y="${r1(chipY)}" width="${r1(chipW)}" height="26" rx="8" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-parent="${L.id}" data-layout-item="${L.id}-chips"/>
    <text x="${r1(cx + chipW / 2)}" y="${r1(chipY + 13)}" font-size="12" fill="#636A75" data-fill-role="muted" text-anchor="middle" dominant-baseline="central">${esc(chipText)}</text>
  </g>`);
      });
    }
  });
  const blockH = n * h + (n - 1) * gapY;
  return { body: [`  <g data-layer="containers">`,
      `  <g data-layout-group="layer-stack" data-distribution="equal-gap" data-axis="y" data-group-count="${n}"></g>`,
      ...bandArt, ...chipArt, `  </g>`,
      `  <g data-layer="connectors"></g>`, `  <g data-layer="nodes"></g>`, `  <g data-layer="annotations"></g>`].join("\n"),
    consumed, bounds: { x: cb.x, y: cb.y, w: bandW, h: blockH },
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: 0, legend: false, alignment: [],
      attempts: [], diagnostics: [], demoted: [], routes: [] } };
}

// ---------- nested-scope (concentric — containment is the relation, with no arrows) ----------
function renderNestedScope(input, loc, cb, sc, tp) {
  const rings = input.rings, n = rings.length;
  const P = tp.fit?.params ?? {};
  const inset = Number(P.inset ?? 44);
  // A uniform inset on all four sides — the label is centred within the top inset band (spec §5, matching the fit contract).
  const w0 = Math.min(cb.w, Number(P.itemMinW ?? 296) + 2 * (n - 1) * inset);
  const h0 = Math.min(cb.h, Number(P.itemMinH ?? 96) + 2 * (n - 1) * inset);
  const x0 = cb.x + (cb.w - w0) / 2;
  const consumed = [], art = [], labels = [];
  const tint = ["#F4F8FC", "#E9F1F8", "#DCE9F4", "#CFE0F0"];
  let box = { x: x0, y: cb.y, w: w0, h: h0 };
  const labelWidest = Math.max(...["ko", "en"].flatMap((lc) => rings.map((rg) => estimateWidth(rg.label[lc], 13, true, 0))));
  rings.forEach((rg, i) => {
    consumed.push(rg.id);
    const last = i + 1 === n;
    const inner = last ? null : { x: box.x + inset, y: box.y + inset, w: box.w - 2 * inset, h: box.h - 2 * inset };
    art.push(`  <g data-comp-entity="${rg.id}" data-entity="${rg.id}" data-layout-role="ring">
    <rect x="${r1(box.x)}" y="${r1(box.y)}" width="${r1(box.w)}" height="${r1(box.h)}" rx="16" fill="${tint[Math.min(i, tint.length - 1)]}" stroke="#C7D3DE" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule"${inner ? ` data-layout-container="${rg.id}" data-min-pad="${inset}" data-layout-count="1" data-symmetry="xy"` : ""}${i > 0 ? ` data-layout-parent="${rings[i - 1].id}"` : ""}/>
  </g>`);
    // A ring label is measured within its own band (the top inset) — that band, not the whole ring, is the reference.
    const stripH = last ? Math.min(inset, box.h) : inset;
    labels.push(`  <g data-layout-role="ring-label" data-label-bounds="${r1(box.x)},${r1(box.y)},${r1(box.w)},${r1(stripH)}">
    <text x="${r1(box.x + box.w / 2)}" y="${r1(box.y + stripH / 2)}" font-size="13" font-weight="700" fill="#3C4657" data-fill-role="ink" text-anchor="middle" dominant-baseline="central">${esc(rg.label[loc])}</text>
  </g>`);
    if (last && rg.core_icon)
      labels.push(`  <g data-layout-role="core-icon">${icon(rg.core_icon, box.x + box.w / 2, box.y + stripH + (box.h - stripH) / 2, 26)}</g>`);
    if (inner) box = inner;
  });
  // A label exceeding its band width is a copy problem, not a geometry one — it is not passed over quietly.
  const innerW = w0 - 2 * (n - 1) * inset;
  if (labelWidest > innerW - 16) {
    console.error(`generate: a ring label needs ${r1(labelWidest)}px but the innermost strip is ${r1(innerW)}px — shorten the label (spec §6) or widen the scope`);
    process.exit(1);
  }
  return { body: [`  <g data-layer="containers">`, ...art, `  </g>`,
      `  <g data-layer="connectors"></g>`, `  <g data-layer="nodes"></g>`,
      `  <g data-layer="annotations">`, ...labels, `  </g>`].join("\n"),
    consumed, bounds: { x: x0, y: cb.y, w: w0, h: h0 },
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: 0, legend: false, alignment: [],
      attempts: [], diagnostics: [], demoted: [], routes: [] } };
}


// ---------- before-after (mirrored left and right — alignment carries the correspondence) ----------
function renderBeforeAfter(input, loc, cb, sc, tp) {
  const panels = input.panels, slots = input.slots, delta = input.delta ?? [];
  const P = tp.fit?.params ?? {};
  const gutter = Number(P.gapX ?? 32), pad = Number(P.panelPad ?? 16), rowGap = Number(P.slotGap ?? 10);
  const slotMinH = Number(P.slotMinH ?? 38);
  const panelW = (cb.w - gutter) / 2;
  const textW = panelW - 2 * pad - 24;
  const wrapAll = (lc) => slots.map((st) => panels.map((p) =>
    wrapLines(String(st[p.id]?.[lc] ?? ""), textW, 13, false, 2)));
  if (["ko", "en"].some((lc) => wrapAll(lc).some((r) => r.some((x) => x.overflow)))) {
    console.error("generate: a slot line exceeds the §2 budget at this layout"); process.exit(1);
  }
  // The rows are repeated items and share one height (set by the longest across both panels and
  // both locales). That is what puts the same slot at the same y and makes the repeated-item size
  // contract hold.
  const rowUnit = Math.max(slotMinH, ...["ko", "en"].flatMap((lc) =>
    wrapAll(lc).flat().map((r) => r.lines.length * 17 + 20)));
  const rowH = slots.map(() => rowUnit);
  const headH = Number(P.panelHeaderH ?? 34);
  const bodyH = rowH.reduce((a, b) => a + b, 0) + (slots.length - 1) * rowGap;
  // derivePanelFloor in skin.mjs owns the floor formula — the same function the validator uses.
  const f = derivePanelFloor(P);
  if (!f.declared || f.missing?.length) {
    console.error(`generate: before-after needs the floor components (${(f.missing ?? []).join(", ") || "panelPad, panelHeaderH, slotMinH, slotGap, minSlots"}) in fit.params`);
    process.exit(1);
  }
  const floorH = f.value;
  if (Number(P.itemMinH) !== floorH) {
    console.error(`generate: declared panel floor ${P.itemMinH} != derived ${floorH} (${f.formula})`);
    process.exit(1);
  }
  const panelH = Math.max(floorH, headH + pad + bodyH + pad);
  const consumed = [], containers = [], nodeArt = [], labels = [];
  const laid = wrapAll(loc);
  panels.forEach((p, pi) => {
    const px = cb.x + pi * (panelW + gutter);
    consumed.push(p.id);
    containers.push(`  <g data-comp-entity="${p.id}" data-entity="${p.id}" data-layout-role="panel">
    <rect x="${r1(px)}" y="${r1(cb.y)}" width="${r1(panelW)}" height="${r1(panelH)}" rx="14" fill="${pi === 0 ? "#F4F8FC" : "#EFF5EC"}" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule" data-layout-container="${p.id}" data-min-pad="${pad}" data-reserve-top="${headH}" data-layout-count="${slots.length}" data-symmetry="x"/>
    <text x="${r1(px + pad)}" y="${r1(cb.y + headH / 2 + 3)}" font-size="13" font-weight="700" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(p.title[loc])}</text>
  </g>`);
    let y = cb.y + headH + pad;
    slots.forEach((st, si) => {
      const t = laid[si][pi];
      const changed = st.change === "changed";
      // The same slot shares one row id across both panels — the alignment is the correspondence.
      nodeArt.push(`  <g data-comp-entity="${p.id}-${st.id}">
    <rect x="${r1(px + pad)}" y="${r1(y)}" width="${r1(panelW - 2 * pad)}" height="${r1(rowH[si])}" rx="9" fill="#FFFFFF" stroke="${changed && pi === 1 ? "#9BC3A5" : "#DEE0E2"}" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-parent="${p.id}" data-layout-item="${p.id}-rows" data-align-row="slot-${st.id}" data-align-row-count="${panels.length}"/>
    <text font-size="13" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${tspans(t.lines, px + pad + 12, y + rowH[si] / 2 - (t.lines.length - 1) * 8.5, 17)}</text>
  </g>`);
      y += rowH[si] + rowGap;
    });
    containers.push(`  <g data-layout-group="${p.id}-rows" data-distribution="equal-gap" data-axis="y" data-group-count="${slots.length}"></g>`);
  });
  let bottom = cb.y + panelH;
  if (delta.length) {
    const dy = bottom + 22;
    labels.push(`  <g data-layout-role="delta-strip">` + delta.map((d, i) =>
      `<text data-entity="${d.id}" x="${r1(cb.x)}" y="${r1(dy + i * 20)}" font-size="12.5" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc("· " + d.text[loc])}</text>`).join("") + `</g>`);
    for (const d of delta) consumed.push(d.id);
    bottom = dy + (delta.length - 1) * 20 + 12;
  }
  const inv = serializeAlignInventory(deriveAlignInventory("before-after", input, sc));
  return { body: [`  <g data-layer="containers" data-align-inventory="${inv}">`, ...containers, `  </g>`,
      `  <g data-layer="connectors"></g>`, `  <g data-layer="nodes">`, ...nodeArt, `  </g>`,
      `  <g data-layer="annotations">`, ...labels, `  </g>`].join("\n"),
    consumed, bounds: { x: cb.x, y: cb.y, w: cb.w, h: bottom - cb.y },
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: 0, legend: false, alignment: [],
      attempts: [], diagnostics: [], demoted: [], routes: [] } };
}

// ---------- timeline receipt v1 (shared by the producer and the verifier) ----------
// R0B-F1: the shape is pinned here. Every field not in the declaration is refused, and marker is a
// union of null and an object that cannot be mixed.
function validateTimelineReceiptV1(t, expect) {
  const e = [];
  const num = (v, w) => { if (typeof v !== "number" || !Number.isFinite(v)) e.push(`E-TL-SCHEMA ${w} must be a finite number (got ${JSON.stringify(v)})`); };
  const keys = (o, allow, w) => {
    for (const k of Object.keys(o ?? {})) if (!allow.includes(k)) e.push(`E-TL-SCHEMA ${w} carries undeclared field "${k}"`);
    for (const k of allow) if (!(k in (o ?? {}))) e.push(`E-TL-SCHEMA ${w} is missing required field "${k}"`);
  };
  if (!t || typeof t !== "object") { e.push("E-TL-SCHEMA timeline receipt is absent"); return e; }
  keys(t, ["schemaVersion", "kind", "axis", "phases", "marker"], "timeline");
  if (t.schemaVersion !== 1) e.push(`E-TL-SCHEMA schemaVersion must be 1 (got ${JSON.stringify(t.schemaVersion)})`);
  if (t.kind !== "ordinal") e.push(`E-TL-SCHEMA kind must be "ordinal" — this type makes no proportional claim (got ${JSON.stringify(t.kind)})`);
  keys(t.axis, ["x0", "x1", "endInset", "step"], "timeline.axis");
  for (const k of ["x0", "x1", "endInset", "step"]) num(t.axis?.[k], `timeline.axis.${k}`);
  if (!Array.isArray(t.phases)) e.push("E-TL-SCHEMA timeline.phases must be an array");
  else {
    if (expect && t.phases.length !== expect.phaseCount)
      e.push(`E-TL-SCHEMA timeline.phases holds ${t.phases.length} entries but the input declares ${expect.phaseCount} phases`);
    t.phases.forEach((p, i) => {
      keys(p, ["id", "index", "status", "x"], `timeline.phases[${i}]`);
      if (typeof p.id !== "string") e.push(`E-TL-SCHEMA timeline.phases[${i}].id must be a string`);
      if (p.index !== i) e.push(`E-TL-SCHEMA timeline.phases[${i}].index must equal its position (got ${JSON.stringify(p.index)})`);
      if (!["done", "current", "future"].includes(p.status)) e.push(`E-TL-SCHEMA timeline.phases[${i}].status must be done|current|future`);
      num(p.x, `timeline.phases[${i}].x`);
    });
  }
  // marker is a union — either absent (null), or present with all three fields.
  if (t.marker !== null) {
    if (!t.marker || typeof t.marker !== "object") e.push("E-TL-SCHEMA timeline.marker must be null or an object");
    else {
      keys(t.marker, ["afterPhase", "x", "labelConsumed"], "timeline.marker");
      if (typeof t.marker.afterPhase !== "string") e.push("E-TL-SCHEMA timeline.marker.afterPhase must be a phase id");
      num(t.marker.x, "timeline.marker.x");
      if (t.marker.labelConsumed !== true) e.push("E-TL-SCHEMA timeline.marker.labelConsumed must be true — a declared label that is not drawn is a dropped input");
    }
  }
  if (expect) {
    const hasMarker = t.marker !== null;
    if (hasMarker !== expect.hasMarker)
      e.push(`E-TL-SCHEMA timeline.marker is ${hasMarker ? "present" : "null"} but the input ${expect.hasMarker ? "declares" : "declares no"} now_marker`);
  }
  return e;
}

// ---------- roadmap-timeline (an ordinal axis — position means order and nothing else) ----------
// This type **claims no proportional duration**. The spacing is even and there is no date domain in
// the input. The marker position, too, is fixed by the input's after_phase rather than inferred by
// the renderer.
const TL = { pad: 12, cardTitle: 13, cardBody: 11, dotR: 9, ringGap: 5, ringStroke: 1.8,
  axisH: 6, labelGap: 12, outerClearance: 14, pillH: 22, pillPad: 10, stem: 46, bandPad: 10 };
function timelineGeometry(input, cb, tp) {
  const ph = input.phases, n = ph.length;
  const P = tp.fit?.params ?? {};
  // The **content** fixes the card width. Since §2 requires a one-line title, the longest title
  // across both locales is the lower bound on the width, and endInset derives from that width — as
  // a constant it would push the outermost card past the content box.
  const cardW = Math.max(Number(P.itemMinW ?? 132), ...["ko", "en"].flatMap((lc) =>
    ph.map((p) => estimateWidth(String(p.card.title[lc]), TL.cardTitle, true, 0) + 2 * TL.pad)));
  const endInset = cardW / 2 + TL.outerClearance;
  const step = n > 1 ? (cb.w - 2 * endInset) / (n - 1) : 0;
  const xs = ph.map((_, i) => cb.x + endInset + i * step);
  const curIdx = ph.findIndex((p) => p.status === "current");
  const markerX = input.now_marker ? (xs[curIdx] + xs[curIdx + 1]) / 2 : null;
  return { n, cardW, endInset, step, xs, curIdx, markerX, gapX: Number(P.gapX ?? 20) };
}
function renderRoadmapTimeline(input, loc, cb, sc, tp) {
  const ph = input.phases;
  const g = timelineGeometry(input, cb, tp);
  const fail = (reason, ladder) => ({ needsSplit: true, timelineReason: reason,
    routing: { degradeLevel: 0, ladder: ladder ?? [], problems: [reason], hops: 0, legend: false,
      alignment: [], attempts: [], diagnostics: [], demoted: [], routes: [], unrouted: [], edgeCount: 0 } });
  // If even spacing makes the cards overlap, it ends non-success rather than being solved by moving things.
  if (g.n > 1 && g.step < g.cardW + g.gapX)
    return fail(`even spacing gives ${r1(g.step)}px between phase centres but a card needs ${r1(g.cardW + g.gapX)}px — the interval is computed, never widened by label`);
  const alt = g.n >= 5;                       // step 2 of the §6 ladder: alternate above and below
  const bodies = ph.map((p) => (p.card.body ? ["ko", "en"].map((lc) =>
    wrapLines(String(p.card.body[lc]), g.cardW - 2 * TL.pad, TL.cardBody, false, 2)) : null));
  // A body over budget is not a layout problem but **the input breaking §2**, and it is not
  // swallowed by a degrade. (Why dropping the body is not on the ladder is written in spec §6 —
  // height is not a constraint in this type.)
  if (bodies.some((b) => b?.some((x) => x.overflow))) {
    console.error("generate: a milestone body exceeds the §2 two-line budget at the computed card width");
    process.exit(1);
  }
  const bodyLines = Math.max(0, ...bodies.map((b) => (b ? Math.max(...b.map((x) => x.lines.length)) : 0)));
  const cardH = TL.pad + 18 + (bodyLines ? 6 + bodyLines * 15 : 0) + TL.pad;
  // The label goes on the opposite side from the card — in the alternating arrangement an upper card would cover it.
  const labelH = TL.dotR + TL.ringGap + 10 + 8;
  const cardSide = TL.labelGap + TL.dotR + cardH;
  const markerTop = input.now_marker ? TL.stem + TL.pillH : 0;
  const above = Math.max(markerTop, labelH, alt ? cardSide : 0);
  // The band sits inside the container — touching the boundary is not a pass either, so real margin is left empty.
  const axisY = cb.y + TL.bandPad + above;
  const consumed = [], containers = [], nodeArt = [], labels = [];
  const STATUS_TEXT = { ko: { done: "완료", current: "진행 중", future: "예정" },   /* lang-allow: ko-copy: timeline-status-vocabulary */
    en: { done: "Done", current: "In progress", future: "Planned" } };
  const axisX0 = cb.x + g.endInset - 14, axisX1 = cb.x + cb.w - g.endInset + 14;
  const bottom = axisY + Math.max(cardSide, alt ? labelH : 0) + TL.bandPad;
  containers.push(`  <rect data-layout-container="timeline" x="${r1(cb.x)}" y="${r1(cb.y)}" width="${r1(cb.w)}" height="${r1(bottom - cb.y)}" fill="none" stroke="none" data-min-pad="10" data-layout-count="${g.n}"/>`);
  // The axis is the **background rail** the dots and cards sit on. Placed in annotations it would
  // cover the nodes, so it goes early in the paint layer contract (containers -> connectors ->
  // nodes -> annotations).
  containers.push(`  <g data-layout-role="axis" data-axis-kind="ordinal-direction">
    <rect data-axis="x" data-axis-orientation="horizontal" data-axis-positive="right" x="${r1(axisX0)}" y="${r1(axisY - TL.axisH / 2)}" width="${r1(axisX1 - axisX0)}" height="${TL.axisH}" rx="${TL.axisH / 2}" fill="#DEE0E2" data-fill-role="rule"/>
  </g>`);
  ph.forEach((p, i) => {
    consumed.push(p.id);
    const x = g.xs[i], up = alt && i % 2 === 1;
    const cy = up ? axisY - TL.labelGap - TL.dotR - cardH : axisY + TL.labelGap + TL.dotR;
    const b = bodies[i] ? bodies[i][loc === "ko" ? 0 : 1] : null;
    // Status is distinguished by **shape** as well as colour: done is filled, current is filled
    // with a ring, future is an outline. And a state marker must be **opaque** — left empty, the
    // axis rail behind shows through and the dot looks snagged on the line. The background is
    // painted with the canvas role rather than hardcoded (so it holds in dark too).
    const cy0 = r1(axisY), cxs = r1(x);
    const under = (rad) => `<circle data-dot-underlay="${p.status}" cx="${cxs}" cy="${cy0}" r="${r1(rad)}" fill="#F7F7F5" data-fill-role="canvas"/>`;
    const dot = p.status === "future"
      ? `${under(TL.dotR)}<circle cx="${cxs}" cy="${cy0}" r="${TL.dotR}" fill="#F7F7F5" data-fill-role="canvas" stroke="#636A75" stroke-width="1.8" data-stroke-role="muted" data-dot-status="future"/>`
      : p.status === "done"
        ? `${under(TL.dotR)}<circle cx="${cxs}" cy="${cy0}" r="${TL.dotR}" fill="#636A75" data-fill-role="muted" data-dot-status="done"/>`
        : `${under(TL.dotR + TL.ringGap + TL.ringStroke / 2)}<circle cx="${cxs}" cy="${cy0}" r="${TL.dotR}" fill="#2E6DA4" data-fill-role="focus" data-dot-status="current"/><circle data-dot-ring="current" cx="${cxs}" cy="${cy0}" r="${r1(TL.dotR + TL.ringGap)}" fill="none" stroke="#2E6DA4" stroke-width="${TL.ringStroke}" data-stroke-role="focus"/>`;
    nodeArt.push(`  <g data-comp-entity="${p.id}" data-entity="${p.id}" data-phase-status="${p.status}" data-phase-index="${i}">
    <title>${esc(STATUS_TEXT[loc][p.status])}</title>
    ${dot}
    <text x="${r1(x)}" y="${r1(axisY + (up ? 1 : -1) * (TL.dotR + TL.ringGap + 10))}" font-size="12" font-weight="700" fill="#252B35" data-fill-role="ink" text-anchor="middle" dominant-baseline="central" data-phase-label="${p.id}">${esc(p.label[loc])}</text>
    <rect x="${r1(x - g.cardW / 2)}" y="${r1(cy)}" width="${r1(g.cardW)}" height="${r1(cardH)}" rx="12" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-parent="timeline" data-phase-card="${p.id}"/>
    <text x="${r1(x - g.cardW / 2 + TL.pad)}" y="${r1(cy + TL.pad + 8)}" font-size="${TL.cardTitle}" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${esc(p.card.title[loc])}</text>${
      b ? `\n    <text font-size="${TL.cardBody}" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${tspans(b.lines, x - g.cardW / 2 + TL.pad, cy + TL.pad + 8 + 14, 15)}</text>` : ""}
  </g>`);
  });
  if (input.now_marker) {
    // The pill width is fixed at the max across both locales — the geometry does not split by language.
    const pw = Math.max(...["ko", "en"].map((lc) =>
      estimateWidth(String(input.now_marker.label[lc]), 12, true, 0))) + 2 * TL.pillPad;
    const mx = g.markerX;
    labels.push(`  <g data-marker="now" data-marker-after="${esc(input.now_marker.after_phase)}">
    <path data-marker-stem="now" d="M${r1(mx)} ${r1(axisY - TL.stem)} V${r1(axisY + TL.stem)}" fill="none" stroke="#2E6DA4" stroke-width="1.5" stroke-dasharray="5 4" data-stroke-role="focus"/>
    <rect data-marker-pill="now" x="${r1(mx - pw / 2)}" y="${r1(axisY - TL.stem - TL.pillH)}" width="${r1(pw)}" height="${TL.pillH}" rx="${TL.pillH / 2}" fill="#2E6DA4" data-fill-role="focus"/>
    <text x="${r1(mx)}" y="${r1(axisY - TL.stem - TL.pillH / 2)}" font-size="12" font-weight="700" fill="#FFFFFF" data-fill-role="on-focus" text-anchor="middle" dominant-baseline="central">${esc(String(input.now_marker.label[loc]))}</text>
  </g>`);
  }
  return { body: [`  <g data-layer="containers">`, ...containers, `  </g>`,
      `  <g data-layer="connectors"></g>`, `  <g data-layer="nodes">`, ...nodeArt, `  </g>`,
      `  <g data-layer="annotations">`, ...labels, `  </g>`].join("\n"),
    consumed, bounds: { x: cb.x, y: cb.y, w: cb.w, h: bottom - cb.y },
    timeline: { schemaVersion: 1, kind: "ordinal",
      axis: { x0: r1(axisX0), x1: r1(axisX1), endInset: r1(g.endInset), step: r1(g.step) },
      phases: ph.map((p, i) => ({ id: p.id, index: i, status: p.status, x: r1(g.xs[i]) })),
      marker: input.now_marker
        ? { afterPhase: input.now_marker.after_phase, x: r1(g.markerX), labelConsumed: true }
        : null },
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: 0, legend: false, alignment: [],
      attempts: [], diagnostics: [], demoted: [], routes: [] } };
}

// ---------- decision-matrix (axes outside, cells on a grid) ----------
// The axis is an **ordinal category direction** — neither a numeric interval nor a chart scale.
// So there are no ticks, numbers or gridlines; only the direction (up and right are higher).
// The axis is not a connector: it carries no data-route-*, so it is not a subject of the routing
// audit, and its direction marker derives thinner (lower in priority) than a primary connector arrow.
const AXIS_SHAFT = 1.5;                         // thinner than a primary connector's 2.5 or a secondary's 2.2
const AXIS_HEAD = r1(4.5 * AXIS_SHAFT);         // the marker size derives from the **same formula** as a connector's
function renderDecisionMatrix(input, loc, cb, sc, tp) {
  const cells = input.cells, ax = input.axes;
  const pl = deriveMatrixPlacement(input);
  const cols = pl.cols, rows = pl.rows;
  if (Number(sc.cols) !== cols) { console.error(`generate: scenario declares cols ${sc.cols} but axes.x declares ${cols} tiers`); process.exit(1); }
  const P = tp.fit?.params ?? {};
  const gx = Number(P.gapX ?? 16), gy = Number(P.gapY ?? 16);
  const padY = Number(P.cellPadY ?? 14);
  const pad = 12, axisGap = 12, endLabel = 11;
  const endOf = (a, which) => (which === "high" ? pl[a === "x" ? "xTiers" : "yTiers"].at(-1) : pl[a === "x" ? "xTiers" : "yTiers"][0]);
  // The axis label column width derives from the **actual copy** (max across both locales) — a fixed constant would overflow in KO.
  const axisTextW = Math.max(...["ko", "en"].flatMap((lc) =>
    ["low", "high"].map((w) => estimateWidth(String(endOf("y", w).label[lc]), endLabel, true, 0))));
  // The reservation = [label][label-to-axis gap][axis-to-grid gap]. The axis line touches neither the grid nor the label.
  const axisCol = Math.max(48, axisTextW + 8 + axisGap + 4);
  const axisRow = axisGap + 22;
  // The grid width is computed from the **real width left after the reservation (the axis label
  // column) and the container pad** — touching the boundary exactly is not a pass either, so the
  // pad on both sides is genuinely left empty.
  const gridW = cb.w - axisCol - 2 * pad;
  const cw = (gridW - (cols - 1) * gx) / cols;
  const x0 = cb.x + axisCol + pad, y0 = cb.y + pad;
  // The **content** fixes the cell height, not the canvas: the larger line-box across the two
  // locales plus top and bottom padding, never stretched to fill leftover space (what is left over
  // is declared by the residual contract).
  const wrapped = new Map();
  let ch = 0;
  for (const c of cells) {
    for (const lc of ["ko", "en"]) {
      const nameL = wrapLines(cellName(c, pl, lc), cw - 2 * pad, 14, true, 2);
      const traitL = wrapLines(c.trait[lc], cw - 2 * pad, 12, false, 2);
      if (nameL.overflow || traitL.overflow) { console.error(`generate: cell "${c.id}" text exceeds the §2 budget (${lc})`); process.exit(1); }
      wrapped.set(`${c.id}|${lc}`, { nameL, traitL });
      ch = Math.max(ch, padY + nameL.lines.length * 18 + 6 + traitL.lines.length * 16 + padY);
    }
  }
  const gridH = rows * ch + (rows - 1) * gy;
  const consumed = [], containers = [], nodeArt = [], labels = [];
  // The whole grid is one container, and the axis label spans are declared as **horizontal and vertical reservations**.
  containers.push(`  <rect data-layout-container="matrix" x="${r1(cb.x)}" y="${r1(cb.y)}" width="${r1(cb.w)}" height="${r1(gridH + 2 * pad)}" fill="none" stroke="none" data-min-pad="${pad}" data-reserve-left="${axisCol}" data-reserve-top="0" data-layout-count="${cells.length}"/>`);
  const inRow = (r) => pl.cells.filter((c) => c.row === r).length;
  const inCol = (c) => pl.cells.filter((x) => x.col === c).length;
  for (let r = 0; r < rows; r++)
    if (inRow(r) === cols)   // only a complete row declares an even-gap group (with a blank cell, column alignment governs)
      containers.push(`  <g data-layout-group="matrix-row-${r}" data-distribution="equal-gap" data-axis="x" data-group-count="${cols}"></g>`);
  cells.forEach((c, i) => {
    const p = pl.cells[i];
    const cx = x0 + p.col * (cw + gx), cy = y0 + p.row * (ch + gy);
    consumed.push(c.id);
    const rowCount = inRow(p.row), colCount = inCol(p.col);
    const { nameL, traitL } = wrapped.get(`${c.id}|${loc}`);
    nodeArt.push(`  <g data-comp-entity="${c.id}" data-entity="${c.id}" data-cell-x="${esc(c.x)}" data-cell-y="${esc(c.y)}">
    <rect x="${r1(cx)}" y="${r1(cy)}" width="${r1(cw)}" height="${r1(ch)}" rx="12" fill="#FFFFFF" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface" data-stroke-role="rule" data-layout-parent="matrix"${rowCount === cols ? ` data-layout-item="matrix-row-${p.row}"` : ""}${rowCount >= 2 ? ` data-align-row="matrix-r${p.row}" data-align-row-count="${rowCount}"` : ""}${colCount >= 2 ? ` data-align-col="matrix-c${p.col}" data-align-col-count="${colCount}"` : ""}/>
    <text font-size="14" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${tspans(nameL.lines, cx + pad, cy + padY + 9, 18)}</text>
    <text font-size="12" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${tspans(traitL.lines, cx + pad, cy + padY + 9 + nameL.lines.length * 18 + 6, 16)}</text>
  </g>`);
  });
  // The axes go **outside** the panels (spec §5): the vertical axis left of the grid, the horizontal axis below it.
  const gridBottom = y0 + gridH, gridRight = x0 + gridW;
  const ayX = r1(x0 - axisGap), axY = r1(gridBottom + axisGap);
  const A = `fill="none" data-stroke-role="muted" stroke="#636A75" stroke-width="${AXIS_SHAFT}" stroke-linecap="round" stroke-linejoin="round"`;
  const h = AXIS_HEAD / 2;
  labels.push(`  <g data-layout-role="axis" data-axis-kind="ordinal-direction">
    <path data-axis="y" data-axis-orientation="vertical" data-axis-positive="up" d="M${ayX} ${r1(gridBottom)} V${r1(y0)}" ${A}/>
    <path data-axis-marker="y" d="M${r1(ayX - h)} ${r1(y0 + AXIS_HEAD)} L${ayX} ${r1(y0)} L${r1(ayX + h)} ${r1(y0 + AXIS_HEAD)}" ${A}/>
    <path data-axis="x" data-axis-orientation="horizontal" data-axis-positive="right" d="M${r1(x0)} ${axY} H${r1(gridRight)}" ${A}/>
    <path data-axis-marker="x" d="M${r1(gridRight - AXIS_HEAD)} ${r1(Number(axY) - h)} L${r1(gridRight)} ${axY} L${r1(gridRight - AXIS_HEAD)} ${r1(Number(axY) + h)}" ${A}/>
    <text data-axis-end="y:high" x="${r1(ayX - 8)}" y="${r1(y0 + 8)}" font-size="${endLabel}" font-weight="700" fill="#636A75" data-fill-role="muted" text-anchor="end" dominant-baseline="central">${esc(endOf("y", "high").label[loc])}</text>
    <text data-axis-end="y:low" x="${r1(ayX - 8)}" y="${r1(gridBottom - 8)}" font-size="${endLabel}" font-weight="700" fill="#636A75" data-fill-role="muted" text-anchor="end" dominant-baseline="central">${esc(endOf("y", "low").label[loc])}</text>
    <text data-axis-end="x:low" x="${r1(x0)}" y="${r1(Number(axY) + 14)}" font-size="${endLabel}" font-weight="700" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(endOf("x", "low").label[loc])}</text>
    <text data-axis-end="x:high" x="${r1(gridRight)}" y="${r1(Number(axY) + 14)}" font-size="${endLabel}" font-weight="700" fill="#636A75" data-fill-role="muted" text-anchor="end" dominant-baseline="central">${esc(endOf("x", "high").label[loc])}</text>
  </g>`);
  const inv = serializeAlignInventory(deriveAlignInventory("decision-matrix", input, sc));
  return { body: [`  <g data-layer="containers" data-align-inventory="${inv}">`, ...containers, `  </g>`,
      `  <g data-layer="connectors"></g>`, `  <g data-layer="nodes">`, ...nodeArt, `  </g>`,
      `  <g data-layer="annotations">`, ...labels, `  </g>`].join("\n"),
    consumed, bounds: { x: cb.x, y: cb.y, w: cb.w, h: gridH + 2 * pad + axisRow },
    matrix: { kind: "ordinal-direction", cols, rows, cellH: r1(ch), cellW: r1(cw),
      axes: { x: { positive: "right", tiers: pl.xTiers.map((t) => t.id) },
        y: { positive: "up", tiers: pl.yTiers.map((t) => t.id) } },
      placement: pl.cells.map((c) => ({ id: c.id, x: c.x, y: c.y, row: c.row, col: c.col,
        alignRow: inRow(c.row) >= 2 ? `matrix-r${c.row}` : null, alignCol: inCol(c.col) >= 2 ? `matrix-c${c.col}` : null })) },
    routing: { degradeLevel: 0, ladder: [], problems: [], hops: 0, legend: false, alignment: [],
      attempts: [], diagnostics: [], demoted: [], routes: [] } };
}
// name is optional — without it, it derives from the two tier labels (avoiding an order-ambiguous "low-high").
function cellName(c, pl, lc) {
  if (c.name) return c.name[lc];
  const yt = pl.yTiers.find((t) => t.id === c.y), xt = pl.xTiers.find((t) => t.id === c.x);
  return `${yt.label[lc]} · ${xt.label[lc]}`;
}

// ---------- font delivery (portable = embedding a subset of the glyphs used) ----------
// The contract: portable does not depend on a font installed in the target environment. If the
// subset tool is absent or a glyph is missing it **fails rather than sliding quietly into a full
// embed or a system fallback**. This path is used **only when producing** an artifact — consuming
// or verifying an existing one does not need it.
function fontDelivery(modeArg) {
  const del = spawnJson([skinCli, "delivery", "--json"], "skin.mjs delivery");
  const mode = modeArg ?? del.defaultMode;
  if (!del.modes[mode]) { console.error(`generate: unknown font-delivery mode "${mode}"`); process.exit(2); }
  return { policy: del, mode, grade: del.modes[mode].grade };
}
function subsetFace(facePath, chars, tool, style, weight, alias, rfn) {
  // All the environment supplies is the interpreter. The subsetting itself is done by the wrapper
  // the package owns, and that wrapper checks the running fontTools/brotli versions directly — an
  // arbitrary executable cannot produce an acceptance artifact.
  const python = process.env.SVGINFO_PYTHON ?? tool.command ?? "python3";
  const wrapper = guardPackagePath(path.join(here, "..", String(tool.wrapper)), "font subset wrapper");
  // The path is created **fresh on every call**. Naming it by content would have two builds
  // subsetting the same character set concurrently write the same file and erase each other's work
  // (the working directory is a shared tmp).
  const work = mkdtempSync(path.join(tmpdir(), "svginfo-subset-"));
  const tmp = path.join(work, `face-${weight}.woff2`);
  const textFile = tmp + ".txt";
  writeFileSync(textFile, chars);
  const args = [wrapper, "--face", facePath, "--text-file", textFile, "--out", tmp,
    "--alias", alias, "--style", style, "--weight", String(weight),
    "--expect-fonttools", String(tool.version), "--expect-brotli", String(tool.brotli),
    ...rfn.flatMap((n) => ["--rfn", String(n)])];
  const r = spawnSync(python, args, { encoding: "utf8" });
  const done = () => rmSync(work, { recursive: true, force: true });
  rmSync(textFile, { force: true });
  if (r.error?.code === "ENOENT") {
    done();
    console.error(`generate: portable delivery needs the pinned toolchain (${tool.name} ${tool.version} + brotli ${tool.brotli}) run through ${tool.wrapper}.\n  It is a build-only dependency: point SVGINFO_PYTHON at an interpreter that has it, or generate with --font-delivery system (environment-dependent, not acceptance-grade).`);
    process.exit(4);
  }
  if (r.status !== 0) {
    done();
    console.error(`generate: subsetting failed (exit ${r.status})\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trimEnd());
    process.exit(4);
  }
  let receipt;
  try { receipt = JSON.parse(r.stdout); } catch { done(); console.error("generate: subset wrapper did not return JSON"); process.exit(4); }
  if (receipt.rfnGuard !== "clean") { done(); console.error("generate: subset wrapper did not certify the reserved-name guard"); process.exit(4); }
  const buf = readFileSync(tmp);
  done();
  return { buf, receipt };
}

// Collect only the characters the artifact actually used (the contract is the character set, not a count)
function usedChars(svg) {
  const texts = [...svg.matchAll(/<(?:text|tspan)[^>]*>([^<]*)</g)].map((m) => m[1]);
  const set = new Set();
  for (const t of texts) for (const ch of t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")) set.add(ch);
  return [...set].sort().join("");
}
function embedSubset(svg, delivery, treatment = "flat") {
  const m = delivery.policy.modes[delivery.mode];
  if (m.embed !== "subset") return { svg, faces: [] };
  const full = readYamlFile(path.join(here, "..", "references", "delivery", "font-delivery-v1.yaml"));
  const cfg = full.doc.modes[delivery.mode];
  const chars = usedChars(svg);
  if (!chars) { console.error("generate: portable delivery found no text to subset"); process.exit(4); }
  const tp = readYamlFile(path.join(here, "..", "references", "typography", "typography-v1.yaml"));
  // The typography profile owns the font — neither the treatment resolver nor the generator chooses a face.
  const prof = tp.doc.treatments[treatment];
  if (!prof) { console.error(`generate: typography profile declares no "${treatment}" treatment`); process.exit(4); }
  const rfn = prof.license?.rfn ?? [];
  // A single-face profile (sketch) has no faces array — the declared form is read as it stands.
  const declared = prof.asset.faces ?? [{ weight: (prof.locales.ko.weights ?? [400])[0], path: prof.asset.path, digest: prof.asset.digest }];
  const faces = [];
  let css = "", tool = null, identity = [];
  for (const f of declared) {
    const abs = path.join(here, "..", String(f.path));
    const style = Number(f.weight) >= 700 ? "Bold" : "Regular";
    const { buf, receipt } = subsetFace(abs, chars, cfg.tool, style, f.weight, cfg.alias, rfn);
    tool = receipt.tool;
    identity.push({ weight: Number(f.weight), ...receipt.identity, preservedLegalNameIDs: receipt.preservedLegalNameIDs });
    faces.push({ weight: Number(f.weight), sourceDigest: f.digest, subsetDigest: receipt.digest, bytes: buf.length });
    css += `@font-face{font-family:'${cfg.alias}';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}`;
  }
  const stack = `'${cfg.alias}',` + (/\s/.test(prof.locales.ko.face) ? `'${prof.locales.ko.face}'` : prof.locales.ko.face) + "," + prof.fallback.map((x) => /\s/.test(x) ? `'${x}'` : x).join(",");
  const out = svg
    .replace(/style="font-family:[^"]*"/, `style="font-family:${stack}"`)
    .replace("</desc>", `</desc>\n  <style>${css}</style>`);
  return { svg: out, faces, alias: cfg.alias, chars: chars.length, tool, identity,
    wrapperDigest: sha(readFileSync(guardPackagePath(path.join(here, "..", String(cfg.tool.wrapper)), "font subset wrapper"))) };
}

// ---------- build ----------
function build(argv) {
  const opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const tid = opt("typepack"), caseId = opt("case"), loc = opt("locale"), out = opt("out"), rcp = opt("receipt");
  if (!tid || !caseId || !["ko", "en"].includes(loc) || !rcp) { console.error("usage: generate.mjs build --typepack <id> --case <case> --locale ko|en --out <svg> --receipt <json>"); process.exit(2); }
  const { tp, sc, input, inputDigest } = loadCase(tid, caseId);
  const override = opt("preset");
  const audition = argv.includes("--audition");
  const preset = override ?? (tp.presets.includes(sc.preset) ? sc.preset : tp.presets[0]);
  // Only a treatment the registry allows can be chosen — a file existing is not permission.
  let tx;
  try { tx = loadTreatment(opt("treatment") ?? "flat", opt("mode") ?? "light"); }
  catch (e) { console.error(`generate: ${e.message}`); process.exit(2); }
  // The named calibration in the typography SSoT owns the optical size correction. The generator
  // fixes no value; it reads the band factor and moves from **nominal size to resolved size**.
  const typoDoc = readYamlFile(path.join(here, "..", "references", "typography", "typography-v1.yaml")).doc;
  const cal = typoDoc.treatments?.[tx.name]?.optical_calibration ?? null;
  const overrideScale = opt("optical-scale") ? Number(opt("optical-scale")) : null;
  const band = (b) => (overrideScale ?? Number(cal?.bands?.[b] ?? 1));
  const TS = { display: band("display"), body: band("body"),
    fs: (nominal, b = "body") => r1(Number(nominal) * band(b)),
    calibration: cal ? { id: cal.id, bands: { display: band("display"), body: band("body") } } : null };
  if (override && !tp.presets.includes(override) && !audition) {
    console.error(`generate: preset "${override}" is not declared by ${tid} (declared: ${tp.presets.join(", ")}) — pass --audition to render it as evidence, which marks the receipt non-canonical`);
    process.exit(1);
  }
  const render = (cbox) => tid === "cards-kpi-grid" ? renderCards(input, loc, cbox, sc, tp)
    : tid === "topology-component" ? renderTopology(input, loc, cbox, sc, tp, 0, TS)
    : tid === "process-flow" ? renderProcessFlow(input, loc, cbox, sc, tp)
    : tid === "approval-gate" ? renderApprovalGate(input, loc, cbox, sc, tp)
    : tid === "layer-stack" ? renderLayerStack(input, loc, cbox, sc, tp)
    : tid === "nested-scope" ? renderNestedScope(input, loc, cbox, sc, tp)
    : tid === "before-after" ? renderBeforeAfter(input, loc, cbox, sc, tp)
    : tid === "decision-matrix" ? renderDecisionMatrix(input, loc, cbox, sc, tp)
    : tid === "roadmap-timeline" ? renderRoadmapTimeline(input, loc, cbox, sc, tp)
    : (console.error(`generate: no renderer registered for "${tid}"`), process.exit(2));
  const osArgs = TS.display === 1 ? [] : ["--optical-scale", String(TS.display)];
  let pf = spawnJson([skinCli, "pageframe", preset, ...osArgs, "--json"], "skin.mjs pageframe");
  if (pf.regions.fluid) {
    // A fluid canvas follows the content height — measure the block first, then rebuild the frame at that height.
    const probe = render({ ...pf.regions.contentBox, h: 100000 });
    // If the layout does not hold there is no height to measure — the frame is left alone and the needs-split path below decides.
    if (probe.bounds)
      pf = spawnJson([skinCli, "pageframe", preset, ...osArgs, "--content-height", String(Math.ceil(probe.bounds.h)), "--json"], "skin.mjs pageframe");
  }
  const cb = pf.regions.contentBox;
  const need = computeFit(tp, sc);
  const geometry = need.w <= cb.w && need.h <= cb.h ? "fits" : "needs-split";
  const expected = sc.geometry_expected ?? "fits";
  const base = { schemaVersion: 1, command: "generate", typepack: tid, case: sc.id, locale: loc,
    preset, cols: sc.cols ?? null, presetDeclared: tp.presets.includes(preset), presetPreferred: tp.preferred_preset ?? null,
    presetsSupported: tp.presets ?? [], audition: Boolean(override) && !tp.presets.includes(preset), layout: sc.layout, count: Number(sc.count), inputDigest,
    geometry, geometryExpected: expected, routingExpected: sc.routing_expected ?? null,
    footprint: { w: r1(need.w), h: r1(need.h) }, contentBox: { w: cb.w, h: cb.h } };

  if (geometry === "needs-split") {
    // Not treated as a successful render — it leaves a degrade receipt and ends non-success.
    const degrade = { ...base, status: "needs-split", artifact: null, consumed: [],
      degrade: { reason: `declared layout needs ${r1(need.w)}×${r1(need.h)} against contentBox ${cb.w}×${cb.h}`,
                 ladder: "spec §6 — reduce optional content, select a declared variant, then split the page" },
      provenance: provenance({ producer: { kind: "generator", generatorDigest: sha(readFileSync(fileURLToPath(import.meta.url))) },
        inputs: [{ role: "typepack-input", digest: inputDigest }] }) };
    writeFileSync(rcp, JSON.stringify(degrade, null, 1) + "\n");
    console.log(`generate ${tid}/${sc.id}/${loc} — needs-split (no artifact); degrade receipt written`);
    process.exit(3);
  }

  const R = render(cb);
  const routingExpected = sc.routing_expected ?? null;
  if (routingExpected === "needs-split" && !R.needsSplit) {
    console.error(`generate: scenario declares routing_expected needs-split but the router found a legal layout — update the declaration`);
    process.exit(1);
  }
  if (routingExpected === "routable" && R.needsSplit) {
    console.error(`generate: scenario declares routing_expected routable but routing failed: ${R.routing.problems[0]}`);
    process.exit(1);
  }
  if (R.needsSplit) {
    const degrade = { ...base, status: "needs-split", artifact: null, consumed: [],
      degrade: { reason: R.timelineReason
                   ? `layout: ${R.timelineReason}`
                   : `routing: the bounded router found no legal route for ${R.routing.unrouted?.length ?? "?"} of ${R.routing.edgeCount ?? "?"} edges under the current layout constraints (${(R.routing.unrouted ?? []).join(", ")}); this is a search result within the declared candidate shapes, not a proof that no layout exists`,
                 ladder: R.timelineReason
                   ? "spec §6 — 1) alternating layout · 2) needs-split. body drop is not a step (height never binds in this type) and adjacent-phase merge is not supported (merging changes the author's meaning)"
                   : "spec §6 — " + R.routing.ladder.map((l) => `${l.step}) ${l.action}${l.applied ? " ✓" : " ✗"}`).join(" · ") },
      routing: R.routing,
      provenance: provenance({ producer: { kind: "generator", generatorDigest: sha(readFileSync(fileURLToPath(import.meta.url))) },
        inputs: [{ role: "typepack-input", digest: inputDigest }] }) };
    writeFileSync(rcp, JSON.stringify(degrade, null, 1) + "\n");
    console.log(`generate ${tid}/${sc.id}/${loc} — needs-split (routing); degrade receipt written`);
    process.exit(3);
  }
  // The fit prediction is the **floor of the minimum legal syntax**. When content grows past that
  // floor and the layout actually leaves the contentBox, what the optimistic prediction let through
  // is refused again here.
  if (R.bounds.h > cb.h + 1) {
    const degrade = { ...base, status: "needs-split", artifact: null, consumed: [],
      degrade: { reason: `measured layout is ${r1(R.bounds.h)}px tall against contentBox ${cb.h}px — the declared fit floor (${r1(need.h)}px) is a lower bound and the content grew past it`,
                 ladder: "spec §6 — reduce optional content, select a declared variant, then split the page" },
      provenance: provenance({ producer: { kind: "generator", generatorDigest: sha(readFileSync(fileURLToPath(import.meta.url))) },
        inputs: [{ role: "typepack-input", digest: inputDigest }] }) };
    writeFileSync(rcp, JSON.stringify(degrade, null, 1) + "\n");
    console.log(`generate ${tid}/${sc.id}/${loc} — needs-split (measured overflow); degrade receipt written`);
    process.exit(3);
  }
  const canvasH = pf.regions.fluid ? pf.regions.documentHeight : pf.canvas.height;
  if (!Number.isFinite(Number(canvasH))) { console.error(`generate: page height is not resolved (${canvasH})`); process.exit(1); }
  const eyebrow = loc === "ko" ? "타입 카탈로그" : "TYPE CATALOG";   /* lang-allow: ko-copy: page-eyebrow */
  const title = input.title?.[loc];
  if (!title) { console.error("generate: input payload must carry title.ko/title.en — the H1 is content, not something the generator may invent"); process.exit(1); }
  const subtitle = loc === "ko" ? `${tid} · ${sc.id}` : `${tid} · ${sc.id}`;
  // A treatment changes **surface handling** only — coordinates, copy, semantic ids and reading order stay as they are.
  const canvas = { w: pf.canvas.width, h: canvasH };
  const defs = treatmentDefs(tx, canvas);
  const body = tx.name === "flat" ? R.body
    : R.body.replace(/<g data-layer="(containers|connectors|nodes)"/g, (m, k) => `${m}${filterAttr(tx, k === "connectors" ? "rough-line" : "rough-box")}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pf.canvas.width} ${canvasH}" width="${pf.canvas.width}" height="${canvasH}" role="img"
  style="font-family:Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <title>${esc(title)}</title>
  <desc>${esc(tid)} ${esc(sc.id)} (${loc}) — generated from the declared TypePack input payload.</desc>
  <rect data-fill-role="canvas" fill="#F7F7F5" width="${pf.canvas.width}" height="${pf.canvas.height}"/>${tx.name === "flat" ? "" : `\n${paperRect(tx, canvas)}\n  <defs data-treatment-defs="${tx.name}">\n${defs}\n  </defs>`}
${header(pf, title, eyebrow, subtitle, R.bounds.y)}
${body}
</svg>
`;
  // kernel §8: after the layout, record contentFlowBounds and the residual; a large bottom margin
  // is allowed only where the scenario declared it explicitly (undeclared dead space is a non-success).
  const fb = R.bounds;
  const residual = { top: r1(fb.y - cb.y), bottom: r1(cb.y + cb.h - (fb.y + fb.h)) };
  const RESIDUAL_TOL = 8, RESIDUAL_FLOOR = 0.08;
  const decl = sc.residual_disposition ?? null;
  // What the receipt reports is the disposition that was **applied**, not the scenario's whole
  // declaration. Below the floor nothing is compared, so there is nothing to attribute; copying the
  // full by_treatment list in would credit this artifact with entries written for other treatments.
  let appliedDisposition = null;
  if (residual.bottom > RESIDUAL_FLOOR * cb.h) {
    if (!decl) {
      console.error(`generate: bottom residual ${residual.bottom}px (${Math.round(100 * residual.bottom / cb.h)}% of the contentBox) exceeds the ${Math.round(100 * RESIDUAL_FLOOR)}% floor and the scenario declares no residual_disposition — declare it with a reason or choose a preset/variant that fills the page`);
      process.exit(1);
    }
    // A residual declaration is **the value that matches the measurement, not a maximum** — a
    // one-sided comparison would pass both a stale declaration and excessive content expansion.
    // The measurement differs per treatment, so the entries are per treatment too.
    const want = residualEntry(decl, tx, TS);
    if (want.error) { console.error(`generate: ${want.error}`); process.exit(1); }
    if (Math.abs(Number(want.bottom) - residual.bottom) > RESIDUAL_TOL) {
      console.error(`generate: declared residual_disposition.bottom ${want.bottom}px does not match the measured ${residual.bottom}px (tol ${RESIDUAL_TOL}px, treatment ${tx.name}${want.calibration ? ` + ${want.calibration}` : ""})`);
      process.exit(1);
    }
    appliedDisposition = { reason: decl.reason ?? null, treatment: tx.name,
      calibration: want.calibration ?? null, bottom: Number(want.bottom) };
  }
  const delivery = fontDelivery(opt("font-delivery"));
  const embedded = embedSubset(svg, delivery, tx.name);
  // Having chosen a treatment, the artifact must actually be that treatment. A changed name that
  // yields the same bytes as flat is not accepted as success (the same trap as a materialize
  // reporting `updated 0`).
  if (tx.name !== "flat") {
    const miss = [];
    if (!/data-treatment-paper="1"/.test(embedded.svg)) miss.push("paper surface");
    if (!new RegExp(`data-treatment-defs="${tx.name}"`).test(embedded.svg)) miss.push("treatment defs");
    for (const f of tx.filters) if (!embedded.svg.includes(`filter="url(#tx-${f.id})"`)) miss.push(`applied ${f.id} filter`);
    if (!/<feDisplacementMap/.test(embedded.svg)) miss.push("displacement map");
    if (delivery.mode === "portable" && embedded.faces?.some((f) => f.subsetDigest === undefined)) miss.push("subset-embedded face");
    if (miss.length) {
      console.error(`generate: treatment "${tx.name}" was selected but the artifact lacks ${miss.join(", ")} — a renamed flat render is not a treatment`);
      process.exit(1);
    }
  }
  const artifact = embedded.svg.replace(/[ \t]+$/gm, "");   // the digest covers the bytes actually written
  if (out) writeFileSync(out, artifact);
  const receipt = { ...base, status: "ok", artifact: out ? path.basename(out) : null,
    consumed: R.consumed, artifactDigest: sha(artifact),
    contentFlowBounds: { x: r1(fb.x), y: r1(fb.y), w: r1(fb.w), h: r1(fb.h) },
    fontDelivery: { mode: delivery.mode, grade: delivery.grade,
      policyDigest: delivery.policy.profile.digest, typographyProfileDigest: delivery.policy.typographyProfileDigest,
      alias: embedded.alias ?? null, glyphs: embedded.chars ?? 0, faces: embedded.faces,
      tool: embedded.tool ?? null, wrapperDigest: embedded.wrapperDigest ?? null, identity: embedded.identity ?? [] },
    treatment: { name: tx.name, mode: tx.mode, overlay: tx.overlay, displacementBound: displacementBound(tx) },
    routing: R.routing ?? null,
    matrix: R.matrix ?? null,
    timeline: R.timeline ?? null,
    residual, residualDisposition: appliedDisposition,
    provenance: provenance({ producer: { kind: "generator", generatorDigest: sha(readFileSync(fileURLToPath(import.meta.url))) },
      inputs: [{ role: "typepack-input", digest: inputDigest }] }) };
  writeFileSync(rcp, JSON.stringify(receipt, null, 1) + "\n");
  console.log(`generate ${tid}/${sc.id}/${loc} — ok, ${R.consumed.length} entities consumed`);
  process.exit(0);
}

// ---------- verify: payload ↔ receipt ↔ artifact 3-way ----------
function semanticIds(input, tid) {
  const ids = [];
  if (tid === "cards-kpi-grid") for (const c of input.cards ?? []) ids.push(c.id);
  if (tid === "process-flow") for (const st of input.steps ?? []) ids.push(st.id);
  if (tid === "layer-stack") for (const L of input.layers ?? []) { ids.push(L.id); for (const c of L.items ?? []) ids.push(c.id); }
  if (tid === "nested-scope") for (const rg of input.rings ?? []) ids.push(rg.id);
  if (tid === "before-after") { for (const p of input.panels ?? []) ids.push(p.id); for (const d of input.delta ?? []) ids.push(d.id); }
  if (tid === "decision-matrix") for (const c of input.cells ?? []) ids.push(c.id);
  // Only a phase is a semantic entity — the card, dot and marker are participants belonging to a phase and have no independent ID.
  if (tid === "roadmap-timeline") for (const p of input.phases ?? []) ids.push(p.id);
  if (tid === "approval-gate") {
    for (const nd of input.nodes ?? []) ids.push(nd.id);
    if (input.gate?.id) ids.push(input.gate.id);
  }
  if (tid === "topology-component") {
    for (const z of input.zones ?? []) { ids.push(z.id); for (const n of z.nodes ?? []) ids.push(n.id); }
    for (const e of input.edges ?? []) ids.push(e.id);
    if (input.boundary) ids.push("boundary");
  }
  return ids;
}
// The decision-matrix audit: **it does not trust the receipt** — it recomputes the expected layout
// from the original input and reads the axis geometry straight from the recorded paths. The axis is
// an ordinal direction, so ticks and numbers are not subjects of the check.
function auditMatrixAxes(svg, input, loc) {
  const errs = [], pl = deriveMatrixPlacement(input);
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) ?? [])[1];
  const numAttr = (s, k) => Number(attr(s, k));
  // --- 1. cell geometry: read straight from the artifact ---
  const cells = [];
  for (const m of svg.matchAll(/<g[^>]*data-entity="([^"]+)"[^>]*data-cell-x="([^"]*)"[^>]*data-cell-y="([^"]*)"[^>]*>\s*<rect([^>]*)\/>/g))
    cells.push({ id: m[1], x: m[2], y: m[3], rx: numAttr(m[4], "x"), ry: numAttr(m[4], "y"),
      rw: numAttr(m[4], "width"), rh: numAttr(m[4], "height") });
  if (cells.length !== pl.cells.length) {
    errs.push(`E-GEN-MATRIX artifact carries ${cells.length} placed cell(s) but the input declares ${pl.cells.length}`);
    return errs;
  }
  const expOf = (id) => pl.cells.find((p) => p.id === id);
  for (const c of cells) {
    const e = expOf(c.id);
    if (!e) { errs.push(`E-GEN-MATRIX artifact cell "${c.id}" is absent from the input`); continue; }
    if (c.x !== e.x || c.y !== e.y)
      errs.push(`E-GEN-MATRIX cell "${c.id}" carries axis values (${c.x}, ${c.y}) but the input declares (${e.x}, ${e.y})`);
  }
  if (errs.length) return errs;
  // Position is proven by **order**, not by coordinate constants — it holds with a blank cell present, and catches a flip.
  const sgn = (n) => (Math.abs(n) < 0.5 ? 0 : Math.sign(n));
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j], ea = expOf(a.id), eb = expOf(b.id);
    for (const [axis, want, got, unit] of [
      ["column", Math.sign(ea.col - eb.col), sgn(a.rx - b.rx), "x"],
      ["row", Math.sign(ea.row - eb.row), sgn(a.ry - b.ry), "y"],
    ]) if (want !== got)
      errs.push(`E-GEN-MATRIX-PLACE cells "${a.id}" (${ea.x}, ${ea.y}) and "${b.id}" (${eb.x}, ${eb.y}) must differ in ${axis} by ${want} but their drawn ${unit} differs by ${got} — the axis value decides the position, not the declaration order`);
  }
  // --- 2. axis geometry: presence, orientation, positive end ---
  const axisPaths = [...svg.matchAll(/<path([^>]*data-axis="[xy]"[^>]*)\/>/g)].map((m) => m[1]);
  const markers = [...svg.matchAll(/<path([^>]*data-axis-marker="[xy]"[^>]*)\/>/g)].map((m) => m[1]);
  for (const a of [...axisPaths, ...markers])
    if (/data-route-(id|from|to|kind)=/.test(a)) errs.push("E-GEN-AXIS an ordinal axis must not be classified as a connector (data-route-*)");
  for (const which of ["x", "y"]) {
    const line = axisPaths.filter((a) => attr(a, "data-axis") === which);
    const mk = markers.filter((a) => attr(a, "data-axis-marker") === which);
    if (line.length !== 1 || mk.length !== 1) {
      errs.push(`E-GEN-AXIS the ${which} axis must be drawn exactly once with one direction marker (found ${line.length} line(s), ${mk.length} marker(s))`);
      continue;
    }
    const d = attr(line[0], "d"), pts = [...d.matchAll(/-?[\d.]+/g)].map(Number);
    const orient = attr(line[0], "data-axis-orientation"), pos = attr(line[0], "data-axis-positive");
    const apex = [...attr(mk[0], "d").matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])[0];
    if (which === "y") {
      if (orient !== "vertical" || pts.length !== 3) { errs.push(`E-GEN-AXIS the y axis must be a single vertical run (orientation "${orient}")`); continue; }
      const [ax, y1, y2] = pts, top = Math.min(y1, y2), bot = Math.max(y1, y2);
      if (pos !== "up") errs.push(`E-GEN-AXIS the y axis declares positive "${pos}" — an ordinal y axis grows upward`);
      if (Math.abs(apex[1] - top) > 1 || Math.abs(apex[0] - ax) > 1)
        errs.push(`E-GEN-AXIS-DIR the y direction marker sits at ${r1(apex[1])} but the positive (up) end is ${r1(top)} — the marker must mark the high end`);
      if (ax >= Math.min(...cells.map((c) => c.rx)) - 1) errs.push("E-GEN-AXIS the y axis intrudes into the grid — it must be drawn outside the cells");
      if (bot < Math.max(...cells.map((c) => c.ry + c.rh)) - 1) errs.push("E-GEN-AXIS the y axis does not span the grid it labels");
    } else {
      if (orient !== "horizontal" || pts.length !== 3) { errs.push(`E-GEN-AXIS the x axis must be a single horizontal run (orientation "${orient}")`); continue; }
      const [x1, ay, x2] = pts, right = Math.max(x1, x2);
      if (pos !== "right") errs.push(`E-GEN-AXIS the x axis declares positive "${pos}" — an ordinal x axis grows rightward`);
      if (Math.abs(apex[0] - right) > 1 || Math.abs(apex[1] - ay) > 1)
        errs.push(`E-GEN-AXIS-DIR the x direction marker sits at ${r1(apex[0])} but the positive (right) end is ${r1(right)} — the marker must mark the high end`);
      if (ay <= Math.max(...cells.map((c) => c.ry + c.rh)) + 1) errs.push("E-GEN-AXIS the x axis intrudes into the grid — it must be drawn outside the cells");
    }
  }
  // --- 3. whether the endpoint labels mean the same as the actual direction ---
  const ends = new Map();
  for (const m of svg.matchAll(/<text([^>]*data-axis-end="([^"]+)"[^>]*)>([^<]*)</g))
    ends.set(m[2], { x: numAttr(m[1], "x"), y: numAttr(m[1], "y"), text: m[3] });
  for (const k of ["y:high", "y:low", "x:high", "x:low"]) if (!ends.has(k)) errs.push(`E-GEN-AXIS endpoint label "${k}" is missing — both ends of both axes must be labelled`);
  if (ends.size === 4) {
    if (!(ends.get("y:high").y < ends.get("y:low").y))
      errs.push("E-GEN-AXIS-DIR the y high label is not above the low label — the label order contradicts the axis direction");
    if (!(ends.get("x:high").x > ends.get("x:low").x))
      errs.push("E-GEN-AXIS-DIR the x high label is not right of the low label — the label order contradicts the axis direction");
    for (const [k, tiers] of [["y", pl.yTiers], ["x", pl.xTiers]])
      for (const [end, t] of [["high", tiers.at(-1)], ["low", tiers[0]]]) {
        const want = esc(String(t.label[loc]));
        if (ends.get(`${k}:${end}`).text !== want)
          errs.push(`E-GEN-AXIS the ${k} ${end} label reads "${ends.get(`${k}:${end}`).text}" but the ${end} tier of that axis is "${want}"`);
      }
  }
  return errs;
}
// The roadmap-timeline audit: rather than taking the receipt as the answer, it **recomputes from
// the input and the preset** and compares against the recorded SVG coordinates. The axis is
// ordinal, so ticks and numbers are not subjects of the check.
function auditTimeline(svg, input, rcp, tp) {
  const errs = [];
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) ?? [])[1];
  const num = (s, k) => Number(attr(s, k));
  // There is no date domain in this type (C-01) — an input bringing one is refused.
  const dateish = ["date", "start", "end", "duration", "dates"];
  for (const p of input.phases ?? [])
    for (const k of dateish) if (k in p) errs.push(`E-TL-DOMAIN phase "${p.id}" carries "${k}" — this TypePack spaces phases evenly and makes no proportional-duration claim`);
  // Expected geometry: recomputed from the preset contentBox and the input.
  const pf = spawnJson([skinCli, "pageframe", rcp.preset, "--json"], "skin.mjs pageframe");
  const cb = pf.regions.contentBox;
  const g = timelineGeometry(input, cb, tp);
  const dots = [...svg.matchAll(/<g[^>]*data-entity="([^"]+)"[^>]*data-phase-status="([^"]*)"[^>]*data-phase-index="(\d+)"[^>]*>([\s\S]*?)<\/g>/g)]
    .map((m) => ({ id: m[1], status: m[2], index: Number(m[3]), block: m[4], at: m.index }));
  if (dots.length !== (input.phases ?? []).length) {
    errs.push(`E-TL-PHASE artifact carries ${dots.length} phase group(s) but the input declares ${input.phases.length}`);
    return errs;
  }
  const firstCircle = (b) => (b.match(/<circle[^>]*data-dot-status="[^"]*"[^>]*\/>/) ?? [])[0] ?? "";
  dots.forEach((d, i) => {
    const want = input.phases[i];
    if (d.id !== want.id || d.index !== i)
      errs.push(`E-TL-ORDER artifact phase #${i} is "${d.id}"(index ${d.index}) but the input declares "${want.id}" — declaration order is the reading order`);
    if (d.status !== want.status) errs.push(`E-TL-PHASE "${d.id}" status "${d.status}" != input "${want.status}"`);
    const c = firstCircle(d.block);
    const cx = num(c, "cx");
    if (Math.abs(cx - g.xs[i]) > 0.5)
      errs.push(`E-TL-POSITION "${d.id}" sits at x=${r1(cx)} but the even interval recomputed from the input puts it at ${r1(g.xs[i])} — the interval is computed, never widened by label`);
    // Status must be distinguishable by **shape** as well as colour — this checks that the ring is actually visible.
    const dr = num(c, "r"), fillRole = attr(c, "data-fill-role");
    const ring = (d.block.match(/<circle[^>]*data-dot-ring="current"[^>]*\/>/) ?? [])[0];
    const underlay = (d.block.match(/<circle[^>]*data-dot-underlay="[^"]*"[^>]*\/>/) ?? [])[0];
    // A state marker must be opaque — left empty, the axis rail behind shows through.
    if (attr(c, "fill") === "none")
      errs.push(`E-TL-SHAPE "${d.id}" dot has no fill — the axis rail shows through and the marker reads as sitting behind the line`);
    if (want.status === "future") {
      // future is an "empty circle" but not a **transparent** one: it is filled with the background role and given an outline.
      if (fillRole !== "canvas") errs.push(`E-TL-SHAPE "${d.id}" is future so its dot must be filled with the background role (got "${fillRole ?? "none"}")`);
      if (!attr(c, "data-stroke-role")) errs.push(`E-TL-SHAPE "${d.id}" is future but carries no outline`);
    } else if (fillRole === "canvas") {
      errs.push(`E-TL-SHAPE "${d.id}" is ${want.status} but its dot is filled with the background role — it would read as future`);
    }
    if (!underlay) errs.push(`E-TL-SHAPE "${d.id}" carries no background underlay — the axis rail must be hidden under the whole marker`);
    else {
      const ur = num(underlay, "r"), needR = want.status === "current" ? dr + 4 : dr;
      if (attr(underlay, "data-fill-role") !== "canvas") errs.push(`E-TL-SHAPE "${d.id}" underlay must use the background role, not a hardcoded colour`);
      if (!(ur >= needR - 0.01)) errs.push(`E-TL-SHAPE "${d.id}" underlay radius ${ur} does not cover the marker (needs ${r1(needR)})`);
      if (Math.abs(num(underlay, "cx") - cx) > 0.5) errs.push(`E-TL-SHAPE "${d.id}" underlay is not centred on its dot`);
    }
    if (want.status === "current") {
      if (!ring) errs.push(`E-TL-SHAPE "${d.id}" is current but carries no ring — done and current would differ by colour alone`);
      else {
        const rr = num(ring, "r"), rs = num(ring, "stroke-width");
        if (Math.abs(num(ring, "cx") - cx) > 0.5 || Math.abs(num(ring, "cy") - num(c, "cy")) > 0.5)
          errs.push(`E-TL-SHAPE "${d.id}" ring is not concentric with its dot`);
        if (!(rr >= dr + 4)) errs.push(`E-TL-SHAPE "${d.id}" ring radius ${rr} leaves no visible gap over the ${dr}px dot (floor ${dr + 4})`);
        if (!(rs >= 1.2)) errs.push(`E-TL-SHAPE "${d.id}" ring stroke ${rs} is below the visible floor 1.2`);
        if (attr(ring, "fill") !== "none") errs.push(`E-TL-SHAPE "${d.id}" ring must not be filled`);
      }
    } else if (ring) errs.push(`E-TL-SHAPE "${d.id}" is ${want.status} but carries the current ring`);
  });
  if (errs.length) return errs;
  // x must increase monotonically left to right (checked together with the DOM order).
  for (let i = 1; i < dots.length; i++) {
    const a = num(firstCircle(dots[i - 1].block), "cx"), b = num(firstCircle(dots[i].block), "cx");
    if (!(b > a)) errs.push(`E-TL-ORDER phase #${i} is not right of #${i - 1} — later must read as further right`);
    if (!(dots[i].at > dots[i - 1].at)) errs.push(`E-TL-ORDER DOM order does not follow the declared phase order`);
  }
  // The axis: exactly one, horizontal, spanning the first and last dots.
  const axes = [...svg.matchAll(/<rect[^>]*data-axis="x"[^>]*\/>/g)].map((m) => m[0]);
  if (axes.length !== 1) errs.push(`E-TL-AXIS the ordinal axis must be drawn exactly once (found ${axes.length})`);
  else {
    const ax = axes[0], x0 = num(ax, "x"), w = num(ax, "width");
    if (attr(ax, "data-axis-orientation") !== "horizontal" || attr(ax, "data-axis-positive") !== "right")
      errs.push("E-TL-AXIS the ordinal axis must be horizontal with positive to the right");
    if (!(x0 <= g.xs[0] && x0 + w >= g.xs.at(-1)))
      errs.push(`E-TL-AXIS the axis spans ${r1(x0)}–${r1(x0 + w)} and does not contain the first/last phase (${r1(g.xs[0])}, ${r1(g.xs.at(-1))})`);
    if (/data-route-(id|from|to|kind)=/.test(ax)) errs.push("E-TL-AXIS an ordinal axis must not be classified as a connector");
    // Paint order is DOM order: axis -> underlay -> dot/ring -> label.
    const axAt = svg.indexOf(ax);
    const firstMarker = svg.search(/<circle[^>]*data-dot-(underlay|status)=/);
    if (axAt > firstMarker)
      errs.push("E-TL-LAYER the axis is painted after a state marker — the rail must sit behind every dot");
  }
  // marker: the input states its position, and the **whole** thing, pill included, intrudes on nothing.
  const stem = (svg.match(/<path[^>]*data-marker-stem="now"[^>]*\/>/) ?? [])[0];
  const pill = (svg.match(/<rect[^>]*data-marker-pill="now"[^>]*\/>/) ?? [])[0];
  if (!input.now_marker) {
    if (stem || pill) errs.push("E-TL-MARKER the artifact draws a now marker the input does not declare");
  } else if (!stem || !pill) {
    errs.push("E-TL-MARKER the input declares a now_marker but the artifact does not draw it — a declared label must be consumed, not hidden");
  } else {
    const mx = Number((attr(stem, "d").match(/M([\d.-]+)/) ?? [])[1]);
    if (Math.abs(mx - g.markerX) > 0.5)
      errs.push(`E-TL-MARKER the marker sits at x=${r1(mx)} but after_phase "${input.now_marker.after_phase}" recomputed from the input puts it at ${r1(g.markerX)}`);
    const mb = { x: num(pill, "x"), y: num(pill, "y"), w: num(pill, "width"), h: num(pill, "height") };
    const hit = (b) => !(mb.x + mb.w <= b.x || b.x + b.w <= mb.x || mb.y + mb.h <= b.y || b.y + b.h <= mb.y);
    for (const m of svg.matchAll(/<rect[^>]*data-phase-card="([^"]+)"[^>]*\/>/g)) {
      const b = { x: num(m[0], "x"), y: num(m[0], "y"), w: num(m[0], "width"), h: num(m[0], "height") };
      if (hit(b)) errs.push(`E-TL-MARKER the marker pill overlaps milestone card "${m[1]}" — the marker crosses the axis, never a card`);
    }
    for (const m of svg.matchAll(/<text[^>]*data-phase-label="([^"]+)"[^>]*>/g)) {
      const lx = num(m[0], "x"), ly = num(m[0], "y");
      if (lx >= mb.x && lx <= mb.x + mb.w && ly >= mb.y - 8 && ly <= mb.y + mb.h + 8)
        errs.push(`E-TL-MARKER the marker pill covers phase label "${m[1]}"`);
    }
    if (mb.x < cb.x || mb.x + mb.w > cb.x + cb.w) errs.push("E-TL-MARKER the marker pill leaves the content box");
  }
  // Whether the outermost card sits inside the content box is re-measured on the final SVG (measured, not predicted).
  const cards = [...svg.matchAll(/<rect[^>]*data-phase-card="([^"]+)"[^>]*\/>/g)]
    .map((m) => ({ id: m[1], x: num(m[0], "x"), w: num(m[0], "width") }));
  for (const c of cards)
    if (c.x < cb.x - 0.5 || c.x + c.w > cb.x + cb.w + 0.5)
      errs.push(`E-TL-CONTAIN milestone card "${c.id}" spans ${r1(c.x)}–${r1(c.x + c.w)} outside the content box ${cb.x}–${cb.x + cb.w}`);
  // The receipt is something to check against, not the answer.
  for (const e of validateTimelineReceiptV1(rcp.timeline, { phaseCount: input.phases.length, hasMarker: Boolean(input.now_marker) })) errs.push(e);
  if (rcp.timeline?.phases) rcp.timeline.phases.forEach((p, i) => {
    if (typeof p.x === "number" && Math.abs(p.x - g.xs[i]) > 0.5)
      errs.push(`E-TL-SCHEMA receipt phase "${p.id}" x=${p.x} != ${r1(g.xs[i])} recomputed from the input`);
  });
  if (rcp.timeline?.marker && g.markerX != null && Math.abs(rcp.timeline.marker.x - g.markerX) > 0.5)
    errs.push(`E-TL-SCHEMA receipt marker x=${rcp.timeline.marker.x} != ${r1(g.markerX)} recomputed from the input`);
  return errs;
}

// The treatment audit: a rough stroke is **displaced outside** the geometric bounds, so looking at
// the declared coordinates alone would miss it crossing the boundary. The check includes the
// displacement amplitude and the filter region.
function auditTreatment(svg, rcp) {
  const errs = [];
  const t = rcp.treatment;
  if (!t) { errs.push("E-TX-RECEIPT receipt carries no treatment block"); return errs; }
  const declared = /<defs data-treatment-defs="([a-z]+)"/.exec(svg);
  const paper = /data-treatment-paper="1"/.test(svg);
  if (t.name === "flat") {
    if (declared || paper) errs.push("E-TX-FLAT the receipt says flat but the artifact carries treatment surfaces");
    return errs;
  }
  if (!declared || declared[1] !== t.name)
    errs.push(`E-TX-STRUCT the artifact does not declare the "${t.name}" treatment defs`);
  if (!paper) errs.push("E-TX-STRUCT the artifact has no treatment paper surface");
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) { errs.push("E-TX-STRUCT viewBox is unreadable"); return errs; }
  const W = Number(vb[1]), H = Number(vb[2]);
  const d = Number(t.displacementBound ?? 0);
  if (!(d > 0)) errs.push("E-TX-STRUCT a surface treatment must declare a positive displacement bound");
  // The filter region must cover the whole canvas — a narrow region collapses on straight runs and clips the stroke.
  for (const m of svg.matchAll(/<filter id="tx-([a-z-]+)"([^>]*)>/g)) {
    const a = (k) => Number((m[2].match(new RegExp(`\\b${k}="([\\d.-]+)"`)) ?? [])[1]);
    if (!/filterUnits="userSpaceOnUse"/.test(m[2]))
      errs.push(`E-TX-REGION filter "${m[1]}" must use userSpaceOnUse (percentage regions collapse on straight strokes)`);
    if (a("x") !== 0 || a("y") !== 0 || a("width") < W || a("height") < H)
      errs.push(`E-TX-REGION filter "${m[1]}" region ${a("width")}×${a("height")} at ${a("x")},${a("y")} does not cover the ${W}×${H} canvas — displaced strokes would be clipped`);
  }
  // Only layers the filter is actually applied to are subject to displacement.
  const filtered = new Set([...svg.matchAll(/<g data-layer="([a-z]+)"[^>]*filter="url\(#tx-[a-z-]+\)"/g)].map((m) => m[1]));
  if (!filtered.size) errs.push("E-TX-STRUCT no layer carries the treatment filter");
  // Whether a rough stroke crosses the canvas boundary: the declared geometry plus the displacement.
  const rects = [...svg.matchAll(/<rect[^>]*\/>/g)].map((m) => m[0])
    .filter((r) => !/data-treatment-paper|data-fill-role="canvas"/.test(r));
  for (const r of rects) {
    const n = (k) => Number((r.match(new RegExp(`\\b${k}="([\\d.-]+)"`)) ?? [])[1]);
    const x = n("x"), y = n("y"), w = n("width"), h = n("height");
    if (![x, y, w, h].every(Number.isFinite)) continue;
    const sw = Number((r.match(/stroke-width="([\d.]+)"/) ?? [])[1] ?? 0) / 2;
    if (x - sw - d < 0 || y - sw - d < 0 || x + w + sw + d > W || y + h + sw + d > H)
      errs.push(`E-TX-CONTAIN a surface at ${r1(x)},${r1(y)} ${r1(w)}×${r1(h)} leaves the canvas once the ${d}px rough displacement is applied`);
  }
  // Fonts: an implicit fallback surviving in portable breaks the claim of not depending on an installed font.
  if (rcp.fontDelivery?.mode === "portable") {
    if (!(rcp.fontDelivery.faces ?? []).length) errs.push("E-TX-FONT portable sketch must embed at least one subset face");
    const css = /<style>([\s\S]*?)<\/style>/.exec(svg);
    if (!css || !/@font-face/.test(css[1])) errs.push("E-TX-FONT the artifact carries no embedded @font-face");
    const stack = (/style="font-family:([^"]*)"/.exec(svg) ?? [])[1] ?? "";
    if (!stack.startsWith(`'${rcp.fontDelivery.alias}'`))
      errs.push(`E-TX-FONT the embedded alias must lead the font stack (got "${stack.slice(0, 48)}")`);
  }
  return errs;
}

// The allowed-port-interval audit: rather than taking the receipt as the answer, it recomputes the
// interval from the **artifact's layout metrics** (label bounds, node bounds, route constants) and
// compares.
function auditPortIntervals(svg, rcp) {
  const errs = [];
  const pc = rcp.routing?.portConstraints ?? [];
  if (!pc.length) return errs;
  const K = ROUTE_DEFAULTS;
  const num = (t, k) => Number((t.match(new RegExp(`\\b${k}="([\\d.-]+)"`)) ?? [])[1]);
  const nodes = new Map();
  for (const m of svg.matchAll(/<rect[^>]*data-entity="([^"]+)"[^>]*\/>/g))
    nodes.set(m[1], { x: num(m[0], "x"), y: num(m[0], "y"), w: num(m[0], "width"), h: num(m[0], "height") });
  for (const m of svg.matchAll(/<g[^>]*data-entity="([^"]+)"[^>]*>\s*<rect([^>]*)\/>/g))
    if (!nodes.has(m[1])) nodes.set(m[1], { x: num(m[2], "x"), y: num(m[2], "y"), w: num(m[2], "width"), h: num(m[2], "height") });
  const labels = [...svg.matchAll(/data-label-bounds="([\d.,-]+)"/g)]
    .map((m) => m[1].split(",").map(Number)).map(([x, y, w, h]) => ({ x, y, w, h }));
  for (const c of pc) {
    const n = nodes.get(c.node);
    if (!n) { errs.push(`E-PORT-INTERVAL constraint names node "${c.node}" which is absent from the artifact`); continue; }
    // Find the label covering this node and rebuild the interval with the same formula the layout used.
    const over = labels.filter((l) => l.y <= n.y && l.x < n.x + n.w && l.x + l.w > n.x);
    const right = over.length ? Math.max(...over.map((l) => l.x + l.w)) : -Infinity;
    // It uses the **same formula** as the layout — the spacing between line and label is enforced by the router.
    const lo = r1(Math.max(n.x + K.portInset, right === -Infinity ? -Infinity : right));
    const hi = r1(n.x + n.w - K.portInset);
    if (Math.abs(lo - Number(c.allowed.lo)) > 0.5 || Math.abs(hi - Number(c.allowed.hi)) > 0.5)
      errs.push(`E-PORT-INTERVAL edge "${c.edge}" declares [${c.allowed.lo}, ${c.allowed.hi}] but the layout metric recomputes [${lo}, ${hi}]`);
    if (!(Number(c.allowed.lo) >= n.x + K.portInset - 0.5 && Number(c.allowed.hi) <= n.x + n.w - K.portInset + 0.5))
      errs.push(`E-PORT-INTERVAL edge "${c.edge}" interval leaves the port range of node "${c.node}"`);
    // Whether the chosen port lies within the interval — re-measured from the recorded path.
    const rt = (rcp.routing.routes ?? []).find((r) => r.id === c.edge);
    // Match the coordinate d only — another attribute such as data-route-kind matching first would give NaN.
    const d = (svg.match(new RegExp(`data-route-id="${c.edge}"[^>]*?\\sd="(M[^"]+)"`)) ?? [])[1];
    if (d) {
      const pts = [...d.matchAll(/-?[\d.]+/g)].map(Number);
      const endX = pts.at(-2);
      if (!(endX >= Number(c.allowed.lo) - 0.5 && endX <= Number(c.allowed.hi) + 0.5))
        errs.push(`E-PORT-INTERVAL edge "${c.edge}" attaches at x=${r1(endX)}, outside its allowed interval [${c.allowed.lo}, ${c.allowed.hi}]`);
    }
    void rt;
  }
  return errs;
}


// Looking up a residual declaration: a missing treatment (plus calibration) entry, or a differing
// ID, is **fail-closed**. Passing without an entry would reopen "undeclared dead space".
function residualEntry(decl, tx, TS) {
  const calId = TS.calibration?.id ?? null;
  if (Array.isArray(decl.by_treatment)) {
    const hit = decl.by_treatment.find((e) => e.treatment === tx.name
      && (e.calibration === undefined ? calId === null : e.calibration === calId));
    if (!hit) return { error: `residual_disposition declares no entry for treatment "${tx.name}"${calId ? ` + calibration "${calId}"` : ""} — declare the measured value instead of reusing another treatment's` };
    if (!Number.isFinite(Number(hit.bottom))) return { error: `residual_disposition entry for "${tx.name}" has no numeric bottom` };
    return { bottom: hit.bottom, calibration: hit.calibration ?? null };
  }
  // A single declaration is for flat only — using it with a treatment on would disagree with the measurement.
  if (tx.name !== "flat") return { error: `residual_disposition is declared once (flat only) but treatment "${tx.name}" is active — declare it per treatment with by_treatment` };
  // The by_treatment branch checks this; without the same check here a declaration whose entries
  // were emptied falls through to an undefined bottom, and `Math.abs(NaN - measured) > tol` is
  // false — so a malformed declaration would pass the gate by accident.
  if (!Number.isFinite(Number(decl.bottom)))
    return { error: `residual_disposition declares no entry for treatment "${tx.name}" with a numeric bottom` };
  return { bottom: decl.bottom, calibration: null };
}

function verify(argv) {
  const opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const rcpP = opt("receipt"), svgP = opt("svg"), pairP = opt("pair");
  if (!rcpP) { console.error("usage: generate.mjs verify --receipt <json> [--svg <svg>] [--pair <receipt>]"); process.exit(2); }
  const rcp = JSON.parse(readFileSync(rcpP, "utf8"));
  const errors = [];
  const { input, inputDigest, tp: caseTp } = loadCase(rcp.typepack, String(rcp.case).replace(`${rcp.typepack}-`, ""));
  if (rcp.inputDigest !== inputDigest) errors.push(`E-GEN-INPUT receipt inputDigest != recomputed (${inputDigest.slice(0, 20)}…)`);
  if (rcp.geometry !== rcp.geometryExpected) errors.push(`E-GEN-GEOMETRY receipt geometry "${rcp.geometry}" != declared "${rcp.geometryExpected}"`);
  if (rcp.routingExpected) {
    const routed = rcp.status === "needs-split" && rcp.routing ? "needs-split" : "routable";
    if (routed !== rcp.routingExpected) errors.push(`E-GEN-ROUTING routing outcome "${routed}" != declared "${rcp.routingExpected}"`);
  }
  const ids = semanticIds(input, rcp.typepack);
  if (rcp.status === "needs-split") {
    if (rcp.artifact !== null || (rcp.consumed ?? []).length) errors.push("E-GEN-DEGRADE needs-split must not claim an artifact");
    if (!rcp.degrade?.reason || !rcp.degrade?.ladder) errors.push("E-GEN-DEGRADE degrade receipt requires reason + ladder");
  } else {
    const missing = ids.filter((i) => !(rcp.consumed ?? []).includes(i));
    if (missing.length) errors.push(`E-GEN-CONSUME receipt drops ${missing.length} semantic id(s): ${missing.slice(0, 5).join(", ")}`);
    const extra = (rcp.consumed ?? []).filter((i) => !ids.includes(i));
    if (extra.length) errors.push(`E-GEN-INVENT receipt claims ${extra.length} entity id(s) absent from the input: ${extra.slice(0, 5).join(", ")}`);
    if (svgP) {
      const svg = readFileSync(svgP, "utf8");
      if (sha(svg) !== rcp.artifactDigest) errors.push("E-GEN-ARTIFACT artifact digest != receipt");
      const inSvg = new Set([...svg.matchAll(/data-entity="([^"]+)"/g)].map((m) => m[1]));
      for (const i of ids) if (!inSvg.has(i)) errors.push(`E-GEN-CONSUME artifact is missing entity "${i}"`);
      for (const i of inSvg) if (!ids.includes(i) && i !== "legend") errors.push(`E-GEN-INVENT artifact carries invented entity "${i}"`);
      // The alignment inventory does not trust the artifact either — it is re-derived from the original input and compared.
      const expectedInv = serializeAlignInventory(deriveAlignInventory(rcp.typepack, input, { cols: rcp.cols ?? undefined }));
      const gotInv = (svg.match(/data-align-inventory="([^"]*)"/) ?? [])[1];
      if (expectedInv && gotInv === undefined)
        errors.push("E-GEN-ALIGN artifact declares no alignment inventory but the input implies one");
      else if (expectedInv !== (gotInv ?? ""))
        errors.push(`E-GEN-ALIGN alignment inventory recomputed from the input does not match the artifact\n    input:    ${expectedInv}\n    artifact: ${gotInv ?? "(none)"}`);
      if (rcp.typepack === "decision-matrix") for (const e of auditMatrixAxes(svg, input, rcp.locale)) errors.push(e);
      if (rcp.typepack === "roadmap-timeline") for (const e of auditTimeline(svg, input, rcp, caseTp)) errors.push(e);
      for (const e of auditTreatment(svg, rcp)) errors.push(e);
      for (const e of auditPortIntervals(svg, rcp)) errors.push(e);
      // The residual likewise does not take the receipt as the answer — it is re-measured from the final contentFlowBounds and contentBox.
      if (rcp.contentFlowBounds && rcp.contentBox) {
        const cbY = rcp.contentFlowBounds.y - (rcp.residual?.top ?? 0);
        const recomputed = r1(cbY + rcp.contentBox.h - (rcp.contentFlowBounds.y + rcp.contentFlowBounds.h));
        if (Math.abs(recomputed - Number(rcp.residual?.bottom ?? NaN)) > 0.5)
          errors.push(`E-GEN-RESIDUAL receipt residual.bottom ${rcp.residual?.bottom} != ${recomputed} recomputed from contentFlowBounds and contentBox`);
      }
      // The routing is re-measured from the artifact — the recorded paths, not the receipt, are the evidence
      const audit = auditTopology(svg);
      for (const e of audit.errors) errors.push(`E-GEN-ROUTE ${e}`);
      for (const n of audit.notes) console.error(`  note: ${n}`);
    }
  }
  if (pairP) {
    const other = JSON.parse(readFileSync(pairP, "utf8"));
    if (other.locale === rcp.locale) errors.push("E-GEN-PAIR pair receipt must be the other locale");
    const a = [...(rcp.consumed ?? [])].sort().join(","), b = [...(other.consumed ?? [])].sort().join(",");
    if (a !== b) errors.push("E-GEN-PAIR KO/EN consumed entity id sets differ — both locales must carry the same topology");
    if (rcp.geometry !== other.geometry) errors.push("E-GEN-PAIR KO/EN geometry decisions differ");
  }
  const out = { schemaVersion: 1, command: "generate-verify", file: path.basename(rcpP), errors };
  if (argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
  else console.log(`generate-verify ${rcp.typepack}/${rcp.case}/${rcp.locale} — ${errors.length} error(s)`);
  for (const e of errors) console.error(`  ERROR ${e}`);
  process.exit(errors.length ? 1 : 0);
}

preflight({ entrypointUrl: import.meta.url });
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "build") build(rest);
else if (cmd === "verify") verify(rest);
else { console.error("usage: generate.mjs build|verify ..."); process.exit(2); }
