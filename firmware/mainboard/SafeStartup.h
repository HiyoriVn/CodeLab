#pragma once
#include "BoardConfig.h"

namespace codelab {
// Called once during setup, before any driver or task. No enable API in this phase.
// Io must provide hiZ(pin), preloadLow(pin), output(pin), returning success.
class SafeStartup {
 public:
  template<class Io> bool begin(Io& io) {
    if (attempted_) return ready_;
    attempted_=true;
    bool ok=true;
    for (auto pin : board::servos) ok=io.hiZ(pin) && ok;
    // Preload every output latch before enabling ANY output direction.
    for (auto motor : board::motors) {
      ok=io.preloadLow(motor.first) && ok;
      ok=io.preloadLow(motor.second) && ok;
    }
    ok=io.preloadLow(board::buzzer) && ok;
    if (!ok) return false; // Never enable outputs if a preload/Hi-Z operation failed.
    for (auto motor : board::motors) {
      ok=io.output(motor.first) && ok;
      ok=io.output(motor.second) && ok;
    }
    ok=io.output(board::buzzer) && ok;
    ready_=ok;
    return ready_;
  }
  bool initialized() const { return ready_; }
  bool servoEnabled() const { return false; }
  bool armed() const { return false; }
 private:
  bool attempted_=false;
  bool ready_=false;
};
} // namespace codelab
