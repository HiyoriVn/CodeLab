# PS4 receiver integration requirements

CodeLab will support a PS4 controller through the user's external receiver module connected to ESP32-S3 over UART or I2C. The supplied NewmaniaCodeLab archive and the current repository do not identify the receiver model or its data protocol. Therefore this document is a requirements checklist, not a claimed implementation.

## Provide before implementing the receiver adapter

- Receiver manufacturer, exact product/model, hardware revision, and firmware version.
- Datasheet or official protocol documentation and any required library/license.
- Whether the controller pairs to the module directly and how pairing/reset works.
- ESP32-S3 board model/revision and pinout.
- Transport choice (UART or I2C), voltage levels, common ground, and wiring diagram.
- UART baud rate and frame boundaries, or I2C address/register/read length.
- Packet field order, byte order, signedness, axis ranges/center/dead zone, button map, and connection flag.
- Update frequency, timeout, reconnect behavior, and expected state after disconnect.
- Example captured packets for neutral, each axis direction, buttons, connect, and disconnect.

Do not connect a 5 V signal to an ESP32-S3 input unless a documented level shifter is used. Confirm electrical levels from the receiver documentation.

## Planned adapter boundary

The receiver-specific decoder should be isolated from Blockly and normalize input to a stable model:

- connection state and last-update timestamp;
- four named axes normalized to a documented range;
- named button states;
- neutral output after a configurable stale-data timeout.

The generated sketch should initialize the chosen transport once, poll/update the adapter without blocking the robot loop, and offer connection/axis/button blocks plus a live monitor. A robot example must stop or enter its agreed safe state when the controller disconnects.

## Acceptance

Phase 5 can move from blocked to implementation when the hardware/protocol checklist is complete. It is accepted only after captured-frame parser checks and hardware validation with the exact receiver, board, voltage, and wiring are recorded in [the verification plan](TESTING.md).
