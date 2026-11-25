#include <DiagnosticLog.h>
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "Master target must be ESP32-S3"
#endif
using namespace codelab::i2cdiag;
bool busReady = false;
uint8_t sequence = 0;
void setup() {
  banner("S3_ECHO_MASTER", 8, 9);
  busReady = Wire.begin(8, 9, uint32_t(100000));
  Wire.setTimeOut(20);
  Serial.printf("INIT ready=%u Hz=%lu timeout_ms=%u\n", unsigned(busReady), (unsigned long)Wire.getClock(), Wire.getTimeOut());
}
void loop() {
  if (!busReady) { Serial.println("INIT_FAILED no transactions"); delay(2000); return; }
  if (probe(address) != 0) { delay(1000); return; }
  uint8_t sent[packetSize]; request(++sequence, sent);
  dump("TX", sent, sizeof(sent));
  Wire.beginTransmission(address);
  const size_t queued = Wire.write(sent, sizeof(sent));
  const uint32_t started = millis();
  const uint8_t code = Wire.endTransmission(true); // STOP, no repeated-start dependency.
  Serial.printf("WRITE queued=%u code=%u %s elapsed_ms=%lu\n", unsigned(queued), code, errorName(code), (unsigned long)(millis()-started));
  if (code || queued != sizeof(sent)) { delay(1000); return; }
  bool confirmed = false;
  const uint32_t waiting = millis();
  // Classic ESP32 preloads a FIFO: an initial read can return the previous reply.
  // Keep the same sequence and retry, instead of falsely accepting an old ACK.
  do {
    delay(10);
    const uint32_t readAt = millis();
    const size_t count = Wire.requestFrom(uint8_t(address), size_t(packetSize), true);
    uint8_t received[packetSize]{}; size_t used = 0;
    while (Wire.available()) { const int b = Wire.read(); if (used < sizeof(received)) received[used++] = uint8_t(b); }
    Serial.printf("READ returned=%u consumed=%u elapsed_ms=%lu driver_code=UNAVAILABLE_IN_WIRE; see Core Debug Level Error log\n",
      unsigned(count), unsigned(used), (unsigned long)(millis()-readAt));
    dump("RX", received, used);
    confirmed = count == packetSize && matches(received, used, sent);
    if (confirmed) break;
    Serial.println("RETRY short/idle/stale/corrupt reply; not an application ACK");
  } while (uint32_t(millis()-waiting) < 300);
  Serial.printf("RESULT seq=%u %s elapsed_ms=%lu\n", sequence, confirmed ? "APP_ACK" : "APP_TIMEOUT", (unsigned long)(millis()-waiting));
  delay(1000);
}
