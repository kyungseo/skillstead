#!/usr/bin/env python3
"""Pinned run of the agent-skills spec reference validator (`skills-ref`).

Procurement facts (the full policy, including replacement conditions, lives in
docs/VALIDATION.md):

* source: https://github.com/agentskills/agentskills — ``skills-ref/`` subdirectory
* pin: exact commit SHA below; upgrades are deliberate, reviewed pin changes
* upstream license: Apache-2.0; upstream describes itself as a
  demonstration-only reference implementation, so it is used strictly as a
  supplementary check
* checked scope: frontmatter required fields and name↔folder agreement only —
  everything beyond that is covered by ``skillstead_validate``

Fail-closed: any procurement or execution failure exits non-zero.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PIN_SHA = "38a2ff82958afee88dadf4831509e6f7e9d8ef4e"
SPEC = f"git+https://github.com/agentskills/agentskills@{PIN_SHA}#subdirectory=skills-ref"


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    skills = sorted(p for p in (repo_root / "skills").iterdir() if p.is_dir())
    if not skills:
        print("run_skills_ref: no packages found under skills/", file=sys.stderr)
        return 1
    # `skills-ref validate` accepts exactly one SKILL_PATH per invocation.
    failures = 0
    for skill in skills:
        cmd = ["pipx", "run", "--spec", SPEC, "skills-ref", "validate", str(skill)]
        try:
            proc = subprocess.run(cmd, check=False)
        except FileNotFoundError:
            print("run_skills_ref: pipx not found (procurement failure, fail-closed)", file=sys.stderr)
            return 1
        if proc.returncode != 0:
            failures += 1
    print(f"run_skills_ref: {len(skills)} package(s), {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
