# Architecture

CodeLab is a browser-first React/Vite + Blockly editor that generates Arduino C++ for ESP32-S3. Current feature branches contain the workspace, generator, robotics blocks, a local Arduino CLI bridge, and a CodeLab PS4 adapter contract. Source changes remain unverified.

## Modules

- **Editor UI:** Blockly workspace, code preview, workspace import/export, and build/device panel.
- **Generator:** supported Blockly and robotics blocks produce Arduino C++ plus diagnostics.
- **Local build bridge:** loopback Node.js service invokes Arduino CLI with argument arrays, keeps successful builds temporarily, lists connected ports, and requires explicit confirmation before upload.
- **Controller adapter:** generated C++ polls a single UART or I2C input using the CodeLab adapter contract, normalizes four axes and a button bitmask, and returns neutral/disconnected values after stale data.
- **Board profile:** defaults to generic ESP32-S3 FQBN; board-specific pin maps are not implemented.

## Data flow

`Workspace → Arduino C++ + diagnostics → local Arduino CLI compile → user-confirmed upload → ESP32-S3`

Controller data flows:

`PS4 receiver → optional translating adapter → CodeLab UART/I2C frame → normalized controller state → Blockly expressions`

The receiver may not emit this contract directly. The selected hardware, electrical levels, and protocol must be confirmed before claiming module compatibility.

## PS4 CodeLab adapter contract

UART mode reads newline-delimited ASCII CSV:
`connected,lx,ly,rx,ry,buttons\n`

- `connected`: 0 or 1.
- `lx`, `ly`, `rx`, `ry`: signed 16-bit axis values.
- `buttons`: unsigned 32-bit decimal bitmask.
- The default baud is 115200; the block allows a different rate.
- The parser refreshes state only for a complete valid line. State becomes disconnected after 250 ms without a valid frame.

I2C mode makes the ESP32-S3 the bus master and requests 13 bytes from the configured 7-bit receiver address:

- byte 0: connected in bit 0;
- bytes 1–8: four signed 16-bit little-endian axes in LX, LY, RX, RY order;
- bytes 9–12: unsigned 32-bit little-endian button mask.

Axes are normalized to -1000…1000. When disconnected or stale, axis reads return 0 and button reads return false. The contract's button bit assignments are documented in [PS4 receiver requirements](PS4-RECEIVER.md).

## Boundaries

- UI calls local HTTP APIs; it does not spawn compiler processes or parse receiver frames.
- The generator accepts a Blockly workspace and produces code/diagnostics.
- The bridge accepts source text and target settings, not Blockly objects.
- The receiver-specific adapter/firmware is outside CodeLab until the actual receiver is identified.
- Upload is only available after a successful compile and user confirmation.

## Open decisions

- Exact ESP32-S3 board, pinout, supported operating systems, and Arduino core version.
- Exact receiver module, wiring, voltage, protocol, and whether it can emit the CodeLab adapter format.
- Whether a separate receiver firmware or translating microcontroller is needed.
- Desktop packaging after web MVP feedback.
