// ============================================================================
// Newmania V2 ESP32-S3 — PS4 qua UART0 (RX=44, TX=43, 115200)
// Điều khiển: Mecanum M1..M4 + Nâng M5 (D-pad Up/Down) + Servo S1 (L1/L2)
// ============================================================================
#include <Arduino.h>
#include <cmath>
#include <UartFrame.h>
#include <QuadMotors.h>

// ============================================================================
// >>> PHẦN 1: CHỈNH CHIỀU ĐỘNG CƠ (CHỈ CẦN SỬA +1.0 HOẶC -1.0 Ở ĐÂY) <<<
// ============================================================================
// Bước 1: Đẩy cần trái LÊN (tiến thẳng).
//         Bánh nào quay NGƯỢC (lùi) thì đổi dấu của đúng bánh đó (+1.0 <-> -1.0).
static constexpr double DIR_M1 =  1.0;  // Chiều motor M1 (đã đảo sang +1.0)
static constexpr double DIR_M2 = -1.0;  // Chiều motor M2 (mặc định V2: -1.0)
static constexpr double DIR_M3 =  1.0;  // Chiều motor M3 (mặc định V2: +1.0)
static constexpr double DIR_M4 =  1.0;  // Chiều motor M4 (mặc định V2: +1.0)

// Bước 2: Sau khi cả 4 bánh đều TIẾN đúng rồi, test đi ngang & xoay:
static constexpr double DIR_TIEN  =  1.0; // Đổi -1.0 nếu đẩy lên mà xe đi lùi
static constexpr double DIR_NGANG = -1.0; // Đã đảo sang -1.0 cho đúng chiều đi ngang
static constexpr double DIR_XOAY  =  1.0; // Đổi -1.0 nếu gạt phải (RightX) mà xe xoay trái
static constexpr double STICK_MAX = 85.0; // Kéo tới 85% hành trình cần là đạt 100% của mode tốc độ
static constexpr double SPEED_HIGH = 0.75; // Mode tốc độ mặc định: 75% (bấm Options để chuyển 75% <-> 50%)
static constexpr double SPEED_LOW  = 0.50; // Mode tốc độ chậm: 50%

// Bước 3: Chỉnh chiều & tốc độ động cơ nâng M5 (D-pad Up / Down) + Encoder 2 (E2A=4, E2B=5):
static constexpr double DIR_M5   =  1.0;  // Đổi -1.0 nếu bấm Up mà cơ cấu đi xuống
static constexpr double M5_SPEED =  1.0;  // Tốc độ M5: 0.0 -> 1.0 (1.0 = 100%, 0.6 = 60%)
static constexpr int32_t DIR_ENC2 = 1;    // Đổi -1 nếu nâng lên (Up) mà enc2 bị giảm âm

// Bước 4: Giới hạn góc kẹp Servo S1 (R2 mở / L2 đóng) và Servo S2 (Tam giác / X):
static constexpr double S1_MIN  =  18.0;  // Góc đóng chặt hơn (L2, giảm từ 28 -> 18)
static constexpr double S1_MAX  = 104.0;  // Góc mở rộng mong muốn (R2)
static constexpr double S1_STEP =   1.0;  // Bước góc mỗi 10ms (100 độ/s) khi giữ nút R2/L2

static constexpr double S2_MIN      =   0.0; // Góc nhỏ nhất S2 (X)
static constexpr double S2_MAX      = 180.0; // Góc lớn nhất S2 (Tam giác)
static constexpr double S2_STEP     =   1.0; // Bước góc mỗi 10ms (100 độ/s) khi giữ nút Tam giác/X
static constexpr double S2_PRESET_A =  45.0; // Nhấn nút Vuông lần 1 -> quay thẳng tới 45 độ
static constexpr double S2_PRESET_B =  90.0; // Nhấn nút Vuông lần 2 -> quay về 90 độ
// ============================================================================

static codelab::ps4i2c::Receiver rx;
static codelab::ps4i2c::UartParser parser;
static QuadMotors motors;

static constexpr uint8_t kServo1Pin = 14; // SERVO1 trên Newmania V2 = GPIO14
static constexpr uint8_t kServo2Pin = 15; // SERVO2 trên Newmania V2 = GPIO15
static constexpr uint8_t kEnc2APin  = 4;  // ENC2_A trên Newmania V2 = GPIO4
static constexpr uint8_t kEnc2BPin  = 5;  // ENC2_B trên Newmania V2 = GPIO5
static double goc_s1 = 90.0;
static double goc_s2 = 90.0;
static bool s1Attached = false;
static bool s2Attached = false;
static double driveScale = SPEED_HIGH;    // Mặc định 75%
static bool prevOptionsHeld = false;
static bool prevSquareHeld  = false;

static volatile int32_t g_enc2Raw = 0;
static volatile uint8_t g_enc2State = 0;

static void IRAM_ATTR enc2Isr() {
  static constexpr int8_t kQuadTable[16] = {
     0, -1,  1,  0,
     1,  0,  0, -1,
    -1,  0,  0,  1,
     0,  1, -1,  0
  };
  const uint8_t s = (uint8_t(digitalRead(kEnc2APin)) << 1) | uint8_t(digitalRead(kEnc2BPin));
  g_enc2Raw += kQuadTable[(g_enc2State << 2) | s];
  g_enc2State = s;
}

static int32_t readEnc2() {
  noInterrupts();
  const int32_t v = g_enc2Raw;
  interrupts();
  return v * DIR_ENC2;
}

static double applyDeadzone(double v) {
  if (std::fabs(v) <= 6.0) return 0.0;
  const double span = (STICK_MAX > 10.0) ? (STICK_MAX - 6.0) : 94.0;
  const double scaled = (v > 0.0) ? ((v - 6.0) * 100.0 / span) : ((v + 6.0) * 100.0 / span);
  if (scaled > 100.0) return 100.0;
  if (scaled < -100.0) return -100.0;
  return scaled;
}

static float clampUnit(double v) {
  if (!std::isfinite(v)) return 0.0f;
  if (v > 1.0) return 1.0f;
  if (v < -1.0) return -1.0f;
  return static_cast<float>(v);
}

static void writeServo(uint8_t pin, bool& attached, double angle, double minA, double maxA) {
  if (angle < minA) angle = minA;
  if (angle > maxA) angle = maxA;
  const double pulseUs = 500.0 + (angle / 180.0) * 2000.0; // 500..2500 us (full 180 deg)
  const uint32_t duty = static_cast<uint32_t>(std::round((pulseUs / 20000.0) * 16383.0));
  if (!attached) {
    if (ledcAttach(pin, 50, 14)) attached = true;
  }
  if (attached) ledcWrite(pin, duty);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  // Khởi tạo Encoder 2 (E2A=GPIO4, E2B=GPIO5)
  pinMode(kEnc2APin, INPUT_PULLUP);
  pinMode(kEnc2BPin, INPUT_PULLUP);
  g_enc2State = (uint8_t(digitalRead(kEnc2APin)) << 1) | uint8_t(digitalRead(kEnc2BPin));
  attachInterrupt(digitalPinToInterrupt(kEnc2APin), enc2Isr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(kEnc2BPin), enc2Isr, CHANGE);

  // Nhận PS4 từ D1 qua cổng UART0 của V2 (RX=GPIO44, TX=GPIO43)
  Serial1.begin(115200, SERIAL_8N1, 44, 43);
  const bool motorReady = motors.begin(true); // Newmania V2 (M1..M6)
  Serial.printf("S3_UART0_MECANUM_M5_S1_ENC2_START RX=44 TX=43 MCPWM=%u ENC2=4/5\n", motorReady ? 1U : 0U);
}

void loop() {
  while (Serial1.available() > 0) {
    parser.feed(uint8_t(Serial1.read()), rx, millis());
  }
  const uint32_t now = millis();
  rx.watchdog(now);
  motors.expire(now);
  const auto snap = rx.snapshot(now);

  if (!snap.connected) {
    motors.disable(); // Mất tín hiệu PS4 > 250ms -> tắt toàn bộ motor
  } else {
    static uint32_t lastStep = 0;
    if (uint32_t(now - lastStep) >= 10) {
      lastStep = now;
      const uint32_t btn = snap.buttons;

      // ----------------------------------------------------------------------
      // PHẦN 1B: CHUYỂN MODE TỐC ĐỘ 75% <-> 50% BẰNG NÚT OPTIONS (bit 9)
      // ----------------------------------------------------------------------
      const bool optionsHeld = (btn & (1UL << 9)) != 0;
      if (optionsHeld && !prevOptionsHeld) {
        driveScale = (driveScale > 0.62) ? SPEED_LOW : SPEED_HIGH;
        if (Serial.availableForWrite() >= 64) {
          Serial.printf("SPEED_MODE=%.0f%%\n", driveScale * 100.0);
        }
      }
      prevOptionsHeld = optionsHeld;

      // ----------------------------------------------------------------------
      // PHẦN 2: CÔNG THỨC TRỘN MECANUM M1..M4
      // Quy ước vị trí bánh thực tế trên xe:
      //   M1 = Trái-Trước (FL) | M2 = Phải-Trước (FR)
      //   M3 = Trái-Sau   (RL) | M4 = Phải-Sau   (RR)
      // ----------------------------------------------------------------------
      const double tien  = DIR_TIEN  * applyDeadzone(snap.ly / 10.0); // Cần trái Lên/Xuống
      const double ngang = DIR_NGANG * applyDeadzone(snap.lx / 10.0); // Cần trái Trái/Phải
      const double xoay  = DIR_XOAY  * applyDeadzone(snap.rx / 10.0); // Cần phải Trái/Phải

      const double m1 = tien + ngang + xoay; // FL
      const double m2 = tien - ngang - xoay; // FR
      const double m3 = tien - ngang + xoay; // RL
      const double m4 = tien + ngang - xoay; // RR

      // Chuẩn hóa về [-100..100] nếu tổng vượt quá 100
      double dinh = 100.0;
      if (std::fabs(m1) > dinh) dinh = std::fabs(m1);
      if (std::fabs(m2) > dinh) dinh = std::fabs(m2);
      if (std::fabs(m3) > dinh) dinh = std::fabs(m3);
      if (std::fabs(m4) > dinh) dinh = std::fabs(m4);

      // ----------------------------------------------------------------------
      // PHẦN 3: ĐỘNG CƠ NÂNG M5 (D-pad Up = bit 13, D-pad Down = bit 14)
      // ----------------------------------------------------------------------
      double m5 = 0.0;
      if (btn & (1UL << 13))      m5 =  DIR_M5 * M5_SPEED;
      else if (btn & (1UL << 14)) m5 = -DIR_M5 * M5_SPEED;

      // Áp dụng hệ số đảo chiều từng bánh (DIR_M1..DIR_M4) và mode tốc độ (75% / 50%) rồi xuất PWM
      const float speeds[6] = {
        clampUnit(DIR_M1 * driveScale * (m1 / dinh)),
        clampUnit(DIR_M2 * driveScale * (m2 / dinh)),
        clampUnit(DIR_M3 * driveScale * (m3 / dinh)),
        clampUnit(DIR_M4 * driveScale * (m4 / dinh)),
        clampUnit(m5),
        0.0f,
      };
      if (!motors.permitted()) motors.permit(now);
      motors.renew(now);
      motors.write6(speeds);

      // ----------------------------------------------------------------------
      // PHẦN 4: SERVO S1 (R2 = bit 7 mở, L2 = bit 6 đóng) & S2 (Tam giác = bit 3, X = bit 0)
      // ----------------------------------------------------------------------
      const double old_s1 = goc_s1;
      if (btn & (1UL << 7)) {
        goc_s1 = std::min(S1_MAX, goc_s1 + S1_STEP);
        writeServo(kServo1Pin, s1Attached, goc_s1, S1_MIN, S1_MAX);
      } else if (btn & (1UL << 6)) {
        goc_s1 = std::max(S1_MIN, goc_s1 - S1_STEP);
        writeServo(kServo1Pin, s1Attached, goc_s1, S1_MIN, S1_MAX);
      }

      const double old_s2 = goc_s2;
      const bool squareHeld = (btn & (1UL << 2)) != 0;
      if (squareHeld && !prevSquareHeld) {
        goc_s2 = (std::fabs(goc_s2 - S2_PRESET_A) < 5.0) ? S2_PRESET_B : S2_PRESET_A;
        writeServo(kServo2Pin, s2Attached, goc_s2, S2_MIN, S2_MAX);
      }
      prevSquareHeld = squareHeld;

      if (btn & (1UL << 3)) {
        goc_s2 = std::min(S2_MAX, goc_s2 + S2_STEP);
        writeServo(kServo2Pin, s2Attached, goc_s2, S2_MIN, S2_MAX);
      } else if (btn & (1UL << 0)) {
        goc_s2 = std::max(S2_MIN, goc_s2 - S2_STEP);
        writeServo(kServo2Pin, s2Attached, goc_s2, S2_MIN, S2_MAX);
      }

      static uint32_t lastS1Log = 0;
      if ((goc_s1 != old_s1 || goc_s2 != old_s2) && uint32_t(now - lastS1Log) >= 100) {
        lastS1Log = now;
        if (Serial.availableForWrite() >= 64) {
          Serial.printf("SERVO s1=%.0f s2=%.0f\n", goc_s1, goc_s2);
        }
      }
    }
  }

  static uint32_t lastLog = 0;
  if (uint32_t(now - lastLog) >= 1000) {
    lastLog = now;
    if (Serial.availableForWrite() >= 64) {
      Serial.printf("UART0_ROBOT PKT=%lu CRC=%lu CONN=%u spd=%.0f%% s1=%.0f s2=%.0f enc2=%ld\n",
                    (unsigned long)parser.packets, (unsigned long)parser.crcErrors,
                    snap.connected ? 1U : 0U, driveScale * 100.0, goc_s1, goc_s2, (long)readEnc2());
    }
  }
}
