# Newmania — generator and integration, stage 3

Stage 2 API commit: `7a9d30525dc503221d35fa142106ed52d541a756`.
Stage 3 reuses the approved block IDs from the stage-one prototype in
`src/blocks/newmania.js`; the prototype re-exports these definitions rather than
maintaining a second copy. No board registry, GPIO, PWM, motor direction, D1
firmware, receiver, scheduler core, motor backend or watchdog is changed.

## Project routing and persistence

New projects use optional `project.programModel: "newmania-v1"` metadata within
the existing version-1 project envelope. They contain a pre-created, protected
root. New root IDs also identify the model when metadata is omitted. A stray
new-style child pasted into an old project does not relabel the whole project.
Old projects stay on their existing Blockly definitions and generator until the
user explicitly confirms creating a separate converted copy.

The toolbar, one-option Board selector, lesson selector, project/file controls,
code preview and device panel layout remain. The existing mecanum lesson option
now opens the actual generated new-model lesson. No advanced mode or robot
configuration button is reintroduced. The development-only prototype page is
still separate from the production entry.

The new editor enforces one non-deletable/non-copyable root, one terminal nested
forever and one parameter-free PS4 connection. Structural diagnostics attach to
blocks. Failed workspace loading no longer clears the partial load and autosaves
it over source data: saving/snapshot/export retain the source workspace, and
code generation/compile opening is blocked until a complete project is opened.

## Block support

Eight categories contain 48 block entries (including three variable entries,
which Blockly renders dynamically). 31 entries are unlocked and 17 are visibly
disabled. The root is pre-created and not a toolbox entry. Motor has seven
operation entries with a physical-port M1–M4 dropdown, preserving stable device
IDs and configured port mappings. PS4 has connection, one three-state Boolean,
axis and connection-status entries. There are no independent event hats or
automatic PS4 robot-driving macros in the new catalogue.

| Category | Entries | Disabled |
|---|---:|---:|
| Bắt đầu & Điều khiển | 8 | 3 |
| Logic | 4 | 0 |
| Toán học | 7 | 5 |
| Biến | 3 | 0 |
| Hiển thị / Serial | 11 | 9 |
| Motor | 7 | 0 |
| Di chuyển mecanum | 4 | 0 |
| Tay cầm PS4 | 4 | 0 |

Disabled: while/until, counted for, break/continue; modulo, single/unary math,
random integer, rounding and constrain; text join/print, direct Serial reads and
writes, and hardware LED controls. These remain registered for saved workspaces;
the new generator refuses to compile them with block IDs and reasons. Text
literals for messages and numeric/Boolean expressions are supported. Variables
remain numeric only. There are no placeholders presented as compilable code.

## Code generation and runtime

`generateArduino` routes workspaces containing new IDs to
`src/generators/newmania.js`; legacy workspaces keep the old generator untouched.
Code Preview receives the exact compilable sketch, not a simplified second view.
The new sketch includes `CodeLabNewmania.h`, numeric variables, independent
button cursors, a numeric-variable reset callback, and one bounded PC callback.
`setup()` begins the system/registers the program; `loop()` only calls update.
The visible PS4 connection call occurs in the student's once-per-RUN sequence.
No sketch emits raw I2C setup, pin numbers, log queues or blocking delay calls.

The compiler supports if/else, four levels of finite repeat nesting, terminal
forever, numeric arithmetic/comparison/logic/variables, timer and motion-handle
waits, messages, individual motors and mecanum. Static code is limited to 1024
steps. Motor references are resolved through existing device configuration.
Joystick inputs retain LY -> forward, RX -> sideways, LX -> rotation, with no
new sign conversion. The scheduler handles current-generation continuations;
no new script priority or arbitration rule is introduced.

Two small technical helpers are added to the stage-two facade: finite repeat-count
normalization, and a bounded Serial message drain. The drain attempts at most 32
bytes per update, only when Serial has space; it never flushes or waits for USB.
Native tests verify control/heartbeat continue with zero Serial write capacity.
The shared fake platform gains only the Serial methods needed to test this;
the hardware backend itself is unchanged.

## Confirmed-copy conversion

The confirmation dialog explains once-per-RUN execution after Options ARM. The
converter clones source data; it maps a single old start and single old forever
into the new root/terminal loop and preserves existing serialized block/variable
IDs. Old held-button reads and motor operations map to their new equivalents;
configuration for the current Newmania profile is preserved. A connection block
is inserted when needed. A compatibility-only old STOP block retains its stop
semantics without appearing in the new catalogue.

Independent PS4 event scripts, multiple independent starts/loops, unsupported
blocks or invalid configuration refuse automatic conversion with IDs/reasons.
The source remains open and unchanged; no partially converted copy is persisted.
Generic/other-profile originals are never silently relabeled. The old project
and its original generation path remain available.

## Examples and verification commands

`examples/newmania/{hold_m1,counter_x,mecanum}` contain stable-ID project JSON and
the exact generated `.ino` sketches. Regenerate with
`node tools/newmania-examples.mjs`. Import these project JSON files using the
existing File/Open flow. Regeneration and C++ output are regression-tested.

`npm test` covers new/old routing, every unlocked catalogue entry's C++ syntax,
generated host execution for M1 hold/stop, independent edge counter/Serial output,
correct mecanum signs, nonblocking Wait/Share cancellation, nested repeat/logic,
save/reopen and safe conversion/rejection. Existing native and legacy tests remain.

`node tools/verify-newmania-build.mjs` compiles all three examples through the
production `/api/compile` endpoint, checks source equality with the saved sketch,
and asserts nonempty binaries. Use the existing CLI 1.5.1/core 3.3.7 environment.
It never lists serial ports or uploads. The FQBN remains
`esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc`.

Arduino endpoint verification: all three returned HTTP 200. Binaries: hold_m1
350240 bytes, counter_x 350416 bytes, mecanum 350256 bytes. These are compile/host
checks only, not hardware acceptance.

Final verification on 2026-11-11:

- Current working tree: `npm test` **104/104 PASS**, `npm run build` **PASS**.
- Exported staged-only snapshot (canonical LF): **102/102 PASS** and production
  build **PASS**. The two pre-existing browser-flash tests are intentionally
  outside the staged snapshot.
- Every unlocked catalogue entry syntax-checks with g++ C++17,
  `-Wall -Wextra -Werror`. Generated hold/counter/mecanum/wait programs execute
  against the actual existing receiver/scheduler/motor logic on the fake platform.
- Three generated sketches compile via the real bridge/Arduino CLI; exact source
  equality with committed fixtures is checked before compile.
- Existing native Windows executable tests passed; no six-test .exe failure.
- Staged diff confirms the board registry, D1 firmware, runtime/driver/receiver,
  scheduler core and watchdog files remain unchanged.
- Existing Blockly deprecation, Vite chunk-size and Git line-ending warnings
  remain; no dependencies were added.

## Outstanding live-UI acceptance

Stage-one preview drag/drop had passed earlier. Opening the **integrated main
application** at `http://localhost:5173/` for stage-three acceptance was rejected
by the browser origin approval gate, which reported permission declined. No
alternate origin/browser/control mechanism was used to bypass this rejection.
Consequently integrated-app drag/drop, file picker and conversion-dialog visual
acceptance are **not yet verified**, despite passing model/generator tests and
the web build. Do not treat this document as final live-UI release acceptance.

No deploy, flash, push or merge was performed. Pre-existing browser-flash and
Cloudflare changes remain outside the stage-three commit.
