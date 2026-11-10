# CodeLab — Blockly Product Specification V0.2 (BẢN DUYỆT)

> **Status:** DESIGN REVIEW / CHƯA TRIỂN KHAI. 10/11/2026, chỉnh theo phản hồi trước G0.  
> **Baseline:** CodeLab <code>main</code> @ <code>2a0705d4</code>; V0.1 tại <code>docs/BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md</code>.  
> **Scope:** đặc tả trải nghiệm kéo thả + hợp đồng generator/runtime/thiết bị cho sản phẩm cuối. **Không phải** xác nhận các API đã được lập trình, biên dịch hay kiểm thử phần cứng.
>
> **Chủ đích:** học sinh có thể tạo bài đơn motor, PS4, 4WD và sau này thêm cảm biến mà không phải biết GPIO/FreeRTOS. Không cài runtime trung gian; kế hoạch WebAssembly nạp qua web được tách ở Issue #27, chưa triển khai.

**Ưu tiên đọc để duyệt:** §1 (các quyết định), §2 (RUN/FAULT), §3 (scheduler), §5 (Basic 30 block), §6 (schema C++), §8 (bài mẫu), §9 (test và ngưỡng G1). Sau khi duyệt mới triển khai theo Issue #28.

## 1. Quyết định nền tảng và những thay đổi so với V0.1

| Vấn đề | Quyết định V0.2 | Ý nghĩa / giới hạn |
|---|---|---|
| Bắt đầu sau cấp nguồn | <code>INIT → READY</code>, PWM=0, cần START có chủ đích | AUTO chấp nhận nút vật lý đã xác minh hoặc Options tạm thời nếu đạt điều kiện §2.3 |
| Phụ thuộc PS4 | Generator suy ra <code>requiresController</code> từ mã có thể thực thi. <code>runMode=CONTROLLER</code> luôn cần link; <code>AUTONOMOUS</code> từ chối block phụ thuộc PS4 | Dùng PS4 làm START không tạo dependency sau khi vào RUN |
| Khởi tạo thiết bị | Devices khai báo và runtime khởi tạo ở trạng thái an toàn | Block khởi tạo thủ công chỉ Advanced |
| ARM/DISARM | Options/Share là lệnh hệ thống. START lại chạy từ đầu; CLEAR riêng | STOP web là lệnh phần mềm; ngắt nguồn động lực xử lý tình huống CPU treo |
| Vòng đời chuyển động | Lệnh liên tục giữ sau khi handler kết thúc. AUTO có kết thúc tự nhiên và giới hạn cứng; timed motion sống theo handle riêng | CONTROLLER chờ sự kiện cho đến STOP/FAULT; xem §3.4 |
| Sự kiện PS4 | Một pending mới nhất cho mỗi hat; dispatch cần cạnh còn hiệu lực | Thả X hủy pending PRESS cũ, kể cả nhấn–thả nhanh trong khi handler đang đợi |
| Scheduler | Một scheduler cooperative. Mỗi hat có một script; wait và cuối vòng lặp nhường quyền | G1 thử state-machine, bao gồm inline My Blocks có wait |
| Nhiều script ghi motor | Lệnh hợp lệ sau cùng chiếm quyền. Chỉ cảnh báo xung đột lệnh có thể làm motor chạy | Lệnh dừng vẫn lấy quyền và hủy timer cũ |
| Dấu và đơn vị | +tiến, +phải, +xoay-phải; facade chuyển một lần sang mixer | PS4 chuẩn hóa đầu vào riêng; giữ mixer hiện có |
| Cảm biến | Devices chỉ hiện block khi có thiết bị và driver đã nghiệm thu | Chuyển động cm/độ tách riêng với chuyển động theo thời gian |
| Type và tương thích | Type riêng <code>codelab_v2_&lt;snake_case&gt;</code> cho mọi block CodeLab mới hoặc có đổi hành vi/schema | Giữ type Blockly chuẩn khi hành vi và dữ liệu lưu giữ nguyên. Legacy và bản chuyển đổi opt-in theo §7.1 |

### 1.1. Enum và ký hiệu không trùng nhau

- <code>kind</code>: <code>HAT</code> (hat/sự kiện), <code>STMT</code> (lệnh), <code>CONTROL</code> (khối chứa lệnh), <code>BOOL</code>, <code>NUMBER</code>, <code>TEXT</code>, <code>CONFIG</code> (Devices, không phải block).
- <code>status</code>: <code>EXISTS</code> (main đã có một dạng block và generator, **chưa** đảm bảo ngữ nghĩa V0.2), <code>SIM_ONLY</code>, <code>GATED</code> (hiện chặn compile), <code>NEW</code>, <code>HW_VERIFY</code>.
- <code>stage</code>: <code>S0</code> = scheduler không tải; <code>S1</code> = 1 motor + PS4; <code>S2</code> = 4WD; <code>S3</code> = sensor/advanced; không đồng nhất với P0/P1/P2 của inventory V0.1.
- <code>blocking</code> = có đợi điều kiện/chuyển động không; <code>interruptible</code> = có hủy được khi STOP/FAULT không. Mọi block Basic **phải interruptible**; I/O đồng bộ phải nằm ngoài đường dispatch hoặc có cận đã kiểm chứng trong budget §9.2.
- <code>resources</code> = <code>MOTOR(M1)</code>, <code>DRIVE(M1..M4)</code>, <code>PS4(I2C)</code>, <code>ALL_MOTORS</code>, <code>LED(id)</code>, <code>BUZZER</code>, <code>SENSOR(id)</code>, <code>SERIAL</code>, <code>NONE</code>. Khóa tài nguyên được tổng hợp theo Devices; cần kiểm tra xung đột và reserved pins trước compile.
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
| Power-on/reset → INIT | Cấp nguồn hoặc reboot | Đầu ra safe sớm nhất có thể; chưa chạy Blockly |
| INIT → READY | Profile/Devices/driver đạt kiểm tra startup | Giữ PWM=0, chưa nhận START cũ |
| INIT hoặc READY → FAULT | Phát hiện lỗi cấu hình hoặc phần cứng | Giữ 0, chốt mã lỗi |
| READY → RUN (CONTROLLER) | PS4 fresh, trục neutral, Options giữ đủ 1 s rồi nhả hợp lệ theo §2.3; driver ready | Reset biến, script, motion và sự kiện; bắt đầu clock RUN, lập baseline PS4, lên lịch các hat bắt đầu. PWM giữ 0 trong transition |
| READY → RUN (AUTO) | Driver ready và đường START đủ điều kiện §2.3 | Reset như trên, đặt deadline AUTO ngay khi vào RUN. PWM giữ 0 trong transition |
| RUN → READY | STOP hợp lệ hoặc AUTO hoàn thành tự nhiên | Tắt đầu ra motor, hủy script, timer và pending; cần một START mới để chạy lại |
| RUN → FAULT | Hết deadline AUTO, mất freshness khi <code>requiresController</code>, quá hạn heartbeat, lỗi driver hoặc lỗi cảm biến bắt buộc khi chuyển động | Khóa đầu ra motor theo thời gian đã kiểm chứng, hủy công việc, chốt mã lỗi |
| FAULT → READY | Nguyên nhân đã hết, driver ready, CLEAR riêng; PS4 fresh/neutral nếu required | Giữ PWM=0. CLEAR chỉ đưa về READY, cần cử chỉ START mới |
| READY → READY | Chờ START, giữ chưa đủ, hủy xác nhận hoặc không đủ điều kiện | PWM=0 |

### 2.3. START, STOP và điều kiện chạy thật

- **CONTROLLER:** dùng PS4 Options. **AUTO:** ưu tiên nút START vật lý đã xác minh trên board. Có thể cấu hình **Options làm START tạm** trên đúng board/bridge đã bench, khi có phương tiện ngắt nguồn động lực cục bộ, dễ tiếp cận và đã thử, và quy trình bảo đảm vùng chạy trống. Cấu hình chọn nguồn START rõ ràng. Nút vật lý chỉ hợp lệ sau khi đã quan sát nhả ở READY và nhận một cử chỉ mới theo profile đã thử. Nếu không có đường START hợp lệ, giữ chặn chạy tải bằng <code>V2_SAFETY_START_UNAVAILABLE</code>; vẫn cho phép mock trên host. BOOT/GPIO0 chưa được chọn.
- **Cử chỉ Options:** trong READY, đợi một report fresh thấy nút đã nhả rồi mới nhận cạnh nhấn mới. Giữ liên tục tối thiểu **1 s đề xuất**, với link fresh, mọi trục neutral, driver ready và Share không nhấn suốt quá trình. Chỉ vào RUN khi nhận cạnh nhả fresh sau thời gian giữ. Nhả sớm, stale/mất link, lệch neutral, STOP hoặc lỗi hủy lần xác nhận; phải có cử chỉ mới. Sau STOP/CLEAR hoặc reconnect, bắt đầu lại từ baseline. Options và Share chỉ đi qua control plane; giữ từ lúc cấp nguồn/reconnect không tự START. Rising edge fast100 thuộc chế độ tương thích riêng.
- **Phụ thuộc tay cầm:** tính <code>requiresController</code> qua các hat/đoạn chương trình có thể chạy, kể cả lời gọi My Blocks. CONTROLLER luôn required. AUTO từ chối mã phụ thuộc PS4 với <code>V2_RUN_MODE_MISMATCH</code>. Sau khi AUTO vào RUN, rớt link START không FAULT và không kéo dài deadline. Share chỉ dừng được khi runtime nhận report fresh thấy Share đang nhấn; STOP cục bộ qua phần mềm chỉ dùng khi đầu vào đó đã xác minh. Công tắc ngắt nguồn động lực là đường dừng cục bộ dùng được khi mất link hoặc CPU không phản hồi.
- **Giám sát:** tác vụ safety ưu tiên cao quản lý motor-enable, heartbeat và freshness, ưu tiên trước công việc user. Khi chốt STOP/FAULT hoặc hết deadline AUTO, khóa cổng ghi output trước khi cleanup để lệnh user đang dispatch không thể tái bật motor. STOP/FAULT hủy cả lệnh đang chờ. STOP web cần kết nối và xác nhận, phụ thuộc phần mềm. Watchdog/reset, đầu ra khi CPU treo hay mất PWM và công tắc ngắt nguồn đều <code>HW_VERIFY</code>. Freshness và ngưỡng heartbeat 250 ms là mục tiêu đề xuất (§9.2); độ trễ dừng vật lý phải đo riêng.
- **Phản hồi trạng thái tùy capability:** có thể báo READY, đang giữ START, RUN và FAULT qua LED status riêng, hoặc lightbar/rung PS4 nếu D1 và bridge hỗ trợ đã kiểm chứng. Cập nhật best-effort, có giới hạn tần suất, không block và không tham gia quyết định START/STOP. Nếu không có kênh báo, vẫn phải đáp ứng điều kiện START và ngắt nguồn ở trên. GPIO47 trên V2 là M6; tài nguyên LED theo §4.1.

## 3. Execution Contract — scheduler cho Blockly

### 3.1. Mô hình script

Một script gồm **một hat** (<code>Khi bắt đầu</code>, PS4 press/release…) và stack dưới hat. <code>Lặp mãi mãi</code> nằm trong stack. Stack rời được lưu nhưng không thực thi (<code>V2_ORPHAN_STACK</code>). My Blocks chỉ chạy qua lời gọi.

G1 thử resumable C++ state-machine, mỗi script có PC, frame/counter, deadline và trạng thái pending hữu hạn. Một scheduler dispatch từng script; safety monitor chạy riêng. Mỗi lần RUN có một generation riêng để vô hiệu công việc sót từ lần RUN trước.

### 3.2. Điểm nhường và tính công bằng

- <code>Đợi(s)</code> suspend riêng script đến deadline monotonic; 0 giây vẫn yield ít nhất một lần. <code>Đợi đến khi</code> kiểm tra lại mỗi tick, timeout mặc định đề xuất 10 s và báo lỗi khi hết hạn.
- Tất cả các vòng lặp yield ở cuối mỗi lượt, kể cả thân rỗng. <code>Lặp N lần</code> tính N một lần, dùng counter trong frame script.
- Đếm công việc sau khi inline, kể cả chuỗi statement dài và biểu thức. Cắt slice trước khi vượt quota §9.2, tiếp tục round-robin từ script kế ở tick sau. I/O trong scheduler chỉ dùng snapshot, enqueue hoặc poll có chi phí hữu hạn trong budget.
- Deadline dùng elapsed/difference an toàn khi <code>millis()</code> wrap. STOP/FAULT được xử lý cả khi script suspended, trước các lệnh user.

### 3.3. Event edge và lịch điều phối

1. Adapter chỉ nhận report fresh, mới theo sequence và session. Lấy snapshot fresh ở START làm baseline, không phát lại cạnh READY. Khi khởi tạo lại adapter, mẫu đầu làm baseline, không tạo cạnh giả. Mỗi nút giữ <code>pressed</code> và <code>edgeGeneration</code> tăng trên **mỗi** đổi trạng thái đã quan sát. Cập nhật snapshot và pending cùng thứ tự nhận trước dispatch; Share/Options xử lý riêng.
2. Mỗi hat có tối đa **một** token pending gồm nút, loại cạnh, edge generation và thứ tự report. Khi bận, cạnh cùng loại mới hơn thay token cũ, tăng counter coalesce nếu có thay thế. Cạnh ngược loại vô hiệu token cũ. Kể cả handler rảnh, token chờ tick kế cũng chịu kiểm tra như pending.
3. Trước khi bắt đầu lượt mới, yêu cầu RUN, link fresh, generation còn là cạnh mới nhất của nút và trạng thái khớp (PRESS khi đang giữ, RELEASE khi đã nhả). Token cũ bị bỏ, không replay. Handler đang chạy có thể tiếp tục sau wait. Hat cạnh không mang nghĩa giữ-để-chạy; dùng reporter trạng thái ngay trước lệnh chạy nếu hành động sau wait còn cần điều kiện đang giữ nút.
4. Các token hợp lệ được nhận theo thứ tự report, sau đó loại cạnh, enum nút và <code>scriptUid</code> ổn định. Trong cùng snapshot một nút chỉ có một trạng thái cuối. Tọa độ workspace không ảnh hưởng. STOP/FAULT có ưu tiên cao và xóa pending.
5. **Giới hạn bridge:** bảo đảm trên các cạnh adapter thực sự quan sát được. Xung ngắn giữa hai report PS4/D1 hoặc hai poll ESP32 có thể mất. Sequence/freshness không phục hồi cạnh chưa nhận. Trước G3, đo chu kỳ report/poll và quét độ rộng/pha xung trên đúng D1/bridge. Nếu cần giữ cạnh nhanh, đánh giá counter theo nút kèm trạng thái cuối, sequence, reset/wrap. Counter đơn lẻ không đủ tái dựng thứ tự giữa nút; nếu cần thứ tự đầy đủ phải có thứ tự cạnh từ nguồn. Mọi pending vẫn qua guard trên.

### 3.4. Latch, motion handle và kết thúc AUTO

- Lệnh motor/drive liên tục giữ sau khi handler return cho tới khi bị ghi đè, dừng rõ ràng hoặc rời RUN. <code>Đợi</code> không tự dừng motor. CONTROLLER giữ RUN cả lúc không có script active để tiếp tục nhận sự kiện.
- Mỗi timed motion dùng handle runtime gắn RUN generation, owner generation, channel hoặc group và deadline. <code>WAIT</code> suspend script, resume một lần khi handle hoàn tất hoặc bị lệnh khác hủy trong cùng RUN. <code>NO_WAIT</code> tiếp tục ngay, handle vẫn active và runtime vẫn xử lý deadline sau khi script return. Hết hạn bình thường chỉ tắt đầu ra còn thuộc handle. Hủy/hoàn tất loại handle khỏi tập active ngay; kết quả của waiter lưu trong frame tới khi resume. Handle pool hữu hạn theo nhóm/kênh đang sở hữu, không cấp phát động khi RUN; lỗi cạn slot dẫn tới FAULT an toàn.
- Lệnh mới hợp lệ lên kênh trùng hủy owner cũ trước khi nhận owner mới. DRIVE là một nhóm nguyên tử. Khi một lệnh đụng nhóm cũ, hủy cả nhóm và đưa các kênh còn thuộc nhóm về 0 trước khi áp dụng lệnh mới. Timer cũ không có quyền dừng lệnh mới; STOP/FAULT vô hiệu mọi handle và không resume waiter.
- **AUTO hoàn thành tự nhiên** ở cuối tick sau khi đã xử lý deadline: không còn script runnable/suspended (kể cả chờ handle hay vòng lặp vô hạn đang chạy), không còn pending hợp lệ hay hat sự kiện còn có thể kích hoạt, và không còn motion handle active. Latch liên tục không giữ chương trình sống. Runtime tắt motor, hủy công việc còn lại và chuyển RUN → READY; START lần kế reset từ đầu. Nếu đăng ký hat sự kiện còn sống hoặc chương trình không thoát, deadline AUTO vẫn áp dụng.
- **Giới hạn cứng AUTO:** lưu <code>autoMaxRunSeconds</code> trong project, mặc định đề xuất **15 s** khi thiếu trường (hạ xuống trần profile nếu trần thấp hơn). Học sinh chọn số nguyên **1–60 s**, trong trần thấp hơn nếu profile đã duyệt yêu cầu. Giá trị ngoài khoảng chặn bằng <code>V2_AUTO_RUN_LIMIT_INVALID</code>; không có chế độ vô hạn. Đồng hồ bắt đầu khi vào RUN, không tính thời gian giữ Options và không reset theo script, handle hay link. Safety monitor kiểm deadline trước công việc user: khi đến hạn, tắt output, hủy cả WAIT/NO_WAIT và chuyển RUN → FAULT (<code>V2_AUTO_MAX_RUNTIME</code>). Deadline thắng natural completion nếu đồng thời. Trần profile và độ trễ tắt thực tế cần bench.
- **Ghi nhiều nguồn:** last accepted write wins. Cảnh báo <code>V2_MOTOR_MULTI_WRITER</code> khi hai script đều có lệnh có thể phát công suất khác 0 lên kênh trùng, kể cả DRIVE mở rộng theo Devices. Lệnh stop hoặc hằng 0 không tạo cảnh báo này. Tách cảnh báo <code>V2_DRIVE_OWNERSHIP</code> khi có xung đột giữa các lệnh chạy nhóm và chạy kênh riêng; cùng quy tắc bỏ qua stop-only. Nếu cả hai cảnh báo trùng cặp/kênh, chỉ hiện cảnh báo DRIVE.

### 3.5. My Blocks và lỗi runtime

- G1 thử **inline tại từng chỗ gọi** trên call graph không chu trình, bao gồm <code>Đợi</code>, wait lồng, timed WAIT và lời gọi bắc cầu. Mỗi đối số được tính một lần khi vào đoạn inline; frame của script giữ tham số, PC và counter qua yield. Mỗi chỗ gọi có slot riêng khi giá trị còn sống; resume đi tiếp sau wait, không tính lại đối số hay phát lại side effect. Không cần resumable call stack.
- Chặn đệ quy trực tiếp/gián tiếp (<code>V2_PROC_RECURSION</code>). Tính quota code/frame sau mở rộng, báo <code>V2_PROC_INLINE_LIMIT</code> kèm chỗ gọi vượt giới hạn, chặn compile. Chỉ mở tính năng cho học sinh khi đạt G1 và stage tương ứng; mục tiêu stage ở §6, không tính thêm vào Basic 30.
- Lỗi scheduler/runtime không được để motor tiếp tục giữ lệnh nếu không còn khả năng kiểm soát. Chặn compile nếu phát hiện trước RUN; nếu xảy ra trong RUN, tắt đầu ra và FAULT.

### 3.6. Kịch bản đồng hồ ảo

~~~text
Khi nút X nhấn:
  Motor M1 quay 50%
  Đợi 2 giây
  Dừng M1

Khi nút O nhấn:
  Hiện "Xin chào!"
~~~

- **X/O độc lập:** X tại 0 ms → M1=50%, X chờ; O tại 500 ms → enqueue lời nhắn ở lượt scheduler kế tiếp khi sink mock còn chỗ; X tại deadline 2000 ms resume và M1=0. Biến thể STOP ở 750 ms → M1=0 ngay tại lượt safety, không còn callback/script khi đồng hồ qua 2000 ms.
- **Regression pending press/release:** thêm `Khi X thả → Dừng M1`. Báo X nhấn/thả/nhấn/thả ở 0/100/200/300 ms. Lần nhấn ở 200 ms chờ vì handler X còn active; cạnh ở 300 ms vô hiệu token và motor=0. Sau deadline 2000 ms M1 vẫn 0, tổng cộng chỉ một lệnh chạy 50%. Đối chứng: bỏ cạnh thả ở 300 ms, giữ X qua deadline thì lượt pending hợp lệ chạy đúng một lần; có thêm cạnh trùng khi đang bận cũng chỉ giữ token mới nhất.
- **Latch đúng:** với handler X chỉ có lệnh chạy, M1 vẫn 50% sau khi handler return và dừng khi handler RELEASE chạy. Nút được giữ từ lúc vào RUN không tạo cạnh giả.
- **AUTO và NO_WAIT:** cùng script một lệnh chạy 1 s, WAIT hay NO_WAIT đều giữ chuyển động tới 1000 ms rồi về READY/0 khi hết việc. Với NO_WAIT, script đã return trước 1000 ms. Latch không có handle và không còn việc → READY/0 ở cuối tick. Nếu dừng handle bằng lệnh thay thế trong khi có waiter, waiter resume một lần; nếu STOP hoặc FAULT thì không resume. Khi deadline AUTO trùng deadline handle, FAULT thắng. Vòng lặp vô hạn hoặc hat còn mở phải dừng ở deadline AUTO.
- **My Blocks:** hai chỗ gọi cùng một thủ tục có tham số và wait bên trong repeat → if → My Block con. Thay biến nguồn của tham số trong handler O lúc đang chờ; lần gọi đã bắt đầu giữ giá trị cũ, lần gọi sau đọc giá trị mới. Counter vòng lặp giữ đúng, không lặp lại side effect, STOP giữa wait hủy mọi continuation. Vòng lặp rỗng vẫn nhường cho O.

### 3.7. Lựa chọn scheduler ở G1

| | Resumable state-machine C++ | Bounded cooperative coroutines/contexts |
|---|---|---|
| Tài nguyên | PC và frame tĩnh theo script; inline có thể tăng code size | Stack/context có quota, cần đo thêm RAM và chi phí chuyển context |
| Wait, My Blocks | Tách continuation tại điểm yield, kể cả thủ tục inline | Có thể giữ luồng C++ gần cấu trúc block, vẫn cần giới hạn và hủy được |
| Trạng thái dùng chung | Một script dispatch tại một lúc | Cùng hợp đồng dispatch |
| Quyết định | Thử trước, bao gồm My Blocks có wait | Thử đối chứng nếu state-machine trượt ngưỡng §9.2 |

G1 dùng mock motor, PS4 và virtual clock trên host. Quyết định triển khai dựa trên toàn bộ test bắt buộc và ngưỡng định lượng §9.2.

## 4. Devices, cảm biến và tọa độ

### 4.1. Devices metadata và tên/ID

- Mỗi project lưu <code>boardId</code>, <code>runMode</code>, nguồn START theo profile, <code>autoMaxRunSeconds</code> (AUTO), <code>devices[]</code>, <code>motorRoles</code>, <code>invert</code>, <code>limits</code>, <code>sensorMap</code> (schema mới, có version). Cấu hình Devices được generator/firmware áp dụng **trước khi RUN**.
- Block lưu ID ổn định như <code>M1</code>, <code>M2</code> (physical channels), <code>Group_1</code> hoặc <code>Sensor_A</code>. UI hiển thị alias như "Bánh trước trái". Đổi tên không đổi ID; xóa Device → block còn nguyên, gắn warning <code>V2_DEVICE_MISSING</code>; **không tự map sang kênh khác**.
- Mỗi kênh thiết bị chỉ gán một chân/driver profile được kiểm chứng; raw GPIO/I²C trong Advanced bị chặn nếu trùng motor, USB, PS4, boot/strapping, bộ nhớ flash/PSRAM.
- <code>Devices</code> tự setup; block khởi tạo chỉ Advanced hoặc template dạy kỹ thuật, không hiển thị Basic.
- <code>cfg.maxDutyPercent</code> (safety, không học sinh tự nâng), <code>motorLimit(M1)</code> và <code>driveLimit</code> được kết hợp theo **minimum applicable bound**. Giá trị 100% là *duty command*, không tự suy thành RPM thực.
- D06 Drivetrain phải lưu geometry cho tương lai: <code>wheelDiameterMm</code> (chưa biết → null), <code>trackWidthMm</code> (null), <code>wheelBaseMm</code> (null), <code>gearRatio</code> (nếu biết). Không tự điền kích thước giả cho block cm/degree.
- LED status phần cứng và LED học sinh là tài nguyên theo ID. System sở hữu LED dành cho status; chỉ hiện E01v2 nếu Devices có LED hợp lệ riêng hoặc đã tắt status trên LED được chia sẻ. GPIO47 trên V2 dành cho M6. Lightbar/rung PS4 nếu hỗ trợ là kênh system riêng (§2.3).
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
| A01v2 | <code>codelab_v2_when_run</code> HAT / control / <code>block.when_run</code> | "Khi chương trình bắt đầu"; <code>BODY: Statement</code> | Script entry khi READY→RUN; **không** phải Arduino setup() | NONE · N · ORPHAN | NEW/S0 |
| A02v2 | <code>codelab_v2_forever</code> CONTROL / control / <code>block.forever</code> | "Lặp lại mãi mãi"; <code>DO: Statement</code> | Scheduler back-edge + yield mỗi lượt | NONE · Y · SCRIPT_BUDGET | NEW/S0 |
| A03 | <code>controls_if</code> CONTROL / logic / <code>block.if</code> | <code>IF0: Boolean=false</code>, <code>DO0: Statement</code> | <code>if(cond) {...}</code> continuation-safe | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| A04 | <code>controls_if</code> CONTROL / logic / <code>block.if_else</code> | Như A03 + <code>ELSE: Statement</code>; mutator hasElse=true | <code>if(cond) {...} else {...}</code> | NONE · N · TYPE_MISMATCH | EXISTS/S0 |
| A06v2 | <code>codelab_v2_repeat_n</code> CONTROL / control / <code>block.repeat_n</code> | <code>TIMES: Number=5</code>, <code>DO: Statement</code> | Count eval **một lần**, per-script loop frame; yield mỗi iteration | NONE · Y · REPEAT_LIMIT | NEW/S0 |
| A08v2 | <code>codelab_v2_wait_seconds</code> STMT / control / <code>block.wait_seconds</code> | <code>SECONDS: Number=1</code> (0..60) | <code>scheduler.sleep(scriptId,1000)</code> + resume, **không delay()** | NONE · Y · INVALID_DURATION | NEW/S0 |

### 5.2. Chuyển động (8)

| ID | type / kind / category / i18n | Label; fields/inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| B02v2 | <code>codelab_v2_motor_run</code> STMT / motion / <code>block.motor_run</code> | "Motor [M1] quay [tiến] [50]%"; <code>MOTOR_ID=M1</code>, <code>DIR=FORWARD</code>, <code>POWER:Number=50</code> | <code>robot.motorRun(M1,Forward,50);</code>; latched | MOTOR(M1) · N · DRIVER_GATED | NEW/S1; HW_VERIFY |
| B03v2 | <code>codelab_v2_motor_power</code> STMT / motion / <code>block.motor_power</code> | "Motor [M1] công suất [0]%"; <code>MOTOR_ID=M1</code>, <code>POWER:Number=0</code> (-100..100) | <code>robot.motorSetPower(M1,0);</code>; latched | MOTOR(M1) · N · DRIVER_GATED | NEW/S1 |
| B04v2 | <code>codelab_v2_motor_stop</code> STMT / motion / <code>block.motor_stop</code> | <code>MOTOR_ID=M1</code> | <code>robot.motorStop(M1);</code> | MOTOR(M1) · N · DEVICE_MISSING | NEW/S1 |
| B05v2 | <code>codelab_v2_motor_stop_all</code> STMT / motion / <code>block.motor_stop_all</code> | Không tham số | <code>robot.stopAllMotors();</code>; hệ thống STOP có ưu tiên cao hơn | ALL_MOTORS · N · DRIVER_GATED | NEW/S1 |
| C02v2 | <code>codelab_v2_drive_direction</code> STMT / motion / <code>block.drive_direction</code> | "Robot [tiến ▾] [50]%"; <code>DIRECTION=FORWARD</code> (BACKWARD/STRAFE_LEFT/RIGHT/TURN_LEFT/RIGHT), <code>POWER:Number=50</code> | <code>robot.driveDirection(Forward,50);</code>; latched | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C06v2 | <code>codelab_v2_drive_axes</code> STMT / motion / <code>block.drive_axes</code> | "Robot tiến [0] ngang-phải [0] xoay-phải [0]"; <code>FWD/RIGHT/CW:Number=0</code> | <code>robot.drive(fwd,right,cw);</code>; signs converted only in facade | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C08v2 | <code>codelab_v2_drive_stop</code> STMT / motion / <code>block.drive_stop</code> | Không tham số | <code>robot.driveStop();</code> | DRIVE · N · DRIVE_NOT_CONFIGURED | NEW/S2 |
| C10v2 | <code>codelab_v2_drive_for_time</code> STMT / motion / <code>block.drive_for_time</code> | "Robot [tiến] [50]% trong [1] giây [và đợi]"; <code>DIRECTION=FORWARD</code>, <code>POWER:Number=50</code>, <code>SECONDS:Number=1</code>, <code>WAIT=WAIT</code> hoặc <code>NO_WAIT</code> | <code>motion.startTimedDrive(Forward,50,1000,WAIT);</code>; WAIT suspend; NO_WAIT trả về ngay, handle còn active đến deadline/hủy (§3.4) | DRIVE · Y if WAIT · MOTION_TIMEOUT | NEW/S2 |

### 5.3. Tay cầm PS4 (5; chỉ hiện nếu Devices có PS4 I²C được hỗ trợ)

| ID | type / kind / category / i18n | Label, fields/inputs, default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| A14v2 | <code>codelab_v2_when_ps4_pressed</code> HAT / ps4 / <code>block.ps4_when_pressed</code> | "Khi nút [X] được nhấn"; <code>BUTTON=X</code>, BODY statement | <code>events.onPressed(X,scriptUID)</code>; token cạnh còn hợp lệ theo §3.3; Options/Share/PS không chọn được | PS4 · N · RESERVED_BUTTON | NEW/S0 |
| A17v2 | <code>codelab_v2_when_ps4_released</code> HAT / ps4 / <code>block.ps4_when_released</code> | "Khi nút [X] được thả"; <code>BUTTON=X</code>, BODY statement | <code>events.onReleased(X,scriptUID)</code>; token theo §3.3 | PS4 · N · RESERVED_BUTTON | NEW/S0 |
| DP03v2 | <code>codelab_v2_ps4_pressed</code> BOOL / ps4 / <code>block.ps4_pressed</code> | "Nút [X] đang được nhấn?"; <code>BUTTON=X</code> | <code>ps4.pressed(X)</code> đọc snapshot đã xác minh | PS4 · N · PS4_UNAVAILABLE | NEW/S1 |
| DP06v2 | <code>codelab_v2_ps4_axis_percent</code> NUMBER / ps4 / <code>block.ps4_axis_percent</code> | "Cần [trái] trục [dọc] (%)"; <code>STICK=LEFT</code>, <code>AXIS=Y</code>; -100..100 | <code>ps4.axisPercent(LY)</code> (LY lên = dương) | PS4 · N · PS4_UNAVAILABLE | NEW/S1 |
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
| H06v2 | <code>codelab_v2_arithmetic</code> NUMBER / math / <code>block.arithmetic</code> | <code>OP=ADD</code>, <code>A:Number=1</code>, <code>B:Number=1</code> | <code>a + b</code>, −, ×, ÷, lũy thừa; mẫu số 0 chặn khi biết tĩnh, nếu xảy ra khi RUN thì FAULT trước side effect | NONE · N · DIVIDE_BY_ZERO | NEW/S0 |

### 5.5. Biến (3)

| ID | type / kind / category / i18n | Fields, inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| I02v2 | <code>codelab_v2_variable_set_number</code> STMT / variable / <code>block.variable_set</code> | <code>VAR=biến_mới</code>, <code>VALUE:Number=0</code> | <code>var_&lt;stableId&gt; = 0;</code> | NONE · N · TYPE_MISMATCH | NEW/S0 |
| I03v2 | <code>codelab_v2_variable_change_number</code> STMT / variable / <code>block.variable_change</code> | <code>VAR=biến_mới</code>, <code>DELTA:Number=1</code> | <code>var_&lt;stableId&gt; += 1;</code> | NONE · N · NON_NUMERIC_VARIABLE | NEW/S0 |
| I04v2 | <code>codelab_v2_variable_get_number</code> NUMBER / variable / <code>block.variable_get</code> | <code>VAR=biến_mới</code> | <code>var_&lt;stableId&gt;</code> | NONE · N · UNDEFINED_VARIABLE | NEW/S0 |

Biến Basic V2 là kiểu **số**. Các block biến dùng type riêng vì ràng buộc kiểu và reset tại RUN (§7.1). Sau này bổ sung text/bool theo type system rõ. Tên Unicode trong UI không trực tiếp thành symbol C++: dùng ID/namespace-generated identifier có collision guard, giữ tên hiển thị cho người học. Reset lại trạng thái biến mỗi lần READY→RUN.

### 5.6. Hiển thị và LED (2; LED cần Devices và quyền ghi của học sinh)

| ID | type / kind / category / i18n | Fields, inputs và default | C++/execution semantics | Resources · Yield · Warn | Status |
|---|---|---|---|---|---|
| E05v2 | <code>codelab_v2_serial_message</code> STMT / display / <code>block.serial_message</code> | <code>VALUE: String hoặc Number</code>, text shadow mặc định "Xin chào!" | <code>ui.tryLogLine(value);</code>; enqueue hữu hạn, best-effort | SERIAL · N · SERIAL_DROPPED | NEW/S0 |
| E01v2 | <code>codelab_v2_led_set</code> STMT / led / <code>block.led_toggle</code> | <code>LED_ID</code> mặc định là LED học sinh duy nhất hoặc LED mặc định trong Devices. Nếu không có mặc định thì phải chọn ID, <code>STATE=ON</code> hoặc <code>OFF</code> | <code>ui.ledSet(LED_ID,On);</code>; facade kiểm quyền sở hữu | LED · N · LED_BUSY/NO_LED | NEW/S1, HW_VERIFY |

**Serial V2:** serialize từng dòng vào buffer cố định; giới hạn đề xuất 128 byte UTF‑8 mỗi dòng (kể cả xuống dòng) và tổng queue 1 KiB. Bỏ nguyên dòng mới nếu không có sink, vượt giới hạn hoặc queue đầy; tăng counter <code>V2_SERIAL_DROPPED</code>, không retry từ script. Sink drain độc lập theo dung lượng có thể ghi hoặc API nonblocking đã kiểm chứng. Không gọi <code>Serial.println()</code> / flush đồng bộ từ scheduler, kể cả USB CDC không có host. L0/§3.6 dùng sink mock còn chỗ; thời điểm quan sát trên USB có thể muộn hơn enqueue.

**Đếm:** 6 Control + 8 Motion + 5 PS4 + 6 Logic/Math + 3 Variables + 2 Display/LED = **30 block/biến thể cốt lõi**. Các block phần cứng chỉ được hiển thị khi Devices/runtime đáp ứng; vì vậy một dự án chưa chọn PS4/motor sẽ có ít hơn 30 block. A05 ở §6; L2 dùng hai A04 lồng nhau.

### 5.7. Quy ước schema bổ sung

- Giá trị mặc định ở mọi <code>Number input</code> dùng Blockly shadow <code>math_number</code>; không để socket số rỗng khi tạo block. Dropdown dùng **stable ID** từ Devices, UI label có thể đổi tên mà không đổi JSON; xóa Device giữ block + warning icon.
- Mỗi block phải có <code>type</code>, <code>message0</code>, <code>args0</code>, <code>fieldName</code>, <code>inputName</code>, <code>outputCheck</code> (BOOL→<code>Boolean</code>, NUMBER→<code>Number</code>, TEXT→<code>String</code>), <code>previousStatement/nextStatement</code> hoặc <code>output</code>, <code>colour</code>/<code>style</code>, <code>tooltip</code>, <code>i18n</code>, <code>status</code>, <code>requiredCapabilities</code>, <code>resources</code>, <code>blocking</code>, <code>interruptible</code>, <code>validationCodes</code>.
- Màu áp dụng từ palette <code>src/blocks/palette.js</code>: control <code>#7ECBB1</code>, math <code>#9ECB8E</code>, logic <code>#8DB5E6</code>, variable <code>#EDB070</code>, display <code>#C4A3D8</code>, sensor <code>#7CC4DA</code>, PS4 <code>#D9A0D3</code>, advanced <code>#A8B6C8</code>. **Motion** là category mới cần chọn trong theme (đề xuất <code>#4C97FF</code>), không xóa màu đang lưu ở block cũ.
- <code>resources</code> phân tích tĩnh từ block + target ID + Devices. Áp dụng cảnh báo nhiều writer theo §3.4; lệnh dừng vẫn tham gia arbitration. Bị block compile nếu device missing/profile unsafe.
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
| Events | A15 PS4 mất kết nối | Sự kiện chẩn đoán của system khi vào FAULT. Không dispatch handler học sinh sau khi khóa motor | S2 / SYSTEM |
| Events | A16 nhận tin nhắn | <code>events.onMessage("start")</code>; 1 pending per handler | S3 |
| Motor | B01 khởi tạo M1 | Advanced: <code>robot.initMotor(M1)</code>; Basic tự setup Devices | S1 |
| Motor | B06 giới hạn M1 | <code>robot.motorLimit(M1,100)</code>; min Device bound | S1 |
| Motor | B07 đảo chiều M1 | Thiết lập trong Devices; Advanced setup <code>cfg.motor[M1].inverted=false</code> | S1 |
| Motor | B08 chạy motor trong thời gian | <code>motion.startTimedMotor(M1,Forward,30,1000,WAIT)</code>; chọn WAIT/NO_WAIT, handle theo §3.4 | S1 |
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
| PS4 | D-P01 kết nối PS4 | **Advanced** manual; runtime auto init từ Devices theo profile đã xác minh; địa chỉ/chân lấy từ profile | S1 |
| PS4 | D-P04 Options edge | **SYSTEM-ONLY**: Options giữ đủ 1 s rồi nhả để START theo §2.3; không có handler học sinh | S1 + bench |
| PS4 | D-P05 vừa thả X? | <code>ps4.justReleased(X)</code>, state latched per frame | S1 |
| PS4 | D-P07 forward percent | <code>ps4.forwardPercent()</code>; LY lên positive | S2 |
| PS4 | D-P08 turn percent | <code>ps4.turnClockwisePercent()</code>; LX right positive | S2 |
| PS4 | D-P09 strafe percent | <code>ps4.strafeRightPercent()</code>; RX right positive | S2 |
| PS4 | D-P10/D-P11 ARM/DISARM | **Không có block Basic**; control-plane Options/Share; Advanced diagnostics không được bypass safety | S1 |
| PS4 | D-P12 đang RUN? | <code>runtime.isRunning()</code>, BOOL | S1 |
| PS4 | D-P13 đang FAULT? | <code>runtime.hasFault()</code>, BOOL | S1 |
| PS4 | D-P14 clear fault | Control-plane theo §2.2; fresh/neutral nếu required, CLEAR không START | S1 |
| PS4 | D-P15 fault code | <code>runtime.faultCode()</code> | S1 |
| PS4 | D-P16 timeout | <code>ps4.linkTimedOut()</code>; safety limit 250ms is runtime constant, **không chỉnh Devices Basic** | S1 |
| LED | E02 blink | <code>ui.ledBlink(500)</code>; nonblocking runtime, no raw delay in concurrent handler | S1, led ownership |
| LED | E03 báo PS4 | <code>ui.setLinkLedEnabled(true)</code>; system owns LED | S1 |
| LED | E04 độ sáng | <code>ui.ledBrightness(50)</code> | PWM LED support verified |
| Display | E06 print raw | <code>ui.tryLog(value)</code>, mặc định 0; cùng hàng đợi hữu hạn §5.6 | S1 |
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
| My Blocks | J01/J02 define/call | Thủ tục và lời gọi inline vào state-machine của script, hỗ trợ wait theo §3.5 | G1 spike, S1 sau khi PASS |
| My Blocks | J03/J04 param define/call | Thủ tục có tham số kiểu số, ví dụ <code>quay(30)</code>; đánh giá một lần khi vào đoạn inline | G1 spike, S2 sau khi PASS |
| Advanced | K01/K02 GPIO read/write | Raw GPIO only when profile permits and no conflict | S1 |
| Advanced | K03/K04 ADC/PWM | Respect reserved pin map; V2 GPIO47=M6, reject PWM there | S1 |
| Advanced | K05/K06/K07 Serial | <code>serial.available()</code>/<code>serial.tryRead()</code>/<code>ui.tryLogLine()</code>; I/O hữu hạn theo §3.2 và §5.6 | S1 |
| Advanced | K08 UART legacy | Preserve adapter; not PS4 I2C path | compatibility |
| Advanced | K09/K10/K11 raw I2C | Prevent conflict with PS4 0x30, IMU 0x6A, shared bus | S3 |
| Advanced | K12 pull input | <code>pinMode(1, INPUT_PULLUP)</code> | S1 |

**Lưu ý hồ sơ:** Một số nhóm V0.1 hiện ở P0 nhưng V0.2 chuyển thành Stage S2/S3/HW_VERIFY; đây là **chủ đích giảm phạm vi sản phẩm cơ bản**, không xóa nhu cầu dài hạn. Mã danh mục lịch sử tra ở Phụ lục A. Các mục §6 có type riêng mới hoặc đổi semantics phải theo quy ước §1 khi chốt schema.

## 7. Migration, validation và mã C++

### 7.1. Migration v1 → v2 không âm thầm thay ý nghĩa

- Project hiện có: <code>format=codelab-project</code>, <code>version=1</code>, Blockly block IDs như <code>beginner_start</code>, <code>beginner_forever</code>, <code>beginner_wait</code>, <code>beginner_motor</code>, PS4 simulation/UART.
- V1 tiếp tục mở ở <code>Legacy</code> hoặc được người dùng chọn **Tạo bản chuyển đổi**. Các type riêng mới hoặc đổi semantics dùng <code>codelab_v2_&lt;snake_case&gt;</code>. Type chuẩn giữ lại nếu hợp đồng không đổi (ví dụ A03/A04 cùng <code>controls_if</code> với mutation khác nhau). Không alias block legacy vào hành vi V2.
- Chuyển đổi tạo **project copy** version 2, giữ file gốc, hiển thị diff và yêu cầu xác nhận runMode, Devices, orphan stack và capability. Nêu rõ các đổi hành vi, gồm <code>beginner_start</code> từ setup sang RUN, LED từ GPIO cố định sang ID/owner, Serial từ ghi trực tiếp sang best-effort, và PS4 connected sang freshness đã xác minh. Kiểm tra dữ liệu biến cũ trước khi chuyển sang block biến số.
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
| <code>V2_MOTOR_MULTI_WRITER</code> | Hai script có thể phát công suất khác 0 trên kênh trùng | WARN | Hiện kênh và script; bỏ qua stop/0 tĩnh |
| <code>V2_DRIVE_OWNERSHIP</code> | Lệnh chạy DRIVE và lệnh chạy kênh riêng xung đột | WARN | Giải thích hủy cả nhóm; gộp cảnh báo trùng |
| <code>V2_SENSOR_NOT_READY</code> | Motion degree/cm khi sensor chưa validated | BLOCK | Không có time fallback |
| <code>V2_SENSOR_STALE</code> | Sensor invalid/stale lúc chạy | RUNTIME | Stop motion / FAULT theo policy |
| <code>V2_WAIT_TIMEOUT</code> | Wait until hoặc motion until quá deadline | RUNTIME | Cancel action, stop owned channel, notify |
| <code>V2_PROC_RECURSION</code> | Call graph có chu trình | BLOCK | Hiện chuỗi lời gọi để bỏ đệ quy |
| <code>V2_PROC_INLINE_LIMIT</code> | Mở rộng My Blocks vượt quota code/frame | BLOCK | Chỉ rõ chỗ gọi và quota đã vượt |
| <code>V2_SCRIPT_LIMIT</code> | >16 scripts hoặc vượt quota memory | BLOCK | Không tạo scheduler quá giới hạn |
| <code>V2_PROFILE_MISMATCH</code> | Board selected khác board/firmware validated | BLOCK | Không flash bằng profile sai |
| <code>V2_SAFETY_START_UNAVAILABLE</code> | AUTO thiếu đường START đã bench và điều kiện an toàn §2.3 | BLOCK HARDWARE RUN | Cho phép chỉnh block/host sim; giữ PWM=0 |
| <code>V2_RUN_MODE_MISMATCH</code> | AUTO có hat/reporter phụ thuộc PS4 trong mã có thể chạy | BLOCK | Đổi mode hoặc bỏ dependency |
| <code>V2_AUTO_RUN_LIMIT_INVALID</code> | Thời hạn AUTO không hợp lệ | BLOCK | Dùng số nguyên trong khoảng profile cho phép |
| <code>V2_AUTO_MAX_RUNTIME</code> | AUTO chạm deadline RUN | FAULT | Hủy script/motion, tắt đầu ra motor, cần CLEAR |
| <code>V2_SERIAL_DROPPED</code> | Log thiếu sink, quá dài hoặc queue đầy | COUNTER | Bỏ dòng; scheduler tiếp tục |
| <code>V2_DIVIDE_BY_ZERO</code> | Chia cho 0 | BLOCK / FAULT | Chặn nếu biết tĩnh; khóa đầu ra motor nếu gặp trong RUN |
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
  bool active = false; // Scheduler owns the bounded pending edge token.
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
      // Scheduler dispatches only a still-current pending edge (§3.3).
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
    Nếu không
      Nếu [giá trị cần trái ngang < -20]
        Motor M1 lùi 40%
        Motor M2 tiến 40%
      Nếu không
        Dừng motor M1
        Dừng motor M2
~~~

L2 chỉ dùng hai khối A04 lồng nhau trong Basic. Phải chọn/mapping Devices để "quay" có nghĩa cơ khí; không tự suy 2 motor bất kỳ là robot hai bánh.

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

### L4 — Autonomous có thời hạn

~~~text
Devices: Drivetrain4; runMode=AUTONOMOUS; autoMaxRunSeconds=15
Nguồn START: nút vật lý đã xác minh, hoặc PS4 Options tạm theo §2.3
Khi chương trình bắt đầu
  Robot [tiến] [50]% trong [1] giây [và đợi]
~~~

Cấp nguồn → READY/0. Sau START hợp lệ robot chạy theo thời hạn rồi tự về READY/0. Đổi sang [không đợi] thì hat kết thúc ngay, handle vẫn giữ chương trình sống đúng 1 giây. Không cần thêm `Robot dừng` cuối bài. Nếu START bằng PS4, rớt link sau RUN không đổi kết quả. Khi chưa đạt điều kiện phần cứng §2.3, L4 chỉ chạy mock.

### L5 — Sensor future (not enabled until supported)

~~~text
Khi chương trình bắt đầu
  Robot đi tiến tốc độ 50% cho tới khi khoảng cách < 20cm; timeout 10s
  Robot quay phải 90 độ
  Robot tiến 30 cm
~~~

Không bật nếu chưa có distance + IMU + encoder (hoặc thuật toán tương đương đã nghiệm thu). Sensor invalid/stale khiến chuyển động stop; không tự thay bằng lệnh thời gian.

## 9. Kế hoạch triển khai sau khi duyệt

| Gate | Việc cần làm | Chứng cứ để qua |
|---|---|---|
| G0 | Duyệt lifecycle, safety, Basic 30, Devices, type và migration | Xác nhận các quyết định §10 trong Issue #28 |
| G1 | Spike codegen scheduler, inline My Blocks có wait, AUTO và motion handle | Toàn bộ ca host, C++ sinh ra build được, số đo và ngưỡng §9.2 |
| G2 | Devices, generator và migration | Roundtrip/schema/i18n, arbitration, compile gates, smoke UI |
| G3 | Xác minh đúng board, driver, D1/PS4 và START/STOP trên 1 motor | Log release/hold, link loss, xung ngắn, watchdog/reset, STOP và ngắt nguồn. AUTO Options chỉ bật khi đạt §2.3 |
| G4 | Drivetrain 4WD | Bench dấu, tổ hợp trục, giới hạn, STOP/reboot và L1–L4 theo capability |
| G5 | Advanced, cảm biến, servo | Bằng chứng per-driver, stale/invalid/timeout và gate theo Devices |
| G6 | PoC WASM của #27 | Build/nạp browser-only sau khi luồng Blockly ổn định |

### 9.1. Test matrix

| Nhóm | Ca bắt buộc |
|---|---|
| Scheduler và bridge | Tất cả ca §3.6. Spam 100 cạnh quan sát được vẫn tối đa 1 pending/hat. Duplicate/stale report, sequence wrap/reset theo adapter, reconnect, STOP trước dispatch, tie-break bất biến khi kéo block, timer wrap. Đo xung ngắn trên đúng D1/ESP32 theo §3.3 ở G3 |
| Motion | WAIT/NO_WAIT, hết hạn, stopAll, ghi đè timer cũ, ghi kênh trùng hủy cả DRIVE, handle pool và cleanup. Lệnh chạy + stop không warning; hai lệnh chạy xung đột có warning, DRIVE không báo trùng |
| AUTO | Natural completion có/không timed handle, latch không giữ RUN, hat còn chờ và forever chỉ thoát khi stop/fault hoặc deadline. Kiểm mặc định, biên khoảng, trần profile, deadline wrap, ưu tiên deadline khi trùng completion, reset sau START mới |
| Lifecycle | Boot PWM=0, held-at-boot, nhả sớm, stale, lệch neutral, Share và mất link trước khi xác nhận Options. Sau RUN, CONTROLLER mất link → FAULT, AUTO chỉ dùng PS4 để START vẫn chạy. Share khi còn link, đường START không đủ điều kiện, ngắt nguồn cục bộ và CLEAR riêng |
| Inline và I/O | Inline wait/WAIT bắc cầu, hai call site, đối số chỉ tính một lần, quota và đệ quy bị chặn. Serial sink trống/đầy/mất kết nối, dòng UTF-8 quá dài; drop counter và scheduler/STOP vẫn đạt budget. Status LED/lightbar vắng mặt không ảnh hưởng lifecycle |
| Schema/legacy | V1 mở lại cùng semantics; opt-in migration giữ file gốc; type mới không đụng legacy; A03/A04 dùng mutation chuẩn; L2 chỉ dùng Basic. Xóa Device giữ block/ID; đổi board không remap; GPIO47 không dùng làm LED V2; sensor thiếu driver bị gate |
| Dấu và build | PS4 raw → học sinh; facade → mixer. 6 hướng và mixed axes. `npm test`, `npm run build`, Arduino compile đúng FQBN trước bench; hardware PASS cần số đo từ mạch |

### 9.2. Ngưỡng Go/No-Go G1 đề xuất, chưa benchmark

| Hạng mục | Ngưỡng đề xuất |
|---|---|
| Quy mô | Tối đa 16 script đăng ký, 16 active, 1 pending/hat. Sau inline, tối đa 1024 operation tĩnh toàn project và 256 byte frame/script |
| Scheduler | Tối đa 256 operation đã tính phí mỗi tick và 2 ms tổng script work/tick. Dừng slice trước khi vượt một trong hai quota; I/O không được giữ scheduler chờ. Khoảng phát heartbeat mục tiêu ≤50 ms; timeout heartbeat và freshness mỗi loại 250 ms |
| RAM và flash | Phần tăng so với baseline ≤16 KiB RAM (static + peak stack/heap tăng thêm của runtime, script, log và motion) và ≤64 KiB flash (.text + .rodata + dữ liệu khởi tạo lưu trong flash) |
| Thực thi | PASS toàn bộ ca host liên quan G1, gồm §3.6, cạnh stale, timeout, chặn inline vượt quota/đệ quy, Serial đầy và STOP ưu tiên. Không có side effect chạy lại sau resume hoặc PWM từ lần RUN trước |

**Cách đo:** dùng cùng toolchain, FQBN, flags và stub I/O cho baseline không có scheduler V2 và fixture 16 script có inline lồng, motion WAIT/NO_WAIT, log đầy và burst PS4 mock. Lưu generated C++, build log, linker map và cách tính peak stack/heap. Chạy ít nhất 10.000 tick tải trên host, ghi cấu hình máy, max và p99 cho script work/heartbeat. Cross-compile ESP32-S3 để đối chiếu footprint; phần RAM peak chưa đo trực tiếp phải có cận trên từ frame/stack/pool đã phân bổ. Trượt ngưỡng hoặc thiếu số liệu thì chưa Go, ghi nguyên nhân và thu hẹp inline/quota hoặc thử đối chứng. Kết quả host không xác nhận timing, watchdog hay thời gian dừng trên mạch; xác minh lại ở G3 trước khi bật tải.

## 10. Các lựa chọn V0.2 để duyệt tại G0

- READY khi cấp nguồn. Options giữ 1 s rồi nhả cho CONTROLLER và cho AUTO tạm nếu đạt §2.3; fast100 rising edge thuộc Legacy.
- Dispatch chỉ cạnh còn hiệu lực. CONTROLLER chờ sự kiện, AUTO tự dừng khi hết việc và còn giới hạn cứng. Motion có thời hạn dùng handle kể cả NO_WAIT.
- G1 thử state-machine với My Blocks inline có wait, theo ngưỡng §9.2. Các con số ở §2, §3, §5 và §9 là đề xuất chưa bench.
- Basic vẫn 30 block/biến thể. Devices mở tính năng theo capability; type đổi semantics tách Legacy và migration tạo bản sao.
- G0 cần xác nhận review. G1–G6 cần chứng cứ riêng theo §9.

## 11. References

- [V0.1 — full original catalog](BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md), preserved for line-by-line comparison.
- [Issue #28 — Blockly-first](https://github.com/HiyoriVn/CodeLab/issues/28).
- [Issue #27 — browser-only WASM PoC](https://github.com/HiyoriVn/CodeLab/issues/27).
- [main Blockly source](https://github.com/HiyoriVn/CodeLab/tree/main/src/blocks), [Arduino generator](https://github.com/HiyoriVn/CodeLab/blob/main/src/generators/arduino.js), [board profiles](https://github.com/HiyoriVn/CodeLab/blob/main/src/boards/profiles.js).
- [Mecanum & safety test docs](https://github.com/HiyoriVn/CodeLab/blob/main/docs/robotics/PS4_MECANUM.md), [CodeLabRobot library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabRobot), [CodeLabPs4I2C library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabPs4I2C).

**Đây là tài liệu REVIEW — các tên API facade chỉ là đề xuất, không phải phần mềm đã tích hợp.**

## Phụ lục A. Đối chiếu danh mục V0.1 → V0.2

Mỗi ID cũ có một đích trong bảng. Khoảng ID theo thứ tự trong V0.1. Basic tra type tại §5, extension tra hợp đồng và capability tại §6. V0.1 giữ nguyên để đối chiếu. A17v2 là hat RELEASE mới, không thuộc tập 126 block cũ.

| ID V0.1 | Đích V0.2 (ID/type hoặc hợp đồng) | Stage / trạng thái |
|---|---|---|
| A01–A02 | A01v2 `codelab_v2_when_run`, A02v2 `codelab_v2_forever` | S0 Basic mới |
| A03–A04 | A03/A04 `controls_if` (mutation ELSE ở A04) | S0 Basic giữ type |
| A05 | A05, biến thể else-if của `controls_if` | S0 extension |
| A06 | A06v2 `codelab_v2_repeat_n` | S0 Basic mới |
| A07, A09–A11, A13 | Cùng ID ở §6, loop/wait và thời gian RUN | S1 extension |
| A08 | A08v2 `codelab_v2_wait_seconds` | S0 Basic mới |
| A12 | A12, `runtime.requestStop()` | S0 extension |
| A14 | A14v2 `codelab_v2_when_ps4_pressed` | S0 Basic mới |
| A15 | A15, chẩn đoán mất link | S2 system |
| A16 | A16, hat tin nhắn | S3 extension |
| B01 | Devices tự khởi tạo, B01 manual | S1 Devices / Advanced |
| B02–B05 | B02v2–B05v2 `codelab_v2_motor_{run,power,stop,stop_all}` | S1 Basic gated driver |
| B06–B08 | Cùng ID ở §6, limit/invert/timed motor | S1 extension |
| B09–B12 | Cùng ID ở §6, reporter và nhóm motor | S2 extension |
| B13–B16 | Cùng ID ở §6, brake/encoder/current | HW_VERIFY |
| C01 | Devices drivetrain, C01 manual | S2 Devices / Advanced |
| C02–C05 | Gộp vào C02v2 `codelab_v2_drive_direction` | S2 Basic |
| C06, C08, C10 | C06v2 `codelab_v2_drive_axes`, C08v2 `codelab_v2_drive_stop`, C10v2 `codelab_v2_drive_for_time` | S2 Basic |
| C07, C09 | Cùng ID ở §6, limit/ready | S2 extension |
| D-P01 | Devices PS4, D-P01 manual | S1 Devices / Advanced |
| D-P02, D-P03, D-P06 | DP02v2 `codelab_v2_ps4_connected`, DP03v2 `codelab_v2_ps4_pressed`, DP06v2 `codelab_v2_ps4_axis_percent` | S1 Basic gated PS4 |
| D-P04, D-P10–D-P11, D-P14 | Options, ARM/STOP, CLEAR ở §2 | S1 system |
| D-P05, D-P12–D-P13, D-P15–D-P16 | Cùng ID ở §6, reporter PS4/runtime | S1 extension |
| D-P07–D-P09 | Cùng ID ở §6, reporter theo hướng | S2 extension |
| E01, E05 | E01v2 `codelab_v2_led_set`, E05v2 `codelab_v2_serial_message` | S1 Basic LED gated / S0 Basic log |
| E02–E03, E06 | Cùng ID ở §6, hiệu ứng LED/status/log | S1 extension |
| E04, E07–E08 | Cùng ID ở §6, LED PWM/buzzer | HW_VERIFY |
| F01–F05 | Devices servo và cùng ID ở §6 | HW_VERIFY |
| G01–G14 | Cùng ID ở §6, Devices/driver tương ứng | Gated theo capability / HW_VERIFY |
| G15 | G15, reporter sensor valid | S3 extension |
| H01–H05 | H01–H05, type Blockly chuẩn ở §5.4 | S0 Basic giữ type |
| H06 | H06v2 `codelab_v2_arithmetic` | S0 Basic mới |
| H07–H09, H10–H11, H12–H14 | Cùng ID ở §6, toán mở rộng | S0, S1, S2 tương ứng |
| I01 | I01, tạo biến qua UI | S0 UI |
| I02–I04 | I02v2–I04v2 `codelab_v2_variable_{set,change,get}_number` | S0 Basic biến số |
| I05–I06, I07, I08–I10 | Cùng ID ở §6, text/list | S1, S2, S3 tương ứng |
| J01–J02, J03–J04 | Cùng ID ở §6, My Blocks inline, có/không tham số | Spike G1, S1/S2 sau PASS |
| K01–K07, K12 | Cùng ID ở §6, GPIO/PWM/Serial | S1 Advanced |
| K08 | Adapter UART legacy | Legacy |
| K09–K11 | Cùng ID ở §6, I²C nâng cao | S3 Advanced |

D01–D11 là 11 mục cấu hình Devices ngoài tập 126 block. Đối chiếu ở §4: D01 profile; D02–D06 motor/role/invert/group/drivetrain; D07 bridge PS4; D08–D09 servo/sensor gated; D10 giới hạn và brake; D11 thiết lập editor.
