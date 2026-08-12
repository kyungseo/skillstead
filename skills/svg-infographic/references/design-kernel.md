# Design Kernel & Canonical Skin

Canonical design contract for every svg-infographic output. Layout math, text budgets
and connector rules stay in `authoring.md`; archetype recipes stay in `archetypes.md`.
This file owns **identity**: what makes any two outputs read as one product.

Approved canonical skin (decision provenance: *Selected canonical skin — Candidate C +
Owner neutral-hierarchy adjustment*, 2026-08-12):

![Approved svg-infographic canonical skin](media/canonical-skin-contact-sheet.png)

[Editable SVG](media/canonical-skin-contact-sheet.svg) — both files are an **approved
snapshot, synchronized with the `current-v1` profile**. They are not the palette
source of truth (§3), and they become regenerated profile consumers once the recolor
pipeline (`skin.mjs contact-sheet`, reserved) lands. The snapshot SVG references a
locally installed handwriting font for its sketch slot (no `@font-face` embed); the
PNG carries the approved rendering.

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
semantic sources and derived deterministically (`skins/derivation-v1.yaml`).
**Authoring semantics reference roles and aliases** (`var(--focus)`,
`var(--edge-line)`) — never hand-typed canonical hex values. **Portable resolved SVG
materializes those roles as direct per-shape `fill`/`stroke` attributes** while
retaining role annotations for deterministic recoloring (§6).

Contrast gates (validated by the resolver, fail-closed): ink/canvas·surface ≥ 7:1,
ink/surface-tint ≥ 4.5, muted/canvas·surface ≥ 4.5, on-focus/focus ≥ 4.5,
status/surface ≥ 3:1 (icon·line), status pairwise hue gap ≥ 30° (discrimination is
carried together by lightness, shape and labels).

## 3. Palette SSoT: versioned profiles + single resolver

Color values live in exactly one place: **versioned skin profiles** under
`references/skins/`, interpreted by the **single resolver** `scripts/skin.mjs`.

- `skins/registry.yaml` — selects the CURRENT palette/derivation/overlay; switching
  to an approved candidate edits only this file (version files stay immutable).
- `skins/current-v1.yaml` — the approved palette (light + dark, 11 roles + the
  bounded `anchors.secondary-*` hue consumed by the api alias).
- `skins/legacy-v0.8.yaml` — frozen hex allowlist for the preserved v0.8.0 release
  graphic (predates the role kernel; palette validation only).
- `skins/sketch-overlay-v1.yaml` — sketch surface-treatment overlay (paper/ink/
  highlight + rough-stroke treatment). Sketch is an orthogonal overlay, not a palette.
- `skins/derivation-v1.yaml` — alias mapping and derivation ratios. Generators must
  not re-own hex values or mix ratios.

```bash
node scripts/skin.mjs validate references/skins/current-v1.yaml
node scripts/skin.mjs resolve  references/skins/current-v1.yaml --mode light --treatment sketch --json
node scripts/skin.mjs registry
```

Resolution model: `palette × mode × treatment` without duplicate definitions, with
a receipt (profile digests, resolved-token digest, selected-mode contrast matrix).
Wave 0 supported combinations — anything else is rejected fail-closed:

| treatment | light | dark |
| --- | --- | --- |
| flat | ✓ | ✓ |
| sketch | ✓ | ✗ (needs a mode-aware overlay + contact-sheet approval) |

Candidate palettes use `status: candidate` and a single shallow `extends`; the
`current` pointer moves only in `registry.yaml` after owner approval. Role
add/remove is a kernel migration, not a profile edit.

## 4. Typography (canonical, owner-approved 2026-08-12)

- Canonical family for **both KO and EN**: **Pretendard**.
- Fallback chain: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
  No remote font loading (Google Fonts included) — outputs stay self-contained.
- The fallback chain carries no dedicated CJK entry: when Pretendard is unavailable,
  KO glyphs resolve through the OS cascade. Renderers must record fallback use in
  their receipt; KO/EN fixtures verify wrapping, containment and geometry parity.
- A locally bundled Inter may later become an *optional typography profile*, kept
  separate from palette profiles. Until then typography does not fork.
- Shipped sketch artifacts subset-embed an OFL handwriting font (`sketch.md`); review
  snapshots that merely reference a locally installed font must say so.

## 5. Portable resolved output (PPT-oriented)

Authoring semantics and distributed paint are separate layers:

```text
skin profile + geometry/role annotations
                 ↓ resolver/materializer (skin.mjs)
direct-attribute resolved SVG
          ├─ canonical PNG render          (same resolved SVG)
          ├─ HTML raw inline               (identical bytes, digest parity)
          └─ PPT import                    (PPT-oriented portable subset)
```

**Rationale (owner-observed historical failure, 2026-08-12):** CSS-variable paint
broke when an SVG was imported into PowerPoint; per-shape direct `fill`/`stroke`
avoided it. The exact PowerPoint version/fixture was not preserved, so this is
recorded as an observed regression guard — claim **"PPT-oriented portable subset"**,
never "PPT compatible", until a real import verification exists.

Contract for distributed canonical SVG:

- Every paint-bearing shape carries **direct `fill`/`stroke` attributes**. Semantic
  recolor information stays in non-rendering annotations:
  `data-fill-role="surface"`, `data-stroke-role="rule"`.
- Portable paint must NOT use: `var(--…)`, `currentColor`, class-dependent
  fill/stroke, external stylesheets or remote fonts, or core paint that exists only
  via group inheritance.
- `skin.mjs` materializes/recolors from the annotations and verifies: every
  annotation role exists in resolver output; every direct paint matches the current
  resolved role value; a profile switch replaces all annotated paints
  deterministically; `fill="none"` and explicitly allowed non-token paints
  (annotated `data-paint-static`) are preserved. Canonical hex in *generated*
  resolved SVG is not a palette-lint violation; hand-typed canonical hex without a
  role annotation is.
- **Dark mode is a separate resolved artifact** (`diagram.light.svg` /
  `diagram.dark.svg`) — never a `prefers-color-scheme` media query inside one SVG.
- PNG renders from the same resolved SVG (no separate template). If an HTML artifact
  exists it inlines the identical bytes; a `<svg>…</svg>` byte/digest parity fixture
  guards re-serialization drift.
- Beyond CSS paint, these need their own portability fixtures before any import
  claim: `<use>`/`<symbol>` icons, marker arrowheads, SVG filters, embedded fonts,
  transform/text geometry. Prefer expanding per-instance-colored `<use>` into
  concrete paths in portable output. Sketch filters and embedded handwriting fonts
  may stay on the PNG-recommended path until PPT verification.
- Minimum regression fixture pair: **baseline-red** (paint via CSS variables /
  `currentColor`) vs **positive** (same geometry, per-shape direct paint) —
  canonical artifacts use the positive form.

Delivery: the contract and annotation schema land in Wave 0 CP2 (this section);
the direct-paint lint/materializer and negative fixtures in CP3; portable pilot
generation with PNG parity in CP4. If real PPT import verification is not possible
there, it is recorded as **unverified** and queued as follow-up work.

## 6. Regeneration & provenance

- The contact sheet above is an approved snapshot synchronized with `current-v1`;
  it becomes a regenerated profile consumer when the recolor pipeline lands
  (`skin.mjs contact-sheet`, reserved — generator lineage: Work FEAT-20260812-001
  review evidence).
- Resolver receipts reserve the provenance identity shared by future SVG
  `<metadata>`, sidecar receipts and PNG `iTXt`: kernel version, palette id/version,
  mode, treatment, source digest, resolved-token digest.
