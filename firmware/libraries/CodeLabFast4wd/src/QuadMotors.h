#pragma once
#include "Esp32Mcpwm.h"
#include "SingleMotor.h"

class QuadMotors final : public codelab::robot::MotorInterface {
private:
    Esp32Mcpwm io1_;
    Esp32Mcpwm io2_;
    Esp32Mcpwm io3_;
    Esp32Mcpwm io4_;

    codelab::motor_test::SingleMotor<1> m1_{io1_};
    codelab::motor_test::SingleMotor<2> m2_{io2_};
    codelab::motor_test::SingleMotor<3> m3_{io3_};
    codelab::motor_test::SingleMotor<4> m4_{io4_};

    bool initialized_ = false;
    bool active_ = false;

public:
    bool begin() {
        if (initialized_) return ready();

        bool a = m1_.begin();
        bool b = m2_.begin();
        bool c = m3_.begin();
        bool d = m4_.begin();

        initialized_ = a && b && c && d;
        return initialized_;
    }

    bool ready() const override {
        return initialized_
            && m1_.ready()
            && m2_.ready()
            && m3_.ready()
            && m4_.ready();
    }

    bool permitted() const {
        return active_
            && m1_.permitted()
            && m2_.permitted()
            && m3_.permitted()
            && m4_.permitted();
    }

    bool permit(uint32_t now) {
        if (!ready() || active_) return false;

        active_ = true;

        bool ok = m1_.permit(now)
            && m2_.permit(now)
            && m3_.permit(now)
            && m4_.permit(now);

        if (!ok) {
            disable();
            return false;
        }

        return true;
    }

    void renew(uint32_t now) {
        if (!permitted()) return;
        m1_.renew(now);
        m2_.renew(now);
        m3_.renew(now);
        m4_.renew(now);
    }

    void expire(uint32_t now) {
        if (!active_) return;

        m1_.expire(now);
        m2_.expire(now);
        m3_.expire(now);
        m4_.expire(now);

        if (!permitted()) disable();
    }

    bool write(const float (&speeds)[4]) override {
        if (!ready()) {
            disable();
            return false;
        }

        // PWM is allowed only after the runtime accepts an Options press.
        if (!permitted()) return true;

        bool ok = m1_.write(speeds)
            && m2_.write(speeds)
            && m3_.write(speeds)
            && m4_.write(speeds);

        if (!ok) {
            disable();
            return false;
        }

        return true;
    }

    void disable() override {
        // Avoid redundant MCPWM writes every DISARMED tick
        if (!active_) return;

        active_ = false;

        m1_.disable();
        m2_.disable();
        m3_.disable();
        m4_.disable();
    }

    uint8_t m1FI() const { return m1_.fiDuty; }
    uint8_t m1BI() const { return m1_.biDuty; }
    uint8_t m2FI() const { return m2_.fiDuty; }
    uint8_t m2BI() const { return m2_.biDuty; }
    uint8_t m3FI() const { return m3_.fiDuty; }
    uint8_t m3BI() const { return m3_.biDuty; }
    uint8_t m4FI() const { return m4_.fiDuty; }
    uint8_t m4BI() const { return m4_.biDuty; }
};

