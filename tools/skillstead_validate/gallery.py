"""Gallery model — the join that every human-facing surface is built from.

The repository gallery, the README contact sheets and (later) Wave 2 figures all need the same
answer: which TypePacks are routable, what do their verified examples look like, and what did the
receipts actually record. Building that answer three times would let three surfaces drift apart, so
it is built once, here, and written to `gallery/model.json`.

**The model owns nothing.** It joins the package and repository presentation surfaces. Each stays
the authority for its own fields:

    manifest.yaml          TypePack identity, selection signal, presets, declared fit boundaries
    gallery/locale.json    repository-owned KO display signals and bilingual page copy
    gallery/featured.json  editorial selection and localized Featured metadata
    gallery/projections.json selected presentation examples and localized captions
    input payload (.yaml)  KO/EN prompts and titles
    receipt (.json)        preset, treatment, fontDelivery, geometry, residual, consumed, provenance
    artifact (.svg)        bytes, and the digest over them

Two boundaries are worth stating plainly, because both are places where a model like this usually
overclaims.

**What "verified" means here.** A receipt saying `0 error(s)` is a claim about the package it was
made against, not about today. So nothing is copied: the claim is re-established against the live
runtime digest, the recorded artifact digest, and the package's own verifier — which is the
canonical owner of the exact receipt schema and of the semantic and geometry checks. This module
deliberately does not re-implement a schema check; a second, weaker one in Python would let a
receipt pass here that the verifier would reject.

**What carries the claim.** Canonical verification attaches to the **SVG**, because that is what the
TypePack verifier re-checks. Canonical and Featured PNGs are renders or inventories and are never
described as verified. Presentation projection PNGs are a separate class: their verifier regenerates
the canonical pair and derived output, then checks the receipt-bound bytes. They are verified only as
derived projections and never promoted to canonical artifacts.

The contact sheet is the one exception, because there the PNG *is* what the README displays. It
carries `contact-sheet.render.json`, written by the render step and never by `--write`, binding the
source SVG, the featured inputs, the renderer and the output bytes. That is a staleness gate, not a
verification claim: it proves the PNG matches what produced it, not that the picture is correct.

This lives at repository level, not inside the package, and that placement is the direction contract
made concrete: the installed package must run knowing nothing about the repository's presentation
layer. It is Python because repo CI runs Python — a Node generator under `skills/` would be a gate
nobody executes. Where package knowledge is genuinely needed (the YAML dialect, the digest framing,
the verifier) it is borrowed by invoking the package rather than reimplemented.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .contact_sheet import check_render, render_sheet, sheet_paths
from .findings import Finding
from .gallery_html import GALLERY_HTML, render as render_html

SKILL = "skills/svg-infographic"
EXAMPLES = "examples/svg-infographic/typepacks"
MODEL_PATH = "gallery/model.json"
TOKENS_PATH = "gallery/tokens.json"
LOCALE_PATH = "gallery/locale.json"
PROJECTIONS_PATH = "gallery/projections.json"
EXPORTER = "tools/gallery_export.mjs"
LOCALES = ("ko", "en")
LEGACY_FEATURED_HEADER_ROLES = (
    'data-layout-role="page-title-header"',
    'data-layout-role="title-rail"',
)

REQUIRED_COPY_KEYS = (
    "pageTitle", "heroTitle", "heroLede", "languageLabel", "viewLabel", "korean", "english",
    "singleView", "bothView", "featuredTitle", "featuredNote", "featuredLegacyNote",
    "projectionTitle", "projectionNote", "projectionDerivedNote", "projectionEvidence",
    "catalogTitle", "catalogNote", "currentVerifier", "trackedLimitation", "sourcePolicy",
    "detailSummary", "canonicalPrompt", "commandTemplate", "receiptFacts", "whereStops",
    "declaredStress", "knownLimitation", "sources", "needsSplitNote", "unrenderedOne",
    "unrenderedMany", "tablePreset", "tableCount", "tableVerdict", "tableScenario",
    "tableExpected", "factProfile", "factPreset", "factTreatment", "factDelivery",
    "factEntities", "facetSourceGates", "facetTypePackReceipt", "facetDataAccuracy",
    "facetCanonicalPair", "facetProjectionReceipt",
    "verdictPass", "verdictNone", "close",
)

# Tokens the surfaces cannot render without. Missing any of these is a build failure, not a default.
REQUIRED_TOKEN_KEYS = (
    "palette.ground", "palette.card", "palette.cardEdge", "palette.ink", "palette.inkMuted",
    "palette.verified", "shape.cardRadius", "space.base", "space.cardPad",
    "type.identifier.family", "type.prose.family", "type.caption.family",
    "grid.galleryMaxWidth", "grid.contactSheet.columns",
)

# Every locale entry must carry these, each from its stated authority. A null is a finding, not a
# gap to render around — CP3C reads only this model, so anything missing here is missing forever.
REQUIRED_LOCALE_FIELDS = (
    "title", "prompt", "preset", "treatment", "fontDelivery", "geometry",
    "consumed", "svg", "svgDigest",
)


class GalleryError(Exception):
    """Raised when the model cannot be built at all (as opposed to a per-example finding)."""


@dataclass(frozen=True)
class NodeRunner:
    """Runs the package's own entrypoints, and the exporter that borrows its parser.

    The YAML dialect, the digest framing and the verifier all live in the package. Reimplementing
    any of them here would create a second implementation free to drift from the one that actually
    gates artifacts.
    """

    repo_root: Path

    def _env(self) -> dict:
        env = dict(os.environ)
        env["SVGINFO_EXECUTION_MODE"] = "source-development"
        return env

    def _run(self, args: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
        return subprocess.run(["node", *args], cwd=self.repo_root, capture_output=True,
                              text=True, timeout=timeout, env=self._env())

    def export(self) -> dict:
        r = self._run([EXPORTER, "--repo-root", "."])
        if r.returncode != 0:
            raise GalleryError(f"{EXPORTER} failed (exit {r.returncode}): "
                               f"{(r.stderr or r.stdout).strip()[:400]}")
        try:
            return json.loads(r.stdout)
        except json.JSONDecodeError as e:
            raise GalleryError(f"{EXPORTER} did not emit JSON: {e}") from e

    def runtime_surface_digest(self) -> str:
        r = self._run([f"{SKILL}/scripts/preflight.mjs", "--json"])
        if r.returncode != 0:
            raise GalleryError(f"preflight refused (exit {r.returncode}): "
                               f"{(r.stderr or r.stdout).strip()[:400]}")
        try:
            return json.loads(r.stdout)["digests"]["runtimeSurfaceDigest"]
        except (json.JSONDecodeError, KeyError) as e:
            raise GalleryError(f"preflight --json did not carry a runtime digest: {e}") from e

    def source_gates(self, svg: Path, palette: str | None = "current") -> tuple[bool, str]:
        """The three checks any artifact must pass regardless of how it was authored.

        Featured examples predate the TypePack receipts, so this is the whole of what can be
        claimed about them — which makes running it, rather than asserting it, the point.

        `palette=None` drops only the paint check, and only for an entry that declares the
        exception in featured.json. Everything else still runs, and the canonical artifacts have no
        exception at all: without the profile argument check-svg skips paint entirely, which is how
        90 out-of-profile hexes sat in them unseen — the check existed, nothing ran it.
        """
        svg_args = ["--palette-profile", palette] if palette else []
        for tool, args in ((f"{SKILL}/scripts/check-svg.mjs", svg_args),
                           (f"{SKILL}/scripts/check-layout.mjs", []),
                           (f"{SKILL}/scripts/skin.mjs", ["typography-check"])):
            r = self._run([tool, *args, str(svg)])
            if r.returncode != 0:
                return False, f"{Path(tool).name} exit {r.returncode}: {(r.stdout + r.stderr).strip()[:200]}"
        return True, ""

    def verify(self, receipt: Path, svg: Path) -> tuple[bool, str]:
        r = self._run([f"{SKILL}/scripts/generate.mjs", "verify",
                       "--receipt", str(receipt), "--svg", str(svg)])
        out = (r.stdout + r.stderr).strip()
        return r.returncode == 0 and " 0 error(s)" in out, out

    def verify_projection(self, receipt: Path, output: Path) -> tuple[bool, str]:
        r = self._run([f"{SKILL}/scripts/projection.mjs", "verify",
                       "--receipt", str(receipt), "--out", str(output)])
        out = (r.stdout + r.stderr).strip()
        return r.returncode == 0 and "projection verify: pass" in out, out


def _rendered_entities(svg: Path) -> set:
    """Entity ids the artifact actually carries, by the same marker the verifier reads."""
    return set(re.findall(r'data-entity="([^"]+)"', svg.read_text(encoding="utf-8")))


def _sha256(p: Path) -> str:
    return "sha256:" + hashlib.sha256(p.read_bytes()).hexdigest()


def _read_json(p: Path) -> dict:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise GalleryError(f"{p}: unreadable ({e})") from e


def _safe_locator(root: Path, receipt: Path, value: object) -> Path | None:
    if not isinstance(value, str) or not value or Path(value).is_absolute() or "\\" in value:
        return None
    resolved = (receipt.parent / value).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        return None
    return resolved


def _repo_path(root: Path, value: object) -> Path | None:
    if not isinstance(value, str) or not value or Path(value).is_absolute() or "\\" in value:
        return None
    resolved = (root / value).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        return None
    return resolved


def _token(tokens: dict, dotted: str):
    node = tokens
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


# Evidence is three independent questions, not a ladder. An artifact can pass the source gates and
# have no receipt; a chart will one day have a receipt AND a data-accuracy verdict. Ranking them
# would force "chart is more verified than a diagram", which is not what any of these mean.
#   pass            the check ran and succeeded
#   none            the check applies but no evidence exists for this artifact
#   not-applicable  the check does not apply to this kind of artifact
def _facets(source_gates: str, receipt: str, data_accuracy: str = "not-applicable") -> dict:
    return {"sourceGates": source_gates, "typePackReceipt": receipt, "dataAccuracy": data_accuracy}


def _parity(ko, en):
    """Lift a value to the TypePack only when both locales agree; otherwise keep it per locale.

    Collapsing a differing pair would quietly assert a sameness the artifacts do not have —
    approval-gate's pill width, for instance, is derived from the copy and legitimately differs.
    """
    return ko if ko == en else None


def build_model(repo_root: Path, runner: NodeRunner | None = None) -> tuple[dict, list[Finding]]:
    """Join package, artifact, editorial, token and locale surfaces. Findings are fatal."""
    findings: list[Finding] = []
    root = repo_root.resolve()
    runner = runner or NodeRunner(root)

    tokens_p = root / TOKENS_PATH
    if not tokens_p.exists():
        raise GalleryError(f"{TOKENS_PATH} is missing — surfaces have no frame vocabulary to render with")
    tokens = _read_json(tokens_p)
    for key in REQUIRED_TOKEN_KEYS:
        if _token(tokens, key) is None:
            findings.append(Finding("GAL-TOKEN", TOKENS_PATH, f'required token "{key}" is missing'))

    export = runner.export()
    packs = export.get("typepacks") or []
    payloads = export.get("payloads") or {}
    if not packs:
        raise GalleryError("the manifest declares no routable TypePack")

    locale_p = root / LOCALE_PATH
    if not locale_p.exists():
        raise GalleryError(f"{LOCALE_PATH} is missing — the public page has no locale authority")
    presentation = _read_json(locale_p)
    if presentation.get("schemaVersion") != 1:
        findings.append(Finding("GAL-LOCALE", LOCALE_PATH, "schemaVersion must be 1"))
    copy = presentation.get("copy") or {}
    missing_copy = sorted(set(REQUIRED_COPY_KEYS) - set(copy))
    extra_copy = sorted(set(copy) - set(REQUIRED_COPY_KEYS))
    if missing_copy or extra_copy:
        findings.append(Finding(
            "GAL-LOCALE", LOCALE_PATH,
            f"copy keys must match the renderer contract (missing={missing_copy}, extra={extra_copy})"))
    for key, value in copy.items():
        if not isinstance(value, dict) or set(value) != set(LOCALES) or any(
                not isinstance(value.get(loc), str) or not value.get(loc).strip() for loc in LOCALES):
            findings.append(Finding(
                "GAL-LOCALE", LOCALE_PATH, f'copy "{key}" must contain non-empty ko and en strings'))
    selection_ko = presentation.get("typepackSelectionKo") or {}
    pack_ids = {str(pack.get("id")) for pack in packs}
    if set(selection_ko) != pack_ids:
        findings.append(Finding(
            "GAL-LOCALE", LOCALE_PATH,
            "typepackSelectionKo keys must exactly match routable manifest TypePack ids "
            f"(missing={sorted(pack_ids - set(selection_ko))}, extra={sorted(set(selection_ko) - pack_ids)})"))
    for tid, value in selection_ko.items():
        if not isinstance(value, str) or not value.strip():
            findings.append(Finding("GAL-LOCALE", LOCALE_PATH,
                                    f'typepackSelectionKo["{tid}"] must be a non-empty string'))

    live_digest = runner.runtime_surface_digest()

    entries = []
    for pack in sorted(packs, key=lambda p: str(p.get("id"))):
        tid = str(pack.get("id"))
        canonical = (pack.get("inputs") or {}).get("canonical") or {}
        payload = payloads.get(canonical.get("path")) or {}
        if not payload:
            findings.append(Finding("GAL-INPUT", tid,
                                    f"canonical input {canonical.get('path')!r} is missing or unreadable"))

        locales = {}
        for loc in LOCALES:
            base = root / EXAMPLES / tid / f"{tid}.{loc}"
            svg, png, rcp = Path(f"{base}.svg"), Path(f"{base}.png"), Path(f"{base}.json")
            missing = [p.name for p in (svg, png, rcp) if not p.exists()]
            if missing:
                findings.append(Finding("GAL-ARTIFACT", f"{tid}/{loc}", f"missing {', '.join(missing)}"))
                continue
            receipt = _read_json(rcp)
            prov = receipt.get("provenance") or {}
            svg_digest = _sha256(svg)

            # --- verification: three facts, none of them the receipt's own word ---------------
            # There is deliberately no Python schema check here. `generate.mjs verify` is the
            # canonical owner of the exact receipt schema and of the semantic and geometry checks;
            # a weaker second opinion in this file would only create a way to pass here and fail
            # there.
            recorded = receipt.get("artifactDigest")
            checks = {
                "runtimeDigest": prov.get("runtimeSurfaceDigest") == live_digest,
                # No fallback: an absent artifactDigest is a failure, not a reason to hash the file
                # and agree with ourselves.
                "artifactDigest": isinstance(recorded, str) and recorded == svg_digest,
                "verifier": False,
            }
            ok, out = runner.verify(rcp, svg)
            checks["verifier"] = ok
            for name, passed in checks.items():
                if passed:
                    continue
                detail = f"{name} check failed"
                if name == "runtimeDigest":
                    detail += (f" — receipt {str(prov.get('runtimeSurfaceDigest'))[:22]}… "
                               f"vs live {live_digest[:22]}…")
                elif name == "artifactDigest":
                    detail += (" — receipt records nothing" if recorded is None
                               else f" — receipt {str(recorded)[:22]}… vs svg {svg_digest[:22]}…")
                else:
                    detail += f" — {out.splitlines()[-1] if out else 'no output'}"
                findings.append(Finding("GAL-VERIFY", f"{tid}/{loc}", detail))

            entry = {
                "title": (payload.get("title") or {}).get(loc),
                "prompt": payload.get(f"prompt_{loc}"),
                # Receipt-owned: what the artifact was actually built as, not what was requested.
                "preset": receipt.get("preset"),
                "treatment": (receipt.get("treatment") or {}).get("name"),
                "fontDelivery": (receipt.get("fontDelivery") or {}).get("mode"),
                "geometry": receipt.get("geometry"),
                "geometryExpected": receipt.get("geometryExpected"),
                "residual": receipt.get("residual"),
                "residualDisposition": receipt.get("residualDisposition"),
                "consumed": receipt.get("consumed") or [],
                # Entities the receipt counts as consumed that the artifact never draws. Derived,
                # not declared: `generate.mjs verify` exempts one id from this same check, so the
                # gap it permits is reported here rather than described in prose that would go
                # stale the moment the exemption is removed and the artifacts are regenerated.
                "unrendered": [c for c in (receipt.get("consumed") or [])
                               if c not in _rendered_entities(svg)] or None,
                "svg": f"{EXAMPLES}/{tid}/{tid}.{loc}.svg",
                "svgDigest": svg_digest,
                "receipt": f"{EXAMPLES}/{tid}/{tid}.{loc}.json",
                # Present only when every fact holds. Absent means unverified — never "assume ok".
                "verified": all(checks.values()) or None,
                # The same claim expressed as facets, so a surface can say what was and was not
                # checked instead of collapsing it to one word.
                "evidence": _facets("pass" if all(checks.values()) else "none",
                                    "pass" if all(checks.values()) else "none"),
            }
            for field in REQUIRED_LOCALE_FIELDS:
                if entry.get(field) in (None, "", []):
                    findings.append(Finding("GAL-FIELD", f"{tid}/{loc}",
                                            f'required field "{field}" is missing from its authority'))
            # The render, kept separate from the claim: an inventory entry, not a verified artifact.
            entry["png"] = {"path": f"{EXAMPLES}/{tid}/{tid}.{loc}.png", "digest": _sha256(png),
                            "verified": None,
                            "note": "render of the verified SVG; not itself re-verified"}
            locales[loc] = entry

        ko, en = locales.get("ko") or {}, locales.get("en") or {}
        fit = (pack.get("fit") or {}).get("feasibility") or []
        entries.append({
            "id": tid,
            "selectionSignal": pack.get("selection_signal"),
            "selectionSignalKo": selection_ko.get(tid),
            "spec": pack.get("spec"),
            "profile": pack.get("profile"),
            "support": pack.get("support"),
            "presets": pack.get("presets") or [],
            "preferredPreset": pack.get("preferred_preset"),
            # Lifted only where the two locales agree; otherwise the locale entries keep their own.
            "treatment": _parity(ko.get("treatment"), en.get("treatment")),
            "fontDelivery": _parity(ko.get("fontDelivery"), en.get("fontDelivery")),
            "preset": _parity(ko.get("preset"), en.get("preset")),
            # What CP3C's detail view needs to draw the needs-split boundary without re-reading
            # the manifest: the declared stress scenarios and the fit verdicts around them.
            "stress": [{"id": s.get("id"), "path": s.get("path"), "preset": s.get("preset"),
                        "count": s.get("count"), "geometryExpected": s.get("geometry_expected"),
                        "covers": s.get("covers") or [],
                        "residualDisposition": s.get("residual_disposition")}
                       for s in ((pack.get("inputs") or {}).get("stress") or [])],
            "feasibility": [{"preset": f.get("preset"), "orientation": f.get("orientation"),
                             "count": f.get("count"), "layout": f.get("layout"),
                             "result": f.get("result")} for f in fit],
            "locales": locales,
        })

    # --- featured: the editorial selection, with only the claim its evidence supports ----------
    fx = export.get("featured") or {}
    for err in fx.get("errors") or []:
        findings.append(Finding("GAL-FEATURED", "gallery/featured.json", err))
    featured = []
    for entry in fx.get("entries") or []:
        arts, gates_ok, detail = {}, True, ""
        for loc, rel in (entry.get("artifacts") or {}).items():
            svg = root / rel
            # the exception is read from this entry's own declaration, never assumed
            ok, why = runner.source_gates(
                svg, None if entry.get("paletteProfile") == "legacy-unprofiled" else "current")
            if not ok:
                gates_ok = False
                detail = why
                findings.append(Finding("GAL-FEATURED", f'{entry["slug"]}/{loc}',
                                        f"source gates failed — {why}"))
            source = svg.read_text(encoding="utf-8")
            if any(role in source for role in LEGACY_FEATURED_HEADER_ROLES):
                gates_ok = False
                findings.append(Finding(
                    "GAL-FEATURED", f'{entry["slug"]}/{loc}',
                    "public Featured artifact uses the rejected legacy vertical title rail — "
                    "migrate it to the header-cluster/cluster-keyline contract",
                ))
            arts[loc] = {"svg": rel, "svgDigest": _sha256(svg)}
        featured.append({
            "slug": entry["slug"], "name": entry.get("name"), "caption": entry.get("caption"),
            "nameKo": entry.get("nameKo"), "captionKo": entry.get("captionKo"),
            "reason": entry.get("reason"),
            "paletteProfile": entry.get("paletteProfile"),
            "paletteNote": entry.get("paletteNote"),
            "artifacts": arts,
            # Hand-authored, predating the TypePack receipts: the gates are the whole claim.
            "evidence": _facets("pass" if gates_ok else "none",
                                "pass" if entry.get("hasReceipt") else "none"),
        })

    # --- presentation projections: verified derived PNGs, never canonical gallery entries ----
    projection_p = root / PROJECTIONS_PATH
    if not projection_p.exists():
        raise GalleryError(f"{PROJECTIONS_PATH} is missing — projection examples have no selection authority")
    projection_source = _read_json(projection_p)
    if projection_source.get("schemaVersion") != 1:
        findings.append(Finding("GAL-PROJECTION", PROJECTIONS_PATH, "schemaVersion must be 1"))

    canonical_decl = projection_source.get("canonical") or {}
    canonical_svg = _repo_path(root, canonical_decl.get("svg"))
    canonical_png = _repo_path(root, canonical_decl.get("png"))
    canonical_ok = bool(canonical_svg and canonical_svg.is_file() and
                        canonical_png and canonical_png.is_file())
    if not canonical_ok:
        findings.append(Finding("GAL-PROJECTION", PROJECTIONS_PATH,
                                "declared canonical SVG/PNG pair must be safe repository files"))
    canonical_svg_digest = _sha256(canonical_svg) if canonical_svg and canonical_svg.is_file() else None
    canonical_png_digest = _sha256(canonical_png) if canonical_png and canonical_png.is_file() else None

    bundled = root / SKILL / "references/presentation/surfaces"
    selected_ids = {p.stem for p in bundled.glob("*.json")}
    declared_entries = projection_source.get("entries") or []
    declared_ids = {str(e.get("surface") or "") for e in declared_entries}
    if declared_ids != selected_ids or len(declared_entries) != len(selected_ids):
        findings.append(Finding(
            "GAL-PROJECTION", PROJECTIONS_PATH,
            "projection entries must exactly match bundled selected surfaces "
            f"(missing={sorted(selected_ids - declared_ids)}, extra={sorted(declared_ids - selected_ids)})"))

    projection_entries = []
    for entry in declared_entries:
        surface = str(entry.get("surface") or "")
        output = _repo_path(root, entry.get("output"))
        receipt = _repo_path(root, entry.get("receipt"))
        expected_manifest = (bundled / f"{surface}.json").resolve()
        problems = []
        for field in ("name", "name_ko", "caption", "caption_ko"):
            if not isinstance(entry.get(field), str) or not entry.get(field).strip():
                problems.append(f'{field} must be a non-empty string')
        if not output or not output.is_file():
            problems.append("output PNG is missing or unsafe")
        if not receipt or not receipt.is_file():
            problems.append("projection receipt is missing or unsafe")
        if not expected_manifest.is_file():
            problems.append("selected bundled manifest is missing")

        data = _read_json(receipt) if receipt and receipt.is_file() else {}
        if data.get("schema") != {"name": "svg-infographic-projection-receipt", "version": 1}:
            problems.append("receipt schema is invalid")
        if data.get("status") != "pass" or data.get("classification") != "projection-pass":
            problems.append("receipt status/classification is not pass")
        if (data.get("surface") or {}).get("id") != surface:
            problems.append("receipt surface id differs from the selection")

        svg_locator = _safe_locator(
            root, receipt, ((data.get("inputs") or {}).get("svg") or {}).get("locator")) if receipt else None
        png_locator = _safe_locator(
            root, receipt, ((data.get("inputs") or {}).get("canonical_png") or {}).get("locator")) if receipt else None
        manifest_locator = _safe_locator(
            root, receipt, (data.get("surface") or {}).get("manifest_locator")) if receipt else None
        if canonical_ok and canonical_svg and svg_locator != canonical_svg.resolve():
            problems.append("receipt SVG locator differs from the declared canonical")
        if canonical_ok and canonical_png and png_locator != canonical_png.resolve():
            problems.append("receipt canonical PNG locator differs from the declared canonical")
        if manifest_locator != expected_manifest:
            problems.append("receipt manifest locator differs from the selected bundled surface")
        if canonical_svg_digest and ((data.get("inputs") or {}).get("svg") or {}).get(
                "sha256") != canonical_svg_digest.removeprefix("sha256:"):
            problems.append("receipt SVG digest differs from the canonical bytes")
        if canonical_png_digest and ((data.get("inputs") or {}).get("canonical_png") or {}).get(
                "sha256") != canonical_png_digest.removeprefix("sha256:"):
            problems.append("receipt canonical PNG digest differs from the canonical bytes")
        if output and output.is_file() and (data.get("output") or {}).get(
                "sha256") != _sha256(output).removeprefix("sha256:"):
            problems.append("receipt output digest differs from the projection bytes")

        verified, verify_out = runner.verify_projection(receipt, output) if (
            canonical_ok and output and output.is_file() and receipt and receipt.is_file() and
            expected_manifest.is_file() and not problems) else (False, "")
        if not verified:
            problems.append("projection verifier did not pass" +
                            (f" — {verify_out.splitlines()[-1]}" if verify_out else ""))
        if problems:
            for problem in problems:
                findings.append(Finding("GAL-PROJECTION", surface or PROJECTIONS_PATH, problem))

        projection_entries.append({
            "surface": surface,
            "name": entry.get("name"), "nameKo": entry.get("name_ko"),
            "caption": entry.get("caption"), "captionKo": entry.get("caption_ko"),
            "output": str(entry.get("output") or ""),
            "outputDigest": _sha256(output) if output and output.is_file() else None,
            "receipt": str(entry.get("receipt") or ""),
            "manifest": str(expected_manifest.relative_to(root)) if expected_manifest.is_file() else None,
            "verified": verified or None,
            "evidence": {"canonicalPair": "pass" if verified else "none",
                         "projectionReceipt": "pass" if verified else "none"},
        })

    model = {
        "schemaVersion": 2,
        "generatedBy": "skillstead_validate gallery",
        "note": "Generated view. Every field is owned by the manifest, locale catalog, an input "
                "payload, a receipt or an artifact — this file is authority for none of them. `verified` attaches to "
                "the SVG only; PNGs are a present/digest inventory.",
        "runtimeSurfaceDigest": live_digest,
        "tokens": TOKENS_PATH,
        "presentation": {
            "source": LOCALE_PATH,
            "copy": copy,
        },
        "typepackCount": len(entries),
        "typepacks": entries,
        "featured": {
            "source": fx.get("source", "gallery/featured.json"),
            "note": "Editorial selection, transitional for Wave 1. The final composition and any "
                    "unification of the evidence facets are settled after Wave 2 through a "
                    "replacement audition, not automatically — a candidate replaces an entry only "
                    "when a receipt check and a visual audition find it the better showcase, and "
                    "retaining an entry is a valid, recorded outcome. Until then the legacy "
                    "provenance and absent receipt stand as the facets report them.",
            "entries": featured,
        },
        "projectionExamples": {
            "source": PROJECTIONS_PATH,
            "note": "Three selected opt-in derived projection PNGs built from one canonical pair. "
                    "They demonstrate presentation surfaces and do not become canonical artifacts.",
            "canonical": {
                "svg": str(canonical_decl.get("svg") or ""), "svgDigest": canonical_svg_digest,
                "png": str(canonical_decl.get("png") or ""), "pngDigest": canonical_png_digest,
            },
            "entries": projection_entries,
        },
    }
    return model, findings


def run_gallery(repo_root: Path, write: bool = False) -> list[Finding]:
    """`--check` by default; `--write` regenerates. A failing model is never written."""
    root = repo_root.resolve()
    try:
        model, findings = build_model(root)
    except GalleryError as e:
        return [Finding("GAL-BUILD", MODEL_PATH, str(e))]

    if findings:
        # Refusing to write is the point: a model with an unverified example would make the gallery
        # claim something the artifacts do not support.
        return findings

    tokens = _read_json(root / TOKENS_PATH)
    # The model and the page are generated together on purpose: regenerating one and forgetting the
    # other is exactly the drift this command exists to prevent.
    outputs = {
        MODEL_PATH: json.dumps(model, indent=1, ensure_ascii=False) + "\n",
        GALLERY_HTML: render_html(model, tokens),
    }
    # The contact sheet is generated here too, for the same reason the page is: the README's one
    # image and the gallery's Featured section read the same selection, and a sheet regenerated by
    # hand would be the surface most likely to fall behind it. Only the SVG is derived — its PNG is
    # a browser render, kept beside it the way the example PNGs are, and inventoried rather than
    # re-derived on every check.
    for loc in LOCALES:
        rel, _png = sheet_paths(loc)
        outputs[rel] = render_sheet(model, tokens, loc, root)

    # The render receipt is checked in both modes. `--write` can only prove the SVG, so reporting
    # green after regenerating it would hide the case this exists for: a new sheet whose PNG — the
    # thing the README displays — was never re-rendered.
    render = [Finding("GAL-RENDER", rel, detail) for rel, detail in check_render(model, root)]

    if write:
        for rel, text in outputs.items():
            target = root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
        return render

    drift: list[Finding] = list(render)
    for rel, text in outputs.items():
        target = root / rel
        if not target.exists():
            drift.append(Finding("GAL-DRIFT", rel, "missing — regenerate with `gallery --write`"))
        elif target.read_text(encoding="utf-8") != text:
            drift.append(Finding("GAL-DRIFT", rel,
                                 "out of date with the manifest, inputs, receipts, artifacts or "
                                 "tokens (regenerate with `gallery --write`)"))
    return drift
