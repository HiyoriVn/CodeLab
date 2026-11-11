// Handwritten API client for compile-only verification, not generator output.
#include <CodeLabNewmania.h>

using namespace codelab::newmania;
Board newmania;
ButtonCursor startPulse, countPulse;
double count = 0;

void resetStudent() {
  count = 0;
  startPulse = {};
  countPulse = {};
}

Board::Step studentProgram(Board::Context& context, uint32_t) {
  switch (context.pc) {
    case 0:
      newmania.connectPs4();
      context.pc = 1;
      return Board::Step::YIELD;
    case 1: {
      const bool start = newmania.button(Button::X, ButtonState::Pressed, startPulse);
      if (newmania.button(Button::X, ButtonState::Pressed, countPulse)) newmania.message(++count);
      if (start) {
        newmania.spin(Motor::M1, Direction::Forward, 20);
        return newmania.wait(context, 1000, 2);
      }
      return Board::Step::YIELD;
    }
    case 2:
      newmania.stopMotor(Motor::M1);
      context.pc = 1;
      return Board::Step::YIELD;
    default:
      return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin();
  newmania.registerProgram(1, studentProgram, resetStudent);
}

void loop() { newmania.update(); }
