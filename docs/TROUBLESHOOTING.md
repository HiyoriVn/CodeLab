# Troubleshooting

The editor, local bridge, generated code, and PS4 contract are implemented in draft branches and have not been run here. Use these steps during your first local test and record what happens in the issue/PR.

## The editor does not open

- Use a current desktop browser.
- Run `npm install` from the repository root, then `npm run dev`.
- If Vite reports a port in use, open the alternate URL it prints.
- For a standalone build, run `npm run build` before `npm run bridge`.

## CodeLab says the local bridge is unavailable

- Start `npm run bridge` in a second terminal.
- Confirm Arduino CLI is installed and available on PATH. Set `ARDUINO_CLI_PATH` to its full executable path if needed.
- Install the Arduino ESP32 core 3.x. The default target is `esp32:esp32:esp32s3`; use `CODELAB_FQBN` only for a confirmed board target.
- Read the bridge terminal output for process launch errors.

## Compile is disabled or fails

- Resolve every Blockly generator warning first; unsupported blocks and pin diagnostics intentionally prevent compile.
- Confirm the ESP32 core is installed for the selected FQBN.
- Read the compiler output surfaced by CodeLab. Keep the exact error when reporting a generator issue.
- A generic ESP32-S3 target does not guarantee the selected board's pinout, flash layout, or peripheral wiring is correct.

## No serial port appears or upload fails

- Use a USB data cable and reconnect the board, then choose **Làm mới cổng**.
- Close other serial monitors or IDE windows that may own the port.
- On Linux, check the user's serial-device permissions. On Windows/macOS, install the board's USB-to-serial driver if required by the board vendor.
- Confirm the selected port still appears in Arduino CLI before upload.
- If the board does not enter download mode automatically, follow the board vendor's BOOT/RESET procedure.
- Do not disconnect power during upload. Recompile after source changes; only a successful build in the current bridge session can be uploaded.

## PS4 blocks show no input

- Confirm the receiver or a translating adapter outputs the CodeLab UART CSV or 13-byte I2C frame described in [PS4 receiver requirements](PS4-RECEIVER.md).
- Check the UART baud/pin direction or I2C address/roles, voltage compatibility, common ground, and board pinout.
- Check that the connection flag is set and frames arrive more often than once every 250 ms.
- A different vendor protocol is not auto-detected. Capture a sample frame and adapt it before treating the receiver as supported.

## A robot moves unexpectedly

- Disconnect motor power before changing wiring or firmware.
- Test GPIO outputs with an LED and current-limiting resistor before connecting the motor driver.
- Use an external H-bridge and separate motor supply; never drive a motor from ESP32-S3 GPIO.
- Use the physical power switch or disconnect motor supply to stop motion if the program is not responding.
