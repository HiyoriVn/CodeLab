#include <array>
#include <cmath>
#include <cstdio>
#include <CodeLabFast4wd.h>

constexpr unsigned options = 1U << 9, share = 1U << 8;

void expectDuty(std::array<int, 4> directions, float percent = 100) {
  for (unsigned wheel = 0; wheel < directions.size(); ++wheel) {
    for (int op = 0; op < 2; ++op) {
      const bool expected = directions[wheel] == (op == 0 ? 1 : -1);
      if (enabled[wheel][op] != expected) {
        std::fprintf(stderr, "t=%lu wheel=%u op=%d expected=%d actual=%d\n",
          (unsigned long)clockMs, wheel, op, expected, enabled[wheel][op]);
      }
      assert(enabled[wheel][op] == expected);
      assert(std::fabs(duty[wheel][op] - (expected ? percent : 0)) < 0.01f);
    }
  }
}

void step(codelab::fast4wd::Robot& robot, uint32_t now) {
  clockMs = now;
  robot.beginLoop();
  robot.driveFromPs4();
  robot.endLoop();
}

void advance(codelab::fast4wd::Robot& robot, uint32_t now, unsigned buttons = 0,
    int16_t lx = 0, int16_t ly = 0, int16_t rx = 0, int16_t ry = 0) {
  auto& frame = Wire.report;
  frame.connected = true;
  frame.sequence = (frame.sequence + 1) & 127;
  frame.buttons = buttons;
  frame.axes[0] = lx;
  frame.axes[1] = ly;
  frame.axes[2] = rx;
  frame.axes[3] = ry;
  step(robot, now);
}

void testIndependentMotors() {
  Wire.report = {};
  clockMs = 2000;
  codelab::fast4wd::Robot robot(25, {{1, 0, 2, 3}, 2, 7});
  robot.begin(false);
  assert(!robot.spin(0, 80, false));
  advance(robot, 2310, 1);
  advance(robot, 2330, 1);
  assert(robot.button(0) && !robot.buttonEdge(0, true));
  advance(robot, 2350);
  assert(robot.buttonEdge(0, false));
  advance(robot, 2370, options);
  step(robot, 2372);
  advance(robot, 2390, 1);
  assert(robot.buttonEdge(0, true));
  step(robot, 2410);
  assert(!robot.buttonEdge(0, true));

  clockMs = 2430;
  robot.beginLoop();
  assert(robot.spin(1, 80, false)); // Motor 2 is reversed, capped at 25%.
  assert(!robot.spin(3, 80, false)); // disabled port
  robot.endLoop();
  step(robot, 2450);
  const float capped = 63 * (100.0f / 255);
  expectDuty({0,-1,0,0}, capped);
  assert(std::fabs(robot.motorPwm(1) - capped) < 0.01f && robot.motorPwm(3) == 0);

  clockMs = 2470;
  robot.beginLoop();
  assert(robot.spinFor(0, 25, true, 90));
  assert(robot.waitForMotor(0));
  assert(clockMs >= 2560 && clockMs < 2570);
  expectDuty({0,-1,0,0}, capped);

  clockMs = 2580;
  robot.beginLoop();
  robot.releaseMotor(0);
  robot.releaseMotor(1);
  robot.releaseMotor(2);
  robot.movePercent(0, 100, 0);
  robot.endLoop();
  clockMs = 2600;
  robot.beginLoop();
  robot.movePercent(0, 100, 0);
  robot.endLoop();
  clockMs = 2610;
  robot.beginLoop();
  robot.movePercent(0, 100, 0);
  robot.endLoop();
  expectDuty({1,1,1,0}, capped); // permuted wheel order, inversion and disabled port

  advance(robot, 2620);
  clockMs = 2640;
  robot.beginLoop();
  assert(robot.spinFor(0, 25, false, 1000));
  Wire.onPoll = [](codelab::ps4i2c::Frame& report) {
    if (millis() >= 2670 && report.buttons != share) {
      report.buttons = share;
      ++report.sequence;
    }
  };
  assert(!robot.waitForMotor(0));
  assert(clockMs < 2700);
  Wire.onPoll = nullptr;
  expectDuty({});
  advance(robot, 2700);
  advance(robot, 2720, options);
  clockMs = 2740;
  robot.beginLoop();
  assert(robot.spinFor(0, 25, false, 1000));
  assert(!robot.waitForMotor(0)); // Cached report expires during a wait.
  assert(clockMs > 2970 && clockMs < 2990);
  expectDuty({});
  advance(robot, 3000, options | 1);
  advance(robot, 3020, options | 1);
  assert(!robot.buttonEdge(0, true) && !robot.spin(0, 25, false));
  expectDuty({});
}

int main() {
  codelab::fast4wd::Robot robot;
  embeddedPsram = true;
  robot.begin(true);
  assert(gpioCalls == 0);
  embeddedPsram = false;
  octalFlash = true;
  robot.begin(true);
  assert(gpioCalls == 0);
  octalFlash = false;
  flashSize /= 2;
  robot.begin(true);
  assert(gpioCalls == 0);
  flashSize *= 2;
  robot.begin(true);
  assert(gpioCalls > 0);
  expectDuty({});

  advance(robot, 310, options);
  advance(robot, 330, options); // held on initial connection
  advance(robot, 350, options, 0, 32767);
  assert(robot.connected() && led == HIGH);
  expectDuty({});

  advance(robot, 370);
  advance(robot, 390, options, 0, 0, 0, 32767); // right Y is ignored
  step(robot, 392); // one neutral tick after clearing the startup link fault
  expectDuty({});
  for (uint32_t ms = 410; ms <= 490; ms += 20) advance(robot, ms, 0, 0, 32767);
  expectDuty({-1,-1,1,1});
  for (uint32_t ms = 510; ms <= 690; ms += 20) advance(robot, ms, 0, 0, 0, 32767);
  expectDuty({1,-1,1,-1});
  for (uint32_t ms = 710; ms <= 890; ms += 20) advance(robot, ms, 0, 32767, 32767);
  expectDuty({1,-1,-1,1}); // turn takes precedence over forward

  advance(robot, 910, share, 32767, 32767);
  expectDuty({});
  advance(robot, 930);
  advance(robot, 950, options);
  for (uint32_t ms = 970; ms <= 1050; ms += 20) advance(robot, ms, 0, 0, 32767);
  expectDuty({-1,-1,1,1});
  for (uint32_t ms = 1070; ms <= 1290; ms += 20) step(robot, ms); // unchanged cached packet
  step(robot, 1300);
  expectDuty({-1,-1,1,1});
  step(robot, 1301);
  assert(!robot.connected() && led == LOW);
  expectDuty({});
  step(robot, 1500);
  assert(led == HIGH);

  advance(robot, 1520, options);
  advance(robot, 1540, options);
  advance(robot, 1560, options, 0, 32767);
  expectDuty({});
  advance(robot, 1580);
  advance(robot, 1600, options); // deliberate link recovery
  advance(robot, 1620);
  clockMs = 1640;
  robot.beginLoop();
  robot.move(0, -1, 0);
  robot.endLoop();
  expectDuty({-1,1,-1,1}, 100.0f * 61 / 255);
  clockMs = 1660;
  robot.beginLoop();
  robot.stop();
  robot.move(1, 0, 0);
  robot.endLoop();
  expectDuty({});
  testIndependentMotors();
}
