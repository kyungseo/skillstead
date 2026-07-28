# Intent And Invocation Contract

**English** · [한국어](./README.ko.md)

These repository-only validation scenarios (fixtures) check how Skillstead's four independent skills should
respond when users name a skill, ask naturally, use the `WQE` shorthand, omit required input, or combine more
than one kind of work.

They do not define a keyword command grammar. Runtime and model behavior can vary, so the canonical skill name is
the most predictable choice. Natural-language selection is acceptable when the selected workflow preserves the
same read-only, mutation, approval, and artifact-ownership boundaries.

## Files

- [`fixtures/scenarios.md`](./fixtures/scenarios.md) — sanitized prompts
- [`fixtures/expected-outcomes.md`](./fixtures/expected-outcomes.md) — how each request should be handled
- [`fixtures/validation-evidence.md`](./fixtures/validation-evidence.md) — evidence-bounded runtime summary

These fixtures are not copied with an installed skill package.
