#!/usr/bin/env node
// route-orthogonal.mjs — routes directed connectors deterministically.
//
// What this module owns is the **routing grammar**: choosing a side port per node, allocating
// corridors and lanes, the rounded orthogonal path, the arrowhead and the target clearance. There
// are no one-off coordinate patches — every coordinate is computed here, and the caller only takes
// the routing demand (reserve) and widens its layout accordingly.
//
// The routing rules, in brief:
//   1) The main flow is fixed to one direction, top to bottom.
//   2) The port follows the dominant axis and the semantic direction — top/bottom for vertical
//      travel, left/right for horizontal. When several edges attach to one side the attach points
//      are spread evenly and a minimum spacing is enforced (fan-out).
//   3) Vertical travel takes one **lane** each in the corridor between zones. Lanes never overlap.
//   4) An edge skipping a zone detours through a **side channel** rather than cutting through the zone it passes.
//   5) Two non-adjacent nodes in the same row use a bypass lane inside the zone instead of cutting through the node between them.
//   6) Where a crossing remains, the hop goes on the less important line (async/secondary, or the later-declared line on a tie).
//   7) When no legal path is found it does not draw over itself: it applies the degrade ladder, and failing that returns needs-split.
//
// Coordinates stay in the absolute system the caller supplied. This module builds no SVG; it
// returns **paths and the reasoning behind them** (string assembly is the caller's job, and
// auditTopology re-measures the artifact for the audit).

export const ROUTE_DEFAULTS = {
  laneGap: 12,        // minimum spacing between lines running alongside — each must stay independently traceable
  portGap: 12,        // minimum spacing between attach points on one side
  targetGap: 10,      // the gap between the arrow tip and the target boundary (spec: 8-12px)
  stub: 24,           // the straight run leaving the port on a detour (= endpointStub)
  radius: 8,          // the quarter-arc radius at a corner
  hopRadius: 6,
  maxBends: 5,        // the most bends a stub-lane-stub structure can produce
  corridorMargin: 14, // the margin left above and below a corridor
  channelMargin: 16,  // the margin between a side channel and a zone
  maxHops: 6,
  // The lengths below are not numbers copied from elsewhere — they are **derived from our own
  // arrow scale and corner radius**.
  portInset: 16,          // = 2 x radius. The margin that keeps a port clear of the rounded corner
  minSegment: 16,         // = 2 x radius. The shortest span two corners can share
  minInteriorSegment: 24, // = 3 x radius. Any shorter between two bends and it reads as a nick, not a bend
  endpointStub: 24,       // = markerWidth (11.25) + targetGap (10) + slack. The arrowhead sits wholly on a straight run
  portSpreadStep: 12,     // = laneGap. Ports on one side spread **symmetrically** at this interval
  collinearOverlapMax: 8, // = radius. Two unrelated lines overlapping this far read as one line
  outerClearance: 14,     // = laneGap + a pair of strokes. The least spacing at which a container border and a route do not read as one line
  labelPad: 10,           // label bounds are inflated by this much and used as an obstacle (keeping text and line independently readable)
  minShaft: 26,      // a real line must be visible behind the marker (authoring §3)
};

const K = ROUTE_DEFAULTS;
const r1 = (v) => Math.round(v * 10) / 10;
const byId = (list) => new Map(list.map((x) => [x.id, x]));

// --- routing demand ---------------------------------------------------------------
// Before the layout, answer "where and how much space does drawing this edge set need?". If the
// layout is settled first and the routing squeezed into whatever gaps remain, it ends in
// cut-throughs and overlaps.
export function planChannels({ zoneOrder, nodeZone, nodeIndex, edges }) {
  const zi = new Map(zoneOrder.map((z, i) => [z, i]));
  const corridorLanes = new Map();   // corridor index (= the index of the zone above) -> lane count
  const intraLanes = new Map();      // zone id -> bypass lane count
  const sideLanes = { left: 0, right: 0 };
  const classified = [];
  for (const e of edges) {
    const a = zi.get(nodeZone.get(e.from)), b = zi.get(nodeZone.get(e.to));
    if (a === undefined || b === undefined) { classified.push({ ...e, kindPath: "unknown" }); continue; }
    if (a === b) {
      // Non-adjacent within a row needs a bypass lane so the node between is not cut through.
      const gap = Math.abs((nodeIndex.get(e.from) ?? 0) - (nodeIndex.get(e.to) ?? 0));
      classified.push({ ...e, kindPath: "intra", zone: nodeZone.get(e.from), direct: gap <= 1 });
    } else if (Math.abs(a - b) === 1) {
      classified.push({ ...e, kindPath: "adjacent", corridor: Math.min(a, b), down: b > a });
    } else {
      // An edge skipping a zone detours: departure corridor -> side channel -> arrival corridor.
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
  const directPairs = new Map();   // zone id -> count of direct intra edges
  for (const e of classified) if (e.kindPath === "intra" && e.direct)
    directPairs.set(e.zone, (directPairs.get(e.zone) ?? 0) + 1);
  // Room for a direct connector to pass: a target gap on each side plus the minimum shaft
  const nodeGap = (zid) => (directPairs.get(zid) ? 2 * K.targetGap + K.minShaft : 16);
  return { classified, corridorLanes, intraLanes, sideLanes, corridorHeight, channelWidth, directPairs, nodeGap };
}

// Each diagnostic proposes just one "change this" — so the whole thing need not be redrawn.
function fixesFor(code) {
  switch (code) {
    case "R-THROUGH": return ["reflow the row so the endpoints share a column", "let this secondary edge use the outer corridor"];
    case "R-MICRO-DOGLEG": case "R-ENDPOINT-STUB": return ["slide the ports to a common coordinate", "widen the gap between the two rows"];
    case "R-COLLINEAR": case "R-LANE": return ["assign the later edge to the next lane", "spread the shared endpoint ports"];
    case "R-MONOTONIC": return ["declare this edge as a return path", "reorder the zones so the flow stays monotonic"];
    default: return ["reduce the edge set on this page", "split the page"];
  }
}

// --- layout alignment request ------------------------------------------------------------
// If routing simply accepts whatever the layout produced, the main flow zigzags. To let primary
// edges run straight, it **reorders slots within a row** to secure a shared column. (No coordinate
// is moved arbitrarily — the row remains an evenly spaced group.)
export function alignRows({ zoneOrder, nodeOrder, nodeZone, edges }) {
  const order = new Map([...nodeOrder].map(([z, list]) => [z, [...list]]));
  const zi = new Map(zoneOrder.map((z, i) => [z, i]));
  const moves = [];
  for (const e of edges) {
    if ((e.weight ?? "primary") !== "primary") continue;          // detours are secondary's business
    const za = nodeZone.get(e.from), zb = nodeZone.get(e.to);
    if (za === undefined || zb === undefined || za === zb) continue;
    if (Math.abs(zi.get(za) - zi.get(zb)) !== 1) continue;
    const A = order.get(za), B = order.get(zb);
    if (!A || !B || A.length !== B.length) continue;               // rows of different size have no slot correspondence
    const ia = A.indexOf(e.from), ib = B.indexOf(e.to);
    if (ia < 0 || ib < 0 || ia === ib) continue;
    [B[ia], B[ib]] = [B[ib], B[ia]];                               // line them up in the same slot
    moves.push({ edge: e.id, zone: zb, moved: e.to, from: ib, to: ia });
  }
  return { order, moves };
}

// --- path generation ---------------------------------------------------------------
// Cost order (lexicographic): (1) bend count, (2) lane travel, (3) declaration order.
// With no obstacle the straight run wins — it never bends just to save a small coordinate move.
export function routeEdges({ nodes, zones, plan, frame, degradeLevel = 0 }) {
  const problems = [], routes = [], attempts = [], diagnostics = [];
  const active = plan.classified.filter((e) => degradeLevel < 3 || (e.weight ?? "primary") !== "secondary");
  const demoted = plan.classified.filter((e) => !active.includes(e));
  const obstacles = [
    ...Object.entries(nodes).map(([id, b]) => ({ id, kind: "node", x: b.x, y: b.y, w: b.w, h: b.h })),
    ...zones.filter((z) => z.labelBox).map((z) => ({ id: `${z.id}-label`, kind: "zone-label", ...z.labelBox })),
  ];
  // Carry the flow axis (top to bottom) on each edge — it is the basis of the monotonicity test.
  for (const e of active) {
    const A = nodes[e.from], B = nodes[e.to];
    if (A && B) e.flowAxis = (B.y + B.h / 2) - (A.y + A.h / 2) >= 0 ? 1 : -1;
  }
  // Route the primaries first — the main flow gets first claim on the straight positions.
  const ordered = [...active].sort((a, b) =>
    ((a.weight ?? "primary") === "primary" ? 0 : 1) - ((b.weight ?? "primary") === "primary" ? 0 : 1));

  const placed = [];                       // paths already settled (a lane overlapping them is unusable)
  const usedPorts = new Map();             // `${node}|${side}` -> [coordinates]

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
      // The candidate space passed the safety cap — it does not truncate and then claim "there were none".
      diagnostics.push({ ...all.capOverflow, supportedFixes: ["narrow the allowed port interval", "increase the lane gap"] });
      problems.push(`edge ${e.id}: the allowed port interval yields more candidates than the safety cap — narrow the interval instead of truncating the search`);
      continue;
    }
    // A return uses neither the main flow's axis nor its face — arrowheads pointing opposite ways crowded onto one face do not read.
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

  // Remaining crossings get a bridge on the less important line (reached only when no candidate avoided the crossing itself)
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

// Candidate generation — fewest bends first. Every coordinate is computed here.
// Generating only the dominant axis would miss a perfectly good 1-bend on the grounds that "that
// direction was blocked".
function candidates(e, A, B, nodes, zones, frame, usedPorts, opt = {}) {
  const out = [];
  const dx = (B.x + B.w / 2) - (A.x + A.w / 2), dy = (B.y + B.h / 2) - (A.y + A.h / 2);
  const vOut = dy > 0 ? "bottom" : "top", vIn = dy > 0 ? "top" : "bottom";
  const hOut = dx > 0 ? "right" : "left", hIn = dx > 0 ? "left" : "right";
  const vertical = Math.abs(dy) >= Math.abs(dx);
  // allowedPortInterval: the **legal port interval** the layout already proved from label bounds,
  // node bounds and clearance. The router generates candidates only inside it; with none given,
  // behaviour is exactly as before. The interval is intersected with the node's own port range,
  // and an empty intersection fails closed.
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
  // Sweep outward from the wished-for position to find a **free** port — a taken position does not discard the candidate.
  const pick = (nid, n, side, wish) => {
    const i = iv(n, side);
    for (const v of nudge(clamp(wish, i.lo, i.hi), i.lo, i.hi)) if (free(nid, side, v)) return v;
    return null;
  };

  // (1) 0-bend — where the port intervals overlap, pick a shared coordinate and join them in a
  //     perfectly straight run (a sliding port). Securing the main flow as a straight run is this
  //     router's first rule.
  for (const [sf, st] of [[vOut, vIn], [hOut, hIn]]) {
    const a = iv(A, sf), b = iv(B, st);
    if (a.axis !== b.axis) continue;
    const lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    if (lo > hi) continue;
    // With several tied 0-bend candidates, choose by "whose centre is held":
    //   (1) the source centre, when no other connection shares the side
    //   (2) the target centre, when the source centre falls outside the target interval
    //   (3) otherwise the legal position **nearest** the run the two centres wanted. Jumping to
    //       the middle of a wide interval would answer a few units of obstruction with a move of
    //       tens, which reads as a mis-drawn edge rather than a cleared one.
    const sc = center(A, a.axis), tc = center(B, b.axis);
    const shared = (usedPorts.get(`${e.from}|${sf}`) ?? []).length > 0 || (usedPorts.get(`${e.to}|${st}`) ?? []).length > 0;
    const wish = !shared && sc >= lo && sc <= hi ? sc
      : (tc >= lo && tc <= hi ? tc : clamp((sc + tc) / 2, lo, hi));
    // Produce **several straight candidates** within the overlap — abandoning the straight shape
    // itself because the first coordinate is blocked by an obstacle (a zone label, say) would put
    // a bend in even where a small sideways move would do. The candidate count is no arbitrary
    // constant: it comes from **interval width / lane gap** — fewer for a narrow interval, more
    // for a wide one. The order runs outward from the wish, preserving straight-first and
    // determinism. When the count reaches the safety cap it is **not truncated quietly** but
    // recorded as a diagnostic — reporting "there were no candidates" after a truncation would
    // make the stated grounds for failure false.
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
  // (2) 1-bend — leave on one axis and enter on the other. Both combinations are generated.
  for (const [sf, st] of [[vOut, hIn], [hOut, vIn]]) {
    const a = iv(A, sf), b = iv(B, st);
    const v0 = pick(e.from, A, sf, center(A, a.axis)), v1 = pick(e.to, B, st, center(B, b.axis));
    if (v0 == null || v1 == null) continue;
    const p0 = at(A, sf, v0), p2 = tip(B, st, v1);
    const corner = a.axis === "x" ? { x: p0.x, y: p2.y } : { x: p2.x, y: p0.y };
    out.push(mk("elbow", [p0, corner, p2], sf, st, [[e.from, sf, p0], [e.to, st, p2]]));
  }
  // (3) 2-bend — cross an intermediate lane and enter on the same face (a legitimate dogleg)
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
  // (4) side channel — the detour. **The path shape derives from the declared port faces**, not
  //     from the dominant axis. Leaving on a left/right face means the first segment runs
  //     horizontally outward and the last horizontally inward.
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
    // The return: leave on a left/right face, ride a vertical channel, and enter on the same face.
    for (const side of ["left", "right"]) {
      const cx = side === "left" ? chanX[1] : chanX[0];
      if (!insideFrameX(cx)) continue;
      const a = iv(A, side), b = iv(B, side);
      const v0 = pick(e.from, A, side, center(A, a.axis)), v1 = pick(e.to, B, side, center(B, b.axis));
      if (v0 == null || v1 == null) continue;
      const p0 = at(A, side, v0), p3 = tip(B, side, v1);
      // first segment horizontally outward -> vertical channel -> last segment horizontally inward
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
  // Lexicographic sort: bend count -> lane travel -> shape name (for determinism)
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
// Sweep outward from the wished-for coordinate within the overlap — a deterministic order.
// When several connectors attach to one side they spread **symmetrically and deterministically**
// about the centre. With only one connection there is no spreading — no reason to disturb a
// straight run.
function nudge(v, lo, hi) {
  const out = [v];
  for (let d = K.portSpreadStep; d <= hi - lo; d += K.portSpreadStep) {
    if (v + d <= hi) out.push(v + d);
    if (v - d >= lo) out.push(v - d);
  }
  return out;
}
// Returns the reason a candidate is dropped as a string (null if it passes) — the grounds for failure are themselves the receipt
function reject(c, e, obstacles, placed) {
  const segs = segments(c.points);
  if (!segs.length) return { code: "R-DEGENERATE", why: "degenerate path" };
  const len = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);
  // The first and last segments are the straight runs the arrowhead and the port sit on.
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
  // The main flow is monotonic — a primary running back against the flow axis reads as a return.
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
      // Related lines should already be apart through port spreading, and unrelated lines that overlap read as one line.
      if (ov.overlap >= (related ? K.minInteriorSegment : K.collinearOverlapMax))
        return { code: related ? "R-LANE" : "R-COLLINEAR",
          why: `runs ${r1(ov.gap)}px from route ${rt.id} for ${r1(ov.overlap)}px — ${related ? "same-endpoint lanes must stay one lane apart" : "unrelated lines this close read as one"}` };
    }
  }
  return null;
}

// Path to an SVG path d — corners as quarter-arcs, crossings as hops
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
// A straight segment — crossings falling on it get a hop (a semicircle)
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

// --- artifact audit -------------------------------------------------------------
// It re-measures the **recorded bytes**, not the intent. The supported path syntax is the absolute
// M/L/Q/a subset we generate; anything else is reported as "cannot prove", not as a pass.
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
    // With no obstacle and overlapping port intervals, a bend means a straight run was missed
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
  // crossings and lane overlap
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
  // --- port direction: recomputed from the **actual first and last segments**, not the declared side ---
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
  // --- visibility: judged separately from geometry — **is it occluded?** ---------------
  // An opaque surface drawn after the connector covers the line: it exists, yet reads as broken.
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
      if (r.at < idx) continue;                       // a surface drawn before does not occlude the line
      if (r.x <= 0.5 && r.y <= 0.5) continue;        // the canvas ground is always at the very back
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

// Paint order is verified by **DOM order**, not by declaration.
// canvas -> container background/border -> connectors and markers -> node surfaces -> icons, text,
// labels and legends
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
  // The node-surface rule applies only to a **connector's endpoints** — those are the only surfaces a line must pass beneath.
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
  // drop midpoints that sit on a straight run
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
  const eps = 0.5;   // grazing the boundary is not a cut-through
  return x2 > rect.x + eps && x1 < rx2 - eps && y2 > rect.y + eps && y1 < ry2 - eps;
}
function rectGap(p, box) {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w));
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h));
  return Math.hypot(dx, dy);
}
function crossPoint(a1, a2, b1, b2) {
  const aH = Math.abs(a1.y - a2.y) < 0.01, bH = Math.abs(b1.y - b2.y) < 0.01;
  if (aH === bH) return null;                 // parallel is not a crossing (overlap is checked separately)
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
// Where a hop (semicircle) sits — the crossing at that point already has its bridge
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

// Parses only the absolute M/L/Q/a subset we generate — anything else returns null (cannot prove)
function parsePath(d) {
  if (!d || /[cshtCSHTVv]/.test(d.replace(/[Aa]/g, ""))) { /* we do not emit H/V */ }
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
      // A quarter-arc is a **corner**: the arc's start point becomes the vertex (control point) again, and the arc itself is not counted as a segment.
      pts.pop();
      pts.push({ x: n[0], y: n[1] });
      cur = { x: n[2], y: n[3] };
    }
    else if (op === "a" && cur) {
      // A hop (semicircle) is a bridge on the same straight run — counting it as a vertex would
      // invent a spurious 12px jog. If the previous op was a corner (Q), that vertex is kept.
      if (prevOp === "L") pts.pop();
      cur = { x: cur.x + n[5], y: cur.y + n[6] };
    }
    else return null;
    prevOp = op;
  }
  return pts.length >= 2 ? pts : null;
}
