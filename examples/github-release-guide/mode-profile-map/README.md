# Mode and profile map

Which mode to pick, and on which release profile. `Assess` inspects without changing anything and returns
`Ready`, `Needs attention`, or `Blocked`. `Guided` starts only when all three entry conditions hold: Assess is
complete, release-critical blockers are resolved, and the user explicitly chooses to switch. Execution detail
belongs to the approval safety loop, not here.

- Editable source: `mode-profile-map.en.svg`, `mode-profile-map.ko.svg`
- 2× preview: `mode-profile-map.en.png`, `mode-profile-map.ko.png`
- Provenance: synthetic Skillstead example, authored with the `svg-infographic` layout and render checks
- KO and EN share one geometry; only the words differ

Regenerate the PNGs after editing an SVG (run from the repository root):

```bash
for l in en ko; do
  bash skills/svg-infographic/scripts/render.sh \
    examples/github-release-guide/mode-profile-map/mode-profile-map.$l.svg \
    examples/github-release-guide/mode-profile-map/mode-profile-map.$l.png --scale 2
done
```
