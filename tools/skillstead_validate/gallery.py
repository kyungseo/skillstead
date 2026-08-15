"""Gallery model — the join that every human-facing surface is built from.

The repository gallery, the README contact sheets and (later) Wave 2 figures all need the same
answer: which TypePacks are routable, what do their verified examples look like, and what did the
receipts actually record. Building that answer three times would let three surfaces drift apart, so
it is built once, here, and written to `gallery/model.json`.

**The model owns nothing.** It joins four surfaces, each of which stays the authority for its own
fields:

    manifest.yaml          TypePack identity, selection signal, presets, declared fit boundaries
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

**What carries the claim.** Verification attaches to the **SVG**, because that is what the verifier
re-checks. The PNG is a render of it, and re-rendering then rebuilding the model would happily bless
whatever bytes were produced. PNGs are therefore recorded as a present/digest inventory and are
never described as verified. Promoting them needs a render-evidence contract that does not exist
yet; CP3D's contact sheets will own their own render and staleness gate.

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

from .findings import Finding
from .gallery_html import GALLERY_HTML, render as render_html

SKILL = "skills/svg-infographic"
EXAMPLES = "examples/svg-infographic/typepacks"
MODEL_PATH = "gallery/model.json"
TOKENS_PATH = "gallery/tokens.json"
EXPORTER = "tools/gallery_export.mjs"
LOCALES = ("ko", "en")

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

    def source_gates(self, svg: Path) -> tuple[bool, str]:
        """The three checks any artifact must pass regardless of how it was authored.

        Featured examples predate the TypePack receipts, so this is the whole of what can be
        claimed about them — which makes running it, rather than asserting it, the point.
        """
        for tool, args in ((f"{SKILL}/scripts/check-svg.mjs", []),
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
    """Join the four surfaces into the generated view. Findings are fatal to the build."""
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
            ok, why = runner.source_gates(svg)
            if not ok:
                gates_ok = False
                detail = why
                findings.append(Finding("GAL-FEATURED", f'{entry["slug"]}/{loc}',
                                        f"source gates failed — {why}"))
            arts[loc] = {"svg": rel, "svgDigest": _sha256(svg)}
        featured.append({
            "slug": entry["slug"], "name": entry.get("name"), "caption": entry.get("caption"),
            "reason": entry.get("reason"),
            "artifacts": arts,
            # Hand-authored, predating the TypePack receipts: the gates are the whole claim.
            "evidence": _facets("pass" if gates_ok else "none",
                                "pass" if entry.get("hasReceipt") else "none"),
        })

    model = {
        "schemaVersion": 1,
        "generatedBy": "skillstead_validate gallery",
        "note": "Generated view. Every field is owned by the manifest, an input payload, a receipt "
                "or an artifact — this file is authority for none of them. `verified` attaches to "
                "the SVG only; PNGs are a present/digest inventory.",
        "runtimeSurfaceDigest": live_digest,
        "tokens": TOKENS_PATH,
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

    if write:
        for rel, text in outputs.items():
            target = root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
        return []

    drift: list[Finding] = []
    for rel, text in outputs.items():
        target = root / rel
        if not target.exists():
            drift.append(Finding("GAL-DRIFT", rel, "missing — regenerate with `gallery --write`"))
        elif target.read_text(encoding="utf-8") != text:
            drift.append(Finding("GAL-DRIFT", rel,
                                 "out of date with the manifest, inputs, receipts, artifacts or "
                                 "tokens (regenerate with `gallery --write`)"))
    return drift
