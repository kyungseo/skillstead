#!/usr/bin/env node
// route-orthogonal.mjs — 방향 있는 연결선을 결정적으로 배선한다.
//
// 이 모듈이 소유하는 것은 **배선 문법**이다: node별 side port 선택, corridor·lane 할당,
// rounded orthogonal path, arrowhead와 target clearance. 개별 좌표 patch는 없다 —
// 좌표는 전부 여기서 계산되고, 호출자는 배선 수요(reserve)를 받아 배치를 넓힐 뿐이다.
//
// 배선 규칙(요약):
//   1) 주 흐름은 top→down 한 방향으로 고정한다.
//   2) port는 dominant axis와 의미 방향이 정한다 — 세로 이동은 top/bottom, 가로 이동은 left/right.
//      한 변에 여러 edge가 붙으면 attach point를 균등 분산하고 최소 간격을 강제한다(fan-out).
//   3) 세로 이동은 zone 사이 corridor의 **lane**을 하나씩 차지한다. lane은 겹치지 않는다.
//   4) 한 zone을 건너뛰는 edge는 지나가는 zone을 관통하지 않고 **side channel**로 우회한다.
//   5) 같은 행에서 인접하지 않은 두 node는 그 사이 node를 관통하지 않고 zone 안 bypass lane을 쓴다.
//   6) 교차가 남으면 덜 중요한 선(async/secondary, 동률이면 뒤에 선언된 선)에 hop을 넣는다.
//   7) 합법 경로를 못 찾으면 겹쳐 그리지 않고 degrade ladder를 적용하고, 그래도 안 되면 needs-split.
//
// 좌표는 호출자가 준 절대 좌표계를 그대로 쓴다. 이 모듈은 SVG를 만들지 않고 **경로와 근거**를
// 돌려준다(문자열 조립은 호출자 몫, 감사는 auditTopology가 산출물에서 다시 잰다).

export const ROUTE_DEFAULTS = {
  laneGap: 12,        // 나란히 달리는 선 사이 최소 간격 — 각 선이 독립적으로 추적돼야 한다
  portGap: 12,        // 한 변에서 attach point 사이 최소 간격
  targetGap: 10,      // arrow tip과 target 경계 사이 간격(spec 8–12px)
  stub: 24,           // 우회 시 port에서 빠져나오는 직선(= endpointStub)
  radius: 8,          // 모서리 quarter-arc 반경
  hopRadius: 6,
  maxBends: 5,        // stub·lane·stub 구조에서 나올 수 있는 최대 꺾임
  corridorMargin: 14, // corridor 위아래로 남기는 여백
  channelMargin: 16,  // side channel과 zone 사이 여백
  maxHops: 6,
  // 아래 길이는 외부 수치를 옮겨 온 것이 아니라 **우리 arrow scale과 모서리 반경에서 유도**한다.
  portInset: 16,          // = 2×radius. 둥근 모서리를 피해 port를 두는 여백
  minSegment: 16,         // = 2×radius. 두 모서리가 한 구간을 나눠 가질 수 있는 최소 길이
  minInteriorSegment: 24, // = 3×radius. 꺾임과 꺾임 사이가 이보다 짧으면 꺾임이 아니라 흠집으로 읽힌다
  endpointStub: 24,       // = markerWidth(11.25) + targetGap(10) + 여유. 화살촉이 직선 위에 온전히 앉는다
  portSpreadStep: 12,     // = laneGap. 같은 변의 port는 이 간격으로 **대칭** 분산한다
  collinearOverlapMax: 8, // = radius. 무관한 두 선이 이만큼 나란히 겹치면 한 선으로 읽힌다
  outerClearance: 14,     // = laneGap + stroke 한 쌍. container border와 route가 한 선으로 붙어 보이지 않는 최소 간격
  labelPad: 10,           // label bounds를 이만큼 부풀려 obstacle로 쓴다(글자와 선의 독립 간격)
  minShaft: 26,      // marker 뒤로 실제 선이 보여야 한다(authoring §3)
};

const K = ROUTE_DEFAULTS;
const r1 = (v) => Math.round(v * 10) / 10;
const byId = (list) => new Map(list.map((x) => [x.id, x]));

// --- 배선 수요 ---------------------------------------------------------------
// 배치 전에 "이 edge 집합을 그리려면 어디에 얼마나 공간이 필요한가"를 먼저 답한다.
// 배치가 먼저 확정되고 배선이 그 틈에 끼워 맞춰지면, 결국 관통·중첩으로 끝난다.
export function planChannels({ zoneOrder, nodeZone, nodeIndex, edges }) {
  const zi = new Map(zoneOrder.map((z, i) => [z, i]));
  const corridorLanes = new Map();   // corridor index(=위 zone index) -> lane 수
  const intraLanes = new Map();      // zone id -> bypass lane 수
  const sideLanes = { left: 0, right: 0 };
  const classified = [];
  for (const e of edges) {
    const a = zi.get(nodeZone.get(e.from)), b = zi.get(nodeZone.get(e.to));
    if (a === undefined || b === undefined) { classified.push({ ...e, kindPath: "unknown" }); continue; }
    if (a === b) {
      // 같은 행에서 인접하지 않으면 사이 node를 관통하지 않도록 bypass lane이 필요하다.
      const gap = Math.abs((nodeIndex.get(e.from) ?? 0) - (nodeIndex.get(e.to) ?? 0));
      classified.push({ ...e, kindPath: "intra", zone: nodeZone.get(e.from), direct: gap <= 1 });
    } else if (Math.abs(a - b) === 1) {
      classified.push({ ...e, kindPath: "adjacent", corridor: Math.min(a, b), down: b > a });
    } else {
      // zone을 건너뛰는 edge: 출발 corridor → side channel → 도착 corridor로 우회한다.
      const down = b > a;
      classified.push({ ...e, kindPath: "skip", from_i: a, to_i: b, down,
        corridorOut: down ? a : a - 1, corridorIn: down ? b - 1 : b, side: down ? "right" : "left" });
    }
  }
  const bump = (i) => corridorLanes.set(i, (corridorLanes.get(i) ?? 0) + 1);
  for (const e of classified) {
    if (e.kindPath === "adjacent") bump(e.corridor);
    else if (e.kindPath === "skip") { bump(e.corridorOut); bump(e.corridorIn); sideLanes[e.side] += 1; }
    else if (e.kindPath === "intra" && !e.direct) intraLanes.set(e.zone, (intraLanes.get(e.zone) ?? 0) + 1);
  }
  const corridorHeight = (i) => {
    const n = corridorLanes.get(i) ?? 0;
    return n === 0 ? 2 * K.corridorMargin : 2 * K.corridorMargin + (n - 1) * K.laneGap;
  };
  const channelWidth = (side) => (sideLanes[side] === 0 ? 0 : K.channelMargin + (sideLanes[side] - 1) * K.laneGap + K.stub);
  const directPairs = new Map();   // zone id -> 직결 intra edge 수
  for (const e of classified) if (e.kindPath === "intra" && e.direct)
    directPairs.set(e.zone, (directPairs.get(e.zone) ?? 0) + 1);
  // 직결 connector가 지나갈 자리: target gap 양쪽 + 최소 shaft
  const nodeGap = (zid) => (directPairs.get(zid) ? 2 * K.targetGap + K.minShaft : 16);
  return { classified, corridorLanes, intraLanes, sideLanes, corridorHeight, channelWidth, directPairs, nodeGap };
}

// 진단마다 "무엇을 바꾸면 되는지" 하나씩만 제안한다 — 전체를 다시 그리지 않기 위해서다.
function fixesFor(code) {
  switch (code) {
    case "R-THROUGH": return ["reflow the row so the endpoints share a column", "let this secondary edge use the outer corridor"];
    case "R-MICRO-DOGLEG": case "R-ENDPOINT-STUB": return ["slide the ports to a common coordinate", "widen the gap between the two rows"];
    case "R-COLLINEAR": case "R-LANE": return ["assign the later edge to the next lane", "spread the shared endpoint ports"];
    case "R-MONOTONIC": return ["declare this edge as a return path", "reorder the zones so the flow stays monotonic"];
    default: return ["reduce the edge set on this page", "split the page"];
  }
}

// --- 배치 정렬 요청 ------------------------------------------------------------
// routing이 배치 결과를 무조건 받아들이면 주 흐름이 지그재그가 된다. primary edge가
// 직선으로 이어질 수 있도록 **행 안에서 slot 순서를 바꿔** 같은 column을 확보한다.
// (좌표를 임의로 옮기지 않는다 — 행은 여전히 등간격 group이다.)
export function alignRows({ zoneOrder, nodeOrder, nodeZone, edges }) {
  const order = new Map([...nodeOrder].map(([z, list]) => [z, [...list]]));
  const zi = new Map(zoneOrder.map((z, i) => [z, i]));
  const moves = [];
  for (const e of edges) {
    if ((e.weight ?? "primary") !== "primary") continue;          // 우회는 secondary의 몫이다
    const za = nodeZone.get(e.from), zb = nodeZone.get(e.to);
    if (za === undefined || zb === undefined || za === zb) continue;
    if (Math.abs(zi.get(za) - zi.get(zb)) !== 1) continue;
    const A = order.get(za), B = order.get(zb);
    if (!A || !B || A.length !== B.length) continue;               // 행 크기가 다르면 slot이 대응하지 않는다
    const ia = A.indexOf(e.from), ib = B.indexOf(e.to);
    if (ia < 0 || ib < 0 || ia === ib) continue;
    [B[ia], B[ib]] = [B[ib], B[ia]];                               // 같은 slot으로 맞춘다
    moves.push({ edge: e.id, zone: zb, moved: e.to, from: ib, to: ia });
  }
  return { order, moves };
}

// --- 경로 생성 ---------------------------------------------------------------
// 비용 순서(사전식): ① 꺾임 수 ② lane 이동량 ③ 선언 순서.
// 장애물이 없으면 직선이 이긴다 — 작은 좌표 이동을 아끼려고 꺾지 않는다.
export function routeEdges({ nodes, zones, plan, frame, degradeLevel = 0 }) {
  const problems = [], routes = [], attempts = [], diagnostics = [];
  const active = plan.classified.filter((e) => degradeLevel < 3 || (e.weight ?? "primary") !== "secondary");
  const demoted = plan.classified.filter((e) => !active.includes(e));
  const obstacles = [
    ...Object.entries(nodes).map(([id, b]) => ({ id, kind: "node", x: b.x, y: b.y, w: b.w, h: b.h })),
    ...zones.filter((z) => z.labelBox).map((z) => ({ id: `${z.id}-label`, kind: "zone-label", ...z.labelBox })),
  ];
  // 흐름 축(top→down)을 각 edge에 실어 준다 — 단조성 판정의 기준이다.
  for (const e of active) {
    const A = nodes[e.from], B = nodes[e.to];
    if (A && B) e.flowAxis = (B.y + B.h / 2) - (A.y + A.h / 2) >= 0 ? 1 : -1;
  }
  // primary를 먼저 배선한다 — 주 흐름이 직선 자리를 먼저 가진다.
  const ordered = [...active].sort((a, b) =>
    ((a.weight ?? "primary") === "primary" ? 0 : 1) - ((b.weight ?? "primary") === "primary" ? 0 : 1));

  const placed = [];                       // 이미 확정된 경로(그와 겹치는 lane은 쓸 수 없다)
  const usedPorts = new Map();             // `${node}|${side}` -> [좌표]

  for (const e of ordered) {
    const A = nodes[e.from], B = nodes[e.to];
    if (!A || !B) { problems.push(`edge ${e.id}: unknown endpoint`); continue; }
    e.__zones = zones;
    const isReturn = e.flowAxis < 0;
    if (isReturn && (e.weight ?? "primary") === "primary") {
      diagnostics.push({ code: "R-MONOTONIC", subject: e.id,
        evidence: { note: "a primary edge runs against the page flow" },
        supportedFixes: fixesFor("R-MONOTONIC") });
      problems.push(`edge ${e.id}: primary flow must stay monotonic — declare a return path or reorder the zones`);
      continue;
    }
    const all = candidates(e, A, B, nodes, zones, frame, usedPorts, { isReturn });
    if (all.capOverflow) {
      // 후보 공간이 안전 상한을 넘었다 — 잘라내고 "없다"고 말하지 않는다.
      diagnostics.push({ ...all.capOverflow, supportedFixes: ["narrow the allowed port interval", "increase the lane gap"] });
      problems.push(`edge ${e.id}: the allowed port interval yields more candidates than the safety cap — narrow the interval instead of truncating the search`);
      continue;
    }
    // 되돌이는 주 흐름과 같은 축도, 같은 면도 쓰지 않는다 — 반대 방향 화살촉이 한 면에 몰리면 읽히지 않는다.
    const cands = isReturn ? all.filter((c) => c.kind === "side-channel") : all;
    const tried = [];
    let chosen = null;
    for (const c of cands) {
      const why = reject(c, e, obstacles, placed);
      tried.push({ shape: c.kind, bends: c.bends, travel: r1(c.travel), ok: !why,
        code: why?.code ?? null, reason: why?.why ?? null });
      if (!why) { chosen = c; break; }
    }
    attempts.push({ edge: e.id, candidates: tried });
    if (!chosen) {
      const best = tried.reduce((m, t) => (m && m.bends <= t.bends ? m : t), null);
      diagnostics.push({ code: "R-NO-ROUTE", subject: e.id,
        evidence: { candidates: tried.length, closest: best?.shape ?? null, blocking: best?.code ?? null, detail: best?.reason ?? null },
        supportedFixes: fixesFor(best?.code) });
      problems.push(`edge ${e.id}: no legal route among ${tried.length} declared candidate shapes (closest: ${best?.shape} — ${best?.reason})`);
      continue;
    }
    for (const [nid, side, pt] of chosen.ports) {
      const k = `${nid}|${side}`;
      usedPorts.set(k, [...(usedPorts.get(k) ?? []), side === "top" || side === "bottom" ? pt.x : pt.y]);
    }
    const rt = { id: e.id, from: e.from, to: e.to, kindPath: chosen.kind, role: isReturn ? "return" : "flow",
      sideFrom: chosen.sideFrom, sideTo: chosen.sideTo, weight: e.weight ?? "primary",
      style: e.dashed ? "dashed" : "solid", points: chosen.points, bends: chosen.bends,
      travel: r1(chosen.travel), targetGap: K.targetGap, lane: chosen.lane ?? null, hops: [] };
    routes.push(rt); placed.push(rt);
  }

  // 남은 교차는 덜 중요한 선에 다리를 놓는다(교차 자체를 피할 후보가 없을 때만 여기 온다)
  const prio = (rt) => (rt.style === "dashed" ? 0 : 1) + (rt.weight === "secondary" ? 0 : 1);
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const A = routes[i], B = routes[j];
    const shares = A.from === B.from || A.from === B.to || A.to === B.from || A.to === B.to;
    for (const [a1, a2] of segments(A.points)) for (const [b1, b2] of segments(B.points)) {
      const x = crossPoint(a1, a2, b1, b2);
      if (!x || shares) continue;
      const lower = prio(A) <= prio(B) ? A : B;
      const horizontal = lower === A ? Math.abs(a1.y - a2.y) < 0.01 : Math.abs(b1.y - b2.y) < 0.01;
      lower.hops.push({ x: r1(x.x), y: r1(x.y), axis: horizontal ? "h" : "v" });
    }
  }
  const hopCount = routes.reduce((s, rt) => s + rt.hops.length, 0);
  if (hopCount > K.maxHops) problems.push(`${hopCount} crossings need hops, over the ${K.maxHops} budget — the layout, not the line, is wrong`);
  const styles = new Set(routes.map((rt) => rt.style));
  return { routes, problems, attempts, diagnostics, demoted, hopCount, degradeLevel,
    legendRequired: styles.has("solid") && styles.has("dashed") };
}

// 후보 생성 — 꺾임이 적은 것부터. 좌표는 전부 여기서 계산한다.
// 지배 축 한 방향만 만들면 "그 방향이 막혔다"는 이유로 멀쩡한 1-bend를 놓친다.
function candidates(e, A, B, nodes, zones, frame, usedPorts, opt = {}) {
  const out = [];
  const dx = (B.x + B.w / 2) - (A.x + A.w / 2), dy = (B.y + B.h / 2) - (A.y + A.h / 2);
  const vOut = dy > 0 ? "bottom" : "top", vIn = dy > 0 ? "top" : "bottom";
  const hOut = dx > 0 ? "right" : "left", hIn = dx > 0 ? "left" : "right";
  const vertical = Math.abs(dy) >= Math.abs(dx);
  // allowedPortInterval: layout이 label bounds·node bounds·clearance에서 이미 증명한
  // **합법 port 구간**이다. router는 그 안에서만 후보를 만들고, 없으면 기존과 완전히 같다.
  // 구간은 node의 실제 port 범위와 교집합을 내며, 교집합이 비면 fail-closed다.
  const allow = e.allowedPortInterval ?? null;
  const ivRaw = (n, side) => side === "top" || side === "bottom"
    ? { lo: n.x + K.portInset, hi: n.x + n.w - K.portInset, axis: "x" }
    : { lo: n.y + K.portInset, hi: n.y + n.h - K.portInset, axis: "y" };
  const iv = (n, side) => {
    const base = ivRaw(n, side);
    const end = n === A ? allow?.from : allow?.to;
    if (!end || end.axis !== base.axis) return base;
    const lo = Math.max(base.lo, Number(end.lo)), hi = Math.min(base.hi, Number(end.hi));
    return { lo, hi, axis: base.axis, constrained: true, empty: lo > hi };
  };
  const at = (n, side, v) => side === "top" ? { x: v, y: n.y }
    : side === "bottom" ? { x: v, y: n.y + n.h }
    : side === "left" ? { x: n.x, y: v } : { x: n.x + n.w, y: v };
  const tip = (n, side, v) => side === "top" ? { x: v, y: n.y - K.targetGap }
    : side === "bottom" ? { x: v, y: n.y + n.h + K.targetGap }
    : side === "left" ? { x: n.x - K.targetGap, y: v } : { x: n.x + n.w + K.targetGap, y: v };
  const free = (nid, side, v) => !(usedPorts.get(`${nid}|${side}`) ?? []).some((u) => Math.abs(u - v) < K.portGap);
  const center = (n, axis) => axis === "x" ? n.x + n.w / 2 : n.y + n.h / 2;
  // 원하는 자리부터 바깥으로 훑어 **비어 있는** port를 고른다 — 자리가 찼다고 후보를 버리지 않는다.
  const pick = (nid, n, side, wish) => {
    const i = iv(n, side);
    for (const v of nudge(clamp(wish, i.lo, i.hi), i.lo, i.hi)) if (free(nid, side, v)) return v;
    return null;
  };

  // ① 0-bend — port 구간이 겹치면 공통 좌표를 골라 완전한 직선으로 잇는다(sliding port).
  //    주 흐름을 직선으로 확보하는 것이 이 router의 첫 번째 규칙이다.
  for (const [sf, st] of [[vOut, vIn], [hOut, hIn]]) {
    const a = iv(A, sf), b = iv(B, st);
    if (a.axis !== b.axis) continue;
    const lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    if (lo > hi) continue;
    // 동률인 0-bend 후보가 여럿이면 "어느 중심을 지키는가"로 고른다:
    //   ① 같은 side에 다른 연결이 없으면 source center
    //   ② source center가 target 구간 밖이면 target center
    //   ③ 둘 다 불가능할 때만 구간 중앙
    const sc = center(A, a.axis), tc = center(B, b.axis);
    const shared = (usedPorts.get(`${e.from}|${sf}`) ?? []).length > 0 || (usedPorts.get(`${e.to}|${st}`) ?? []).length > 0;
    const wish = !shared && sc >= lo && sc <= hi ? sc
      : (tc >= lo && tc <= hi ? tc : (lo + hi) / 2);
    // 겹치는 구간 안에서 **여러 직선 후보**를 낸다 — 첫 좌표가 장애물(예: zone label)에 막혔다고
    // 직선이라는 모양 자체를 포기하면, 옆으로 조금만 옮기면 되는 경우에도 꺾이게 된다.
    // 후보 수는 임의 상수가 아니라 **구간 폭 / lane gap**에서 나온다 — 구간이 좁으면 적고
    // 넓으면 그만큼 많다. 순서는 wish에서 바깥으로, 즉 straight-first와 결정성을 유지한다.
    // 후보 수는 구간 폭에서 나온다. 안전 상한에 닿으면 **조용히 잘라내지 않고** 진단으로 남긴다 —
    // 잘린 뒤 "후보가 없었다"고 보고하면 실패 근거가 거짓이 된다.
    const want = Math.max(1, Math.floor((hi - lo) / K.portSpreadStep) + 1);
    const CAND_CAP = 64;
    if (want > CAND_CAP) {
      out.capOverflow = { code: "R-CANDIDATE-CAP", subject: e.id,
        evidence: { interval: [r1(lo), r1(hi)], step: K.portSpreadStep, want, cap: CAND_CAP } };
      return out;
    }
    const cap = want;
    let made = 0;
    for (const v of nudge(clamp(wish, lo, hi), lo, hi)) {
      if (!free(e.from, sf, v) || !free(e.to, st, v)) continue;
      const p0 = at(A, sf, v), p1 = tip(B, st, v);
      out.push(mk("straight", [p0, p1], sf, st, [[e.from, sf, p0], [e.to, st, p1]]));
      if (++made >= cap) break;
    }
  }
  // ② 1-bend — 한 축으로 나가 다른 축으로 들어간다. 두 조합을 모두 만든다.
  for (const [sf, st] of [[vOut, hIn], [hOut, vIn]]) {
    const a = iv(A, sf), b = iv(B, st);
    const v0 = pick(e.from, A, sf, center(A, a.axis)), v1 = pick(e.to, B, st, center(B, b.axis));
    if (v0 == null || v1 == null) continue;
    const p0 = at(A, sf, v0), p2 = tip(B, st, v1);
    const corner = a.axis === "x" ? { x: p0.x, y: p2.y } : { x: p2.x, y: p0.y };
    out.push(mk("elbow", [p0, corner, p2], sf, st, [[e.from, sf, p0], [e.to, st, p2]]));
  }
  // ③ 2-bend — 중간 lane을 지나 같은 면으로 들어간다(정당한 dogleg)
  for (const [sf, st] of [[vOut, vIn], [hOut, hIn]]) {
    const a = iv(A, sf), b = iv(B, st);
    if (a.axis !== b.axis) continue;
    const v0 = pick(e.from, A, sf, center(A, a.axis)), v1 = pick(e.to, B, st, center(B, b.axis));
    if (v0 == null || v1 == null) continue;
    const p0 = at(A, sf, v0), p3 = tip(B, st, v1);
    const mid = a.axis === "x" ? (p0.y + p3.y) / 2 : (p0.x + p3.x) / 2;
    const c1 = a.axis === "x" ? { x: p0.x, y: mid } : { x: mid, y: p0.y };
    const c2 = a.axis === "x" ? { x: p3.x, y: mid } : { x: mid, y: p3.y };
    out.push(mk("dogleg", [p0, c1, c2, p3], sf, st, [[e.from, sf, p0], [e.to, st, p3]], mid));
  }
  // ④ side channel — 우회. **경로 모양은 선언한 port 면에서 유도한다**(지배 축이 아니라).
  //    좌/우 면으로 나가면 첫 구간은 가로 바깥, 마지막 구간은 가로 안쪽이어야 한다.
  const hasZones = zones.length > 0;
  const zx1 = hasZones ? Math.min(...zones.map((z) => z.x)) : frame.x + K.channelMargin;
  const zx2 = hasZones ? Math.max(...zones.map((z) => z.x + z.w)) : frame.x + frame.w - K.channelMargin;
  const zy1 = hasZones ? Math.min(...zones.map((z) => z.y)) : frame.y + K.channelMargin;
  const zy2 = hasZones ? Math.max(...zones.map((z) => z.y + z.h)) : frame.y + frame.h - K.channelMargin;
  const chanX = [hasZones ? zx2 + K.outerClearance : frame.x + frame.w - K.channelMargin,
                 hasZones ? zx1 - K.outerClearance : frame.x + K.channelMargin];
  const chanY = [hasZones ? zy2 + K.outerClearance : frame.y + frame.h - K.channelMargin,
                 hasZones ? zy1 - K.outerClearance : frame.y + K.channelMargin];
  const insideFrameX = (c) => c >= frame.x + K.minSegment && c <= frame.x + frame.w - K.minSegment
    && !(hasZones && c > zx1 - K.outerClearance && c < zx2 + K.outerClearance);
  const insideFrameY = (c) => c >= frame.y + K.minSegment && c <= frame.y + frame.h - K.minSegment
    && !(hasZones && c > zy1 - K.outerClearance && c < zy2 + K.outerClearance);

  if (opt.isReturn) {
    // 되돌이: 좌/우 면으로 나가 세로 channel을 타고 같은 면으로 들어온다.
    for (const side of ["left", "right"]) {
      const cx = side === "left" ? chanX[1] : chanX[0];
      if (!insideFrameX(cx)) continue;
      const a = iv(A, side), b = iv(B, side);
      const v0 = pick(e.from, A, side, center(A, a.axis)), v1 = pick(e.to, B, side, center(B, b.axis));
      if (v0 == null || v1 == null) continue;
      const p0 = at(A, side, v0), p3 = tip(B, side, v1);
      // 첫 구간 가로 바깥 → 세로 channel → 마지막 구간 가로 안쪽
      if (side === "left" ? !(cx < p0.x && cx < p3.x) : !(cx > p0.x && cx > p3.x)) continue;
      out.push(mk("side-channel", [p0, { x: cx, y: p0.y }, { x: cx, y: p3.y }, p3],
        side, side, [[e.from, side, p0], [e.to, side, p3]], cx));
    }
  } else if (vertical) {
    for (const cx of chanX) {
      if (!insideFrameX(cx)) continue;
      const a = iv(A, vOut), b = iv(B, vIn);
      const v0 = pick(e.from, A, vOut, center(A, a.axis)), v1 = pick(e.to, B, vIn, center(B, b.axis));
      if (v0 == null || v1 == null) continue;
      const p0 = at(A, vOut, v0), p5 = tip(B, vIn, v1);
      const yOut = dy > 0 ? p0.y + K.endpointStub : p0.y - K.endpointStub;
      const yIn = dy > 0 ? p5.y - K.endpointStub : p5.y + K.endpointStub;
      out.push(mk("side-channel", [p0, { x: p0.x, y: yOut }, { x: cx, y: yOut }, { x: cx, y: yIn }, { x: p5.x, y: yIn }, p5],
        vOut, vIn, [[e.from, vOut, p0], [e.to, vIn, p5]], cx));
    }
  } else {
    for (const cy of chanY) {
      if (!insideFrameY(cy)) continue;
      const a = iv(A, hOut), b = iv(B, hIn);
      const v0 = pick(e.from, A, hOut, center(A, a.axis)), v1 = pick(e.to, B, hIn, center(B, b.axis));
      if (v0 == null || v1 == null) continue;
      const p0 = at(A, hOut, v0), p5 = tip(B, hIn, v1);
      const xOut = dx > 0 ? p0.x + K.endpointStub : p0.x - K.endpointStub;
      const xIn = dx > 0 ? p5.x - K.endpointStub : p5.x + K.endpointStub;
      out.push(mk("side-channel", [p0, { x: xOut, y: p0.y }, { x: xOut, y: cy }, { x: xIn, y: cy }, { x: xIn, y: p5.y }, p5],
        hOut, hIn, [[e.from, hOut, p0], [e.to, hIn, p5]], cy));
    }
  }
  // 사전식 정렬: 꺾임 수 → lane 이동량 → 모양 이름(결정성)
  const rank = (k) => ["straight", "elbow", "dogleg", "side-channel"].indexOf(k);
  return out.sort((p, q) => p.bends - q.bends || rank(p.kind) - rank(q.kind) || p.travel - q.travel);
}

function mk(kind, pts, sideFrom, sideTo, ports, lane = null) {
  const points = dedupe(pts);
  let travel = 0;
  for (const [a, b] of segments(points)) travel += Math.hypot(b.x - a.x, b.y - a.y);
  const bends = Math.max(0, points.length - 2);
  return { kind: bends === 0 ? "straight" : kind, bends, travel, points, sideFrom, sideTo, ports, lane };
}
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// 겹치는 구간 안에서 원하는 좌표부터 바깥으로 훑는다 — 결정적 순서
// 같은 변에 여러 connector가 붙으면 중심을 기준으로 **대칭·결정적**으로 분산한다.
// 연결이 하나뿐이면 분산하지 않는다 — 직선을 흔들 이유가 없다.
function nudge(v, lo, hi) {
  const out = [v];
  for (let d = K.portSpreadStep; d <= hi - lo; d += K.portSpreadStep) {
    if (v + d <= hi) out.push(v + d);
    if (v - d >= lo) out.push(v - d);
  }
  return out;
}
// 후보를 떨어뜨리는 이유를 문자열로 돌려준다(통과면 null) — 실패 근거가 곧 receipt다
function reject(c, e, obstacles, placed) {
  const segs = segments(c.points);
  if (!segs.length) return { code: "R-DEGENERATE", why: "degenerate path" };
  const len = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);
  // 첫·마지막 구간은 화살촉과 port가 앉을 직선이다.
  if (len(segs[0]) < K.endpointStub)
    return { code: "R-ENDPOINT-STUB", why: `first segment ${r1(len(segs[0]))}px < ${K.endpointStub}px endpoint stub` };
  if (len(segs[segs.length - 1]) < K.endpointStub)
    return { code: "R-ENDPOINT-STUB", why: `last segment ${r1(len(segs[segs.length - 1]))}px < ${K.endpointStub}px endpoint stub` };
  for (let i = 1; i < segs.length - 1; i++) {
    if (len(segs[i]) < K.minInteriorSegment)
      return { code: "R-MICRO-DOGLEG", why: `interior segment ${r1(len(segs[i]))}px < ${K.minInteriorSegment}px — a jog this short reads as a kink, not a turn` };
  }
  for (const sg of segs) if (len(sg) < K.minSegment)
    return { code: "R-MIN-SEGMENT", why: `segment ${r1(len(sg))}px < ${K.minSegment}px` };
  // 주 흐름은 단조롭다 — primary가 흐름 축을 거슬러 올라가면 되돌이로 읽힌다.
  if ((e.weight ?? "primary") === "primary" && e.flowAxis) {
    const sign = Math.sign(e.flowAxis);
    for (const [a, b] of segs) {
      const step = b.y - a.y;
      if (Math.abs(step) > 0.5 && Math.sign(step) !== sign)
        return { code: "R-MONOTONIC", why: `primary flow reverses ${r1(Math.abs(step))}px against the page flow — return paths, not primary ones, use the outer corridor` };
    }
  }
  for (const ob of obstacles) {
    if (ob.kind === "node" && (ob.id === e.from || ob.id === e.to)) continue;
    for (const [a, b] of segs) {
      if (!segRect(a, b, ob)) continue;
      return { code: "R-THROUGH", why: `crosses ${ob.kind} ${ob.id}` };
    }
  }
  {
    const dir = (p, q) => (Math.abs(p.y - q.y) < 0.01 ? (q.x > p.x ? "right" : "left") : (q.y > p.y ? "down" : "up"));
    const outward = { left: "left", right: "right", top: "up", bottom: "down" };
    const inward = { left: "right", right: "left", top: "down", bottom: "up" };
    const first = dir(segs[0][0], segs[0][1]), last = dir(segs[segs.length - 1][0], segs[segs.length - 1][1]);
    if (first !== outward[c.sideFrom])
      return { code: "R-PORT-DIR", why: `leaves the ${c.sideFrom} face heading ${first} — the first segment must run ${outward[c.sideFrom]}` };
    if (last !== inward[c.sideTo])
      return { code: "R-PORT-DIR", why: `enters the ${c.sideTo} face heading ${last} — the last segment must run ${inward[c.sideTo]}` };
  }
  for (const z of (e.__zones ?? [])) {
    const edgesOf = [
      { axis: "y", at: z.y, from: z.x, to: z.x + z.w },                 // top
      { axis: "y", at: z.y + z.h, from: z.x, to: z.x + z.w },           // bottom
      { axis: "x", at: z.x, from: z.y, to: z.y + z.h },                 // left
      { axis: "x", at: z.x + z.w, from: z.y, to: z.y + z.h },           // right
    ];
    for (const [a, b] of segs) {
      const horizontal = Math.abs(a.y - b.y) < 0.01, vertical = Math.abs(a.x - b.x) < 0.01;
      for (const ed of edgesOf) {
        if (ed.axis === "y" && horizontal) {
          const gap = Math.abs(a.y - ed.at);
          const ov = Math.min(Math.max(a.x, b.x), ed.to) - Math.max(Math.min(a.x, b.x), ed.from);
          if (gap < K.outerClearance && ov >= K.minInteriorSegment)
            return { code: "R-BORDER-RUN", why: `runs ${r1(gap)}px along the ${z.id} border for ${r1(ov)}px — a container border is not a corridor (needs ${K.outerClearance}px)` };
        }
        if (ed.axis === "x" && vertical) {
          const gap = Math.abs(a.x - ed.at);
          const ov = Math.min(Math.max(a.y, b.y), ed.to) - Math.max(Math.min(a.y, b.y), ed.from);
          if (gap < K.outerClearance && ov >= K.minInteriorSegment)
            return { code: "R-BORDER-RUN", why: `runs ${r1(gap)}px along the ${z.id} border for ${r1(ov)}px — a container border is not a corridor (needs ${K.outerClearance}px)` };
        }
      }
    }
  }
  for (const rt of placed) {
    const related = rt.from === e.from || rt.from === e.to || rt.to === e.from || rt.to === e.to;
    for (const [a1, a2] of segs) for (const [b1, b2] of segments(rt.points)) {
      const ov = parallelOverlap(a1, a2, b1, b2);
      if (ov == null) continue;
      if (ov.gap >= K.laneGap - 0.51) continue;
      // 관계가 있는 선끼리는 port 분산으로 이미 떨어져 있어야 하고, 무관한 선은 겹치면 한 선으로 읽힌다.
      if (ov.overlap >= (related ? K.minInteriorSegment : K.collinearOverlapMax))
        return { code: related ? "R-LANE" : "R-COLLINEAR",
          why: `runs ${r1(ov.gap)}px from route ${rt.id} for ${r1(ov.overlap)}px — ${related ? "same-endpoint lanes must stay one lane apart" : "unrelated lines this close read as one"}` };
    }
  }
  return null;
}

// 경로를 SVG path d로 — 모서리는 quarter-arc, 교차는 hop
export function pathData(route, radius = K.radius) {
  const p = route.points;
  if (p.length < 2) return "";
  let d = `M${r1(p[0].x)} ${r1(p[0].y)}`;
  let start = p[0];
  for (let i = 1; i < p.length - 1; i++) {
    const corner = p[i], next = p[i + 1];
    const r = Math.min(radius, dist(start, corner) / 2, dist(corner, next) / 2);
    const a = towards(corner, start, r), b = towards(corner, next, r);
    d += segTo(start, a, route) + ` Q${r1(corner.x)} ${r1(corner.y)} ${r1(b.x)} ${r1(b.y)}`;
    start = b;
  }
  return d + segTo(start, p[p.length - 1], route);
}
// 직선 구간 — 이 구간을 지나는 교차점에는 hop(반원)을 넣는다
function segTo(from, to, route) {
  const hops = (route.hops ?? []).filter((h) => onSeg(from, to, h));
  const horizontal = Math.abs(from.y - to.y) < 0.01;
  if (!hops.length) return ` L${r1(to.x)} ${r1(to.y)}`;
  const dir = horizontal ? Math.sign(to.x - from.x) : Math.sign(to.y - from.y);
  hops.sort((h1, h2) => (horizontal ? h1.x - h2.x : h1.y - h2.y) * dir);
  let out = "";
  for (const h of hops) {
    if (horizontal) {
      out += ` L${r1(h.x - dir * K.hopRadius)} ${r1(from.y)}`
           + ` a${K.hopRadius} ${K.hopRadius} 0 0 ${dir > 0 ? 1 : 0} ${r1(dir * 2 * K.hopRadius)} 0`;
    } else {
      out += ` L${r1(from.x)} ${r1(h.y - dir * K.hopRadius)}`
           + ` a${K.hopRadius} ${K.hopRadius} 0 0 ${dir > 0 ? 0 : 1} 0 ${r1(dir * 2 * K.hopRadius)}`;
    }
  }
  return out + ` L${r1(to.x)} ${r1(to.y)}`;
}

// --- 산출물 감사 -------------------------------------------------------------
// 의도가 아니라 **기록된 바이트**를 다시 잰다. 지원하는 경로 문법은 우리가 생성하는
// 절대 M/L/Q/a 부분집합이며, 그 밖의 문법은 통과가 아니라 "증명 불가"로 보고한다.
export function auditTopology(svg) {
  const errors = [], notes = [];
  const nodeRects = [...svg.matchAll(/<rect([^>]*?)data-entity="([^"]+)"([^>]*)\/>/g)]
    .map((m) => ({ id: m[2], ...numAttrs(m[1] + m[3]) }))
    .filter((n) => Number.isFinite(n.x) && Number.isFinite(n.width));
  const boxes = new Map(nodeRects.map((n) => [n.id, { x: n.x, y: n.y, w: n.width, h: n.height }]));
  const paths = [...svg.matchAll(/<path([^>]*?)data-route-id="([^"]+)"([^>]*)\/>/g)]
    .map((m) => { const at = m[1] + m[3]; return {
      id: m[2], attrs: at, d: (at.match(/\bd="([^"]+)"/) ?? [])[1] ?? "",
      from: (at.match(/data-route-from="([^"]+)"/) ?? [])[1],
      to: (at.match(/data-route-to="([^"]+)"/) ?? [])[1],
      weight: (at.match(/data-route-weight="([^"]+)"/) ?? [])[1] ?? "primary",
      role: (at.match(/data-route-role="([^"]+)"/) ?? [])[1] ?? null,
      marker: /marker-end="url\(#[^)]+\)"/.test(at),
      dashed: /stroke-dasharray=/.test(at),
    }; });
  const layersOnly = paths.length === 0;

  const polys = new Map();
  const hopPoints = [];
  for (const p of paths) {
    for (const h of hopArcs(p.d)) hopPoints.push(h);
    if (!p.marker) errors.push(`A-MARKER ${p.id}: directed edge has no marker-end`);
    const poly = parsePath(p.d);
    if (!poly) { notes.push(`route ${p.id}: path syntax outside the provable subset — unverified`); continue; }
    polys.set(p.id, poly);
    const tgt = boxes.get(p.to);
    if (tgt) {
      const tip = poly[poly.length - 1];
      const gap = rectGap(tip, tgt);
      if (gap < 8 - 0.51 || gap > 12 + 0.51)
        errors.push(`A-GAP ${p.id}: arrow tip is ${r1(gap)}px from ${p.to} (contract 8–12px)`);
    }
    let len = 0;
    for (const [a, c] of segments(poly)) len += Math.hypot(c.x - a.x, c.y - a.y);
    if (len < K.minShaft) errors.push(`A-SHAFT ${p.id}: drawn length ${r1(len)}px leaves no visible shaft behind the arrowhead (min ${K.minShaft}px)`);
    const segs = segments(poly), L = ([a, c]) => Math.hypot(c.x - a.x, c.y - a.y);
    if (segs.length && (L(segs[0]) < K.endpointStub || L(segs[segs.length - 1]) < K.endpointStub))
      errors.push(`A-STUB ${p.id}: an endpoint segment is shorter than the ${K.endpointStub}px stub — the arrowhead does not sit on a straight run`);
    for (let i = 1; i < segs.length - 1; i++) if (L(segs[i]) < K.minInteriorSegment)
      errors.push(`A-DOGLEG ${p.id}: interior segment ${r1(L(segs[i]))}px < ${K.minInteriorSegment}px (micro-dogleg)`);
    // 장애물이 없고 port 구간이 겹치는데 꺾였다면 직선을 놓친 것이다
    const src = boxes.get(p.from), dst = boxes.get(p.to);
    if (src && dst && segs.length > 1) {
      const overlapX = Math.min(src.x + src.w, dst.x + dst.w) - Math.max(src.x, dst.x) >= 2 * K.portInset;
      const overlapY = Math.min(src.y + src.h, dst.y + dst.h) - Math.max(src.y, dst.y) >= 2 * K.portInset;
      const between = [...boxes.entries()].some(([id, b]) => id !== p.from && id !== p.to &&
        (overlapX ? (b.x < Math.min(src.x + src.w, dst.x + dst.w) && b.x + b.w > Math.max(src.x, dst.x)
                     && b.y > Math.min(src.y + src.h, dst.y + dst.h) - 1 && b.y + b.h < Math.max(src.y, dst.y) + 1)
                  : (b.y < Math.min(src.y + src.h, dst.y + dst.h) && b.y + b.h > Math.max(src.y, dst.y)
                     && b.x > Math.min(src.x + src.w, dst.x + dst.w) - 1 && b.x + b.w < Math.max(src.x, dst.x) + 1)));
      if ((overlapX || overlapY) && !between && p.role !== "return")
        errors.push(`A-STRAIGHT ${p.id}: the endpoints share a free port interval but the route bends ${segs.length - 1} time(s) — a straight run was available`);
    }
    if (p.weight === "primary" && segs.length) {
      const dy = poly[poly.length - 1].y - poly[0].y;
      if (Math.abs(dy) > 1) {
        const sign = Math.sign(dy);
        for (const [a, c] of segs) if (Math.abs(c.y - a.y) > 0.5 && Math.sign(c.y - a.y) !== sign)
          { errors.push(`A-MONOTONIC ${p.id}: the primary path reverses against the page flow`); break; }
      }
    }
    for (const [id, b] of boxes) {
      if (id === p.from || id === p.to) continue;
      for (const [a, c] of segments(poly))
        if (segRect(a, c, { x: b.x, y: b.y, w: b.w, h: b.h })) { errors.push(`A-THROUGH ${p.id}: crosses node ${id}`); break; }
    }
  }
  // 교차·lane 중첩
  const ids = [...polys.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = polys.get(ids[i]), B = polys.get(ids[j]);
    const pa = paths.find((p) => p.id === ids[i]), pb = paths.find((p) => p.id === ids[j]);
    const shares = pa.from === pb.from || pa.from === pb.to || pa.to === pb.from || pa.to === pb.to;
    for (const [a1, a2] of segments(A)) for (const [b1, b2] of segments(B)) {
      const ov = parallelOverlap(a1, a2, b1, b2);
      if (ov && ov.gap < K.laneGap - 0.51 && ov.overlap >= (shares ? K.minInteriorSegment : K.collinearOverlapMax))
        errors.push(`${shares ? "A-LANE" : "A-COLLINEAR"} ${ids[i]}/${ids[j]}: parallel runs ${r1(ov.gap)}px apart overlap for ${r1(ov.overlap)}px`);
      const x = crossPoint(a1, a2, b1, b2);
      if (x && !shares && !bridged(x, hopPoints)) errors.push(`A-CROSS ${ids[i]}/${ids[j]}: unbridged crossing at ${r1(x.x)},${r1(x.y)}`);
    }
  }
  const labelBoxes = [...svg.matchAll(/data-label-bounds="([\d.,-]+)"/g)].map((m) => {
    const [x, y, w, h] = m[1].split(",").map(Number);
    return { x, y, w, h };
  });
  for (const [id, poly] of polys) for (const lb of labelBoxes)
    for (const [a, b] of segments(poly)) if (segRect(a, b, lb)) {
      errors.push(`A-LABEL ${id}: the route crosses a zone label box — drawing the label on top hides the connection instead of routing around it`);
      break;
    }
  if (layersOnly) { checkLayerOrder(svg, errors); return { errors, notes: ["no annotated routes in this artifact — paint layers still checked"] }; }
  // --- port 방향: 선언된 side가 아니라 **실제 첫·마지막 구간**으로 다시 계산한다 -----------
  for (const p of paths) {
    const poly = polys.get(p.id);
    if (!poly) continue;
    const src = boxes.get(p.from), dst = boxes.get(p.to);
    const segs2 = segments(poly);
    if (!segs2.length) continue;
    const dirOf = ([a, b]) => Math.abs(a.y - b.y) < 0.01 ? (b.x > a.x ? "right" : "left") : (b.y > a.y ? "down" : "up");
    const faceOf = (pt, box, gap) => {
      if (!box) return null;
      const near = (v, t) => Math.abs(v - t) <= gap + 0.6;
      if (near(pt.x, box.x) && pt.y > box.y - 1 && pt.y < box.y + box.h + 1) return "left";
      if (near(pt.x, box.x + box.w) && pt.y > box.y - 1 && pt.y < box.y + box.h + 1) return "right";
      if (near(pt.y, box.y) && pt.x > box.x - 1 && pt.x < box.x + box.w + 1) return "top";
      if (near(pt.y, box.y + box.h) && pt.x > box.x - 1 && pt.x < box.x + box.w + 1) return "bottom";
      return null;
    };
    const outward = { left: "left", right: "right", top: "up", bottom: "down" };
    const inward = { left: "right", right: "left", top: "down", bottom: "up" };
    const sFace = faceOf(poly[0], src, 0.6);
    const tFace = faceOf(poly[poly.length - 1], dst, 12);
    if (src && !sFace) errors.push(`A-PORT ${p.id}: the path does not start on a face of ${p.from}`);
    if (dst && !tFace) errors.push(`A-PORT ${p.id}: the arrowhead floats free of ${p.to} — it must approach one face`);
    if (sFace && dirOf(segs2[0]) !== outward[sFace])
      errors.push(`A-PORT-DIR ${p.id}: leaves the ${sFace} face heading ${dirOf(segs2[0])} — the first segment must run ${outward[sFace]}`);
    if (tFace && dirOf(segs2[segs2.length - 1]) !== inward[tFace])
      errors.push(`A-PORT-DIR ${p.id}: enters the ${tFace} face heading ${dirOf(segs2[segs2.length - 1])} — the last segment must run ${inward[tFace]}`);
  }
  checkLayerOrder(svg, errors);
  // --- visibility: 기하가 아니라 **가려지는지**를 따로 본다 ---------------------------
  // connector 뒤에 오는 불투명 면이 선 위를 덮으면, 선은 존재해도 끊겨 보인다.
  const opaque = [...svg.matchAll(/<rect([^>]*)\/>/g)].map((m) => {
    const at = m[1], f = (at.match(/\bfill="([^"]+)"/) ?? [])[1];
    if (!f || f === "none" || /fill-opacity="0(\.0+)?"/.test(at)) return null;
    const g = (k) => { const mm = at.match(new RegExp(`\\b${k}="(-?[\\d.]+)"`)); return mm ? Number(mm[1]) : NaN; };
    const r = { x: g("x"), y: g("y"), w: g("width"), h: g("height"), at: m.index };
    return [r.x, r.y, r.w, r.h].every(Number.isFinite) ? r : null;
  }).filter(Boolean);
  for (const p of paths) {
    const poly = polys.get(p.id);
    if (!poly) continue;
    const idx = svg.indexOf(`data-route-id="${p.id}"`);
    for (const r of opaque) {
      if (r.at < idx) continue;                       // 앞에 그려진 면은 선을 가리지 않는다
      if (r.x <= 0.5 && r.y <= 0.5) continue;        // 캔버스 바탕은 항상 맨 뒤에 있다
      for (const [a, b] of segments(poly)) if (segRect(a, b, r)) {
        errors.push(`A-OCCLUDED ${p.id}: an opaque surface drawn after the connector covers it at ${r1(a.x)},${r1(a.y)} — the line exists in geometry but reads as broken`);
        break;
      }
    }
  }
  const mixed = paths.some((p) => p.dashed) && paths.some((p) => !p.dashed);
  if (mixed && !/data-layout-role="legend"/.test(svg))
    errors.push("A-LEGEND artifact: solid and dashed connectors appear together but there is no legend");
  return { errors, notes };
}

// paint order는 선언이 아니라 **DOM 순서**로 검증한다.
// canvas → container 배경/테두리 → connector와 marker → node surface → icon·text·label·legend
function checkLayerOrder(svg, errors) {
  const LAYERS = ["containers", "connectors", "nodes", "annotations"];
  const marks = [...svg.matchAll(/<g[^>]*data-layer="([a-z]+)"/g)].map((m) => ({ name: m[1], at: m.index }));
  if (!marks.length) return;
  const seen = marks.map((m) => m.name);
  if (seen.join(",") !== LAYERS.join(","))
    errors.push(`A-LAYER-ORDER: paint layers appear as [${seen.join(", ")}] — the contract is [${LAYERS.join(", ")}]`);
  const spanOf = (name) => {
    const i = marks.findIndex((m) => m.name === name);
    if (i < 0) return null;
    return { from: marks[i].at, to: i + 1 < marks.length ? marks[i + 1].at : svg.length };
  };
  const conn = spanOf("connectors"), nodesSpan = spanOf("nodes"), ann = spanOf("annotations");
  for (const m of svg.matchAll(/<path[^>]*data-route-id="([^"]+)"/g))
    if (conn && (m.index < conn.from || m.index > conn.to))
      errors.push(`A-LAYER ${m[1]}: a connector is drawn outside the connectors layer`);
  // node surface 규칙은 **connector의 endpoint**에만 적용한다 — 선이 그 아래로 지나가야 하는 면이 그것뿐이다.
  const endpoints = new Set([...svg.matchAll(/data-route-(?:from|to)="([^"]+)"/g)].map((m) => m[1]));
  for (const m of svg.matchAll(/<rect[^>]*data-entity="([^"]+)"/g))
    if (nodesSpan && endpoints.has(m[1]) && (m.index < nodesSpan.from || m.index > nodesSpan.to))
      errors.push(`A-LAYER ${m[1]}: a connector endpoint surface is drawn outside the nodes layer`);
  for (const m of svg.matchAll(/data-layout-role="(zone-label|legend)"/g))
    if (ann && (m.index < ann.from || m.index > ann.to))
      errors.push(`A-LAYER ${m[1]}: an annotation is drawn outside the annotations layer`);
}

// --- geometry helpers --------------------------------------------------------
function numAttrs(s) {
  const g = (k) => { const m = s.match(new RegExp(`\\b${k}="(-?[\\d.]+)"`)); return m ? Number(m[1]) : NaN; };
  return { x: g("x"), y: g("y"), width: g("width"), height: g("height") };
}
function clearance(p, side, box) {
  if (side === "top") return { x: p.x, y: box.y - K.targetGap };
  if (side === "bottom") return { x: p.x, y: box.y + box.h + K.targetGap };
  if (side === "left") return { x: box.x - K.targetGap, y: p.y };
  return { x: box.x + box.w + K.targetGap, y: p.y };
}
function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push({ x: p.x, y: p.y });
  }
  // 일직선 위 중간점 제거
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) ||
        (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)) out.splice(i, 1);
    else i++;
  }
  return out;
}
export function segments(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  return out;
}
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
function towards(from, to, d) {
  const l = dist(from, to) || 1;
  return { x: from.x + (to.x - from.x) * d / l, y: from.y + (to.y - from.y) * d / l };
}
function onSeg(a, b, p) {
  const eps = 0.01;
  if (Math.abs(a.y - b.y) < eps) return Math.abs(p.y - a.y) < 1 && p.x > Math.min(a.x, b.x) + K.hopRadius && p.x < Math.max(a.x, b.x) - K.hopRadius;
  if (Math.abs(a.x - b.x) < eps) return Math.abs(p.x - a.x) < 1 && p.y > Math.min(a.y, b.y) + K.hopRadius && p.y < Math.max(a.y, b.y) - K.hopRadius;
  return false;
}
export function segRect(a, b, rect) {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  const rx2 = rect.x + (rect.w ?? rect.width), ry2 = rect.y + (rect.h ?? rect.height);
  const eps = 0.5;   // 경계에 스치는 것은 관통이 아니다
  return x2 > rect.x + eps && x1 < rx2 - eps && y2 > rect.y + eps && y1 < ry2 - eps;
}
function rectGap(p, box) {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w));
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h));
  return Math.hypot(dx, dy);
}
function crossPoint(a1, a2, b1, b2) {
  const aH = Math.abs(a1.y - a2.y) < 0.01, bH = Math.abs(b1.y - b2.y) < 0.01;
  if (aH === bH) return null;                 // 평행은 교차가 아니다(중첩은 별도 검사)
  const [h1, h2] = aH ? [a1, a2] : [b1, b2];
  const [v1, v2] = aH ? [b1, b2] : [a1, a2];
  const x = v1.x, y = h1.y;
  const within = x > Math.min(h1.x, h2.x) + 0.5 && x < Math.max(h1.x, h2.x) - 0.5 &&
                 y > Math.min(v1.y, v2.y) + 0.5 && y < Math.max(v1.y, v2.y) - 0.5;
  return within ? { x, y } : null;
}
function parallelOverlap(a1, a2, b1, b2) {
  const aH = Math.abs(a1.y - a2.y) < 0.01, bH = Math.abs(b1.y - b2.y) < 0.01;
  const aV = Math.abs(a1.x - a2.x) < 0.01, bV = Math.abs(b1.x - b2.x) < 0.01;
  if (aH && bH) {
    const overlap = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
    return overlap > 0 ? { gap: Math.abs(a1.y - b1.y), overlap } : null;
  }
  if (aV && bV) {
    const overlap = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
    return overlap > 0 ? { gap: Math.abs(a1.x - b1.x), overlap } : null;
  }
  return null;
}
function overlapParallel(a1, a2, b1, b2) {
  const aH = Math.abs(a1.y - a2.y) < 0.01, bH = Math.abs(b1.y - b2.y) < 0.01;
  const aV = Math.abs(a1.x - a2.x) < 0.01, bV = Math.abs(b1.x - b2.x) < 0.01;
  if (aH && bH) {
    const gap = Math.abs(a1.y - b1.y);
    const ov = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
    return gap < K.laneGap - 0.51 && ov > 2;
  }
  if (aV && bV) {
    const gap = Math.abs(a1.x - b1.x);
    const ov = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
    return gap < K.laneGap - 0.51 && ov > 2;
  }
  return false;
}
// hop(반원)이 놓인 자리 — 그 지점의 교차는 이미 다리를 놓은 것이다
function hopArcs(d) {
  const out = [];
  const toks = d.match(/[MLQa][^MLQa]*/g) ?? [];
  let cur = null;
  for (const t of toks) {
    const n = (t.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (t[0] === "M" || t[0] === "L") cur = { x: n[0], y: n[1] };
    else if (t[0] === "Q") cur = { x: n[2], y: n[3] };
    else if (t[0] === "a" && cur) { out.push({ x: cur.x + n[5] / 2, y: cur.y + n[6] / 2 }); cur = { x: cur.x + n[5], y: cur.y + n[6] }; }
  }
  return out;
}
const bridged = (p, hops) => hops.some((h) => Math.abs(h.x - p.x) <= K.hopRadius + 1.5 && Math.abs(h.y - p.y) <= K.hopRadius + 1.5);

// 우리가 생성하는 절대 M/L/Q/a 부분집합만 해석한다 — 그 밖은 null(증명 불가)
function parsePath(d) {
  if (!d || /[cshtCSHTVv]/.test(d.replace(/[Aa]/g, ""))) { /* H/V는 쓰지 않는다 */ }
  const toks = d.match(/[MLQa][^MLQa]*/g);
  if (!toks) return null;
  const pts = [];
  let cur = null, prevOp = null;
  for (const t of toks) {
    const op = t[0];
    const n = (t.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (op === "M") { cur = { x: n[0], y: n[1] }; pts.push(cur); }
    else if (op === "L") { cur = { x: n[0], y: n[1] }; pts.push(cur); }
    else if (op === "Q") {
      // quarter-arc는 **모서리**다: 호의 시작점을 꼭짓점(제어점)으로 되돌리고 호 자체는 구간으로 세지 않는다.
      pts.pop();
      pts.push({ x: n[0], y: n[1] });
      cur = { x: n[2], y: n[3] };
    }
    else if (op === "a" && cur) {
      // hop(반원)은 같은 직선 위의 다리다 — 꼭짓점으로 세면 12px짜리 가짜 곁가지가 생긴다.
      // 직전이 모서리(Q)였다면 그 꼭짓점은 지우지 않는다.
      if (prevOp === "L") pts.pop();
      cur = { x: cur.x + n[5], y: cur.y + n[6] };
    }
    else return null;
    prevOp = op;
  }
  return pts.length >= 2 ? pts : null;
}
