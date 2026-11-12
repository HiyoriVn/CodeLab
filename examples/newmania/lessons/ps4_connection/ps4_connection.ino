// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});
static double student_var_0 = 0;

static void resetStudent() {
  student_var_0 = 0;
}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 11; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · ps4_link-22
      ctx.pc = 9; return Board::Step::YIELD;
    }
    case 2: { // beginner_wait · ps4_link-20
      return newmania.wait(ctx, 50UL, 1);
    }
    case 3: { // variables_set · ps4_link-17
      student_var_0 = 0.0;
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 4: { // beginner_message · ps4_link-15
      newmania.message("PS4 DISCONNECTED (S3 I2C)");
      ctx.pc = 3; return Board::Step::YIELD;
    }
    case 5: { // controls_if · ps4_link-18
      ctx.pc = ((student_var_0 != 0.0)) ? 4 : 2; return Board::Step::YIELD;
    }
    case 6: { // variables_set · ps4_link-9
      student_var_0 = 1.0;
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 7: { // beginner_message · ps4_link-7
      newmania.message("PS4 CONNECTED (S3 I2C)");
      ctx.pc = 6; return Board::Step::YIELD;
    }
    case 8: { // controls_if · ps4_link-10
      ctx.pc = ((student_var_0 != 1.0)) ? 7 : 2; return Board::Step::YIELD;
    }
    case 9: { // controls_if · ps4_link-19
      ctx.pc = (newmania.connected()) ? 8 : 5; return Board::Step::YIELD;
    }
    case 10: { // variables_set · ps4_link-1
      student_var_0 = -1.0;
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 11: { // newmania_design_ps4_connect · ps4_link-21
      newmania.connectPs4();
      ctx.pc = 10; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 130303UL, 7);
  newmania.registerProgram(3081881299UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
