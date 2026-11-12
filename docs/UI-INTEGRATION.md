# Bách UI integration

## Integration in progress — 2026-11-12

`test/integration-ui-wasm-newmania` was created from fetched `main` at
`161b4c0901f197063154ac6ca8ed75fd69387d0d`. UI head
`366202d4be030918faf0d8533519a0d22e91a234` fast-forwarded; WASM head
`a570a7265d33a53b2a873f71df754499579e75b4` merged as `0a8aaeb`.
The single textual conflict was the device modal heading/intro. The integration
keeps Bách's `genie="connect"` modal and its title, plus the WASM two-step panel.
No whole-file ours/theirs resolution was used.

The current follow-up preserves the new toolbar, custom selectors, changelog,
theme controls and Dock animations. Code opens only on request, is titled
**Mã nguồn**, and provides clearly labeled learning logic and full Arduino C++.
Comment removal applies only to the displayed/copied preview; compile source is
unchanged. The owner selected a separate resizable area for code, stacked below
the workspace on small windows. Timer/ARM/watchdog code is not shortened.

The student toolbox hides `robot_mecanum`, `robot_drive_direction`,
`robot_drive_for_time`, `robot_drive_stop` and the combined movement category.
Their registrations/generators remain for old projects. Imports retain blocks,
variables and IDs; an explicit compatibility notice describes hidden macros.

Three new individual-motor lessons are currently available: 03 channel test
(D-pad and L1 press edge), 04 basic four-wheel movement (30%), 05 joystick
arithmetic (explicit 6% deadzone, normalized wheel sums and ±100% clamp).
Logical wheel order and direction come from the existing registry/MotorLayout/
MecanumMixer; no GPIO, motor reversal, driver or board profile changes.

**The integration is not complete.** The owner rejected ARM-gating the whole
student program and requested a reviewed architecture change before completing
lessons 01–02. See [the pending runtime proposal](robotics/STUDENT_PROGRAM_LIFECYCLE_PROPOSAL.md).
No new runtime/scheduler/model changes have been implemented. Current lessons
03–05 still use the existing v1 runtime until the proposal is approved and tested.

Checks actually run on this intermediate tree: `npm test` **132/132 PASS**,
`npm run build` **PASS** (existing bundle-size warning), `git diff --check` PASS.
New tests round-trip all three current lessons and execute generated C++ against
the existing fake platform, checking individual outputs, release, L1 edge,
wheel directions, joystick signs/deadzone/normalization and stale-link stop.
The old macro lesson still opens/generates. Updated legacy assertions reflect
the new selector and Bách's delayed modal close instead of removing coverage.
The initial restricted test run hit localhost EACCES; final tests ran with local
execution permission and mocked bridge/device access.

Live Chrome smoke: default code closed; lesson 03 loaded; learning logic/full C++
switched; keyboard resize changed panel width to 444px; DOM geometry showed
workspace right = panel left = 1462px, no overlap. At 680×800 the panel stacks
below workspace and toolbar wraps. Screenshot evidence is local at
`firmware/tests/build-output/ui-integration/narrow-code.png`. This is a partial
smoke check, not completion of the full requested UI/compile acceptance matrix.
No live WASM compile, USB selection/flash or hardware PASS is claimed here.

### Preliminary UI branch audit (no deletion)

| Branch | Evidence / disposition |
| --- | --- |
| `feat/ui_ux` | Head fully included, but [PR #33](https://github.com/HiyoriVn/CodeLab/pull/33) is still open. Retain until PR disposition and final integration verification/push; only then propose deletion for owner confirmation. |
| `codex/integrate-bach-ui` | Patch-equivalence audit still reports `e5df87a` and `1ac87cb` as unmatched commits. Do not delete before checking their remaining changes or preserving a safe archive. |
| `docs/ui_ux_block` | Separate history: three unmatched commits. Template JS files are preserved, while later UI intentionally changed effects CSS. Retain until the remaining old UI changes are explicitly accounted for. |
| local `feat/ux_ui` | Remote already absent after fetch/prune. No local deletion requested/performed. |

`main`, `codex/robot-mvp-integration` and the integration branch are protected by
the task scope. No branch is currently recommended for immediate deletion; the
required final push and five-lesson acceptance have not happened yet.

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
