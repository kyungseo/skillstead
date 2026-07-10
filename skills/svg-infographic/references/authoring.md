# Authoring reference

Detailed geometry, connector, panel, emphasis, color, and icon rules, plus the manual render fallback. Organized by principle; each rule exists because skipping it produced a broken render at least once.

## 1. Geometry & containment

- **Containment is arithmetic, not eyeballing.** Every child (card, icon, arrow, badge, label) sits inside its container/panel bounds **plus inner padding**, unless it is a deliberate outside-the-frame callout. For a row of repeated cards, compute the last card's far edge as `start + (n−1)·(cardW+gap) + cardW` and confirm it is `≤ container_edge − padding`; same for a column's bottom edge. If a row won't fit, shrink `cardW`/`gap`, wrap to a second row, or widen the canvas.
- **Paired / side-by-side boxes:** always leave a **visible gutter of 24–32px**; never let two boxes touch. Balance the left/right outer margins.
- **Generous margins; align to a grid; consistent gutters.** Pick the margin and gutter values once in the layout pass and reuse them everywhere.
- **Fill the box.** Size text so boxes read full — avoid a small label marooned in a large box. Prefer 2–3 lines of body text or an icon to balance a card, rather than shrinking the type.

## 2. Text

- **Vertical centering:** center text with `dominant-baseline="central"` and set `y` to the box's vertical center. For two lines, straddle the center: title at `center−11`, sub at `center+10`, both `central`. Never rely on the default alphabetic baseline for box labels — it sits high.
- **Wrapping (SVG has no auto-wrap — the historical top failure mode):** break lines yourself with `<tspan x=.. dy=..>`. Keep ~28–36 chars/line for Latin, ~60% of that for Korean; 2–3 lines per box; abbreviate an over-long token rather than let it overflow. The text budget is set in the layout pass — re-check against the box width after writing.
- **Type scale stays unified across the diagram** — never vary sizes per box to make something fit; fix the layout instead.

## 3. Connectors

- **Routing:** prefer straight orthogonal (horizontal/vertical) connectors; avoid crossings — route around, or move the node. Leave an **8–12px gap** between the arrowhead and the target box. Place edge labels *beside* the line, never on top of it.
- **Fan-out** (one source → many targets): one vertical stem from the source, one horizontal bus, then a centered vertical branch to each target. No orphan stubs, and no line that nearly overlaps a box edge.
- **Zone aid for busy diagrams:** if nodes collide, assign each to a **3×3 zone** (top-left … center … bottom-right), route edges only between zones, and wrap co-located nodes in one group frame. A quick sketching aid to cut crossings — not a required schema; simple diagrams don't need it.
- **Semantics:** one `<marker>` arrowhead definition reused via `marker-end`. Solid = sync/request/normal; dashed `stroke-dasharray="5 4"` = async/batch/private/feedback. Legend whenever both appear.

## 4. Panels & header bands

- **Header band on a rounded panel:** use a **top-only rounded** header — a `<path>` with rounded top corners and a square bottom edge (`M x+r,y H x+w-r A r r 0 0 1 x+w,y+r V y+h H x V y+r A r r 0 0 1 x+r,y Z`), or a header rect clipped to the panel. **Never stack a fully-rounded rect plus a square "cover" rect** — it smears the lower corners in the PNG.
- **Band containers** (premium base): light tinted fill, hairline border, `rx 14–22`; white content cards on top with a subtle `<filter>` drop shadow at low opacity. Keep shadows soft — a heavy shadow reads as clutter at 2×.

## 5. Emphasis & corner decorations

- **Emphasis toolkit (use these, in this order of preference):** stronger stroke in the card's family color → soft shadow → number/status badge → corner label → filled icon badge. These alone carry a "key step" clearly.
- **Top accent bar on a rounded card — default no.** Two failure modes make it risky:
  1. *Corner smear* — a bar sharing the card's `x`/`y`/`width` has square corners that collide with the card's `rx` arc and render torn in headless-Chromium PNG.
  2. *Band collision* — if the card top already carries a number badge, status label, or KEY-STEP-style tag, the bar crosses their horizontal band and the card top reads cluttered.
  **If a card top has a number badge or a status label, never add a top accent bar.** Reserve it for a card with a clearly separated header band (its own row, nothing else in it), and even then inset the fill clear of the corner radius (`≥ rx` in from each side and below the top) — it must never touch the corner-radius zone.
- **Corner decorations stay apart:** a number/corner badge, a status label (e.g. a caution tag), and a top-right icon must **not** crowd the same corner. Give each **≥ 20–24px clearance** between bounding boxes. Reliable arrangement: badge top-left, status label on the **same row just right of the badge**, icon top-right. This is the top failure mode for 2×2 / decision-matrix quadrant cards; verify against the **exported PNG**, not just the SVG source.

## 6. Color & contrast

- **Tokens:** all colors as CSS variables in one `<style>` block (see SKILL.md §3); Chrome headless fully supports SVG CSS custom properties. Colors encode role, not decoration — keep roles, change hex to rebrand.
- **Dark variant:** override the same variables under `@media (prefers-color-scheme:dark)`. PNG renders light unless forced.
- **On-accent text:** default to **light (white/near-white) text on a saturated fill** — never dark text on a mid/dark accent. A light-tinted chip may keep dark ink; a saturated fill needs light text. Use an explicit class (`.on-accent{ fill:#FFFFFF }`) on those labels.
- **Gotcha — blanket text color rules hide contrast problems.** An inline `fill="#FFFFFF"` usually wins over a global `text{ fill:var(--ink) }` rule in headless Chrome, but inherited text (`<tspan>`, grouped labels, generated variants) can silently lose its on-accent contrast. When the diagram mixes dark body text and light-on-accent text, **avoid a blanket `text{fill}` rule entirely** — set ink color per group/class — and always inspect the PNG (aim for an AA-like separation).

## 7. Icons

Icon-first is the default: a simple **line icon inside a soft tinted circle** per card or node.

- **Icon vs number:** a **number badge only when sequence or cross-reference matters** (numbered steps). When the icon alone identifies the item, use the icon only — never icon + redundant number.
- **Placement:** icon circle `r≈34–38` with a light tint fill (`#E3EEF8`), the icon centered inside at ~40px via `<use>`. Derive the circle center from card geometry (`cy = card_y + card_h/2`) — never a hand-tuned per-language offset; EN and KO variants share the same formula.
- **Recolor:** author each symbol with `stroke="currentColor"`; set the color per instance with `style="color:#…"` on the `<use>`.
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

Need an icon that isn't in the set? Compose it from the same 24×24 line grammar (stroke 1.8, round caps/joins, `currentColor`) so it matches — don't mix icon families.

## 8. Render — manual fallback

Use `scripts/render.sh` when possible; it automates everything below plus the dimension check. Manual path:

Any Chromium-based browser works — Chrome, Microsoft Edge, or Chromium — with the **same headless flags on every OS**. Discover the binary first (use the first that resolves):

- **macOS** — test each path, use the first executable: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `.../Microsoft Edge.app/Contents/MacOS/Microsoft Edge`, `/Applications/Chromium.app/Contents/MacOS/Chromium`.
- **Linux** — `command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser`.
- **Windows (PowerShell)** — `Get-Command chrome, msedge -ErrorAction SilentlyContinue`; else test `C:\Program Files\Google\Chrome\Application\chrome.exe` and `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.

Wrapper HTML (W/H = SVG viewBox), placed next to the .svg in the session scratchpad (not in the repo):

```html
<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:Wpx;height:Hpx;overflow:hidden}
img{display:block;width:Wpx;height:Hpx}
</style></head><body><img src="diagram.svg"></body></html>
```

macOS / Linux:

```bash
BROWSER="$(command -v google-chrome || command -v chromium || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')"
"$BROWSER" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=W,H \
  --screenshot="diagram.png" "file://$PWD/wrapper.html"
```

Windows (PowerShell) — same flags; build a proper `file://` URL (forward slashes) and keep the path quoted so spaces don't break it:

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = "file:///" + ((Resolve-Path .\wrapper.html).Path -replace '\\','/')
& $chrome --headless=new --disable-gpu --hide-scrollbars `
  --force-device-scale-factor=2 --window-size=W,H `
  --screenshot="diagram.png" $url
```

Notes:

- `--window-size` = viewBox (not 2×); the scale factor upscales.
- Transparent background: add `--default-background-color=00000000`.
- On locked-down Linux / CI / containers, add `--no-sandbox` **only if** the render fails with a sandbox error (not a default).
- Prefer a wrapper path without spaces; if it has spaces, keep it quoted.
- Fonts are the locally installed ones — Korean/CJK falls back to Apple SD Gothic Neo (macOS), Malgun Gothic (Windows), Noto Sans KR (Linux). **On Linux the CJK font is not guaranteed** — if Korean renders as tofu (□), install Noto Sans CJK/KR (e.g. `fonts-noto-cjk`) and re-render.
- If no Chromium-based browser is available, deliver the SVG only and state the limitation.
