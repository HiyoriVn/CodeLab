#include <Arduino.h>
#include "DemoConfig.h"
#include "DemoRuntime.h"
#include "GeneratedPs4Parser.h"

// One mainboard demo: real CSV UART consumer when wiring is confirmed,
// USB diagnostics and bounded console; actual onboard actuators remain locked.
CodeLabPS4Adapter ps4Input;
demo::Runtime robot;
char consoleLine[64]={}; size_t consoleUsed=0; bool consoleDiscard=false;

void help() {
  Serial.println("Newmania PS4 demo: MONITOR by default, ACTUATORS=BLOCKED");
  Serial.println("USB: STATUS HELP DISARM CLEAR SIM_ON SIM_OFF SERVO_SIM_ENABLE");
  Serial.println("SIM commands affect mocks only. Options=arm(neutral), Share=disarm, PS=clear(fresh/neutral)");
  Serial.println("Hardware MOTOR/SERVO/ARM commands rejected: onboard mapping/truth table/power unverified");
}
void consoleTick() {
  // Bounded work; USB command floods cannot monopolize the controller tick.
  for(unsigned budget=0;budget<64&&Serial.available();++budget) {
    const char c=char(Serial.read());
    if(c=='\n') {
      if(consoleUsed&&consoleLine[consoleUsed-1]=='\r') --consoleUsed;
      consoleLine[consoleUsed]='\0';
      if(consoleDiscard) Serial.println("ERROR: command too long/NUL, discarded");
      else if(consoleUsed) {
        const auto result=robot.command(consoleLine);
        Serial.println(result==demo::CommandResult::OK?"OK (mock/monitor only)":
          result==demo::CommandResult::BLOCKED?"BLOCKED: no verified hardware actuator backend":"UNKNOWN: send HELP");
        if(strcmp(consoleLine,"HELP")==0) help();
      }
      consoleUsed=0;consoleDiscard=false;
    } else if(c=='\0'||consoleUsed>=sizeof(consoleLine)-1) consoleDiscard=true;
    else if(!consoleDiscard) consoleLine[consoleUsed++]=c;
  }
}
void setup() {
  Serial.begin(115200);
  if(demo::uartEnabled) {
    Serial1.begin(demo::baud,SERIAL_8N1,demo::rx,demo::tx);
    ps4Input.beginUart(Serial1);
  }
  help();
  Serial.printf("UART=%s RX=%d TX=%d baud=%u; Flash16MB/OPI preserved\n",
    demo::uartEnabled?"ENABLED":"DISABLED_UNCONFIRMED",demo::rx,demo::tx,demo::baud);
}
void loop() {
  consoleTick(); ps4Input.update();
  const auto now=millis(); const auto input=codelab::robot::snapshot(ps4Input);
  robot.tick(input,now);
  static uint32_t printed=0;
  if(uint32_t(now-printed)>=250) {
    printed=now;
    Serial.printf("UART=%u MODE=%s ACTUATORS=BLOCKED connected=%u age_ms=%lu state=%u fault=%u axes=%d,%d,%d,%d buttons=%lu wheels=%.3f,%.3f,%.3f,%.3f servo_mock=%.1f/%u\n",
      demo::uartEnabled?1U:0U,robot.simulation()?"SIM_ONLY":"MONITOR",
      input.connected?1U:0U,(unsigned long)(now-input.reportAt),unsigned(robot.controller().state()),unsigned(robot.controller().fault()),
      input.lx,input.ly,input.rx,input.ry,(unsigned long)input.buttons,
      robot.motors().speeds[0],robot.motors().speeds[1],robot.motors().speeds[2],robot.motors().speeds[3],
      robot.controller().servo().angle(),robot.servo().enabled?1U:0U);
  }
  delay(5);
}
