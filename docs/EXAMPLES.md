# Starter examples

These recipes are instructions, not verified board-specific workspace files. Pin defaults depend on the ESP32-S3 board and must be checked before wiring.

## 1. Blink an external LED

1. Add **repeat** with a small count such as 10.
2. Inside it, add **set GPIO** to HIGH, **wait (ms)** 250, set the same GPIO LOW, then wait 250.
3. Choose a GPIO exposed and safe on the exact board.
4. Wire an external LED with a current-limiting resistor. Do not assume the board has an LED on a particular GPIO.
5. Inspect generated C++ and resolve pin warnings before compile.

This example exercises GPIO output, timing, and finite repetition without requiring a motor.

## 2. Read a PS4 adapter without moving a robot

1. Put **PS4 UART begin** or **PS4 I2C begin** at the top of the workspace.
2. Set its pins, baud/address using the board and adapter documentation.
3. Add an **if** block using **PS4 connected** as its condition.
4. In the connected branch, test **PS4 button** (for example Cross) and print a short message with the text block.
5. Add a small delay, such as 20 ms, to keep serial output readable.
6. Connect only a receiver/translator that emits the CodeLab contract. Watch for neutral state when the receiver stops sending frames.

This monitor example should be tested before controller input is connected to motors or other moving hardware.

## Status

Neither recipe has been run or verified. Hardware acceptance requires recording the board, pinout, receiver, wiring, power, toolchain, and observed result in the hardware test record.
