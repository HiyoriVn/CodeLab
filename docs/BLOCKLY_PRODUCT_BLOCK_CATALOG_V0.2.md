# CodeLab — Blockly Product Specification V0.2 (BẢN DUYỆT)

> **Status:** DESIGN REVIEW / CHƯA TRIỂN KHAI. 10/11/2026.  
> **Baseline:** CodeLab <code>main</code> @ <code>2a0705d4</code>; V0.1 tại <code>docs/BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md</code>.  
> **Scope:** đặc tả trải nghiệm kéo thả + hợp đồng generator/runtime/thiết bị cho sản phẩm cuối. **Không phải** xác nhận các API đã được lập trình, biên dịch hay kiểm thử phần cứng.
>
> **Chủ đích:** học sinh có thể tạo bài đơn motor, PS4, 4WD và sau này thêm cảm biến mà không phải biết GPIO/FreeRTOS. Không cài runtime trung gian; kế hoạch WebAssembly nạp qua web được tách ở Issue #27, chưa triển khai.

**Ưu tiên đọc để duyệt:** §1 (các quyết định), §2 (RUN/FAULT), §3 (scheduler), §5 (Basic 30 block), §6 (schema C++), §8 (bài mẫu/test). Sau khi duyệt mới triển khai theo Issue #28.

## 1. Quyết định nền tảng và những thay đổi so với V0.1

| Vấn đề | Quyết định V0.2 | Ý nghĩa / giới hạn |
|---|---|---|
| Bắt đầu sau cấp nguồn | <code>INIT → READY</code>, motor PWM=0; **không tự RUN** | Board rút USB vẫn dùng được khi có START vật lý hợp lệ; BOOT GPIO0 chưa được chọn |
| Chế độ PS4/auto | Generator suy ra <code>requiresController</code> từ block PS4 khả dụng; cấu hình dự án cũng lưu <code>runMode=CONTROLLER/AUTONOMOUS</code> để kiểm tra tính nhất quán | Controller-required mất freshness thì FAULT; auto thuần không phụ thuộc PS4 |
| Khởi tạo thiết bị | Devices tự khai báo và khởi tạo trong runtime an toàn; block khởi tạo thủ công chỉ Advanced | Không yêu cầu học sinh kéo "khởi tạo M1" và "kết nối PS4" |
| ARM/DISARM | Lệnh hệ thống, **không phải block Basic**; Options/Share dành riêng | Basic có "Robot đang chạy?" và "Dừng chương trình" nếu thực sự cần; STOP web không được tự xưng E-stop phần cứng |
| Sau STOP | RUN → READY, hủy script/timer, reset biến trước lần RUN kế; **không resume** | FAULT cần clear riêng; clear không đồng nghĩa START |
| Motor sau handler | **Latched command:** lệnh motor còn hiệu lực sau khi handler kết thúc, đến khi bị thay hoặc STOP/FAULT/end chương trình | Handler kết thúc ≠ chương trình kết thúc; program RUN được giữ sống khi chờ sự kiện |
| Các script | Mỗi script gồm **một hat và các block con**; các vòng lặp nằm *trong* script; không tạo task FreeRTOS riêng theo hat | Backward compatibility v1 là opt-in migration (§7) |
| Sự kiện PS4 | Chốt cạnh ở tầng adapter; sự kiện hệ thống có ưu tiên cao, không vào queue học sinh | Event theo nút có pending tối đa 1, không mất vì block <code>Đợi</code> |
| <code>Đợi</code> | Nhường **script**, không block scheduler; có thể hủy khi STOP/FAULT; cuối mỗi vòng lặp phải yield | Generator mới cần resumable state-machine hoặc bounded coroutine; chưa chọn công cụ cuối cùng |
| Nhiều script ghi motor | Basic dùng **last accepted write wins**, có cảnh báo tĩnh; lệnh STOP/FAULT luôn ưu tiên | Timer cũ không được dừng lệnh mới: cần token/generation cho mỗi lệnh |
| Dấu và đơn vị | Học sinh: +tiến, +phải, +xoay-phải; facade chuyển một lần sang mixer nội bộ | C++ preview hiển thị lệnh theo hệ học sinh + chú giải mixer; giữ nguyên MecanumMixer hiện có |
| Chuyển động theo thời gian/vị trí | Giữ 3 loại độc lập: liên tục, có thời hạn/điều kiện, theo cảm biến | Không âm thầm lấy thời gian giả làm cm hay độ |
| Cảm biến | Chỉ hiện trong Basic khi Devices khai báo và **backend/driver đã hỗ trợ** | Sensor chưa nghiệm thu không xuất hiện như block "đã dùng được" |
| My Blocks chứa <code>Đợi</code> | **P0/P1: không cho yield trong hàm tự tạo**; báo validation rõ. Hỗ trợ resumable call stack ở P2 nếu thực sự cần | Tránh thiết kế call stack resumable quá sớm |
| Tương thích dự án | V1 giữ nguyên ID/schema/Arduino legacy; V2 dùng block type mới khi ngữ nghĩa thay đổi | Không silently đổi <code>beginner_start</code> từ setup sang RUN |

**V0.2 là thiết kế mục tiêu**, không được suy ra motor/servo đã có quyền phát PWM chỉ từ tài liệu.

### 1.1. Enum và ký hiệu không trùng nhau

- <code>kind</code>: <code>HAT</code> (hat/sự kiện), <code>STMT</code> (lệnh), <code>CONTROL</code> (khối chứa lệnh), <code>BOOL</code>, <code>NUMBER</code>, <code>TEXT</code>, <code>CONFIG</code> (Devices, không phải block).
- <code>status</code>: <code>EXISTS</code> (main đã có một dạng block và generator, **chưa** đảm bảo ngữ nghĩa V0.2), <code>SIM_ONLY</code>, <code>GATED</code> (hiện chặn compile), <code>NEW</code>, <code>HW_VERIFY</code>.
- <code>stage</code>: <code>S0</code> = scheduler không tải; <code>S1</code> = 1 motor + PS4; <code>S2</code> = 4WD; <code>S3</code> = sensor/advanced; không đồng nhất với P0/P1/P2 của inventory V0.1.
- <code>blocking</code> = có đợi điều kiện/chuyển động không; <code>interruptible</code> = có hủy được khi STOP/FAULT không. Mọi block Basic **phải interruptible**; lệnh I/O đồng bộ phải có timeout hữu hạn.
- <code>resources</code> = <code>MOTOR(M1)</code>, <code>DRIVE(M1..M4)</code>, <code>PS4(I2C)</code>, <code>LED(pin)</code>, <code>BUZZER</code>, <code>SENSOR(id)</code>, <code>SERIAL</code>, <code>NONE</code>. Khóa tài nguyên được tổng hợp theo Devices; cần kiểm tra xung đột và reserved pins trước compile.
- <code>i18n</code> là **khóa hiển thị**, không đổi Blockly <code>type</code> khi dịch hoặc thay nhãn.

## 2. Lifecycle & Safety Contract (trạng thái thực thi)

### 2.1. Trạng thái

| State | Motor output | Script user | Hành vi |
|---|---|---|---|
| <code>INIT</code> | 0, disabled | Chưa khởi chạy | Khởi tạo safe GPIO, board profile, safety monitor và Devices; kiểm lỗi |
| <code>READY</code> | 0, disabled | Chưa khởi chạy; biến sẽ reset khi start | Đợi **xác nhận START có chủ đích**; không tự chạy khi bật nguồn |
| <code>RUN</code> | Chỉ bật khi backend ready + không lỗi | Scheduler hoạt động; motor commands latched | Có thể chạy chương trình có/không PS4, tùy runMode |
| <code>FAULT</code> | 0, disabled/khóa **đầu ra motor** | Hủy tất cả script, timer, pending event | Báo lỗi; không tự clear hoặc auto-ARM |

<code>FAULT</code> không có nghĩa là khóa biên dịch/nạp chương trình lên mạch.

### 2.2. Bảng chuyển trạng thái bắt buộc

| Từ → Đến | Trigger / điều kiện | Tác động bắt buộc |
|---|---|---|
| Power-on → INIT | Reset/cấp nguồn | Set output safe sớm nhất có thể; không chạy Blockly |
| INIT → READY | Profile valid, safe startup và tài nguyên đã xác nhận; chưa bật motor | PWM=0; bật hiệu ứng ready nếu có |
| INIT → FAULT | Invalid pin/driver/power/profile không an toàn | Motor=0; lỗi được chốt |
| READY → RUN (CONTROLLER) | PS4 connected+fresh; tất cả trục neutral; **Options giữ đủ 1 giây** rồi nhả/được xác nhận; driver ready; không bị Share | Khởi tạo lại biến/script về trạng thái ban đầu, chạy hat <code>Khi bắt đầu</code>; không phát motor trong chính transition |
| READY → RUN (AUTO) | **Cử chỉ/nút START vật lý đã xác minh** + vùng an toàn + xác nhận có chủ đích; driver ready; optional countdown có thông báo | Như trên; **chưa có nút vật lý được xác minh thì chặn AUTO_RUN trên phần cứng** |
| RUN → READY | Share, nút STOP cục bộ hợp lệ hoặc explicit stopProgram, không phải lỗi | Ưu tiên ngắt; 0 PWM; cancel timed/latched commands, scripts, pending; reset biến ở lần start sau |
| RUN → FAULT | Controller-required mất report/timeout, scheduler heartbeat quá hạn, driver power fault, sensor bắt buộc mất hợp lệ trong active motion, invalid runtime config | 0 PWM ngay trong giới hạn thực thi đã kiểm chứng; hủy tất cả; latch mã lỗi |
| READY → FAULT | Lỗi cấu hình/safety phát hiện khi đang ready | Latch lỗi; vẫn 0 |
| FAULT → READY | Lỗi nguyên nhân đã hết; user thực hiện CLEAR riêng; input fresh+neutral nếu controller required; motor driver ready | Xóa fault, vẫn 0, **không chạy hat và không tự RUN** |
| READY → READY | Không có START hợp lệ; reset hoặc power cycle | Giữ 0 PWM, không tự chạy |
| Mọi trạng thái → INIT | Reset/reboot | Mặc định output off; reboot **không có nghĩa là lệnh RUN** |

**Lưu ý tương thích:** firmware fast100 hiện từng dùng Options rising edge để ARM. V0.2 đề xuất **giữ Options ~1 giây** để giảm kích ngoài ý muốn; đây là **thay đổi hành vi cần được người dùng duyệt và thử bench**, chưa tự triển khai lên firmware đã kiểm chứng. Bản test của V0.2 sẽ có firmware-compat mode và không silently làm thay đổi hệ thống cũ.

### 2.3. STOP / FAULT và giới hạn an toàn thực tế

- Share là lệnh hệ thống ưu tiên cao, **không** đưa qua event queue của học sinh; Options và Share **không có trong dropdown handler Basic**, nút PS còn hạn chế/ẩn vì có thể kích tính năng hệ thống tay cầm.
- Lệnh STOP web chỉ có hiệu lực khi trình duyệt vẫn kết nối và nhận được xác nhận; không phải E-stop hardware. Không mặc định dùng BOOT/GPIO0 làm START vì đây là chân strapping.
- Độc lập với code học sinh: một **safety monitor/tác vụ ưu tiên** quản lý motor-enable, heartbeat và freshness. Nhưng nếu CPU treo hoàn toàn thì task phần mềm có thể không chạy; cần kiểm chứng watchdog reset, trạng thái driver khi PWM ngừng, và công tắc/cơ chế ngắt nguồn động lực phù hợp. Các mục này là <code>HW_VERIFY</code>, không tuyên bố đã đạt.
- <code>requiresController</code> = true nếu có hat/reporter PS4 thật trong workspace V2 hoặc cấu hình runMode=CONTROLLER; kiểm tra mismatch runMode/Blocks trước compile. Script pure auto không phát sinh PS4 dependency. PS4 mô phỏng chỉ dùng test, không cấp ARM robot vật lý.
- STOP trong khi motor chạy có thời hạn: hủy cả **timer đang chờ**, motor=0; khi RUN trở lại tạo script/timer mới từ đầu; không resume.
- Tiêu chuẩn đề xuất sơ bộ: controller freshness 250 ms; safety heartbeat scheduler tối đa 250 ms. Đây là giá trị thiết kế để kiểm chứng trên bench, **không phải cam kết độ trễ dừng vật lý =250ms**.

## 3. Execution Contract — scheduler cho Blockly

### 3.1. Mô hình script

Một script = **một hat và stack bên dưới**. <code>Khi bắt đầu</code>, <code>Khi nút X nhấn</code>, <code>Khi nút X thả</code>, <code>Lặp mãi mãi</code> là block con trong script (không được có 2 top-level loop tự chen vào <code>setup()</code>/<code>loop()</code> theo vị trí hiển thị). Các block top-level không có hat bị cảnh báo <code>V2_ORPHAN_STACK</code> và không thực thi, nhưng vẫn lưu nguyên. Hàm tự tạo là định nghĩa riêng, không chạy tự phát.

**Chiến lược codegen mục tiêu:** resumable C++ state-machine theo script. Mỗi script có <code>programCounter</code>, timer deadline, pending event, frame counters riêng (cho vòng lặp lồng nhau), và biến/hàm không-yield ở v0.2; **không có** một FreeRTOS task riêng mỗi hat. Trong một vòng <code>scheduler.tick()</code>, chỉ một script tại một thời điểm được dispatch. Safety controller riêng kiểm tra heartbeat.

### 3.2. Điểm nhường và tính công bằng

- <code>Đợi(s)</code> tạo deadline dựa trên đồng hồ monotonic <code>millis()</code>, **suspend script**; 0 giây vẫn yield ít nhất một lần.
- <code>Đợi đến khi</code> suspend và kiểm tra lại mỗi tick; bắt buộc timeout mặc định 10 s, khi timeout báo lỗi/hủy hành động theo trạng thái.
- <code>Lặp N lần</code>, <code>Lặp khi</code>, <code>Lặp đến khi</code> và <code>Lặp mãi mãi</code>: **yield ở cuối mỗi vòng**, kể cả thân rỗng; đếm N tính một lần, counter nằm trong frame script, không dùng biến <code>i</code> trùng giữa vòng lặp.
- Mỗi statement đơn giản được giới hạn thành một bước hoặc chi phí operation; nếu có quá nhiều statement liên tục, scheduler phải nhường khi hết budget, không phụ thuộc vào có vòng lặp hay không.
- Đồng hồ wraparound xử lý bằng so sánh time difference an toàn; timeout mỗi lần không vượt quá phạm vi integer signed. Dừng/hủy phải chạy được dù đang suspended.

**Ngân sách đề xuất cho spike** (phải benchmark): tối đa <code>16</code> scripts đã đăng ký, tối đa <code>16</code> active, <code>256</code> generated operations hoặc <code>2 ms</code> tổng script work cho một tick, kiểm tra heartbeat ≤<code>50 ms</code>, heartbeat timeout motor <code>250 ms</code>. Đây là **acceptance target**, chưa phải giới hạn tối ưu chứng minh được trên board. Một I²C/sensor call block không được chặn vượt ngân sách; phải có driver async/bounded poll.

### 3.3. Event edge và lịch điều phối

1. Adapter PS4 xử lý frame hợp lệ **một lần** (sequence + freshness), chốt trạng thái pressed/released và counter cạnh theo nút. Không được tạo cạnh từ frame lặp hoặc stale. Lệnh hệ thống Share/Options được xử lý riêng.
2. Với một hat PS4: nếu handler chưa active → chạy; nếu active → tăng pending nhưng **tối đa 1** (coalesce), lần nhấn tiếp theo vượt mức ghi counter overflow chẩn đoán. Không tạo hàng đợi vô hạn.
3. Khi handler active hoàn thành, nếu pending=1 và còn RUN → chạy lại **từ đầu** một lượt, pending=0. Nếu đã STOP/FAULT → không chạy lại.
4. Tie-break giữa các sự kiện **không dựa vào tọa độ x/y của block**: ưu tiên thứ tự sample frame (sequence/time), rồi loại sự kiện PRESS trước RELEASE nếu cùng nguồn/timestamp, rồi thứ tự enum nút cố định, cuối cùng <code>scriptUid</code> ổn định lưu trong metadata project. Thay vị trí block không đổi thứ tự; copy block tạo UID mới.
5. Không có sự kiện nút Options/Share trong Basic; Share STOP ngay cả khi scheduler đang ở <code>Đợi</code>. Cờ STOP/FAULT được đọc ưu tiên cao trước khi dispatch script mới.
6. Hai handler tác động cùng motor: ghi cuối đã **được chấp nhận** chiếm owner. Static analyzer phát <code>V2_MOTOR_MULTI_WRITER</code> cảnh báo (không chặn Basic). Motor stop riêng là lệnh write có thể ngắt owner trước.

### 3.4. Latch, timer và quyền sở hữu chuyển động

- <code>motor.run(M1,50%)</code> là **latched**. Kết thúc handler chỉ hủy stack handler, **không hủy lệnh motor**. Program RUN vẫn tồn tại để đón sự kiện dù không còn handler đang active.
- <code>motor.stop(M1)</code>, <code>stopAll</code>, ghi mới lên M1, hoặc STOP/FAULT xóa latch. Chương trình kết thúc ở đây nghĩa là **lifecycle rời RUN** (STOP/FAULT/explicit program end), không phải khi một hat kết thúc.
- <code>motorRunFor(...,1s,WAIT)</code>/<code>driveFor(...,1s,WAIT)</code> dùng **motion handle** và thời hạn do runtime/scheduler quản lý, **không** sinh <code>delay(1000)</code>. WAIT suspend script; DON'T_WAIT trả về ngay.
- Khi lệnh mới ghi trùng channel, lệnh cũ bị thay/hủy, tăng <code>ownerGeneration</code>. Timer cũ kết thúc **không được stop motor do lệnh mới đang sở hữu**. Lệnh timed mới dừng output **chỉ nếu còn giữ đúng token**.
- <code>DRIVE</code> coi là một command group atomic qua các motor trong drivetrain đã định nghĩa. Nếu script riêng ghi vào một motor đang do drivetrain quản lý, command cũ được hủy/đổi ownership theo chính sách; phát static warning.
- <code>Đợi</code> không phải lệnh chuyển động và không tự stop latch. Trong V0.2 không có auto-stop khi handler kết thúc; cần guard heartbeat và giới hạn tối đa thời gian chạy phần cứng tùy bài/driver để giảm rủi ro.

### 3.5. My Blocks và runtime errors

- P0/P1 hỗ trợ hàm tự tạo **không chứa** <code>Đợi</code>, <code>Đợi đến khi</code>, timed-motion WAIT, hoặc gọi hàm con chứa những lệnh đó. Validator duyệt call graph và từ chối yield gián tiếp với <code>V2_PROC_YIELD_UNSUPPORTED</code>.
- Hàm đệ quy bị chặn hoặc giới hạn độ sâu bằng static analysis (<code>V2_PROC_RECURSION</code>); P2 mới cân nhắc resumable call frame nếu được yêu cầu.
- Mọi statement có side effect phải idempotent qua resume: khôi phục script ở <code>pc</code> sau khi đã gửi lệnh, không gửi lại motorRun hay Serial.print trong mỗi tick.
- Giới hạn / hết bộ nhớ / lỗi scheduler dẫn đến chặn compile hoặc FAULT motor tùy mức; không âm thầm bỏ script rồi vẫn giữ động cơ chạy.

### 3.6. Ví dụ semantics phải PASS trên đồng hồ ảo

~~~text
Khi nút X nhấn:
  Motor M1 quay 50%
  Đợi 2 giây
  Dừng M1

Khi nút O nhấn:
  Hiện "Xin chào!"
~~~

- t=0: X pressed ⇒ M1 command = +50%, X script suspended đến deadline 2000ms.
- t=500ms: O pressed ⇒ Serial "Xin chào!" ở tick kế tiếp trong budget; M1 vẫn +50%.
- t=2000ms: script X resume ⇒ stop M1. Không phụ thuộc wall-clock chờ 2 giây trong unit test.
- Nếu STOP tại t=750ms ⇒ M1=0, O/X pending bị hủy, không có stop callback cũ ở 2000ms; RUN trở lại thì script và biến reset.
- Nếu X nhấn hai lần trong khi script X đang chờ ⇒ tối đa 1 lượt pending; sau t=2000ms chạy lại X nếu vẫn RUN.
- Nếu script đơn <code>Khi nút X nhấn → M1 quay 50%</code> kết thúc và chờ <code>Khi X thả → Dừng M1</code>, M1 phải còn +50% ở giữa.
- Vòng lặp <code>forever {}</code>, <code>repeat N {}</code> hoặc <code>while(true){}</code> rỗng không được làm đói handler O; mọi STOP phải ngắt được.
- Thử <code>Đợi</code> lồng trong repeat→if→repeat; sau resume counter đúng, không lặp lại side-effect.
- Không có rủi ro cho robot thật trong spike: dùng mock motor + virtual clock trên PC.

### 3.7. Hai kiến trúc cần làm spike so sánh (chưa chốt implementation)

| | Resumable state-machine C++ | Bounded cooperative coroutines/tasks |
|---|---|---|
| Bộ nhớ | Per-script PC+frame/counter tĩnh, không task stack riêng | Bộ nhớ stack/context trên mỗi script hoặc số task cố định |
| Đợi lồng if/repeat | Compiler phải chia continuation đúng; phức tạp | C++ source gần block hơn nếu dùng stack |
| Dữ liệu dùng chung | Chỉ một script dispatch tại một lúc | Chỉ một script dispatch tại một lúc |
| My Blocks chứa Đợi | Phải làm resumable call stack | Có thể thuận tiện hơn, nhưng vẫn cần bound |
| Rủi ro | Độ phức tạp generator cao | RAM/context switching/cancellation cần xác minh |
| Quyết định | **Chọn làm spike đầu tiên**, vì không thêm FreeRTOS task/stack theo hat | Spike đối chứng nếu state-machine thất bại hoặc không đáp ứng test |

**Go/No-Go:** chỉ chọn implementation sau khi pass 2 handler X/O + nested wait + stop + retrigger + no-starvation trên virtual clock, đo RAM/code size/độ phức tạp và có bản codegen tối thiểu chạy được. Không thay firmware thật trong spike.

## 4. Devices, cảm biến và tọa độ

### 4.1. Devices metadata và tên/ID

- Mỗi project lưu <code>boardId</code>, <code>runMode</code>, <code>devices[]</code>, <code>motorRoles</code>, <code>invert</code>, <code>limits</code>, <code>sensorMap</code> (schema mới, có version). Cấu hình Devices được generator/firmware áp dụng **trước khi RUN**.
- Block lưu ID ổn định như <code>M1</code>, <code>M2</code> (physical channels), <code>Group_1</code> hoặc <code>Sensor_A</code>. UI hiển thị alias như "Bánh trước trái". Đổi tên không đổi ID; xóa Device → block còn nguyên, gắn warning <code>V2_DEVICE_MISSING</code>; **không tự map sang kênh khác**.
- Mỗi kênh thiết bị chỉ gán một chân/driver profile được kiểm chứng; raw GPIO/I²C trong Advanced bị chặn nếu trùng motor, USB, PS4, boot/strapping, bộ nhớ flash/PSRAM.
- <code>Devices</code> tự setup; block khởi tạo chỉ Advanced hoặc template dạy kỹ thuật, không hiển thị Basic.
- <code>cfg.maxDutyPercent</code> (safety, không học sinh tự nâng), <code>motorLimit(M1)</code> và <code>driveLimit</code> được kết hợp theo **minimum applicable bound**. Giá trị 100% là *duty command*, không tự suy thành RPM thực.
- D06 Drivetrain phải lưu geometry cho tương lai: <code>wheelDiameterMm</code> (chưa biết → null), <code>trackWidthMm</code> (null), <code>wheelBaseMm</code> (null), <code>gearRatio</code> (nếu biết). Không tự điền kích thước giả cho block cm/degree.
- LED status PS4 và block LED học sinh không được cùng ghi GPIO trực tiếp: <code>LED_RESOURCE</code> có chính sách owner, mặc định system-status owns; block LED học sinh chỉ bật nếu tắt status qua Devices và không xung đột. V2 GPIO47 dành M6, **không** mặc định là LED.
- Servo, encoder, IMU, siêu âm, color, line sensor chỉ hiện khi Devices có thiết bị tương thích **và** runtime feature được nghiệm thu. Nếu mất sensor sau khi đã lưu project: block vẫn còn, warning + compile gate; không tự xóa hay giả giá trị.

### 4.2. Profile facts đọc từ main (không phải hardware acceptance)

| Profile có trong main | Board | Motors | Servo | Trạng thái |
|---|---|---|---|---|
| <code>newmania-starter-v1</code> | S3 N8R2 8MB QSPI theo config | M1..M4, S1..S4 | Motor <code>motorControl:false</code> | Chặn phát tải từ Blockly |
| <code>steam-mainboard-v2</code> | S3 MINI N8 8MB | M1..M6, S1..S6 | Motor <code>motorControl:false</code> | Chưa đủ bằng chứng 6 output |
| <code>newmania-v1-16m-opi-experimental</code> | 16MB/OPI8 theo profile thực nghiệm cũ | LED47 only | Không có motor | Không dùng làm profile 4WD thực |
| Board 4WD đã thử tại chỗ | S3 Flash 16MB, PSRAM disabled theo phiên thử | 4 motor + I²C bridge 0x30 | Bản firmware fast100 không có trong <code>main</code> đã rà soát | Phải xác nhận exact hardware profile/mapping trước khi cho phép block motor |

### 4.3. Hai lớp chuẩn hóa dấu, giữ nguyên mixer cũ

| Miền | Gốc số liệu | Quy ước học sinh | Áp dụng ở |
|---|---|---|---|
| PS4 raw | Trục LY thường âm khi đẩy lên, theo mapping từ D1 | <code>forward = -rawLY</code>; LX/RX chuẩn dương sang phải | **PS4 adapter**: raw → học sinh (test dấu) |
| Facade <code>robot.drive()</code> | <code>forward, right, turnClockwise</code> | + = tiến, phải, xoay theo chiều kim đồng hồ | **Robot facade**: <code>mixer(vx=forward, vy=-right, omega=-turnClockwise)</code> |
| MecanumMixer hiện có | <code>+vx</code>=tiến, <code>+vy</code>=trái, <code>+omega</code>=ngược chiều kim đồng hồ | Không đổi | Driver/mixer đang có |
| IMU tương lai | Raw yaw có thể CCW dương | Trả về heading học sinh 0..360, CW dương | Sensor adapter, không rải đổi dấu ở generator |

Test cả dấu cho joystick 6 hướng, spin ±, strafe ±, tổ hợp trục; đưa chú giải trên màn hình **Xem code** rằng API facade dùng student coordinate và mixer dùng internal coordinate.

### 4.4. Sensor contract

Mỗi bản đọc phải có <code>{value, valid, sampledAtMs}</code>, thiết bị có timeout và độ tuổi tối đa do driver định nghĩa. Khi dữ liệu invalid/stale:
- Reporter số không được âm thầm phát lại giá trị cũ. Phát diagnostics kèm sensor ID; reporter có fallback dạng <code>0</code> **chỉ nếu** block đang chạy kiểm tra trạng thái invalid, và compile warning yêu cầu guard.
- Điều kiện boolean với sensor invalid trả <code>false</code> + cảnh báo. Nếu sensor là **điều kiện kết thúc chuyển động đang active**, stop chuyển động ngay, đánh dấu <code>SENSOR_INVALID</code> (có thể nâng lên FAULT theo policy), không được chạy đến hết timeout như thể cảm biến vẫn hợp lệ.
- Block motion-until có deadline mặc định <code>10s</code>, cancel được và không có fallback tự chạy theo thời gian. Motion-by-angle/cm bị **GATED** nếu thiếu IMU/encoder hay thuật toán đo được nghiệm thu.
- Các lệnh driver đọc sensor và I²C đều timeout hữu hạn, không block scheduler vô thời hạn.

## 5. Palette Basic V0.2 — 30 block cốt lõi, có schema triển khai

**Định dạng schema bảng:** <code>ID</code> chỉ là mã tài liệu; <code>type</code> là Blockly serialization ID **ổn định**. <code>fields</code> là giá trị lưu trong JSON; <code>inputs</code> có <code>check</code> và shadow mặc định. <code>C++</code> là code tương đương qua proposed facade (không phải API hiện có). <code>Yield</code> ghi <code>N</code>=không suspend / <code>Y</code>=có thể suspend, nhưng **đều có thể ngắt**. <code>Warn</code> là mã validation tiêu biểu, không đầy đủ. <code>i18n</code> là key dùng trong bảng dịch; colors lấy từ palette hiện có theo <code>category</code>, không hardcode trong generator.

### 5.1. Bắt đầu & Điều khiển (6)

| ID | type / kind / category / i18n | Label và fields/inputs (default) | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| A01v2 | <code>codelab_when_run</code> HAT / control / <code>block.when_run</code> | "Khi chương trình bắt đầu"; <code>BODY: Statement</code> | Script entry khi READY→RUN; **không** phải Arduino setup() | NONE · N · ORPHAN | NEW/S0 |
| A02v2 | <code>codelab_forever</code> CONTROL / control / <code>block.forever</code> | "Lặp lại mãi mãi"; <code>DO: Statement</code> | Scheduler back-edge + yield mỗi lượt | NONE · Y · SCRIPT_BUDGET | NEW/S0 |
| A03 | <code>controls_if</code> CONTROL / logic / <code>block.if</code> | <code>IF0: Boolean=false</code>, <code>DO0: Statement</code> | <code>if(cond) {...}</code> continuation-safe | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| A04 | <code>controls_if</code> CONTROL / logic / <code>block.if_else</code> | Như A03 + <code>ELSE: Statement</code>; mutator hasElse=true | <code>if(cond) {...} else {...}</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| A06 | <code>controls_repeat_ext</code> CONTROL / control / <code>block.repeat_n</code> | <code>TIMES: Number=5</code>, <code>DO: Statement</code> | Count eval **một lần**, per-script loop frame; yield mỗi iteration | NONE · Y · REPEAT_LIMIT | EXISTS/S0 (rewrite codegen) |
| A08v2 | <code>codelab_wait_seconds</code> STMT / control / <code>block.wait_seconds</code> | <code>SECONDS: Number=1</code> (0..60) | <code>scheduler.sleep(scriptId,1000)</code> + resume, **không delay()** | NONE · Y · INVALID_DURATION | NEW/S0 |

### 5.2. Chuyển động (8)

| ID | type / kind / category / i18n | Label; fields/inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| B02v2 | <code>codelab_motor_run</code> STMT / motion / <code>block.motor_run</code> | "Motor [M1] quay [tiến] [50]%"; <code>MOTOR_ID=M1</code>, <code>DIR=FORWARD</code>, <code>POWER:Number=50</code> | <code>robot.motorRun(M1,Forward,50);</code>; latched | MOTOR(M1) · N · DRIVER_GATED | NEW/S1; HW_VERIFY |
| B03v2 | <code>codelab_motor_power</code> STMT / motion / <code>block.motor_power</code> | "Motor [M1] công suất [0]%"; <code>MOTOR_ID=M1</code>, <code>POWER:Number=0</code> (-100..100) | <code>robot.motorSetPower(M1,0);</code>; latched | MOTOR(M1) · N · DRIVER_GATED | NEW/S1 |
| B04v2 | <code>codelab_motor_stop</code> STMT / motion / <code>block.motor_stop</code> | <code>MOTOR_ID=M1</code> | <code>robot.motorStop(M1);</code> | MOTOR(M1) · N · DEVICE_MISSING | NEW/S1 |
| B05v2 | <code>codelab_motor_stop_all</code> STMT / motion / <code>block.motor_stop_all</code> | Không tham số | <code>robot.stopAllMotors();</code>; hệ thống STOP có ưu tiên cao hơn | ALL_MOTORS · N · DRIVER_GATED | NEW/S1 |
| C02v2 | <code>codelab_drive_direction</code> STMT / motion / <code>block.drive_direction</code> | "Robot [tiến ▾] [50]%"; <code>DIRECTION=FORWARD</code> (BACKWARD/STRAFE_LEFT/RIGHT/TURN_LEFT/RIGHT), <code>POWER:Number=50</code> | <code>robot.driveDirection(Forward,50);</code>; latched | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C06v2 | <code>codelab_drive_axes</code> STMT / motion / <code>block.drive_axes</code> | "Robot tiến [0] ngang-phải [0] xoay-phải [0]"; <code>FWD/RIGHT/CW:Number=0</code> | <code>robot.drive(fwd,right,cw);</code>; signs converted only in facade | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C08v2 | <code>codelab_drive_stop</code> STMT / motion / <code>block.drive_stop</code> | Không tham số | <code>robot.driveStop();</code> | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C10v2 | <code>codelab_drive_for_time</code> STMT / motion / <code>block.drive_for_time</code> | "Robot [tiến] [50]% trong [1] giây [và đợi]"; <code>DIRECTION=FORWARD</code>, <code>POWER:Number=50</code>, <code>SECONDS:Number=1</code>, <code>WAIT=WAIT</code> hoặc <code>NO_WAIT</code> | <code>motion.startTimedDrive(Forward,50,1000,WAIT);</code>; wait suspend script, timer stop **if still owner** | DRIVE · Y if WAIT · MOTION_TIMEOUT | NEW/S2 |

### 5.3. Tay cầm PS4 (5; chỉ hiện nếu Devices có PS4 I²C được hỗ trợ)

| ID | type / kind / category / i18n | Label, fields/inputs, default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| A14v2 | <code>codelab_when_ps4_pressed</code> HAT / ps4 / <code>block.ps4_when_pressed</code> | "Khi nút [X] được nhấn"; <code>BUTTON=X</code>, BODY statement | <code>events.onPressed(X,scriptUID)</code>; edge latched; Options/Share/PS không chọn được | PS4 · N · RESERVED_BUTTON | NEW/S0 |
| A17v2 | <code>codelab_when_ps4_released</code> HAT / ps4 / <code>block.ps4_when_released</code> | "Khi nút [X] được thả"; <code>BUTTON=X</code>, BODY statement | <code>events.onReleased(X,scriptUID)</code> | PS4 · N · RESERVED_BUTTON | NEW/S0 |
| DP03v2 | <code>codelab_ps4_pressed</code> BOOL / ps4 / <code>block.ps4_pressed</code> | "Nút [X] đang được nhấn?"; <code>BUTTON=X</code> | <code>ps4.pressed(X)</code> đọc snapshot đã xác minh | PS4 · N · PS4_UNAVAILABLE | NEW/S1 |
| DP06v2 | <code>codelab_ps4_axis_percent</code> NUMBER / ps4 / <code>block.ps4_axis_percent</code> | "Cần [trái] trục [dọc] (%)"; <code>STICK=LEFT</code>, <code>AXIS=Y</code>; -100..100 | <code>ps4.axisPercent(LY)</code> (LY lên = dương) | PS4 · N · PS4_UNAVAILABLE | NEW/S1 |
| DP02v2 | <code>codelab_v2_ps4_connected</code> BOOL / ps4 / <code>block.ps4_connected</code> | "PS4 đã kết nối?"; không tham số | <code>ps4.connected()</code> valid+fresh+not-stale | PS4 · N · PS4_UNAVAILABLE | NEW/S1 |

Allowed PS4 buttons sau khi xác nhận mapping thực: <code>X, Circle, Square, Triangle, L1, R1, L2, R2, DPadUp, DPadDown, DPadLeft, DPadRight, L3, R3</code>. L2/R2 trong V0.2 chỉ được dùng như nút digital khi report hỗ trợ; không khẳng định có analog trigger. <code>Options</code>, <code>Share</code> là hệ thống, <code>PS</code> ẩn/chặn.

### 5.4. Logic & Toán (6)

| ID | type / kind / category / i18n | Fields, inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| H01 | <code>logic_boolean</code> BOOL / logic / <code>block.boolean</code> | <code>BOOL=FALSE</code> | <code>false</code> | NONE · N · — | EXISTS/S0 |
| H02 | <code>logic_compare</code> BOOL / logic / <code>block.compare</code> | <code>OP=EQ</code>, <code>A:Number=1</code>, <code>B:Number=1</code> | <code>(a == b)</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| H03 | <code>logic_operation</code> BOOL / logic / <code>block.logic_operation</code> | <code>OP=AND</code>, <code>A:Boolean=true</code>, <code>B:Boolean=true</code> | <code>(a && b)</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| H04 | <code>logic_negate</code> BOOL / logic / <code>block.logic_not</code> | <code>BOOL:Boolean=true</code> | <code>!a</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| H05 | <code>math_number</code> NUMBER / math / <code>block.number</code> | <code>NUM=0</code> | <code>0</code> | NONE · N · INVALID_NUMBER | EXISTS/S0 |
| H06 | <code>math_arithmetic</code> NUMBER / math / <code>block.arithmetic</code> | <code>OP=ADD</code>, <code>A:Number=1</code>, <code>B:Number=1</code> | <code>a + b</code> / - × ÷, guard division by zero | NONE · N · DIVIDE_BY_ZERO | EXISTS/S0 |

### 5.5. Biến (3)

| ID | type / kind / category / i18n | Fields, inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| I02 | <code>variables_set</code> STMT / variable / <code>block.variable_set</code> | <code>VAR=biến_mới</code>, <code>VALUE:Number=0</code> | <code>var_&lt;stableId&gt; = 0;</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| I03 | <code>math_change</code> STMT / variable / <code>block.variable_change</code> | <code>VAR=biến_mới</code>, <code>DELTA:Number=1</code> | <code>var_&lt;stableId&gt; += 1;</code> | NONE · N · NON_NUMERIC_VARIABLE | EXISTS/S0 |
| I04 | <code>variables_get</code> NUMBER / variable / <code>block.variable_get</code> | <code>VAR=biến_mới</code> | <code>var_&lt;stableId&gt;</code> | NONE · N · UNDEFINED_VARIABLE | EXISTS/S0 |

Đối với Basic, biến **số** là kiểu P0. Sau này bổ sung text/bool theo type system rõ. Tên Unicode trong UI không trực tiếp thành symbol C++: dùng ID/namespace-generated identifier có collision guard, giữ tên hiển thị cho người học. Reset lại trạng thái biến mỗi lần READY→RUN.

### 5.6. Hiển thị và LED (2; LED chỉ hiện nếu Devices đã cấu hình và không trùng nguồn system)

| ID | type / kind / category / i18n | Fields, inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| E05 | <code>beginner_message</code> STMT / display / <code>block.serial_message</code> | <code>VALUE: String="Xin chào!"</code> | <code>Serial.println("Xin chào!");</code> | SERIAL · N · STRING_UNSUPPORTED | EXISTS/S0 |
| E01 | <code>beginner_led</code> STMT / led / <code>block.led_toggle</code> | <code>STATE=HIGH</code> | <code>ui.ledSet(LED_ON)</code>; facade owns pin, **không digitalWrite trực tiếp khi system link LED đang chiếm** | LED · N · LED_BUSY/NO_LED | EXISTS label / NEW facade |

**Đếm:** 6 Control + 8 Motion + 5 PS4 + 6 Logic/Math + 3 Variables + 2 Display/LED = **30 block/biến thể cốt lõi**. Các block phần cứng chỉ được hiển thị khi Devices/runtime đáp ứng; vì vậy một dự án chưa chọn PS4/motor sẽ có ít hơn 30 block. Điều này là chủ ý.

### 5.7. Quy ước schema bổ sung

- Giá trị mặc định ở mọi <code>Number input</code> dùng Blockly shadow <code>math_number</code>; không để socket số rỗng khi tạo block. Dropdown dùng **stable ID** từ Devices, UI label có thể đổi tên mà không đổi JSON; xóa Device giữ block + warning icon.
- Mỗi block phải có <code>type</code>, <code>message0</code>, <code>args0</code>, <code>fieldName</code>, <code>inputName</code>, <code>outputCheck</code> (BOOL→<code>Boolean</code>, NUMBER→<code>Number</code>, TEXT→<code>String</code>), <code>previousStatement/nextStatement</code> hoặc <code>output</code>, <code>colour</code>/<code>style</code>, <code>tooltip</code>, <code>i18n</code>, <code>status</code>, <code>requiredCapabilities</code>, <code>resources</code>, <code>blocking</code>, <code>interruptible</code>, <code>validationCodes</code>.
- Màu áp dụng từ palette <code>src/blocks/palette.js</code>: control <code>#7ECBB1</code>, math <code>#9ECB8E</code>, logic <code>#8DB5E6</code>, variable <code>#EDB070</code>, display <code>#C4A3D8</code>, sensor <code>#7CC4DA</code>, PS4 <code>#D9A0D3</code>, advanced <code>#A8B6C8</code>. **Motion** là category mới cần chọn trong theme (đề xuất <code>#4C97FF</code>), không xóa màu đang lưu ở block cũ.
- <code>resources</code> phân tích tĩnh từ block + target ID + Devices. Static warning nếu hai script cùng ghi một motor (<code>V2_MOTOR_MULTI_WRITER</code>) nhưng runtime Basic là last accepted write wins. Bị block compile nếu device missing/profile unsafe.
- Blockly JSON version 2 bổ sung <code>scriptUid</code> ổn định cho từng hat. Trạng thái công việc sau khi người dùng kéo block, undo/redo hoặc đổi layout phải giữ UID. Cùng 2 event chồng nhau áp dụng tie-break §3.3.
- <code>blocking</code> trong bảng là suspend *script*, không block FreeRTOS. API C++ trong bảng là biểu diễn contract; generator thực có thể sinh state-machine thay vì một lời gọi hàm đơn lẻ.

## 6. Full-product extensions — giữ đủ phạm vi danh mục V0.1, không nhồi vào Basic ngay

Những nhóm sau vẫn nằm trong **sản phẩm cuối** nhưng không phải 30 block mặc định. Cột C++ là proposed API, **không xác nhận đã compile**. Không thêm block nếu chỉ tạo ra UI giả không hoạt động.

| Nhóm | ID V0.1 / tính năng | Hành vi V0.2, tham số mặc định, C++ dự kiến | Điều kiện bật |
|---|---|---|---|
| Control/Events | A05 nhiều nhánh | <code>else if(cond2){...}</code> native mutator, BOOL=false | S0 |
| Control | A07 lặp đến khi | <code>whileUntil(condition=false)</code>; yield mỗi lượt, no-starvation; nếu treo hoạt động cần timeout policy | S1 |
| Control | A09 đợi đến khi | <code>scheduler.waitUntil(cond, timeoutMs=10000)</code> | S1 |
| Control | A10 lặp khi | <code>while(cond){...; yield}</code>, condition=false | S1 |
| Control | A11 thoát loop | <code>break;</code> theo continuation frame đúng | S1 |
| Control | A12 dừng chương trình | <code>runtime.requestStop()</code>; CANCEL all latches/timers | S0 |
| Control | A13 giây từ khi RUN | <code>runtime.runSeconds()</code>; reset mỗi lần START | S1 |
| Events | A15 PS4 mất kết nối | <code>events.onLostLink(...)</code> chỉ trong dự án controller; safety xử lý trước script | S2 |
| Events | A16 nhận tin nhắn | <code>events.onMessage("start")</code>; 1 pending per handler | S3 |
| Control | A17 PS4 nhả | **MỚI**, hat như §5.3, BUTTON=X mặc định | S0 |
| Motor | B01 khởi tạo M1 | Advanced: <code>robot.initMotor(M1)</code>; Basic tự setup Devices | S1 |
| Motor | B06 giới hạn M1 | <code>robot.motorLimit(M1,100)</code>; min Device bound | S1 |
| Motor | B07 đảo chiều M1 | Thiết lập trong Devices; Advanced setup <code>cfg.motor[M1].inverted=false</code> | S1 |
| Motor | B08 chạy motor trong thời gian | <code>motion.startTimedMotor(M1,Forward,30,1000,WAIT)</code>; token owner, interruptible | S1 |
| Motor | B09 motor đang nhận lệnh? | <code>robot.motorCommanded(M1)</code>; **không** chứng minh bánh quay | S2 |
| Motor | B10 công suất yêu cầu M1 | <code>robot.motorCommandPercent(M1)</code>; số có dấu -100..100 | S2 |
| Motor | B11–B12 nhóm motor | <code>robot.groupRun(Group_1,Forward,30)</code>/<code>robot.groupStop(Group_1)</code>; DEVICES-defined | S2 |
| Motor | B13 dừng coast/brake | <code>robot.motorStopMode(M1,Coast)</code>; driver truth-table verified | HW_VERIFY |
| Motor | B14 quay 90° / B15 vị trí độ | <code>robot.motorMoveDegrees(M1,90,30)</code>/<code>robot.motorAngleDeg(M1)</code> | Encoder + PID validated |
| Motor | B16 dòng motor | <code>robot.motorCurrentA(M1)</code> | Current sensor validated |
| Drive | C01 khởi tạo 4WD | Basic auto Devices; Advanced <code>robot.initDrive(Mecanum4)</code> | S2 |
| Drive | C07 giới hạn drive | <code>robot.driveLimit(100)</code>; min Device + motor | S2 |
| Drive | C09 drive ready? | <code>robot.driveReady()</code> | S2 |
| Drive | **MỚI** đi đến khi | <code>motion.driveUntil(Forward,50,condition,timeout=10s,WAIT)</code>; no stale sensor and no time fallback | S3 + sensor |
| Drive | **MỚI** quay [phải] [90] độ | <code>motion.turnToDelta(CW,90,WAIT)</code> | IMU/encoder + controller HW_VERIFY |
| Drive | **MỚI** đi [tiến] [30] cm | <code>motion.driveDistance(Forward,30,WAIT)</code> | Encoder/odometry HW_VERIFY |
| Drive | **MỚI** quay đến hướng [0]° | <code>motion.turnToHeading(0,WAIT)</code> | IMU yaw calibrated |
| Drive | **MỚI** đặt lại hướng | <code>sensors.resetHeading(0)</code> | IMU feature HW_VERIFY |
| Drive | **MỚI** timeout chuyển động mặc định | <code>cfg.motionTimeoutMs=10000</code> (Devices; không override safety) | S3 |
| PS4 | D-P01 kết nối PS4 | **Advanced** manual; Basic auto init I2C 0x30 SDA8 SCL9 từ Devices | S1 |
| PS4 | D-P04 Options edge | **SYSTEM-ONLY**: giữ Options 1s để START; không có handler student | S1 + bench |
| PS4 | D-P05 vừa thả X? | <code>ps4.justReleased(X)</code>, state latched per frame | S1 |
| PS4 | D-P07 forward percent | <code>ps4.forwardPercent()</code>; LY lên positive | S2 |
| PS4 | D-P08 turn percent | <code>ps4.turnClockwisePercent()</code>; LX right positive | S2 |
| PS4 | D-P09 strafe percent | <code>ps4.strafeRightPercent()</code>; RX right positive | S2 |
| PS4 | D-P10/D-P11 ARM/DISARM | **Không có block Basic**; control-plane Options/Share; Advanced diagnostics không được bypass safety | S1 |
| PS4 | D-P12 đang RUN? | <code>runtime.isRunning()</code>, BOOL | S1 |
| PS4 | D-P13 đang FAULT? | <code>runtime.hasFault()</code>, BOOL | S1 |
| PS4 | D-P14 clear fault | Control-plane only, require fresh/neutral; **không auto-arm** | S1 |
| PS4 | D-P15 fault code | <code>runtime.faultCode()</code> | S1 |
| PS4 | D-P16 timeout | <code>ps4.linkTimedOut()</code>; safety limit 250ms is runtime constant, **không chỉnh Devices Basic** | S1 |
| LED | E02 blink | <code>ui.ledBlink(500)</code>; nonblocking runtime, no raw delay in concurrent handler | S1, led ownership |
| LED | E03 báo PS4 | <code>ui.setLinkLedEnabled(true)</code>; system owns LED | S1 |
| LED | E04 độ sáng | <code>ui.ledBrightness(50)</code> | PWM LED support verified |
| Display | E06 print raw | <code>Serial.print(value)</code>, default 0 | S1 |
| Buzzer | E07 beep/E08 off | <code>ui.buzzerBeep(200)</code>/<code>ui.buzzerOff()</code> | HW_VERIFY |
| Servo | F01 init S1 | Auto Devices, không bật PWM khi nguồn chưa ổn | HW_VERIFY |
| Servo | F02 tới 90° | <code>robot.servoSetAngle(S1,90)</code> | HW_VERIFY |
| Servo | F03 tốc độ 45°/s | <code>robot.servoRate(S1,45)</code> | HW_VERIFY |
| Servo | F04 disable | <code>robot.servoDisable(S1)</code>; khác cắt nguồn | HW_VERIFY |
| Servo | F05 góc yêu cầu | <code>robot.servoCommandDeg(S1)</code>; không phải đo thật | HW_VERIFY |
| Sensors | G01 digital input/G02 ADC | <code>digitalRead(pinOf(D1))</code>/<code>analogRead(pinOf(A1))</code>; pin từ Devices | Board+sensor verified |
| Sensors | G03 start distance | <code>sensors.beginDistance(Distance1)</code> | HW_VERIFY |
| Sensors | G04 distance cm/G05 closer-than | <code>sensors.distanceCm(Distance1)</code>/<code>sensors.obstacleCloserThan(Distance1,20)</code> | Valid/fresh required |
| Sensors | G06 line/G07 physical button | <code>sensors.onLine(Line1)</code>/<code>sensors.buttonPressed(Button1)</code> | HW_VERIFY |
| Sensors | G08 color/G09 channel | <code>sensors.isColor(Color1,Red)</code>/<code>sensors.colorChannel(Color1,Red)</code> | HW_VERIFY |
| Sensors | G10 IMU, G11 yaw, G12 pitch | <code>sensors.beginImu(IMU1)</code>, <code>sensors.headingCwDeg(IMU1)</code>, <code>sensors.pitchDeg(IMU1)</code> | HW_VERIFY |
| Sensors | G13/G14 encoder | <code>sensors.encoderTicks(E1)</code>/<code>sensors.resetEncoder(E1)</code> | HW_VERIFY |
| Sensors | G15 sensor valid | <code>sensors.valid(Sensor_A)</code>; must check age/sequence | S3 |
| Logic/math | H07 modulo, H08 random, H09 abs | <code>codelabModulo(10,3)</code>, <code>codelabRandom(1,10)</code>, <code>fabs(-5)</code> | S0 |
| Logic/math | H10 round, H11 clamp | <code>round(3.5)</code>, <code>codelabClamp(50,0,100)</code> | S1 |
| Logic/math | H12 map range, H13 min/max, H14 trig | <code>robot.mapRange(...)</code>, <code>fmin(a,b)</code>, <code>sin(degToRad(0))</code> | S2 |
| Variables | I01 create variable | UI name "điểm", stable ID generated C++ name; initialize/reset at RUN | S0 |
| Text | I05/I06 literal/join | <code>String("Xin chào!")</code>/<code>concat(a,b)</code>; bounded memory/no heap growth across endless loop | S1 |
| Text | I07 length | <code>stringLength("abc")</code> | S2 |
| Lists | I08/I09/I10 create/append/get | Bounded list, max-length defined; do not use unbounded growth | S3 |
| My Blocks | J01/J02 define/call | <code>void chayRobot(){...}</code>/<code>chayRobot();</code> ; no yield | S1 |
| My Blocks | J03/J04 param define/call | <code>void quay(double speed)</code>/<code>quay(30);</code>; no yield, typed | S2 |
| Advanced | K01/K02 GPIO read/write | Raw GPIO only when profile permits and no conflict | S1 |
| Advanced | K03/K04 ADC/PWM | Respect reserved pin map; V2 GPIO47=M6, reject PWM there | S1 |
| Advanced | K05/K06/K07 Serial | <code>Serial.available()</code>/<code>Serial.read()</code>/<code>Serial.println()</code> | S1 |
| Advanced | K08 UART legacy | Preserve adapter; not PS4 I2C path | compatibility |
| Advanced | K09/K10/K11 raw I2C | Prevent conflict with PS4 0x30, IMU 0x6A, shared bus | S3 |
| Advanced | K12 pull input | <code>pinMode(1, INPUT_PULLUP)</code> | S1 |

**Lưu ý hồ sơ:** Một số nhóm V0.1 hiện ở P0 nhưng V0.2 chuyển thành Stage S2/S3/HW_VERIFY; đây là **chủ đích giảm phạm vi sản phẩm cơ bản**, không xóa nhu cầu dài hạn. Những ID không đổi ngữ nghĩa cần giữ đúng v0.1 để hỗ trợ mở project cũ.

## 7. Migration, validation và mã C++

### 7.1. Migration v1 → v2 không âm thầm thay ý nghĩa

- Project hiện có: <code>format=codelab-project</code>, <code>version=1</code>, Blockly block IDs như <code>beginner_start</code>, <code>beginner_forever</code>, <code>beginner_wait</code>, <code>beginner_motor</code>, PS4 simulation/UART.
- **V2 không tự dịch** <code>beginner_start</code> thành <code>codelab_when_run</code>, vì trước đó nó phát code trong <code>setup()</code> của Arduino và không cùng ngữ nghĩa READY→RUN. V1 tiếp tục mở ở <code>Legacy</code> hoặc được người dùng chọn **Tạo bản chuyển đổi**.
- Chuyển đổi tạo **project copy** version2, giữ file gốc; mở preview diff, yêu cầu chọn runMode, Devices, xử lý orphan stack, xác nhận không có unsupported actuator; không tự ghi đè v1.
- Rename alias Device không đổi <code>MOTOR_ID</code>. Xóa motor/sensor giữ block và báo <code>V2_DEVICE_MISSING</code>; đổi board giữ block và báo invalid channel, không remap.
- Generator Basic V2 không dùng mã <code>delay()</code> của V1 cho script wait. V1 codegen vẫn ở adapter legacy đến khi có migration reviewed.
- Thay màu/theme và ngôn ngữ không đổi type/schema của project; đơn vị số và dấu được quy định bởi schema version.

### 7.2. Diagnostics catalog (hiển thị ngay trên block và ngăn compile tùy mức)

| Code | Trigger | Mức | Hành động |
|---|---|---|---|
| <code>V2_ORPHAN_STACK</code> | Block lệnh không thuộc hat | WARN | Giữ project; không chạy stack |
| <code>V2_DEVICE_MISSING</code> | ID đã bị xóa khỏi Devices | BLOCK | Không remap/không compile |
| <code>V2_DRIVER_GATED</code> | Motor/servo chưa được nghiệm thu cho board | BLOCK | Không sinh lệnh tải |
| <code>V2_PIN_RESERVED</code> | Raw pin xung đột USB/motor/boot/PSRAM | BLOCK | Không compile |
| <code>V2_PS4_UNAVAILABLE</code> | Dùng PS4 mà chưa có bridge/profile phù hợp | BLOCK | Không kết nối giả |
| <code>V2_RESERVED_BUTTON</code> | Hat chọn Options/Share/PS | BLOCK | Chọn nút khác |
| <code>V2_MOTOR_MULTI_WRITER</code> | Hai script write cùng motor | WARN | Last accepted write wins, giải thích conflict |
| <code>V2_DRIVE_OWNERSHIP</code> | Drive và motor riêng ghi cùng kênh | WARN | Arbitration token, deterministic |
| <code>V2_SENSOR_NOT_READY</code> | Motion degree/cm khi sensor chưa validated | BLOCK | Không có time fallback |
| <code>V2_SENSOR_STALE</code> | Sensor invalid/stale lúc chạy | RUNTIME | Stop motion / FAULT theo policy |
| <code>V2_WAIT_TIMEOUT</code> | Wait until hoặc motion until quá deadline | RUNTIME | Cancel action, stop owned channel, notify |
| <code>V2_PROC_YIELD_UNSUPPORTED</code> | Hàm tự tạo chứa suspend trực tiếp/gián tiếp | BLOCK | Viết lại logic hoặc chờ P2 |
| <code>V2_SCRIPT_LIMIT</code> | >16 scripts hoặc vượt quota memory | BLOCK | Không tạo scheduler quá giới hạn |
| <code>V2_PROFILE_MISMATCH</code> | Board selected khác board/firmware validated | BLOCK | Không flash bằng profile sai |
| <code>V2_SAFETY_START_UNAVAILABLE</code> | Autonomous muốn RUN nhưng không có START device verified | BLOCK HARDWARE RUN | Cho phép chỉnh block/host sim, không cho phép chạy motor vật lý |
| <code>V2_TYPE_MISMATCH</code> | BOOL/NUMBER/TEXT sai kiểu | BLOCK | Không emit placeholder lệnh tải |

### 7.3. API C++ facade mục tiêu (pseudocode, KHÔNG phải code hiện có)

~~~cpp
// Proposal, NOT compilable with current main as-is:
struct StudentDrive { float forward, right, clockwise; };
void RobotFacade::drive(float forward, float right, float clockwise) {
    // Only point of conversion into the existing internal mixer convention:
    mixerInput = { .vx = forward / 100.0f,
                   .vy = -right / 100.0f,
                   .omega = -clockwise / 100.0f };
    // normalize + bound by min(DeviceLimit,MotorLimit,DriveLimit)
    applyMecanum(mixerInput);
}

void Ps4Adapter::updateStudentSnapshot(const RawFrame& f) {
    // Here, and ONLY here, convert raw PS4 axis to student-friendly directions:
    student.forward = normalizePercent(-f.ly); // up is positive
    student.turnClockwise = normalizePercent(f.lx);
    student.strafeRight = normalizePercent(f.rx);
}
// Runtime owns motor/safety I/O. Generated Blockly scripts call facade,
// NOT raw MCPWM GPIO, and must not bypass READY/RUN/FAULT gate.
~~~

**Code preview** hiển thị các lệnh facade theo đơn vị học sinh, thuyết minh +FWD/+RIGHT/+CW; tùy chọn Advanced có link sang mapping mixer +vx/-vy/-omega. Không tự đổi dấu ở mỗi block.

### 7.4. Ví dụ generated scheduler (pseudocode đơn giản)

~~~cpp
// Chi minh hoa continuation; implementation C++ se can scheduler API thật:
struct XScript {
  uint16_t pc = 0;
  uint32_t deadline = 0;
  bool active = false, pending = false;
};
void tickX(uint32_t now) {
  if (!runtime.isRunning()) return; // STOP/FAULT cancel script elsewhere
  switch (x.pc) {
    case 0:
      robot.motorRun(M1, Forward, 50); // once only
      x.deadline = now + 2000;
      x.pc = 1;
      return;  // yield, O handler may run
    case 1:
      if ((int32_t)(now - x.deadline) < 0) return;
      robot.motorStop(M1);
      x.active = false;
      x.pc = 0;
      // pending rerun (max 1) is dispatched by scheduler
      return;
  }
}
~~~

Đối với timed motor/drive, dùng motion owner token; **không dùng callback timer cũ để stop lệnh mới**. Ví dụ trên không bao gồm code driver thật hoặc reset safety và **không được flash**.

## 8. Bài mẫu (Blockly nguyên khối có thể sửa từng phần)

### L0 — Scheduler-only (không motor thật)

~~~text
Khi nút X được nhấn
  Hiện "X bắt đầu"
  Đợi 2 giây
  Hiện "X kết thúc"

Khi nút O được nhấn
  Hiện "O"
~~~

PASS khi nhấn X tại 0ms, O tại 500ms: O hiển thị trước X kết thúc; STOP 750ms hủy X. Test dùng virtual clock, PS4 event mock. Nếu không có adapter PS4 thật, test giao diện thông qua nguồn sự kiện giả **được đánh dấu rõ simulator**, không coi như hoạt động hardware.

### L1 — Một motor X nhấn chạy, X thả dừng (latching)

~~~text
Devices: M1; PS4 controller via I2C 0x30 (board verified)
System READY: Options giữ đủ 1 giây -> RUN; Share -> STOP

Khi nút X được nhấn
  Motor [M1] quay [tiến] [50]%

Khi nút X được thả
  Dừng motor [M1]
~~~

Không có block ARM trong chuỗi của học sinh. X handler kết thúc nhưng M1 giữ 50% đến X release; mất PS4/Share/heartbeat fault thì dừng output lập tức theo safety contract.

### L2 — Hai motor, điều kiện joystick (không auto điều khiển đóng kín)

~~~text
Khi chương trình bắt đầu
  Lặp lại mãi mãi
    Nếu [giá trị cần trái ngang > 20]
      Motor M1 tiến 40%
      Motor M2 lùi 40%
    Nếu không nếu [giá trị cần trái ngang < -20]
      Motor M1 lùi 40%
      Motor M2 tiến 40%
    Nếu không
      Dừng motor M1
      Dừng motor M2
~~~

Phải chọn/mapping Devices để "quay" có nghĩa cơ khí; không tự suy 2 motor bất kỳ là robot hai bánh.

### L3 — Mecanum4 PS4: học sinh tự ghép

~~~text
Devices: M1..M4 roles FL/FR/RL/RR + đảo chiều; PS4 via I2C.
System READY -> Options chủ đích -> RUN; Share -> READY.

Khi chương trình bắt đầu
  Lặp lại mãi mãi
    Nếu [PS4 đã kết nối]
      Robot di chuyển:
        tiến = Cần trái dọc (%)
        ngang-phải = Cần phải ngang (%)
        xoay-phải = Cần trái ngang (%)
    Nếu không
      Dừng robot
~~~

Motor commands chỉ được nhận khi runtime RUN, independent link watchdog, fault prevents auto resume.

### L4 — Autonomous (CHỈ sau khi xác minh trigger phần cứng)

~~~text
Devices: Drivetrain4, runMode=AUTONOMOUS, physical START validated
Khi chương trình bắt đầu
  Robot [tiến] [50]% trong [1] giây [và đợi]
  Robot dừng
~~~

Tại nguồn lên READY và motor=0; khi bấm START vật lý đã được xác minh → RUN. Không có START hardware → **BLOCK HARDWARE RUN**, vẫn test mock trên PC.

### L5 — Sensor future (not enabled until supported)

~~~text
Khi chương trình bắt đầu
  Robot đi tiến tốc độ 50% cho tới khi khoảng cách < 20cm; timeout 10s
  Robot quay phải 90 độ
  Robot tiến 30 cm
~~~

Không bật nếu chưa có distance + IMU + encoder (hoặc thuật toán tương đương đã nghiệm thu). Sensor invalid/stale khiến chuyển động stop; không tự thay bằng lệnh thời gian.

## 9. Kế hoạch triển khai sau khi duyệt, tests & acceptance

| Gate | Công việc | Chứng cứ bắt buộc | Không làm |
|---|---|---|---|
| G0: Spec Review | Duyệt lifecycle, schema, 30 block, Device IDs, PS4 system buttons, backward compatibility | Biên bản chỉnh/duyệt V0.2 | Không sửa motor/flash |
| G1: Scheduler Spike | Hai handler X/O + nested wait + STOP + retrigger + empty loops; compare two implementations | Unit tests virtual clock deterministic, codegen generated C++ compile host, RAM/time budget | Không dùng board/motor thật |
| G2: Devices & Generator | Parser project v2, schema and errors; latching + ownership; bộ dựng C++ | Tests serialization, device delete/rename, i18n/locale, conflict, latest-write token, backward import | Không tích hợp WASM |
| G3: One Motor | Tích hợp lớp facade với driver 4WD thực đã kiểm chứng; PS4 I2C sequence/freshness; bench trên 1 motor | Build đúng target, Bench log M1, STOP/FAULT, Options hold, Shared links, mất controller, timed stop/overwriting | Không mở M5/M6, servo |
| G4: Drivetrain4 | FL/FR/RL/RR, mixer sign adapter, robot.drive, battery/driver guard | Test 6 hướng, diagonal, inversion, limit min, stop, reboot; golden L1–L3 | Không coi compile PASS là movement PASS |
| G5: Advanced & Sensors | Gated/available theo Devices/feature flags; my blocks and sensor contracts | Per-driver hardware tests + simulated invalid/stale + timeout | Không hứa quay 90°/30cm khi thiếu sensor |
| G6: Browser WASM | Sau khi Blockly ổn định mới thử esp-wasm PoC từ Issue #27 | Biên dịch/nạp offline-browser, tests no CLI/cloud compiler | Không xóa local bridge trước khi PASS |

### 9.1. Test matrix — phải có ít nhất

1. **Tương thích:** import/export v1 byte-preservation; opt-in v2 migration; rename/xóa Devices giữ block/ID; board switch không remap; script order không đổi khi kéo block sang vị trí khác.
2. **Scheduler:** t=0 X/t=500 O/t=2000 stop; STOP 750; X nhấn lại khi busy pending max1; 100 sự kiện spam không vượt bound; "forever{}" và nested loops empty không starvation; timeout error; timer wrap.
3. **Motion latch:** X run→handler return→motor still running→X released→stop; timed motion overwritten by new command timer không dừng lệnh mới; stopAll, disarm, fault đều hủy lệnh/timer. Basic multi writer warn nhưng runtime deterministic.
4. **Safety lifecycle:** boot stays READY/0 PWM; controller required fails on timeout; auto-only no PS4 link-fault; Options start with neutral + hold, Share stop; STOP→READY→START resets vars, no resume; fault clear separate; reboot never auto-run.
5. **Block schema:** type/field shadow/Boolean+Number checks/i18n; unavailable sensor hidden; deleted device icon warning; raw pin conflict; unsupported motor compile gated.
6. **Coordinates:** raw LY up→student forward+; raw LX right→student turn CW+; student drive right+→mixer vy negative; CW+→omega negative. Validate six directions and mixed axes.
7. **Resource budgets:** 16 scripts/handlers, operation cap & time budget, PS4 polling timeout, memory, CPU; defaults are preliminary and may change after profiling. Hardware watchdog behavior must be measured, not inferred from host.
8. **Real build:** npm test/npm run build; Arduino CLI compile correct FQBN for local baseline (no upload automatic); motor 4WD only after exact board mapping; wasm integration deferred.

## 10. Những quyết định cần chủ dự án duyệt

- [ ] V0.2 dùng **2 chế độ RUN**: PS4 và Autonomous; power-on chỉ READY/PWM0; autonomous chưa có START hardware confirmed thì chặn motor.
- [ ] Basic ẩn ARM/DISARM, Options+Share là hệ thống; Options hold 1s **mới là đề xuất**, có cần giữ rising-edge fast100 để backward compatibility không?
- [ ] Chọn **resumable state-machine** làm spike đầu; fallback bounded cooperative contexts nếu không qua test; My Blocks có wait chỉ ở stage sau.
- [ ] Latch motor sau handler return, STOP/FAULT xóa, lifetime program=RUN, owner token ngăn timer cũ stop lệnh mới.
- [ ] 16 scripts và 2ms/tick/250ms heartbeat là mục tiêu thử nghiệm, không phải con số phần cứng được bảo chứng.
- [ ] Schema Basic 30 block + Devices auto init; sensor only when hardware capable, giữ inventory V0.1 ở Advanced/Backlog.
- [ ] Quy ước +forward/+right/+clockwise ở facade, chuyển dấu duy nhất vào mixer; PS4 input normalization là tầng riêng.
- [ ] Không rewrite hoặc tự động di trú project v1 mà thiếu sự chấp thuận/tác động rõ với user.
- [ ] Bản spec được duyệt trước khi viết generator, không thực hiện flash/actuator hiện tại.

## 11. References

- [V0.1 — full original catalog](BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md), preserved for line-by-line comparison.
- [Issue #28 — Blockly-first](https://github.com/HiyoriVn/CodeLab/issues/28).
- [Issue #27 — browser-only WASM PoC](https://github.com/HiyoriVn/CodeLab/issues/27).
- [main Blockly source](https://github.com/HiyoriVn/CodeLab/tree/main/src/blocks), [Arduino generator](https://github.com/HiyoriVn/CodeLab/blob/main/src/generators/arduino.js), [board profiles](https://github.com/HiyoriVn/CodeLab/blob/main/src/boards/profiles.js).
- [Mecanum & safety test docs](https://github.com/HiyoriVn/CodeLab/blob/main/docs/robotics/PS4_MECANUM.md), [CodeLabRobot library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabRobot), [CodeLabPs4I2C library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabPs4I2C).

**Đây là tài liệu REVIEW — các tên API facade chỉ là đề xuất, không phải phần mềm đã tích hợp.**

## Phụ lục A. Traceability đầy đủ 126 block của Catalog V0.1

**Bảng dưới là đối chiếu ID/tên cũ với quyết định V0.2, không phải bảng schema mới cho từng block P2.** Cột "block V0.1" là nhãn lịch sử (để người duyệt dò), hợp đồng mới §§2–7 được ưu tiên khi có xung đột. Các chức năng HW_VERIFY không được mặc định enable trên main.

| ID V0.1 | Tên/mục cũ | Diễn giải V0.2 |
|---|---|---|
| A01 | Khi bắt đầu chương trình | Đổi type ở project V2; v1 vẫn là Arduino setup, v2 khi RUN |
| A02 | Lặp lại mãi mãi | Vòng lặp là block con của script; yield cuối mỗi lượt |
| A03 | Nếu ... thì | Giữ native controls_if, V2 dùng continuation-safe codegen |
| A04 | Nếu ... thì / Nếu không | Giữ controls_if với ELSE; không tạo id duplicate trong serialization |
| A05 | Nếu ... / nếu không nếu ... | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A06 | Lặp lại [5] lần | Loop frame per script, count eval một lần + yield |
| A07 | Lặp đến khi [đúng] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A08 | Đợi [1] giây | NEW type, đợi suspend script, không delay blocking |
| A09 | Đợi đến khi [đúng] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A10 | Lặp khi [đúng] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A11 | Thoát vòng lặp | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A12 | Dừng chương trình an toàn | explicit program STOP; không stop khi handler return |
| A13 | Thời gian từ khi bật mạch | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A14 | Khi nút PS4 [X] vừa nhấn | Hat PS4 P0 + per-button edge latch |
| A15 | Khi PS4 mất kết nối | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| A16 | Khi nhận thông điệp [start] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B01 | Khởi tạo động cơ [M1] | Basic auto Devices init, Advanced manual only |
| B02 | Động cơ [M1] quay [tiến] tốc độ [30]% | V2 latched run; nonblocking; mới facade |
| B03 | Đặt công suất động cơ [M1] bằng [0]% | Power signed; last accepted write wins |
| B04 | Dừng động cơ [M1] | Stop override latch/token |
| B05 | Dừng tất cả động cơ | Stop all active motors |
| B06 | Đặt tốc độ tối đa motor [M1] là [100]% | Bound is min(DeviceLimit, MotorLimit, DriveLimit) |
| B07 | Đổi chiều motor [M1] | Prefer Devices inversion only |
| B08 | Chạy motor [M1] trong [1] giây | Timed motor with WAIT/NO_WAIT + owner token, no delay |
| B09 | Động cơ [M1] đang được ra lệnh chạy? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B10 | Công suất đang đặt cho [M1] (%) | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B11 | Nhóm [G1] quay [tiến] tốc độ [30]% | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B12 | Dừng nhóm [G1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B13 | Đặt kiểu dừng [thả trôi] cho [M1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B14 | Motor [M1] quay [90] độ | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B15 | Vị trí motor [M1] (độ) | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| B16 | Motor [M1] tiêu thụ dòng [A] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| C01 | Khởi tạo robot [4 bánh mecanum] | Devices auto drivetrain init |
| C02 | Robot tiến tốc độ [30]% | Gộp vào codelab_drive_direction dropdown |
| C03 | Robot lùi tốc độ [30]% | Gộp vào codelab_drive_direction dropdown |
| C04 | Robot đi ngang [trái] tốc độ [30]% | Gộp vào codelab_drive_direction dropdown |
| C05 | Robot xoay tại chỗ [trái] tốc độ [30]% | Gộp vào codelab_drive_direction dropdown |
| C06 | Di chuyển theo trục: tiến [0] ngang [0] xoay [0] (%) | V2 new drive axes, facade sign normalization |
| C07 | Đặt tốc độ tối đa robot [100]% | Limit min model |
| C08 | Dừng robot | Drive group stop |
| C09 | Robot đã cấu hình đủ bánh? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| C10 | Robot chạy [tiến] trong [1] giây | Motion handle and WAIT/NO_WAIT |
| D-P01 | Kết nối tay cầm PS4 | Basic Devices auto I2C setup; no legacy adapter conflation |
| D-P02 | PS4 đã kết nối? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| D-P03 | Nút [X] đang được nhấn? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| D-P04 | Nút [Options] vừa nhấn? | Options SYSTEM ONLY; no student event for reserved key |
| D-P05 | Nút [X] vừa thả? | Edge event remains P1 reporter, latched |
| D-P06 | Cần [trái] trục [dọc] (%) | V2 -100..100 student-axis normalization |
| D-P07 | Cần trái: tiến/lùi (%) | PS4 adapter forwards LY up positive |
| D-P08 | Cần trái: xoay (%) | PS4 adapter LX right to clockwise positive |
| D-P09 | Cần phải: đi ngang (%) | PS4 adapter RX right to strafe-right positive |
| D-P10 | Cho phép điều khiển robot (ARM) | ARM control plane only; remove from Basic |
| D-P11 | Ngắt điều khiển và dừng (DISARM) | DISARM control plane only; remove from Basic |
| D-P12 | Robot đang được ARM? | Expose runtime.isRunning() Basic optional |
| D-P13 | Robot gặp lỗi điều khiển? | Expose runtime.hasFault() Basic optional |
| D-P14 | Xóa lỗi sau khi đã an toàn | Fault clear separate from START, Advanced/control plane |
| D-P15 | Mã lỗi điều khiển | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| D-P16 | Tay cầm mất kết nối hơn [250] ms? | 250ms fixed runtime safety threshold (not Devices field) |
| E01 | Bật/tắt đèn trên mạch | LED ownership facade; no direct GPIO when system owns |
| E02 | Nhấp nháy đèn mỗi [0.5] giây | Nonblocking LED effect, avoid delay in handler |
| E03 | Bật đèn báo trạng thái PS4 | LED system owns when status enabled |
| E04 | Đặt độ sáng đèn [50]% | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| E05 | Hiện lời nhắn [Xin chào!] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| E06 | Hiện giá trị [0] không xuống dòng | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| E07 | Phát tiếng bíp trong [0.2] giây | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| E08 | Dừng còi | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| F01 | Khởi tạo servo [S1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| F02 | Đặt servo [S1] tới [90] độ | Hardware gated until servo power validated |
| F03 | Đặt tốc độ servo [45] độ/giây | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| F04 | Tắt tín hiệu servo [S1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| F05 | Góc đặt cho servo [S1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G01 | Chân [D1] đang ở mức cao? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G02 | Giá trị analog của [A1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G03 | Khởi tạo cảm biến khoảng cách [Khoảng cách 1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G04 | Khoảng cách đo được (cm) | Sensor {value, valid, sampledAt}, never stale success |
| G05 | Có vật cản gần hơn [20] cm? | Invalid sensor => false + active motion cancels |
| G06 | Cảm biến dò vạch [L1] thấy vạch? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G07 | Cảm biến [Button1] được nhấn? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G08 | Cảm biến màu phát hiện [đỏ]? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G09 | Cường độ màu [đỏ] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G10 | Khởi tạo IMU | IMU HW gated; +heading clockwise only in sensor layer |
| G11 | Góc quay robot (yaw, độ) | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G12 | Độ nghiêng [pitch] (độ) | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G13 | Số xung encoder [E1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G14 | Đặt bộ đếm encoder [E1] về 0 | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| G15 | Cảm biến [S1] có dữ liệu hợp lệ? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H01 | Đúng / Sai | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H02 | [1] [=] [1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H03 | [đúng] và [đúng] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H04 | Không [đúng] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H05 | Số [0] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H06 | [1] + [1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H07 | Số dư [10] chia [3] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H08 | Số ngẫu nhiên từ [1] đến [10] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H09 | Giá trị tuyệt đối của [-5] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H10 | Làm tròn [3.5] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H11 | Giới hạn [50] từ [0] đến [100] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H12 | Đổi thang [50] từ [-100..100] sang [-255..255] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H13 | Chọn giá trị nhỏ nhất/lớn nhất | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| H14 | Trị sin/cos của [0] độ | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I01 | Tạo biến [điểm] | Stable var ID to unique C++ symbol, Unicode collision proof |
| I02 | Đặt [điểm] thành [0] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I03 | Thay đổi [điểm] một lượng [1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I04 | Giá trị biến [điểm] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I05 | Chuỗi chữ [Xin chào!] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I06 | Ghép chữ [A] với [B] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I07 | Độ dài văn bản [abc] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I08 | Tạo danh sách [Giá trị] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I09 | Thêm [0] vào danh sách [Giá trị] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| I10 | Phần tử thứ [1] của danh sách | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| J01 | Định nghĩa [chạy robot] | P0/P1 procedure no wait or yield |
| J02 | Gọi [chạy robot] | P0/P1 procedure no wait or yield |
| J03 | Định nghĩa hàm [quay] nhận [tốc độ] | P0/P1 procedure no wait or yield |
| J04 | Gọi hàm [quay] với [30] | P0/P1 procedure no wait or yield |
| K01 | Đọc GPIO [1] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K02 | Ghi GPIO [1] [LOW] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K03 | Đọc Analog GPIO [2] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K04 | PWM GPIO [47] duty [0] | Respect GPIO47=M6 on V2, reserved GPIO |
| K05 | Đọc Serial có dữ liệu? | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K06 | Đọc ký tự Serial | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K07 | Ghi Serial [hello] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K08 | Cấu hình UART PS4 | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K09 | Cấu hình I²C nâng cao | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K10 | Đọc byte I²C từ [0x30] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K11 | Ghi byte I²C tới [0x30] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |
| K12 | Đặt chế độ GPIO [INPUT_PULLUP] | Giữ mục tiêu sản phẩm cuối; triển khai theo gate/capability thay vì hiện sẵn Basic |

### Phụ lục B. Trạng thái triển khai

- **Đã hoàn thành ở lượt này:** chỉ soạn bản đặc tả và mapping từ V0.1.
- **Chưa làm:** scheduler spike, facade runtime, Blockly generator mới, board bench, sửa flash/upload, WASM compiler.
- **Không thay đổi:** main, nhánh WASM thử nghiệm, firmware cũ và các project đã lưu.
