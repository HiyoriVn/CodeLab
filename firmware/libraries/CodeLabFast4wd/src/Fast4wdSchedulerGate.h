#pragma once

#include <CodeLabV2Scheduler.hpp>
#include "CodeLabFast4wd.h"

namespace codelab { namespace fast4wd {

class SchedulerGate final : public v2::MotorOutputGate {
 public:
  explicit SchedulerGate(Robot& robot) : robot_(robot) {}

  void hardLock() override {
    locked_ = true;
    robot_.haltMotorOutputs();
    for (auto& command : commands_) command = {};
  }

  bool unlock(uint32_t generation) override {
    generation_ = generation;
    locked_ = false;
    return true;
  }

  bool write(uint8_t motor, int16_t power, uint32_t generation, uint32_t handleId = 0) override {
    if (motor >= 4 || locked_ || generation != generation_) return false;
    if (power < -100 || power > 100) return false;
    if (power == 0) robot_.stopMotor(motor);
    else if (!robot_.spin(motor, power < 0 ? -power : power, power < 0)) return false;
    commands_[motor] = {generation, handleId, power};
    return true;
  }

  bool stopIfOwned(uint8_t motor, uint32_t generation, uint32_t handleId) override {
    if (motor >= 4) return false;
    auto& command = commands_[motor];
    if (command.generation != generation || command.handleId != handleId) return false;
    robot_.stopMotor(motor);
    command = {};
    return true;
  }

 private:
  struct Owner { uint32_t generation = 0, handleId = 0; int16_t power = 0; };
  Robot& robot_;
  Owner commands_[4]{};
  uint32_t generation_ = 0;
  bool locked_ = true;
};

} }
