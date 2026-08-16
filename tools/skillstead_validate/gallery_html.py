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

Both sections switch language together while the single/side-by-side artifact view remains an independent
choice. Everything stays fully visible without scripting: the controls are hidden until JS reveals them, and
`<details>` opens on its own. The fallback is the whole bilingual page, not a reduced one.

Everything is derived — artifact copy from payloads, presentation copy from `gallery/locale.json`, geometry
facts from receipts, the featured selection from `gallery/featured.json`, and every colour, radius and step
from `gallery/tokens.json`.

Images point at the **SVG**, because that is what the gates and the verifier re-checked. The featured
artifacts differ widely in aspect ratio, and the section's claim is that they are one managed set, so
every one gets the same media viewport and keeps its own proportions inside it. Each frame is a link
to the artifact, which gives full size with no scripting; where scripting exists the click opens a
dialog instead.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

GALLERY_HTML = "gallery/index.html"
GITHUB_DOC_BASE = ("https://github.com/kyungseo/skillstead/blob/main/"
                   "skills/svg-infographic/references")
LOCALE_LABEL = {"ko": "한국어", "en": "ENGLISH"}
FACET_COPY_KEY = {"sourceGates": "facetSourceGates", "typePackReceipt": "facetTypePackReceipt",
                  "dataAccuracy": "facetDataAccuracy"}


def _e(v) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def _copy(copy: dict, key: str, loc: str) -> str:
    return str((copy.get(key) or {}).get(loc) or "")


def _bi(copy: dict, key: str, *, tag: str = "span", cls: str = "") -> str:
    attr = f' class="{_e(cls)}"' if cls else ""
    return "".join(
        f'<{tag}{attr} data-copy-loc="{loc}" lang="{loc}">{_e(_copy(copy, key, loc))}</{tag}>'
        for loc in ("ko", "en")
    )


def _bi_value(en: object, ko: object, *, tag: str = "span", cls: str = "") -> str:
    attr = f' class="{_e(cls)}"' if cls else ""
    return (f'<{tag}{attr} data-copy-loc="ko" lang="ko">{_e(ko)}</{tag}>'
            f'<{tag}{attr} data-copy-loc="en" lang="en">{_e(en)}</{tag}>')


def _facet_line(evidence: dict, show: tuple[str, ...], copy: dict) -> str:
    """Print the facets that apply, each with its own verdict. `not-applicable` stays unprinted —
    naming a check that does not apply tells the reader nothing and crowds the ones that do."""
    parts = []
    for key in show:
        val = (evidence or {}).get(key)
        if val in (None, "not-applicable"):
            continue
        cls = "ok" if val == "pass" else "none"
        verdict = "verdictPass" if val == "pass" else "verdictNone"
        parts.append(f'<span class="facet {cls}"><i>{_bi(copy, FACET_COPY_KEY[key])}</i>'
                     f'{_bi(copy, verdict)}</span>')
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

.controls {{ display: flex; flex-wrap: wrap; gap: .65rem 1rem; margin: 0 0 1.4rem; }}
.switch {{ display: flex; align-items: center; gap: .3rem; margin: 0; padding: 0; border: 0; }}
.switch legend {{
  float: left; margin-right: .35rem; color: var(--ink-muted);
  font: 600 11px/1 var(--font-identifier); letter-spacing: .04em;
}}
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
  border-radius: var(--card-radius); padding: 14px; min-width: 0;
}}
h3 {{ margin: 0; font: 600 13px/1.3 var(--font-identifier); letter-spacing: -.01em; }}
h3 a {{ color: inherit; text-decoration: none; }}
h3 a:hover {{ text-decoration: underline; }}
.signal {{
  color: var(--ink-muted); margin: .35rem 0 .8rem; font-size: 12.5px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
figure {{ margin: 0; min-width: 0; }}
figcaption {{
  color: var(--ink-muted); margin-bottom: var(--caption-gap);
  font: 600 10px/1 var(--font-caption); letter-spacing: .07em; text-transform: uppercase;
}}
details {{ margin-top: 12px; border-top: 1px solid var(--card-edge); padding-top: 10px; }}
summary {{ cursor: pointer; color: var(--ink-muted); font: 600 11px/1 var(--font-identifier); letter-spacing: .04em; }}
.detail {{ margin-top: 11px; display: grid; gap: 12px; min-width: 0; }}
.detail > * {{ min-width: 0; }}
.detail h4 {{
  margin: 0 0 5px; font: 600 10px/1 var(--font-caption); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ink-muted);
}}
pre {{
  width: 100%; max-width: 100%; min-width: 0;
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

/* Nothing is hidden until JS sets both state axes. The no-script page exposes both prose locales
   and both artifact locales; language choice and side-by-side viewing stay independent. */
[data-locale="ko"] [data-copy-loc="en"], [data-locale="en"] [data-copy-loc="ko"] {{ display: none; }}
[data-view="single"][data-locale="ko"] figure[data-loc="en"],
[data-view="single"][data-locale="en"] figure[data-loc="ko"] {{ display: none; }}
[data-view="single"] .catalog .pair {{ grid-template-columns: minmax(0, 1fr); }}
[data-copy-loc] + [data-copy-loc]::before {{ content: " / "; color: var(--ink-muted); }}
[data-locale] [data-copy-loc] + [data-copy-loc]::before {{ content: none; }}
/* Once scripting selects a locale, reserve the taller of the two copy variants instead of
   rebuilding the page around whichever language happens to be visible. The hidden variant stays
   in the same grid cell for sizing only. Without scripting the bilingual fallback remains the
   complete sequential view above. */
[data-locale] .stable-copy {{ display: grid; }}
[data-locale] .stable-copy > [data-copy-loc] {{
  display: block; grid-area: 1 / 1; min-width: 0;
}}
[data-locale] .signal > [data-copy-loc] {{
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}}
[data-locale="ko"] .stable-copy > [data-copy-loc="en"],
[data-locale="en"] .stable-copy > [data-copy-loc="ko"] {{ visibility: hidden; }}
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
        name = f.get("nameKo") if loc == "ko" else f.get("name")
        caption = f.get("captionKo") if loc == "ko" else f.get("caption")
        alt = f'{name} — {caption} ({loc.upper()})'
        figs += (f'<figure data-loc="{loc}" lang="{loc}"><figcaption>{_e(LOCALE_LABEL[loc])}</figcaption>'
                 f'{_frame("../" + art["svg"], alt, zoom=True)}</figure>')
    return (f'<div class="feat"><div class="pair">{figs}</div>'
            f'<div class="cap"><span class="nm stable-copy">'
            f'{_bi_value(f.get("name"), f.get("nameKo"))}</span>'
            f'<span class="sub stable-copy">{_bi_value(f.get("caption"), f.get("captionKo"))}</span>'
            f'</div></div>')


def _detail(t: dict, copy: dict) -> str:
    ko, en = t["locales"]["ko"], t["locales"]["en"]
    facts = [("factProfile", t.get("profile")), ("factPreset", t.get("preset")),
             ("factTreatment", t.get("treatment")), ("factDelivery", t.get("fontDelivery")),
             ("factEntities", len(ko.get("consumed") or []))]
    chips = "".join(f'<span class="chip"><i>{_bi(copy, k)}</i>{_e(v)}</span>'
                    for k, v in facts if v not in (None, ""))

    rows = "".join(
        f'<tr><td>{_e(f.get("preset"))}</td><td>{_e(f.get("count"))}</td>'
        f'<td class="{"split" if f.get("result") == "needs-split" else ""}">{_e(f.get("result"))}</td></tr>'
        for f in (t.get("feasibility") or []))
    boundary = (f'<div><h4>{_bi(copy, "whereStops")}</h4><div class="scroll"><table>'
                f'<tr><th>{_bi(copy, "tablePreset")}</th><th>{_bi(copy, "tableCount")}</th>'
                f'<th>{_bi(copy, "tableVerdict")}</th></tr>{rows}</table></div>'
                f'<p class="note stable-copy">{_bi(copy, "needsSplitNote")}</p></div>') if rows else ""

    stress = ""
    if t.get("stress"):
        items = "".join(
            f'<tr><td>{_e(str(s.get("id", "")).replace(t["id"] + "-", ""))}</td>'
            f'<td>{_e(s.get("preset"))}</td>'
            f'<td class="{"split" if s.get("geometryExpected") == "needs-split" else ""}">'
            f'{_e(s.get("geometryExpected"))}</td></tr>' for s in t["stress"])
        stress = (f'<div><h4>{_bi(copy, "declaredStress")}</h4><div class="scroll"><table>'
                  f'<tr><th>{_bi(copy, "tableScenario")}</th><th>{_bi(copy, "tablePreset")}</th>'
                  f'<th>{_bi(copy, "tableExpected")}</th></tr>{items}</table></div></div>')

    # A template, not a runnable line: the output paths are placeholders and it runs from the
    # package directory, so both are stated rather than implied.
    cmd = (f'# from skills/svg-infographic/\n'
           f'node scripts/generate.mjs build --typepack {t["id"]} --case canonical \\\n'
           f'  --locale ko --out OUT.svg --receipt OUT.json\n'
           f'node scripts/generate.mjs verify --receipt OUT.json --svg OUT.svg')

    # Shown only where it is true, and derived from the model rather than asserted here, so the
    # note disappears on its own once the renderer draws the entity and the artifacts regenerate.
    unrendered = sorted({e for loc in ("ko", "en") for e in (t["locales"][loc].get("unrendered") or [])})
    limit = (f'<div><h4>{_bi(copy, "knownLimitation")}</h4><p class="note">'
             + ", ".join(f"<code>{_e(u)}</code>" for u in unrendered)
             + " — " + _bi(copy, "unrenderedOne" if len(unrendered) == 1 else "unrenderedMany")
             + '</p></div>') if unrendered else ""

    spec = str(t.get("spec") or "")
    return f"""<details><summary>{_bi(copy, "detailSummary")}</summary><div class="detail">
<div><h4>{_bi(copy, "canonicalPrompt")}</h4><pre>ko: {_e(ko.get('prompt'))}
en: {_e(en.get('prompt'))}</pre></div>
<div><h4>{_bi(copy, "commandTemplate")}</h4><pre>{_e(cmd)}</pre></div>
<div><h4>{_bi(copy, "receiptFacts")}</h4><div class="chips">{chips}</div></div>
{stress}{boundary}{limit}
<div><h4>{_bi(copy, "sources")}</h4><p class="note">
<a href="{GITHUB_DOC_BASE}/{_e(spec)}"><code>{_e(Path(spec).name)}</code></a> ·
<a href="{GITHUB_DOC_BASE}/PROMPT-GALLERY.md#{_e(t['id'])}"><code>PROMPT-GALLERY.md</code></a> ·
<a href="../{_e(ko.get('receipt'))}"><code>receipt</code></a>
</p></div></div></details>"""


def _catalog_card(t: dict, copy: dict) -> str:
    figs = ""
    for loc in ("ko", "en"):
        e = t["locales"][loc]
        alt = f'{t["id"]} — {e.get("title")} ({loc.upper()})'
        figs += (f'<figure data-loc="{loc}" lang="{loc}"><figcaption>{_e(LOCALE_LABEL[loc])}</figcaption>'
                 f'{_frame("../" + e["svg"], alt)}</figure>')
    return (f'<article id="{_e(t["id"])}"><h3><a href="#{_e(t["id"])}">{_e(t["id"])}</a></h3>'
            f'<p class="signal stable-copy">{_bi_value(t.get("selectionSignal"), t.get("selectionSignalKo"))}</p>'
            f'<div class="pair">{figs}</div>{_detail(t, copy)}</article>')


def render(model: dict, tokens: dict) -> str:
    packs = model.get("typepacks") or []
    feat = (model.get("featured") or {}).get("entries") or []
    copy = (model.get("presentation") or {}).get("copy") or {}
    verified = sum(1 for t in packs for e in t["locales"].values() if e.get("verified"))
    total = sum(len(t["locales"]) for t in packs)

    # Featured facets are reported once for the section: every entry carries the same shape of
    # evidence, and repeating it per card would be six copies of one sentence.
    feat_ev = feat[0]["evidence"] if feat else {}

    # Passing the verifier is not the same as drawing everything the receipt counts, so the summary
    # says so only while that is true. Derived from the same field as the per-pack note: a sentence
    # about a limitation must disappear with the limitation, not outlive it in the copy.
    gaps = sorted({t["id"] for t in packs for e in t["locales"].values() if e.get("unrendered")})
    gaps_note = (" " + _bi(copy, "trackedLimitation") + " "
                 + ", ".join(gaps) + ".") if gaps else ""

    return f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_e(_copy(copy, "pageTitle", "en"))}</title>
<!-- GENERATED VIEW — do not edit by hand.
     Source of truth: gallery/model.json + gallery/tokens.json (+ gallery/featured.json + gallery/locale.json).
     Regenerate with `python3 -m skillstead_validate gallery --write`;
     `--check` fails when this file drifts.
     A single generated HTML entrypoint with no external network dependencies; images are
     repository-relative SVGs. -->
<style>
{_css(tokens)}
</style>
<div class="wrap">
<header>
  <h1 class="stable-copy">{_bi(copy, "heroTitle")}</h1>
  <p class="lede stable-copy">{_bi(copy, "heroLede")}</p>
  <div class="controls" id="controls" hidden>
    <fieldset class="switch" id="language-switch"><legend>{_bi(copy, "languageLabel")}</legend>
      <button type="button" data-language="ko" aria-pressed="true">한국어</button>
      <button type="button" data-language="en" aria-pressed="false">English</button>
    </fieldset>
    <fieldset class="switch" id="view-switch"><legend>{_bi(copy, "viewLabel")}</legend>
      <button type="button" data-view="single" aria-pressed="true">{_bi(copy, "singleView")}</button>
      <button type="button" data-view="both" aria-pressed="false">{_bi(copy, "bothView")}</button>
    </fieldset>
  </div>
</header>

<h2 class="sec stable-copy">{_bi(copy, "featuredTitle")}</h2>
<p class="sec-note stable-copy">{_bi(copy, "featuredNote")}</p>
{_facet_line(feat_ev, ("sourceGates", "typePackReceipt"), copy)}
<div class="featured">{"".join(_featured_card(f) for f in feat)}</div>
<p class="note stable-copy">{_bi(copy, "featuredLegacyNote")}</p>

<h2 class="sec stable-copy">{_bi(copy, "catalogTitle")}</h2>
<p class="sec-note stable-copy">{_bi(copy, "catalogNote")}</p>
{_facet_line((packs[0]["locales"]["ko"]["evidence"] if packs else {}), ("sourceGates", "typePackReceipt"), copy)}
<p class="note">{verified}/{total} {_bi(copy, "currentVerifier")}{gaps_note}</p>

<div class="catalog">{"".join(_catalog_card(t, copy) for t in packs)}</div>
<p class="note source-policy stable-copy">{_bi(copy, "sourcePolicy")}</p>
</div>
<dialog id="zoom"><img alt=""><form method="dialog"><button>{_bi(copy, "close")}</button></form></dialog>
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
// Language and artifact view are independent. The controls stay hidden without scripting, where
// both prose locales and both artifacts are already available and every detail still opens.
(function () {{
  var controls = document.getElementById("controls");
  var language = document.getElementById("language-switch");
  var view = document.getElementById("view-switch");
  if (!controls || !language || !view) return;
  controls.hidden = false;
  function setLanguage(loc) {{
    document.documentElement.dataset.locale = loc;
    document.documentElement.lang = loc;
    document.title = loc === "ko" ? {json.dumps(_copy(copy, "pageTitle", "ko"), ensure_ascii=False)} : {json.dumps(_copy(copy, "pageTitle", "en"), ensure_ascii=False)};
    language.querySelectorAll("button[data-language]").forEach(function (x) {{
      x.setAttribute("aria-pressed", String(x.dataset.language === loc));
    }});
  }}
  function setView(mode) {{
    document.documentElement.dataset.view = mode;
    view.querySelectorAll("button[data-view]").forEach(function (x) {{
      x.setAttribute("aria-pressed", String(x.dataset.view === mode));
    }});
  }}
  setLanguage("ko");
  setView("single");
  language.addEventListener("click", function (ev) {{
    var b = ev.target.closest("button[data-language]");
    if (b) setLanguage(b.dataset.language);
  }});
  view.addEventListener("click", function (ev) {{
    var b = ev.target.closest("button[data-view]");
    if (b) setView(b.dataset.view);
  }});
}})();
</script>
</html>
"""
