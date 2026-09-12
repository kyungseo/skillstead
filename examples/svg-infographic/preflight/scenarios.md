# Preflight Decision Scenarios

These inputs test preflight decisions, not rendering quality or installed-skill discovery. Supply the applicable
preflight contract and one scenario to a fresh executor. Keep `expected-outcomes.md` hidden until the first answer.
Ask for the immediate next action without creating files or running tools.

## P1 — Settled choices and authorized creation

Create a Korean 1200×675 developer diagram showing request → cache check → return on hit / origin lookup on miss.
Write `docs/diagrams/cache.svg` and its 2× PNG. File creation is authorized. The directory is writable, neither file
exists, and Node 22 and Chromium are available.

## P2 — Composition only

Propose a Korean 1200×675 diagram of a cache request flow. Do not create files or render yet. Node 22 and Chromium
are available.

## P3 — Missing tool with separate installation authority

Create a Korean 1200×675 developer diagram of a cache request flow as SVG and 2× PNG under `docs/diagrams`.
Creating new output files is authorized. Node is missing and a trusted package manager is available. System
package installation has not been authorized.
