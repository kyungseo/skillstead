"""INSTALL pin inventory (DR-819 D8-2).

Parsing boundary fixed by the DR: only ``bash``/``powershell`` fenced blocks
are examined; each candidate block must pair exactly one ``git clone`` with
exactly one ``skills/<skill>`` copy source; any ambiguity classifies the
whole inventory as ``PIN-OTHER``; prose ``--branch`` mentions are ignored.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

LEGACY_PIN = "v0.8.0"
BASELINE_PIN = "github-release-guide/v0.8.0"
BASELINE_PIN_COUNT = 7

_FENCE = re.compile(r"^```(bash|powershell)\s*$")
_CLONE_BRANCH = re.compile(r"\bgit\s+clone\b.*?--branch\s+(\S+)")
_COPY_SKILL = re.compile(r"skills[/\\]([a-z0-9][a-z0-9-]*)")
_NAMESPACED = re.compile(r"^([a-z0-9][a-z0-9-]*)/v(\d+)\.(\d+)\.(\d+)$")


@dataclass(frozen=True)
class Pin:
    ref: str
    copy_skill: str


@dataclass(frozen=True)
class PinInventory:
    pins: tuple[Pin, ...]
    ambiguous: bool  # any candidate block that could not be paired


def parse_pins(install_text: str) -> PinInventory:
    """Candidate block = a fenced bash/powershell block containing a
    ``git clone`` line (with or without ``--branch`` — an unsupported clone
    is ambiguity, not silence). Copy-only blocks (e.g. uninstall paths that
    mention ``skills/<name>``) carry no pin and are not candidates. Any
    candidate that fails the exact one-supported-clone + one-copy-line
    pairing, and any unclosed candidate fence, marks the inventory
    ambiguous (→ PIN-OTHER)."""
    pins: list[Pin] = []
    ambiguous = False
    block: list[str] | None = None

    def process(lines: list[str]) -> None:
        nonlocal ambiguous
        clone_lines = [l for l in lines if "git clone" in l]
        if not clone_lines:
            return
        supported = [l for l in clone_lines if _CLONE_BRANCH.search(l)]
        copy_lines = [m for l in lines if l not in clone_lines
                      for m in [_COPY_SKILL.search(l)] if m]
        if len(clone_lines) != 1 or len(supported) != 1 or len(copy_lines) != 1:
            ambiguous = True
            return
        m = _CLONE_BRANCH.search(supported[0])
        assert m is not None
        pins.append(Pin(ref=m.group(1), copy_skill=copy_lines[0].group(1)))

    for line in install_text.splitlines():
        if block is None:
            if _FENCE.match(line):
                block = []
            continue
        if line.strip() == "```":
            process(block)
            block = None
            continue
        block.append(line)
    if block is not None and any("git clone" in l for l in block):
        ambiguous = True  # unclosed candidate fence
    return PinInventory(pins=tuple(pins), ambiguous=ambiguous)


def classify(inventory: PinInventory, ref_exists_on_main) -> str:
    """Return one of PIN-LEGACY / PIN-BASELINE / PIN-NAMESPACED / PIN-OTHER.

    ``ref_exists_on_main(tag_name) -> bool`` supplies the git observation so
    this stays pure. PIN-BASELINE also satisfies PIN-NAMESPACED by the DR's
    definitions; classification returns the most specific label first.
    """
    if inventory.ambiguous or not inventory.pins:
        return "PIN-OTHER"
    pins = inventory.pins
    if len(pins) == BASELINE_PIN_COUNT and all(p.ref == LEGACY_PIN for p in pins):
        return "PIN-LEGACY"
    if len(pins) == BASELINE_PIN_COUNT and all(p.ref == BASELINE_PIN for p in pins):
        return "PIN-BASELINE"
    for p in pins:
        m = _NAMESPACED.match(p.ref)
        if not m or m.group(1) != p.copy_skill or not ref_exists_on_main(p.ref):
            return "PIN-OTHER"
    return "PIN-NAMESPACED"
