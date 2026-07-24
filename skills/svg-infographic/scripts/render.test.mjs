// render.test.mjs — unit fixtures for the canonical Node renderer (C5R1).
// Run with: node --test skills/svg-infographic/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync, existsSync as existsSyncPath, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parseViewBox, browserCandidates, resolveBrowser, pngDims, buildFlags, verifyChromiumIdentity, isCompletePng, cleanupWithRetry } from "./render.mjs";
import { chmodSync } from "node:fs";

// Craft a structurally valid (or deliberately partial) PNG without an encoder.
function makePng({ w = 1200, h = 600, complete = true } = {}) {
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const chunk = (type, data) => {
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, "latin1");
    data.copy(buf, 8);
    return buf; // CRC bytes stay zero — completeness is structural, not CRC
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  chunks.push(chunk("IHDR", ihdr));
  if (complete) {
    chunks.push(chunk("IDAT", Buffer.alloc(10)));
    chunks.push(chunk("IEND", Buffer.alloc(0)));
  }
  return Buffer.concat(chunks);
}

function makeShim(dir, payloadPath, { sleepSecs = 60 } = {}) {
  const shim = join(dir, "chrome");
  writeFileSync(shim, `#!/bin/sh
for a in "$@"; do case "$a" in --screenshot=*) cp "${payloadPath}" "\${a#--screenshot=}";; esac; done
sleep ${sleepSecs}
`);
  chmodSync(shim, 0o755);
  return shim;
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(here, "fixtures", name);
const runCli = (args, env = {}) =>
  spawnSync(process.execPath, [join(here, "render.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

test("parseViewBox accepts a valid box and rejects invalid ones", () => {
  assert.deepEqual(parseViewBox('<svg viewBox="0 0 600 300">'), { w: 600, h: 300 });
  assert.equal(parseViewBox('<svg viewBox="0 0 0 300">'), null);
  assert.equal(parseViewBox("<svg>"), null);
});

test("Windows browser candidates list exactly the four documented locations, in order", () => {
  const env = { ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)" };
  const { paths } = browserCandidates("win32", env);
  assert.deepEqual(paths, [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ]);
});

test("resolveBrowser falls back to known paths when PATH has no candidate", () => {
  const env = { PATH: "", ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)" };
  const edgeX86 = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const hit = resolveBrowser({ platform: "win32", env, existsFn: (p) => p === edgeX86 });
  assert.equal(hit.path, edgeX86);
  assert.equal(hit.via, "documented known path");
  const none = resolveBrowser({ platform: "win32", env, existsFn: () => false });
  assert.equal(none, null);
});

test("a Windows PATH/PATHEXT candidate wins over the known paths (C5R2-P2)", () => {
  const env = {
    PATH: "C:\\tools;C:\\other",
    PATHEXT: ".COM;.EXE",
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
  };
  const pathHit = "C:\\tools\\msedge.exe";
  const knownHit = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const hit = resolveBrowser({ platform: "win32", env, existsFn: (p) => p === pathHit || p === knownHit });
  assert.equal(hit.path, pathHit, "the PATH candidate must take precedence over known locations");
  assert.equal(hit.via, "PATH (msedge)");
});

test("verifyChromiumIdentity accepts Chromium family and fails closed otherwise (C5R2-P1)", () => {
  assert.equal(verifyChromiumIdentity("/usr/bin/x", "Google Chrome 150.0.7871.181").ok, true);
  assert.equal(verifyChromiumIdentity("C:\\e\\msedge.exe", "Microsoft Edge 130.0").ok, true);
  // Windows binaries often print nothing — identity from the executable name only then.
  assert.equal(verifyChromiumIdentity("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "").ok, true);
  assert.equal(verifyChromiumIdentity("/usr/bin/false", "").ok, false);
  assert.equal(verifyChromiumIdentity("/opt/fake/chrome", "resvg 0.44").ok, false, "a non-Chromium version string fails even with a chrome-like name");
});

test("running Chrome/Edge with localized non-version output is accepted only from an exact documented path (C5 existing-session)", () => {
  const documentedPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const localized = "기존 브라우저 세션에서 열립니다."; // localized non-version status
  const opts = { platform: "win32", documentedPaths };
  const ok = verifyChromiumIdentity(documentedPaths[0], localized, opts);
  assert.equal(ok.ok, true);
  assert.match(ok.version, /identity from documented install path; unrecognized\/localized/);
  // The same localized output from an arbitrary path stays rejected.
  assert.equal(verifyChromiumIdentity("C:\\tools\\chrome.exe", localized, opts).ok, false);
  // resvg-style output from an arbitrary PATH/override executable stays rejected.
  assert.equal(verifyChromiumIdentity("C:\\tools\\chrome.exe", "resvg 0.44", opts).ok, false);
  // Non-Windows platforms never use the documented-path fallback.
  assert.equal(verifyChromiumIdentity("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", localized, { platform: "darwin", documentedPaths: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] }).ok, false);
});

test("SVG_INFOGRAPHIC_BROWSER override wins and fails closed when the path is missing", () => {
  const env = { SVG_INFOGRAPHIC_BROWSER: "/opt/chrome", PATH: "" };
  const hit = resolveBrowser({ platform: "linux", env, existsFn: (p) => p === "/opt/chrome" });
  assert.equal(hit.via, "SVG_INFOGRAPHIC_BROWSER override");
  assert.equal(resolveBrowser({ platform: "linux", env, existsFn: () => false }), null);
});

test("isCompletePng requires an intact chunk chain with IEND exactly at EOF (C5 lifecycle P1)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "png-complete-"));
  try {
    const partial = join(tmp, "partial.png");
    writeFileSync(partial, makePng({ complete: false })); // 33-byte signature+IHDR — the Codex repro
    assert.equal(isCompletePng(partial), false);

    const complete = join(tmp, "complete.png");
    writeFileSync(complete, makePng({ complete: true }));
    assert.equal(isCompletePng(complete), true);

    const trailing = join(tmp, "trailing.png");
    writeFileSync(trailing, Buffer.concat([makePng({ complete: true }), Buffer.from([0x00])]));
    assert.equal(isCompletePng(trailing), false, "IEND must sit exactly at EOF");

    const truncated = join(tmp, "truncated.png");
    writeFileSync(truncated, makePng({ complete: true }).subarray(0, 40));
    assert.equal(isCompletePng(truncated), false, "a truncated chunk must fail");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a fake renderer emitting an IHDR-only partial PNG is rejected, not approved (C5 lifecycle P1)", (t) => {
  const shimDir = mkdtempSync(join(tmpdir(), "partial-shim-"));
  try {
    const payload = join(shimDir, "payload.png");
    writeFileSync(payload, makePng({ complete: false }));
    const shim = makeShim(shimDir, payload, { sleepSecs: 0 }); // writes partial, exits 0
    const out = join(shimDir, "out.png");
    const res = runCli([fixture("valid.svg"), out], { SVG_INFOGRAPHIC_BROWSER: shim });
    if (res.status === 3 && /spawn error, (EACCES|EPERM)/.test(res.stderr)) return t.skip("sandbox denies process spawn");
    assert.equal(res.status, 3, res.stderr);
    assert.ok(!res.stdout.includes("OK "), "a partial PNG must never be reported as OK");
    assert.ok(!existsSyncPath(out), "no output may be placed from an incomplete artifact");
  } finally {
    rmSync(shimDir, { recursive: true, force: true });
  }
});

test("artifact-complete termination settles success only after the child really exits (C5 lifecycle P1)", (t) => {
  const shimDir = mkdtempSync(join(tmpdir(), "complete-shim-"));
  try {
    const payload = join(shimDir, "payload.png");
    writeFileSync(payload, makePng({ w: 1200, h: 600, complete: true }));
    const shim = makeShim(shimDir, payload, { sleepSecs: 60 }); // never exits on its own
    const out = join(shimDir, "out.png");
    const started = Date.now();
    const res = runCli([fixture("valid.svg"), out], { SVG_INFOGRAPHIC_BROWSER: shim });
    if (res.status === 3 && /spawn error, (EACCES|EPERM)/.test(res.stderr)) return t.skip("sandbox denies process spawn");
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /OK {2}.*1200x600/);
    assert.ok(existsSyncPath(out));
    assert.ok(Date.now() - started < 30000, "renderer-initiated termination must not wait for the 60s sleep");
    assert.equal(res.stderr, "", "the renderer-initiated signal exit must not surface as a failure");
  } finally {
    rmSync(shimDir, { recursive: true, force: true });
  }
});

test("timeout with only a partial artifact fails with a timeout diagnostic (C5 lifecycle P1)", (t) => {
  const shimDir = mkdtempSync(join(tmpdir(), "timeout-shim-"));
  try {
    const payload = join(shimDir, "payload.png");
    writeFileSync(payload, makePng({ complete: false }));
    const shim = makeShim(shimDir, payload, { sleepSecs: 60 });
    const out = join(shimDir, "out.png");
    const res = runCli([fixture("valid.svg"), out], { SVG_INFOGRAPHIC_BROWSER: shim, SVG_INFOGRAPHIC_RENDER_TIMEOUT_MS: "1500" });
    if (res.status === 3 && /spawn error, (EACCES|EPERM)/.test(res.stderr)) return t.skip("sandbox denies process spawn");
    assert.equal(res.status, 3);
    assert.match(res.stderr, /browser exit=timeout/);
  } finally {
    rmSync(shimDir, { recursive: true, force: true });
  }
});

test("cleanupWithRetry retries transient Windows-style lock errors and reports final failure (C5 lifecycle P2)", async () => {
  let calls = 0;
  const flaky = () => {
    calls++;
    if (calls < 3) { const e = new Error("busy"); e.code = "EBUSY"; throw e; }
  };
  const ok = await cleanupWithRetry("/fake/path", { rmFn: flaky, retries: 5, delayFn: async () => {} });
  assert.deepEqual(ok, { ok: true, attempts: 3 });

  const alwaysLocked = () => { const e = new Error("locked"); e.code = "EPERM"; throw e; };
  const fail = await cleanupWithRetry("/fake/path", { rmFn: alwaysLocked, retries: 2, delayFn: async () => {} });
  assert.deepEqual(fail, { ok: false, attempts: 3, code: "EPERM" });

  const fatal = () => { const e = new Error("denied"); e.code = "EACCES"; throw e; };
  const immediate = await cleanupWithRetry("/fake/path", { rmFn: fatal, retries: 5, delayFn: async () => {} });
  assert.equal(immediate.ok, false);
  assert.equal(immediate.attempts, 1, "non-retryable errors must not be retried");
});

test("pngDims reads exact IHDR dimensions", () => {
  const tmp = mkdtempSync(join(tmpdir(), "png-dims-"));
  try {
    const file = join(tmp, "probe.png");
    const buf = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.writeUInt32BE(13, 8); // IHDR length
    buf.write("IHDR", 12);
    buf.writeUInt32BE(2160, 16);
    buf.writeUInt32BE(2700, 20);
    writeFileSync(file, buf);
    assert.deepEqual(pngDims(file), { w: 2160, h: 2700 });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint gate runs before any browser attempt (hard error exits 5, not 2/3)", () => {
  const res = runCli([fixture("missing-marker-units.svg")], { SVG_INFOGRAPHIC_BROWSER: "/usr/bin/false" });
  assert.equal(res.status, 5);
  assert.match(res.stderr, /E-MARKER/);
  assert.ok(!res.stderr.includes("render failed"), "the browser must never be attempted after lint errors");
});

test("a non-Chromium override executable is refused fail-closed with exit 2 (C5R2-P1)", () => {
  const res = runCli([fixture("valid.svg")], { SVG_INFOGRAPHIC_BROWSER: "/usr/bin/false" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /refusing renderer .*\/false/);
  assert.match(res.stderr, /must be a Chromium-based browser/);
});

function parseCommandLine(line) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line)) !== null) tokens.push(m[1] ?? m[2]);
  return tokens;
}

test("browser spawn failure prints a canonical retry command with no temporary references (C5R3-P1)", (t) => {
  // A shim that passes the executable-name identity check but fails to render.
  const shimDir = mkdtempSync(join(tmpdir(), "chrome-shim-"));
  const shim = join(shimDir, "chrome");
  writeFileSync(shim, "#!/bin/sh\nexit 1\n");
  chmodSync(shim, 0o755);
  const out = join(shimDir, "retry-target.png");
  try {
    const res = runCli([fixture("valid.svg"), out], { SVG_INFOGRAPHIC_BROWSER: shim });
    // Classified sandbox denial of the shim itself is an environment limit,
    // not a contract failure; anything unclassified must fail the test hard.
    if (res.status === 3 && /spawn error, (EACCES|EPERM)/.test(res.stderr)) {
      return t.skip("sandbox denies process spawn (EACCES/EPERM)");
    }
    assert.equal(res.status, 3, res.stderr);
    assert.match(res.stderr, /render failed \(browser exit=1/);
    assert.match(res.stderr, /run this exact canonical command outside the sandbox/);
    const cmdLine = res.stderr.split("\n").find((l) => l.includes("render.mjs"));
    assert.ok(cmdLine, "a canonical render.mjs retry command must be printed");
    assert.ok(!res.stderr.includes("--screenshot="), "the retry must not be a raw browser command");
    assert.ok(!/svg-infographic-[A-Za-z0-9]+/.test(cmdLine) && !cmdLine.includes("wrapper.html") && !cmdLine.includes("diagram.svg"), "the retry command must not reference the renderer's temporary staging files");
    const tokens = parseCommandLine(cmdLine.trim());
    assert.ok(tokens[1].endsWith("render.mjs"));
    assert.ok(tokens.includes(fixture("valid.svg")), "the retry uses the persistent original SVG");
    assert.ok(tokens.includes(out), "the retry preserves the requested output path");
    assert.match(res.stderr, /Do not substitute another renderer/);

    // C5R3-P1 regression: the printed command itself completes the canonical
    // pipeline (lint → render → exact 2× → placement) when a real browser is
    // available.
    if (!resolveBrowser()) return t.skip("no Chromium-based browser to execute the printed retry command");
    const retry = spawnSync(tokens[0], tokens.slice(1), { encoding: "utf8", env: { ...process.env, SVG_INFOGRAPHIC_BROWSER: "" } });
    assert.equal(retry.status, 0, retry.stderr);
    assert.match(retry.stdout, /OK {2}.*1200x600 {2}\(= 2x of 600x300 viewBox\)/);
    assert.ok(existsSyncPath(out), "the retry places the final PNG at the requested output path");
  } finally {
    rmSync(shimDir, { recursive: true, force: true });
  }
});

test("transparent flag is appended before the URL", () => {
  const flags = buildFlags({ w: 600, h: 300, scale: 2, transparent: true, shotPath: "/tmp/o.png", url: "file:///w.html", profileDir: "/tmp/stage/profile" });
  assert.ok(flags.includes("--default-background-color=00000000"));
  assert.equal(flags[flags.length - 1], "file:///w.html");
});

test("every render carries a renderer-owned isolated profile inside the temp root (C5 existing-session)", () => {
  const flags = buildFlags({ w: 600, h: 300, scale: 2, transparent: false, shotPath: "/tmp/stage/out.png", url: "file:///w.html", profileDir: "/tmp/stage/profile" });
  const udd = flags.find((f) => f.startsWith("--user-data-dir="));
  assert.ok(udd, "an isolated --user-data-dir must always be present");
  assert.equal(udd, "--user-data-dir=/tmp/stage/profile");
  assert.ok(flags.includes("--no-first-run") && flags.includes("--no-default-browser-check"));
});

test("end-to-end canonical render succeeds with exact 2× and a clean stderr (skips without a browser)", (t) => {
  if (!resolveBrowser()) return t.skip("no Chromium-based browser on this host");
  const stagingDirs = () => readdirSync(tmpdir()).filter((d) => d.startsWith("svg-infographic-")).length;
  const before = stagingDirs();
  const tmp = mkdtempSync(join(tmpdir(), "render-e2e-"));
  try {
    const out = join(tmp, "valid.png");
    const res = runCli([fixture("valid.svg"), out]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /renderer: /);
    assert.match(res.stdout, /OK {2}.*1200x600 {2}\(= 2x of 600x300 viewBox\)/);
    assert.equal(res.stderr, "", "a clean canonical render must not touch stderr");
    assert.equal(stagingDirs(), before, "the staging dir (including the isolated browser profile) must be cleaned up");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
