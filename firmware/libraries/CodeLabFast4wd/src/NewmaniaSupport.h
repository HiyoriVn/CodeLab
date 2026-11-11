#pragma once
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <type_traits>

namespace codelab { namespace newmania {

// Temporary message value only; student variables remain numeric.
class Text {
 public:
  static constexpr size_t capacity = 128;
  static Text from(const char* value) { Text t; t.append(value); return t; }
  static Text from(const Text& value) { return value; }
  template<class Number, typename std::enable_if<std::is_arithmetic<Number>::value, int>::type = 0>
  static Text from(Number number) {
    Text t;
    if (!std::isfinite(static_cast<double>(number))) { t.valid_ = false; return t; }
    const int n = std::snprintf(t.bytes_, capacity, "%.6g", static_cast<double>(number));
    t.valid_ = n >= 0 && size_t(n) < capacity;
    t.size_ = t.valid_ ? size_t(n) : 0;
    return t;
  }
  Text& append(const char* value) {
    if (!valid_) return *this;
    if (!value) { valid_ = false; return *this; }
    size_t n = 0;
    while (n < capacity - size_ && value[n]) ++n;
    if (n >= capacity - size_) { valid_ = false; return *this; }
    std::memcpy(bytes_ + size_, value, n + 1); size_ += n;
    return *this;
  }
  Text& append(const Text& value) { if (!value.valid_) valid_ = false; else append(value.bytes_); return *this; }
  template<class Number, typename std::enable_if<std::is_arithmetic<Number>::value, int>::type = 0>
  Text& append(Number number) { return append(from(number)); }
  bool valid() const { return valid_; }
  const char* data() const { return bytes_; }
 private:
  char bytes_[capacity]{};
  size_t size_ = 0;
  bool valid_ = true;
};

struct Bounds { double first, last, step; };
struct Pair { double first, second; };
struct Range { double value, low, high; };

class ForLoop {
 public:
  bool begin(double& variable, Bounds bounds) {
    variable = bounds.first; end_ = bounds.last;
    step_ = std::fabs(bounds.step);
    active_ = std::isfinite(variable) && std::isfinite(end_) && std::isfinite(step_) && step_ > 0;
    if (variable > end_) step_ = -step_;
    return active_;
  }
  bool contains(double variable) const { return active_ && std::isfinite(variable) && (step_ > 0 ? variable <= end_ : variable >= end_); }
  void advance(double& variable) {
    const double next = variable + step_;
    if (!std::isfinite(next) || next == variable) active_ = false;
    else variable = next;
  }
  void reset() { active_ = false; }
 private:
  double end_ = 0, step_ = 0;
  bool active_ = false;
};

struct Math {
  static double clamp(Range r) {
    if (!std::isfinite(r.value) || !std::isfinite(r.low) || !std::isfinite(r.high)) return 0;
    if (r.low > r.high) { const auto tmp = r.low; r.low = r.high; r.high = tmp; }
    return r.value < r.low ? r.low : r.value > r.high ? r.high : r.value;
  }
  static int32_t integer(double n) {
    return !std::isfinite(n) ? 0 : n <= INT32_MIN ? INT32_MIN : n >= INT32_MAX ? INT32_MAX : static_cast<int32_t>(n);
  }
};

} }
