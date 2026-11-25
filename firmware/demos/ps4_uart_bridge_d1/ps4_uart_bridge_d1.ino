// ============================================================================
// ESP32 D1 (Classic ESP32) — PS4 UART Bridge
// Giao thức: 115200 8N1, gói 16 byte: 0xA5 0x5A + 13B payload + CRC8
// Nối dây sang S3 V2 (UART0):
//   D1 TX (GPIO19) -> S3 RX (GPIO44)
//   D1 RX (GPIO18) <- S3 TX (GPIO43)
//   D1 GND         -- S3 GND (bắt buộc nối chung mass)
// Board Arduino IDE: ESP32 Dev Module (core esp32-bluepad32 4.1.0)
// ============================================================================
#include <Arduino.h>
#include <PS4Bluepad32.h>
#include <Bluepad32.h>
#include <I2CFrame.h>
#include <ReportGate.h>
#include <Ps4MacSerial.h>

static constexpr uint8_t kUartHeader0 = 0xA5;
static constexpr uint8_t kUartHeader1 = 0x5A;
static constexpr uint32_t kUartBaud = 115200;
static constexpr size_t kUartPacketSize = 2 + codelab::ps4i2c::frameSize + 1;

static uint8_t crc8(const uint8_t* data, size_t len) {
  uint8_t crc = 0x00;
  for (size_t i = 0; i < len; ++i) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x80) ? uint8_t((crc << 1) ^ 0x07) : uint8_t(crc << 1);
    }
  }
  return crc;
}

#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "D1 UART bridge requires Classic ESP32, not ESP32-S3"
#endif

// Nếu bị đảo chiều dây TX/RX, chỉ cần đổi 19 <-> 18 ở 2 dòng dưới:
#ifndef UART_TX_PIN
#define UART_TX_PIN 19
#endif
#ifndef UART_RX_PIN
#define UART_RX_PIN 18
#endif
static_assert(UART_TX_PIN != UART_RX_PIN, "TX and RX must use different GPIOs");

bool libraryReady = false;
codelab::ps4i2c::Publisher publisher;
codelab::ps4bridge::ReportGate reportGate;
codelab::ps4bridge::MacSerial macSerial;
uint32_t lastTxAt = 0;

bool resetMac() {
  publisher.invalidate();
  reportGate.resetRequested();
  const bool ok = ps4::resetMac();
  if (ok) libraryReady = true;
  else Serial.println("MAC reset failed");
  return ok;
}

void setup() {
  Serial.begin(115200);
  libraryReady = ps4::begin();
  Serial2.begin(kUartBaud, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);
  Serial.printf("PS4 UART bridge TX=%d RX=%d baud=%lu ready=%u\n",
                UART_TX_PIN, UART_RX_PIN, (unsigned long)kUartBaud,
                libraryReady ? 1U : 0U);
}

void loop() {
  macSerial.poll(Serial, resetMac);
  bool resetRequested = false;
  while (Serial2.available()) {
    const char c = char(Serial2.read());
    if (c == 'r' || c == 'R') resetRequested = true;
  }
  if (resetRequested) resetMac();

  const bool updated = libraryReady && BP32.update();
  const bool connected = libraryReady && ps4::isConnected();
  ps4::Data data{};
  const bool fresh = reportGate.readFresh(connected, updated, [&]() { return ps4::getData(data); });
  codelab::ps4bridge::Input input;
  if (fresh) {
    input.lx = data.leftX;
    input.ly = data.leftY;
    input.rx = data.rightX;
    input.ry = data.rightY;
    input.buttons = data.buttons;
  }
  const uint32_t now = millis();
  publisher.update(reportGate.allow(connected), fresh, input, now);

  if (fresh || uint32_t(now - lastTxAt) >= 15) {
    lastTxAt = now;
    uint8_t payload[codelab::ps4i2c::frameSize];
    publisher.bytes(now, payload);
    uint8_t packet[kUartPacketSize];
    packet[0] = kUartHeader0;
    packet[1] = kUartHeader1;
    memcpy(packet + 2, payload, codelab::ps4i2c::frameSize);
    packet[2 + codelab::ps4i2c::frameSize] = crc8(payload, codelab::ps4i2c::frameSize);
    Serial2.write(packet, sizeof(packet));
  }

  static uint32_t printed = 0;
  if (uint32_t(now - printed) >= 1000) {
    printed = now;
    uint8_t payload[codelab::ps4i2c::frameSize];
    publisher.bytes(now, payload);
    Serial.printf("UART_TX=%d RX=%d BT=%u pub=%u seq=%u\n",
                  UART_TX_PIN, UART_RX_PIN, connected ? 1U : 0U,
                  payload[0] & 1, payload[0] >> 1);
  }
  delay(1);
}
