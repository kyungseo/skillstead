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
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preflight, guardPackagePath, provenance, SKILL_LOCATOR } from "./preflight-lib.mjs";
import { parseYaml } from "./skin.mjs";
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
  const fl = sc.floor && sc.floor !== "base" ? sc.floor : null;
  const iw = Number(fl ? prm[`${fl}ItemMinW`] : prm.itemMinW);
  const ih = Number(fl ? prm[`${fl}ItemMinH`] : prm.itemMinH);
  const gx = Number(prm.gapX ?? 0), gy = Number(prm.gapY ?? 0), n = Number(sc.count);
  if (sc.layout === "row") return { w: n * iw + (n - 1) * gx, h: ih };
  if (sc.layout === "column") return { w: iw, h: n * ih + (n - 1) * gy };
  if (sc.layout === "grid") {
    const cols = Number(sc.cols), rows = Math.ceil(n / cols);
    return { w: cols * iw + (cols - 1) * gx, h: rows * ih + (rows - 1) * gy };
  }
  if (sc.layout === "zones") {
    const npz = Number(prm.maxNodesPerZone), pad = Number(prm.zonePad), band = Number(prm.zoneLabelBand), zg = Number(prm.zoneGap);
    return { w: npz * iw + (npz - 1) * gx + 2 * pad, h: n * (band + ih + 2 * pad) + (n - 1) * zg };
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
  const tmp = path.join(tmpdir(), `svginfo-subset-${weight}-${createHash("sha256").update(chars).digest("hex").slice(0, 12)}.woff2`);
  const textFile = tmp + ".txt";
  writeFileSync(textFile, chars);
  const args = [wrapper, "--face", facePath, "--text-file", textFile, "--out", tmp,
    "--alias", alias, "--style", style, "--weight", String(weight),
    "--expect-fonttools", String(tool.version), "--expect-brotli", String(tool.brotli),
    ...rfn.flatMap((n) => ["--rfn", String(n)])];
  const r = spawnSync(python, args, { encoding: "utf8" });
  rmSync(textFile, { force: true });
  if (r.error?.code === "ENOENT") {
    console.error(`generate: portable delivery needs the pinned toolchain (${tool.name} ${tool.version} + brotli ${tool.brotli}) run through ${tool.wrapper}.\n  It is a build-only dependency: point SVGINFO_PYTHON at an interpreter that has it, or generate with --font-delivery system (environment-dependent, not acceptance-grade).`);
    process.exit(4);
  }
  if (r.status !== 0) {
    console.error(`generate: subsetting failed (exit ${r.status})\n${(r.stdout ?? "") + (r.stderr ?? "")}`.trimEnd());
    process.exit(4);
  }
  let receipt;
  try { receipt = JSON.parse(r.stdout); } catch { console.error("generate: subset wrapper did not return JSON"); process.exit(4); }
  if (receipt.rfnGuard !== "clean") { console.error("generate: subset wrapper did not certify the reserved-name guard"); process.exit(4); }
  const buf = readFileSync(tmp);
  rmSync(tmp, { force: true });
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
    : (console.error(`generate: canary supports cards-kpi-grid and topology-component only (got ${tid})`), process.exit(2));
  let pf = spawnJson([skinCli, "pageframe", preset, "--json"], "skin.mjs pageframe");
  if (pf.regions.fluid) {
    // fluid 캔버스는 내용 높이를 따라간다 — 블록을 먼저 재고 그 높이로 프레임을 다시 만든다.
    const probe = render({ ...pf.regions.contentBox, h: 100000 });
    pf = spawnJson([skinCli, "pageframe", preset, "--content-height", String(Math.ceil(probe.bounds.h)), "--json"], "skin.mjs pageframe");
  }
  const cb = pf.regions.contentBox;
  const need = computeFit(tp, sc);
  const geometry = need.w <= cb.w && need.h <= cb.h ? "fits" : "needs-split";
  const expected = sc.geometry_expected ?? "fits";
  const base = { schemaVersion: 1, command: "generate", typepack: tid, case: sc.id, locale: loc,
    preset, presetDeclared: tp.presets.includes(preset), audition: Boolean(override) && !tp.presets.includes(preset), layout: sc.layout, count: Number(sc.count), inputDigest,
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
      degrade: { reason: `routing: the bounded router found no legal route for ${R.routing.unrouted?.length ?? "?"} of ${R.routing.edgeCount ?? "?"} edges under the current layout constraints (${(R.routing.unrouted ?? []).join(", ")}); this is a search result within the declared candidate shapes, not a proof that no layout exists`,
                 ladder: "spec §6 — " + R.routing.ladder.map((l) => `${l.step}) ${l.action}${l.applied ? " ✓" : " ✗"}`).join(" · ") },
      routing: R.routing,
      provenance: provenance({ producer: { kind: "generator", generatorDigest: sha(readFileSync(fileURLToPath(import.meta.url))) },
        inputs: [{ role: "typepack-input", digest: inputDigest }] }) };
    writeFileSync(rcp, JSON.stringify(degrade, null, 1) + "\n");
    console.log(`generate ${tid}/${sc.id}/${loc} — needs-split (routing); degrade receipt written`);
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
  if (tid === "topology-component") {
    for (const z of input.zones ?? []) { ids.push(z.id); for (const n of z.nodes ?? []) ids.push(n.id); }
    for (const e of input.edges ?? []) ids.push(e.id);
    if (input.boundary) ids.push("boundary");
  }
  return ids;
}
function verify(argv) {
  const opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const rcpP = opt("receipt"), svgP = opt("svg"), pairP = opt("pair");
  if (!rcpP) { console.error("usage: generate.mjs verify --receipt <json> [--svg <svg>] [--pair <receipt>]"); process.exit(2); }
  const rcp = JSON.parse(readFileSync(rcpP, "utf8"));
  const errors = [];
  const { input, inputDigest } = loadCase(rcp.typepack, String(rcp.case).replace(`${rcp.typepack}-`, ""));
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
