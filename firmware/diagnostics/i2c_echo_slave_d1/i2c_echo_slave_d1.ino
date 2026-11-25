#include <DiagnosticLog.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "Slave target must be Classic ESP32 (D1), not ESP8266 or ESP32-S3"
#endif
using namespace codelab::i2cdiag;
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
uint8_t response[packetSize]{}, lastRx[packetSize]{}, lastTx[packetSize]{};
uint32_t rxEvents = 0, txEvents = 0, invalidEvents = 0;
size_t lastRxCount = 0, lastQueued = 0;
int lastAnnounced = 0;
bool busReady = false;
void receivePacket(int length) {
  uint8_t bytes[packetSize]{}; size_t used = 0, total = 0;
  while (Wire.available()) { const int b = Wire.read(); if (used < sizeof(bytes)) bytes[used++] = uint8_t(b); ++total; }
  uint8_t next[packetSize]{};
  const bool valid = length == int(packetSize) && total == packetSize && reply(bytes, total, next);
  portENTER_CRITICAL(&mux);
  memcpy(lastRx, bytes, sizeof(bytes)); lastRxCount = total; lastAnnounced = length;
  memcpy(response, next, sizeof(next)); ++rxEvents; if (!valid) ++invalidEvents;
  portEXIT_CRITICAL(&mux);
}
void requestPacket() {
  uint8_t bytes[packetSize];
  portENTER_CRITICAL(&mux); memcpy(bytes, response, sizeof(bytes)); portEXIT_CRITICAL(&mux);
  const size_t queued = Wire.write(bytes, sizeof(bytes));
  portENTER_CRITICAL(&mux);
  memcpy(lastTx, bytes, sizeof(bytes)); lastQueued = queued; ++txEvents;
  portEXIT_CRITICAL(&mux);
  // No Serial, delay, Bluetooth or protocol side effects inside callbacks.
}
void setup() {
  banner("D1_ECHO_SLAVE", 16, 17);
  Wire.onReceive(receivePacket); Wire.onRequest(requestPacket);
  Wire.setTimeOut(20);
  busReady = Wire.begin(uint8_t(address), 16, 17, uint32_t(100000));
  const size_t preload = busReady ? Wire.slaveWrite(response, sizeof(response)) : 0;
  Serial.printf("INIT ready=%u FIFO_preload=%u; waiting for master; no bus ACK evidence yet\n", unsigned(busReady), unsigned(preload));
}
void loop() {
  static uint32_t printed = 0;
  if (uint32_t(millis()-printed) < 1000) { delay(1); return; }
  printed = millis();
  uint8_t rx[packetSize], tx[packetSize]; uint32_t received, requested, invalid; size_t count, queued; int announced;
  portENTER_CRITICAL(&mux);
  memcpy(rx,lastRx,sizeof(rx)); memcpy(tx,lastTx,sizeof(tx));
  received=rxEvents; requested=txEvents; invalid=invalidEvents; count=lastRxCount; queued=lastQueued; announced=lastAnnounced;
  portEXIT_CRITICAL(&mux);
  Serial.printf("SLAVE ready=%u rx_events=%lu request_callbacks=%lu invalid=%lu announced=%d RX_total=%u TX_queued=%u\n",
    unsigned(busReady),(unsigned long)received,(unsigned long)requested,(unsigned long)invalid,announced,unsigned(count),unsigned(queued));
  if (received) dump("RX_LAST (max 8 bytes)",rx,count < packetSize ? count : packetSize);
  if (requested) dump("TX_LAST_QUEUED (not proof of on-wire delivery)",tx,sizeof(tx));
}
