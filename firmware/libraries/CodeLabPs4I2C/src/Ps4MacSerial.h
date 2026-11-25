#pragma once

#include <Arduino.h>
#include <nvs.h>
#include <string.h>

namespace codelab { namespace ps4bridge {

// Keep this read-only lookup in sync with the external PS4Bluepad32 1.0.1 library.
class MacSerial {
  char line_[24] = {};
  size_t used_ = 0;
  bool discard_ = false;

  static void printMac(Stream& serial, const char* token) {
    nvs_handle_t handle;
    esp_err_t status = nvs_open("ps4-bluepad32", NVS_READONLY, &handle);
    uint8_t mac[6];
    size_t size = sizeof(mac);
    if (status == ESP_OK) {
      status = nvs_get_blob(handle, "controller-mac", mac, &size);
      nvs_close(handle);
    }
    if (status == ESP_ERR_NVS_NOT_FOUND) serial.printf("CLPS4 %s MAC NONE\n", token);
    else if (status == ESP_ERR_NVS_INVALID_LENGTH || status == ESP_ERR_NVS_TYPE_MISMATCH ||
             (status == ESP_OK && size != sizeof(mac))) serial.printf("CLPS4 %s MAC INVALID\n", token);
    else if (status != ESP_OK) serial.printf("CLPS4 %s FAIL\n", token);
    else serial.printf("CLPS4 %s MAC %02X:%02X:%02X:%02X:%02X:%02X\n", token,
                       mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  }

  static bool validToken(const char* token) {
    return strlen(token) == 12 && strspn(token, "0123456789abcdef") == 12;
  }

 public:
  template<class Reset>
  void poll(Stream& serial, Reset reset) {
    for (unsigned n = 0; n < 32 && serial.available(); ++n) {
      const char c = char(serial.read());
      // The web protocol uses only symbols, digits and lowercase hex, so its
      // read request also cannot trigger the legacy r/R byte reset on older builds.
      if (!used_ && !discard_ && (c == 'r' || c == 'R')) {
        reset();
        continue;
      }
      if (c == '\n') {
        if (used_ && line_[used_ - 1] == '\r') --used_;
        line_[used_] = '\0';
        if (!discard_) {
          if ((strncmp(line_, "CLPS4? ", 7) == 0 || strncmp(line_, "CLPS4! ", 7) == 0) && validToken(line_ + 7)) {
            const char* token = line_ + 7;
            if (line_[5] == '?') printMac(serial, token);
            else serial.printf("CLPS4 %s %s\n", token, reset() ? "OK" : "FAIL");
          }
        }
        used_ = 0;
        discard_ = false;
      } else if (c == '\0' || used_ == sizeof(line_) - 1) {
        discard_ = true;
      } else if (!discard_) {
        line_[used_++] = c;
      }
    }
  }
};

}}
