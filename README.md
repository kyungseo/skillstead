# Skillstead

**English** · [한국어](./README.ko.md)

Practical, portable skills for agentic coding workflows — create clearer artifacts, check public claims,
and guide safer GitHub releases.

> [!TIP]
> **Skillstead = skill + homestead.** A small, durable place for skills that coding agents can carry into
> real repositories. Each public support claim is tied to examples and runtime evidence.

[![Skillstead catalog impact map](./examples/catalog-overview.en.png)](./examples/catalog-overview.en.svg)

## Choose a skill

| Priority | Skill | Best for | Runtime support | Maturity |
| --- | --- | --- | --- | --- |
| 1 | [`svg-infographic`](./skills/svg-infographic) | Turning architecture notes, process flows, comparisons, and technical concepts into editable SVG + verified 2× PNG | Claude Code | Stable |
| 2 | [`docs-claim-check`](./skills/docs-claim-check) | Checking whether public documentation claims are supported by supplied evidence | Claude Code | Beta |
| 3 | [`github-release-guide`](./skills/github-release-guide) | Guiding a private repository's first public transition and every later version release, with separate approval before each change | Pending: Claude Code + Codex | Beta |

Install any skill by copying its complete folder into the runtime's skill directory. See
[`docs/INSTALL.md`](./docs/INSTALL.md) for global/project paths, pinned tags, clean updates, Windows commands,
and the per-skill runtime matrix.

## 1. svg-infographic

Technical diagrams often begin as prose and end as hard-to-edit screenshots. `svg-infographic` computes a
layout before drawing, authors structured SVG, checks the source, then exports a dimension-verified 2× PNG.

Use it for architecture and cloud topology, process or approval flows, before/after migrations, roadmaps,
layer models, qualitative matrices, and Korean/CJK-ready technical one-pagers.

- Detail: [`skills/svg-infographic`](./skills/svg-infographic)
- Impact visual: [14-example English/Korean gallery](./examples/svg-infographic)
- Example prompt: `Use svg-infographic to turn this migration plan into an editable technical infographic.`

## 2. docs-claim-check

Release-facing docs can sound certain even when their evidence is partial or stale. `docs-claim-check` splits
objective statements into atomic claims and labels each one `verified`, `unsupported`, `stale-suspected`, or
`needs-human` within an explicit reviewed-input scope.

Use it before publishing a README, install guide, release note, or announcement. It is advisory only: the
contract runs no commands during assessment and does not generate fixes, code review, or security verdicts.

- Detail: [`skills/docs-claim-check`](./skills/docs-claim-check)
- Impact visual: [synthetic AcmeTask fixture and worked assessment](./examples/docs-claim-check)
- Example prompt: `Use docs-claim-check to assess these release-note claims against the supplied tag and CI evidence.`

## 3. github-release-guide

GitHub releases combine documentation work with changes to visibility, branches, tags, settings, and GitHub
Releases that can be difficult to undo. `github-release-guide` first checks readiness without changing the
repository. It then shows each proposed change, checks the current state again, asks for direct approval, and
verifies the result before moving on.

V1 can be used at two points: when an existing private github.com repository becomes public for the first time,
and whenever that public repository publishes a new version afterward. It does not bootstrap repositories,
publish packages, sign binaries, deploy cloud services, claim a security audit, force-push, or rewrite history.

| Choose the mode and profile | Follow the approval safety loop |
| --- | --- |
| [![Choose Assess or Guided, then choose first-public or version-release](./examples/github-release-guide/mode-profile-map/mode-profile-map.en.png)](./examples/github-release-guide/mode-profile-map/mode-profile-map.en.svg) | [![How one repository change is previewed, rechecked, approved, carried out, and verified](./examples/github-release-guide/approval-safety-loop/approval-safety-loop.en.png)](./examples/github-release-guide/approval-safety-loop/approval-safety-loop.en.svg) |

- Friendly guide: [`github-release-guide` README](./skills/github-release-guide/README.md)
- Validation material and diagrams: [synthetic scenarios, answer key, and worked outputs](./examples/github-release-guide)
- Assess example: `Use github-release-guide in Assess mode for this public repository's upcoming version release.`
- Guided example: `Use github-release-guide in Guided mode to prepare this private repository for first publication. Start with Assess, then show only the first proposed change. Do not change the repository until I approve that exact step.`
- Safety boundary: immediately before a repository becomes public, the guide explains what cannot be undone and
  asks the user to approve that visibility change separately. The release decision remains with the user.

## Quality and evidence bar

Every public skill must have:

- a clear description of what it does and does not do,
- synthetic, non-client validation material,
- runtime support and maturity labels limited to what was actually tested,
- public paths free of credentials, private provenance, and host-specific data,
- and a repeatable validation path appropriate to its output.

Runtime support is per skill, not catalog-wide. Claude Code support for the first two skills is unchanged.
`github-release-guide` has passed clean Claude Code/Codex material-parity checks and the disposable
first-public live E2E. It remains `Pending` until pinned `v0.5.0` install verification and the final strict
claim audit are complete.

## Current limitations

- `svg-infographic` browser rendering is verified on macOS; Windows/Linux render paths remain documented but
  unverified.
- `docs-claim-check` is advisory and evidence-bound; it does not execute verification commands.
- `github-release-guide` v1 is github.com-only. It covers the one-time private-to-public transition and each
  version release after the repository is public.
- A clean release or secret scan is best-effort, not proof that a repository has no security risk.

## License

[Apache-2.0](./LICENSE).
