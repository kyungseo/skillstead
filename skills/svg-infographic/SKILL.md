---
name: svg-infographic
description: Author technical/structured SVG infographics and diagrams, then render them to crisp PNG with a headless browser. Best for architecture diagrams, topology maps, flows, before/after comparisons, nested/onion layer models, roadmaps, and social-ready technical one-pagers. Prefers clean line icons in soft tinted circles. First-class Korean/CJK text. Not for photo-heavy or illustration-heavy graphics, statistical charts, hand-drawn/crayon sketchnote styles, or mascot/character illustration.
---

# svg-infographic

Use this skill when the user wants a technical or structured infographic/diagram from a description, or asks to export an SVG to PNG.

Good for: architecture diagrams, cloud/network topology, component/layer diagrams, before/after, process/data flow, nested "onion" models, roadmap/risk maps, social-ready technical one-pagers.

Do **not** use for: photo/illustration-heavy marketing graphics; statistical charts (bar/line/scatter/heatmap — use a chart tool); hand-drawn/crayon "sketchnote" styles; mascots or character illustration; custom logo design or bespoke icon design. (Using the built-in line-icon set in §5 is expected and encouraged — the non-goal is *designing new brand marks*, not using icons.)

## 0. Preflight — confirm, then offer to change

Before drawing, confirm visual intent, audience, output ratio, and language. Then state the defaults below and note the user can change any of them. Propose an output directory **inside the current project** and confirm before writing files.

## 1. Pick an archetype (shape first)

| Archetype | Layout |
| --- | --- |
| Layer stack | top→bottom horizontal bands |
| Topology / component | boxes + zone frames (VNet/subnet/cluster) + connectors |
| Flow | left→right or top→bottom nodes + arrows (solid=sync, dashed=async/private) |
| Nested / onion | concentric rounded rects, light (outer) → saturated (inner) |
| Cards | 2×N grid of icon + title + one-line description |
| Before/after · Roadmap · Risk map | two panels · swimlane/milestones · grid |

## 2. Canvas & type scale

- Root: `<svg xmlns viewBox="0 0 W H" width=W height=H role="img" style="font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif">`. Include `<title>`/`<desc>`. The stack covers Korean/CJK on macOS (Apple SD Gothic Neo), Windows (Malgun Gothic), and Linux (Noto Sans KR).
- Canvas: **680** wide for docs/decks; **1080×1350** (4:5) for social. Height as needed.
- **Type scale — keep it unified across the diagram** (don't vary per box):
  - 1080-wide social: H1 46 / section 24 / card title 25 / body 19 / caption 16
  - 680-wide docs: title 22 / box label 14 / caption 11
- **Fill the box.** Size text so boxes read full — avoid a small label marooned in a large box. Prefer 2–3 lines of body text or an icon to balance a card, rather than shrinking the type.

## 3. Boxes, text, arrows

- Rounded rect `rx="8"` (wide bands `rx="12–22"`), hairline border `stroke-width:1`. Each box = tinted fill + same-family border + same-family text (a single semantic color family).
- **Vertical centering (important):** center text with `dominant-baseline="central"` and set `y` to the box's vertical center. For two lines, straddle the center: title at `center−11`, sub at `center+10`, both `central`. Never rely on the default alphabetic baseline for box labels — it sits high.
- Arrows: define one `<marker>` arrowhead, use `marker-end`. Solid = sync/request, dashed (`stroke-dasharray="5 4"`) = async/batch/private.
- Generous margins; align to a grid; consistent gutters.

## 4. Color tokens (recolor in one place)

Define CSS variables in a `<style>` block and reference them (`fill:var(--k8s-fill)`). Chrome headless fully supports SVG CSS custom properties. To recolor the whole diagram, edit only this block.

```xml
<style>
  svg{ --bg:#FFFFFF; --ink:#1F2733; --muted:#5B6675; --hair:#D6E0EC; --primary:#1F6FB2;
    --edge-fill:#E8F1FB; --edge-line:#1F6FB2; --edge-ink:#124267;  /* entry / network */
    --api-fill:#ECEBFB;  --api-line:#534AB7;  --api-ink:#3C3489;   /* app / accent */
    --k8s-fill:#E7F5EF;  --k8s-line:#0F7A5F;  --k8s-ink:#085041;   /* compute / ok */
    --data-fill:#F1F1EE; --data-line:#7A8398; --data-ink:#3F4453;  /* data / neutral */
    --card:#F7FAFD; }
  text{ fill:var(--ink) }
</style>
```

Colors encode role, not decoration. Keep roles; change hex to rebrand. Dark variant: override the same vars under `@media (prefers-color-scheme:dark)` (PNG renders light unless forced).

## 5. Icons — icon-first (default on)

Prefer a simple **line icon inside a soft tinted circle** for each card or node (the most common, most legible infographic style).

- **Icon vs number:** use a **number badge only when sequence or cross-reference matters** (e.g. numbered steps). When the icon alone identifies the item, use the icon only — do not also stamp a number.
- **Placement:** icon circle `r≈34–38` with a light tint fill (`#E3EEF8`), the icon centered inside at ~40px via `<use>`.
- **Recolor:** author each icon symbol with `stroke="currentColor"`; set the color per instance with `style="color:#…"` on the `<use>`.
- **Style options to offer:** default = soft circular background + thin line icon. Alternatives: no background (line icon only), filled/solid icon, or mono. Stroke width ~1.7–1.9.

Reusable icon set (drop into `<defs>`; all 24×24, `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`):

```xml
<symbol id="ic-terminal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/></symbol>
<symbol id="ic-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16.5h6M9 9.5h2"/></symbol>
<symbol id="ic-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></symbol>
<symbol id="ic-loop" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9"/><path d="M20 3.5V9h-5.5"/><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 15"/><path d="M4 20.5V15h5.5"/></symbol>
<symbol id="ic-cloud" viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 18z"/></symbol>
<symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></symbol>
<symbol id="ic-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></symbol>
<symbol id="ic-network" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5V13M12 13l-5 4M12 13l5 4"/></symbol>
<symbol id="ic-server" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/></symbol>
<symbol id="ic-api" viewBox="0 0 24 24"><path d="M9 5l-4 7 4 7M15 5l4 7-4 7"/></symbol>
```

Use example: `<circle cx="172" cy="726" r="38" fill="#E3EEF8"/><use href="#ic-terminal" x="152" y="706" width="40" height="40" style="color:#1F6FB2"/>`.

## 6. Render to PNG (headless Chromium browser, 2×)

Any Chromium-based browser works — Chrome, Microsoft Edge, or Chromium — with the **same headless flags on every OS**. Resolve the binary for the user's platform first:

| OS | Typical binary (use whichever exists) |
| --- | --- |
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` · `.../Microsoft Edge.app/Contents/MacOS/Microsoft Edge` · `/Applications/Chromium.app/Contents/MacOS/Chromium` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` · `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| Linux | `google-chrome` · `chromium` · `chromium-browser` (usually on `PATH`) |

Wrapper HTML (W/H = SVG viewBox), placed next to the .svg in the session scratchpad (not in the repo):

```html
<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:Wpx;height:Hpx;overflow:hidden}
img{display:block;width:Wpx;height:Hpx}
</style></head><body><img src="diagram.svg"></body></html>
```

macOS / Linux:

```bash
BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # or edge/chromium; on Linux just: google-chrome
"$BROWSER" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=W,H \
  --screenshot="diagram.png" "file:///ABS/PATH/wrapper.html"
```

Windows (PowerShell) — same flags, `.exe` path:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars `
  --force-device-scale-factor=2 --window-size=W,H `
  --screenshot="diagram.png" "file:///C:/ABS/PATH/wrapper.html"
```

`--window-size` = viewBox (not 2×); the scale factor upscales. Transparent bg: add `--default-background-color=00000000`. If no Chromium-based browser is available, deliver the SVG only and state the limitation.

## 7. Defaults to state (and let the user change)

- Style: muted technical · light background · icons = soft circular bg + line icon
- Font stack: Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif (covers macOS/Windows/Linux CJK)
- Changeable: brand color, ratio (docs vs 4:5 social), dark mode, icon style, Korean/English, SVG-only vs SVG+PNG

## 8. Verify (quality bar)

Before handoff, check: no text overflow; text vertically centered in its box; correct CJK (Korean) glyph rendering (no tofu); SVG and PNG dimensions match; icons render (no broken `<use>`).

## 9. Output & handoff

Save both the **SVG** (editable source of truth) and the **PNG** (2× export for slides/docs/social). The renderer uses locally installed fonts, so Korean/CJK falls back to the platform default (Apple SD Gothic Neo on macOS, Malgun Gothic on Windows, Noto Sans KR on Linux) — verify no tofu in the PNG.
