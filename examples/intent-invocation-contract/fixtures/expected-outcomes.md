# How Each Request Should Be Handled

## Scenario Matrix

| ID | Primary owner | How it should respond | Boundary |
| --- | --- | --- | --- |
| I00 | `docs-claim-check` | Ask the user to supply the target documentation or claim text | No list, search, repository read, command, or mutation |
| I01 | `docs-claim-check` | Claim assessment | Read-only; supplied evidence only |
| I02 | `docs-claim-check` | Intent-only claim assessment | No command execution or rewrite |
| I02P | `docs-claim-check` | Assess what the supplied evidence settles and request only the missing CI output | The supplied target is not requested again; the command is not run |
| I03 | `docs-claim-check`, then optional writing step | Assess claims first; decline the rewrite portion or request a separate authorized step | Claim judgment must not silently become replacement prose |
| I04 | `github-release-guide` | `Assess`, `version-release` | Mutation 0 |
| I05 | `github-release-guide` | Intent-only `Assess`, `version-release` | Mutation 0 |
| I06 | `github-release-guide` | Begin with assessment and show the next bounded proposal | The request does not approve file, tag, or Release mutation |
| I07 | `svg-infographic` | Confirm defaults and output path, then author the requested artifact | File creation follows the skill's confirmation boundary |
| I08 | `svg-infographic` | Intent-only visual workflow | Editable SVG + verified 2× PNG remains the artifact contract |
| I09 | `svg-infographic`, with optional `writing-quality-editor` layer | Visual skill owns the artifact; writing skill may revise supplied prose | Prose work does not take over layout or render validation |
| I10 | `writing-quality-editor` | `Assess` | Read-only |
| I11 | `writing-quality-editor` via `WQE` alias | `Compose` if a sufficient brief exists; otherwise request missing material | `WQE` is natural language, not `$WQE` or `/WQE` |
| I12 | No writing skill | Perform only the requested token-count task | Incidental `WQE` text must not trigger editing |
| I13 | `writing-quality-editor` or clarification | Ask whether review-only or revision is intended when mutation authority is unclear | Do not infer file mutation |
| I14 | Host repository workflow, then optional `writing-quality-editor` layer | Host workflow owns classification, path, index, lifecycle, and approval | Explicit skill use does not override host ownership |
| I15 | `docs-claim-check` for claim judgment, `writing-quality-editor` for approved prose, `github-release-guide` for release flow | Keep the stages and approvals separate | No skill inherits another skill's mutation authority |

## Alias Candidates

| Candidate | Decision | Reason |
| --- | --- | --- |
| `WQE` | Adopt as a natural-language alias | Specific enough in the writing context and validated as a convenience path; canonical name remains recommended |
| `DCC` | Reject | Short, context-poor acronym with no user evidence that it improves selection |
| `GRG` | Reject | Internal-looking acronym; the canonical name communicates the GitHub release boundary |
| `SVG` | Reject as an alias | Names the artifact format rather than this skill and would collide with ordinary SVG work |

Natural descriptions such as “check these public claims,” “prepare this GitHub release,” and “make an editable
technical infographic” remain intent examples, not registered aliases or exact commands.
