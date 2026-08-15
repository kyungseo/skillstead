# Approval safety loop

In Guided, one change at a time. The flow previews the action, rechecks the preconditions immediately before
acting, and asks for approval in two distinct scopes — **execution approval** only on the path where a
repository command must run, and **mutation approval** before any change on either path. Neither implies the
other. If a critical precondition changed at the recheck, prior approvals do not carry over and the flow
returns to Preview.

- Editable source: `approval-safety-loop.en.svg`, `approval-safety-loop.ko.svg`
- 2× preview: `approval-safety-loop.en.png`, `approval-safety-loop.ko.png`
- Provenance: synthetic Skillstead example, authored with the `svg-infographic` layout and render checks
- KO and EN share one geometry; only the words differ

Regenerate the PNGs after editing an SVG (run from the repository root):

```bash
for l in en ko; do
  bash skills/svg-infographic/scripts/render.sh \
    examples/github-release-guide/approval-safety-loop/approval-safety-loop.$l.svg \
    examples/github-release-guide/approval-safety-loop/approval-safety-loop.$l.png --scale 2
done
```
