// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted transport from owner's ps4ble_newmania_firmware.ino. Pairing stays in library.
#include <Arduino.h>
#include <PS4Bluepad32.h>
#include <Bluepad32.h>
#include <Wire.h>
#include <I2CFrame.h>
#include <ReportGate.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "D1 slave requires Classic ESP32, not ESP32-S3"
#endif
#ifndef CODELAB_PS4_I2C_ADDRESS
#define CODELAB_PS4_I2C_ADDRESS 0x30
#endif
static_assert(CODELAB_PS4_I2C_ADDRESS>=0x08&&CODELAB_PS4_I2C_ADDRESS<=0x77,"Invalid 7-bit slave address");
constexpr int dataSda = 16, dataScl = 17;
portMUX_TYPE frameMux=portMUX_INITIALIZER_UNLOCKED;
uint8_t sharedFrame[codelab::ps4i2c::frameSize]={};
uint32_t sharedReportAt=0;
bool resetRequested=false,libraryReady=false,busReady=false;
codelab::ps4i2c::Publisher publisher;
codelab::ps4bridge::ReportGate reportGate;

void onRequest() {
  uint8_t bytes[codelab::ps4i2c::frameSize];
  portENTER_CRITICAL(&frameMux);memcpy(bytes,sharedFrame,sizeof(bytes));const uint32_t reportAt=sharedReportAt;portEXIT_CRITICAL(&frameMux);
  if((bytes[0]&1)&&uint32_t(millis()-reportAt)>codelab::ps4i2c::timeoutMs) {
    bytes[0]&=0xfe;memset(bytes+1,0,sizeof(bytes)-1);
  }
  Wire.write(bytes,sizeof(bytes)); // Coherent snapshot only; never increments report sequence.
}
void onReceive(int length) {
  (void)length;
  while(Wire.available()) {
    const char c=char(Wire.read());
    if(c=='r'||c=='R') { portENTER_CRITICAL(&frameMux);resetRequested=true;portEXIT_CRITICAL(&frameMux); }
  }
}
void setup() {
  Serial.begin(115200);
  libraryReady=ps4::begin(); // Same default LED/NVS/pairing/MAC implementation as supplied image.
  Wire.onReceive(onReceive);Wire.onRequest(onRequest);
  busReady=Wire.begin(uint8_t(CODELAB_PS4_I2C_ADDRESS),dataSda,dataScl,uint32_t(100000));
  // Classic ESP32 WireSlave example preloads the first FIFO response.
  if(busReady) Wire.slaveWrite(sharedFrame,sizeof(sharedFrame));
  Serial.printf("PS4 I2C slave addr=0x%02X SDA=%d SCL=%d ready=%u; binary13+sequence, not old0x55 ASCII\n",
    CODELAB_PS4_I2C_ADDRESS,dataSda,dataScl,busReady?1U:0U);
  Serial.println("Send r explicitly to reset saved MAC; no reset on boot.");
}
void loop() {
  for(unsigned n=0;n<32&&Serial.available();++n) {
    const char c=char(Serial.read());
    if(c=='r'||c=='R') { portENTER_CRITICAL(&frameMux);resetRequested=true;portEXIT_CRITICAL(&frameMux); }
  }
  portENTER_CRITICAL(&frameMux);const bool reset=resetRequested;resetRequested=false;portEXIT_CRITICAL(&frameMux);
  if(reset) {
    publisher.invalidate();reportGate.resetRequested();
    // Deferred out of callback; keep report gate inhibited if reset fails while connected.
    if(ps4::resetMac()) libraryReady=true;
    else Serial.println("MAC reset failed; publisher inhibited");
  }
  const bool updated=libraryReady&&BP32.update();
  const bool connected=libraryReady&&ps4::isConnected();
  ps4::Data data{};
  const bool fresh=reportGate.readFresh(connected,updated,[&](){return ps4::getData(data);});
  codelab::ps4bridge::Input input;
  if(fresh) {input.lx=data.leftX;input.ly=data.leftY;input.rx=data.rightX;input.ry=data.rightY;input.buttons=data.buttons;}
  const auto now=millis();publisher.update(reportGate.allow(connected),fresh,input,now);
  uint8_t bytes[codelab::ps4i2c::frameSize];publisher.bytes(now,bytes);
  portENTER_CRITICAL(&frameMux);memcpy(sharedFrame,bytes,sizeof(bytes));sharedReportAt=publisher.reportAt();portEXIT_CRITICAL(&frameMux);
  static uint32_t printed=0;
  if(uint32_t(now-printed)>=1000) { printed=now;Serial.printf("BT=%u published_connected=%u seq=%u bus=%u\n",
    connected?1U:0U,bytes[0]&1,bytes[0]>>1,busReady?1U:0U); }
  delay(1);
}
