#pragma once
#include "Esp32Mcpwm.h"
#include "SingleMotor.h"

class QuadMotors final : public codelab::robot::MotorInterface {
private:
    Esp32Mcpwm io1_;
    Esp32Mcpwm io2_;
    Esp32Mcpwm io3_;
    Esp32Mcpwm io4_;
    Esp32Mcpwm io5_;
    Esp32Mcpwm io6_;

    codelab::motor_test::SingleMotor<1> m1_{io1_};
    codelab::motor_test::SingleMotor<2> m2_{io2_};
    codelab::motor_test::SingleMotor<3> m3_{io3_};
    codelab::motor_test::SingleMotor<4> m4_{io4_};
    codelab::motor_test::SingleMotor<5> m5_{io5_};
    codelab::motor_test::SingleMotor<6> m6_{io6_};

    uint8_t motorCount_ = 4;
    bool initialized_ = false;
    bool active_ = false;

public:
    bool begin(bool isV2 = false) {
        if (initialized_) return ready();
        motorCount_ = isV2 ? 6 : 4;
        if (!isV2) {
            bool a = m1_.begin(35, 36);
            bool b = m2_.begin(37, 38);
            bool c = m3_.begin(39, 40);
            bool d = m4_.begin(41, 42);
            initialized_ = a && b && c && d;
        } else {
            bool a = m1_.begin(42, 41);
            bool b = m2_.begin(40, 39);
            bool c = m3_.begin(38, 37);
            bool d = m4_.begin(36, 35);
            bool e = m5_.begin(48, 34);
            bool f = m6_.begin(33, 47);
            initialized_ = a && b && c && d && e && f;
        }
        return initialized_;
    }

    uint8_t motorCount() const { return motorCount_; }

    bool ready() const override {
        if (!initialized_) return false;
        bool ok = m1_.ready() && m2_.ready() && m3_.ready() && m4_.ready();
        if (motorCount_ == 6) ok = ok && m5_.ready() && m6_.ready();
        return ok;
    }

    bool permitted() const {
        if (!active_) return false;
        bool ok = m1_.permitted() && m2_.permitted() && m3_.permitted() && m4_.permitted();
        if (motorCount_ == 6) ok = ok && m5_.permitted() && m6_.permitted();
        return ok;
    }

    bool permit(uint32_t now) {
        if (!ready() || active_) return false;
        active_ = true;
        bool ok = m1_.permit(now) && m2_.permit(now) && m3_.permit(now) && m4_.permit(now);
        if (motorCount_ == 6) ok = ok && m5_.permit(now) && m6_.permit(now);
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
        if (motorCount_ == 6) {
            m5_.renew(now);
            m6_.renew(now);
        }
    }

    void expire(uint32_t now) {
        if (!active_) return;
        m1_.expire(now);
        m2_.expire(now);
        m3_.expire(now);
        m4_.expire(now);
        if (motorCount_ == 6) {
            m5_.expire(now);
            m6_.expire(now);
        }
        if (!permitted()) disable();
    }

    bool write(const float (&speeds)[4]) override {
        float full[6] = {speeds[0], speeds[1], speeds[2], speeds[3], 0.0f, 0.0f};
        return write6(full);
    }

    bool write6(const float (&speeds)[6]) {
        if (!ready()) {
            disable();
            return false;
        }
        if (!permitted()) return true;
        bool ok = m1_.writeChannel(speeds[0])
            && m2_.writeChannel(speeds[1])
            && m3_.writeChannel(speeds[2])
            && m4_.writeChannel(speeds[3]);
        if (motorCount_ == 6) {
            ok = ok && m5_.writeChannel(speeds[4]) && m6_.writeChannel(speeds[5]);
        }
        if (!ok) {
            disable();
            return false;
        }
        return true;
    }

    void disable() override {
        active_ = false;
        m1_.disable();
        m2_.disable();
        m3_.disable();
        m4_.disable();
        if (motorCount_ == 6) {
            m5_.disable();
            m6_.disable();
        }
    }

    uint8_t m1FI() const { return m1_.fiDuty; }
    uint8_t m1BI() const { return m1_.biDuty; }
    uint8_t m2FI() const { return m2_.fiDuty; }
    uint8_t m2BI() const { return m2_.biDuty; }
    uint8_t m3FI() const { return m3_.fiDuty; }
    uint8_t m3BI() const { return m3_.biDuty; }
    uint8_t m4FI() const { return m4_.fiDuty; }
    uint8_t m4BI() const { return m4_.biDuty; }
    uint8_t m5FI() const { return m5_.fiDuty; }
    uint8_t m5BI() const { return m5_.biDuty; }
    uint8_t m6FI() const { return m6_.fiDuty; }
    uint8_t m6BI() const { return m6_.biDuty; }
};
