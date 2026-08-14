#!/usr/bin/env node
// generate.mjs — TypePack 입력(payload)에서 artifact를 생성한다 (Wave 1 CP2B canary).
//
// 계약: generator는 **입력 payload만 소비**하고 내용을 발명하지 않는다. 그것을 말이 아니라
// 증거로 남기기 위해
//   1) 산출물의 모든 entity에 payload의 semantic ID를 `data-entity`로 심고,
//   2) receipt에 consumed entity ID 전량과 input digest를 기록하며,
//   3) verify가 payload ↔ receipt ↔ artifact 세 곳을 대조한다.
// geometry가 needs-split인 입력은 **렌더 성공으로 처리하지 않는다** — degrade receipt를
// 쓰고 non-success(exit 3)로 끝난다.
//
// usage:
//   node generate.mjs build  --typepack <id> --case <case> --locale ko|en --out <svg> --receipt <json>
//   node generate.mjs verify --receipt <json> [--svg <svg>] [--pair <other-locale-receipt>]
// exit: 0 ok · 1 error · 2 usage · 3 needs-split(비성공, degrade receipt 기록) · 7 preflight
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preflight, guardPackagePath, provenance, SKILL_LOCATOR } from "./preflight-lib.mjs";
import { parseYaml, derivePanelFloor, deriveAlignInventory, serializeAlignInventory, deriveMatrixPlacement } from "./skin.mjs";
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

// ---------- 공통: manifest entry + 입력 시나리오 ----------
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

// geometry 판정은 manifest fit params에서 계산한다(문서 상수 재복사 금지)
function computeFit(tp, sc) {
  const prm = tp.fit.params;
  // 같은 구성의 footprint가 선언한 extra(축 라벨 등)를 함께 반영한다 — validator와 같은 수치를 쓴다.
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
    // 동심은 ring마다 사방으로 같은 inset이 들어간다(manifest validator와 동일한 식).
    // label은 그 위쪽 inset 띠 안에 앉는다 — 별도 strip을 더하지 않는다.
    const inset = Number(prm.inset);
    return { w: iw + 2 * (n - 1) * inset, h: ih + 2 * (n - 1) * inset };
  }
  console.error(`generate: unsupported layout "${sc.layout}"`); process.exit(1);
}

// ---------- header (design-kernel §6: computed title-keyline default) ----------
function header(pf, title, eyebrow, subtitle, contentTop) {
  const hs = pf.headerScale, kl = hs.keyline, hr = pf.regions.headerRegion;
  // PageFrame은 header cluster의 행 baseline을 공개하지 않으므로 headerRegion을 채우도록 파생한다.
  const x = hr.x + kl.width + kl.gap;
  // 세 행을 headerRegion 안에 분배한다: eyebrow · (H1 line-box = keyline) · subtitle.
  // keyline은 H1 line-box에서만 파생하므로 eyebrow/subtitle과 겹치지 않게 gap을 계산한다.
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
const ICON_PATH = {   // bundled line-icon set (단순 기하 — palette role만 사용)
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
// 줄바꿈은 lint와 같은 추정기로 계산한다 — generator와 guard가 다른 자를 쓰면
// "생성은 됐는데 검사에서 떨어지는" 상태가 반복된다. 허용 줄 수를 넘으면 오류다.
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

// ---------- TypePack renderers (payload만 소비) ----------
function renderCards(input, loc, cb, sc, tp) {
  const cards = input.cards, n = cards.length;
  const cols = sc.layout === "grid" ? Number(sc.cols) : n, rows = Math.ceil(n / cols);
  const gx = 16, gy = 16;
  // grid는 contentBox 경계에 붙지 않는다 — 마지막 행 테두리가 경계에 닿으면 시각적으로 잘린 판으로 읽힌다
  const gw = cb.w, gh = cb.h;
  const w = (gw - (cols - 1) * gx) / cols;
  const padY = 22, itemMinH = Number(tp.fit?.params?.itemMinH ?? 0) || 0;
  const layFor = (lc) => cards.map((c, i) => {
    const hasIcon = c.icon !== undefined;
    const textX = (i % cols) * 0 + (hasIcon ? 62 : 20);   // 카드 로컬 좌표
    const maxW = w - 16 - textX;
    const t = wrapLines(c.title[lc], maxW, 15, true, 2);
    const b = c.body ? wrapLines(c.body[lc], maxW, 12.5, false, 2) : { lines: [], overflow: false };
    if (t.overflow || b.overflow) { console.error(`generate: card "${c.id}" copy exceeds the §2 line budget at this layout (${lc})`); process.exit(1); }
    return { c, hasIcon, textX, t, b, block: t.lines.length * 19 + b.lines.length * 16 };
  });
  const laid = layFor(loc);
  // 기하는 locale에 대해 안정적이어야 한다 — KO/EN이 같은 판형으로 읽히도록
  // 카드 높이는 두 locale 중 더 긴 쪽에서 파생한다.
  const laidAll = ["ko", "en"].map(layFor);
  // 카드 높이는 가장 긴 카드의 내용 + breathing에서 파생하고, 선언된 floor를 하한으로 둔다.
  const contentH = Math.max(...laidAll.flat().map((l) => Math.max(l.block, l.hasIcon ? 34 : 0)));
  const h = Math.max(itemMinH, contentH + 2 * padY);
  const body = [], consumed = [];
  // layout guard가 무증명 통과하지 않도록 행 group을 선언한다 — 0 group은 green이 아니다
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

function renderTopology(input, loc, cb, sc, tp, degradeLevel = 0) {
  const zones = input.zones, nz = zones.length;
  const pad = 12, band = 22;
  const K = ROUTE_DEFAULTS;

  // 1) 배선 수요를 먼저 묻는다 — 배치가 먼저 굳으면 선은 결국 관통하거나 겹친다.
  const nodeZone = new Map(), nodeIndex = new Map();
  zones.forEach((z) => (z.nodes ?? []).forEach((nd, i) => { nodeZone.set(nd.id, z.id); nodeIndex.set(nd.id, i); }));
  const edgesIn = (input.edges ?? []).map((e) => ({
    id: e.id, from: e.from, to: e.to,
    dashed: e.delivery === "async" || e.visibility === "private",
    weight: e.kind === "request" ? "primary" : "secondary",
  }));
  // 배치는 primary edge가 직선으로 이어지도록 행 안에서 slot 순서를 먼저 맞춘다.
  const aligned = alignRows({ zoneOrder: zones.map((z) => z.id), nodeZone,
    nodeOrder: new Map(zones.map((z) => [z.id, (z.nodes ?? []).map((n) => n.id)])), edges: edgesIn });
  const nodeById = new Map();
  for (const z of zones) for (const nd of z.nodes ?? []) nodeById.set(nd.id, nd);
  const rowOf = (z) => (aligned.order.get(z.id) ?? (z.nodes ?? []).map((n) => n.id)).map((id) => nodeById.get(id));
  for (const z of zones) (z.nodes ?? []).forEach((nd, i) => nodeIndex.set(nd.id, rowOf(z).findIndex((x) => x.id === nd.id)));
  const plan = planChannels({ zoneOrder: zones.map((z) => z.id), nodeZone, nodeIndex, edges: edgesIn });

  // 2) 배치는 그 수요를 반영해 넓어진다: side channel은 폭에서, corridor lane은 높이에서 빠진다.
  const chL = plan.channelWidth("left"), chR = plan.channelWidth("right");
  const zoneX = cb.x + chL, zoneW = cb.w - chL - chR;
  const corridors = [];
  for (let i = 0; i + 1 < nz; i++) corridors.push(plan.corridorHeight(i));
  const corridorTotal = corridors.reduce((a, b) => a + b, 0);
  const intraH = (zid) => (plan.intraLanes.get(zid) ?? 0) * K.laneGap;
  const maxIntra = Math.max(0, ...zones.map((z) => intraH(z.id)));
  const nodeH = Math.min(96, (cb.h - corridorTotal - nz * (band + 2 * pad + maxIntra)) / nz);
  const zoneH = (zid) => band + 2 * pad + nodeH + intraH(zid);

  // 간격은 전 행에 하나만 쓴다 — 행마다 다르면 같은 slot이라도 column이 어긋나 직선이 깨진다.
  const nodeGap = Math.max(...zones.map((z) => plan.nodeGap(z.id)));
  const containers = [], connectors = [], nodeArt = [], consumed = [], nodeBox = {}, zoneBoxes = [];
  let zy = cb.y;
  zones.forEach((z, zi) => {
    const zh = zoneH(z.id);
    consumed.push(z.id);
    const ns = rowOf(z);
    const nw = (zoneW - 2 * pad - (ns.length - 1) * nodeGap) / ns.length;
    ns.forEach((nd, ni) => {
      nodeBox[nd.id] = { x: zoneX + pad + ni * (nw + nodeGap), y: zy + band + pad, w: nw, h: nodeH };
      consumed.push(nd.id);
    });
    // 장애물로서의 label 폭은 글자 수 어림이 아니라 lint와 같은 추정기로 재고,
    // **KO/EN 중 넓은 쪽**으로 고정한다 — 배선 기하가 언어에 따라 달라지면 안 된다.
    const labelTextW = Math.max(...["ko", "en"].map((lc) => estimateWidth(String(z.label[lc] ?? ""), 12, true, 0)));
    const labelW = Math.min(zoneW - 2 * pad, labelTextW * 1.08 + 2 * ROUTE_DEFAULTS.labelPad);
    zoneBoxes.push({ id: z.id, x: zoneX, y: zy, w: zoneW, h: zh,
      labelBox: { x: zoneX + pad, y: zy + 4, w: labelW, h: band - 4 } });
    zy += zh + (corridors[zi] ?? 0);
  });
  const contentBottom = zy;   // 마지막 zone 다음에는 corridor를 더하지 않는다

  // 3) 배선 — 좌표는 router가 정한다. 문제가 남으면 spec §6 ladder를 밟는다.
  const ladder = [];
  let routed = routeEdges({ nodes: nodeBox, zones: zoneBoxes, plan, frame: cb, degradeLevel });
  if (routed.problems.length) {
    ladder.push({ step: 1, action: "drop edge labels to the legend", applied: false, reason: "이 TypePack은 edge label을 그리지 않는다 — 회수할 여유가 없다" });
    ladder.push({ step: 2, action: "merge co-located nodes into one frame", applied: false, reason: "입력의 의미 구조를 바꾸는 일이라 generator가 임의로 하지 않는다" });
    const demotedTry = routeEdges({ nodes: nodeBox, zones: zoneBoxes, plan, frame: cb, degradeLevel: 3 });
    const kept = demotedTry.routes.length, total = plan.classified.length;
    const acceptable = !demotedTry.problems.length && kept * 2 >= total;   // 의미를 절반 넘게 잃으면 성공이 아니다
    ladder.push({ step: 3, action: "reduce to the primary request path", applied: acceptable,
      reason: acceptable ? `secondary ${total - kept}개를 legend로 내리고 primary ${kept}개만 그린다`
        : `secondary를 내리면 ${total}개 중 ${kept}개만 남아 의미가 사라진다` });
    if (acceptable) routed = demotedTry;
    else {
      ladder.push({ step: 4, action: "return needs-split", applied: true, reason: "한 장에 교차·관통 없이 담을 수 없다" });
      return { needsSplit: true, consumed: [],
        routing: { degradeLevel: 3, problems: routed.problems, hops: routed.hopCount, ladder,
          diagnostics: routed.diagnostics, attempts: routed.attempts,
          unrouted: routed.diagnostics.map((d) => d.subject), edgeCount: plan.classified.length,
          demoted: demotedTry.demoted.map((e) => e.id) } };
    }
  }

  // zone frame (배경) → connector → node 순으로 그린다(z-order: 선이 카드 뒤로 가려지지 않도록
  // 카드보다 먼저 그리되, 배선 자체가 카드를 피해 가는 것이 원칙이다).
  // 그리기 순서: zone 프레임 → connector → node → zone label.
  // 라벨은 마지막에 올려 불투명 mask와 함께 선 **위에** 놓는다(선은 그 뒤로 지나간다).
  const labels = [];
  zoneBoxes.forEach((zb, zi) => {
    const z = zones[zi], ns = rowOf(z);
    containers.push(`  <g data-comp-entity="${z.id}" data-entity="${z.id}" data-layout-role="zone">
    <rect x="${r1(zb.x)}" y="${r1(zb.y)}" width="${r1(zb.w)}" height="${r1(zb.h)}" rx="14" fill="#F4F8FC" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule" data-layout-container="${z.id}" data-min-pad="${pad}" data-reserve-top="${band}" data-layout-count="${ns.length}"/>
    <g data-layout-group="${z.id}-row" data-distribution="equal-gap" data-axis="x" data-group-count="${ns.length}"></g>
  </g>`);
    labels.push(`  <g data-layout-role="zone-label" data-label-bounds="${r1(zb.labelBox.x)},${r1(zb.labelBox.y)},${r1(zb.labelBox.w)},${r1(zb.labelBox.h)}">
    <rect x="${r1(zb.labelBox.x)}" y="${r1(zb.labelBox.y)}" width="${r1(zb.labelBox.w)}" height="${r1(zb.labelBox.h)}" rx="4" fill="#F4F8FC" data-fill-role="surface-tint"/>
    <text x="${r1(zb.x + pad)}" y="${r1(zb.y + band / 2 + 4)}" font-size="12" font-weight="700" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(z.label[loc])}</text>
  </g>`);
  });

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
    <text x="${r1(b.x + b.w / 2)}" y="${r1(b.y + b.h / 2 + 16)}" font-size="12" fill="#252B35" data-fill-role="ink" text-anchor="middle" dominant-baseline="central">${esc(nd.name[loc])}</text>
  </g>`);
  }

  // legend — solid/dashed가 함께 나오면 필수다(스타일이 아니라 축을 설명한다)
  let legendH = 0;
  if (routed.legendRequired) {
    const ly = contentBottom + 22, lx = zoneX + pad;
    const keys = loc === "ko"
      ? [["solid", "요청 흐름 (동기·공개)"], ["dashed", "비동기 또는 내부 전용"]]
      : [["solid", "request flow (sync, public)"], ["dashed", "async or private"]];
    const items = keys.map(([style, label], i) => {
      const x = lx + i * 260;
      return `    <g data-layout-role="legend-key">
      <path d="M${r1(x)} ${r1(ly)} L${r1(x + 34)} ${r1(ly)}" fill="none" stroke="${EDGE}" stroke-width="2.2"${style === "dashed" ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#ah-secondary)"/>
      <text x="${r1(x + 56)}" y="${r1(ly)}" font-size="12" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(label)}</text>
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
    bounds: { x: cb.x, y: cb.y, w: cb.w, h: contentBottom - cb.y + legendH },
    routing: {
      degradeLevel: routed.degradeLevel, ladder, problems: routed.problems, hops: routed.hopCount,
      alignment: aligned.moves, attempts: routed.attempts, diagnostics: routed.diagnostics,
      legend: routed.legendRequired,
      demoted: routed.demoted.map((e) => e.id),
      routes: routed.routes.map((rt) => ({ id: rt.id, from: rt.from, to: rt.to, path: rt.kindPath,
        ports: [rt.sideFrom, rt.sideTo], bends: rt.bends, style: rt.style, targetGap: rt.targetGap,
        hops: rt.hops.length })),
    },
  };
}



// ---------- process-flow (main path 한 축, feedback은 되돌이) ----------
function renderProcessFlow(input, loc, cb, sc, tp) {
  const steps = input.steps, n = steps.length;
  const column = sc.layout === "column";
  const P = tp.fit?.params ?? {};
  const gap = column ? Number(P.gapY ?? 36) : Number(P.gapX ?? 44);
  const badge = 26;

  // 카드 크기: 내용에서 파생하고 선언된 floor를 하한으로 둔다(두 locale 최대값 — 기하는 언어에 안정적이어야).
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
  // main path는 인접 단계를 잇는다. feedback이 있으면 되돌이(secondary·dashed)로 마지막 → 첫 단계.
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

// ---------- approval-gate (한 행 + 게이트 pill과 기준 caption) ----------
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
  // 게이트 pill은 그것이 지키는 화살표 **위**에 놓고 점선으로 내려 닿게 한다(spec §5).
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

  // 지키는 화살표를 찾아 그 중점 위에 pill을 세우고 점선을 내린다.
  const guarded = routed.routes.find((r) => r.from === g.from && r.to === g.to);
  const labels = [];
  if (guarded) {
    const pts = guarded.points;
    const mid = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
    const label = String(g.label[loc]);
    const pw = 28 + estimateWidth(label, 12, true, 0) + 16;   // icon 자리(28) + 글자 + 오른쪽 여백
    const px = mid.x - pw / 2, py = rowY - pillGap - pillH;
    labels.push(`  <g data-comp-entity="${g.id}" data-entity="${g.id}" data-layout-role="gate">
    <path d="M${r1(mid.x)} ${r1(py + pillH)} V${r1(mid.y)}" fill="none" stroke="#B07A31" stroke-width="1.4" stroke-dasharray="3 3" data-stroke-role="warning"/>
    <rect x="${r1(px)}" y="${r1(py)}" width="${r1(pw)}" height="${pillH}" rx="${pillH / 2}" fill="#FBF3E6" stroke="#D8B075" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="warning"/>
    ${icon("check", px + 16, py + pillH / 2, 13)}
    <text x="${r1(px + 28)}" y="${r1(py + pillH / 2)}" font-size="12" font-weight="700" fill="#8A5D22" data-fill-role="warning" dominant-baseline="central">${esc(label)}</text>
  </g>`);
    consumed.push(g.id);
  }
  // 기준은 pill 안이 아니라 band 아래 caption이다(spec §5).
  const capY = rowY + h + 26;
  labels.push(`  <g data-layout-role="gate-caption">
    <text x="${r1(cb.x)}" y="${r1(capY)}" font-size="12.5" fill="#636A75" data-fill-role="muted" dominant-baseline="central">${esc(g.criterion[loc])}</text>
  </g>`);
  return assemble({ routed, consumed, nodes,
    zoneArt: [`  <g data-layout-group="gate-row" data-distribution="equal-gap" data-axis="x" data-group-count="${n}"></g>`],
    nodeArt, labels, loc, bounds: { x: cb.x, y: cb.y, w: cb.w, h: capY + 10 - cb.y } });
}

// 두 renderer가 공유하는 조립 — layer 순서와 배선 receipt는 한 곳에서만 만든다.
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


// ---------- layer-stack (연결선 없음 — 인접이 관계다) ----------
function renderLayerStack(input, loc, cb, sc, tp) {
  const layers = input.layers, n = layers.length;
  const P = tp.fit?.params ?? {};
  const gapY = Number(P.gapY ?? 20), pad = 18, chipGap = 12;
  const bandW = cb.w;
  const labelW = Math.max(...["ko", "en"].flatMap((lc) => layers.map((L) => estimateWidth(L.label[lc], 15, true, 0))));
  // chip 폭은 band에서만 파생하지 않는다 — **실제 chip 문안**(두 locale 최대)이 들어가야 한다.
  const chipPad = 12;
  const maxChips = Math.max(0, ...layers.map((L) => (L.items ?? []).length));
  const chipTextW = Math.max(0, ...["ko", "en"].flatMap((lc) =>
    layers.flatMap((L) => (L.items ?? []).map((c) => estimateWidth(c?.label?.[lc] ?? "", 12, false, 0)))));
  const chipNeed = maxChips ? chipTextW + 2 * chipPad : 0;
  const chipRunNeed = maxChips ? maxChips * chipNeed + (maxChips - 1) * chipGap : 0;
  // chip은 내용 폭으로 크기를 정한다 — 남는 공간을 채우려고 늘리지 않는다.
  // 대신 **마지막 chip의 오른쪽 끝**이 band 안쪽 끝과 계산으로 만나도록 run을 오른쪽에 붙인다(spec §5).
  const chipW = maxChips ? Math.max(chipNeed, 72) : 0;
  const runW = maxChips ? maxChips * chipW + (maxChips - 1) * chipGap : 0;
  const runStart = cb.x + bandW - pad - runW;
  // run 왼쪽은 전부 라벨 열 + 여백으로 예약된다(내용이 쓸 수 없는 구간).
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
    // 마지막 chip의 오른쪽 끝은 계산으로 band 안쪽 끝과 만난다(수기 좌표 금지, spec §5)
    const m = chips.length;

    const chipY = y + h / 2 - 13;
    bandArt.push(`  <g data-comp-entity="${L.id}" data-entity="${L.id}" data-layout-role="band">
    <rect x="${r1(cb.x)}" y="${r1(y)}" width="${r1(bandW)}" height="${r1(h)}" rx="12" fill="#F4F8FC" stroke="#DEE0E2" stroke-width="1" data-fill-role="surface-tint" data-stroke-role="rule" data-layout-item="layer-stack" data-layout-container="${L.id}" data-min-pad="${pad}" data-layout-count="${m}"${m ? ` data-reserve-left="${r1(labelCol)}" data-symmetry="x"` : ""}/>
    <text x="${r1(cb.x + pad)}" y="${r1(y + h / 2)}" font-size="15" font-weight="700" fill="#252B35" data-fill-role="ink" dominant-baseline="central">${esc(L.label[loc])}</text>
  </g>`);
    if (m) {
      chipArt.push(`  <g data-layout-group="${L.id}-chips" data-distribution="equal-gap" data-axis="x" data-group-count="${m}"></g>`);
      chips.forEach((c, k) => {
        // chip은 {id, label{ko,en}} 계약이다. 문안이 없으면 조용히 "undefined"를 그리지 않고 실패한다
        // (기하 gate는 글자 내용을 보지 않으므로 여기서 막는다).
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

// ---------- nested-scope (동심 — 화살표 없이 포함이 관계다) ----------
function renderNestedScope(input, loc, cb, sc, tp) {
  const rings = input.rings, n = rings.length;
  const P = tp.fit?.params ?? {};
  const inset = Number(P.inset ?? 44);
  // 사방 균일 inset — label은 위쪽 inset 띠 안에서 가운데 놓인다(spec §5, fit 계약과 동일).
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
    // ring label은 자기 띠(위쪽 inset) 안에서 측정한다 — ring 전체가 아니라 그 띠가 기준이다.
    const stripH = last ? Math.min(inset, box.h) : inset;
    labels.push(`  <g data-layout-role="ring-label" data-label-bounds="${r1(box.x)},${r1(box.y)},${r1(box.w)},${r1(stripH)}">
    <text x="${r1(box.x + box.w / 2)}" y="${r1(box.y + stripH / 2)}" font-size="13" font-weight="700" fill="#3C4657" data-fill-role="ink" text-anchor="middle" dominant-baseline="central">${esc(rg.label[loc])}</text>
  </g>`);
    if (last && rg.core_icon)
      labels.push(`  <g data-layout-role="core-icon">${icon(rg.core_icon, box.x + box.w / 2, box.y + stripH + (box.h - stripH) / 2, 26)}</g>`);
    if (inner) box = inner;
  });
  // label이 자기 띠 폭을 넘으면 기하가 아니라 문안 문제다 — 조용히 넘기지 않는다.
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


// ---------- before-after (좌우 mirrored — 정렬이 대응을 나른다) ----------
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
  // 행은 반복 항목이다 — 한 높이를 공유한다(양쪽 패널·두 locale 중 가장 긴 것이 정한다).
  // 그래야 같은 slot이 같은 y에 오고, 반복 항목 크기 계약도 성립한다.
  const rowUnit = Math.max(slotMinH, ...["ko", "en"].flatMap((lc) =>
    wrapAll(lc).flat().map((r) => r.lines.length * 17 + 20)));
  const rowH = slots.map(() => rowUnit);
  const headH = Number(P.panelHeaderH ?? 34);
  const bodyH = rowH.reduce((a, b) => a + b, 0) + (slots.length - 1) * rowGap;
  // floor 산식은 skin.mjs의 derivePanelFloor가 소유한다 — validator와 같은 함수를 쓴다.
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
      // 같은 slot은 두 패널에서 같은 행 id를 공유한다 — 정렬이 곧 대응이다.
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

// ---------- timeline receipt v1 (producer와 verifier가 함께 쓴다) ----------
// R0B-F1: shape를 여기서 못 박는다. 선언에 없는 field는 전부 거부하고, marker는 null과
// 객체의 union이며 섞일 수 없다.
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
  // marker는 union이다 — 없거나(null), 있으면 세 field를 모두 갖는다.
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

// ---------- roadmap-timeline (ordinal 축 — 위치는 순서만 뜻한다) ----------
// 이 타입은 **기간 비례를 주장하지 않는다**. 간격은 균등이고 날짜 domain은 입력에 없다.
// marker 위치도 renderer가 추론하지 않고 입력의 after_phase가 정한다.
const TL = { pad: 12, cardTitle: 13, cardBody: 11, dotR: 9, ringGap: 5, ringStroke: 1.8,
  axisH: 6, labelGap: 12, outerClearance: 14, pillH: 22, pillPad: 10, stem: 46, bandPad: 10 };
function timelineGeometry(input, cb, tp) {
  const ph = input.phases, n = ph.length;
  const P = tp.fit?.params ?? {};
  // card 폭은 **내용**이 정한다. §2가 title 1줄을 요구하므로 두 locale 최장 title이 폭의 하한이고,
  // endInset은 그 폭에서 유도한다 — 상수로 두면 끝 card가 content box를 넘는다.
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
  // 등간격이 card를 겹치게 하면 자리를 옮겨서 푸는 게 아니라 비성공으로 끝낸다.
  if (g.n > 1 && g.step < g.cardW + g.gapX)
    return fail(`even spacing gives ${r1(g.step)}px between phase centres but a card needs ${r1(g.cardW + g.gapX)}px — the interval is computed, never widened by label`);
  const alt = g.n >= 5;                       // §6 ladder 2단계: 상하 교대
  const bodies = ph.map((p) => (p.card.body ? ["ko", "en"].map((lc) =>
    wrapLines(String(p.card.body[lc]), g.cardW - 2 * TL.pad, TL.cardBody, false, 2)) : null));
  // body가 예산을 넘는 것은 배치 문제가 아니라 **입력이 §2를 어긴 것**이다. degrade로 삼키지 않는다.
  // (body drop을 ladder에 두지 않는 이유는 spec §6에 적혀 있다 — 이 타입에서 높이는 제약이 아니다.)
  if (bodies.some((b) => b?.some((x) => x.overflow))) {
    console.error("generate: a milestone body exceeds the §2 two-line budget at the computed card width");
    process.exit(1);
  }
  const bodyLines = Math.max(0, ...bodies.map((b) => (b ? Math.max(...b.map((x) => x.lines.length)) : 0)));
  const cardH = TL.pad + 18 + (bodyLines ? 6 + bodyLines * 15 : 0) + TL.pad;
  // label은 card 반대편에 둔다 — 교대 배치에서 위쪽 card가 label을 덮기 때문이다.
  const labelH = TL.dotR + TL.ringGap + 10 + 8;
  const cardSide = TL.labelGap + TL.dotR + cardH;
  const markerTop = input.now_marker ? TL.stem + TL.pillH : 0;
  const above = Math.max(markerTop, labelH, alt ? cardSide : 0);
  // band는 container 안쪽에 놓는다 — 경계에 닿는 것도 통과가 아니므로 실제 여백을 비운다.
  const axisY = cb.y + TL.bandPad + above;
  const consumed = [], containers = [], nodeArt = [], labels = [];
  const STATUS_TEXT = { ko: { done: "완료", current: "진행 중", future: "예정" },
    en: { done: "Done", current: "In progress", future: "Planned" } };
  const axisX0 = cb.x + g.endInset - 14, axisX1 = cb.x + cb.w - g.endInset + 14;
  const bottom = axisY + Math.max(cardSide, alt ? labelH : 0) + TL.bandPad;
  containers.push(`  <rect data-layout-container="timeline" x="${r1(cb.x)}" y="${r1(cb.y)}" width="${r1(cb.w)}" height="${r1(bottom - cb.y)}" fill="none" stroke="none" data-min-pad="10" data-layout-count="${g.n}"/>`);
  // 축은 dot·card가 올라앉는 **배경 rail**이다. annotations에 두면 node를 덮으므로
  // paint layer 계약(containers → connectors → nodes → annotations)의 앞쪽에 둔다.
  containers.push(`  <g data-layout-role="axis" data-axis-kind="ordinal-direction">
    <rect data-axis="x" data-axis-orientation="horizontal" data-axis-positive="right" x="${r1(axisX0)}" y="${r1(axisY - TL.axisH / 2)}" width="${r1(axisX1 - axisX0)}" height="${TL.axisH}" rx="${TL.axisH / 2}" fill="#DEE0E2" data-fill-role="rule"/>
  </g>`);
  ph.forEach((p, i) => {
    consumed.push(p.id);
    const x = g.xs[i], up = alt && i % 2 === 1;
    const cy = up ? axisY - TL.labelGap - TL.dotR - cardH : axisY + TL.labelGap + TL.dotR;
    const b = bodies[i] ? bodies[i][loc === "ko" ? 0 : 1] : null;
    // 상태는 색만이 아니라 **형태**로도 구분된다: done 채움 · current 채움+ring · future 윤곽.
    // 그리고 state marker는 **불투명**해야 한다 — 비어 있으면 뒤의 축 rail이 비쳐 dot이
    // 선에 걸린 것처럼 보인다. 배경은 하드코딩하지 않고 canvas role로 칠한다(dark에서도 맞는다).
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
    // pill 폭은 두 locale 최대값으로 고정한다 — 언어에 따라 기하가 갈리지 않는다.
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

// ---------- decision-matrix (축은 밖, 셀은 격자) ----------
// 축은 **ordinal category direction**이다 — 수치 간격도, chart scale도 아니다.
// 따라서 tick·숫자·gridline은 없고, 방향(위/오른쪽이 높음)만 표시한다.
// 축은 connector가 아니다: data-route-* 를 쓰지 않으므로 routing audit 대상이 아니고,
// direction marker는 primary connector arrow보다 가늘게(우선순위가 낮게) 파생한다.
const AXIS_SHAFT = 1.5;                         // primary connector 2.5 / secondary 2.2보다 얇다
const AXIS_HEAD = r1(4.5 * AXIS_SHAFT);         // marker 크기는 connector와 **같은 산식**에서 파생한다
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
  // 축 라벨 열 폭은 **실제 문안**(두 locale 최대)에서 파생한다 — 고정 상수면 KO에서 넘친다.
  const axisTextW = Math.max(...["ko", "en"].flatMap((lc) =>
    ["low", "high"].map((w) => estimateWidth(String(endOf("y", w).label[lc]), endLabel, true, 0))));
  // 예약 = [라벨][라벨↔축선 간격][축선↔격자 간격]. 축선이 격자에도 라벨에도 닿지 않는다.
  const axisCol = Math.max(48, axisTextW + 8 + axisGap + 4);
  const axisRow = axisGap + 22;
  // 격자 폭은 **예약(축 라벨 열)과 container pad를 뺀 실제 폭**에서 계산한다 —
  // 경계에 정확히 닿는 것도 통과가 아니므로 양쪽 pad를 실제로 비운다.
  const gridW = cb.w - axisCol - 2 * pad;
  const cw = (gridW - (cols - 1) * gx) / cols;
  const x0 = cb.x + axisCol + pad, y0 = cb.y + pad;
  // cell 높이는 canvas가 아니라 **내용**이 정한다. 두 locale 최대 line-box + 상하 padding이며
  // 남는 자리를 채우려고 늘리지 않는다(남는 것은 residual 계약이 선언한다).
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
  // 격자 전체를 하나의 container로 두고, 축 라벨 구간을 **가로·세로 예약**으로 선언한다.
  containers.push(`  <rect data-layout-container="matrix" x="${r1(cb.x)}" y="${r1(cb.y)}" width="${r1(cb.w)}" height="${r1(gridH + 2 * pad)}" fill="none" stroke="none" data-min-pad="${pad}" data-reserve-left="${axisCol}" data-reserve-top="0" data-layout-count="${cells.length}"/>`);
  const inRow = (r) => pl.cells.filter((c) => c.row === r).length;
  const inCol = (c) => pl.cells.filter((x) => x.col === c).length;
  for (let r = 0; r < rows; r++)
    if (inRow(r) === cols)   // 완전한 행만 등간격 group을 선언한다(빈 칸이 있으면 열 정렬이 지배한다)
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
  // 축은 패널 **밖**에 둔다(spec §5): 세로축은 격자 왼쪽, 가로축은 격자 아래.
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
// name은 선택이다 — 없으면 두 축 tier label에서 파생한다(순서가 모호한 "낮음-높음"을 쓰지 않는다).
function cellName(c, pl, lc) {
  if (c.name) return c.name[lc];
  const yt = pl.yTiers.find((t) => t.id === c.y), xt = pl.xTiers.find((t) => t.id === c.x);
  return `${yt.label[lc]} · ${xt.label[lc]}`;
}

// ---------- font delivery (portable = 사용 glyph subset embed) ----------
// 계약: portable은 대상 환경의 설치 글꼴에 의존하지 않는다. subset 도구가 없거나 glyph가
// 빠지면 **full embed로도, system fallback으로도 조용히 넘어가지 않고 실패한다**.
// 이 경로는 artifact를 **만들 때만** 쓰인다 — 이미 만들어진 산출물의 소비·검증에는 필요 없다.
function fontDelivery(modeArg) {
  const del = spawnJson([skinCli, "delivery", "--json"], "skin.mjs delivery");
  const mode = modeArg ?? del.defaultMode;
  if (!del.modes[mode]) { console.error(`generate: unknown font-delivery mode "${mode}"`); process.exit(2); }
  return { policy: del, mode, grade: del.modes[mode].grade };
}
function subsetFace(facePath, chars, tool, style, weight, alias, rfn) {
  // 환경이 주는 것은 interpreter뿐이다. subsetting 자체는 package가 소유한 wrapper가 하고,
  // wrapper가 실행 중인 fontTools/brotli 버전을 직접 확인한다 — 임의의 실행 파일로는
  // acceptance artifact를 만들 수 없다.
  const python = process.env.SVGINFO_PYTHON ?? tool.command ?? "python3";
  const wrapper = guardPackagePath(path.join(here, "..", String(tool.wrapper)), "font subset wrapper");
  // 경로는 **호출마다 새로** 만든다. 내용으로 이름을 지으면 같은 글자 집합을 동시에 subset하는
  // 두 build가 같은 파일을 쓰고 서로의 것을 지운다(작업 디렉터리는 공유 tmp다).
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

// 산출물에 실제로 쓰인 문자만 모은다(글자 수가 아니라 문자 집합이 계약이다)
function usedChars(svg) {
  const texts = [...svg.matchAll(/<(?:text|tspan)[^>]*>([^<]*)</g)].map((m) => m[1]);
  const set = new Set();
  for (const t of texts) for (const ch of t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")) set.add(ch);
  return [...set].sort().join("");
}
function embedSubset(svg, delivery) {
  const m = delivery.policy.modes[delivery.mode];
  if (m.embed !== "subset") return { svg, faces: [] };
  const full = readYamlFile(path.join(here, "..", "references", "delivery", "font-delivery-v1.yaml"));
  const cfg = full.doc.modes[delivery.mode];
  const chars = usedChars(svg);
  if (!chars) { console.error("generate: portable delivery found no text to subset"); process.exit(4); }
  const tp = readYamlFile(path.join(here, "..", "references", "typography", "typography-v1.yaml"));
  const flat = tp.doc.treatments.flat;
  const rfn = flat.license?.rfn ?? [];
  const faces = [];
  let css = "", tool = null, identity = [];
  for (const f of flat.asset.faces) {
    const abs = path.join(here, "..", String(f.path));
    const style = Number(f.weight) >= 700 ? "Bold" : "Regular";
    const { buf, receipt } = subsetFace(abs, chars, cfg.tool, style, f.weight, cfg.alias, rfn);
    tool = receipt.tool;
    identity.push({ weight: Number(f.weight), ...receipt.identity, preservedLegalNameIDs: receipt.preservedLegalNameIDs });
    faces.push({ weight: Number(f.weight), sourceDigest: f.digest, subsetDigest: receipt.digest, bytes: buf.length });
    css += `@font-face{font-family:'${cfg.alias}';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}`;
  }
  const stack = `'${cfg.alias}',` + flat.locales.ko.face + "," + flat.fallback.map((x) => /\s/.test(x) ? `'${x}'` : x).join(",");
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
  if (override && !tp.presets.includes(override) && !audition) {
    console.error(`generate: preset "${override}" is not declared by ${tid} (declared: ${tp.presets.join(", ")}) — pass --audition to render it as evidence, which marks the receipt non-canonical`);
    process.exit(1);
  }
  const render = (cbox) => tid === "cards-kpi-grid" ? renderCards(input, loc, cbox, sc, tp)
    : tid === "topology-component" ? renderTopology(input, loc, cbox, sc, tp)
    : tid === "process-flow" ? renderProcessFlow(input, loc, cbox, sc, tp)
    : tid === "approval-gate" ? renderApprovalGate(input, loc, cbox, sc, tp)
    : tid === "layer-stack" ? renderLayerStack(input, loc, cbox, sc, tp)
    : tid === "nested-scope" ? renderNestedScope(input, loc, cbox, sc, tp)
    : tid === "before-after" ? renderBeforeAfter(input, loc, cbox, sc, tp)
    : tid === "decision-matrix" ? renderDecisionMatrix(input, loc, cbox, sc, tp)
    : tid === "roadmap-timeline" ? renderRoadmapTimeline(input, loc, cbox, sc, tp)
    : (console.error(`generate: no renderer registered for "${tid}"`), process.exit(2));
  let pf = spawnJson([skinCli, "pageframe", preset, "--json"], "skin.mjs pageframe");
  if (pf.regions.fluid) {
    // fluid 캔버스는 내용 높이를 따라간다 — 블록을 먼저 재고 그 높이로 프레임을 다시 만든다.
    const probe = render({ ...pf.regions.contentBox, h: 100000 });
    // 배치가 성립하지 않으면 잴 높이도 없다 — 프레임은 그대로 두고 아래 needs-split 경로가 판정한다.
    if (probe.bounds)
      pf = spawnJson([skinCli, "pageframe", preset, "--content-height", String(Math.ceil(probe.bounds.h)), "--json"], "skin.mjs pageframe");
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
    // 렌더 성공으로 처리하지 않는다 — degrade receipt를 남기고 비성공으로 끝낸다.
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
  // fit 예측은 **최소 합법 문법의 floor**다. 내용이 그 floor를 넘겨 자란 배치가 실제로
  // contentBox를 벗어나면, 낙관적인 예측이 통과시킨 것을 여기서 다시 거부한다.
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
  const eyebrow = loc === "ko" ? "타입 카탈로그" : "TYPE CATALOG";
  const title = input.title?.[loc];
  if (!title) { console.error("generate: input payload must carry title.ko/title.en — the H1 is content, not something the generator may invent"); process.exit(1); }
  const subtitle = loc === "ko" ? `${tid} · ${sc.id}` : `${tid} · ${sc.id}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pf.canvas.width} ${canvasH}" width="${pf.canvas.width}" height="${canvasH}" role="img"
  style="font-family:Pretendard,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <title>${esc(title)}</title>
  <desc>${esc(tid)} ${esc(sc.id)} (${loc}) — generated from the declared TypePack input payload.</desc>
  <rect data-fill-role="canvas" fill="#F7F7F5" width="${pf.canvas.width}" height="${pf.canvas.height}"/>
${header(pf, title, eyebrow, subtitle, R.bounds.y)}
${R.body}
</svg>
`;
  // kernel §8: 배치 후 contentFlowBounds와 residual을 기록하고, 큰 하단 여백은
  // 시나리오가 명시 선언한 경우에만 허용한다(선언 없는 dead space = 비성공).
  const fb = R.bounds;
  const residual = { top: r1(fb.y - cb.y), bottom: r1(cb.y + cb.h - (fb.y + fb.h)) };
  const RESIDUAL_TOL = 8, RESIDUAL_FLOOR = 0.08;
  const decl = sc.residual_disposition ?? null;
  if (residual.bottom > RESIDUAL_FLOOR * cb.h) {
    if (!decl) {
      console.error(`generate: bottom residual ${residual.bottom}px (${Math.round(100 * residual.bottom / cb.h)}% of the contentBox) exceeds the ${Math.round(100 * RESIDUAL_FLOOR)}% floor and the scenario declares no residual_disposition — declare it with a reason or choose a preset/variant that fills the page`);
      process.exit(1);
    }
    if (Math.abs(Number(decl.bottom) - residual.bottom) > RESIDUAL_TOL) {
      console.error(`generate: declared residual_disposition.bottom ${decl.bottom}px does not match the measured ${residual.bottom}px (tol ${RESIDUAL_TOL}px)`);
      process.exit(1);
    }
  }
  const delivery = fontDelivery(opt("font-delivery"));
  const embedded = embedSubset(svg, delivery);
  const artifact = embedded.svg.replace(/[ \t]+$/gm, "");   // digest 대상은 실제로 기록되는 바이트다
  if (out) writeFileSync(out, artifact);
  const receipt = { ...base, status: "ok", artifact: out ? path.basename(out) : null,
    consumed: R.consumed, artifactDigest: sha(artifact),
    contentFlowBounds: { x: r1(fb.x), y: r1(fb.y), w: r1(fb.w), h: r1(fb.h) },
    fontDelivery: { mode: delivery.mode, grade: delivery.grade,
      policyDigest: delivery.policy.profile.digest, typographyProfileDigest: delivery.policy.typographyProfileDigest,
      alias: embedded.alias ?? null, glyphs: embedded.chars ?? 0, faces: embedded.faces,
      tool: embedded.tool ?? null, wrapperDigest: embedded.wrapperDigest ?? null, identity: embedded.identity ?? [] },
    routing: R.routing ?? null,
    matrix: R.matrix ?? null,
    timeline: R.timeline ?? null,
    residual, residualDisposition: decl,
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
  // phase만 semantic entity다 — card·dot·marker는 phase에 귀속된 participant이고 독립 ID가 없다.
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
// decision-matrix 감사: **receipt를 믿지 않고** 원본 입력에서 기대 배치를 다시 계산하고,
// 축 기하는 기록된 path에서 직접 읽는다. 축은 ordinal direction이므로 눈금·수치는 검사 대상이 아니다.
function auditMatrixAxes(svg, input, loc) {
  const errs = [], pl = deriveMatrixPlacement(input);
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) ?? [])[1];
  const numAttr = (s, k) => Number(attr(s, k));
  // --- 1. cell 기하: 산출물에서 직접 읽는다 ---
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
  // 자리는 좌표 상수가 아니라 **순서**로 증명한다 — 빈 칸이 있어도 성립하고, 뒤집히면 걸린다.
  const sgn = (n) => (Math.abs(n) < 0.5 ? 0 : Math.sign(n));
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j], ea = expOf(a.id), eb = expOf(b.id);
    for (const [axis, want, got, unit] of [
      ["column", Math.sign(ea.col - eb.col), sgn(a.rx - b.rx), "x"],
      ["row", Math.sign(ea.row - eb.row), sgn(a.ry - b.ry), "y"],
    ]) if (want !== got)
      errs.push(`E-GEN-MATRIX-PLACE cells "${a.id}" (${ea.x}, ${ea.y}) and "${b.id}" (${eb.x}, ${eb.y}) must differ in ${axis} by ${want} but their drawn ${unit} differs by ${got} — the axis value decides the position, not the declaration order`);
  }
  // --- 2. 축 기하: 존재·방향·positive 끝 ---
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
  // --- 3. 끝점 label이 실제 방향과 같은 뜻인지 ---
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
// roadmap-timeline 감사: receipt를 정답으로 쓰지 않고 **입력과 preset에서 다시 계산**한 뒤
// 기록된 SVG 좌표와 대조한다. 축은 ordinal이므로 눈금·수치는 검사 대상이 아니다.
function auditTimeline(svg, input, rcp, tp) {
  const errs = [];
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) ?? [])[1];
  const num = (s, k) => Number(attr(s, k));
  // 날짜 domain은 이 타입에 없다(C-01) — 입력이 들고 오면 거부한다.
  const dateish = ["date", "start", "end", "duration", "dates"];
  for (const p of input.phases ?? [])
    for (const k of dateish) if (k in p) errs.push(`E-TL-DOMAIN phase "${p.id}" carries "${k}" — this TypePack spaces phases evenly and makes no proportional-duration claim`);
  // 기대 기하: preset contentBox와 입력에서 다시 계산한다.
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
    // 상태는 색이 아니라 **형태**로도 구분돼야 한다 — ring이 실제로 보이는지까지 본다.
    const dr = num(c, "r"), fillRole = attr(c, "data-fill-role");
    const ring = (d.block.match(/<circle[^>]*data-dot-ring="current"[^>]*\/>/) ?? [])[0];
    const underlay = (d.block.match(/<circle[^>]*data-dot-underlay="[^"]*"[^>]*\/>/) ?? [])[0];
    // state marker는 불투명해야 한다 — 비어 있으면 뒤의 축 rail이 비친다.
    if (attr(c, "fill") === "none")
      errs.push(`E-TL-SHAPE "${d.id}" dot has no fill — the axis rail shows through and the marker reads as sitting behind the line`);
    if (want.status === "future") {
      // future는 "빈 원"이지만 **투명**한 것이 아니다: 배경 role로 채우고 윤곽선을 둔다.
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
  // x는 좌→우로 단조여야 한다(DOM 순서와 함께 본다).
  for (let i = 1; i < dots.length; i++) {
    const a = num(firstCircle(dots[i - 1].block), "cx"), b = num(firstCircle(dots[i].block), "cx");
    if (!(b > a)) errs.push(`E-TL-ORDER phase #${i} is not right of #${i - 1} — later must read as further right`);
    if (!(dots[i].at > dots[i - 1].at)) errs.push(`E-TL-ORDER DOM order does not follow the declared phase order`);
  }
  // 축: 정확히 하나, 수평, 첫·마지막 dot을 감싼다.
  const axes = [...svg.matchAll(/<rect[^>]*data-axis="x"[^>]*\/>/g)].map((m) => m[0]);
  if (axes.length !== 1) errs.push(`E-TL-AXIS the ordinal axis must be drawn exactly once (found ${axes.length})`);
  else {
    const ax = axes[0], x0 = num(ax, "x"), w = num(ax, "width");
    if (attr(ax, "data-axis-orientation") !== "horizontal" || attr(ax, "data-axis-positive") !== "right")
      errs.push("E-TL-AXIS the ordinal axis must be horizontal with positive to the right");
    if (!(x0 <= g.xs[0] && x0 + w >= g.xs.at(-1)))
      errs.push(`E-TL-AXIS the axis spans ${r1(x0)}–${r1(x0 + w)} and does not contain the first/last phase (${r1(g.xs[0])}, ${r1(g.xs.at(-1))})`);
    if (/data-route-(id|from|to|kind)=/.test(ax)) errs.push("E-TL-AXIS an ordinal axis must not be classified as a connector");
    // paint order는 DOM 순서다: axis → underlay → dot/ring → label.
    const axAt = svg.indexOf(ax);
    const firstMarker = svg.search(/<circle[^>]*data-dot-(underlay|status)=/);
    if (axAt > firstMarker)
      errs.push("E-TL-LAYER the axis is painted after a state marker — the rail must sit behind every dot");
  }
  // marker: 입력이 위치를 말한다. 그리고 pill까지 포함한 **전체**가 아무것도 침범하지 않는다.
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
  // 끝 card가 content box 안에 있는지 최종 SVG에서 재측정한다(예측식이 아니라 실측).
  const cards = [...svg.matchAll(/<rect[^>]*data-phase-card="([^"]+)"[^>]*\/>/g)]
    .map((m) => ({ id: m[1], x: num(m[0], "x"), w: num(m[0], "width") }));
  for (const c of cards)
    if (c.x < cb.x - 0.5 || c.x + c.w > cb.x + cb.w + 0.5)
      errs.push(`E-TL-CONTAIN milestone card "${c.id}" spans ${r1(c.x)}–${r1(c.x + c.w)} outside the content box ${cb.x}–${cb.x + cb.w}`);
  // receipt는 정답이 아니라 대조 대상이다.
  for (const e of validateTimelineReceiptV1(rcp.timeline, { phaseCount: input.phases.length, hasMarker: Boolean(input.now_marker) })) errs.push(e);
  if (rcp.timeline?.phases) rcp.timeline.phases.forEach((p, i) => {
    if (typeof p.x === "number" && Math.abs(p.x - g.xs[i]) > 0.5)
      errs.push(`E-TL-SCHEMA receipt phase "${p.id}" x=${p.x} != ${r1(g.xs[i])} recomputed from the input`);
  });
  if (rcp.timeline?.marker && g.markerX != null && Math.abs(rcp.timeline.marker.x - g.markerX) > 0.5)
    errs.push(`E-TL-SCHEMA receipt marker x=${rcp.timeline.marker.x} != ${r1(g.markerX)} recomputed from the input`);
  return errs;
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
      for (const i of ids) if (!inSvg.has(i) && i !== "boundary") errors.push(`E-GEN-CONSUME artifact is missing entity "${i}"`);
      for (const i of inSvg) if (!ids.includes(i) && i !== "legend") errors.push(`E-GEN-INVENT artifact carries invented entity "${i}"`);
      // 정렬 inventory도 산출물을 믿지 않는다 — 원본 입력에서 다시 파생해 대조한다.
      const expectedInv = serializeAlignInventory(deriveAlignInventory(rcp.typepack, input, { cols: rcp.cols ?? undefined }));
      const gotInv = (svg.match(/data-align-inventory="([^"]*)"/) ?? [])[1];
      if (expectedInv && gotInv === undefined)
        errors.push("E-GEN-ALIGN artifact declares no alignment inventory but the input implies one");
      else if (expectedInv !== (gotInv ?? ""))
        errors.push(`E-GEN-ALIGN alignment inventory recomputed from the input does not match the artifact\n    input:    ${expectedInv}\n    artifact: ${gotInv ?? "(none)"}`);
      if (rcp.typepack === "decision-matrix") for (const e of auditMatrixAxes(svg, input, rcp.locale)) errors.push(e);
      if (rcp.typepack === "roadmap-timeline") for (const e of auditTimeline(svg, input, rcp, caseTp)) errors.push(e);
      // 배선은 산출물에서 다시 잰다 — receipt가 아니라 기록된 path가 근거다
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
