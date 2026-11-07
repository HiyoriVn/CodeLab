#include <Arduino.h>
#include <Bluepad32.h>
#include <PS4Bluepad32.h>
#include "BridgeConfig.h"
#include "MappingPublisher.h"
#include "ReportGate.h"
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "Bridge requires a Bluetooth Classic ESP32 target, not ESP32-S3"
#endif
namespace {
codelab::ps4bridge::Publisher publisher;
bool libraryReady=false;
codelab::ps4bridge::ReportGate reportGate;
char command[24]={};size_t used=0;bool discard=false;
void resetCommand() {
  publisher.invalidate();reportGate.resetRequested();
  if(ps4::resetMac()) libraryReady=true;
  else Serial.println("RESET_MAC failed; publisher stays inhibited until disconnect");
}
void debugCommands() {
  while(Serial.available()) {
    const char c=(char)Serial.read();
    if(c=='\n') {
      if(used && command[used-1]=='\r') --used;
      command[used]='\0';
      if(!discard && strcmp(command,"RESET_MAC")==0) resetCommand();
      used=0;discard=false;
    } else {
      if(c=='\0'||used>=sizeof(command)-1) discard=true;
      else if(!discard) command[used++]=c;
    }
  }
}
}
void setup() {
  Serial.begin(115200); // Debug only; never CSV output.
  if(bridgePinsAssigned) Serial1.begin(bridgeBaud,SERIAL_8N1,bridgeRx,bridgeTx);
  else Serial.println("UART DISABLED: bridge TX/RX unassigned (compile-only candidate)");
  libraryReady=ps4::begin(bridgeLed); // Disable library's default GPIO2 LED.
}
void loop() {
  debugCommands();
  // ps4::update() discards this boolean; call its underlying API once to retain report evidence.
  const bool updated=libraryReady && BP32.update();
  const bool connected=libraryReady && ps4::isConnected();
  ps4::Data data{};
  const bool fresh=reportGate.readFresh(connected,updated,[&](){return ps4::getData(data);});
  const bool allowed=reportGate.allow(connected);
  codelab::ps4bridge::Input input;
  if(fresh) {input.lx=data.leftX;input.ly=data.leftY;input.rx=data.rightX;input.ry=data.rightY;input.buttons=data.buttons;}
  char frame[96];
  if(publisher.update(allowed,fresh,input,millis(),frame,sizeof(frame)) && bridgePinsAssigned) {
    const size_t length=strlen(frame);
    if((size_t)Serial1.availableForWrite()>=length) Serial1.write((const uint8_t*)frame,length);
    else publisher.invalidate(); // Drop busy output; retry neutral, never queue/replay cached control.
  }
  delay(1);
}
