// route-orthogonal.mjs test suite — the negative fixtures of the routing contract.
// Each fixture reproduces a "this is how it must not be drawn" at artifact level and checks that
// the audit catches it. (The audit re-measures the recorded path bytes, not the intent.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditTopology, planChannels, routeEdges, pathData, alignRows, segments } from "./route-orthogonal.mjs";

// Four nodes across two zones — every fixture uses the same stage.
const NODES = {
  a: { x: 40, y: 40, w: 160, h: 80 },
  b: { x: 240, y: 40, w: 160, h: 80 },
  c: { x: 40, y: 220, w: 160, h: 80 },
  d: { x: 240, y: 220, w: 160, h: 80 },
};
const rect = (id, b) => `<rect data-entity="${id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`;
const svg = (paths, { legend = false, nodes = NODES } = {}) => `<svg>
${Object.entries(nodes).map(([id, b]) => rect(id, b)).join("\n")}
${paths.join("\n")}
${legend ? '<g data-layout-role="legend"></g>' : ""}
</svg>`;
const path = (id, from, to, d, { marker = true, dashed = false } = {}) =>
  `<path data-route-id="${id}" data-route-from="${from}" data-route-to="${to}" d="${d}" fill="none" stroke="#7C93AB" stroke-width="2.5"${dashed ? ' stroke-dasharray="5 4"' : ""}${marker ? ' marker-end="url(#ah)"' : ""}/>`;
const codes = (r) => r.errors.map((e) => e.split(" ")[0]);

// a(bottom) -> c(top): a vertical straight run whose tip stops 10px above c — this is the legal baseline.
const LEGAL = "M120 120 L120 210";

test("R-0: routing that keeps the contract passes the audit", () => {
  const r = auditTopology(svg([path("e1", "a", "c", LEGAL)]));
  assert.deepEqual(r.errors, [], r.errors.join("\n"));
});

test("R-1: a directed edge with no marker-end is caught", () => {
  const r = auditTopology(svg([path("e1", "a", "c", LEGAL, { marker: false })]));
  assert.ok(codes(r).includes("A-MARKER"), r.errors.join("\n"));
});

test("R-2: a target gap of 0 (touching the card directly) is caught", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 220")]));
  assert.ok(codes(r).includes("A-GAP"), r.errors.join("\n"));
  const far = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 190")]));   // 30px — too far is a contract violation as well
  assert.ok(codes(far).includes("A-GAP"), far.errors.join("\n"));
});

test("R-3: cutting through a node or card that is not an endpoint is caught", () => {
  // draw a -> d straight over b
  const r = auditTopology(svg([path("e1", "a", "d", "M200 80 L320 80 L320 210")]));
  assert.ok(codes(r).includes("A-THROUGH"), r.errors.join("\n"));
});

test("R-4: a bridge-less crossing and an overlapping lane are caught", () => {
  const cross = auditTopology(svg([
    path("e1", "a", "c", LEGAL),
    path("e2", "b", "d", "M320 120 L320 160 L60 160 L60 210"),   // crosses e1's vertical run outright
  ]));
  assert.ok(codes(cross).includes("A-CROSS"), cross.errors.join("\n"));

  const overlap = auditTopology(svg([
    path("e1", "a", "c", "M120 120 L120 160 L300 160 L300 210"),
    path("e2", "b", "d", "M320 120 L320 165 L100 165 L100 210"),  // runs alongside the same span 5px apart
  ]));
  assert.ok(codes(overlap).includes("A-COLLINEAR"), overlap.errors.join("\n"));
});

test("R-5: a crossing with a hop passes — the bridge is a primitive the contract recognises", () => {
  const bridged = auditTopology(svg([
    path("e1", "a", "c", LEGAL),
    path("e2", "b", "d", "M320 120 L320 160 L126 160 a6 6 0 0 0 -12 0 L60 160 L60 210"),
  ]));
  assert.ok(!codes(bridged).includes("A-CROSS"), bridged.errors.join("\n"));
});

test("R-6: solid and dashed appearing together with no legend is caught", () => {
  const mixed = [path("e1", "a", "c", LEGAL), path("e2", "b", "d", "M320 120 L320 210", { dashed: true })];
  assert.ok(codes(auditTopology(svg(mixed))).includes("A-LEGEND"));
  assert.ok(!codes(auditTopology(svg(mixed, { legend: true }))).includes("A-LEGEND"));
});

test("R-6b: an arrowhead with no visible shaft behind it is caught", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 138")]));   // 18px — only the head is left
  assert.ok(codes(r).includes("A-SHAFT"), r.errors.join("\n"));
});

test("R-7: unparseable path syntax is recorded as 'cannot prove', not as a pass", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 C120 150 120 180 120 210")]));
  assert.ok(r.notes.some((n) => /unverified/.test(n)), JSON.stringify(r));
});

// --- the router itself ---------------------------------------------------------------
const ZONES = [
  { id: "z1", x: 20, y: 20, w: 400, h: 120, labelBox: { x: 28, y: 24, w: 90, h: 18 } },
  { id: "z2", x: 20, y: 200, w: 400, h: 120, labelBox: { x: 28, y: 204, w: 90, h: 18 } },
];
const planFor = (edges) => planChannels({
  zoneOrder: ["z1", "z2"],
  nodeZone: new Map([["a", "z1"], ["b", "z1"], ["c", "z2"], ["d", "z2"]]),
  nodeIndex: new Map([["a", 0], ["b", 1], ["c", 0], ["d", 1]]),
  edges,
});

test("R-8: connectors attaching to the same side share out their attach points", () => {
  const edges = [{ id: "e1", from: "a", to: "c" }, { id: "e2", from: "a", to: "d" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const xs = out.routes.map((r) => r.points[0].x);
  assert.equal(new Set(xs).size, 2, "two connectors must not share one point");
  assert.ok(Math.abs(xs[0] - xs[1]) >= 12, `attach spacing ${Math.abs(xs[0] - xs[1])}px`);
});

test("R-9: routing is deterministic — the same input yields the same path", () => {
  const edges = [{ id: "e1", from: "a", to: "d" }, { id: "e2", from: "b", to: "c" }];
  const run = () => routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } })
    .routes.map((r) => pathData(r)).join("|");
  assert.equal(run(), run());
});

test("R-10: with every candidate blocked it fails with a diagnostic, not succeeds", () => {
  // place a node walling off c from d, cutting every path to the target behind it
  const walled = { ...NODES, wall: { x: 20, y: 150, w: 400, h: 40 } };
  const edges = [{ id: "e1", from: "a", to: "c" }];
  const out = routeEdges({ nodes: walled, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(out.routes.length, 0, "a blocked route is not drawn");
  assert.equal(out.diagnostics[0].code, "R-NO-ROUTE");
  assert.equal(out.diagnostics[0].subject, "e1");
  assert.ok(out.diagnostics[0].evidence.candidates >= 3, "there must be evidence that the candidates were actually swept");
  assert.ok(out.diagnostics[0].supportedFixes.length, "it must propose, one by one, what could be changed");
});

// --- routing syntax contract (self-derived tokens) ------------------------------------------------
test("R-11: with no obstacle and overlapping port intervals the result must be a 0-bend straight run", () => {
  const edges = [{ id: "e1", from: "a", to: "c" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(out.routes[0].bends, 0, pathData(out.routes[0]));
  assert.equal(out.routes[0].kindPath, "straight");
  // the audit holds the same contract: in the same arrangement a bent path is a failure
  const bent = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 160 L150 160 L150 210")]));
  assert.ok(codes(bent).includes("A-STRAIGHT"), bent.errors.join("\n"));
});

test("R-27: a small obstruction moves the port just clear of it, not to the middle of the interval", () => {
  // a and c share a centre at x=120. An allowed interval that starts a few units to its right is
  // what a label chip plus the arrowhead's own width produces. Answering that with the midpoint of
  // a wide interval would swing the run tens of units and read as a mis-drawn edge.
  const LO = 128, HI = 240;
  const edges = [{ id: "e1", from: "a", to: "c", allowedPortInterval: { to: { lo: LO, hi: HI, axis: "x" } } }];
  const stage = { nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } };
  const out = routeEdges(stage);
  const r = out.routes[0];
  const x = r.points[0].x;

  assert.equal(x, LO, `a ${LO - 120}px obstruction must cost ${LO - 120}px, not a jump to ${(LO + HI) / 2}`);
  assert.ok(x >= LO && x <= HI, "and the port stays inside the interval it was given");
  assert.equal(r.bends, 0, pathData(r));
  assert.equal(r.kindPath, "straight", "clearing an obstacle sideways must not buy a bend");
  assert.equal(r.points.at(-1).x, x, "both ends move together — the run stays vertical");
  // same input, same port: the choice is derived, never sampled
  assert.equal(pathData(routeEdges(stage).routes[0]), pathData(r));
});

test("R-12: with only one connection the ports are not spread", () => {
  const one = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor([{ id: "e1", from: "a", to: "c" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const two = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor([{ id: "e1", from: "a", to: "c" }, { id: "e2", from: "a", to: "d" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(one.routes[0].points[0].x, 120, "a single relation uses the centre as it is");
  const xs = two.routes.map((r) => r.points[0].x);
  assert.ok(Math.abs(xs[0] - xs[1]) >= 12, `a shared endpoint spreads symmetrically and deterministically (${xs})`);
});

test("R-13: a first or last segment shorter than the stub fails", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 132 L160 132 L160 210")]));
  assert.ok(codes(r).includes("A-STUB"), r.errors.join("\n"));
});

test("R-14: no micro-dogleg is produced at side-by-side endpoints", () => {
  // nudge c right so the port intervals no longer overlap — it must pick a different shape, not a small jog
  const near = { ...NODES, c: { x: 40 + 130, y: 220, w: 160, h: 80 } };
  const out = routeEdges({ nodes: near, zones: ZONES, plan: planFor([{ id: "e1", from: "a", to: "c" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const rt = out.routes[0];
  if (rt) {
    const segs = segments(rt.points).map(([p, q]) => Math.hypot(q.x - p.x, q.y - p.y));
    for (let i = 1; i < segs.length - 1; i++) assert.ok(segs[i] >= 24, `interior segment ${segs[i]}px`);
    assert.ok(segs[0] >= 24 && segs[segs.length - 1] >= 24, "endpoint stub");
  } else {
    assert.equal(out.diagnostics[0].code, "R-NO-ROUTE");
  }
});

test("R-15: the primary flow is monotonic — a path running back upstream drops out of the candidates", () => {
  const out = routeEdges({ nodes: NODES, zones: ZONES,
    plan: planFor([{ id: "e1", from: "a", to: "d", weight: "primary" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const rt = out.routes[0];
  if (rt) for (const [p, q] of segments(rt.points)) assert.ok(q.y - p.y >= -0.5, "the primary does not run against the flow");
  const back = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 240 L150 240 L150 210")]));
  assert.ok(codes(back).includes("A-MONOTONIC") || codes(back).includes("A-STRAIGHT"), back.errors.join("\n"));
});

test("R-16: a primary chain in the same column uses one shared x", () => {
  const order = new Map([["z1", ["a", "b"]], ["z2", ["d", "c"]]]);   // c sits in the opposite slot
  const aligned = alignRows({ zoneOrder: ["z1", "z2"], nodeZone: new Map([["a", "z1"], ["b", "z1"], ["c", "z2"], ["d", "z2"]]),
    nodeOrder: order, edges: [{ id: "e1", from: "a", to: "c", weight: "primary" }] });
  assert.deepEqual(aligned.order.get("z2"), ["c", "d"], "the row order is restored so a straight run becomes possible");
  assert.equal(aligned.moves.length, 1);
});

test("R-17: when the bend can be removed, the detour is not chosen", () => {
  // in the aligned arrangement a straight run, not the side channel, must be chosen
  const edges = [{ id: "e1", from: "a", to: "c", weight: "primary" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.notEqual(out.routes[0].kindPath, "side-channel");
  assert.equal(out.routes[0].bends, 0);
});

// --- v2 correction contracts ----------------------------------------------------------------
test("R-18: running along a container border fails — a border is not a corridor", () => {
  const zone = [{ id: "z", x: 60, y: 130, w: 220, h: 104, labelBox: null }];
  // a long run 6px from the zone's top boundary (y=130)
  const out = routeEdges({ nodes: { a: { x: 80, y: 20, w: 150, h: 70 }, b: { x: 80, y: 292, w: 150, h: 70 } },
    zones: zone, plan: planFor([{ id: "e1", from: "a", to: "b" }]), frame: { x: 0, y: 0, w: 460, h: 420 } });
  for (const rt of out.routes) for (const [p, q] of segments(rt.points)) {
    if (Math.abs(p.y - q.y) < 0.01)      // a horizontal segment must keep clear of the zone's top and bottom boundaries
      for (const y of [130, 234]) if (Math.abs(p.y - y) < 14)
        assert.fail(`horizontal run ${p.y} hugs the zone border ${y}`);
    if (Math.abs(p.x - q.x) < 0.01)      // and a vertical segment of the left and right ones
      for (const x of [60, 280]) if (Math.abs(p.x - x) < 14)
        assert.fail(`vertical run ${p.x} hugs the zone border ${x}`);
  }
});

test("R-19: a return edge separates from the primary right down to the endpoint side", () => {
  const nodes = { a: { x: 60, y: 30, w: 150, h: 70 }, b: { x: 60, y: 200, w: 150, h: 70 } };
  const out = routeEdges({ nodes, zones: [], frame: { x: 0, y: 0, w: 400, h: 330 },
    plan: planFor([{ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "a", dashed: true, weight: "secondary" }]) });
  const [flow, ret] = [out.routes.find((r) => r.id === "e1"), out.routes.find((r) => r.id === "e2")];
  assert.equal(flow.bends, 0, "the main flow stays straight");
  assert.equal(ret.kindPath, "side-channel");
  assert.ok(!["top", "bottom"].includes(ret.sideFrom) && !["top", "bottom"].includes(ret.sideTo),
    `the return does not use the top or bottom faces (${ret.sideFrom}->${ret.sideTo})`);
  // near the endpoint the two lines do not run flush alongside each other
  for (const [a1, a2] of segments(flow.points)) for (const [b1, b2] of segments(ret.points)) {
    const gap = Math.abs(a1.x - b1.x) < 0.01 || Math.abs(a1.y - b1.y) < 0.01;
    if (gap) assert.ok(Math.hypot(a1.x - b1.x, a1.y - b1.y) >= 12, "the primary and the return are too close");
  }
});

test("R-20: passing through the zone label bounds fails (for long KO and EN text alike)", () => {
  const boxes = { a: { x: 60, y: 30, w: 200, h: 70 }, b: { x: 60, y: 240, w: 200, h: 70 } };
  const rect = (id, n) => `<rect data-entity="${id}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"/>`;
  for (const label of [{ x: 40, y: 150, w: 240, h: 22 }, { x: 40, y: 150, w: 300, h: 22 }]) {
    const svg = `<svg>${rect("a", boxes.a)}${rect("b", boxes.b)}
      <path data-route-id="e1" data-route-from="a" data-route-to="b" d="M160 100 L160 230" fill="none" marker-end="url(#ah)"/>
      <g data-layout-role="zone-label" data-label-bounds="${label.x},${label.y},${label.w},${label.h}"></g></svg>`;
    const r = auditTopology(svg);
    assert.ok(r.errors.some((e) => e.startsWith("A-LABEL")), `label ${label.w}px: ${r.errors.join("; ")}`);
  }
  // a path routed clear of the label passes
  const clear = `<svg>${rect("a", boxes.a)}${rect("b", boxes.b)}
    <path data-route-id="e1" data-route-from="a" data-route-to="b" d="M240 100 L240 230" fill="none" marker-end="url(#ah)"/>
    <g data-layout-role="zone-label" data-label-bounds="40,150,180,22"></g></svg>`;
  assert.ok(!auditTopology(clear).errors.some((e) => e.startsWith("A-LABEL")));
});

test("R-21: a 0-bend coordinate prefers the source centre (when no other connection shares the face)", () => {
  // b is wider so the intervals overlap — it must hold the source centre, not the midpoint between them
  const nodes = { a: { x: 100, y: 30, w: 120, h: 70 }, b: { x: 60, y: 220, w: 300, h: 70 } };
  const out = routeEdges({ nodes, zones: [], plan: planFor([{ id: "e1", from: "a", to: "b" }]), frame: { x: 0, y: 0, w: 460, h: 340 } });
  assert.equal(out.routes[0].bends, 0);
  assert.equal(out.routes[0].points[0].x, 160, "it must hold the source centre (160)");
});

// --- v3: the real direction and the real occlusion -------------------------------------------------------
const layered = (inner) => `<svg viewBox="0 0 400 340">${inner}</svg>`;
const N4 = (id, b) => `<rect data-entity="${id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#FFFFFF"/>`;

test("R-22: a last segment that is vertical despite the declaration is caught (port direction is re-measured geometrically)", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 200, w: 150, h: 70 };
  // the metadata says left->left but it actually ends going up beside a
  const bad = layered(`<g data-layer="containers"></g><g data-layer="connectors">
    <path data-route-id="e2" data-route-from="b" data-route-to="a" data-route-role="return"
      d="M60 235 L24 235 L24 90 L50 90 L50 65" fill="none" marker-end="url(#ah)"/></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  const r = auditTopology(bad);
  assert.ok(r.errors.some((e) => e.startsWith("A-PORT")), r.errors.join("; "));
  // entering horizontally on the left face as specified passes
  const good = layered(`<g data-layer="containers"></g><g data-layer="connectors">
    <path data-route-id="e2" data-route-from="b" data-route-to="a" data-route-role="return"
      d="M60 235 L24 235 L24 65 L50 65" fill="none" marker-end="url(#ah)"/></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(!auditTopology(good).errors.some((e) => e.startsWith("A-PORT")), auditTopology(good).errors.join("; "));
});

test("R-23: an opaque surface drawn after the connector and covering the line is caught (geometry and visibility are separate)", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 240, w: 150, h: 70 };
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 230" fill="none" marker-end="url(#ah)"/>`;
  const covered = layered(`<g data-layer="containers"></g><g data-layer="connectors">${path}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g>
    <g data-layer="annotations"><rect x="100" y="150" width="120" height="24" fill="#F4F8FC"/></g>`);
  assert.ok(auditTopology(covered).errors.some((e) => e.startsWith("A-OCCLUDED")), auditTopology(covered).errors.join("; "));
  // the same surface drawn **before** the connector does not occlude it
  const behind = layered(`<g data-layer="containers"><rect x="100" y="150" width="120" height="24" fill="#F4F8FC"/></g>
    <g data-layer="connectors">${path}</g><g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(!auditTopology(behind).errors.some((e) => e.startsWith("A-OCCLUDED")), auditTopology(behind).errors.join("; "));
});

test("R-24: paint layer order and membership are checked in the DOM", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 240, w: 150, h: 70 };
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 230" fill="none" marker-end="url(#ah)"/>`;
  const swapped = layered(`<g data-layer="connectors">${path}</g><g data-layer="containers"></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(auditTopology(swapped).errors.some((e) => e.startsWith("A-LAYER-ORDER")), auditTopology(swapped).errors.join("; "));
  const misplaced = layered(`<g data-layer="containers"></g><g data-layer="connectors"></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}${path}</g><g data-layer="annotations"></g>`);
  assert.ok(auditTopology(misplaced).errors.some((e) => e.startsWith("A-LAYER ")), auditTopology(misplaced).errors.join("; "));
});

test("R-25: a connector crossing a zone boundary must read as continuous, unhidden by the background", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 260, w: 150, h: 70 };
  const zone = `<rect x="40" y="200" width="320" height="120" fill="#F4F8FC"/>`;
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 250" fill="none" marker-end="url(#ah)"/>`;
  const ok = layered(`<g data-layer="containers">${zone}</g><g data-layer="connectors">${path}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.deepEqual(auditTopology(ok).errors, [], "drawn above the zone background it passes");
  const hidden = layered(`<g data-layer="connectors">${path}</g><g data-layer="containers">${zone}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  const errs = auditTopology(hidden).errors;
  assert.ok(errs.some((e) => e.startsWith("A-OCCLUDED")), errs.join("; "));
});

test("R-26: an artifact with no connectors still has its layer order checked (no early return)", () => {
  // artifacts with no routes at all, like layer-stack and nested-scope — the audit used to return early here.
  const bands = `<rect data-entity="layer-1" x="20" y="20" width="360" height="60" fill="#F4F8FC"/>`;
  const ok = layered(`<g data-layer="containers">${bands}</g><g data-layer="connectors"></g>
    <g data-layer="nodes"></g><g data-layer="annotations"></g>`);
  const okRes = auditTopology(ok);
  assert.deepEqual(okRes.errors, [], okRes.errors.join("; "));
  assert.ok(okRes.notes.some((n) => /paint layers still checked/.test(n)), JSON.stringify(okRes.notes));

  const swapped = layered(`<g data-layer="annotations"></g><g data-layer="containers">${bands}</g>
    <g data-layer="connectors"></g><g data-layer="nodes"></g>`);
  const bad = auditTopology(swapped);
  assert.ok(bad.errors.some((e) => e.startsWith("A-LAYER-ORDER")), bad.errors.join("; "));
});
