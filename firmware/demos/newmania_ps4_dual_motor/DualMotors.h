#pragma once
#include "Esp32Mcpwm.h"
#include "SingleMotor.h"

// Dieu khien M3 va M4 bang hai MCPWM doc lap.
class DualMotors final : public codelab::robot::MotorInterface {
private:
    Esp32Mcpwm io3_;
    Esp32Mcpwm io4_;

    codelab::motor_test::SingleMotor<3> m3_{io3_};
    codelab::motor_test::SingleMotor<4> m4_{io4_};

    bool initialized_ = false;

public:
    bool begin() {
        bool a = m3_.begin();
        bool b = m4_.begin();

        initialized_ = a && b;

        if (!initialized_) disable();
        return initialized_;
    }

    bool ready() const override {
        return initialized_ && m3_.ready() && m4_.ready();
    }

    bool permitted() const {
        return m3_.permitted() && m4_.permitted();
    }

    bool permit(uint32_t now) {
        if (!ready() || m3_.permitted() || m4_.permitted())
            return false;

        if (!m3_.permit(now)) return false;

        if (!m4_.permit(now)) {
            disable();
            return false;
        }

        return true;
    }

    void expire(uint32_t now) {
        m3_.expire(now);
        m4_.expire(now);

        if (!permitted()) disable();
    }

    bool write(const float (&speeds)[4]) override {
        if (!ready()) {
            disable();
            return false;
        }

        // Chua duoc cap phep: khong xuat PWM.
        if (!permitted()) return true;

        if (!m3_.write(speeds)) {
            disable();
            return false;
        }

        if (!m4_.write(speeds)) {
            disable();
            return false;
        }

        return true;
    }

    void disable() override {
        m3_.disable();
        m4_.disable();
    }

    uint8_t m3FI() const { return m3_.fiDuty; }
    uint8_t m3BI() const { return m3_.biDuty; }
    uint8_t m4FI() const { return m4_.fiDuty; }
    uint8_t m4BI() const { return m4_.biDuty; }
};
