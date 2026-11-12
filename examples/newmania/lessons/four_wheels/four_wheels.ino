// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});


static void resetStudent() {

}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 26; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · four_wheels-49
      ctx.pc = 25; return Board::Step::YIELD;
    }
    case 2: { // newmania_design_robot_motor_power · four_wheels-43
      newmania.power(Motor::M4, 0.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // newmania_design_robot_motor_power · four_wheels-41
      newmania.power(Motor::M3, 0.0);
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 4: { // newmania_design_robot_motor_power · four_wheels-39
      newmania.power(Motor::M2, 0.0);
      ctx.pc = 3; return Board::Step::YIELD;
    }
    case 5: { // newmania_design_robot_motor_power · four_wheels-37
      newmania.power(Motor::M1, 0.0);
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 6: { // newmania_design_robot_motor_power · four_wheels-35
      newmania.power(Motor::M4, -30.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 7: { // newmania_design_robot_motor_power · four_wheels-33
      newmania.power(Motor::M3, 30.0);
      ctx.pc = 6; return Board::Step::YIELD;
    }
    case 8: { // newmania_design_robot_motor_power · four_wheels-31
      newmania.power(Motor::M2, -30.0);
      ctx.pc = 7; return Board::Step::YIELD;
    }
    case 9: { // newmania_design_robot_motor_power · four_wheels-29
      newmania.power(Motor::M1, 30.0);
      ctx.pc = 8; return Board::Step::YIELD;
    }
    case 10: { // controls_if · four_wheels-44
      ctx.pc = (newmania.held(Button::Right)) ? 9 : 5; return Board::Step::YIELD;
    }
    case 11: { // newmania_design_robot_motor_power · four_wheels-26
      newmania.power(Motor::M4, 30.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 12: { // newmania_design_robot_motor_power · four_wheels-24
      newmania.power(Motor::M3, -30.0);
      ctx.pc = 11; return Board::Step::YIELD;
    }
    case 13: { // newmania_design_robot_motor_power · four_wheels-22
      newmania.power(Motor::M2, 30.0);
      ctx.pc = 12; return Board::Step::YIELD;
    }
    case 14: { // newmania_design_robot_motor_power · four_wheels-20
      newmania.power(Motor::M1, -30.0);
      ctx.pc = 13; return Board::Step::YIELD;
    }
    case 15: { // controls_if · four_wheels-45
      ctx.pc = (newmania.held(Button::Left)) ? 14 : 10; return Board::Step::YIELD;
    }
    case 16: { // newmania_design_robot_motor_power · four_wheels-17
      newmania.power(Motor::M4, -30.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 17: { // newmania_design_robot_motor_power · four_wheels-15
      newmania.power(Motor::M3, -30.0);
      ctx.pc = 16; return Board::Step::YIELD;
    }
    case 18: { // newmania_design_robot_motor_power · four_wheels-13
      newmania.power(Motor::M2, -30.0);
      ctx.pc = 17; return Board::Step::YIELD;
    }
    case 19: { // newmania_design_robot_motor_power · four_wheels-11
      newmania.power(Motor::M1, -30.0);
      ctx.pc = 18; return Board::Step::YIELD;
    }
    case 20: { // controls_if · four_wheels-46
      ctx.pc = (newmania.held(Button::Down)) ? 19 : 15; return Board::Step::YIELD;
    }
    case 21: { // newmania_design_robot_motor_power · four_wheels-8
      newmania.power(Motor::M4, 30.0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 22: { // newmania_design_robot_motor_power · four_wheels-6
      newmania.power(Motor::M3, 30.0);
      ctx.pc = 21; return Board::Step::YIELD;
    }
    case 23: { // newmania_design_robot_motor_power · four_wheels-4
      newmania.power(Motor::M2, 30.0);
      ctx.pc = 22; return Board::Step::YIELD;
    }
    case 24: { // newmania_design_robot_motor_power · four_wheels-2
      newmania.power(Motor::M1, 30.0);
      ctx.pc = 23; return Board::Step::YIELD;
    }
    case 25: { // controls_if · four_wheels-47
      ctx.pc = (newmania.held(Button::Up)) ? 24 : 20; return Board::Step::YIELD;
    }
    case 26: { // newmania_design_ps4_connect · four_wheels-48
      newmania.connectPs4();
      ctx.pc = 1; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 122880UL, 0);
  newmania.registerProgram(3582968592UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
