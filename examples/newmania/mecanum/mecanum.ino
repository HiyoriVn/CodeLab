// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
static Board newmania(100, {{0, 1, 2, 3}, 3, 15});


static void resetStudent() {

}

static Board::Step studentProgram(Board::Context& ctx, uint32_t) {
  switch (ctx.pc) {
    case 0: ctx.pc = 3; return Board::Step::YIELD;
    case 1: { // newmania_design_forever · mecanum-block-2
      ctx.pc = 2; return Board::Step::YIELD;
    }
    case 2: { // robot_mecanum · mecanum-block-3
      newmania.mecanum(newmania.axis(Axis::LeftY), newmania.axis(Axis::RightX), newmania.axis(Axis::LeftX));
      ctx.pc = 1; return Board::Step::YIELD;
    }
    case 3: { // newmania_design_ps4_connect · mecanum-block-1
      newmania.connectPs4();
      ctx.pc = 1; return Board::Step::YIELD;
    }
    default: return Board::Step::DONE;
  }
}

void setup() {
  newmania.begin(true, true, 130303UL, 7);
  newmania.registerProgram(2472772916UL, studentProgram, resetStudent);
}

void loop() {
  newmania.update();
}
