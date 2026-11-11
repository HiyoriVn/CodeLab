#include "fast4wd-platform.h"
#include <cmath>
#include <cstring>
#include <limits>

// Count hardware setup at the existing fake-platform boundary only.
using WireBackend = decltype(Wire);
struct CountingWire : WireBackend {
  unsigned starts = 0;
  bool begin(int sda, int scl, uint32_t hz) { ++starts; return WireBackend::begin(sda, scl, hz); }
} countedWire;
using SerialBackend = decltype(Serial);
struct CountingSerial : SerialBackend {
  unsigned starts = 0;
  void begin(unsigned baud) { ++starts; SerialBackend::begin(baud); }
} countedSerial;
#define Wire countedWire
#define Serial countedSerial
#define PS 230 // ESP32-S3 SDK register macro must remain intact.
#include <CodeLabNewmania.h>
static_assert(PS == 230, "Do not undefine SDK macros");
static_assert(static_cast<uint8_t>(codelab::newmania::Button::Home) == 12, "Keep PS button bit");

using namespace codelab::newmania;
using Step = Board::Step;
using Context = Board::Context;
constexpr uint32_t x = 1U, options = 1U << 9, share = 1U << 8, ps = 1U << 12;
Board* active = nullptr;
enum class Mode { Read, Wait, MotionWait, Idle } mode = Mode::Read;
ButtonCursor pressA, pressB, releaseA, releaseB;
unsigned pressesA = 0, pressesB = 0, releasesA = 0, releasesB = 0;
unsigned resets = 0, initializations = 0, resumed = 0;
double studentVariable = 0;
uint32_t waitedAt = 0, motion = 0, waitDuration = 100;

void readButtons() {
  if (active->button(Button::X, ButtonState::Pressed, pressA)) {
    ++pressesA; ++studentVariable;
    assert(!active->button(Button::X, ButtonState::Pressed, pressA));
  }
  if (active->button(Button::X, ButtonState::Pressed, pressB)) ++pressesB;
  if (active->button(Button::X, ButtonState::Released, releaseA)) {
    ++releasesA;
    assert(!active->button(Button::X, ButtonState::Released, releaseA));
  }
  if (active->button(Button::X, ButtonState::Released, releaseB)) ++releasesB;
}
void resetStudent() { ++resets; studentVariable = 0; }
Step student(Context& ctx, uint32_t) {
  if (ctx.pc == 0) {
    ++initializations;
    assert(active->connectPs4());
    if (mode == Mode::Wait) {
      waitedAt = millis();
      assert(active->spin(Motor::M1, Direction::Forward, 20));
      return active->wait(ctx, waitDuration, 1);
    }
    if (mode == Mode::MotionWait) {
      waitedAt = millis();
      motion = active->runFor(Motor::M1, Direction::Forward, 20, waitDuration);
      assert(motion);
      return active->waitMotion(ctx, motion, 1);
    }
    ctx.pc = 1;
    return Step::YIELD;
  }
  if (ctx.pc == 1 && (mode == Mode::Wait || mode == Mode::MotionWait)) {
    ++resumed;
    active->stopMotor(Motor::M1);
    ctx.pc = 2;
  }
  if (mode != Mode::Idle) readButtons();
  return Step::YIELD; // One main, terminal forever; no extra event scripts.
}

void setupFixture(Board& board, Mode which = Mode::Read, uint32_t start = 0) {
  clockMs = start;
  Wire.report = {};
  Wire.onPoll = nullptr;
  Wire.starts = Serial.starts = 0;
  active = &board; mode = which;
  pressA = {}; pressB = {}; releaseA = {}; releaseB = {};
  pressesA = pressesB = releasesA = releasesB = 0;
  resets = initializations = resumed = 0;
  studentVariable = 42; waitDuration = 100;
  assert(!board.registerProgram(0, student));
  assert(!board.registerProgram(1, nullptr));
  assert(board.registerProgram(1, student, resetStudent));
  assert(!board.registerProgram(2, student));
  board.begin(false);
}
void freshAt(Board& board, uint32_t now, uint32_t buttons = 0,
             int16_t lx = 0, int16_t ly = 0, int16_t rx = 0, int16_t ry = 0) {
  clockMs = now;
  auto& f = Wire.report;
  f.connected = true;
  f.sequence = (f.sequence + 1) & 127;
  f.buttons = buttons;
  f.axes[0] = lx; f.axes[1] = ly; f.axes[2] = rx; f.axes[3] = ry;
  board.update();
}
void fresh(Board& b, uint32_t buttons = 0) { freshAt(b, clockMs + 20, buttons); }
void arm(Board& board, uint32_t held = 0) {
  fresh(board, held); fresh(board, held);
  fresh(board, options | held);
  for (unsigned i = 0; i < 8 && !board.running(); ++i) fresh(board, held);
  assert(board.running());
}
void expectStopped() {
  for (const auto& motor : enabled) for (bool output : motor) assert(!output);
}

void testBootAndIndependentEdges() {
  Board board;
  assert(!board.connectPs4());
  board.update();
  setupFixture(board);
  board.begin();
  for (unsigned i = 0; i < 20; ++i) board.connectPs4();
  assert(Wire.starts == 1 && Serial.starts == 1);
  assert(!board.running());
  assert(!board.power(Motor::M1, 100));
  expectStopped();
  arm(board, x); // A held button on initial connection/RUN is not a press.
  assert(resets == 1 && initializations == 1 && studentVariable == 0);
  assert(board.held(Button::X));
  assert(pressesA == 0 && pressesB == 0);
  fresh(board, x); fresh(board, x);
  assert(pressesA == 0);
  fresh(board);
  assert(releasesA == 1 && releasesB == 1);
  fresh(board, x);
  assert(pressesA == 1 && pressesB == 1 && studentVariable == 1);
  for (unsigned i = 0; i < 5; ++i) { clockMs += 10; board.update(); }
  assert(pressesA == 1 && pressesB == 1); // Cached polls/held X never repeat.
  fresh(board);
  assert(releasesA == 2 && releasesB == 2);
  for (unsigned i = 0; i < 140; ++i) fresh(board, i % 2 ? 0 : x);
  assert(pressesA == 71 && pressesB == 71); // Includes I2C sequence wrap.
  assert(releasesA == 72 && releasesB == 72);
  assert(!board.button(static_cast<Button>(255), ButtonState::Pressed, pressA));
  assert(board.axis(static_cast<Axis>(255)) == 0);
  freshAt(board, clockMs + 20, 0, 32767, -32768, 32767, -32768);
  assert(board.axis(Axis::LeftX) == 100 && board.axis(Axis::LeftY) == -100);
  assert(board.axis(Axis::RightX) == 100 && board.axis(Axis::RightY) == -100);
  assert(Wire.starts == 1 && Serial.starts == 1);
  fresh(board, share); assert(!board.running()); expectStopped();
}

void testWaitDropsEdgesAndRestarts() {
  Board board; setupFixture(board, Mode::Wait); arm(board);
  const uint32_t began = waitedAt;
  freshAt(board, began + 20, x);
  freshAt(board, began + 40);
  freshAt(board, began + 60, x);
  freshAt(board, began + 80, x);
  assert(resumed == 0 && board.heartbeatAt() >= began + 80);
  freshAt(board, began + 100, x);
  assert(resumed == 1 && board.held(Button::X));
  assert(pressesA == 0 && releasesA == 0);
  expectStopped();
  fresh(board);
  assert(releasesA == 1 && releasesB == 1);
  fresh(board, x); assert(pressesA == 1 && pressesB == 1);
  const uint32_t generation = board.runGeneration();
  fresh(board, share); assert(!board.running()); expectStopped();
  fresh(board);
  for (unsigned i = 0; i < 3; ++i) fresh(board);
  assert(resets == 1 && resumed == 1);
  arm(board);
  assert(resets == 2 && initializations == 2 && board.runGeneration() != generation);
  assert(studentVariable == 0 && Wire.starts == 1);
  fresh(board, share); assert(!board.running()); expectStopped();
  const auto continuations = resumed;
  for (unsigned i = 0; i < 8; ++i) fresh(board);
  assert(resumed == continuations); // Canceled wait never resumes after STOP.
}

void testWaitTimeoutRecoveryAndWrap() {
  Board board; setupFixture(board, Mode::MotionWait, 0xfffffe00U); arm(board);
  const auto began = waitedAt;
  for (unsigned elapsed = 20; elapsed <= 100; elapsed += 20) freshAt(board, began + elapsed);
  assert(resumed == 1 && !board.motionActive(motion)); expectStopped();
  fresh(board, share); fresh(board); waitDuration = 1000; arm(board);
  assert(initializations == 2);
  const auto resumedBeforeTimeout = resumed;
  // The bus keeps returning the same report while Wait/control updates run.
  const auto lastFresh = clockMs;
  for (unsigned elapsed = 20; elapsed <= 280; elapsed += 20) {
    clockMs = lastFresh + elapsed; board.update();
  }
  assert(!board.connected() && !board.running()); expectStopped();
  assert(resumed == resumedBeforeTimeout);
  const auto before = resets;
  fresh(board); fresh(board); fresh(board);
  assert(board.connected() && !board.running() && resets == before);
  assert(!board.power(Motor::M1, 20));
  fresh(board, ps); fresh(board); arm(board);
  assert(resets == before + 1 && Wire.starts == 1);
  fresh(board, share); expectStopped();
}

void testMotionOwnershipAndDrive() {
  Board board(25); setupFixture(board, Mode::Idle); arm(board);
  const auto handle = board.runFor(Motor::M2, Direction::Forward, 80, 160);
  assert(handle && board.motionActive(handle));
  for (unsigned i = 0; i < 4; ++i) fresh(board);
  assert(std::fabs(board.motorPwm(Motor::M2) - 63 * (100.0f / 255)) < 0.01f);
  assert(board.power(Motor::M2, -20));
  assert(!board.motionActive(handle)); // Existing latest-write ownership.
  for (unsigned i = 0; i < 12; ++i) fresh(board);
  assert(board.motorPwm(Motor::M2) < -19);
  board.stopAllMotors(); fresh(board); expectStopped();
  assert(board.running()); // stop-all is not DISARM.
  assert(!board.runFor(Motor::M1, Direction::Forward, 20, 0));
  assert(!board.runFor(Motor::M1, Direction::Forward, 20, 5001));
  assert(!board.power(static_cast<Motor>(4), 20));
  assert(board.power(Motor::M1, std::numeric_limits<double>::infinity()));
  for (unsigned port = 0; port < 4; ++port) board.releaseMotor(static_cast<Motor>(port));
  board.mecanum(20, 0, 0);
  for (unsigned i = 0; i < 8; ++i) fresh(board);
  // Existing mixed forward signs, including M1/M2 inversion, are retained.
  assert(board.motorPwm(Motor::M1) > 0 && board.motorPwm(Motor::M2) > 0);
  assert(board.motorPwm(Motor::M3) > 0 && board.motorPwm(Motor::M4) > 0);
  assert(board.driveFor(0, 20, 0, 80));
  const auto began = clockMs;
  for (unsigned elapsed = 20; elapsed <= 180; elapsed += 20) freshAt(board, began + elapsed);
  for (unsigned i = 0; i < 4; ++i) fresh(board);
  expectStopped(); assert(board.running());
  assert(!board.driveFor(0, 20, 0, 60001));
  fresh(board, share); expectStopped();
}

void testDelayedReaders() {
  Board board; setupFixture(board, Mode::Idle); arm(board);
  fresh(board, x); fresh(board, x); fresh(board);
  fresh(board, x); fresh(board); // Two real presses before these readers execute.
  ButtonCursor first, second;
  assert(board.button(Button::X, ButtonState::Pressed, first));
  assert(board.button(Button::X, ButtonState::Pressed, first));
  assert(!board.button(Button::X, ButtonState::Pressed, first));
  assert(board.button(Button::X, ButtonState::Pressed, second));
  assert(board.button(Button::X, ButtonState::Pressed, second));
  assert(!board.button(Button::X, ButtonState::Pressed, second));
  assert(!board.held(Button::X));
  ButtonCursor release;
  assert(board.button(Button::X, ButtonState::Released, release));
  Context ctx; ctx.scriptUid = 1; ctx.runGeneration = board.runGeneration();
  assert(board.wait(ctx, 10, 1) == Step::WAIT);
  ButtonCursor afterWait;
  assert(!board.button(Button::X, ButtonState::Pressed, afterWait));
  assert(!board.button(Button::X, ButtonState::Released, afterWait));
  fresh(board, share); expectStopped();
}

void testMessagesAndStaleContexts() {
  Board board; setupFixture(board, Mode::Idle);
  assert(!board.message(static_cast<const char*>(nullptr)));
  for (unsigned i = 0; i < 8; ++i) assert(board.message(double(i)));
  assert(!board.message("overflow") && board.messageDrops() == 1);
  char text[128]; assert(board.popMessage(text, sizeof(text)) && std::strcmp(text, "0") == 0);
  char longText[129]; std::memset(longText, 'a', 128); longText[128] = 0;
  assert(!board.message(longText));
  assert(!board.message(std::numeric_limits<double>::quiet_NaN()));
  arm(board); assert(board.messageDrops() == 0 && !board.popMessage(text, sizeof(text)));
  assert(board.message(0)); // Integer zero must not collide with the text overload.
  assert(board.popMessage(text, sizeof(text)) && std::strcmp(text, "0") == 0);
  Context stale; stale.scriptUid = 1; stale.runGeneration = board.runGeneration() - 1;
  assert(board.wait(stale, 20, 2) == Step::DONE);
  assert(board.waitMotion(stale, 1, 2) == Step::DONE);
  Context current; current.scriptUid = 1; current.runGeneration = board.runGeneration();
  assert(board.wait(current, 60001, 2) == Step::DONE);
  assert(board.state() == codelab::v2::LifecycleState::FAULT);
  assert(!board.power(Motor::M1, 20));
  fresh(board); expectStopped();
}

void testHeldOptionsDoesNotStart() {
  Board board; setupFixture(board, Mode::Idle);
  for (unsigned i = 0; i < 5; ++i) fresh(board, options);
  assert(board.connected() && !board.running() && resets == 0);
  expectStopped();
  fresh(board); fresh(board, options);
  for (unsigned i = 0; i < 8 && !board.running(); ++i) fresh(board);
  assert(board.running() && resets == 1);
  Wire.report.connected = false;
  clockMs += 20; board.update();
  assert(!board.running()); expectStopped();
  for (unsigned i = 0; i < 5; ++i) fresh(board, options);
  assert(board.connected() && !board.running() && resets == 1);
  expectStopped();
}

int main() {
  testBootAndIndependentEdges();
  testWaitDropsEdgesAndRestarts();
  testWaitTimeoutRecoveryAndWrap();
  testMotionOwnershipAndDrive();
  testDelayedReaders();
  testMessagesAndStaleContexts();
  testHeldOptionsDoesNotStart();
  std::puts("PASS: boot/ARM, independent edges, wait/STOP/link/wrap, ownership, messages and stale generations");
}
