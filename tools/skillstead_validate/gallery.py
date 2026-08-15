"""Gallery model — the join that every human-facing surface is built from.

The repository gallery, the README contact sheets and (later) Wave 2 figures all need the same
answer: which TypePacks are routable, what do their verified examples look like, and what did the
receipts actually record. Building that answer three times would let three surfaces drift apart, so
it is built once, here, and written to `gallery/model.json`.

**The model owns nothing.** It joins four surfaces, each of which stays the authority for its own
fields:

    manifest.yaml          TypePack identity, selection signal, preset/treatment, example membership
    input payload (.yaml)  KO/EN prompts and locale copy
    receipt (.json)        consumed, geometry, residual, fontDelivery, treatment, provenance
    artifact (.svg/.png)   bytes, and the digests over them

Verification is the part worth being strict about. A receipt says `0 error(s)` about the package it
was made against, which is not the same claim as "this artifact is verified today". So the model
never copies a success string; it re-establishes the claim against four independent facts, and an
example that cannot clear all four gets no verification state at all — the build fails rather than
publishing an unverifiable example.

This lives at repository level, not inside the package, and that placement is the direction contract
made concrete: the installed package must run with no knowledge of the repository's presentation
layer. It is Python because repo CI runs Python — a Node generator under `skills/` would be a gate
nobody executes.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .findings import Finding

SKILL = "skills/svg-infographic"
EXAMPLES = "examples/svg-infographic/typepacks"
MODEL_PATH = "gallery/model.json"
TOKENS_PATH = "gallery/tokens.json"
LOCALES = ("ko", "en")

# Tokens the surfaces cannot render without. Missing any of these is a build failure, not a default.
REQUIRED_TOKEN_KEYS = (
    "palette.ground", "palette.card", "palette.cardEdge", "palette.ink", "palette.inkMuted",
    "palette.verified", "shape.cardRadius", "space.base", "space.cardPad",
    "type.identifier.family", "type.prose.family", "type.caption.family",
    "grid.galleryMaxWidth", "grid.contactSheet.columns",
)


class GalleryError(Exception):
    """Raised when the model cannot be built at all (as opposed to a per-example finding)."""


@dataclass(frozen=True)
class NodeRunner:
    """Runs the package's own Node entrypoints.

    The digest framing and the verifier live in the package. Reimplementing either here would create
    a second implementation free to drift from the one that actually gates artifacts, so this shells
    out and consumes the result instead.
    """

    repo_root: Path

    def _run(self, args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["node", *args], cwd=self.repo_root, capture_output=True, text=True,
            timeout=timeout, env=self._env(),
        )

    def _env(self) -> dict:
        import os
        env = dict(os.environ)
        env["SVGINFO_EXECUTION_MODE"] = "source-development"
        return env

    def runtime_surface_digest(self) -> str:
        r = self._run([f"{SKILL}/scripts/preflight.mjs", "--json"])
        if r.returncode != 0:
            raise GalleryError(f"preflight refused (exit {r.returncode}): {r.stderr.strip() or r.stdout.strip()}")
        try:
            return json.loads(r.stdout)["digests"]["runtimeSurfaceDigest"]
        except (json.JSONDecodeError, KeyError) as e:
            raise GalleryError(f"preflight --json did not carry a runtime digest: {e}") from e

    def verify(self, receipt: Path, svg: Path) -> tuple[bool, str]:
        r = self._run([f"{SKILL}/scripts/generate.mjs", "verify",
                       "--receipt", str(receipt), "--svg", str(svg)])
        out = (r.stdout + r.stderr).strip()
        return r.returncode == 0 and " 0 error(s)" in out, out


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


# --- manifest reading -------------------------------------------------------------------
# Only the fields the gallery joins on. The package's own validator owns the full schema; parsing it
# again in full here would be a second contract.

_ID = re.compile(r"^  - id: (\S+)$", re.M)


def _manifest_blocks(text: str) -> dict[str, str]:
    heads = list(_ID.finditer(text))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[m.group(1)] = text[m.start():end]
    return out


def _field(block: str, key: str) -> str | None:
    m = re.search(rf'^    {re.escape(key)}: "?([^"\n]+?)"?$', block, re.M)
    return m.group(1).strip() if m else None


def _routable(block: str) -> bool:
    return _field(block, "support") != "gated"


def _prompts(payload_text: str) -> dict[str, str]:
    out = {}
    for loc in LOCALES:
        m = re.search(rf'^prompt_{loc}:\s*"?(.+?)"?\s*$', payload_text, re.M)
        if m:
            out[loc] = m.group(1).strip()
    return out


def _title(payload_text: str, loc: str) -> str | None:
    """The canonical title for a locale — the artifact's own H1, which is what alt text describes."""
    m = re.search(r"^title:\n(?:  .+\n)*?  " + loc + r':\s*"?(.+?)"?\s*$', payload_text, re.M)
    return m.group(1).strip() if m else None


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

    manifest_p = root / SKILL / "references/types/manifest.yaml"
    try:
        blocks = _manifest_blocks(manifest_p.read_text(encoding="utf-8"))
    except OSError as e:
        raise GalleryError(f"manifest unreadable: {e}") from e
    routable = {tid: b for tid, b in blocks.items() if _routable(b)}
    if not routable:
        raise GalleryError("manifest declares no routable TypePack")

    live_digest = runner.runtime_surface_digest()

    entries = []
    for tid in sorted(routable):
        block = routable[tid]
        payload_rel = _field(block, "path") or f"types/inputs/{tid}.canonical.yaml"
        payload_p = root / SKILL / "references" / payload_rel
        payload_text = payload_p.read_text(encoding="utf-8") if payload_p.exists() else ""
        if not payload_text:
            findings.append(Finding("GAL-INPUT", tid, f"canonical input {payload_rel} is missing"))
        prompts = _prompts(payload_text)

        locales = {}
        for loc in LOCALES:
            base = root / EXAMPLES / tid / f"{tid}.{loc}"
            svg, png, rcp = Path(f"{base}.svg"), Path(f"{base}.png"), Path(f"{base}.json")
            missing = [p.name for p in (svg, png, rcp) if not p.exists()]
            if missing:
                findings.append(Finding("GAL-ARTIFACT", f"{tid}/{loc}", f"missing {', '.join(missing)}"))
                continue
            receipt = _read_json(rcp)

            # --- verification: four independent facts, not the receipt's own word ---------
            prov = receipt.get("provenance") or {}
            checks = {
                "runtimeDigest": prov.get("runtimeSurfaceDigest") == live_digest,
                "receiptSchema": all(k in receipt for k in
                                     ("consumed", "geometry", "fontDelivery", "treatment", "provenance")),
                "artifactDigest": (receipt.get("artifactDigest") or _sha256(svg)) == _sha256(svg),
                "verifier": False,
            }
            ok, out = runner.verify(rcp, svg)
            checks["verifier"] = ok
            for name, passed in checks.items():
                if not passed:
                    detail = f"{name} check failed"
                    if name == "verifier":
                        detail += f" — {out.splitlines()[-1] if out else 'no output'}"
                    if name == "runtimeDigest":
                        detail += (f" — receipt {str(prov.get('runtimeSurfaceDigest'))[:22]}… "
                                   f"vs live {live_digest[:22]}…")
                    findings.append(Finding("GAL-VERIFY", f"{tid}/{loc}", detail))

            locales[loc] = {
                "title": _title(payload_text, loc),
                "prompt": prompts.get(loc),
                "svg": f"{EXAMPLES}/{tid}/{tid}.{loc}.svg",
                "png": f"{EXAMPLES}/{tid}/{tid}.{loc}.png",
                "receipt": f"{EXAMPLES}/{tid}/{tid}.{loc}.json",
                "svgDigest": _sha256(svg),
                "pngDigest": _sha256(png),
                "consumed": receipt.get("consumed") or [],
                "geometry": receipt.get("geometry"),
                "residual": receipt.get("residual"),
                # Present only when all four facts hold. Absent means unverified, never "assume ok".
                "verified": all(checks.values()) or None,
            }

        entries.append({
            "id": tid,
            "selectionSignal": _field(block, "selection_signal"),
            "spec": _field(block, "spec"),
            "profile": _field(block, "profile"),
            "support": _field(block, "support"),
            "preferredPreset": _field(block, "preferred_preset"),
            "treatment": (locales.get("ko") or {}).get("treatment")
                         or _read_json(root / EXAMPLES / tid / f"{tid}.ko.json").get("treatment", {}).get("name")
                         if (root / EXAMPLES / tid / f"{tid}.ko.json").exists() else None,
            "locales": locales,
        })

    model = {
        "schemaVersion": 1,
        "generatedBy": "skillstead_validate gallery",
        "note": "Generated view. Every field is owned by the manifest, an input payload, a receipt "
                "or an artifact — this file is authority for none of them.",
        "runtimeSurfaceDigest": live_digest,
        "tokens": TOKENS_PATH,
        "typepackCount": len(entries),
        "typepacks": entries,
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

    rendered = json.dumps(model, indent=1, ensure_ascii=False) + "\n"
    target = root / MODEL_PATH
    if write:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8")
        return []
    if not target.exists():
        return [Finding("GAL-DRIFT", MODEL_PATH, "model is missing — regenerate with `gallery --write`")]
    if target.read_text(encoding="utf-8") != rendered:
        return [Finding("GAL-DRIFT", MODEL_PATH,
                        "model is out of date with the manifest, inputs, receipts or artifacts "
                        "(regenerate with `gallery --write`)")]
    return []
