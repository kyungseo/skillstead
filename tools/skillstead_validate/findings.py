"""Finding model shared by all validator modes."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Finding:
    check: str      # stable check id, e.g. "I-1", "LICENSE-BYTES", "PARSE"
    subject: str    # skill name or repo-relative path
    detail: str

    def __str__(self) -> str:
        return f"[{self.check}] {self.subject}: {self.detail}"
