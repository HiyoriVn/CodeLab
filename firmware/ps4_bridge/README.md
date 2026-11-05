# PS4 bridge — ESP32 Classic compile-only candidate

Architecture: DualShock4 -> PS4Bluepad32 **1.0.1** / Bluepad32 -> UART CSV v1 -> ESP32-S3 mainboard. This target never contains motor/servo control. No Web Pairing, Wi-Fi AP, HTTP server or pairing UI exists here.

## Dependencies and compile

CLI1.5.1; installed **esp32-bluepad32:esp32@4.1.0**, candidate FQBN **esp32-bluepad32:esp32:esp32** (ESP32 Dev Module, Classic capable). This is software compilation only; the physical bridge MCU/flash/board/pins/power are still unknown. It is not an ESP32-S3 target, nor Espressif mainboard Core3.3.7.

`tools/verify-ps4-bridge.ps1` verifies installed core/version and ZIP SHA256, extracts the supplied library with LICENSE into a unique temporary directory **outside this repository**, and supplies it with Arduino CLI `--library`. It does not install/update tools or alter IDE settings. No PS4Bluepad32/Bluepad32 licensed source is vendored in CodeLab. PS4Bluepad32 reports GPL-3.0-or-later; review distribution obligations before distributing linked binaries. Build artifacts/logs stay ignored.

```powershell
pwsh -NoProfile -File tools/verify-ps4-bridge.ps1
```

The command runs compile only; no port enumeration, COM selection, flash or upload. Use the existing approved out-of-sandbox compiler process when needed by Codex.

## Hardware configuration — intentionally unassigned

`BridgeConfig.h`: `CODELAB_BRIDGE_TX=-1`, `CODELAB_BRIDGE_RX=-1`, `CODELAB_BRIDGE_LED=-1`. Both UART pins must be explicitly assigned after hardware review; otherwise data UART stays disabled and debug prints the reason. LED defaults off, including the library's GPIO2 default. Do not take V2 mainboard TX6/RX7 as bridge GPIOs. Pin checks reject Classic ESP32 flash/unavailable pins, input-only TX, duplicate pins and debug-UART conflicts; hardware strapping and board-specific wiring still require review.

Debug uses `Serial` at115200; CSV uses **Serial1 at115200,8N1**. Neither debug logs nor commands are written to Serial1. V2 mainboard RX7 receives bridge TX; mainboard TX6 crosses to bridge RX, common GND,3.3V logic. Do not connect +5V_Core to an unverified bridge supply input. No sample final pinout or power circuit is claimed.

## Report freshness / fail-closed publication

The installed4.1.0 SDK headers document `BP32.update()` returns whether controller data updated and `Controller::hasData()` reports per-update controller data. PS4Bluepad32's void `update()` loses the aggregate boolean, so this thin adapter calls **BP32.update exactly once per loop**, then calls `ps4::getData()` only behind `updated && connected && ReportGate`. `getData` still performs the library's active-controller/hasData/gamepad/NVS checks. There is no second ps4::update call and no change-detection heuristic; identical new reports are valid. Cached hasData with no new update cannot trigger a read/publication. Runtime event semantics must still be checked in A5; this is based on the pinned SDK API contract, not a Bluetooth capture timestamp.

Publisher accepts only real fresh-report events. No fresh event -> no connected frame replay/heartbeat. On disconnect, invalid mapped axes, reset or >250ms without a new report it emits neutral/disconnected, then stays silent until new fresh input. Unsigned time difference handles rollover. Busy UART frames are dropped rather than blocking/queueing cached control; publisher is invalidated to retry neutral. Mainboard A1 also neutralizes after250ms without an accepted frame. CSV v1 has no timestamp/sequence, so publisher discipline is required; it cannot protect against arbitrary third-party replay.

## Pairing and reconnection — no web

After a future approved upload with confirmed hardware, use SHARE+PS on the controller as documented by the library. The library stores the first valid gamepad's MAC in Preferences, rejects a different MAC in its connection callback and permits one active controller. Its filter is not a pre-connection Bluetooth allowlist and does not strictly filter the controller model. Keep other controllers off during pairing.

Normal reconnect relies on the pinned Bluepad32/PS4Bluepad32 stack; actual pairing/persistence/reconnect have not been tested with a controller. Firmware never replays cached controls or issues motor-arm commands. Mainboard robot arming remains a separate safety responsibility; a connected frame is only controller state.

The only reset operation is an explicit debug command **RESET_MAC** followed by LF (CRLF accepted). It invalidates publisher, calls `ps4::resetMac()`, and blocks old connected state until a disconnect is observed before accepting a new report epoch. Reset failure is logged; corrupted stored MAC can recover via a successful reset. This removes the application Preferences MAC and disconnects the controller; it **does not erase Bluetooth bonding keys**. Firmware never calls forgetBluetoothKeys. If replacing a controller, turn the old one off before re-pairing.

See [software verification and A5 prerequisites](../../docs/verification/PS4_FAST_TRACK_A2_A4.md). Do not run A5 hardware actions from this compile task.
