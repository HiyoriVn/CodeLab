// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});


static void resetStudent() {

}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 5; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · hold_m1-block-2
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 2: { // newmania_design_robot_motor_stop · hold_m1-block-7
      newmania.stopMotor(Motor::M1);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // newmania_design_robot_motor_spin · hold_m1-block-5
      newmania.spin(Motor::M1, Direction::Forward, 20.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 4: { // controls_if · hold_m1-block-3
      ctx.pc = (newmania.held(Button::X)) ? 3 : 2; return Board::Step::YIELD;
    }
    case 5: { // newmania_design_ps4_connect · hold_m1-block-1
      newmania.connectPs4();
      ctx.pc = 1; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true);
  newmania.registerProgram(3498768026UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
