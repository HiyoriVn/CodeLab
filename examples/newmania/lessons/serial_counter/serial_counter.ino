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
    case 0: ctx.pc = 5; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · serial_counter-7
      ctx.pc = 4; return Board::Step::YIELD;
    }
    case 2: { // beginner_message · serial_counter-6
      newmania.message(student_var_0);
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // math_change · serial_counter-4
      student_var_0 += 1.0;
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 4: { // beginner_wait · serial_counter-2
      return newmania.wait(ctx, 500UL, 3);
    }
    case 5: { // variables_set · serial_counter-1
      student_var_0 = 0.0;
      ctx.pc = 1; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, false, 130303UL, 7);
  newmania.registerProgram(714516335UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
