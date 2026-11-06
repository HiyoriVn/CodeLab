# PS4 I2C hardware checkpoint — 2026-11-05

**STOPPED BY USER (quota); resume only on new request.** No further device operations after stop. All capture helpers completed and closed/disposed their serial ports. No motor/servo test, MAC reset, Erase All Flash, commit or push.

| Check | Actual result |
|---|---|
| D1 identity/upload | User confirmed COM5 CP210x VID10C4/PIDEA60. ESP32-D0WD-V3 rev3.1; I2C slave SDA22/SCL21/0x30. Individually approved upload PASS exit0, data hashes verified, EraseFlash=none |
| S3 identity/upload | User confirmed COM4 native USB VID303A/PID1001. ESP32-S3 rev0.2; I2C master SDA8/SCL9/0x30,16MB/OPI,MOCK_ONLY. Individually approved upload PASS exit0, hashes verified, EraseFlash=none |
| PS4 connected | PASS: D1 Serial `BT=1 published_connected=1`, changing sequence |
| I2C frames | PASS after user reconnected wiring.32 S3 status lines over8s, connected1; fresh2528→2874, repeats2726→3093, seq changes/wrap; errors stayed40213 (historical failures, no new increment in this capture) |
| Joystick/buttons | PARTIAL: nonzero LX/LY/RX/RY and changing masks observed; structured movement/button identification and mock wheel-output test deferred |
| Watchdog/disconnect | PS4 disconnect test NOT RUN. Initial bad-bus capture showed neutral axes/buttons/wheels, servo disabled and FAULT; actual disconnect/reconnect timing not validated |

Initial failure: S3 fresh0/errors increased each poll while D1 BT/publisher/bus ready. User replugged SDA/SCL/GND; data started without firmware edits or reflash. Confirmed wiring: D1 SDA22→S3 SDA8, D1 SCL21→S3 SCL9, commonGND; USB only, no DC, loads removed. Exact earlier misconnection not identified. No driver or protocol changes needed.

Actual S3 excerpts (after wiring):
```text
[215ms] MOCK_ONLY connected=1 seq=67 LX=0 LY=0 RX=0 RY=0 buttons=0 FL=0.000 FR=0.000 RL=0.000 RR=0.000 servo_target=90.0 enabled=0 FAULT fault=2 fresh=2528 repeats=2726 errors=40213
[2477ms] MOCK_ONLY connected=1 seq=106 LX=-130 LY=980 RX=990 RY=130 buttons=0 FL=0.000 FR=0.000 RL=0.000 RR=0.000 servo_target=90.0 enabled=0 FAULT fault=2 fresh=2624 repeats=2837 errors=40213
```
Both excerpts are copied from the actual capture. FAULT remains latched from prior bus loss, not a new reception failure; mock wheels remain0 until explicit recovery/arm.

Raw logs (ignored): `ps4_i2c_hw_ports.log`, `_usb.log`, `_d1_upload.log`, `_s3_upload.log`, `_d1_baseline.log`, `_s3_baseline.log`, `_d1_after_wiring.log`, `_s3_after_wiring.log` under this directory. Initial D1 capture had garbled/backlogged prefix; subsequent complete BT status lines were readable. Approved binaries match compile logs: D1 SHA256 D33F247D7B065A04895B94C4B295EA312CF479E3DC5DC68016853DB4DECF33AB; S3 SHA256 86A06C76A4249F6ACC5BABE95D86F07DD8A7C0EE4A2E442F9092CC0FAA9E7367. No rebuild required, reviewed code unchanged since compile.

When user resumes: recheck ports/power/no loads and PS4 link; clear FAULT with sticks/D-pad neutral and PS, Options for mock-only arm; capture controlled stick/buttons/FL-FR-RL-RR, Share disarm, then explicit PS4 disconnect/reconnect and neutral/fault verification. No auto-upload or new firmware unless separately reviewed/approved. Existing I2C firmware continues running while boards powered; stopping capture does not power them off.
