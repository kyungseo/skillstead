# sample-skill

**English** · [한국어](./README.ko.md)

This is a concrete, validator-compatible authoring template—not an installable catalog skill. Replace every
`sample-skill` identity, rewrite the intent and procedure, and copy the repository root license byte-for-byte
before materializing it under `skills/`.

From the target repository root, validate the materialized disposable repository with its production M1 command
(`PYTHONPATH=tools python3 -m skillstead_validate repo` in Skillstead). The active inventory rejects the reserved
`sample-skill` name.
