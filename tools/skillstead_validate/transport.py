"""GitHub Releases transport — separated from the pure evaluator (R0-F4).

The transport owns pagination and the ``releases/latest`` lookup; any
shortfall (mid-page failure, malformed page, non-zero subprocess) raises
TransportError, which the evaluator maps to ``CV-DOMAIN`` (fail-closed).
The evaluator only ever sees a completed, normalized observation.
"""

from __future__ import annotations

import json
import subprocess
import time

PER_PAGE = 100


class TransportError(RuntimeError):
    pass


def _call(runner, args: list[str], deadline: float | None, monotonic) -> str:
    """Run one request, bounded by whatever is left of ``deadline``.

    A deadline that has already passed is not "almost out of time" — it is out
    of time, so the request is never started (fail-closed). When no deadline is
    set the runner keeps its original one-argument shape.
    """
    if deadline is None:
        return runner(args)
    left = deadline - monotonic()
    if left <= 0:
        raise TransportError("deadline exceeded before request")
    return runner(args, timeout=left)


def _default_runner(args: list[str], timeout: float | None = None) -> str:
    try:
        proc = subprocess.run(args, capture_output=True, text=True, check=True,
                              timeout=timeout)
    except FileNotFoundError as e:
        raise TransportError("gh executable not found") from e
    except subprocess.TimeoutExpired as e:
        raise TransportError(f"{' '.join(args)}: timed out after {timeout}s") from e
    except subprocess.CalledProcessError as e:
        raise TransportError(f"{' '.join(args)}: {e.stderr.strip()}") from e
    return proc.stdout


def fetch_releases(repo_slug: str, runner=_default_runner,
                   deadline: float | None = None, monotonic=time.monotonic) -> list[dict]:
    """All release objects, every page walked to exhaustion.

    ``deadline`` is a ``monotonic()`` instant. It is re-checked before *every*
    page: a per-request timeout alone would not bound this loop, because the
    total cost is one timeout per page rather than one per call.
    """
    releases: list[dict] = []
    page = 1
    while True:
        out = _call(runner, ["gh", "api",
                             f"repos/{repo_slug}/releases?per_page={PER_PAGE}&page={page}"],
                    deadline, monotonic)
        try:
            batch = json.loads(out)
        except json.JSONDecodeError as e:
            raise TransportError(f"malformed releases page {page}: {e}") from None
        if not isinstance(batch, list):
            raise TransportError(f"releases page {page} is not an array")
        releases.extend(batch)
        if len(batch) < PER_PAGE:
            return releases
        page += 1


def fetch_latest(repo_slug: str, runner=_default_runner,
                 deadline: float | None = None, monotonic=time.monotonic) -> str | None:
    """``tag_name`` of the repository Latest release, or None when there is
    no release at all (GitHub answers 404)."""
    try:
        out = _call(runner, ["gh", "api", f"repos/{repo_slug}/releases/latest"],
                    deadline, monotonic)
    except TransportError as e:
        if "404" in str(e) or "Not Found" in str(e):
            return None
        raise
    try:
        data = json.loads(out)
    except json.JSONDecodeError as e:
        raise TransportError(f"malformed latest response: {e}") from None
    tag = data.get("tag_name")
    if not isinstance(tag, str):
        raise TransportError("latest response has no tag_name")
    return tag
