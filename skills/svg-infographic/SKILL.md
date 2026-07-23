---
name: svg-infographic
description: Author technical/structured SVG infographics and diagrams, then render them to crisp PNG with a headless browser. Best for architecture diagrams, topology maps, flows, before/after comparisons, nested/onion layer models, roadmaps, decision matrices, and social-ready technical one-pagers. Prefers clean line icons in soft tinted circles. First-class Korean/CJK text. Includes an opt-in "tidy hand-drawn" sketch preset (paper background, Korean handwriting font, rough strokes, highlighter). Not for photo-heavy or illustration-heavy graphics, statistical charts, or mascot/character illustration.
---

# svg-infographic

Use this skill when the user wants a technical or structured infographic/diagram from a description, or asks to export an SVG to PNG.

Good for: architecture diagrams, cloud/network topology, component/layer diagrams, before/after, process/data flow, nested "onion" models, roadmap/risk maps, decision matrices, social-ready technical one-pagers.

Do **not** use for: photo/illustration-heavy marketing graphics; **data-accurate** statistical charts (bar/line/scatter/heatmap — use a chart tool); mascots or character illustration; custom logo design or bespoke icon design.

Nuances: a **simple qualitative** 2×2/3×3 matrix or a status-count badge is fine (it's structure, not a data-accurate chart). Using the built-in line-icon set is expected and encouraged — the non-goal is *designing new brand marks*, not using icons. A hand-drawn / sketchnote feel is supported as the **opt-in sketch preset** (`references/sketch.md`) — "tidy hand-drawn": hand-drawn surface, computed layout; mascots and scene illustration stay out of scope.

**Package map** — this skill ships as a directory; load the parts on demand:

| File | When to read |
| --- | --- |
| `references/archetypes.md` | **Always, before the layout pass** — the chosen archetype's layout skeleton, premium recipe, and per-type checks |
| `references/authoring.md` | **Always, before writing SVG** — detailed geometry/connector/panel/emphasis/color rules and the full icon set; also the manual render fallback |
| `references/sketch.md` | Only when the user asks for a hand-drawn / sketchnote / 손글씨 feel — the opt-in sketch preset (paper, handwriting font, rough filters, highlighter) |
| `scripts/render.sh` | To render SVG → 2× PNG with automatic dimension verification (runs the source lint first) |
| `scripts/check-svg.mjs` | Source lint gate (Node 18+, stdlib only) — render.sh runs it automatically; run it directly while iterating on the SVG source |

## 0. Preflight — confirm, then offer to change

Before drawing, confirm visual intent, audience, output ratio, and language. Then state the defaults (§6) and note the user can change any of them. Propose an output directory **inside the current project** and confirm before writing files.

**Classify the input mode first** (it sets how much to ask before drawing):

- **brief-first** — only a topic/goal is given → ask up to ~3 focused questions (audience, key message, ratio), then propose the structure.
- **source-first** — a doc, notes, or paste is provided → summarize the source and agree the key message before drawing; don't transcribe it box-for-box.
- **research-first** — "just draft it" → state your assumptions (and any missing data) up front; external lookup may be unavailable, so proceed from the given material plus explicit assumptions.

**Lead with the conclusion.** Prefer a conclusion-style title over a topic label — "Phased Migration Cuts Cutover Risk" beats "Migration Plan". Sketch the one-to-two-sentence story spine (context → tension → resolution) before placing boxes. Exception: for a **named pattern or archetype showcase**, a concise topic/pattern title is fine as long as the subtitle or `<desc>` carries the conclusion.

## 1. Pick an archetype (shape first)

Pick from the content signal, then **read that archetype's section in `references/archetypes.md`** — it has the layout skeleton, the premium recipe, and the checks that prevent that type's common failures.

| Content signal | Archetype |
| --- | --- |
| systems/components and their links | Topology / component |
| ordered steps or handoffs | Flow (swimlane variant for parallel rails) |
| approval / gate on a simple request path | Approval / sequence-lite |
| options, trade-offs, qualitative scoring | Decision / risk matrix, or Cards |
| old vs new | Before / after |
| layered capability or containment | Layer stack, or Nested / onion |
| time, phases, milestones | Roadmap / timeline |
| a few headline items or numbers | Cards / KPI stat grid (not a chart) |

## 2. Layout pass — numbers before SVG (required)

**This step is the main defense against render-fix loops. Do the arithmetic first; never place a box at an eyeballed coordinate.** Produce a short numeric plan (a scratch table of coordinates is enough), then author the SVG from those numbers.

1. **Canvas.** Pick a preset: **compact doc** 680w · **wide architecture** 1400×900 · **16:9 slide** 1600×900 · **social portrait** 1080×1350 (4:5). Height is flexible for the doc width. Fix outer margins (≥ 40px wide canvases, ≥ 24px at 680w).
2. **Regions.** Split the canvas top→bottom: header (title + subtitle), one band per section, optional footer row. Assign each region a `y` range and keep 32–48px between bands.
3. **Grid arithmetic.** For each row of n cards inside a region: choose `cardW` and `gap` (gutter 24–32px), then **verify the last edge before drawing**: `start + (n−1)·(cardW+gap) + cardW ≤ region_right − padding`. Same check vertically for columns/stacks. If it doesn't fit: shrink `cardW`/`gap`, wrap to a second row, or widen the canvas — decide *now*, not after a render.
4. **Text budget.** For each box, set lines × chars/line from the box width: ~28–36 Latin chars per line at body size, **Korean ≈ 60% of that**; 2–3 lines max per box. **Edit the copy to fit the budget before writing SVG** — abbreviate long tokens now. SVG has no auto-wrap; every line you plan here becomes one `<tspan>`.
5. **Type scale — unified across the diagram** (never vary per box):
   - 1080-wide social: H1 46 / section 24 / card title 25 / body 19 / caption 16
   - 1400–1600 wide: H1 40–44 / section 22 / card title 20–22 / body 16–17 / caption 13–14
   - 680-wide docs: title 22 / box label 14 / caption 11
6. **Icons.** Derive every icon-circle center from card geometry (e.g. `cy = card_y + card_h/2`), never a hand-tuned per-language offset. EN and KO variants must share the **same formulas**.
7. **Connector corridors.** Budget connectors like cards: `corridor = target_visual_left − source_visual_right`, and subtract the marker's real footprint (`markerUnits="strokeWidth"` multiplies it by the stroke width — formulas in `authoring.md` §3). If no readable shaft survives, choose a compact arrow, a transition glyph, or a reflow *now*, not after a render.

## 3. Author the SVG — core rules

Read `references/authoring.md` for the detailed rules and the reusable icon set. The render-critical core:

- **Root:** `<svg xmlns viewBox="0 0 W H" width=W height=H role="img" style="font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif">` with `<title>`/`<desc>`. The stack covers Korean/CJK on macOS/Windows/Linux; on Linux install `fonts-noto-cjk` if Korean renders as tofu (□).
- **Color tokens in one `<style>` block** — recolor the whole diagram by editing only this block. Colors encode role, not decoration:

```xml
<style>
  svg{ --bg:#FFFFFF; --ink:#1F2733; --muted:#5B6675; --hair:#D6E0EC; --primary:#1F6FB2;
    --edge-fill:#E8F1FB; --edge-line:#1F6FB2; --edge-ink:#124267;  /* entry / network */
    --api-fill:#ECEBFB;  --api-line:#534AB7;  --api-ink:#3C3489;   /* app / accent */
    --k8s-fill:#E7F5EF;  --k8s-line:#0F7A5F;  --k8s-ink:#085041;   /* compute / ok */
    --data-fill:#F1F1EE; --data-line:#7A8398; --data-ink:#3F4453;  /* data / neutral */
    --card:#F7FAFD; }
  .on-accent{ fill:#FFFFFF }
</style>
```

- **Boxes:** rounded rect `rx="8"` (wide bands `rx="12–22"`), hairline border `stroke-width:1`. Each box = tinted fill + same-family border + same-family text (one semantic color family per box).
- **Vertical centering:** center text with `dominant-baseline="central"` and `y` at the box's vertical center. Two lines straddle the center: title at `center−11`, sub at `center+10`, both `central`. Never rely on the default alphabetic baseline for box labels — it sits high.
- **Wrapping:** one planned line = one `<tspan x=.. dy=..>`; keep to the §2 text budget.
- **Arrows:** define one `<marker>` arrowhead, use `marker-end`. Solid = sync/request, dashed (`stroke-dasharray="5 4"`) = async/batch/private. The default head is an **open-V stroked marker at ≈3× the shaft width** (recipe in `authoring.md` §3) — filled triangles only as a deliberate, explicitly sized choice. `markerUnits="userSpaceOnUse"` is **mandatory** on every referenced marker and the lint gate enforces it — the default `markerUnits="strokeWidth"` multiplies the head by the stroke width. Set `refX` so the tip lands on the path endpoint; leave an 8–12px gap between tip and target box **and** keep a visible shaft behind the head; pick each connector's form (standard / compact / curved / transition glyph / reflow) from the corridor budget, and prefer the gentle single-bend curve recipe when boxes sit at different heights (`authoring.md` §3).
- **On-accent text is light:** any label on a saturated fill uses `class="on-accent"` (white/near-white) — never dark text on a mid/dark accent, and never rely on a blanket `text{fill}` rule to sort it out.
- **Emphasis toolkit:** stroke + soft shadow + a number/status badge + a corner label + a filled icon badge. **No top accent bar on cards** (corner-smear and badge-collision failure modes — details and narrow exception in `authoring.md`).
- **Icon-first (default on):** a line icon in a soft tinted circle (`r≈34–38`, tint `#E3EEF8`) per card/node, icon ~40px via `<use>`, recolor with `style="color:#…"`. Number badge **only when sequence or cross-reference matters** — never icon + redundant number.

## 4. Pre-render checklist (source-level — run before every render)

**Run the lint gate first** — it machine-checks the deterministic subset of this list (ids/references, root viewBox, marker units and footprint, high-confidence Latin/CJK text overflow) with file/line, measured values, and a suggested fix per finding:

```bash
node scripts/check-svg.mjs diagram.svg     # render.sh runs this again as a hard gate
```

Hard errors must be fixed before rendering (`render.sh` refuses at exit 5). Warnings are low-confidence estimates — disposition each one deliberately (fix it, or verify it in the §7 PNG pass); never treat a warning as a pass. Then walk the rest of the checklist — layout arithmetic and design judgement stay yours:

1. **Containment re-check:** the §2 last-edge/bottom-edge arithmetic still holds for what you actually wrote (cards, arrows, badges, labels — including any element you added while authoring). Judge **visual bounds**, not just the fill rect — half the stroke width, shadow spread, and children drawn outside the base rect count; in a padded panel, an edge that merely touches the parent is a fail, not a pass (formula in `authoring.md` §1).
2. **Text budget:** no `<text>`/`<tspan>` line exceeds its planned chars/line; box labels use `dominant-baseline="central"` with computed `y`. **Pill/badge fit:** every pill/badge background covers its actual label width plus ≥ 14–16px padding per side, and EN/KO shared geometry fits the wider language's label (formula in `authoring.md` §2).
3. **References resolve:** every `<use href="#id">` matches a defined `<symbol id>`; every `marker-end` references a defined `<marker>`; no dangling `url(#…)`.
4. **Contrast classes:** every label on a saturated fill carries `class="on-accent"`; no blanket `text{fill}` rule that overrides on-accent labels via inheritance.
5. **Corner clearance:** badges / status labels / corner icons in the same card corner region have ≥ 20–24px between bounding boxes.
6. **EN/KO parity:** if generating both, the two variants share identical geometry formulas — only text (and text budget) differs.
7. **Root sanity:** `viewBox` matches the intended W×H; `<title>`/`<desc>` present; font stack on the root.
8. **Connector budget:** every connector's corridor and marker footprint are computed (§2.7); each standard arrow keeps a visible shaft (≥ 12–16px, not hidden under a card/panel by paint order) plus the 8–12px tip gap — a head-only arrow is a fail even when the gap is right; tight corridors carry a deliberate form choice (compact arrow, transition glyph, or reflow — `authoring.md` §3); EN/KO share connector geometry and semantics.

## 5. Render to PNG (2×)

Use the bundled script — it runs the §4 source lint as a hard gate (Node 18+ required; exit 5 = lint errors, exit 6 = Node/lint missing — install Node rather than bypassing the gate), discovers a Chromium-based browser (Chrome/Edge/Chromium), builds the wrapper, renders at 2×, and **verifies the PNG dimensions automatically**:

```bash
bash scripts/render.sh diagram.svg            # → diagram.png (2×)
bash scripts/render.sh diagram.svg out.png --transparent
```

Keep wrapper/intermediate files in the session scratchpad, not the repo. The script covers macOS, Linux, and Windows Git Bash (the shell Claude Code uses on Windows); if it can't find a browser — or you're in native PowerShell — use the manual fallback in `references/authoring.md` §8. If no Chromium-based browser is available at all, deliver the SVG only and state the limitation.

## 6. Defaults to state (and let the user change)

- Style: muted technical · light background · icons = soft circular bg + line icon. Opt-in alternative: **sketch preset** (tidy hand-drawn — paper, Korean handwriting font, rough strokes; see `references/sketch.md`) when the user asks for that feel
- Font stack: Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif (covers macOS/Windows/Linux CJK)
- Changeable: brand color, ratio (docs vs 4:5 social), dark mode (override the same CSS vars under `@media (prefers-color-scheme:dark)`; PNG renders light unless forced), icon style, Korean/English, SVG-only vs SVG+PNG
- Optional attribution/footer layer: **off by default.** On request, add a small footer strip (source, author, or date) as its own bottom layer — a labeled footer, not a watermark laid over the content.

## 7. Verify the PNG (quality bar)

The pre-render checklist covered the source; now check what only the pixels show:

- **Rendering:** no text overflow or clipped glyphs; text vertically centered in its box; correct Korean/CJK rendering (no tofu); PNG is exactly 2× the viewBox (render.sh reports this); icons visible (no blank circles); labels on accent fills read clearly (AA-like separation).
- **Containment (visual):** every child sits inside its container plus inner padding — scan the PNG for anything touching or crossing a panel edge; an element can spill without touching any text.
- **Connectors:** every arrow reads as shaft + head — no head-only arrows and no head buried under a panel or card; the head joins its shaft cleanly and neither touches the target border nor floats detached; **head/shaft proportion reads natural — a *visible* head ≈4× its shaft width or more is a fail for newly authored diagrams** (aim ≈3×; shrink the head or use the open-V recipe — the lint warns from ≈4.5× of the marker viewport, a conservative upper bound on the visible head). Pre-contract legacy examples keep their approved visuals under an explicit `data-lint-allow="marker-footprint"` exception — never add that attribute to silence a new diagram. A curve keeps one readable bend (an accidental S-shape is a fail); a transition glyph reads as flow, not as an icon or play button.
- **Message:** the archetype fits the content; one clear reading order; the title states a conclusion, not just a topic; text density stays low per box; any matrix/labels read unambiguously; depth and language fit the stated audience.
- The SVG stays editable — tokens in one `<style>` block, no flattened or rasterized text.

If a check fails: fix the SVG source, re-run §4, re-render. Track which §4 item would have caught it — if none, the checklist is missing a rule.

## 8. Output & handoff

Save both the **SVG** (editable source of truth) and the **PNG** (2× export for slides/docs/social). The renderer uses locally installed fonts, so Korean/CJK falls back to the platform default (Apple SD Gothic Neo on macOS, Malgun Gothic on Windows, Noto Sans KR on Linux) — verify no tofu in the PNG.
