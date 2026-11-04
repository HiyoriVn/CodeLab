# Bách UI integration

## History repair

The original remote branches have unrelated history with `main`:

- `feat/ux_ui`: root `fea292e`, followed by `7ebec68` (Bách).
- `docs/ui_ux_block`: adds `54ef650` on top of `7ebec68` (Bách).
- `main`: integration base `608e2e6`, with root `0893ab8`.

`codex/integrate-bach-ui` starts from `608e2e6`. UI source and images were ported from `7ebec68`; existing main documentation, generator, device bridge, and dependency declarations were retained. No unrelated-history merge or force push is needed. Merge this replacement branch instead of the two original branches.

## Behavior

- Refreshed Blockly renderer, light/dark theme, menu colors, zoom controls, code sidebar, serial panel, and device dialog.
- **Tập tin** lists browser-local projects, including the active project. Switching or creating projects snapshots pending Blockly edits before remounting the workspace.
- Project import validates block deserialization in a temporary workspace before changing saved projects. Invalid/unknown blocks leave the current project intact.
- Existing `codelab.projects.v1`, legacy workspace storage, and version 1 export formats remain unchanged; no migration is needed.
- Arduino generation, bridge transport, and explicit upload confirmation remain unchanged. Hardware verification is still outstanding.

## Template follow-up

The 14 files from `54ef650` are preserved in a separate commit under `src/blocks/template`. They are reference templates, not registered runtime blocks. Activating them requires comparing field/input names and generator compatibility with the existing definitions; importing them blindly could duplicate block types. No additional block or hardware support is claimed.

## Verification

Results are recorded in `TESTING.md`. Browser and hardware checks are distinct from production bundling.
