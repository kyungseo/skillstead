#!/usr/bin/env node
// render.mjs — canonical cross-platform SVG → 2× PNG renderer (C5R1-CX-F1).
//
// Node 18+ standard library only. This is the single canonical implementation
// of browser discovery and render semantics; render.sh is a thin POSIX/Git-
// Bash wrapper that delegates here, so no second path matrix can drift. On
// Windows this entrypoint needs neither PowerShell nor Git Bash:
//
//   node .claude\skills\svg-infographic\scripts\render.mjs diagram.svg
//
// Pipeline: source lint (hard gate) → browser discovery (PATH + documented
// known paths) → headless Chromium screenshot at scale × viewBox → PNG IHDR
// exact-dimension verification.
//
// Exit codes match render.sh: 0 ok · 1 usage/input error · 2 no browser or
// failed Chromium-identity verification · 3 render/spawn failed · 4 dimension
// mismatch · 5 source lint hard errors · 6 Node runtime below 18 (the same
// preflight contract as the bash wrapper, enforced here for direct execution)
//
// Browser override: set SVG_INFOGRAPHIC_BROWSER to an executable path to skip
// discovery (used for owner-approved outside-sandbox retries and tests). The
// override must still be a Chromium-based browser — identity is verified
// (--version output or executable name) and anything else fails closed;
// substituting another renderer and labelling it a Chromium render is
// forbidden (SKILL.md §5).

import { readFileSync, writeFileSync, copyFileSync, openSync, readSync, closeSync, existsSync, mkdtempSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, delimiter, win32 as pathWin32 } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import process from "node:process";

import { runCli as runLintCli } from "./check-svg.mjs";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function parseViewBox(svgSource) {
  const m = svgSource.match(/viewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (!m) return null;
  const w = parseFloat(m[3]);
  const h = parseFloat(m[4]);
  return w > 0 && h > 0 ? { w: Math.round(w), h: Math.round(h) } : null;
}

// Candidate list: PATH command names first, then the documented per-platform
// known paths — on Windows exactly the four locations authoring.md §8 lists,
// in the same order.
export function browserCandidates(platform = process.platform, env = process.env) {
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "msedge", "chrome"];
  const paths = [];
  if (platform === "darwin") {
    paths.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else if (platform === "win32") {
    const pf = env.ProgramFiles ?? "C:\\Program Files";
    const pf86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    paths.push(
      pathWin32.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
      pathWin32.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
      pathWin32.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
      pathWin32.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    );
  }
  return { names, paths };
}

export function findOnPath(name, env = process.env, platform = process.platform, existsFn = existsSync) {
  const pathVar = env.PATH ?? env.Path ?? "";
  const exts = platform === "win32" ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";") : [""];
  const joiner = platform === "win32" ? pathWin32.join : join;
  const sep = platform === "win32" ? ";" : delimiter;
  for (const dir of pathVar.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = joiner(dir, name + ext.toLowerCase());
      if (existsFn(candidate)) return candidate;
    }
  }
  return null;
}

// Chromium-identity verification (C5R2-P1): a resolved executable is accepted
// only when its --version output names a Chromium family, or — because
// Chrome/Edge on Windows print nothing for --version — when the executable
// basename itself is a known Chromium binary name. Anything else fails
// closed; this guards against accidental renderer substitution, not against
// a hostile local binary that impersonates chrome.exe.
const CHROMIUM_VERSION_RE = /\b(google chrome|chromium|microsoft edge)\b/i;
const CHROMIUM_BASENAME_RE = /^(chrome|chromium(-browser)?|google-chrome(-stable)?|msedge|microsoft edge)(\.exe)?$/i;

export function verifyChromiumIdentity(executablePath, versionOutput, { platform = process.platform, documentedPaths = [] } = {}) {
  const version = (versionOutput ?? "").trim();
  if (version && CHROMIUM_VERSION_RE.test(version)) return { ok: true, version };
  const base = executablePath.split(/[\\/]/).pop() ?? "";
  // Windows existing-session fallback (C5 evidence): a running Chrome/Edge
  // answers --version with a localized non-version status message. Identity
  // may then come from the install location alone — but ONLY for an exact
  // documented Program Files path with the expected binary name. The raw
  // output is disclosed as unrecognized/localized and never interpreted.
  if (platform === "win32" && /^(chrome|msedge)\.exe$/i.test(base) && documentedPaths.includes(executablePath)) {
    return {
      ok: true,
      version: version
        ? `identity from documented install path; unrecognized/localized --version output: "${version}"`
        : "identity from documented install path; no --version output",
    };
  }
  if (!version && CHROMIUM_BASENAME_RE.test(base)) {
    return { ok: true, version: "version unavailable from --version (identity from executable name)" };
  }
  return {
    ok: false,
    reason: version
      ? `--version output does not identify a Chromium-based browser: "${version}"`
      : `no --version output and executable name "${base}" is not a known Chromium binary`,
  };
}

export function resolveBrowser({ platform = process.platform, env = process.env, existsFn = existsSync } = {}) {
  const override = env.SVG_INFOGRAPHIC_BROWSER;
  if (override) {
    return existsFn(override) ? { path: override, via: "SVG_INFOGRAPHIC_BROWSER override" } : null;
  }
  const { names, paths } = browserCandidates(platform, env);
  for (const name of names) {
    const hit = findOnPath(name, env, platform, existsFn);
    if (hit) return { path: hit, via: `PATH (${name})` };
  }
  for (const p of paths) {
    if (existsFn(p)) return { path: p, via: "documented known path" };
  }
  return null;
}

export function pngDims(path) {
  const buf = Buffer.alloc(8);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buf, 0, 8, 16);
  } finally {
    closeSync(fd);
  }
  return { w: buf.readUInt32BE(0), h: buf.readUInt32BE(4) };
}

// Structural completeness check (C5 lifecycle P1): a PNG counts as produced
// only when its chunk chain is intact from the signature to an IEND chunk
// that ends exactly at EOF. A signature+IHDR fragment (which already carries
// plausible dimensions) must never be accepted as a rendered artifact.
export function isCompletePng(path) {
  let data;
  try {
    data = readFileSync(path);
  } catch {
    return false;
  }
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < SIG.length + 12 || !data.subarray(0, 8).equals(SIG)) return false;
  let offset = 8;
  let sawIhdrFirst = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("latin1", offset + 4, offset + 8);
    if (offset === 8) {
      if (type !== "IHDR" || length !== 13) return false;
      sawIhdrFirst = true;
    }
    const next = offset + 12 + length; // len + type + data + CRC
    if (next > data.length) return false; // truncated chunk
    if (type === "IEND") return sawIhdrFirst && length === 0 && next === data.length;
    offset = next;
  }
  return false;
}

export function buildFlags({ w, h, scale, transparent, shotPath, url, profileDir }) {
  const flags = [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    // Renderer-owned isolated profile (C5 existing-session correction): the
    // render must never attach to, lock, or mutate the user's running
    // Chrome/Edge profile — browsers stay open, we bring our own profile.
    `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check",
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
    `--screenshot=${shotPath}`,
  ];
  if (transparent) flags.push("--default-background-color=00000000");
  flags.push(url);
  return flags;
}

function quoteForShell(parts) {
  return parts.map((p) => (/[\s"'\\()]/.test(p) ? `"${p.replace(/"/g, '\\"')}"` : p)).join(" ");
}

// Browser lifecycle state machine (C5 lifecycle P1). States:
//   running → terminating (renderer-initiated: artifact-complete or timeout)
//           → exited (the ONLY state that settles the promise)
// Rules encoded here:
//   - readiness = isCompletePng (structurally complete, IEND at EOF) — never
//     size stability alone;
//   - once the renderer initiates termination, a signal/nonzero exit is not a
//     failure signal: the outcome is decided by why termination started;
//   - the promise settles only after the child's `close` event, so profile
//     cleanup can never race a live child.
async function runBrowserForScreenshot(executable, flags, shotPath, timeoutMs) {
  return new Promise((resolvePromise) => {
    const state = { phase: "running", reason: null, settled: false };
    const settle = (value) => {
      if (!state.settled) {
        state.settled = true;
        resolvePromise(value);
      }
    };
    let child;
    try {
      child = spawn(executable, flags, { stdio: "ignore" });
    } catch (e) {
      return settle({ ok: false, status: null, errorCode: e.code ?? e.message });
    }
    child.on("error", (e) => settle({ ok: false, status: null, errorCode: e.code ?? e.message }));
    child.on("close", (code, signal) => {
      state.phase = "exited";
      if (state.reason === "artifact-complete") {
        settle({ ok: true });
      } else if (state.reason === "timeout") {
        settle({ ok: false, status: null, timedOut: true });
      } else {
        // Self-initiated exit: success requires a clean exit AND a complete artifact.
        const good = code === 0 && isCompletePng(shotPath);
        settle(good ? { ok: true } : { ok: false, status: signal ?? code });
      }
    });

    const initiateTermination = async (reason) => {
      if (state.phase !== "running") return;
      state.phase = "terminating";
      state.reason = reason;
      child.kill();
      await delay(1500);
      if (!state.settled && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      // No settle here — only the close handler settles, after real exit.
    };

    (async () => {
      const deadline = Date.now() + timeoutMs;
      while (!state.settled && state.phase === "running" && Date.now() < deadline) {
        await delay(150);
        if (isCompletePng(shotPath)) {
          return initiateTermination("artifact-complete");
        }
      }
      if (!state.settled && state.phase === "running") initiateTermination("timeout");
    })();
  });
}

// Bounded temp cleanup (C5 lifecycle P2): Chromium helpers may release
// profile handles a moment after the child exits, so EBUSY/EPERM/ENOTEMPTY
// gets a bounded retry. A final failure is reported as an ASCII diagnostic
// and never changes the render exit code.
export async function cleanupWithRetry(path, { rmFn = rmSync, retries = 5, delayMs = 300, delayFn = delay } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      rmFn(path, { recursive: true, force: true });
      return { ok: true, attempts: attempt + 1 };
    } catch (e) {
      const retryable = e.code === "EBUSY" || e.code === "EPERM" || e.code === "ENOTEMPTY";
      if (!retryable || attempt >= retries) return { ok: false, attempts: attempt + 1, code: e.code ?? e.message };
      await delayFn(delayMs);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.error("usage: node render.mjs input.svg [output.png] [--scale N] [--transparent]");
}

export async function main(argv) {
  let svg = "";
  let out = "";
  let scale = 2;
  let transparent = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scale") scale = Number(argv[++i]);
    else if (a === "--transparent") transparent = true;
    else if (a === "-h" || a === "--help") { usage(); return 0; }
    else if (a.startsWith("-")) { console.error(`unknown option: ${a}`); usage(); return 1; }
    else if (!svg) svg = a;
    else if (!out) out = a;
    else { console.error(`unexpected argument: ${a}`); return 1; }
  }
  if (!svg || !Number.isFinite(scale) || scale <= 0) { usage(); return 1; }

  // C5R2-P2: the direct-execution path (Windows CMD/PowerShell) carries the
  // same Node 18+ preflight and exit-6 contract as the bash wrapper.
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (!(nodeMajor >= 18)) {
    console.error(`render gate unavailable: Node ${process.versions.node} found, but the canonical path requires Node 18+.`);
    console.error("Approve the skill's package-manager upgrade prompt, or use its manual source-check + Chromium render fallback (references/authoring.md section 8).");
    return 6;
  }

  if (!existsSync(svg)) { console.error(`input SVG not found: ${svg}`); return 1; }
  if (!out) out = svg.replace(/\.svg$/i, "") + ".png";

  // --- 1. source lint gate (before any browser work) ----------------------
  const lintExit = runLintCli([svg]);
  if (lintExit !== 0) {
    console.error("source lint failed: fix the hard errors above (SKILL.md section 4), then re-run.");
    return 5;
  }

  // --- 2. viewBox ---------------------------------------------------------
  const vb = parseViewBox(readFileSync(svg, "utf8"));
  if (!vb) { console.error(`could not parse viewBox from ${svg}`); return 1; }

  // --- 3. browser discovery (disclosed) -----------------------------------
  const browser = resolveBrowser();
  if (!browser) {
    const { names, paths } = browserCandidates();
    console.error("no Chromium-based browser found. Checked PATH names: " + names.join(", "));
    if (paths.length) console.error("and known locations:\n  " + paths.join("\n  "));
    console.error("Install Chrome/Edge/Chromium, or set SVG_INFOGRAPHIC_BROWSER to the executable path.");
    return 2;
  }
  const versionProbe = spawnSync(browser.path, ["--version"], { encoding: "utf8", timeout: 15000 });
  const identity = verifyChromiumIdentity(browser.path, versionProbe.stdout, { documentedPaths: browserCandidates().paths });
  if (!identity.ok) {
    // C5R2-P1: fail closed — an arbitrary executable must never be accepted
    // as the canonical renderer, even via the override.
    console.error(`refusing renderer ${browser.path} [via ${browser.via}]: ${identity.reason}`);
    console.error("The canonical renderer must be a Chromium-based browser (Chrome/Edge/Chromium) - SKILL.md section 5.");
    return 2;
  }
  console.log(`renderer: ${browser.path} (${identity.version}) [via ${browser.via}]`);

  // --- 4. wrapper + render -------------------------------------------------
  const tmp = mkdtempSync(join(tmpdir(), "svg-infographic-"));
  try {
    const stage = join(tmp, "diagram.svg");
    copyFileSync(svg, stage);
    const wrapper = join(tmp, "wrapper.html");
    writeFileSync(wrapper, `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:${vb.w}px;height:${vb.h}px;overflow:hidden}
img{display:block;width:${vb.w}px;height:${vb.h}px}
</style></head><body><img src="diagram.svg"></body></html>\n`);
    const shot = join(tmp, "out.png");
    const profileDir = join(tmp, "profile");
    mkdirSync(profileDir, { recursive: true });
    const flags = buildFlags({ w: vb.w, h: vb.h, scale, transparent, shotPath: shot, url: pathToFileURL(wrapper).href, profileDir });
    // With a fresh isolated --user-data-dir, current Chromium (observed on
    // Chrome 150) writes the screenshot and then may keep running instead of
    // exiting. The renderer therefore watches for the produced artifact and
    // terminates ITS OWN child process once the file is stable — the user's
    // running Chrome/Edge is a different process with a different profile and
    // is never touched. stdio is ignored (helper children hold the pipes).
    const timeoutMs = Number(process.env.SVG_INFOGRAPHIC_RENDER_TIMEOUT_MS) || 120000;
    const run = await runBrowserForScreenshot(browser.path, flags, shot, timeoutMs);
    const produced = run.ok;
    if (!produced) {
      // C5R3-P1: the approved retry is the CANONICAL command itself — it uses
      // the persistent original SVG and requested output/options, and re-runs
      // the full pipeline (lint → discovery → render → exact 2× → placement).
      // Nothing temporary is referenced or retained.
      console.error(`render failed (browser exit=${run.timedOut ? "timeout" : run.status ?? "spawn error"}${run.errorCode ? `, spawn error, ${run.errorCode}` : ""}).`);
      if (run.errorCode === "EACCES" || run.errorCode === "EPERM") {
        console.error("The browser launch appears to be denied by a sandbox/permission boundary.");
      }
      const retry = [process.execPath, fileURLToPath(import.meta.url), svg, out];
      if (scale !== 2) retry.push("--scale", String(scale));
      if (transparent) retry.push("--transparent");
      console.error("With owner approval, run this exact canonical command outside the sandbox - it repeats lint, render, exact 2x verification, and output placement:");
      console.error("  " + quoteForShell(retry));
      if (process.env.SVG_INFOGRAPHIC_BROWSER) {
        console.error(`  (keep SVG_INFOGRAPHIC_BROWSER=${process.env.SVG_INFOGRAPHIC_BROWSER} set only if that browser should still be used)`);
      }
      console.error("Do not substitute another renderer (app browser/resvg/ImageMagick) or post-process pixels (SKILL.md section 5).");
      return 3;
    }

    // --- 5. exact-dimension verification ----------------------------------
    if (!isCompletePng(shot)) {
      console.error(`render produced a structurally incomplete PNG (no intact chunk chain ending in IEND at EOF): ${shot}`);
      return 3;
    }
    const dims = pngDims(shot);
    const expW = vb.w * scale;
    const expH = vb.h * scale;
    if (dims.w !== expW || dims.h !== expH) {
      console.error(`DIMENSION MISMATCH  ${out} would be ${dims.w}x${dims.h}, expected ${expW}x${expH} (${scale}x of ${vb.w}x${vb.h})`);
      return 4;
    }
    mkdirSync(dirname(resolve(out)), { recursive: true });
    renameSync(shot, out);
    console.log(`OK  ${out}  ${dims.w}x${dims.h}  (= ${scale}x of ${vb.w}x${vb.h} viewBox)`);
    return 0;
  } finally {
    const cleaned = await cleanupWithRetry(tmp);
    if (!cleaned.ok) {
      console.error(`temporary staging/profile directory could not be removed after ${cleaned.attempts} attempts (${cleaned.code}): ${tmp} - remove it manually.`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
