#include <Arduino.h>
#include <CodeLabFast4wd.h>
static codelab::fast4wd::Robot robot4wd(100);
#include <Fast4wdSchedulerGate.h>
static codelab::fast4wd::SchedulerGate codelabSchedulerGate(robot4wd);
static codelab::v2::Scheduler codelabScheduler(codelabSchedulerGate);
static bool codelabSchedulerRegistered = true;
static bool codelabProgramStarted = false; static uint32_t codelabMotionEpoch = 0;
static uint8_t codelabDriveMode = 0; static float codelabDriveValues[3] = {};
static bool codelabDriveTimed = false; static uint32_t codelabDriveDeadlineMs = 0;
static uint32_t codelabRunGeneration = 0;
static constexpr size_t CODELAB_LOG_CAPACITY = 8;
static constexpr size_t CODELAB_LOG_MAX_LEN = 128;
static char codelabLogQueue[CODELAB_LOG_CAPACITY][CODELAB_LOG_MAX_LEN] = {};
static uint8_t codelabLogHead = 0, codelabLogTail = 0, codelabLogCount = 0;
static uint32_t codelabLogDrops = 0;
static void codelabResetRunState(uint32_t generation) { if (codelabRunGeneration == generation) return; codelabRunGeneration = generation; codelabDriveMode = 0; codelabDriveTimed = false; codelabDriveDeadlineMs = 0; codelabLogHead = 0; codelabLogTail = 0; codelabLogCount = 0; codelabLogDrops = 0; }
[[maybe_unused]] static bool codelabLogMessage(const char* message) {
  if (!message) return false;
  size_t len = 0;
  while (message[len] != '\0' && len < CODELAB_LOG_MAX_LEN) ++len;
  if (len >= CODELAB_LOG_MAX_LEN || codelabLogCount >= CODELAB_LOG_CAPACITY) { ++codelabLogDrops; return false; }
  for (size_t i = 0; i < len; ++i) codelabLogQueue[codelabLogTail][i] = message[i];
  codelabLogQueue[codelabLogTail][len] = '\0';
  codelabLogTail = (uint8_t)((codelabLogTail + 1U) % CODELAB_LOG_CAPACITY);
  ++codelabLogCount;
  return true;
}
[[maybe_unused]] static bool codelabLogNumber(double value) {
  if (!isfinite(value)) { ++codelabLogDrops; return false; }
  char buf[32] = {};
  const int written = snprintf(buf, sizeof(buf), "%.6g", value);
  if (written <= 0 || (size_t)written >= sizeof(buf)) { ++codelabLogDrops; return false; }
  return codelabLogMessage(buf);
}
[[maybe_unused]] static bool codelabPopLogMessage(char* out, size_t size) {
  if (!codelabLogCount || !out || !size) return false;
  const char* src = codelabLogQueue[codelabLogHead];
  size_t i = 0;
  for (; src[i] != '\0' && i + 1 < size; ++i) out[i] = src[i];
  out[i] = '\0';
  codelabLogHead = (uint8_t)((codelabLogHead + 1U) % CODELAB_LOG_CAPACITY);
  --codelabLogCount;
  return true;
}
[[maybe_unused]] static void codelabDriveFromPs4() { if (!robot4wd.motionAllowed()) return; codelabDriveTimed = false; codelabDriveMode = 1; }
[[maybe_unused]] static void codelabDrive(float forward, float left, float turn) { if (!robot4wd.motionAllowed()) return; codelabDriveTimed = false; codelabDriveMode = 2; codelabDriveValues[0] = forward; codelabDriveValues[1] = left; codelabDriveValues[2] = turn; }
[[maybe_unused]] static void codelabDrivePercent(double forward, double left, double turn) { codelabDrive(isfinite(forward) ? (float)(forward / 100.0) : 0.0f, isfinite(left) ? (float)(left / 100.0) : 0.0f, isfinite(turn) ? (float)(turn / 100.0) : 0.0f); }
[[maybe_unused]] static void codelabDriveStop() { codelabDrive(0.0f, 0.0f, 0.0f); }
[[maybe_unused]] static void codelabDriveForTime(double forward, double left, double turn, uint32_t durationMs, uint32_t nowMs) { if (durationMs == 0) { codelabDriveStop(); return; } codelabDrivePercent(forward, left, turn); codelabDriveTimed = true; codelabDriveDeadlineMs = nowMs + durationMs; }
[[maybe_unused]] static void codelabStopAllMotors(uint32_t nowMs) { for (uint8_t port = 0; port < 4; ++port) codelabScheduler.motorWrite(port, 0, nowMs); codelabDriveStop(); }
[[maybe_unused]] static void codelabUpdateTimedDrive(uint32_t nowMs) { if (codelabDriveTimed && (int32_t)(nowMs - codelabDriveDeadlineMs) >= 0) codelabDriveStop(); }
[[maybe_unused]] static void codelabApplyDrive() { if (codelabDriveMode == 1) robot4wd.driveFromPs4(); else if (codelabDriveMode == 2) robot4wd.move(codelabDriveValues[0], codelabDriveValues[1], codelabDriveValues[2]); }
[[maybe_unused]] static uint32_t codelabSchedulerRepeatCount(double n) { return !isfinite(n) || n <= 0 ? 0 : (n >= UINT32_MAX ? UINT32_MAX : (uint32_t)n); }
[[maybe_unused]] static int16_t codelabSchedulerPower(double n) { return !isfinite(n) ? 0 : (int16_t)(n < 0 ? -1 : 1) * (int16_t)(n < 0 ? (n < -100 ? 100 : -n) : (n > 100 ? 100 : n)); }
static codelab::v2::StepResult codelabScript_4280308515(codelab::v2::ScriptContext& ctx, uint32_t nowMs) {
  codelabResetRunState(ctx.runGeneration);
  if (!codelabScheduler.accountOperations(ctx)) { codelabScheduler.fault(codelab::v2::FaultCode::INLINE_LIMIT, nowMs); return codelab::v2::StepResult::DONE; }
  if (ctx.pc == 0) ctx.pc = 1;
  switch (ctx.pc) {
    case 1: { ctx.pc = 2; return codelab::v2::StepResult::YIELD; }
    case 2: { codelabDriveFromPs4(); ctx.pc = 1; return codelab::v2::StepResult::YIELD; }
    default: return codelab::v2::StepResult::DONE;
  }
}
static void codelabSchedulerLoop() {
  const uint32_t nowMs = millis();
  if (codelabMotionEpoch != robot4wd.motionEpoch()) { codelabMotionEpoch = robot4wd.motionEpoch(); codelabDriveMode = 0; codelabDriveTimed = false; codelabScheduler.cancelMotions(nowMs); }
  if (!codelabProgramStarted && codelabSchedulerRegistered && codelabScheduler.state() == codelab::v2::LifecycleState::READY) codelabProgramStarted = codelabScheduler.startProgram(nowMs);
  if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) { codelabDriveMode = 0; codelabDriveTimed = false; }
  if (codelabScheduler.state() == codelab::v2::LifecycleState::RUN) {
    codelabUpdateTimedDrive(nowMs);
    codelabApplyDrive();
    for (uint8_t button = 0; button < 17; ++button) {
      if (robot4wd.buttonEdge(button, true)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::PRESS, nowMs);
      if (robot4wd.buttonEdge(button, false)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::RELEASE, nowMs);
    }
    codelabScheduler.tick(nowMs);
    codelabUpdateTimedDrive(nowMs);
    if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) { codelabDriveMode = 0; codelabDriveTimed = false; }
    else codelabApplyDrive();
  }
}
void setup() {
  Serial.begin(115200);
  robot4wd.configureBlockly(true, 130303UL, 7);
robot4wd.begin(true);
  codelabSchedulerRegistered = codelabSchedulerRegistered && codelabScheduler.registerScript(4280308515UL, codelabScript_4280308515);
}

void loop() {

  robot4wd.beginLoop();
  codelabSchedulerLoop();
  robot4wd.endLoop();
}
