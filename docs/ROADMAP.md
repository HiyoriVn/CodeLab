# Development roadmap

This roadmap distinguishes implementation in source from verified behavior. A phase is complete only after its exit criteria are exercised and recorded.

## Phase 0 — Product and hardware definition

**Status:** web-first platform and MVP language are decided; exact ESP32-S3 board, PS4 receiver model/protocol, OS matrix, and hardware setup remain open.

**Exit criteria:** record board pinout/toolchain, receiver protocol/electrical details, supported hosts, and hardware acceptance scenarios.

## Phase 1 — Web application and workspace

**Status:** React/Vite + Blockly shell, Vietnamese toolbox, workspace JSON open/save, and browser-local autosave exist in source; unverified.

## Phase 2 — Arduino C++ generation

**Status:** subset of built-in Blockly logic/math/control/text and simple typed variables has generator source; unverified. Unsupported blocks warn.

## Phase 3 — Robotics blocks

**Status:** GPIO, ADC, PWM, delay, and generic H-bridge blocks exist in source; unverified. Pin advisories are chip-level; board-specific pin profiles are absent.

## Phase 4 — Compile and upload

**Status:** local Arduino CLI bridge and UI flow are implemented in source on `feat/phase-4-build-upload`; unverified. The bridge binds to loopback, compiles the generated sketch for configurable FQBN, offers currently detected ports, requires explicit upload confirmation, and expires temporary builds. No compile, upload, browser, or board check has been run.

**Exit criteria:** compile generated examples on the supported board profile; verify actionable compiler errors, port selection, confirmation, disconnect, cancellation/timeouts, and successful upload/restart on hardware.

## Phase 5 — PS4 receiver integration

**Status:** blocked on module identification and protocol documentation. The supplied NewmaniaCodeLab archive contained no PS4/controller receiver specification. A generic adapter must wait until UART/I2C electrical and packet format are known; do not treat guessed data as real support.

**Exit criteria:** document exact receiver and wiring, implement its verified protocol, normalize connection/buttons/axes, and demonstrate a safe disconnect behavior on hardware.

## Phase 6 — Stabilization and first release

Accessibility, localization, examples, troubleshooting, supported-platform checks, and reproducible release packaging follow hardware acceptance.

## Later ideas

MicroPython generation, cloud accounts/sharing, and non-ESP32-S3 boards are outside MVP.
