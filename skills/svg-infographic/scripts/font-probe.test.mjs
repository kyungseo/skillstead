// font-probe 계약 테스트 — browser 필요 (render suite와 동일 환경 전제)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const run = (f) => spawnSync(process.execPath, [join(here, "font-probe.mjs"), join(here, "skin-fixtures", "typography", f)],
  { encoding: "utf8", timeout: 60000 });

test("probe positive: 실제 subset embed는 load+computed=alias+weight로 통과", () => {
  const r = run("tf-probe-positive.svg");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /HiMelody-Subset \(w 400/);
});
test("probe negative: 유실 wrapper는 load 실패·family mismatch로 fail-closed", () => {
  const r = run("tf-wrapper-lost.svg");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /PROBLEM/);
});
