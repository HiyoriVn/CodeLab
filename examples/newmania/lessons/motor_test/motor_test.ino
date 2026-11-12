// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});
static double student_var_0 = 0;
static ButtonCursor student_button_0;

static void resetStudent() {
  student_var_0 = 0;
  student_button_0 = {};
}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 17; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · motor_test-36
      ctx.pc = 15; return Board::Step::YIELD;
    }
    case 2: { // newmania_design_robot_motor_stop · motor_test-33
      newmania.stopMotor(Motor::M4);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // newmania_design_robot_motor_power · motor_test-32
      newmania.power(Motor::M4, (50.0 * student_var_0));
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 4: { // controls_if · motor_test-34
      ctx.pc = (newmania.held(Button::Right)) ? 3 : 2; return Board::Step::YIELD;
    }
    case 5: { // newmania_design_robot_motor_stop · motor_test-26
      newmania.stopMotor(Motor::M3);
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 6: { // newmania_design_robot_motor_power · motor_test-25
      newmania.power(Motor::M3, (50.0 * student_var_0));
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 7: { // controls_if · motor_test-27
      ctx.pc = (newmania.held(Button::Left)) ? 6 : 5; return Board::Step::YIELD;
    }
    case 8: { // newmania_design_robot_motor_stop · motor_test-19
      newmania.stopMotor(Motor::M2);
      ctx.pc = 7; return Board::Step::YIELD;
    }
    case 9: { // newmania_design_robot_motor_power · motor_test-18
      newmania.power(Motor::M2, (50.0 * student_var_0));
      ctx.pc = 7; return Board::Step::YIELD;
    }
    case 10: { // controls_if · motor_test-20
      ctx.pc = (newmania.held(Button::Down)) ? 9 : 8; return Board::Step::YIELD;
    }
    case 11: { // newmania_design_robot_motor_stop · motor_test-12
      newmania.stopMotor(Motor::M1);
      ctx.pc = 10; return Board::Step::YIELD;
    }
    case 12: { // newmania_design_robot_motor_power · motor_test-11
      newmania.power(Motor::M1, (50.0 * student_var_0));
      ctx.pc = 10; return Board::Step::YIELD;
    }
    case 13: { // controls_if · motor_test-13
      ctx.pc = (newmania.held(Button::Up)) ? 12 : 11; return Board::Step::YIELD;
    }
    case 14: { // variables_set · motor_test-5
      student_var_0 = (-(student_var_0));
      ctx.pc = 13; return Board::Step::YIELD;
    }
    case 15: { // controls_if · motor_test-6
      ctx.pc = (newmania.button(Button::L1, ButtonState::Pressed, student_button_0)) ? 14 : 13; return Board::Step::YIELD;
    }
    case 16: { // variables_set · motor_test-1
      student_var_0 = 1.0;
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 17: { // newmania_design_ps4_connect · motor_test-35
      newmania.connectPs4();
      ctx.pc = 16; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 122896UL, 0);
  newmania.registerProgram(1769971556UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
