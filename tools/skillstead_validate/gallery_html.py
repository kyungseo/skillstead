"""The repository gallery — a human-facing page rendered from the gallery model.

This is not the review sheet reproduced for the public. A review sheet answers "did everything
pass", so it puts verification on every card. A reader arriving here is asking something else —
"can this thing draw what I need, and which type do I pick" — so the page answers in that order:

    featured   six existing outputs, shaped as differently as the catalog can manage
    catalog    the nine TypePacks, compact enough to scan in one screen

Evidence is reported as three independent facets rather than a single word or a ranking. An artifact
can clear the source gates and have no receipt; a chart will one day carry a receipt *and* a
data-accuracy verdict. Collapsing that into "more verified" would say something none of the checks
mean. Each facet reads pass / none / not-applicable, and the page prints only the facets that
actually apply to what it is showing.

Both sections switch locale together, and both stay fully visible without scripting: the switch is
hidden until JS reveals it, and `<details>` opens on its own. The fallback is the whole page, not a
reduced one.

Everything is derived — copy from the payloads through the model, geometry facts from the receipts,
the featured selection from `gallery/featured.json`, and every colour, radius and step from
`gallery/tokens.json`.

Images point at the **SVG**, because that is what the gates and the verifier re-checked. The featured
artifacts differ widely in aspect ratio, and the section's claim is that they are one managed set, so
every one gets the same media viewport and keeps its own proportions inside it. Each frame is a link
to the artifact, which gives full size with no scripting; where scripting exists the click opens a
dialog instead.
"""

from __future__ import annotations

import html
from pathlib import Path

GALLERY_HTML = "gallery/index.html"
LOCALE_LABEL = {"ko": "한국어", "en": "ENGLISH"}
FACET_LABEL = {"sourceGates": "source gates", "typePackReceipt": "TypePack receipt",
               "dataAccuracy": "data accuracy"}


def _e(v) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def _facet_line(evidence: dict, show: tuple[str, ...]) -> str:
    """Print the facets that apply, each with its own verdict. `not-applicable` stays unprinted —
    naming a check that does not apply tells the reader nothing and crowds the ones that do."""
    parts = []
    for key in show:
        val = (evidence or {}).get(key)
        if val in (None, "not-applicable"):
            continue
        cls = "ok" if val == "pass" else "none"
        parts.append(f'<span class="facet {cls}"><i>{_e(FACET_LABEL[key])}</i>{_e(val)}</span>')
    return f'<p class="facets">{"".join(parts)}</p>' if parts else ""


def _css(t: dict) -> str:
    p, sh, sp, ty, g = (t[k] for k in ("palette", "shape", "space", "type", "grid"))
    return f""":root {{
  --ground: {p['ground']};
  --card: {p['card']};
  --card-edge: {p['cardEdge']};
  --ink: {p['ink']};
  --ink-muted: {p['inkMuted']};
  --verified: {p['verified']};
  --verified-ground: {p['verifiedGround']};
  --card-radius: {sh['cardRadius']}px;
  --image-radius: {sh['imageRadius']}px;
  --chip-radius: {sh['chipRadius']}px;
  --card-pad: {sp['cardPad']}px;
  --card-gap: {sp['cardGap']}px;
  --pair-gap: {sp['pairGap']}px;
  --caption-gap: {sp['captionGap']}px;
  --font-identifier: {ty['identifier']['family']};
  --font-prose: {ty['prose']['family']};
  --font-caption: {ty['caption']['family']};
  --max-width: {g['galleryMaxWidth']}px;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; background: var(--ground); color: var(--ink);
  font: {ty['prose']['size']}px/{ty['prose']['lineHeight']} var(--font-prose);
  font-variant-numeric: tabular-nums;
}}
.wrap {{ max-width: var(--max-width); margin: 0 auto; padding: 3rem 1.25rem 5rem; }}
h1 {{ font-size: 1.55rem; line-height: 1.25; margin: 0 0 .5rem; letter-spacing: -.015em; text-wrap: balance; }}
.lede {{ color: var(--ink-muted); margin: 0 0 1rem; max-width: 64ch; }}
h2.sec {{ font-size: 1.1rem; margin: 3rem 0 .3rem; letter-spacing: -.01em; }}
.sec-note {{ color: var(--ink-muted); margin: 0 0 .9rem; max-width: 70ch; font-size: 14px; }}

.facets {{ display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 1rem; }}
.facet {{
  display: inline-flex; align-items: baseline; gap: .4rem;
  border: 1px solid var(--card-edge); border-radius: var(--chip-radius);
  padding: .26rem .55rem; font: 600 11px/1 var(--font-identifier); background: var(--card);
  color: var(--ink-muted);
}}
.facet i {{ font-style: normal; font-weight: 400; }}
.facet.ok {{ background: var(--verified-ground); color: var(--verified);
  border-color: color-mix(in srgb, var(--verified) 25%, transparent); }}

.switch {{ display: flex; gap: .3rem; margin: 0 0 1.4rem; }}
.switch button {{
  font: 600 12px/1 var(--font-identifier); letter-spacing: .04em;
  background: var(--card); color: var(--ink-muted);
  border: 1px solid var(--card-edge); border-radius: var(--chip-radius);
  padding: .42rem .7rem; cursor: pointer;
}}
.switch button[aria-pressed="true"] {{ color: var(--ink); border-color: var(--ink-muted); }}
.switch button:focus-visible, summary:focus-visible, a:focus-visible {{
  outline: 2px solid var(--verified); outline-offset: 2px;
}}

/* ---- featured ------------------------------------------------------------------------ */
/* Every entry gets the same cell and the same media viewport. Sizing entries individually made the
   row read as a layout that varies per artifact; one viewport makes six very differently shaped
   outputs read as one managed set — which is the claim the section is making. The artifacts keep
   their own proportions inside it via object-fit, so nothing is cropped or distorted. */
.featured {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pair-gap); }}
@media (max-width: 980px) {{ .featured {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
@media (max-width: 640px) {{ .featured {{ grid-template-columns: minmax(0, 1fr); }} }}
.feat {{
  background: var(--card); border: 1px solid var(--card-edge);
  border-radius: var(--card-radius); padding: 13px;
}}
.frame {{
  aspect-ratio: 4 / 3; background: #fff; border: 1px solid var(--card-edge);
  border-radius: var(--image-radius); display: flex; align-items: center; justify-content: center;
  overflow: hidden; padding: 9px;
}}
.frame img {{ max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }}
/* The frame links to the artifact itself, so full size works with no scripting at all; when
   scripting is present the click is intercepted and shown in a dialog instead. */
a.frame {{ cursor: zoom-in; text-decoration: none; }}
dialog {{ border: 0; padding: 0; background: transparent; max-width: 96vw; max-height: 96vh; }}
dialog::backdrop {{ background: rgba(20, 20, 26, .72); }}
dialog img {{ max-width: 96vw; max-height: 92vh; background: #fff; border-radius: 6px; display: block; }}
dialog form {{ text-align: right; margin-top: .5rem; }}
dialog button {{
  font: 600 12px/1 var(--font-identifier); background: var(--card); color: var(--ink);
  border: 1px solid var(--card-edge); border-radius: var(--chip-radius); padding: .45rem .7rem;
  cursor: pointer;
}}
/* Captions wrap to one or two lines depending on the words. Reserving the taller of the two keeps
   the row of cards level instead of stepping by a line height. */
.feat .cap {{
  display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
  margin-top: 10px; min-height: 2.6em;
}}
.feat .nm {{ font: 600 13px/1.3 var(--font-identifier); }}
.feat .sub {{ color: var(--ink-muted); font-size: 12px; text-align: right; }}
/* Featured artifacts are the argument the page opens with, so one locale fills the card rather
   than two sharing it. With scripting the switch picks which; without it both stack, which is
   taller but complete. */
.feat .pair {{ display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }}
.feat figcaption {{
  color: var(--ink-muted); margin-bottom: 5px;
  font: 600 10px/1 var(--font-caption); letter-spacing: .08em; text-transform: uppercase;
}}

/* ---- catalog ------------------------------------------------------------------------- */
.catalog {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pair-gap); }}
@media (max-width: 900px) {{ .catalog {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
@media (max-width: 620px) {{ .catalog {{ grid-template-columns: minmax(0, 1fr); }} }}
article {{
  background: var(--card); border: 1px solid var(--card-edge);
  border-radius: var(--card-radius); padding: 14px;
}}
h3 {{ margin: 0; font: 600 13px/1.3 var(--font-identifier); letter-spacing: -.01em; }}
h3 a {{ color: inherit; text-decoration: none; }}
h3 a:hover {{ text-decoration: underline; }}
.signal {{
  color: var(--ink-muted); margin: .35rem 0 .8rem; font-size: 12.5px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
[data-locale="ko"] .catalog .pair, [data-locale="en"] .catalog .pair {{ grid-template-columns: minmax(0, 1fr); }}
figure {{ margin: 0; min-width: 0; }}
figcaption {{
  color: var(--ink-muted); margin-bottom: var(--caption-gap);
  font: 600 10px/1 var(--font-caption); letter-spacing: .07em; text-transform: uppercase;
}}
details {{ margin-top: 12px; border-top: 1px solid var(--card-edge); padding-top: 10px; }}
summary {{ cursor: pointer; color: var(--ink-muted); font: 600 11px/1 var(--font-identifier); letter-spacing: .04em; }}
.detail {{ margin-top: 11px; display: grid; gap: 12px; }}
.detail h4 {{
  margin: 0 0 5px; font: 600 10px/1 var(--font-caption); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ink-muted);
}}
pre {{
  margin: 0; padding: .7rem .8rem; overflow-x: auto; background: var(--ground);
  border: 1px solid var(--card-edge); border-radius: var(--chip-radius);
  font: 11px/1.6 var(--font-identifier); white-space: pre;
}}
.chips {{ display: flex; flex-wrap: wrap; gap: 5px; }}
.chip {{
  display: inline-flex; align-items: baseline; gap: 5px; background: var(--ground);
  border: 1px solid var(--card-edge); border-radius: var(--chip-radius);
  padding: 3px 7px; font: 11px/1.4 var(--font-identifier);
}}
.chip i {{ font-style: normal; color: var(--ink-muted); font-size: 10px; }}
table {{ border-collapse: collapse; width: 100%; font: 11px/1.5 var(--font-identifier); }}
th, td {{ text-align: left; padding: 3px 8px 3px 0; border-bottom: 1px solid var(--card-edge); }}
th {{ color: var(--ink-muted); font-weight: 600; }}
td.split {{ font-weight: 600; }}
.scroll {{ overflow-x: auto; }}
a {{ color: var(--ink); }}
.note {{ color: var(--ink-muted); font-size: 12px; margin: .5rem 0 0; }}

/* Nothing is hidden unless JS has set a locale on the root, so the no-script view is complete. */
[data-locale="ko"] figure[data-loc="en"], [data-locale="en"] figure[data-loc="ko"] {{ display: none; }}
@media (prefers-reduced-motion: reduce) {{ * {{ transition: none !important; }} }}"""


def _frame(src: str, alt: str, zoom: bool = False) -> str:
    img = f'<img src="{_e(src)}" alt="{_e(alt)}" loading="lazy">'
    if not zoom:
        return f'<div class="frame">{img}</div>'
    return f'<a class="frame" href="{_e(src)}" data-full="{_e(src)}">{img}</a>'


def _featured_card(f: dict) -> str:
    figs = ""
    for loc in ("ko", "en"):
        art = (f.get("artifacts") or {}).get(loc)
        if not art:
            continue
        alt = f'{f.get("name")} — {f.get("caption")} ({loc.upper()})'
        figs += (f'<figure data-loc="{loc}"><figcaption>{_e(LOCALE_LABEL[loc])}</figcaption>'
                 f'{_frame("../" + art["svg"], alt, zoom=True)}</figure>')
    return (f'<div class="feat"><div class="pair">{figs}</div>'
            f'<div class="cap"><span class="nm">{_e(f.get("name"))}</span>'
            f'<span class="sub">{_e(f.get("caption"))}</span></div></div>')


def _detail(t: dict) -> str:
    ko, en = t["locales"]["ko"], t["locales"]["en"]
    facts = [("profile", t.get("profile")), ("preset", t.get("preset")),
             ("treatment", t.get("treatment")), ("delivery", t.get("fontDelivery")),
             ("entities", len(ko.get("consumed") or []))]
    chips = "".join(f'<span class="chip"><i>{_e(k)}</i>{_e(v)}</span>' for k, v in facts if v not in (None, ""))

    rows = "".join(
        f'<tr><td>{_e(f.get("preset"))}</td><td>{_e(f.get("count"))}</td>'
        f'<td class="{"split" if f.get("result") == "needs-split" else ""}">{_e(f.get("result"))}</td></tr>'
        for f in (t.get("feasibility") or []))
    boundary = (f'<div><h4>Where it stops fitting</h4><div class="scroll"><table>'
                f'<tr><th>preset</th><th>count</th><th>verdict</th></tr>{rows}</table></div>'
                f'<p class="note"><code>needs-split</code> returns a degrade receipt and no artifact '
                f'— a non-success, not a smaller render.</p></div>') if rows else ""

    stress = ""
    if t.get("stress"):
        items = "".join(
            f'<tr><td>{_e(str(s.get("id", "")).replace(t["id"] + "-", ""))}</td>'
            f'<td>{_e(s.get("preset"))}</td>'
            f'<td class="{"split" if s.get("geometryExpected") == "needs-split" else ""}">'
            f'{_e(s.get("geometryExpected"))}</td></tr>' for s in t["stress"])
        stress = (f'<div><h4>Declared stress scenarios</h4><div class="scroll"><table>'
                  f'<tr><th>scenario</th><th>preset</th><th>expected</th></tr>{items}</table></div></div>')

    # A template, not a runnable line: the output paths are placeholders and it runs from the
    # package directory, so both are stated rather than implied.
    cmd = (f'# from skills/svg-infographic/\n'
           f'node scripts/generate.mjs build --typepack {t["id"]} --case canonical \\\n'
           f'  --locale ko --out OUT.svg --receipt OUT.json\n'
           f'node scripts/generate.mjs verify --receipt OUT.json --svg OUT.svg')

    # Shown only where it is true, and derived from the model rather than asserted here, so the
    # note disappears on its own once the renderer draws the entity and the artifacts regenerate.
    unrendered = sorted({e for loc in ("ko", "en") for e in (t["locales"][loc].get("unrendered") or [])})
    limit = (f'<div><h4>Known limitation</h4><p class="note">The receipt counts '
             + ", ".join(f"<code>{_e(u)}</code>" for u in unrendered)
             + f' as consumed, but the current package does not draw '
             + ("it" if len(unrendered) == 1 else "them")
             + '. Tracked separately from this gallery.</p></div>') if unrendered else ""

    spec = str(t.get("spec") or "")
    return f"""<details><summary>Prompt, command and limits</summary><div class="detail">
<div><h4>Canonical prompt</h4><pre>ko: {_e(ko.get('prompt'))}
en: {_e(en.get('prompt'))}</pre></div>
<div><h4>Command template</h4><pre>{_e(cmd)}</pre></div>
<div><h4>Receipt facts</h4><div class="chips">{chips}</div></div>
{stress}{boundary}{limit}
<div><h4>Sources</h4><p class="note">
<a href="../skills/svg-infographic/references/{_e(spec)}"><code>{_e(Path(spec).name)}</code></a> ·
<a href="../skills/svg-infographic/references/PROMPT-GALLERY.md#{_e(t['id'])}"><code>PROMPT-GALLERY.md</code></a> ·
<a href="../{_e(ko.get('receipt'))}"><code>receipt</code></a>
</p></div></div></details>"""


def _catalog_card(t: dict) -> str:
    figs = ""
    for loc in ("ko", "en"):
        e = t["locales"][loc]
        alt = f'{t["id"]} — {e.get("title")} ({loc.upper()})'
        figs += (f'<figure data-loc="{loc}"><figcaption>{_e(LOCALE_LABEL[loc])}</figcaption>'
                 f'{_frame("../" + e["svg"], alt)}</figure>')
    return (f'<article id="{_e(t["id"])}"><h3><a href="#{_e(t["id"])}">{_e(t["id"])}</a></h3>'
            f'<p class="signal">{_e(t.get("selectionSignal"))}</p>'
            f'<div class="pair">{figs}</div>{_detail(t)}</article>')


def render(model: dict, tokens: dict) -> str:
    packs = model.get("typepacks") or []
    feat = (model.get("featured") or {}).get("entries") or []
    verified = sum(1 for t in packs for e in t["locales"].values() if e.get("verified"))
    total = sum(len(t["locales"]) for t in packs)

    # Featured facets are reported once for the section: every entry carries the same shape of
    # evidence, and repeating it per card would be six copies of one sentence.
    feat_ev = feat[0]["evidence"] if feat else {}

    # Passing the verifier is not the same as drawing everything the receipt counts, so the summary
    # says so only while that is true. Derived from the same field as the per-pack note: a sentence
    # about a limitation must disappear with the limitation, not outlive it in the copy.
    gaps = sorted({t["id"] for t in packs for e in t["locales"].values() if e.get("unrendered")})
    gaps_note = (" A known " + ", ".join(g.split("-")[0] for g in gaps)
                 + " rendering limitation is tracked separately.") if gaps else ""

    return f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TypePack Gallery</title>
<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: gallery/model.json + gallery/tokens.json (+ gallery/featured.json).
     Regenerate with `python3 -m skillstead_validate gallery --write`;
     `--check` fails when this file drifts.
     A single generated HTML entrypoint with no external network dependencies; images are
     repository-relative SVGs. -->
<style>
{_css(tokens)}
</style>
<div class="wrap">
<header>
  <h1>Diagrams your agent can actually produce</h1>
  <p class="lede">Every picture below was generated by this skill from a written prompt — no drawing,
  no hand-tuned SVG. The showcase shows the range; the catalog under it is what you pick from.</p>
  <div class="switch" id="switch" hidden>
    <button type="button" data-set="both" aria-pressed="false">Side by side</button>
    <button type="button" data-set="ko" aria-pressed="true">한국어</button>
    <button type="button" data-set="en" aria-pressed="false">English</button>
  </div>
</header>

<h2 class="sec">What it can draw</h2>
<p class="sec-note">Six existing outputs, chosen for how differently they are shaped — a cloud
topology, a branching swimlane, a decision matrix, nested trust rings, a mirrored comparison and the
sketch treatment. Click any one to see it full size.</p>
{_facet_line(feat_ev, ("sourceGates", "typePackReceipt"))}
<div class="featured">{"".join(_featured_card(f) for f in feat)}</div>
<p class="note">Hand-authored examples that predate the TypePack receipts. They clear the lint,
layout and typography gates; no receipt exists for them, which is why the receipt facet reads
<code>none</code> rather than being left out.</p>

<h2 class="sec">Choose a TypePack</h2>
<p class="sec-note">Nine minimum-syntax types — the catalog's regression baseline. Each card carries
the signal that selects it and its Korean and English canonical example; open one for the prompt,
the command template, and the point where that type stops fitting.</p>
{_facet_line((packs[0]["locales"]["ko"]["evidence"] if packs else {}), ("sourceGates", "typePackReceipt"))}
<p class="note">{verified}/{total} TypePack canonical artifacts pass the current package verifier.{gaps_note}</p>

<div class="catalog">{"".join(_catalog_card(t) for t in packs)}</div>
</div>
<dialog id="zoom"><img alt=""><form method="dialog"><button>Close</button></form></dialog>
<script>
// Full size is a plain link by default, so it works with no scripting. Where scripting exists the
// click is intercepted and shown in place instead of navigating away from the gallery.
(function () {{
  var dlg = document.getElementById("zoom");
  if (!dlg || !dlg.showModal) return;
  document.addEventListener("click", function (ev) {{
    var a = ev.target.closest("a.frame[data-full]");
    if (!a) return;
    ev.preventDefault();
    dlg.querySelector("img").src = a.dataset.full;
    dlg.querySelector("img").alt = a.querySelector("img").alt;
    dlg.showModal();
  }});
}})();
// The locale switch is the only thing that needs scripting, so it stays hidden until scripting is
// present. Without it both locales are already on screen and every detail still opens.
(function () {{
  var bar = document.getElementById("switch");
  if (!bar) return;
  bar.hidden = false;
  function setLocale(mode) {{
    document.documentElement.dataset.locale = mode === "both" ? "" : mode;
    bar.querySelectorAll("button").forEach(function (x) {{
      x.setAttribute("aria-pressed", String(x.dataset.set === mode));
    }});
  }}
  // With scripting, open on one locale so a featured artifact fills its card. "Side by side" is one
  // click away, and the no-script view already shows both.
  setLocale("ko");
  bar.addEventListener("click", function (ev) {{
    var b = ev.target.closest("button[data-set]");
    if (b) setLocale(b.dataset.set);
  }});
}})();
</script>
</html>
"""
