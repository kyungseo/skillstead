"""Release-only gate for svg-infographic canonical artifacts.

Normal local generation may record a dirty source-development tree. A release candidate may not.
This gate binds the exact canonical inventory to one clean source commit, checks an out-of-tree
staging directory before copy, and can then compare those bytes with the repository and the final
artifact commit. It never generates, copies, commits or tags anything.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import struct
import subprocess
from pathlib import Path

from .findings import Finding


EXAMPLES = Path("examples/svg-infographic/typepacks")
DERIVED_OUTPUTS = {"gallery/model.json", "gallery/index.html"}
CONTACT_SHEET = {
    "gallery/contact-sheet.ko.svg", "gallery/contact-sheet.ko.png",
    "gallery/contact-sheet.en.svg", "gallery/contact-sheet.en.png",
    "gallery/contact-sheet.render.json",
}
LOCALES = ("ko", "en")
EXTENSIONS = ("svg", "json", "png")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")


def _sha(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)


def _source_blob(repo: Path, source_commit: str, rel: str) -> bytes | None:
    result = subprocess.run(
        ["git", "show", f"{source_commit}:{rel}"], cwd=repo, capture_output=True,
    )
    return result.stdout if result.returncode == 0 else None


def _png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", data[16:24])


def _svg_size(path: Path) -> tuple[int, int]:
    head = path.read_text(encoding="utf-8")[:800]
    match = re.search(r'viewBox="[^" ]+ [^" ]+ ([0-9.]+) ([0-9.]+)"', head)
    if not match:
        raise ValueError("SVG has no numeric viewBox")
    return round(float(match.group(1))), round(float(match.group(2)))


def expected_inventory(typepack_ids: set[str]) -> set[str]:
    return {
        (EXAMPLES / tid / f"{tid}.{loc}.{ext}").as_posix()
        for tid in typepack_ids for loc in LOCALES for ext in EXTENSIONS
    }


def _observed_inventory(root: Path) -> set[str]:
    base = root / EXAMPLES
    if not base.exists():
        return set()
    return {p.relative_to(root).as_posix() for p in base.rglob("*") if p.is_file()}


def _typepack_ids(repo: Path) -> set[str]:
    result = subprocess.run(
        ["node", "tools/gallery_export.mjs", "--repo-root", "."], cwd=repo,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise ValueError(f"gallery exporter failed: {(result.stderr or result.stdout).strip()}")
    return {str(p["id"]) for p in json.loads(result.stdout).get("typepacks") or []}


def _runtime_digest(repo: Path) -> str:
    env = dict(os.environ)
    env["SVGINFO_EXECUTION_MODE"] = "source-development"
    result = subprocess.run(
        ["node", "skills/svg-infographic/scripts/preflight.mjs", "--json"], cwd=repo,
        capture_output=True, text=True, env=env,
    )
    if result.returncode != 0:
        raise ValueError(f"package preflight failed: {(result.stderr or result.stdout).strip()}")
    return str(json.loads(result.stdout)["digests"]["runtimeSurfaceDigest"])


def check_release_artifacts(
    repo: Path,
    staging: Path,
    source_commit: str,
    *,
    compare_repository: bool = False,
    artifact_commit: str | None = None,
    typepack_ids: set[str] | None = None,
    runtime_digest: str | None = None,
    verify_pairs: bool = True,
) -> list[Finding]:
    """Return findings without mutation. Test-only overrides avoid reimplementing repo fixtures."""
    repo, staging = repo.resolve(), staging.resolve()
    findings: list[Finding] = []
    if not COMMIT_RE.fullmatch(source_commit):
        return [Finding("SVG-REL-SOURCE", source_commit, "source commit must be a full 40-hex id")]
    if _git(repo, "cat-file", "-e", f"{source_commit}^{{commit}}").returncode != 0:
        findings.append(Finding("SVG-REL-SOURCE", source_commit, "source commit is not observable"))

    try:
        ids = typepack_ids if typepack_ids is not None else _typepack_ids(repo)
        live_digest = runtime_digest if runtime_digest is not None else _runtime_digest(repo)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        return findings + [Finding("SVG-REL-OBSERVE", "svg-infographic", str(error))]
    expected = expected_inventory(ids)
    if len(expected) != 54:
        findings.append(Finding("SVG-REL-INVENTORY", str(staging),
                                f"canonical inventory must contain exactly 54 files, got {len(expected)}"))
    observed = _observed_inventory(staging)
    if observed != expected:
        findings.append(Finding(
            "SVG-REL-INVENTORY", str(staging),
            f"staging inventory differs (missing={sorted(expected - observed)}, "
            f"extra={sorted(observed - expected)})"))

    for tid in sorted(ids):
        for loc in LOCALES:
            rel = EXAMPLES / tid / f"{tid}.{loc}"
            svg, receipt, png = staging / f"{rel}.svg", staging / f"{rel}.json", staging / f"{rel}.png"
            if not svg.is_file() or not receipt.is_file() or not png.is_file():
                continue
            try:
                doc = json.loads(receipt.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                findings.append(Finding("SVG-REL-RECEIPT", str(receipt), f"unreadable: {error}"))
                continue
            prov = doc.get("provenance") or {}
            source = prov.get("source") or {}
            checks = {
                "provenance canonicalization": (prov.get("schema") or {}).get("canonicalization") == 2,
                "surface revision": (prov.get("package") or {}).get("surfaceRevision") == 17,
                "execution mode": prov.get("executionMode") == "source-development",
                "runtime digest": prov.get("runtimeSurfaceDigest") == live_digest,
                "source head": source.get("headCommit") == source_commit,
                "repoDirty": source.get("repoDirty") is False,
                "runtimeSurfaceDirty": source.get("runtimeSurfaceDirty") is False,
                "artifact digest": doc.get("artifactDigest") == _sha(svg),
            }
            for label, passed in checks.items():
                if not passed:
                    findings.append(Finding("SVG-REL-RECEIPT", f"{tid}/{loc}", f"{label} check failed"))
            if verify_pairs:
                env = dict(os.environ)
                env["SVGINFO_EXECUTION_MODE"] = "source-development"
                verified = subprocess.run(
                    ["node", "skills/svg-infographic/scripts/generate.mjs", "verify",
                     "--receipt", str(receipt), "--svg", str(svg)],
                    cwd=repo, capture_output=True, text=True, env=env,
                )
                if verified.returncode != 0 or " 0 error(s)" not in (verified.stdout + verified.stderr):
                    findings.append(Finding("SVG-REL-VERIFY", f"{tid}/{loc}",
                                            "package verifier rejected the staged pair"))
                try:
                    sw, sh = _svg_size(svg)
                    pw, ph = _png_size(png)
                    if (pw, ph) != (sw * 2, sh * 2):
                        findings.append(Finding(
                            "SVG-REL-PNG", f"{tid}/{loc}",
                            f"PNG dimensions {pw}x{ph} != 2x SVG viewBox {sw}x{sh}"))
                except (OSError, UnicodeDecodeError, ValueError) as error:
                    findings.append(Finding("SVG-REL-PNG", f"{tid}/{loc}", str(error)))

    if compare_repository:
        repo_observed = _observed_inventory(repo)
        if repo_observed != expected:
            findings.append(Finding("SVG-REL-COPY", str(repo / EXAMPLES),
                                    "repository canonical inventory is not the exact 54-file set"))
        for rel in sorted(expected & observed & repo_observed):
            if _sha(staging / rel) != _sha(repo / rel):
                findings.append(Finding("SVG-REL-COPY", rel, "staging and repository bytes differ"))

    if artifact_commit is not None:
        if not COMMIT_RE.fullmatch(artifact_commit):
            findings.append(Finding("SVG-REL-COMMIT", artifact_commit,
                                    "artifact commit must be a full 40-hex id"))
        elif _git(repo, "merge-base", "--is-ancestor", source_commit, artifact_commit).returncode != 0:
            findings.append(Finding("SVG-REL-COMMIT", artifact_commit,
                                    "artifact commit is not a descendant of the source commit"))
        else:
            changed = set(_git(repo, "diff", "--name-only", source_commit, artifact_commit).stdout.splitlines())
            allowed = expected | DERIVED_OUTPUTS
            required = {
                rel for rel in expected
                if _source_blob(repo, source_commit, rel) != (staging / rel).read_bytes()
            }
            missing = required - changed
            extra = changed - allowed
            if missing or extra:
                findings.append(Finding(
                    "SVG-REL-COMMIT", artifact_commit,
                    f"artifact commit delta differs (missing={sorted(missing)}, "
                    f"extra={sorted(extra)})"))
            if any(path.startswith("skills/svg-infographic/") for path in changed):
                findings.append(Finding("SVG-REL-RUNTIME", artifact_commit,
                                        "artifact commit changes the package runtime surface"))
            contact_changed = changed & CONTACT_SHEET
            if contact_changed:
                findings.append(Finding("SVG-REL-CONTACT", artifact_commit,
                                        f"contact sheet must remain byte-stable: {sorted(contact_changed)}"))
    return findings
