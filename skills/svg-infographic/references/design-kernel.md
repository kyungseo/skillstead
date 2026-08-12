# Design Kernel & Canonical Skin

Canonical design contract for every svg-infographic output. Layout math, text budgets
and connector rules stay in `authoring.md`; archetype recipes stay in `archetypes.md`.
This file owns **identity**: what makes any two outputs read as one product.

Approved canonical skin (decision provenance: *Selected canonical skin — Candidate C +
Owner neutral-hierarchy adjustment*, 2026-08-12):

![Approved svg-infographic canonical skin](media/canonical-skin-contact-sheet.png)

[Editable SVG](media/canonical-skin-contact-sheet.svg) — both files are generated
review artifacts. **They are not the palette source of truth** (see §3).

## 1. Design kernel

```text
svg-infographic design kernel
├─ CJK-first sans typography + conclusion-led title
├─ blue focus anchor + soft tinted icon circles
├─ computed layout + generous technical-card spacing
├─ adaptive connectors
│  ├─ aligned: straight
│  ├─ off-axis narrative: gentle single-bend curve
│  ├─ dense topology: rounded orthogonal
│  └─ stage-only: transition glyph
└─ sub-treatments: flat / sketch (overlay, not a second palette)
```

Principles (owner-approved, 2026-08-12):

- **Structure and typography must read before color.** Neutral hierarchy
  (canvas → surface → rule → muted → ink) carries the page; color carries meaning.
- **Pastel only on small semantic surfaces** — icon circles, status callouts, limited
  bands. Never as wide background fills.
- **Status colors lead with markers, borders and labels**, not area fills.
- **One editorial emphasis color** (`--focus`). There is no separate "accent" role;
  text on focus uses `--on-focus`.

## 2. Token contract

Foundation (11 roles — base 7 + status 3 + on-role 1):

| Role | Meaning |
| --- | --- |
| `--canvas` | page background |
| `--surface` | card / panel background |
| `--surface-tint` | icon circles, limited semantic bands |
| `--ink` | body text, primary strokes |
| `--muted` | secondary text, de-emphasized strokes |
| `--rule` | dividers, borders |
| `--focus` | the single editorial emphasis color |
| `--positive` / `--warning` / `--danger` | status meaning (markers/borders/labels first) |
| `--on-focus` | text on focus or saturated status fills |

Domain aliases (6): `edge`, `api`, `compute`, `data`, `external`, `icon` — mapped to
semantic sources and derived deterministically (`skins/derivation-v1.yaml`). Authored
SVG references roles/aliases (`var(--focus)`, `var(--edge-line)`) — **never canonical
hex values directly**, even when the value would match the profile.

Contrast gates (validated by the resolver, fail-closed): ink/canvas·surface ≥ 7:1,
ink/surface-tint ≥ 4.5, muted/canvas·surface ≥ 4.5, on-focus/focus ≥ 4.5,
status/surface ≥ 3:1 (icon·line), status pairwise hue gap ≥ 30° (discrimination is
carried together by lightness, shape and labels).

## 3. Palette SSoT: versioned profiles + single resolver

Color values live in exactly one place: **versioned skin profiles** under
`references/skins/`, interpreted by the **single resolver** `scripts/skin.mjs`.

- `skins/current-v1.yaml` — the approved palette (light + dark, 11 roles).
- `skins/sketch-overlay-v1.yaml` — sketch surface-treatment overlay (paper/ink/
  highlight + rough-stroke treatment). Sketch is an orthogonal overlay, not a palette.
- `skins/derivation-v1.yaml` — alias mapping and derivation ratios. Generators must
  not re-own hex values or mix ratios.

```bash
node scripts/skin.mjs validate references/skins/current-v1.yaml
node scripts/skin.mjs resolve  references/skins/current-v1.yaml --mode dark --treatment sketch --json
```

Resolution model: `palette × mode(light|dark) × treatment(flat|sketch)` — every
combination resolves without duplicate definitions and emits a receipt (profile
digests, resolved-token digest, contrast matrix). Candidate palettes use
`status: candidate` and a single shallow `extends`; the `current` pointer moves only
after owner approval. Role add/remove is a kernel migration, not a profile edit.

## 4. Typography (canonical, owner-approved 2026-08-12)

- Canonical family for **both KO and EN**: **Pretendard**.
- Fallback chain: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
  No remote font loading (Google Fonts included) — outputs stay self-contained.
- The fallback chain carries no dedicated CJK entry: when Pretendard is unavailable,
  KO glyphs resolve through the OS cascade. Renderers must record fallback use in
  their receipt; KO/EN fixtures verify wrapping, containment and geometry parity.
- A locally bundled Inter may later become an *optional typography profile*, kept
  separate from palette profiles. Until then typography does not fork.
- Sketch overlay embeds a subset OFL handwriting font (see `sketch.md`).

## 5. Regeneration & provenance

- The contact sheet above is a consumer of `current-v1`; regenerate it from the
  profile (generator lineage: Work FEAT-20260812-001 review evidence; a
  `skin.mjs contact-sheet` subcommand is reserved for the recolor pipeline).
- Resolver receipts reserve the provenance identity shared by future SVG
  `<metadata>`, sidecar receipts and PNG `iTXt`: kernel version, palette id/version,
  mode, treatment, source digest, resolved-token digest.
