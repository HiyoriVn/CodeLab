# Newmania API — stage 2

Stage 1 was committed separately as
`48f656d06da3f66bdf347fd68f443891bb3a57d1`. Stage 2 adds the opt-in header
`firmware/libraries/CodeLabFast4wd/src/CodeLabNewmania.h` to the existing library,
not a new library package. Include it and use `codelab::newmania::Board`.
Production Blockly and generators do not use it yet. Stage 2 remains uncommitted
until authorized; stage 3 integration has not started.

## Lifecycle and PS4 connection

`begin()` is called from Arduino `setup()`, once. It starts Serial at 115200 and
delegates startup to the existing fast100 Robot, including its existing startup
delay, I2C setup, motor initialization and safety. Repeated `begin()` calls do not
restart Serial or I2C. The startup delay was not removed or moved into RUN.

`update()` must run continuously from Arduino `loop()`, before and during RUN.
The existing receiver can therefore observe Options ARM without a student
connection block having run. The facade cannot start a program by bypassing
the existing hardware ARM decision.

`connectPs4()` is the visible API call for the student connection block. It
enables student-facing reads and invalidates pre-connection edge history once
per RUN. Repeated calls are idempotent; it never calls `Wire.begin`, waits for a
controller, initiates Bluetooth pairing, arms, or starts a motor. `true` means
the facade is prepared, not that Bluetooth is connected. Use `connected()` for
the real receiver status. Bluetooth pairing remains a separate operation on D1.

One `registerProgram(uid, step, reset)` is accepted. The scheduler's existing
callback/context ABI is reused. On each new RUN, the facade resets drive intent,
timers, message queue, input history and connection intent, then invokes the
numeric-variable reset callback before the first student statement. User variables
are owned by the caller; this reset hook is required for generated numeric variables
in stage 3. STOP/FAULT cancel scheduler contexts/handles, not just their visible UI.

## Button and joystick contract

| API | Meaning |
|---|---|
| `button(Button::X, ButtonState::Pressed, cursor)` | One true per observed press transition for this reader |
| `button(Button::X, ButtonState::Held, cursor)` | Current held state, without consuming transitions |
| `button(Button::X, ButtonState::Released, cursor)` | One true per observed release transition for this reader |
| `held(Button::X)` | Current held state for an enabled student PS4 reader |
| `axis(Axis::LeftY)` | Existing raw normalized left Y percentage |
| `axis(Axis::RightX)` | Existing raw normalized right X percentage |
| `axis(Axis::LeftX)` | Existing raw normalized left X percentage |
| `connected()` | Live system receiver status, available before RUN |

Each Boolean block must get its own persistent `ButtonCursor`. It must not be
recreated on each evaluation, shared with another block, or shared between
different button/state predicates. Readers do not mutate shared PS4 state.
Per-button, per-edge counters retain observed transitions while the main program
is runnable, so a condition reached by a later PC continuation does not lose the
edge. Each read consumes at most one transition **for that reader only**; once
caught up, holding the button or polling a cached packet produces no more true
results. Counters use bounded storage, not a heap event queue.

Entering timer/handle Wait invalidates all reader epochs and pending transitions.
Edges during Wait, including its wake-up update, are dropped. Held state remains
current. RUN restart and disconnect also invalidate history. A held button on
connection/reconnection/RUN does not become a synthetic press. The guarantee
applies to transitions actually observed in fresh D1 reports; the library cannot
reconstruct physical transitions absent from those reports.

No axis sign, raw range, D1 frame, timeout or motor direction is changed. The
approved mecanum wiring is LY -> forward, RX -> sideways, LX -> rotation. The
facade does not add an automatic PS4-driving macro or alter the baseline mixer.
The internal name `Button::Home` refers to PS bit 12, avoiding the ESP32 SDK's
unrelated `PS` register macro without undefining SDK symbols.

## Motor, drive and Wait API

| API | Behavior |
|---|---|
| `spin(Motor::M1, Direction::Forward, 20)` | Existing motor write path, requested magnitude 0–100 |
| `power(Motor::M1, -20)` | Signed percentage, bounded to -100…100 |
| `runFor(motor, direction, percent, ms)` | Existing scheduler motion handle; 1–5000 ms |
| `stopMotor(motor)` | Existing zero-power command for that port |
| `stopAllMotors()` | Stops all ports and drive intent, does not DISARM |
| `releaseMotor(motor)` / `motorPwm(motor)` | Existing release and applied-PWM semantics |
| `mecanum(forward, left, counterclockwise)` | Existing three-axis drive request in percent |
| `driveFor(..., ms)` / `stopDrive()` | Drive timer up to 60000 ms / zero drive request |
| `wait(ctx, ms, nextPc)` | Sets an existing timer continuation and returns WAIT; 0–60000 ms |
| `waitMotion(ctx, handle, nextPc)` | Suspends on the existing motion handle |
| `stop()` | Stops the current student RUN via the existing scheduler |

Callbacks must **return** the result of `wait`/`waitMotion`; neither blocks or
calls `delay`. The only startup/runtime delays are those already present in the
underlying Robot. A callback context must belong to the current program and RUN;
stale contexts cannot install continuations. Invalid waits fail closed using the
existing scheduler fault mechanism. Callbacks must remain bounded and yielding.

The facade adds no script priorities. It permits one new-style main program and
delegates motor ownership to the existing Scheduler/SchedulerGate. A later accepted
write cancels an earlier timed owner. Independent motor commands retain ownership
until release; motor-stop does not implicitly release a motor to drivetrain.
Legacy event programs continue through their existing generator and runtime,
without automatic conversion or new arbitration rules.

`update()` services input, Share STOP, connection/ARM state, existing safety phase,
scheduler timers and the existing Robot end-of-loop control path. Safety actions
precede student callbacks. The facade does not add an independent real-time safety
task or claim new hardware watchdog behavior. Scheduler fault clear follows the
existing PS-button clear path; hardware ARM/link recovery remains in Robot.

## Messages and integration boundary

`message(text)` and `message(number)` enqueue at most eight messages of up to 127
characters. Full/invalid messages are refused; `messageDrops()` reports drops.
`popMessage(buffer, capacity)` drains the bounded queue without waiting for USB.
Actual preview/Serial consumption belongs to stage 3; enqueuing is not a promise
that a message has already been displayed. No string or Boolean variables are added.

`tests/fixtures/newmania-api-example.ino` is a handwritten compile-only client:
two independent readers of X, counter message, M1 20%, nonblocking wait, then stop.
It is not generator output, a production lesson, or an upload instruction.

## Verification

Host test harness uses the real existing receiver, scheduler and motor backend,
with only the platform boundary faked. It covers boot/idempotence, pre-ARM
protection, independent/delayed readers, cached packets, held buttons, report
sequence wrap, timer wrap, Wait continuation and edge discard, Share cancellation,
stale-link stop and explicit recovery, RUN reset, latest-write timed ownership,
PWM limits, drivetrain release, timed drive, numeric/text messages, stale contexts
and SDK macro compatibility. Old firmware/profile/driver files are not edited.

Final verification on 2026-11-11:

- `npm test`: **93/93 PASS**, including the two new API checks and existing native
  executable regressions. No Windows executable failure occurred in this run.
- `npm run build`: **PASS**. Existing large-chunk warning remains. Production
  remains on the old generator/runtime; the new facade is opt-in.
- Host compile: g++ C++17, `-Wall -Wextra -Werror`; native test executed, plus
  syntax-check of the handwritten Arduino client.
- Real Arduino compile: CLI **1.5.1**, installed **esp32:esp32 3.3.7**, FQBN
  `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc`.
  **PASS**; sketch 350596 bytes, globals 35232 bytes, remaining dynamic memory
  292448 bytes. Compilation only; no port listing, upload or physical test.
- Real SDK compilation initially caught the `PS` macro collision. Renamed the
  facade constant to `Home`, preserving bit 12 and the SDK macro; regression added.
  Final Arduino compile used the frozen API header with SHA-256
  `C66907AF8B735BEEBFE2C5150EDEC17124991C7ECDCCF55BFE80EE378429A08C`.
- Git diff confirms no edits to existing board registry, generator, firmware,
  motor backend, receiver, Scheduler or SchedulerGate. Only the new opt-in header,
  handwritten client, host tests and this document belong to stage 2.
- Stage 1 commit is complete. Stage 2 is approved for commit. Existing
  browser-flash/Cloudflare working-tree changes are kept outside both scopes.
No flash, serial port access, physical motor test, deployment, push or merge is
authorized or performed by this stage.
