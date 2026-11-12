// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});
static double student_var_0 = 0;
static double student_var_1 = 0;
static double student_var_2 = 0;
static double student_var_3 = 0;
static double student_var_4 = 0;
static double student_var_5 = 0;
static double student_var_6 = 0;
static double student_var_7 = 0;

static void resetStudent() {
  student_var_0 = 0;
  student_var_1 = 0;
  student_var_2 = 0;
  student_var_3 = 0;
  student_var_4 = 0;
  student_var_5 = 0;
  student_var_6 = 0;
  student_var_7 = 0;
}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 37; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · joystick_math-182
      ctx.pc = 36; return Board::Step::YIELD;
    }
    case 2: { // newmania_design_robot_motor_power · joystick_math-180
      newmania.power(Motor::M4, Math::clamp({((student_var_6 / student_var_7) * 100.0), -100.0, 100.0}));
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // newmania_design_robot_motor_power · joystick_math-171
      newmania.power(Motor::M3, Math::clamp({((student_var_5 / student_var_7) * 100.0), -100.0, 100.0}));
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 4: { // newmania_design_robot_motor_power · joystick_math-162
      newmania.power(Motor::M2, Math::clamp({((student_var_4 / student_var_7) * 100.0), -100.0, 100.0}));
      ctx.pc = 3; return Board::Step::YIELD;
    }
    case 5: { // newmania_design_robot_motor_power · joystick_math-153
      newmania.power(Motor::M1, Math::clamp({((student_var_3 / student_var_7) * 100.0), -100.0, 100.0}));
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 6: { // variables_set · joystick_math-143
      student_var_7 = std::fabs(student_var_6);
      ctx.pc = 5; return Board::Step::YIELD;
    }
    case 7: { // controls_if · joystick_math-144
      ctx.pc = ((std::fabs(student_var_6) > student_var_7)) ? 6 : 5; return Board::Step::YIELD;
    }
    case 8: { // variables_set · joystick_math-135
      student_var_7 = std::fabs(student_var_5);
      ctx.pc = 7; return Board::Step::YIELD;
    }
    case 9: { // controls_if · joystick_math-136
      ctx.pc = ((std::fabs(student_var_5) > student_var_7)) ? 8 : 7; return Board::Step::YIELD;
    }
    case 10: { // variables_set · joystick_math-127
      student_var_7 = std::fabs(student_var_4);
      ctx.pc = 9; return Board::Step::YIELD;
    }
    case 11: { // controls_if · joystick_math-128
      ctx.pc = ((std::fabs(student_var_4) > student_var_7)) ? 10 : 9; return Board::Step::YIELD;
    }
    case 12: { // variables_set · joystick_math-119
      student_var_7 = std::fabs(student_var_3);
      ctx.pc = 11; return Board::Step::YIELD;
    }
    case 13: { // controls_if · joystick_math-120
      ctx.pc = ((std::fabs(student_var_3) > student_var_7)) ? 12 : 11; return Board::Step::YIELD;
    }
    case 14: { // variables_set · joystick_math-112
      student_var_7 = 100.0;
      ctx.pc = 13; return Board::Step::YIELD;
    }
    case 15: { // variables_set · joystick_math-110
      student_var_6 = ((student_var_0 - student_var_2) + student_var_1);
      ctx.pc = 14; return Board::Step::YIELD;
    }
    case 16: { // variables_set · joystick_math-104
      student_var_5 = ((student_var_0 + student_var_2) - student_var_1);
      ctx.pc = 15; return Board::Step::YIELD;
    }
    case 17: { // variables_set · joystick_math-98
      student_var_4 = ((student_var_0 + student_var_2) + student_var_1);
      ctx.pc = 16; return Board::Step::YIELD;
    }
    case 18: { // variables_set · joystick_math-92
      student_var_3 = ((student_var_0 - student_var_2) - student_var_1);
      ctx.pc = 17; return Board::Step::YIELD;
    }
    case 19: { // variables_set · joystick_math-84
      student_var_2 = (((student_var_2 + 6.0) * 100.0) / 94.0);
      ctx.pc = 18; return Board::Step::YIELD;
    }
    case 20: { // variables_set · joystick_math-76
      student_var_2 = (((student_var_2 - 6.0) * 100.0) / 94.0);
      ctx.pc = 18; return Board::Step::YIELD;
    }
    case 21: { // controls_if · joystick_math-85
      ctx.pc = ((student_var_2 > 0.0)) ? 20 : 19; return Board::Step::YIELD;
    }
    case 22: { // variables_set · joystick_math-65
      student_var_2 = 0.0;
      ctx.pc = 18; return Board::Step::YIELD;
    }
    case 23: { // controls_if · joystick_math-86
      ctx.pc = ((std::fabs(student_var_2) <= 6.0)) ? 22 : 21; return Board::Step::YIELD;
    }
    case 24: { // variables_set · joystick_math-59
      student_var_2 = newmania.axis(Axis::RightX);
      ctx.pc = 23; return Board::Step::YIELD;
    }
    case 25: { // variables_set · joystick_math-55
      student_var_1 = (((student_var_1 + 6.0) * 100.0) / 94.0);
      ctx.pc = 24; return Board::Step::YIELD;
    }
    case 26: { // variables_set · joystick_math-47
      student_var_1 = (((student_var_1 - 6.0) * 100.0) / 94.0);
      ctx.pc = 24; return Board::Step::YIELD;
    }
    case 27: { // controls_if · joystick_math-56
      ctx.pc = ((student_var_1 > 0.0)) ? 26 : 25; return Board::Step::YIELD;
    }
    case 28: { // variables_set · joystick_math-36
      student_var_1 = 0.0;
      ctx.pc = 24; return Board::Step::YIELD;
    }
    case 29: { // controls_if · joystick_math-57
      ctx.pc = ((std::fabs(student_var_1) <= 6.0)) ? 28 : 27; return Board::Step::YIELD;
    }
    case 30: { // variables_set · joystick_math-30
      student_var_1 = newmania.axis(Axis::LeftX);
      ctx.pc = 29; return Board::Step::YIELD;
    }
    case 31: { // variables_set · joystick_math-26
      student_var_0 = (((student_var_0 + 6.0) * 100.0) / 94.0);
      ctx.pc = 30; return Board::Step::YIELD;
    }
    case 32: { // variables_set · joystick_math-18
      student_var_0 = (((student_var_0 - 6.0) * 100.0) / 94.0);
      ctx.pc = 30; return Board::Step::YIELD;
    }
    case 33: { // controls_if · joystick_math-27
      ctx.pc = ((student_var_0 > 0.0)) ? 32 : 31; return Board::Step::YIELD;
    }
    case 34: { // variables_set · joystick_math-7
      student_var_0 = 0.0;
      ctx.pc = 30; return Board::Step::YIELD;
    }
    case 35: { // controls_if · joystick_math-28
      ctx.pc = ((std::fabs(student_var_0) <= 6.0)) ? 34 : 33; return Board::Step::YIELD;
    }
    case 36: { // variables_set · joystick_math-1
      student_var_0 = newmania.axis(Axis::LeftY);
      ctx.pc = 35; return Board::Step::YIELD;
    }
    case 37: { // newmania_design_ps4_connect · joystick_math-181
      newmania.connectPs4();
      ctx.pc = 1; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 130303UL, 7);
  newmania.registerProgram(543212937UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
