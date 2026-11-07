# Newmania Starter V1.0 fast track — commit-ready report

Ngày 2026-11-05. Baseline local trước thay đổi: `3106a9eee15e5057669249ad9f46eb83d22279d6` trên `codex/integrate-bach-ui`. **SOFTWARE_ACCEPTED** cho profile/generation/compile và ví dụ I/O đã kiểm tra. **HARDWARE_UNTESTED** cho board, USB/Serial, PSRAM runtime, upload và mức chân điện thực. Không flash/COM selection thực, commit hoặc push.

## 1. Implementation Summary

Ba immutable board profiles dùng chung UI/generator/HTTP bridge: Newmania Starter V1 test board, STEAM Robotics V2 target board, Generic ESP32-S3 legacy. V2 native BoardConfig/SafeStartup giữ nguyên. Concrete profile thêm startup inhibit và pin validation theo board; motor/servo control bị chặn. V1 N8R2 dùng 8 MB flash/QSPI PSRAM enabled; không copy cấu hình V2 disabled. Không thêm library/dependency.

Board chọn theo project, optional boardId với format version1; file cũ mặc định Generic, không remap/mất blocks. Backend whitelist profile + core version, bind source/board/FQBN vào artifact; UI không tự chọn COM, không cho nạp artifact cũ sau đổi source/profile. Compile và upload riêng, explicit target/port confirmation. Serial Monitor Web Serial vẫn dùng luồng chọn cổng của người dùng; đóng panel/device handoff ngắt cổng.

## 2. Files Created/Modified

- Registry/shared generation: `src/boards/profiles.js`, `src/boards/startup.js`, `src/generators/arduino.js`.
- UI: `src/App.jsx`, `src/components/BlocklyWorkspace.jsx`, `src/components/DevicePanel.jsx`, `src/styles.css`.
- Host build service: `tools/arduino-bridge.mjs`.
- Examples/verification: `tools/v1-examples.mjs`, `tools/verify-v1-build.mjs`, `firmware/newmania_v1/README.md`, `newmania_v1.ino`, six `.ino`/`.codelab.json` example pairs.
- Tests: `tests/board-profiles.test.mjs`, `tests/bridge.test.mjs`, `tests/startup-native.test.mjs`; package.json chỉ thêm scripts, dependency declarations không đổi.
- Docs: AGENTS.md, README.md, docs/DEVELOPMENT.md, docs/IMPLEMENTATION_PLAN.md, docs/PROGRESS.md, docs/TESTING.md, docs/architecture/ARCHITECTURE.md, docs/boards/BOARD_PROFILES.md, docs/boards/V1_HARDWARE_TEST.md và báo cáo này; .gitignore bổ sung raw build log.

## 3. Build & Test Results

- `npm test`: **15/15 PASS, exit0**. Bao gồm profile/memory/pin validation, Generic compatibility, deterministic generation, workspace round-trip, pin conflict ADC/output/PWM, motor-block inhibit, native fake-GPIO startup/order/error paths, HTTP target binding/upload guards/error diagnostics. Upload tests dùng CLI giả lập, không giao tiếp board. Lần test HTTP đầu trong sandbox bị EACCES localhost; chạy lại ngoài sandbox với quyền được duyệt PASS.
- `npm run build`: **PASS, exit0**, Vite7.3.7, 61 modules, 4.42s; JS 1,037.62 kB minified. Chunk warning >500 kB còn tồn tại.
- `node tools/verify-v1-build.mjs`: **PASS, exit0**; sáu version1 project JSON được load vào Blockly, sinh C++, so với `.ino`, gửi HTTP `/api/compile`, kiểm tra core3.3.7 và nhận binary không rỗng. Mỗi CLI compile thành công có child exit0 (backend chỉ trả ok khi code===0); không gọi upload/ports trong script.
- CLI1.5.1, core **esp32:esp32 3.3.7**, FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=enabled,USBMode=hwcdc,CDCOnBoot=cdc`. Data `C:/Users/Admin/AppData/Local/Arduino15`, downloads `Arduino15/staging`, biến môi trường chỉ trong process. Bluepad32 package không sử dụng, không cài/cập nhật toolchain.

| Example | Compile / exit | Program bytes | Global RAM bytes | BIN bytes |
|---|---|---:|---:|---:|
| minimal | PASS / 0 | 311846 | 22164 | 312000 |
| blink | PASS / 0 | 311882 | 22164 | 312032 |
| serial_hello | PASS / 0 | 311982 | 22164 | 312128 |
| digital_input | PASS / 0 | 312246 | 22164 | 312400 |
| adc_read | PASS / 0 | 322174 | 22444 | 322320 |
| pwm_led | PASS / 0 | 319709 | 22308 | 319856 |

Maximum program partition 3,342,336 B; reported RAM 327,680 B. Các số RAM này không chứng minh PSRAM 2 MB hiện diện/được dùng trên board. Binary được tạo ở build temp của CLI service; không đưa vào repository. Raw log local: `docs/verification/newmania_v1_build.log` (ignored), có response/stdout/stderr và EXIT_CODE=0 cuối.

Chrome smoke tại localhost5173: UI/toolbox render, Generic -> V1 hiển thị đúng safe startup, thêm block không rỗng, đổi profile rồi reload vẫn giữ block và V1; device dialog hiển thị đúng FQBN, compile/upload disabled khi bridge không có. Block thử được dọn và profile Generic ban đầu được khôi phục. Không thử file-picker round-trip/Serial I/O/upload trên browser; workspace serialization và metadata compatibility được test trên host. Trình duyệt cần Vite chạy ngoài sandbox vì localhost ban đầu timeout.

## 4. Known Issues

- **HARDWARE_UNTESTED**: chưa có PCB để xác minh USB topology, LED47, PSRAM runtime, nguồn/boot và mức chân thực. Hardware CDC là candidate, cần kiểm tra trên board nhận được.
- DC3–15V board input không chứng minh an toàn cho motor kit3–6V; không bật motor/servo. Startup LOW là inhibit phần mềm dự kiến, chưa có schematic/truth table driver V1 hoặc waveform trước CPU init.
- GPIO3 là ADC connector nhưng cũng strapping; profile chặn. Generic giữ semantics cũ và không thể bảo đảm an toàn cho mọi board/cách đấu tải. V2 web profile mới chỉ safe startup, không driver peripheral.
- PS4 generator `includes_/ps4_stdio`, helper escaping và các gap parser trước đây còn mở; không sửa hoặc claim compatibility PS4 với V1.
- Blockly getAllVariables deprecation, bundle >500kB, bridge origin allowlist chỉ5173/4173/8787 còn là giới hạn đã biết. Không thêm breakpoint/accessibility acceptance toàn diện.
- Upload/Serial real chưa test; mock upload chỉ xác minh command construction/guards. File-picker browser import/export round-trip chưa test lại.

## 5. Files to Commit

Chỉ stage các file source/tests/docs liệt kê mục2 và examples text. Không stage raw log, build artifacts hoặc tài liệu DOCX gốc của người dùng. Trước commit review `git diff --cached` và `git status` để bảo đảm không có thay đổi ngoài phạm vi. Các thay đổi V2 đã commit trước đó không thuộc task này.

## 6. Files Excluded by .gitignore

`node_modules/`, `dist/`, package-lock.json (quy tắc hiện hữu), `firmware/**/build-output/`, `firmware/**/build/`, `.bin/.elf/.map/.exe` dưới firmware; native fake GPIO executable/source trung gian ở build-output; `docs/verification/newmania_v1_*.log`. Binary compile service lưu trong temp ngoài repository. Test/report Markdown và `.ino`/workspace examples vẫn được commit.

## 7. Conventional Commit Message

```text
feat(boards): prepare Newmania V1 hardware testing with shared profiles
```

## 8. Commands for the User

Các lệnh dưới đây **chưa thực thi**, để người dùng review/stage/commit/push trên nhánh hiện tại:

```powershell
git add -- .gitignore AGENTS.md README.md package.json src/boards src/App.jsx src/components/BlocklyWorkspace.jsx src/components/DevicePanel.jsx src/generators/arduino.js src/styles.css tools/arduino-bridge.mjs tools/v1-examples.mjs tools/verify-v1-build.mjs tests firmware/newmania_v1 docs/DEVELOPMENT.md docs/IMPLEMENTATION_PLAN.md docs/PROGRESS.md docs/TESTING.md docs/architecture/ARCHITECTURE.md docs/boards docs/verification/NEWMANIA_V1_FAST_TRACK.md
git diff --cached --stat
git diff --cached --check
git commit -m "feat(boards): prepare Newmania V1 hardware testing with shared profiles"
git push -u origin HEAD
```

## 9. Hardware Test Checklist

[Checklist và biểu mẫu đầy đủ](../boards/V1_HARDWARE_TEST.md): nhận diện V1/N8R2; rút tải; xác nhận nguồn và logic; USB/PSRAM; chủ động upload minimal; Blink47; Serial115200; digital GPIO1; ADC GPIO1; PWM LED47. Ghi board/toolchain/wiring/observed result cho từng bài. Không tự đánh dấu hardware pass.

## 10. Next Task Recommendation

Khi nhận board, thực hiện **V1 hardware smoke test không tải** theo checklist, xác minh USB và PSRAM trước, rồi minimal/Blink/Serial/DI/ADC/PWM LED. Ghi các kết quả thật vào PROGRESS. Không tự chuyển sang MotorDriver V2, ServoDriver hoặc PS4Bridge. Fast track kết thúc ở chuẩn bị phần mềm cho test V1.
