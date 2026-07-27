"""Skillstead validation toolchain (C3).

Python 3.11+ standard library only. All judgment logic fails closed: anything
this package cannot parse or observe is reported as a finding, never skipped.
"""

SEMVER_RE = r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$"
