// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});
static double student_var_0 = 0;
static double student_var_1 = 0;
static ButtonCursor student_button_0;

static void resetStudent() {
  student_var_0 = 0;
  student_var_1 = 0;
  student_button_0 = {};
}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 6; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · counter_x-block-4
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 2: { // beginner_message · counter_x-block-9
      newmania.message(student_var_0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // math_change · counter_x-block-7
      student_var_0 += 1.0;
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 4: { // controls_if · counter_x-block-5
      ctx.pc = (newmania.button(Button::X, ButtonState::Pressed, student_button_0)) ? 3 : 1; return Board::Step::YIELD;
    }
    case 5: { // variables_set · counter_x-block-2
      student_var_0 = 0.0;
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 6: { // newmania_design_ps4_connect · counter_x-block-1
      newmania.connectPs4();
      ctx.pc = 5; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 1UL, 0);
  newmania.registerProgram(4172027617UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
