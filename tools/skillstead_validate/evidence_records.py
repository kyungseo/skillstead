"""Strict tracked evidence for retirement and major-version transitions.

The records are durable repository declarations, not cryptographic identity
proof. Shape, target binding, public-safe identifiers, and repository history
are validator-owned; actor identity remains an owner-controlled review/merge
boundary.
"""

from __future__ import annotations

import datetime as _datetime
import json
import re
from dataclasses import dataclass


RETIREMENT_DIR = ".skillstead/retirements"
MAJOR_APPROVAL_DIR = ".skillstead/major-approvals"
RESERVED_SKILL_NAMES = frozenset({"sample-skill"})

_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
_AUTH_RE = re.compile(r"^owner-(\d{8})-([0-9a-f]{16})$")
_TRACKER_RE = re.compile(
    r"\b(?:(?:DR|FEAT|PATCH|HOTFIX|CHORE)-\d{8}-\d+|PRIVATE-REF-\d+)\b",
    re.IGNORECASE)
_LOCAL_PATH_RE = re.compile(r"(?:/Users/|/home/|[A-Za-z]:[\\/])")
_URL_RE = re.compile(r"(?:https?://|git@)\S+")


class RecordError(ValueError):
    """A tracked evidence record is malformed or violates public hygiene."""


@dataclass(frozen=True)
class RetirementRecord:
    skill: str
    last_release_ref: str | None
    authorization_id: str
    approved_at: str
    reason: str


@dataclass(frozen=True)
class MajorApprovalRecord:
    skill: str
    previous_ref: str
    proposed_version: str
    authorization_id: str
    approved_at: str
    reason: str


def _no_duplicates(pairs: list[tuple[str, object]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        if key in result:
            raise RecordError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _load_object(text: str) -> dict:
    try:
        raw = json.loads(text, object_pairs_hook=_no_duplicates)
    except (json.JSONDecodeError, RecordError) as error:
        raise RecordError(str(error)) from None
    if not isinstance(raw, dict):
        raise RecordError("record must be a JSON object")
    return raw


def _require_exact_keys(raw: dict, expected: set[str]) -> None:
    actual = set(raw)
    if actual != expected:
        raise RecordError(
            f"record keys {sorted(actual)} != required keys {sorted(expected)}")


def _require_schema_and_identity(raw: dict, expected_skill: str) -> None:
    version = raw["schema_version"]
    if not isinstance(version, int) or isinstance(version, bool) or version != 1:
        raise RecordError("schema_version must be integer 1")
    skill = raw["skill"]
    if not isinstance(skill, str) or not _NAME_RE.fullmatch(skill):
        raise RecordError("skill must use lowercase-hyphen identity grammar")
    if skill != expected_skill:
        raise RecordError(
            f"record skill {skill!r} != path identity {expected_skill!r}")


def _require_authorization(raw: dict) -> tuple[str, str]:
    approved_at = raw["approved_at"]
    if not isinstance(approved_at, str):
        raise RecordError("approved_at must be a YYYY-MM-DD string")
    try:
        parsed = _datetime.date.fromisoformat(approved_at)
    except ValueError:
        raise RecordError("approved_at must be a valid YYYY-MM-DD date") from None
    if parsed.isoformat() != approved_at:
        raise RecordError("approved_at must use canonical YYYY-MM-DD form")

    authorization_id = raw["authorization_id"]
    if not isinstance(authorization_id, str):
        raise RecordError("authorization_id must be a string")
    match = _AUTH_RE.fullmatch(authorization_id)
    if match is None:
        raise RecordError(
            "authorization_id must match owner-YYYYMMDD-<16 lowercase hex>")
    if match.group(1) != approved_at.replace("-", ""):
        raise RecordError("authorization_id date must match approved_at")

    reason = raw["reason"]
    if not isinstance(reason, str) or not reason.strip():
        raise RecordError("reason must be a non-empty string")
    if _TRACKER_RE.search(reason):
        raise RecordError("reason must not contain private tracker identifiers")
    if _LOCAL_PATH_RE.search(reason):
        raise RecordError("reason must not contain local absolute paths")
    if _URL_RE.search(reason):
        raise RecordError("reason must not contain repository or external URLs")
    return authorization_id, approved_at


def parse_retirement_record(
        text: str, expected_skill: str) -> RetirementRecord:
    raw = _load_object(text)
    _require_exact_keys(raw, {
        "schema_version", "skill", "last_release_ref", "authorization_id",
        "approved_at", "reason", "replacement",
    })
    _require_schema_and_identity(raw, expected_skill)
    authorization_id, approved_at = _require_authorization(raw)

    last_release_ref = raw["last_release_ref"]
    if last_release_ref is not None:
        expected_prefix = f"{expected_skill}/v"
        if not isinstance(last_release_ref, str) \
                or not last_release_ref.startswith(expected_prefix) \
                or not _VERSION_RE.fullmatch(
                    last_release_ref[len(expected_prefix):]):
            raise RecordError(
                "last_release_ref must be null or <skill>/vMAJOR.MINOR.PATCH")
    if raw["replacement"] is not None:
        raise RecordError("replacement must be null in v1")

    return RetirementRecord(
        skill=expected_skill,
        last_release_ref=last_release_ref,
        authorization_id=authorization_id,
        approved_at=approved_at,
        reason=raw["reason"].strip(),
    )


def parse_major_approval_record(
        text: str, expected_skill: str,
        expected_version: str) -> MajorApprovalRecord:
    raw = _load_object(text)
    _require_exact_keys(raw, {
        "schema_version", "skill", "previous_ref", "proposed_version",
        "authorization_id", "approved_at", "reason",
    })
    _require_schema_and_identity(raw, expected_skill)
    authorization_id, approved_at = _require_authorization(raw)

    previous_ref = raw["previous_ref"]
    expected_prefix = f"{expected_skill}/v"
    if not isinstance(previous_ref, str) \
            or not previous_ref.startswith(expected_prefix) \
            or not _VERSION_RE.fullmatch(previous_ref[len(expected_prefix):]):
        raise RecordError(
            "previous_ref must be <skill>/vMAJOR.MINOR.PATCH")
    proposed_version = raw["proposed_version"]
    if not isinstance(proposed_version, str) \
            or not _VERSION_RE.fullmatch(proposed_version):
        raise RecordError("proposed_version must be MAJOR.MINOR.PATCH")
    if proposed_version != expected_version:
        raise RecordError(
            f"proposed_version {proposed_version!r} != path version "
            f"{expected_version!r}")

    return MajorApprovalRecord(
        skill=expected_skill,
        previous_ref=previous_ref,
        proposed_version=proposed_version,
        authorization_id=authorization_id,
        approved_at=approved_at,
        reason=raw["reason"].strip(),
    )


def retirement_path(skill: str) -> str:
    return f"{RETIREMENT_DIR}/{skill}.json"


def major_approval_path(skill: str, version: str) -> str:
    return f"{MAJOR_APPROVAL_DIR}/{skill}-v{version}.json"
