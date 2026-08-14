// route-orthogonal.mjs test suite — 배선 계약의 negative fixture.
// 각 fixture는 "이렇게 그리면 안 된다"를 산출물 수준에서 재현하고, 감사가 그것을 잡는지 본다.
// (감사는 의도가 아니라 기록된 path 바이트를 다시 잰다.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditTopology, planChannels, routeEdges, pathData, alignRows, segments } from "./route-orthogonal.mjs";

// 두 zone에 node 4개 — 모든 fixture가 같은 무대를 쓴다.
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

// a(bottom) → c(top): 세로 직선, tip은 c 위 10px에서 멈춘다 — 이것이 합법 기준선이다.
const LEGAL = "M120 120 L120 210";

test("R-0: 계약을 지킨 배선은 감사에서 통과한다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", LEGAL)]));
  assert.deepEqual(r.errors, [], r.errors.join("\n"));
});

test("R-1: directed edge에 marker-end가 없으면 잡는다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", LEGAL, { marker: false })]));
  assert.ok(codes(r).includes("A-MARKER"), r.errors.join("\n"));
});

test("R-2: target gap 0(카드에 바로 닿음)은 잡는다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 220")]));
  assert.ok(codes(r).includes("A-GAP"), r.errors.join("\n"));
  const far = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 190")]));   // 30px — 너무 멀어도 계약 위반
  assert.ok(codes(far).includes("A-GAP"), far.errors.join("\n"));
});

test("R-3: endpoint가 아닌 node/card를 관통하면 잡는다", () => {
  // a → d 를 b 위로 곧장 지나가게 그린다
  const r = auditTopology(svg([path("e1", "a", "d", "M200 80 L320 80 L320 210")]));
  assert.ok(codes(r).includes("A-THROUGH"), r.errors.join("\n"));
});

test("R-4: 다리 없는 교차와 lane 중첩을 잡는다", () => {
  const cross = auditTopology(svg([
    path("e1", "a", "c", LEGAL),
    path("e2", "b", "d", "M320 120 L320 160 L60 160 L60 210"),   // e1의 세로선을 그냥 가로지른다
  ]));
  assert.ok(codes(cross).includes("A-CROSS"), cross.errors.join("\n"));

  const overlap = auditTopology(svg([
    path("e1", "a", "c", "M120 120 L120 160 L300 160 L300 210"),
    path("e2", "b", "d", "M320 120 L320 165 L100 165 L100 210"),  // 같은 구간을 5px 간격으로 나란히 달린다
  ]));
  assert.ok(codes(overlap).includes("A-COLLINEAR"), overlap.errors.join("\n"));
});

test("R-5: hop을 놓은 교차는 통과한다 — 다리는 계약이 인정하는 원시요소다", () => {
  const bridged = auditTopology(svg([
    path("e1", "a", "c", LEGAL),
    path("e2", "b", "d", "M320 120 L320 160 L126 160 a6 6 0 0 0 -12 0 L60 160 L60 210"),
  ]));
  assert.ok(!codes(bridged).includes("A-CROSS"), bridged.errors.join("\n"));
});

test("R-6: solid/dashed가 함께 나오는데 legend가 없으면 잡는다", () => {
  const mixed = [path("e1", "a", "c", LEGAL), path("e2", "b", "d", "M320 120 L320 210", { dashed: true })];
  assert.ok(codes(auditTopology(svg(mixed))).includes("A-LEGEND"));
  assert.ok(!codes(auditTopology(svg(mixed, { legend: true }))).includes("A-LEGEND"));
});

test("R-6b: arrowhead 뒤에 보이는 shaft가 없으면 잡는다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 138")]));   // 18px — 머리만 남는다
  assert.ok(codes(r).includes("A-SHAFT"), r.errors.join("\n"));
});

test("R-7: 해석할 수 없는 path 문법은 통과가 아니라 '증명 불가'로 남는다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 C120 150 120 180 120 210")]));
  assert.ok(r.notes.some((n) => /unverified/.test(n)), JSON.stringify(r));
});

// --- router 자체 ---------------------------------------------------------------
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

test("R-8: 같은 변에 붙는 connector는 attach point를 나눠 가진다", () => {
  const edges = [{ id: "e1", from: "a", to: "c" }, { id: "e2", from: "a", to: "d" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const xs = out.routes.map((r) => r.points[0].x);
  assert.equal(new Set(xs).size, 2, "두 connector가 한 점을 공유하면 안 된다");
  assert.ok(Math.abs(xs[0] - xs[1]) >= 12, `attach 간격 ${Math.abs(xs[0] - xs[1])}px`);
});

test("R-9: 배선이 결정적이다 — 같은 입력은 같은 경로를 낸다", () => {
  const edges = [{ id: "e1", from: "a", to: "d" }, { id: "e2", from: "b", to: "c" }];
  const run = () => routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } })
    .routes.map((r) => pathData(r)).join("|");
  assert.equal(run(), run());
});

test("R-10: 모든 후보가 막히면 성공이 아니라 진단과 함께 실패한다", () => {
  // c와 d 사이를 벽처럼 막는 node를 두고, 그 뒤의 target으로 가는 길을 모두 끊는다
  const walled = { ...NODES, wall: { x: 20, y: 150, w: 400, h: 40 } };
  const edges = [{ id: "e1", from: "a", to: "c" }];
  const out = routeEdges({ nodes: walled, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(out.routes.length, 0, "막힌 배선을 그리지 않는다");
  assert.equal(out.diagnostics[0].code, "R-NO-ROUTE");
  assert.equal(out.diagnostics[0].subject, "e1");
  assert.ok(out.diagnostics[0].evidence.candidates >= 3, "후보를 실제로 훑은 근거가 남아야 한다");
  assert.ok(out.diagnostics[0].supportedFixes.length, "무엇을 바꾸면 되는지 하나씩 제안해야 한다");
});

// --- 배선 문법 계약(자체 유도 토큰) ------------------------------------------------
test("R-11: 장애물이 없고 port 구간이 겹치면 반드시 0-bend 직선이다", () => {
  const edges = [{ id: "e1", from: "a", to: "c" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(out.routes[0].bends, 0, pathData(out.routes[0]));
  assert.equal(out.routes[0].kindPath, "straight");
  // 감사 쪽에서도 같은 계약을 잡는다: 같은 배치에서 꺾인 경로는 실패다
  const bent = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 160 L150 160 L150 210")]));
  assert.ok(codes(bent).includes("A-STRAIGHT"), bent.errors.join("\n"));
});

test("R-12: 연결이 하나뿐이면 port를 분산하지 않는다", () => {
  const one = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor([{ id: "e1", from: "a", to: "c" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const two = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor([{ id: "e1", from: "a", to: "c" }, { id: "e2", from: "a", to: "d" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.equal(one.routes[0].points[0].x, 120, "단일 관계는 중심을 그대로 쓴다");
  const xs = two.routes.map((r) => r.points[0].x);
  assert.ok(Math.abs(xs[0] - xs[1]) >= 12, `공유 endpoint는 대칭·결정적으로 분산한다 (${xs})`);
});

test("R-13: 첫·마지막 구간이 stub보다 짧으면 실패한다", () => {
  const r = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 132 L160 132 L160 210")]));
  assert.ok(codes(r).includes("A-STUB"), r.errors.join("\n"));
});

test("R-14: 나란한 endpoint에서 micro-dogleg를 만들지 않는다", () => {
  // c를 오른쪽으로 살짝 밀어 port 구간이 겹치지 않게 만든다 — 작은 곁가지가 아니라 다른 모양을 골라야 한다
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

test("R-15: primary 흐름은 단조롭다 — 거슬러 올라가는 경로는 후보에서 탈락한다", () => {
  const out = routeEdges({ nodes: NODES, zones: ZONES,
    plan: planFor([{ id: "e1", from: "a", to: "d", weight: "primary" }]), frame: { x: 0, y: 0, w: 440, h: 340 } });
  const rt = out.routes[0];
  if (rt) for (const [p, q] of segments(rt.points)) assert.ok(q.y - p.y >= -0.5, "primary는 흐름을 거스르지 않는다");
  const back = auditTopology(svg([path("e1", "a", "c", "M120 120 L120 240 L150 240 L150 210")]));
  assert.ok(codes(back).includes("A-MONOTONIC") || codes(back).includes("A-STRAIGHT"), back.errors.join("\n"));
});

test("R-16: 같은 column의 primary chain은 하나의 공통 x를 쓴다", () => {
  const order = new Map([["z1", ["a", "b"]], ["z2", ["d", "c"]]]);   // c가 반대쪽 slot에 있다
  const aligned = alignRows({ zoneOrder: ["z1", "z2"], nodeZone: new Map([["a", "z1"], ["b", "z1"], ["c", "z2"], ["d", "z2"]]),
    nodeOrder: order, edges: [{ id: "e1", from: "a", to: "c", weight: "primary" }] });
  assert.deepEqual(aligned.order.get("z2"), ["c", "d"], "직선이 가능해지도록 행 순서를 되돌린다");
  assert.equal(aligned.moves.length, 1);
});

test("R-17: 꺾임을 없앨 수 있으면 우회를 고르지 않는다", () => {
  // 정렬 후 배치에서는 side-channel이 아니라 직선이 선택돼야 한다
  const edges = [{ id: "e1", from: "a", to: "c", weight: "primary" }];
  const out = routeEdges({ nodes: NODES, zones: ZONES, plan: planFor(edges), frame: { x: 0, y: 0, w: 440, h: 340 } });
  assert.notEqual(out.routes[0].kindPath, "side-channel");
  assert.equal(out.routes[0].bends, 0);
});

// --- v2 보정 계약 ----------------------------------------------------------------
test("R-18: container border를 따라 달리면 실패한다 — border는 corridor가 아니다", () => {
  const zone = [{ id: "z", x: 60, y: 130, w: 220, h: 104, labelBox: null }];
  // zone 상단 경계(y=130)에서 6px 떨어져 길게 달리는 경로
  const out = routeEdges({ nodes: { a: { x: 80, y: 20, w: 150, h: 70 }, b: { x: 80, y: 292, w: 150, h: 70 } },
    zones: zone, plan: planFor([{ id: "e1", from: "a", to: "b" }]), frame: { x: 0, y: 0, w: 460, h: 420 } });
  for (const rt of out.routes) for (const [p, q] of segments(rt.points)) {
    if (Math.abs(p.y - q.y) < 0.01)      // 가로 구간은 zone 위·아래 경계에서 충분히 떨어져야 한다
      for (const y of [130, 234]) if (Math.abs(p.y - y) < 14)
        assert.fail(`horizontal run ${p.y} hugs the zone border ${y}`);
    if (Math.abs(p.x - q.x) < 0.01)      // 세로 구간은 좌·우 경계에서
      for (const x of [60, 280]) if (Math.abs(p.x - x) < 14)
        assert.fail(`vertical run ${p.x} hugs the zone border ${x}`);
  }
});

test("R-19: return edge는 primary와 endpoint side까지 분리한다", () => {
  const nodes = { a: { x: 60, y: 30, w: 150, h: 70 }, b: { x: 60, y: 200, w: 150, h: 70 } };
  const out = routeEdges({ nodes, zones: [], frame: { x: 0, y: 0, w: 400, h: 330 },
    plan: planFor([{ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "a", dashed: true, weight: "secondary" }]) });
  const [flow, ret] = [out.routes.find((r) => r.id === "e1"), out.routes.find((r) => r.id === "e2")];
  assert.equal(flow.bends, 0, "주 흐름은 직선을 지킨다");
  assert.equal(ret.kindPath, "side-channel");
  assert.ok(!["top", "bottom"].includes(ret.sideFrom) && !["top", "bottom"].includes(ret.sideTo),
    `되돌이는 상·하 면을 쓰지 않는다 (${ret.sideFrom}→${ret.sideTo})`);
  // endpoint 부근에서 두 선이 나란히 붙지 않는다
  for (const [a1, a2] of segments(flow.points)) for (const [b1, b2] of segments(ret.points)) {
    const gap = Math.abs(a1.x - b1.x) < 0.01 || Math.abs(a1.y - b1.y) < 0.01;
    if (gap) assert.ok(Math.hypot(a1.x - b1.x, a1.y - b1.y) >= 12, "primary와 return이 너무 가깝다");
  }
});

test("R-20: zone label bounds를 지나가면 실패한다 (KO·EN 장문 모두)", () => {
  const boxes = { a: { x: 60, y: 30, w: 200, h: 70 }, b: { x: 60, y: 240, w: 200, h: 70 } };
  const rect = (id, n) => `<rect data-entity="${id}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"/>`;
  for (const label of [{ x: 40, y: 150, w: 240, h: 22 }, { x: 40, y: 150, w: 300, h: 22 }]) {
    const svg = `<svg>${rect("a", boxes.a)}${rect("b", boxes.b)}
      <path data-route-id="e1" data-route-from="a" data-route-to="b" d="M160 100 L160 230" fill="none" marker-end="url(#ah)"/>
      <g data-layout-role="zone-label" data-label-bounds="${label.x},${label.y},${label.w},${label.h}"></g></svg>`;
    const r = auditTopology(svg);
    assert.ok(r.errors.some((e) => e.startsWith("A-LABEL")), `label ${label.w}px: ${r.errors.join("; ")}`);
  }
  // 라벨 밖으로 비켜 간 경로는 통과한다
  const clear = `<svg>${rect("a", boxes.a)}${rect("b", boxes.b)}
    <path data-route-id="e1" data-route-from="a" data-route-to="b" d="M240 100 L240 230" fill="none" marker-end="url(#ah)"/>
    <g data-layout-role="zone-label" data-label-bounds="40,150,180,22"></g></svg>`;
  assert.ok(!auditTopology(clear).errors.some((e) => e.startsWith("A-LABEL")));
});

test("R-21: 0-bend 좌표는 source center를 우선한다(같은 면에 다른 연결이 없을 때)", () => {
  // b가 더 넓어 구간이 겹치는 상황 — 중앙 midpoint가 아니라 source center를 지켜야 한다
  const nodes = { a: { x: 100, y: 30, w: 120, h: 70 }, b: { x: 60, y: 220, w: 300, h: 70 } };
  const out = routeEdges({ nodes, zones: [], plan: planFor([{ id: "e1", from: "a", to: "b" }]), frame: { x: 0, y: 0, w: 460, h: 340 } });
  assert.equal(out.routes[0].bends, 0);
  assert.equal(out.routes[0].points[0].x, 160, "source center(160)를 지켜야 한다");
});

// --- v3: 실제 방향과 실제 가림 -------------------------------------------------------
const layered = (inner) => `<svg viewBox="0 0 400 340">${inner}</svg>`;
const N4 = (id, b) => `<rect data-entity="${id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#FFFFFF"/>`;

test("R-22: 선언과 달리 마지막 구간이 수직이면 잡는다 (port 방향은 기하로 다시 잰다)", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 200, w: 150, h: 70 };
  // metadata는 left→left인데 실제로는 a 옆에서 위로 끝난다
  const bad = layered(`<g data-layer="containers"></g><g data-layer="connectors">
    <path data-route-id="e2" data-route-from="b" data-route-to="a" data-route-role="return"
      d="M60 235 L24 235 L24 90 L50 90 L50 65" fill="none" marker-end="url(#ah)"/></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  const r = auditTopology(bad);
  assert.ok(r.errors.some((e) => e.startsWith("A-PORT")), r.errors.join("; "));
  // 규정대로 좌측 면으로 수평 진입하면 통과
  const good = layered(`<g data-layer="containers"></g><g data-layer="connectors">
    <path data-route-id="e2" data-route-from="b" data-route-to="a" data-route-role="return"
      d="M60 235 L24 235 L24 65 L50 65" fill="none" marker-end="url(#ah)"/></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(!auditTopology(good).errors.some((e) => e.startsWith("A-PORT")), auditTopology(good).errors.join("; "));
});

test("R-23: connector 뒤에 그려진 불투명 면이 선을 덮으면 잡는다 (기하와 가시성은 별개)", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 240, w: 150, h: 70 };
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 230" fill="none" marker-end="url(#ah)"/>`;
  const covered = layered(`<g data-layer="containers"></g><g data-layer="connectors">${path}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g>
    <g data-layer="annotations"><rect x="100" y="150" width="120" height="24" fill="#F4F8FC"/></g>`);
  assert.ok(auditTopology(covered).errors.some((e) => e.startsWith("A-OCCLUDED")), auditTopology(covered).errors.join("; "));
  // 같은 면이 connector보다 **앞에** 그려지면 가리지 않는다
  const behind = layered(`<g data-layer="containers"><rect x="100" y="150" width="120" height="24" fill="#F4F8FC"/></g>
    <g data-layer="connectors">${path}</g><g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(!auditTopology(behind).errors.some((e) => e.startsWith("A-OCCLUDED")), auditTopology(behind).errors.join("; "));
});

test("R-24: paint layer 순서와 소속을 DOM에서 확인한다", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 240, w: 150, h: 70 };
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 230" fill="none" marker-end="url(#ah)"/>`;
  const swapped = layered(`<g data-layer="connectors">${path}</g><g data-layer="containers"></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.ok(auditTopology(swapped).errors.some((e) => e.startsWith("A-LAYER-ORDER")), auditTopology(swapped).errors.join("; "));
  const misplaced = layered(`<g data-layer="containers"></g><g data-layer="connectors"></g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}${path}</g><g data-layer="annotations"></g>`);
  assert.ok(auditTopology(misplaced).errors.some((e) => e.startsWith("A-LAYER ")), auditTopology(misplaced).errors.join("; "));
});

test("R-25: zone 경계를 넘는 connector는 배경에 가리지 않고 이어져 보여야 한다", () => {
  const a = { x: 60, y: 30, w: 150, h: 70 }, b = { x: 60, y: 260, w: 150, h: 70 };
  const zone = `<rect x="40" y="200" width="320" height="120" fill="#F4F8FC"/>`;
  const path = `<path data-route-id="e1" data-route-from="a" data-route-to="b" d="M135 100 L135 250" fill="none" marker-end="url(#ah)"/>`;
  const ok = layered(`<g data-layer="containers">${zone}</g><g data-layer="connectors">${path}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  assert.deepEqual(auditTopology(ok).errors, [], "zone 배경보다 위에 그려지면 통과한다");
  const hidden = layered(`<g data-layer="connectors">${path}</g><g data-layer="containers">${zone}</g>
    <g data-layer="nodes">${N4("a", a)}${N4("b", b)}</g><g data-layer="annotations"></g>`);
  const errs = auditTopology(hidden).errors;
  assert.ok(errs.some((e) => e.startsWith("A-OCCLUDED")), errs.join("; "));
});

test("R-26: connector가 없는 산출물도 layer 순서를 검사한다 (조기 반환 금지)", () => {
  // layer-stack·nested-scope처럼 route가 하나도 없는 산출물 — 예전에는 여기서 감사가 조기 반환했다.
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
