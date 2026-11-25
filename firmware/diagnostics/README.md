# I2C diagnostics — D1 slave / S3 master

Current owner-confirmed wiring: **D1 SDA16 → S3 SDA8; D1 SCL17 → S3 SCL9; common GND**. Address0x30,100kHz, Serial115200. No GPIO remapping, actuators or radio/pairing code.

- `i2c_scanner_s3`: address-only scan0x08–0x77, ACK/NACK/error logs.
- `i2c_echo_slave_d1`: Classic ESP32 receive/request callbacks and deferred Serial hex logs.
- `i2c_echo_master_s3`: sequence/payload/checksum round trip with bounded retries.

**Use the two echo sketches together. Do not run echo master against the PS4 bridge:** arbitrary bytes can trigger its existing r/R MAC-reset command. Scanner sends no payload. Slave queued counts do not prove on-wire delivery; master APP_ACK verifies the current packet. First idle/previous FIFO reply may occur on Classic ESP32.

Compile only, from repository root:

```powershell
./tools/verify-i2c-diagnostic.ps1 -Target Slave
./tools/verify-i2c-diagnostic.ps1 -Target Scanner
./tools/verify-i2c-diagnostic.ps1 -Target Master
```

Helpers: `firmware/libraries/CodeLabI2CDiagnostic`; no install/update. S3 script preserves existing16MB/OPI target; confirm actual board before any manual upload. Use Core Debug Level Error for manual compilation. All 3 targets (`Scanner`, `Master`, `Slave`) compile PASS (exit 0) and host/mock checks pass; device behavior remains unverified until manual upload and hardware log review.

[Full evidence, source locations, log interpretation and device procedure](../../docs/verification/I2C_DIAGNOSTIC_2026_11_20.md). Upload requires separate owner approval/confirmed port. USB-only, no loads or power-rail tie,3.3V signal pull-ups. Verification script has no upload/COM commands.
