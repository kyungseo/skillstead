// Bundled icon registry — the single source of truth consumed by generation, validation,
// and authoring discovery. Icons use a 24x24 line grammar and are stored as concrete path data
// so canonical SVG output never depends on <symbol>/<use> or currentColor.
const PATHS = {
  activity: "M2 12 L7 12 L10 5 L14 19 L17 12 L22 12",
  api: "M9 5 L5 12 L9 19 M15 5 L19 12 L15 19",
  check: "M4 12 L10 18 L20 6",
  clock: "M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4 M12 8 V12 L15 14",
  cloud: "M6 17 A4 4 0 1 1 8 9 A5 5 0 0 1 18 10 A4 4 0 1 1 18 17 Z",
  coins: "M4 8 A8 4 0 1 0 20 8 A8 4 0 1 0 4 8 M4 8 L4 15 A8 4 0 0 0 20 15 L20 8",
  database: "M4 6 A8 3 0 1 0 20 6 A8 3 0 1 0 4 6 M4 6 V18 A8 3 0 0 0 20 18 V6",
  doc: "M6 3 H14 L18 7 V21 H6 Z M14 3 V7 H18 M9 13 H15 M9 16.5 H15 M9 9.5 H11",
  flag: "M6 3 V21 M6 4 H18 L15 8 L18 12 H6",
  gauge: "M4 17 A8 8 0 1 1 20 17 M12 17 L16 10",
  gear: "M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 M19.4 15 A1.65 1.65 0 0 0 19.73 16.82 L19.79 16.88 A2 2 0 1 1 16.96 19.71 L16.9 19.65 A1.65 1.65 0 0 0 15.08 19.32 A1.65 1.65 0 0 0 14.08 20.83 V21 A2 2 0 0 1 10.08 21 V20.91 A1.65 1.65 0 0 0 9 19.4 A1.65 1.65 0 0 0 7.18 19.73 L7.12 19.79 A2 2 0 1 1 4.29 16.96 L4.35 16.9 A1.65 1.65 0 0 0 4.68 15.08 A1.65 1.65 0 0 0 3.17 14.08 H3 A2 2 0 0 1 3 10.08 H3.09 A1.65 1.65 0 0 0 4.6 9 A1.65 1.65 0 0 0 4.27 7.18 L4.21 7.12 A2 2 0 1 1 7.04 4.29 L7.1 4.35 A1.65 1.65 0 0 0 8.92 4.68 H9 A1.65 1.65 0 0 0 10 3.17 V3 A2 2 0 0 1 14 3 V3.09 A1.65 1.65 0 0 0 15 4.6 A1.65 1.65 0 0 0 16.82 4.27 L16.88 4.21 A2 2 0 1 1 19.71 7.04 L19.65 7.1 A1.65 1.65 0 0 0 19.32 8.92 V9 A1.65 1.65 0 0 0 20.83 10 H21 A2 2 0 0 1 21 14 H20.91 A1.65 1.65 0 0 0 19.4 15",
  layers: "M12 3 L21 8 L12 13 L3 8 Z M3 13 L12 18 L21 13",
  lock: "M6 11 H18 V20 H6 Z M9 11 V8 A3 3 0 0 1 15 8 V11",
  loop: "M4.5 12 A7.5 7.5 0 0 1 17.3 6.7 L20 9 M20 3.5 V9 H14.5 M19.5 12 A7.5 7.5 0 0 1 6.7 17.3 L4 15 M4 20.5 V15 H9.5",
  network: "M14.5 5 A2.5 2.5 0 1 1 9.5 5 A2.5 2.5 0 1 1 14.5 5 M7.5 19 A2.5 2.5 0 1 1 2.5 19 A2.5 2.5 0 1 1 7.5 19 M21.5 19 A2.5 2.5 0 1 1 16.5 19 A2.5 2.5 0 1 1 21.5 19 M12 7.5 V13 M12 13 L7 17 M12 13 L17 17",
  queue: "M4 7 H20 M4 12 H20 M4 17 H14",
  rocket: "M12 3 C15 7 15 13 12 21 C9 13 9 7 12 3",
  route: "M5 19 H12 A4 4 0 0 0 12 11 H8 A4 4 0 0 1 8 3 H19",
  server: "M4 5 H20 V10 H4 Z M4 14 H20 V19 H4 Z M8 7.5 H8.01 M8 16.5 H8.01",
  shield: "M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z",
  terminal: "M5.5 4 H18.5 A2.5 2.5 0 0 1 21 6.5 V17.5 A2.5 2.5 0 0 1 18.5 20 H5.5 A2.5 2.5 0 0 1 3 17.5 V6.5 A2.5 2.5 0 0 1 5.5 4 M7 9 L10 12 L7 15 M13 15 H17",
  users: "M8 11 A3 3 0 1 0 8 5 A3 3 0 1 0 8 11 M2 20 A6 6 0 0 1 14 20 M16 6 A3 3 0 0 1 16 11 M15 20 A6 6 0 0 0 22 20",
};

export const ICON_PATHS = Object.freeze(PATHS);
export const ICON_IDS = Object.freeze(Object.keys(PATHS).sort());
export const hasIcon = (id) => Object.hasOwn(PATHS, id);
export function iconPath(id) {
  if (!hasIcon(id)) throw new Error(`unknown bundled icon id "${id}"`);
  return PATHS[id];
}
