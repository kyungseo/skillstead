# Catalog Overview Connector Validation — 2026-07-18

## Scope

- Assets: `examples/catalog-overview.en.svg`, `examples/catalog-overview.ko.svg`, and their 2× PNG exports.
- Reusable contract: `skills/svg-infographic/SKILL.md` and `skills/svg-infographic/references/authoring.md`.
- Trigger: clipped pill labels, a release card outside its parent panel, and connectors whose arrowheads obscured nearly all of the visible shaft.
- Provenance: Claude Code implemented and rendered the correction and performed full-frame/crop QA; Codex independently re-opened both final PNGs and reran the package, XML, geometry-parity, dimension, and whitespace checks below.

## Corrective Design

- Count stroke, shadow, badges, and markers when calculating visual containment.
- Size pills and badges from the wider rendered label plus horizontal padding.
- Use `markerUnits="userSpaceOnUse"` for predictable arrowhead geometry and place the marker tip at the path endpoint.
- Budget the connector corridor for the arrowhead, a visible shaft, and an 8–12 px target gap.
- Choose among a standard arrow, compact arrow, transition glyph, or layout reflow according to meaning and available space.

The catalog keeps standard arrows because its connectors carry one consistent visual language. The final short corridor was widened by moving the check and release stages within the existing panel instead of widening the canvas.

## Verification Results

| Check | Result |
| --- | --- |
| Skill package validator | Pass — `Skill is valid!` |
| SVG XML parse (`xmllint --noout`) | Pass — 2/2 |
| English/Korean geometry parity | Pass — 117/117 ordered elements match on geometry attributes |
| PNG dimensions (`sips`) | Pass — both exports are 2800 × 1800 |
| Repository whitespace check (`git diff --check`) | Pass |
| Full-frame and connector-crop visual review | Pass — no clipping, escaped card, CJK tofu, unresolved connector, or head-only arrow observed |

## Evidence Boundary

- Validation was performed on macOS against the catalog overview pair and the current skill package.
- Geometry parity compares ordered SVG elements and geometry attributes; localized text intentionally differs.
- Visual review is bounded to these rendered assets. It demonstrates the revised contract on this dogfood case, not that every future diagram will pass without its own pre-render and PNG review.
