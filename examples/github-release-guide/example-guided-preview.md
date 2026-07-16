# Worked example — visibility mutation preview

Synthetic input: first-public release after all earlier units passed and immediately before visibility change.

## Mutation Preview

- Approval unit: Repository visibility change
- Exact target: `northwind-labs/fieldnotes-fixture`, private → public
- Action: Change only repository visibility to public. No settings or GitHub Release mutation is bundled.
- Impact: Anyone can view and clone the repository. Returning it to private cannot recall clones, forks,
  caches, screenshots, or copied content. Secret and history scans were best-effort, not proof of no exposure.
- Preconditions rechecked: Repository identity, private visibility, default branch, reviewed remote head,
  release tag target, pinned install result, and critical-alert state still match the approved release state.
- Verification: Confirm public visibility through GitHub, perform a fresh unauthenticated clone, and inspect
  the rendered README and pinned links before proposing any settings change.
- Failure state: Visibility may become public even if a later clone or settings check fails. That is partial
  release state and execution must stop.
- Rollback or incident route: Returning to private limits future access but does not undo exposure. If a
  credential or sensitive item is discovered, rotate/revoke it and use an incident/specialist route; do not
  rely on visibility rollback alone.
- Approval requested: Do you acknowledge these visibility-specific consequences and approve changing only
  this repository from private to public now?
