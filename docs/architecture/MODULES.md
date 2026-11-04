# Module gap analysis

Audit local commit `f3a839825ca2e83fcb82337cbfe4f8dd2afc3efc`, 2026-11-04. “Một phần” là code liên quan tồn tại, không có nghĩa driver firmware của board đã tồn tại. Không module firmware nào được đánh dấu hoàn thiện. Thư viện L1 ngoài repository được phân biệt rõ.

Priority: **P0** = điều kiện an toàn/tích hợp bắt buộc trước chức năng phụ thuộc; **P1** = chức năng chính; **P2** = sau nền tảng. Phase là kế hoạch mới trong [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md), không phải roadmap web cũ.

| Module | Existing Implementation | Missing Features | Dependency | Priority | Proposed Phase |
|---|---|---|---|---|---|
| BoardConfig | Một phần: FQBN generic trong `tools/arduino-bridge.mjs`; chip warnings trong `src/generators/arduino.js` | Profile V2/N8, 39 GPIO + EN, alias/ownership, capability/timer allocation, startup policy | H1/H2, exact toolchain | P0 | 02; nối web 06 |
| MotorDriver | Một phần, cần refactor: `src/blocks/robotics.js` và generator H-bridge 3 chân | TMI8260 2 input x6, safe boot, coast/brake, PWM strategy, giới hạn/đảo chiều, error handling | HAL, BoardConfig, PWM plan, motor specs | P0 | 02 nền an toàn; 03 driver; 05 policy |
| ServoDriver | Chưa có; generic PWM không phải servo driver | 6 kênh, pulse/range calibration, power-stable gate, disable, tài nguyên tần số riêng | HAL, PWM plan, servo specs, nguồn ổn định | P0 | 02 gate; 03 driver |
| EncoderDriver | Chưa có | 2 quadrature, count/speed, overflow/filter, CPR và association motor | HAL/PCNT hoặc phương án được kiểm chứng, encoder specs | P1 | 03 |
| IMUDriver | Chưa có | QMI8658B 0x6A init/identity, register map, polling/FIFO, scale/calibration/error | PeripheralBus, datasheet Rev D | P1 | 03 |
| BuzzerDriver | Chưa có; generic GPIO có thể ghi pin nhưng không là driver | GPIO26 LOW boot, enable/timing, nonblocking cues | BoardConfig/HAL, rail/type buzzer nếu phát tone | P2 | 02 LOW; 03 driver |
| PeripheralBus | Một phần: generated `Wire.begin`, `Serial1.begin`; không có bus manager | Ownership I2C/SPI/UART, shared init, timeout/recovery, pin reservations | BoardConfig/HAL | P0 | 02 abstraction; 03 peripherals |
| UARTBridge | Một phần: helper C++ UART RX trong generator, hiện sinh mã lỗi; Node Arduino bridge là công cụ host khác | Firmware hai đầu UART1, transport có giới hạn, link health, bridge TX, cấu hình chốt | HAL, bridge chip/pins/power, PacketProtocol | P0 | 04 |
| PacketProtocol | Một phần/cần refactor: CSV 6 trường và I2C 13 byte trong generator và `docs/PS4-RECEIVER.md` | Version, framing/integrity, strict ranges, sequence/freshness, golden vectors, migration; sửa helper generation | Contract hai firmware, host tests | P0 | 04; generator 06 |
| PS4Controller | Chưa có trong repo; L1 `PS4Bluepad32.{h,cpp}` là ứng viên ngoài, chưa build | Chip Classic thực tế, pinned package, UART publisher, reconnect/freshness, axes/button mapping | Bridge board, Bluepad32, Preferences/NVS | P0 | 04 |
| CommandRouter | Chưa có | Validated command schema, quyền điều khiển/ưu tiên, stop/cancel, không bypass safety | PacketProtocol, SafetyManager | P0 | 05 |
| RobotController | Chưa có | Lifecycle/modes, channel mapping, scheduler, state/error orchestration | Drivers, CommandRouter, cơ cấu robot | P1 | 05 |
| DriveController | Chưa có | Kinematics, motor direction/calibration, saturation, acceleration limit | Robot layout, Motor/EncoderDriver | P1 | 05 |
| MotionControl | Chưa có | Closed-loop speed/position, timing, anti-windup/limits, sensor invalid fallback | Encoder/IMU, DriveController, cơ khí | P1 | 05 |
| SafetyManager | Một phần ý tưởng: helper neutral sau 250 ms; UI xác nhận upload; không có safety firmware | Boot/disarm/arm/fault, output gate, independent freshness, scheduling/watchdog, power policy, reconnect inhibit | HAL, driver errors, requirements cơ cấu/nguồn | P0 | 02 minimum; 05 hoàn thiện; 07 validate |
| SerialCLI | Chưa có firmware; `src/components/SerialMonitor.jsx` chỉ là host terminal | Bounded parser, version/status/fault commands, validation, debug transport riêng | USB/UART0 config, Diagnostics, CommandRouter | P1 | 02 status tối thiểu; 05 commands |
| CodeLabAdapter | Một phần: React/Blockly, robotics/controller blocks, Arduino generator; không phải Scratch extension | Board-aware API generation, firmware ABI/version, channel blocks, safe migration, compiler tests | Mainboard API, protocol, workspace schema | P0 | 06 |
| Diagnostics | Một phần: generator warnings, compile log/API, serial UI | Unified firmware counters/fault/status, timestamps, build/config IDs, sensor/link health | HAL/time, all modules | P1 | 02 nền; 03-06 bổ sung; 07 hồ sơ |

Các lỗi cụ thể, bước tái hiện và rủi ro được ghi tại [PHASE01_AUDIT.md](../PHASE01_AUDIT.md). Bộ đếm: 8 module có phần nguồn liên quan (kể cả chỉ host/generator), 10 chưa có triển khai trong repo; 0 firmware module hoàn thiện. PS4Controller ngoài repo không được tính là triển khai trong repo.
