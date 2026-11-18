# Newmania V2 — QMI8658B IMU

This feature is **V2-only**. The onboard 6-axis QMI8658B is on I²C
**SDA GPIO8 / SCL GPIO9 / 7-bit address 0x6A**, shared with the PS4 I²C
adapter (0x30) and expansion connectors. No additional wiring is needed.

## Blockly quick test

1. Select **Newmania V2 ESP32S3**.
2. Under **Khi bắt đầu chương trình** place **Khởi tạo IMU QMI8658B**
   before **Lặp mãi mãi**.
3. Inside the loop place **Đọc mẫu IMU**.
4. Use **Nếu dữ liệu IMU hợp lệ?** then send **IMU Gia tốc Z (g)** to
   Serial at 115200 baud. Add a short wait (0.05–0.1 seconds) to reduce spam.
5. With the board stationary and lying flat, expect the magnitude of the
   gravity acceleration vector to be approximately 1 g. A particular X/Y/Z
   sign depends on the sensor's orientation on the PCB.

Available channels: AccX/AccY/AccZ measured in g; GyroX/GyroY/GyroZ
measured in degrees per second (°/s). The gyroscope is **angular velocity**
and not an absolute yaw angle. There is no integrated yaw, heading, PID,
magnetometer or encoder behavior in this iteration.

## Firmware behavior

- IMU initializes **only** when its init block executes, and only on V2.
- The driver verifies WHO_AM_I = 0x05, sets acceleration ±4 g at 125 Hz,
  gyro ±512 °/s at ~112 Hz, and enables both sensors.
- The gyroscope startup is handled **without a blocking delay**; samples
  become available after approximately 160 ms.
- Sampling is limited to one I²C attempt per 10 ms, using Wire timeout
  20 ms. A cached sample remains valid for up to 250 ms; bad I²C transfers
  clear validity. Numeric channel blocks return zero while invalid.
- When PS4 I²C has initialized Wire, the IMU **does not reinitialize** the
  shared I²C bus. PS4 UART and PS2 SPI leave that bus unused until IMU init.
- The IMU does **not** change any existing motor/servo startup policy.
  Reading IMU alone never commands motors.

## Suggested hardware checks

1. IMU alone: WHO_AM_I detected, ready after startup, accel magnitude ~1 g.
2. Slowly rotate V2 around each axis; corresponding gyro axis should change.
3. Use PS4 I²C with IMU in the same sketch; check both retain fresh reports.
4. Use PS2 SPI with IMU; check independent SPI and I²C operation.
5. Disconnect IMU / simulate I²C failure and verify ready becomes false.
6. Confirm all V1 programs and lessons 01–06 remain unchanged.

No physical-board test has been performed by ChatGPT. Use a stationary robot
with motor power disabled for the first test.
