#include <DiagnosticLog.h>
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "Scanner target must be ESP32-S3"
#endif
using namespace codelab::i2cdiag;
bool busReady = false;
void setup() {
  banner("S3_SCANNER_MASTER", 8, 9);
  busReady = Wire.begin(8, 9, uint32_t(100000));
  Wire.setTimeOut(20);
  Serial.printf("INIT ready=%u Hz=%lu timeout_ms=%u\n", unsigned(busReady), (unsigned long)Wire.getClock(), Wire.getTimeOut());
}
void loop() {
  if (!busReady) { Serial.println("INIT_FAILED no transactions"); delay(2000); return; }
  unsigned found = 0;
  for (uint8_t target = 8; target < 0x78; ++target) if (probe(target) == 0) ++found;
  Serial.printf("SCAN_END found=%u expected_D1=0x30; other addresses do not prove D1 present\n", found);
  delay(3000);
}
