# CodeLab

CodeLab is a browser-first visual programming environment for ESP32-S3 robotics. It uses Blockly-style blocks to generate Arduino C++.

## Product decisions

- MVP board family: ESP32-S3; exact board profiles remain to be selected.
- MVP language: Arduino C++; MicroPython is out of scope.
- Web stack: React, Vite, and Blockly.
- PS4 controller: use an external receiver over UART or I2C. CodeLab defines an adapter contract; direct compatibility depends on the actual receiver or a translating adapter.

## Current implementation status

Draft feature branches contain the editor and workspace persistence, a subset of Arduino C++ generation, GPIO/ADC/PWM/delay/H-bridge blocks, a local Arduino CLI compile/upload flow, and PS4 adapter blocks and packet decoder. These changes have not been run or verified. No browser, compiler, serial-port, or hardware checks have been performed.

The PS4 packet format in this repository is a CodeLab adapter contract. It does not establish compatibility with an unidentified receiver. The receiver must emit the documented UART or I2C frame, directly or through a compatible translating module/firmware.

See the [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), [development setup](docs/DEVELOPMENT.md), [verification plan](docs/TESTING.md), and [PS4 adapter contract](docs/PS4-RECEIVER.md).

## Run locally

For editor development, use `npm install`, then run `npm run dev` and `npm run bridge` in separate terminals. The bridge requires Arduino CLI and the ESP32 core.

For a standalone local build, run `npm run build` followed by `npm run bridge`, then open `http://127.0.0.1:8787`. Upload requires a successful compile, a currently detected serial port, and an explicit confirmation.

## Reference archive

NewmaniaCodeLab is a separate design reference, not the CodeLab repository. Its README and source describe a Blockly app and Python generator; they do not define CodeLab's PS4 receiver protocol. See [reference baseline](docs/REFERENCE-BASELINE.md).

## Status labels

- **Implemented in branch, unverified:** source exists, but behavior has not been exercised.
- **Verified:** tested in this repository with evidence recorded.
- **Adapter contract:** CodeLab-defined input format; actual receiver compatibility must be confirmed.
- **Planned:** not yet present in source.

The current editor source also includes a full-screen studio layout, collapsible right-side Code/serial/device panels, local multi-project storage, and project file import/export. Projects remain in the current browser profile unless exported. The serial monitor uses Web Serial where supported. These changes are implemented in source and remain unverified; see the UI refresh entry in [roadmap](docs/ROADMAP.md).
