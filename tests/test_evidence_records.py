"""Strict retirement and major-approval record fixtures."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from skillstead_validate.evidence_records import (  # noqa: E402
    RecordError,
    parse_initial_release_target_record,
    parse_major_approval_record,
    parse_retirement_record,
)


def retirement(**overrides) -> str:
    record = {
        "schema_version": 1,
        "skill": "alpha-skill",
        "last_release_ref": "alpha-skill/v1.2.3",
        "authorization_id": "owner-20260729-0123456789abcdef",
        "approved_at": "2026-07-29",
        "reason": "The maintained replacement now covers this use case.",
        "replacement": None,
    }
    record.update(overrides)
    return json.dumps(record)


def major(**overrides) -> str:
    record = {
        "schema_version": 1,
        "skill": "alpha-skill",
        "previous_ref": "alpha-skill/v1.2.3",
        "proposed_version": "2.0.0",
        "authorization_id": "owner-20260729-fedcba9876543210",
        "approved_at": "2026-07-29",
        "reason": "The version transition intentionally communicates a breaking change.",
    }
    record.update(overrides)
    return json.dumps(record)


def initial_target(**overrides) -> str:
    record = {
        "schema_version": 1,
        "skill": "alpha-skill",
        "version": "0.1.0",
        "target_commit": "a" * 40,
        "authorization_id": "owner-20260830-0123456789abcdef",
        "approved_at": "2026-08-30",
        "reason": "The reviewed amendments are bound to this initial release target.",
    }
    record.update(overrides)
    return json.dumps(record)


class RetirementRecordParsing(unittest.TestCase):
    def test_valid_released_and_unreleased_records(self) -> None:
        released = parse_retirement_record(retirement(), "alpha-skill")
        self.assertEqual(released.last_release_ref, "alpha-skill/v1.2.3")
        unreleased = parse_retirement_record(
            retirement(last_release_ref=None), "alpha-skill")
        self.assertIsNone(unreleased.last_release_ref)

    def test_duplicate_unknown_and_wrong_identity_rejected(self) -> None:
        with self.assertRaises(RecordError):
            parse_retirement_record(
                '{"schema_version":1,"schema_version":1}', "alpha-skill")
        with self.assertRaises(RecordError):
            parse_retirement_record(retirement(extra=True), "alpha-skill")
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(skill="beta-skill"), "alpha-skill")

    def test_authorization_date_and_hygiene_rejected(self) -> None:
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(
                    authorization_id="owner-20260728-0123456789abcdef"),
                "alpha-skill")
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(reason="Approved in PRIVATE-REF-123."),
                "alpha-skill")
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(reason="Approved in private-ref-123."),
                "alpha-skill")
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(reason="See /Users/example/private-note."),
                "alpha-skill")

    def test_replacement_is_reserved_for_later_schema(self) -> None:
        with self.assertRaises(RecordError):
            parse_retirement_record(
                retirement(replacement="beta-skill"), "alpha-skill")


class MajorApprovalRecordParsing(unittest.TestCase):
    def test_valid_record(self) -> None:
        record = parse_major_approval_record(
            major(), "alpha-skill", "2.0.0")
        self.assertEqual(record.previous_ref, "alpha-skill/v1.2.3")

    def test_wrong_version_ref_and_private_reason_rejected(self) -> None:
        with self.assertRaises(RecordError):
            parse_major_approval_record(
                major(proposed_version="3.0.0"),
                "alpha-skill", "2.0.0")
        with self.assertRaises(RecordError):
            parse_major_approval_record(
                major(previous_ref="beta-skill/v1.2.3"),
                "alpha-skill", "2.0.0")
        with self.assertRaises(RecordError):
            parse_major_approval_record(
                major(reason="https://example.invalid/private"),
                "alpha-skill", "2.0.0")

    def test_bool_schema_and_uppercase_token_rejected(self) -> None:
        with self.assertRaises(RecordError):
            parse_major_approval_record(
                major(schema_version=True), "alpha-skill", "2.0.0")
        with self.assertRaises(RecordError):
            parse_major_approval_record(
                major(
                    authorization_id="owner-20260729-FEDCBA9876543210"),
                "alpha-skill", "2.0.0")


class InitialReleaseTargetRecordParsing(unittest.TestCase):
    def test_valid_record(self) -> None:
        record = parse_initial_release_target_record(
            initial_target(), "alpha-skill", "0.1.0")
        self.assertEqual(record.target_commit, "a" * 40)

    def test_wrong_version_target_and_private_reason_rejected(self) -> None:
        for value in (
                initial_target(version="0.2.0"),
                initial_target(target_commit="A" * 40),
                initial_target(target_commit="abc"),
                initial_target(reason="See /Users/example/private-note.")):
            with self.subTest(value=value):
                with self.assertRaises(RecordError):
                    parse_initial_release_target_record(
                        value, "alpha-skill", "0.1.0")


if __name__ == "__main__":
    unittest.main()
