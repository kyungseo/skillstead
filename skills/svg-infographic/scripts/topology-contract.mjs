// Architecture topology semantic contract. Meaning (node kind), representation (icon id), and
// density (variant) are separate axes; aliases normalize at the boundary and never become receipt
// identities.
export const NODE_KINDS = Object.freeze([
  "actor", "service", "gateway", "compute", "database", "cache", "queue",
  "object-storage", "external-provider", "observability",
]);

export const NODE_KIND_ALIASES = Object.freeze({
  user: "actor",
  client: "actor",
  worker: "compute",
  "event-bus": "queue",
});

export const KIND_ICONS = Object.freeze({
  actor: Object.freeze(["users", "terminal"]),
  service: Object.freeze(["api", "server", "lock"]),
  gateway: Object.freeze(["route", "network", "shield"]),
  compute: Object.freeze(["gear", "server", "activity", "gauge"]),
  database: Object.freeze(["database"]),
  cache: Object.freeze(["layers"]),
  queue: Object.freeze(["queue", "loop"]),
  "object-storage": Object.freeze(["doc", "cloud"]),
  "external-provider": Object.freeze(["network", "cloud"]),
  observability: Object.freeze(["activity", "gauge"]),
});

export const KIND_PALETTE_FAMILY = Object.freeze({
  actor: "external",
  service: "api",
  gateway: "edge",
  compute: "compute",
  database: "data",
  cache: "data",
  queue: "data",
  "object-storage": "data",
  "external-provider": "external",
  observability: "edge",
});

// Regular preserves the Wave 1 evidence geometry. Compact is the presentation-size flagship
// contract: it trades node count for larger primitive marks and labels. Connector safety remains
// owned by ROUTE_DEFAULTS and is never weakened by either variant.
export const TOPOLOGY_VARIANTS = Object.freeze({
  regular: Object.freeze({ zonePadding: 12, nodePadding: 12, iconSize: 20, nodeRadius: 10,
    nodeTextSize: 12, zoneLabelSize: 12, nodeHeightMax: 96, nodeWidthMax: 960 }),
  compact: Object.freeze({ zonePadding: 9, nodePadding: 9, iconSize: 36, nodeRadius: 9,
    nodeTextSize: 24, zoneLabelSize: 16, nodeHeightMax: 128, nodeWidthMax: 720 }),
});

export const TOPOLOGY_LIMITS = Object.freeze({
  zones: Object.freeze([2, 4]),
  nodesPerZone: Object.freeze([1, 4]),
  nodesTotal: 9,
  specimenNodesTotal: 10,
  maxEdges: 12,
});

export const EDGE_KINDS = Object.freeze(["request", "dependency", "event"]);
export const edgeDirection = (kind) => kind === "event" ? "producer-to-consumer" : "consumer-to-provider";
export const canonicalNodeKind = (kind) => NODE_KIND_ALIASES[kind] ?? kind;
export const isNodeKind = (kind) => NODE_KINDS.includes(canonicalNodeKind(kind));
export const isIconAllowedForKind = (kind, icon) => (KIND_ICONS[canonicalNodeKind(kind)] ?? []).includes(icon);
