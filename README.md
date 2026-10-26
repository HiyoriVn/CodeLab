# CodeLab

CodeLab is a planned visual programming environment for ESP32-S3 robotics. Its goal is to let learners assemble Scratch/Blockly-style blocks, inspect the generated Arduino C++, and deploy programs to a board.

> **Repository status:** the Phase 1 editor and an initial Phase 2 Arduino C++ preview are present on feature branches. They have not yet been run or verified. Compilation, upload, and hardware support remain planned.

## Product decisions

- **MVP target:** ESP32-S3.
- **MVP language:** Arduino C++ generated from blocks. MicroPython is out of scope for the MVP.
- **Initial platform:** browser-based web app using React, Vite, and Blockly. Desktop packaging can be evaluated later.
- **Visual editor:** Blockly-inspired, with Scratch-like approachable interactions and beginner-focused categories.
- **PS4 input:** support an external PS4 receiver module connected to the ESP32-S3 over UART or I2C. The exact receiver, wiring, and data protocol must be selected and documented before implementation.
- **Delivery:** phased development with observable acceptance criteria; hardware-dependent features are validated on real boards.

## Planned MVP

1. Create, edit, save, and reopen a block workspace.
2. Expand and verify readable Arduino C++ generation for the supported block set.
3. Provide a safe compile/upload workflow for ESP32-S3 with actionable errors.
4. Include starter robotics blocks and a documented board/pin configuration.
5. Add a PS4 receiver abstraction only after the target module protocol is confirmed.

See [the roadmap](docs/ROADMAP.md) for phases and exit criteria, [architecture](docs/ARCHITECTURE.md) for system boundaries, and [development setup](docs/DEVELOPMENT.md) for the local workflow.

## Current code preview

The initial generator supports a subset of built-in logic, math, control, and text-output blocks. Unsupported blocks are called out in the preview and replaced with placeholders; treat any output with warnings as incomplete. There is no compiler or upload action yet.

## Reference archive

The supplied NewmaniaCodeLab archive is treated as a design and implementation reference, not as the current CodeLab repository. Its README reports a Blockly workspace, Python generator, Web Serial connection/monitor, compatibility checks, reboot, and workspace file save/load as existing features in that separate project. The archive's code confirms a React/Vite + Tauri application and a Blockly Python generator. These are **reference-project claims**, not verified CodeLab functionality. See [reference baseline](docs/REFERENCE-BASELINE.md).

## Repository documents

- [AGENTS.md](AGENTS.md): instructions for AI coding agents and contributors.
- [Roadmap](docs/ROADMAP.md): phased plan and completion criteria.
- [Architecture](docs/ARCHITECTURE.md): proposed modules, code flow, and hardware boundary.
- [Development setup](docs/DEVELOPMENT.md): local web workflow and current limitations.
- [Testing strategy](docs/TESTING.md): verification layers and release gates.
- [Contributing](CONTRIBUTING.md): contribution workflow and review expectations.

## Status legend

- **Implemented in branch, unverified:** source code exists but has not been run or verified.
- **Verified in this repository:** the behavior has been exercised and its result recorded.
- **Reference archive:** observed or reported in NewmaniaCodeLab; not part of this repository.
- **Planned:** future CodeLab work, subject to phase acceptance and hardware validation.
