# Blockly redesign — stage 1

> Historical stage-one preview/acceptance snapshot. Production integration is now described in [stage 3](robotics/NEWMANIA_GENERATOR_STAGE3.md).

Development-only editor: run `npm run dev` and open `/blockly-design.html`.
This is a real Blockly workspace for reviewing drag/drop, shapes, dropdowns,
structure diagnostics and save/reopen. It does not execute programs, generate
C++, contact the bridge, pair PS4, compile, upload or change hardware.

The application entry does not import the prototype. The prototype uses a
separate HTML entry that is not part of Vite's default production build, plus a
DEV-only entry guard. New IDs have no production generator registration.

- One pre-created root; non-deletable and non-copyable, with duplication disabled
  and workspace maxInstances=1 for the root, forever and PS4 connection.
- Forever is a terminal statement inside the root. Nested/detached placement is
  diagnosed without deleting blocks. Imported malformed data is retained and
  reported, not silently repaired.
- One PS4 connection block without technical fields; one Boolean block with
  PRESS/HELD/RELEASE. Stage 1 tests field editing and serialization only, not edge
  execution; runtime edge semantics belong to stage 2.
- Motor types are prototype clones with M1–M4 only, one catalogue entry per
  operation. Existing block definitions and saved projects are unchanged.
- Eight categories; unsupported entries are disabled and labelled. Existing
  unsupported blocks are preserved with diagnostics. No hardware LED changes.
- Three examples: held X -> M1 20% / stop; X press -> increment numeric variable;
  mecanum inputs LY/RX/LX. Axis signs and runtime behavior are not changed or
  accepted by this editor-only stage.

Persistence uses `codelab.blockly-design.stage1.v1`, never the production project
keys. Downloads use format `codelab-blockly-design` version 1 and the tested
Newmania board ID. The importer refuses production project files, leaving the
current preview and original file intact. This stage does not implement project
migration. A later approved stage must provide confirmed-copy conversion.

Stage 2 must prepare the receiver at boot for Options ARM and make the visible
PS4 connection operation idempotent/nonblocking without restarting I2C per RUN.
Stage 3 must implement nonblocking generation, compatibility and production
enablement. No claim of working new PS4 edge detection or generated code is made
by stage 1. No commit is authorized for this stage yet.

## Acceptance — 2026-11-11

Stage 1 acceptance passed for the development-only Blockly editor.

| Check | Result |
|---|---|
| Eight categories, one root, nested terminal forever | PASS: headless tests and Chrome UI |
| Root Delete / copy protection | PASS: Delete kept the root; copy produced no pasteable duplicate |
| Initial root undo history | PASS: root creation emits no undoable event; regression added |
| Real drag detach/reconnect | PASS: motor detached from if branch displayed warning; reconnect cleared warning |
| PS4 button dropdown | PASS: PRESS, HELD and RELEASE selected on Chrome; serialization tests passed |
| Motor selector | PASS: UI showed M1/M2/M3/M4 only; selecting M4 worked |
| Unsupported flyout blocks | PASS: visibly disabled; drag did not insert a new block |
| Three examples | PASS: hold/stop, numeric counter and LY/RX/LX mecanum displayed |
| Reload persistence | PASS: counter blocks and variable remained after page reload |
| Actual JSON download and file reopen | PASS: browser download produced a 4704-byte JSON file; read by model with identical blocks/IDs/variables/board; uploaded back through file chooser and accepted on Chrome |
| Legacy file rejection | PASS: old simulation fixture refused with explicit message; current counter workspace remained intact |
| Full tests | PASS: npm test 91/91; native executable regressions also passed |
| Production build | PASS: npm run build; no prototype HTML/module/new block IDs in dist |
| Protected scope | PASS: no diff in src/generators, src/boards or firmware; no commit, push, merge, deploy or flash |

During acceptance, the preview was corrected to use an in-page confirmation dialog
instead of a native browser confirm, restore the selector on cancel, show import
errors in-page, clear imported undo history, suppress undoable creation of the
fixed root, and render the root with a cap. Existing production application files
were not edited by this acceptance pass. Existing browser-flash/Cloudflare changes
remain uncommitted.

The initial Chrome file-upload permission issue was resolved after the browser
reconnected; file reopen was subsequently verified successfully. The download
event observer timed out, but the actual downloaded file was found and verified.
Existing Blockly deprecation and Vite large-chunk warnings remain.

This acceptance does not claim runtime PS4 edge semantics, nonblocking Wait or new
Arduino generation: those require separately authorized stages 2 and 3. Legacy
conversion is also outside this isolated stage-one editor.
