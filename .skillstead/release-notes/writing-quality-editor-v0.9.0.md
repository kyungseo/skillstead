> **Latest** refers to the most recently published individual skill release, not a catalog version.

## writing-quality-editor 0.9.0

This release lets users call `writing-quality-editor` by the natural-language shorthand `WQE` on the runtimes
tested so far. The full `writing-quality-editor` name remains the most predictable choice. `WQE` is not a
guaranteed `$WQE` or `/WQE` command, and selection can vary by runtime, model, and context.

Repository-only examples check successful shorthand use, quoted `WQE` text that should not trigger editing,
mixed-skill requests, and repositories whose own workflow takes priority. The four writing modes and
evidence-bounded localization scope remain unchanged.

The attached source archives are a snapshot of the whole repository at this commit. This release versions only
the `writing-quality-editor` skill — to install, copy the `skills/writing-quality-editor/` folder as described in
`docs/INSTALL.md`.
