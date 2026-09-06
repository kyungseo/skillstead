# Intent And Invocation Contract

**English** · [한국어](./README.ko.md)

These repository-only validation scenarios cover four skills: `svg-infographic`, `docs-claim-check`,
`github-release-guide`, and `writing-quality-editor`. They check responses to named and natural requests, the
`WQE` shorthand, missing input, and combined tasks. For `street-portrait-artist`, see its
[separate examples](../street-portrait-artist/README.md).

They do not define a keyword command grammar. Runtime and model behavior can vary, so the canonical skill name is
the most predictable choice. Natural-language selection is acceptable when the selected workflow preserves the
same read-only, mutation, approval, and artifact-ownership boundaries.

## Files

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — sanitized prompts
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — how each request should be handled
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — evidence-bounded runtime summary

These fixtures are not copied with an installed skill package.
