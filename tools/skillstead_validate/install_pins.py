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
    pins: list[Pin] = []
    ambiguous = False
    block: list[str] | None = None
    for line in install_text.splitlines():
        if block is None:
            if _FENCE.match(line):
                block = []
            continue
        if line.strip() == "```":
            clones = [l for l in block if _CLONE_BRANCH.search(l)]
            if clones:
                copy_skills = {m.group(1) for l in block if not _CLONE_BRANCH.search(l)
                               for m in [_COPY_SKILL.search(l)] if m}
                if len(clones) != 1 or len(copy_skills) != 1:
                    ambiguous = True
                else:
                    m = _CLONE_BRANCH.search(clones[0])
                    assert m is not None
                    pins.append(Pin(ref=m.group(1), copy_skill=next(iter(copy_skills))))
            block = None
            continue
        block.append(line)
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
