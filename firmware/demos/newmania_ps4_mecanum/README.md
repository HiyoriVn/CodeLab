# Newmania PS4 mecanum demo

One mainboard sketch: `newmania_ps4_mecanum.ino`. Reuses CodeLabRobot, canonical CSV v1 parser and unchanged A2–A4 PS4 bridge. No new Blockly UI, external driver recommendation, Bluetooth/pairing/MAC implementation or board profile change.

**Current result:** compilable UART/USB monitor + explicit actuator simulation. **Not a working four-motor hardware demo yet.** Onboard RZ7899 truth table is known; actual four-channel GPIO routing conflicts with observed Octal memory and remains unresolved. Hardware motor/servo commands are rejected, never silently simulated as successful hardware motion.

## Firmware currently on D1 vs inspected source

- User reports PS4 connects on ESP32 D1 and previously connected D1 GPIO21 to mainboard SCL, GPIO22 to SDA. That is an **I2C wiring**, not UART CSV.
- The supplied external ZIP `C:/Users/Admin/Documents/ps4-esp32-lib-main.zip` contains PS4Bluepad321.0.1 `examples/SerialMonitor/SerialMonitor.ino`. Inspected stock sample prints `[PS4] Pressed: ...`, `[PS4] Left stick: ...`, triggers to debug Serial115200; it does not start a data UART or publish six-field CSV. It already inverts Y in the library. Do not send these log lines to the CSV parser.
- Exact path/hash of the image actually flashed on D1 has not been supplied. The only sketch found in `Documents/Arduino` is `sketch_oct22a`, a Bluetooth capability probe, not the PS4 sample. Do not claim it is the running PS4 image.
- Use existing `firmware/ps4_bridge/ps4_bridge.ino` A2–A4 if current D1 image lacks CSV. It uses the **same external library** and its NVS/pairing/MAC, unchanged. No automatic reset/erase/pairing command is added. `BP32.update()` freshness evidence, percentage/button mapping, no second Y inversion and separate debug/data UART are already implemented there.
- No PS4 library source is copied into CodeLab. Compile helper temporarily extracts the pinned ZIP outside the repo; license/provenance policy from A2–A4 applies. Final D1 module/flash target still needs confirmation before any approved upload; Classic Dev Module is a compile candidate, not measured D1 board acceptance.

## Proposed UART rewire — not yet performed or tested

Owner allowed preparing a new UART connection using the already identified D1 GPIO21/22. Mainboard signal numbers come from user-supplied reference pinout, not a continuity measurement of the actual Octal PCB.

| Signal | D1 | Mainboard S3 |
|---|---|---|
| Data to mainboard | GPIO21 configured **TX** | UART **RX**, reference GPIO21 |
| Return line | GPIO22 configured **RX** | UART **TX**, reference GPIO18 |
| Reference | GND | GND |

Remove the former SCL/SDA connection before using UART. S3 reference I2C is SDA8/SCL9; do not reuse it as UART by name. **D1 GPIO22 is not S3 GPIO22** (S3 has no GPIO22). Use header signal labels, not guessed connector positions. 115200,8N1,3.3V logic. Do not join5V supply pins; bridge power input is unverified. Power off before rewiring; use separate verified USB power and common GND for the initial no-load test.

`DemoConfig.h` contains this proposed S3 pair but **wiring-confirmed defaults false**, so the default build does not initialize UART. Only set `CODELAB_DEMO_UART_WIRING_CONFIRMED=1` after checking the actual rewire. Compile-time checks reject35–37 and other memory/USB/strapping/known-load pins; these checks do not substitute for a physical pinout check. Existing board profiles stay unchanged; this standalone candidate does not grant motor access or alter Blockly pin validation.

## Motor/servo evidence and remaining physical gates

Owner supplied six reference screenshots (2026-11-05): overview, motor pin table, duplicated servo/UART/I2C table, power tree and schematic Version1.0 (15/8/2025, revision dates on title block). These are reference documents, not proof the actual16MB/OPI PCB has identical nets. Slides advertise N8R2 while prior runtime measured16MB flash/8MB Octal PSRAM.

| Reference function | Source GPIO / signal | What this build permits |
|---|---|---|
| M1 FI/BI | 35/36 | **Blocked**, conflict with Octal memory |
| M2 FI/BI | 37/38 | **Blocked**,35–37 issue affects this pair |
| M3 FI/BI | 39/40 | Documented only; no real backend/power/wiring verification |
| M4 FI/BI | 41/42 | Documented only; no real backend/power/wiring verification |
| Wheel roles | Logical slots0..3 proposed FL/FR/RL/RR | Physical M-to-wheel placement/polarity not supplied; configurable mixer, no assumed real mapping |
| Servo channel signals | Reference12,13,14,15; first channel candidate12 | Mock only; actual selected signal/header orientation and loaded5V supply not verified |
| Servo power | White signal/red5V/blackGND; slides describe5V/2A bus | Not evidence of2A per servo or stable power under load; do not enable real servo |

Four onboard ICs are identified as **RZ7899 by user/reference material**. Manufacturer-authored [Wuxi RZ7899 datasheet, page1](https://ksp-electronics.com/media/167845/201810310633.pdf) truth table:

| FI | BI | FO/BO | Operation |
|---|---|---|---|
| 1 | 0 | 1/0 | Forward |
| 0 | 1 | 0/1 | Reverse |
| 0 | 0 | Open/Open | Coast/stop command |
| 1 | 1 | 0/0 | Brake |

The English pin-function row calls FI “Power supply”, an apparent typo; truth table/application circuit identify FI as forward input and pin4 VCC. Match the physical IC marking/variant before real output. 3A published rating is not a measured continuous current rating of this PCB/load.

`Rz7899Plan.h` implements tested **logical** forward/reverse/PWM pairs: active input duty, opposite0, stop0/0. Default cap15% -> max38/255; no brake mode selected or GPIO writing. Coast is not an instantaneous mechanical stop guarantee. Physical reversal/coast/brake/deadtime/current/driver-frequency choices still require bench review.

`DemoRuntime` reuses RobotController/MecanumMixer/ServoController. Hardware backends do **not** exist in this image. Do not disable PSRAM, change profile validation or assign alternate motor pins to hide this conflict. This does not prove onboard drivers unusable: obtain actual PCB schematic/continuity or motor firmware proven on this exact16MB/OPI PCB. No external motor driver is proposed.

Servo logical bounds45..135°, initial90°,30°/s are simulation settings, not a measured pulse calibration. Real servo backend remains blocked until selected signal, model/pulse limits and stable supply/current path are verified. No POWER_GOOD signal or stabilization delay is invented.

## Debug/monitor use

Default `MODE=MONITOR`, hardware actuators always `BLOCKED`, mock motor backend not ready, Options cannot arm. Mainboard USB Serial115200 prints normalized axes/buttons, report age, controller state/fault, mock wheels/servo every250ms. The parser only receives data if the explicit wiring gate is enabled; no I2C or board GPIO startup.

- `HELP`, `STATUS`: help/status (status also prints periodically).
- `SIM_ON`: explicitly allow **mock** arming; fresh neutral input + Options rising edge required. `SIM_OFF`: disable mocks.
- Share: stop/disarm, PS: clear fault with fresh neutral input. No reconnect auto-arm; >250ms loss disables mock commands. LeftY forward, LeftX lateral, RightX yaw follow the [existing coordinate convention](../../../docs/robotics/PS4_MECANUM.md); chassis signs/order still unverified.
- `SERVO_SIM_ENABLE`: only when SIM and ARMED, allows D-pad Up/Down to move **mock** angle. This is not a physical power confirmation and never emits servo pulses.
- `MOTOR_TEST ...`, `SERVO_ENABLE`, `ARM` via USB: rejected as hardware-blocked, not reported as successful motor/servo tests.

Controller states0=DISARMED,1=ARMED,2=FAULT. Debug console has bounded64-byte command processing, drops overlong/NUL commands. Data UART and debug USB remain separate. Cooperative watchdog needs regular loop execution; physical stop latency has not been measured. CSVv1 valid replay limitation remains unchanged.

## Compile commands — no upload

```powershell
npm test
npm run build
node tools/robot-parser-header.mjs
# Default mainboard image: UART not initialized, actuator hardware locked.
pwsh -NoProfile -File tools/verify-mecanum.ps1 -Sketch firmware/demos/newmania_ps4_mecanum -Log docs/verification/mecanum_working_demo_compile.log
# Candidate image for the proposed UART rewire; compiling does NOT verify wiring.
pwsh -NoProfile -File tools/verify-mecanum.ps1 -Sketch firmware/demos/newmania_ps4_mecanum -CompileUartCandidate -Log docs/verification/mecanum_working_demo_uart_compile.log
# Existing bridge, D1 GPIO21=TX /22=RX; same library/Bluetooth/NVS logic.
pwsh -NoProfile -File tools/verify-ps4-bridge.ps1 -Tx 21 -Rx 22 -Log docs/verification/mecanum_d1_bridge_compile.log -OutputDir firmware/ps4_bridge/build-output/d1_uart_candidate
```

Mainboard CLI1.5.1/Core3.3.7, unchanged `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc`, internal CodeLabRobot and built-in Wire only. Bridge candidate `esp32-bluepad32:esp32:esp32` core4.1.0 + external PS4Bluepad321.0.1. Tools only set process-local Arduino directories. No install/update/COM/flash/upload commands run by these scripts.

## Test order when separately approved

1. Rewire/verify the three UART lines with loads disconnected. Review/approve the matching bridge and S3 UART-candidate images separately, then check `connected=1`, axes/buttons and neutral after disconnect; current monitor must never move anything. This step is prepared, not executed.
2. **Motor test blocked** until actual35–37 routing conflict is resolved. Then review driver/power/backend, lift all wheels and explicitly approve each individual low-speed Forward/Reverse/Stop test; assign physical M1–M4 to wheel roles from observation.
3. **Servo test blocked** until pin/model/power conditions are verified and a real backend is implemented/reviewed. Explicit enable only, start at a mechanically safe angle, bound/rate/stop tests separately approved.
4. Combined mecanum only after all four individual channels and servo pass; verify Share/disconnect/>250ms/fault/re-arm first. No automatic sequence or approval inferred from compilation.

Full compile evidence, current status and commit-ready commands: [working demo report](../../../docs/verification/WORKING_MECANUM_DEMO.md).
