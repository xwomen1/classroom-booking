# RoomHub – Mô tả các sơ đồ thiết kế

Tài liệu mô tả từng sơ đồ trong `RoomHub_design.drawio`. Mỗi sơ đồ là một tab trong file draw.io;
ảnh PNG tương ứng nằm trong `figures/`, cùng số hiệu với tên tab.

RoomHub là ứng dụng đặt phòng học/phòng họp gồm ứng dụng Android (React Native, TypeScript),
backend Java Spring Boot (H2) và tích hợp khóa thông minh SmartLock DLWA12 qua nền tảng OneIoT (MQTT).
Hệ thống có hai vai trò: Người dùng và Quản trị viên.

**Quy ước màu**: xanh dương – ứng dụng di động; xanh lá – backend; cam – hệ thống ngoài / IoT;
tím – dữ liệu; vàng – ghi chú, điểm quyết định; đỏ – rủi ro, vấn đề.

---

## A. Phân tích yêu cầu nghiệp vụ

### 01. Context Diagram

Ảnh: `figures/01_context_diagram.png`

Sơ đồ ngữ cảnh (DFD mức 0) xem RoomHub là một tiến trình duy nhất và chỉ ra năm thực thể bên ngoài
cùng dữ liệu trao đổi:

- **Người dùng** gửi yêu cầu đăng nhập, đặt/hủy phòng, tạo PIN, báo sự cố; nhận phòng trống,
  trạng thái đặt phòng, mã PIN và thông báo.
- **Quản trị viên** duyệt yêu cầu, cấu hình quy định, quản lý phòng, tài khoản và khóa; nhận các
  yêu cầu chờ xử lý.
- **OneIoT** nhận lệnh tạo mật khẩu tạm và gửi về sự kiện mở/khóa cửa.
- **SmartLock DLWA12** chỉ trao đổi với OneIoT, không kết nối trực tiếp với hệ thống.
- **Android OS** hiển thị thông báo ưu tiên.

Người dùng nhập PIN trực tiếp trên bàn phím khóa, ngoài phạm vi phần mềm.

### 02a. Use Case – Tổng quát

Ảnh: `figures/02a_use_case_tong_quat.png`

Người dùng và Quản trị viên cùng kế thừa tác nhân trừu tượng *Người dùng đã xác thực*, nên dùng
chung nhóm ca sử dụng: đăng nhập/đăng xuất, đổi mật khẩu, khôi phục mật khẩu bằng mã khôi phục,
xem/sửa hồ sơ và xem thông báo.

### 02b. Use Case – Người dùng

Ảnh: `figures/02b_use_case_nguoi_dung.png`

Các ca sử dụng của Người dùng: đăng ký, tìm phòng trống, đặt phòng, đặt lặp hàng tuần (tối đa 8 tuần),
hủy đặt phòng, sửa chuỗi đang chờ duyệt, xem lịch, thỏa thuận giờ nhận khóa, ủy quyền nhận khóa,
tạo mã PIN tạm thời, báo sự cố và ghi chú tình trạng phòng.

- *Đặt phòng* «include» *Kiểm tra quy tắc*.
- *Đặt lặp hàng tuần* và *Tự động duyệt* «extend» *Đặt phòng*.
- *Tạo mã PIN tạm thời* «include» *Gửi PIN tới khóa*.
- Tác nhân phụ *SmartLock/OneIoT* tham gia *Gửi PIN tới khóa* và *Ghi nhận ra/vào*.

### 02c. Use Case – Quản trị viên

Ảnh: `figures/02c_use_case_quan_tri_vien.png`

Các ca sử dụng của Quản trị viên: duyệt/từ chối, đổi phòng phù hợp, thỏa thuận giờ nhận khóa,
xác nhận check-in, ghi nhận vắng mặt (no-show), quản lý tài khoản, cấp/thu hồi quyền tạo PIN,
quản lý phòng, lên lịch bảo trì, xử lý yêu cầu bảo trì, cấu hình quy định và quản lý SmartLock.

- *Duyệt/từ chối* «include» *Kiểm tra quy tắc*, vì yêu cầu được kiểm tra lại khi duyệt.
- *Xử lý yêu cầu bảo trì* «include» *Lên lịch bảo trì*.
- *Bật/tắt tự động duyệt* «extend» *Cấu hình quy định*.

### 03. Activity – Đặt phòng & duyệt

Ảnh: `figures/03_activity_dat_phong_duyet.png`

Sơ đồ hoạt động bốn làn: Người dùng, Ứng dụng, booking-server, Quản trị viên.

1. Người dùng chọn tiêu chí, ứng dụng hiển thị phòng trống; người dùng chọn phòng, giờ, mục đích và
   gửi `POST /api/bookings`.
2. Server kiểm tra quy tắc cho từng lượt (với đặt lặp tuần, một lượt vi phạm làm cả chuỗi bị từ chối):
   - thời gian hợp lệ và chưa kết thúc;
   - ngày đặt trong cửa sổ `minAdvanceDays`..`maxAdvanceDays` (mặc định 1–3 ngày);
   - phòng tồn tại, `AVAILABLE`, không trùng lịch bảo trì;
   - không trùng lượt khác của phòng và không trùng lịch của chính người đặt;
   - không vượt `maxActiveBookingsPerUser` (mặc định 2); có mục đích sử dụng.
3. Nếu công tắc tự duyệt bật **và** phòng không phải phòng đặc biệt (`requiresApproval`), yêu cầu được
   lưu `APPROVED` với người duyệt `system`. Ngược lại lưu `PENDING` và báo Quản trị viên.
4. Khi Quản trị viên duyệt, server kiểm tra lại xung đột trước khi chuyển `APPROVED`; từ chối thì
   chuyển `REJECTED`.
5. Với phòng khóa số, việc duyệt cấp cho người đặt quyền tự tạo PIN tại phòng đó.

### 04a. Activity – Khóa số (PIN)

Ảnh: `figures/04a_activity_khoa_so_pin.png`

Luồng sử dụng phòng dùng khóa số, bốn làn: Người dùng, Ứng dụng, booking-server, OneIoT/SmartLock.

- Ứng dụng sinh mã 7 chữ số, hiệu lực từ `start − pinGrace` đến `end + pinGrace` (mặc định 10 phút);
  server cấp `passwordId` (1–255) và lưu PIN.
- Nếu phiên OneIoT đang kết nối, ứng dụng gửi lệnh tạo mật khẩu tạm qua MQTT; nếu chưa, mã vẫn hiển
  thị cho người dùng và được gửi khi kết nối.
- Người dùng nhập PIN tại khóa; khóa phát sự kiện mở khóa; ứng dụng nhận sự kiện và server ghi
  check-in hoặc check-out.

### 04b. Activity – Khóa cơ, vắng mặt, bảo trì

Ảnh: `figures/04b_activity_khoa_co_vang_mat_bao_tri.png`

- **Khóa cơ / thẻ từ**: Người dùng đề xuất giờ nhận khóa (`WAITING_ADMIN`); hai bên đề xuất qua lại
  đến khi đồng ý (`AGREED`). Quản trị viên giao khóa và xác nhận có mặt.
- **Vắng mặt**: với cả hai loại khóa, nếu không có check-in trước `start + noShowGrace`
  (mặc định 15 phút), Quản trị viên ghi nhận `NO_SHOW`.
- **Bảo trì**: trong khi dùng phòng, người dùng có thể báo sự cố; Quản trị viên lên lịch bảo trì
  hoặc từ chối.

### 05a. User Flow – Người dùng

Ảnh: `figures/05a_user_flow_nguoi_dung.png`

Từ màn hình đăng nhập (kèm nhánh đăng ký và quên mật khẩu), người dùng vào *Dashboard User* với ba
chức năng:

- *Tìm và đặt phòng*: lọc → chọn phòng → chọn giờ; kết quả là `PENDING` (cần duyệt) hoặc
  `APPROVED` (tự duyệt).
- *Lịch đặt phòng*: sắp tới, đã dùng, đã hủy.
- *Đặt phòng của tôi*: tạo PIN, nhận khóa, ủy quyền, báo sự cố, hủy, sửa chuỗi.

Menu chung gồm hồ sơ, đổi mật khẩu, thông báo và đăng xuất. Ứng dụng không dùng thư viện điều hướng;
màn hình được chọn bằng biến trạng thái `activeScreen` trong `RoleDashboardScreen`.

### 05b. User Flow – Quản trị viên

Ảnh: `figures/05b_user_flow_quan_tri_vien.png`

*Dashboard Admin* có năm chức năng: yêu cầu đặt phòng (duyệt, từ chối, đổi phòng, hẹn khóa,
có mặt/vắng mặt), phòng và bảo trì, quản lý khóa (gắn khóa, kết nối OneIoT), quy định đặt phòng và
quản lý tài khoản. Chạm vào banner thông báo ưu tiên sẽ mở thẳng màn hình xử lý tương ứng.

### 06a. Wireframe – Xác thực & Dashboard

Ảnh: `figures/06a_wireframe_xac_thuc_dashboard.png`

Khung giao diện mức thấp của các màn hình đăng nhập, đăng ký, quên mật khẩu, hồ sơ, đổi mật khẩu và
hai dashboard theo vai trò. Từ đăng nhập, ứng dụng chuyển tới dashboard tương ứng với vai trò.

### 06b. Wireframe – Người dùng

Ảnh: `figures/06b_wireframe_nguoi_dung.png`

Các màn hình của người dùng: lưới phòng theo tầng (xanh – trống, đỏ – đã đặt, vàng – bảo trì),
chọn giờ kèm tùy chọn lặp tuần, danh sách lượt đặt với thao tác theo loại khóa, lịch đặt phòng theo
tab và thông báo.

### 06c. Wireframe – Quản trị viên

Ảnh: `figures/06c_wireframe_quan_tri_vien.png`

Các màn hình quản trị: yêu cầu đặt phòng, phòng và bảo trì, quản lý khóa, quy định đặt phòng và
quản lý tài khoản. Wireframe chỉ thể hiện bố cục và thành phần, không phản ánh màu sắc hay kích
thước thật.

### 07. Functional Decomposition

Ảnh: `figures/07_functional_decomposition.png`

Hệ thống được phân rã thành 5 phân hệ, 11 module và các chức năng con:

| Phân hệ | Module |
|---------|--------|
| Người dùng & bảo mật | `auth`, `account_management`, `profile` |
| Phòng & bảo trì | `room_management`, `schedule_maintenance` |
| Đặt phòng | `booking`, `auto_approval` |
| Kiểm soát ra vào | `access_control`, `smart_lock` |
| Hệ thống | `notifications`, `configuration` |

Mỗi chức năng có hai hiện thực: bản cục bộ (AsyncStorage) và bản gọi REST; cờ `ENABLE_REMOTE_SYNC`
quyết định dùng bản nào.

---

## B. Kiến trúc

### 08. System Architecture

Ảnh: `figures/08_system_architecture.png`

Kiến trúc client–server ba tầng kèm nhánh IoT:

- **Client** (Android): giao diện React Native, services/repositories của 11 module, API client,
  AsyncStorage và native module Kotlin (MQTT tới OneIoT, thông báo ưu tiên).
- **Mạng**: server được công khai qua Cloudflare Tunnel; khi phát triển dùng `adb reverse`.
- **Server**: `SessionAuthFilter` → 6 REST controller → `BookingService` + `AutoApprovalPolicy` → JPA.
- **Dữ liệu**: H2 dạng tệp (mặc định) hoặc H2 SSL từ xa (profile `remote`).
- **IoT**: OneIoT (MQTT TLS cổng 2111), SmartLock thật hoặc trình giả lập Python.

Ứng dụng kết nối OneIoT trực tiếp; server không gọi OneIoT mà chỉ cấp `passwordId` và lưu trạng thái
PIN, sự kiện ra vào do ứng dụng báo lên.

### 09. C4 L1 – System Context

Ảnh: `figures/09_c4_l1_system_context.png`

Góc nhìn cao nhất theo mô hình C4: Người dùng và Quản trị viên tương tác với RoomHub; RoomHub phụ
thuộc ba hệ thống ngoài là OneIoT, SmartLock và Android OS. Đường nét đứt "Nhập PIN" thể hiện người
dùng tương tác với khóa ngoài phần mềm.

### 10. C4 L2 – Container

Ảnh: `figures/10_c4_l2_container.png`

| Container | Công nghệ | Trách nhiệm |
|-----------|-----------|-------------|
| Mobile App | React Native, TypeScript | Giao diện theo vai trò, 11 module nghiệp vụ |
| Native Bridge | Kotlin | MQTT TLS, mã hóa PIN, thông báo ưu tiên |
| Local Store | AsyncStorage | Dữ liệu chế độ cục bộ, PIN chờ gửi |
| booking-server API | Java 17, Spring Boot | REST API, xác thực phiên, nghiệp vụ |
| Database | H2 | 11 bảng dữ liệu |

App gọi server qua HTTPS/JSON; Native Bridge kết nối OneIoT qua MQTT TLS; server được công khai qua
Cloudflare Tunnel.

### 11a. C4 L3 – Component (App)

Ảnh: `figures/11a_c4_l3_component_app.png`

Mỗi module trong `src/modules` là một thành phần. App shell (`App.tsx`, `src/app`) giữ phiên đăng nhập
và điều hướng. Module `booking` nằm ở trung tâm, phụ thuộc vào 8 module khác. `core` chứa API client,
lưu trữ, cấu hình, tiện ích thời gian; `shared` chứa component giao diện dùng chung. Mũi tên đỏ hai
chiều là phụ thuộc vòng. Hình chỉ vẽ các phụ thuộc chính.

### 11b. Ma trận phụ thuộc module

Ảnh: `figures/11b_ma_tran_phu_thuoc_module.png`

Ma trận trích từ câu lệnh `import` thực tế: hàng là module import, cột là module bị import. Ô đỏ là
phụ thuộc vòng, gồm 7 cặp:

- `booking` với `access_control`, `auto_approval`, `room_management`, `schedule_maintenance`, `smart_lock`;
- `access_control` với `smart_lock`;
- `room_management` với `schedule_maintenance`.

Nguyên nhân chủ yếu là các module import thẳng vào tệp nội bộ của nhau thay vì qua `index.ts`.

### 12. C4 L3 – Component (Server)

Ảnh: `figures/12_c4_l3_component_server.png`

Mọi yêu cầu đi qua `SessionAuthFilter` (đọc token Bearer, tra `auth_sessions`, trả 401 nếu không hợp
lệ; trừ đăng nhập, đăng ký, đặt lại mật khẩu). Sáu controller (`Accounts`, `Rooms`, `Bookings`,
`Maintenance`, `Access`, `Notifications`) đều gọi chung `BookingService` – lớp chứa toàn bộ nghiệp vụ,
khoảng 1.700 dòng. `ApiExceptionHandler` chuyển ngoại lệ thành lỗi 400/401/403; `Domain` gồm 11 entity
JPA; `DataSeeder` tạo dữ liệu mẫu. Hướng tái cấu trúc là tách `BookingService` và `Domain` theo feature.

### 13. UML Component Diagram

Ảnh: `figures/13_uml_component_diagram.png`

Sơ đồ thành phần nhấn mạnh giao diện: vòng tròn (lollipop) là giao diện được cung cấp, mũi tên nét
đứt «use» là giao diện được sử dụng.

- Phía app: Repository API (`index.ts`), IJsonStorage, OneIoT bridge, INotification.
- Giữa app và server: IRestApi (`/api/*`, JSON, Bearer).
- Phía server: IBookingService, JDBC.
- OneIoT broker cung cấp MQTT TLS cổng 2111.

### 14. Deployment Diagram

Ảnh: `figures/14_deployment_diagram.png`

- **Điện thoại Android**: `app-release.apk` (JS bundle chạy trên Hermes), native module OneIoTMqtt và
  PriorityNotification, AsyncStorage. Token OneIoT chỉ giữ trong RAM.
- **Máy chủ / máy dev**: `booking-server.jar` trên JVM 17 (cổng 8080), tệp H2, tiến trình
  `cloudflared` tạo đường hầm; H2 SSL từ xa là tùy chọn.
- **IoT**: OneIoT kết nối với SmartLock thật hoặc trình giả lập.

Hai rủi ro thể hiện trên sơ đồ: H2 console đang bật nên có thể truy cập qua đường hầm công khai, và
URL đường hầm là URL tạm, ghi cứng trong mã nguồn ứng dụng.

---

## C. Thiết kế chi tiết

### 15a. Sequence – Đăng nhập

Ảnh: `figures/15a_sequence_dang_nhap.png`

LoginScreen gọi `authenticate()`; repository gửi `POST /api/auth/login`. Đường dẫn công khai nên
`SessionAuthFilter` cho qua; `BookingService.login()` tạo `AuthSession` và trả về token cùng vai trò.
API client lưu token trong bộ nhớ (`setApiToken`) để gắn vào các yêu cầu sau; ứng dụng chuyển sang
dashboard.

### 15b. Sequence – Tạo yêu cầu đặt phòng

Ảnh: `figures/15b_sequence_tao_yeu_cau_dat_phong.png`

`POST /api/bookings` mang token Bearer; filter gọi `requireAccount()` để xác định người gọi rồi chuyển
tới controller. `BookingService.createBooking()` chạy `validateBooking()` cho từng lượt. Khối *alt*
thể hiện hai nhánh: tự duyệt (lưu `APPROVED` kèm quyền PIN) hoặc chờ duyệt (lưu `PENDING` và báo
Quản trị viên). Kết quả `BookingResult` trả về ứng dụng.

### 15c. Sequence – Admin duyệt

Ảnh: `figures/15c_sequence_admin_duyet.png`

Quản trị viên bấm duyệt/từ chối trên AdminBookingScreen; ứng dụng gọi `POST /api/bookings/{id}/review`.
`reviewBooking()` kiểm tra lại xung đột, cập nhật trạng thái và cấp quyền PIN nếu là phòng khóa số.

### 16a. Sequence – Tạo PIN tạm

Ảnh: `figures/16a_sequence_tao_pin_tam.png`

`temporaryPinService` kiểm tra điều kiện (đã duyệt, phòng khóa số, còn quyền, chưa kết thúc), sinh mã
7 số, xin `passwordId` qua `reserve-password-id` và lưu PIN lên server. Khối *alt*:

- OneIoT đã kết nối: module Kotlin `OneIoTMqtt` mã hóa mật khẩu, đóng gói oneM2M, `PUBLISH` lên broker;
  broker chuyển lệnh `traitCreateTmpPasswordLock` tới khóa. Ứng dụng không chờ phản hồi từ khóa, chỉ
  đánh dấu đã gửi.
- Chưa kết nối: mã ở trạng thái chờ gửi.

### 16b. Sequence – Check-in SmartLock

Ảnh: `figures/16b_sequence_check_in_smartlock.png`

Người dùng nhập PIN; khóa phát `traitUnlockTempPwd` lên OneIoT; broker chuyển bản tin MQTT về
`OneIoTMqtt`; `smartLockAccessEventService` chuyển *trait* thành `CHECK_IN` hoặc `CHECK_OUT` rồi gọi
`POST /api/bookings/access-event`. Server khớp sự kiện với lượt đặt đã duyệt trong khoảng `pinGrace`
và ghi thời điểm vào/ra.

### 17. ER Diagram

Ảnh: `figures/17_er_diagram.png`

11 bảng do Hibernate sinh từ `Domain.java`:

| Bảng | Nội dung |
|------|----------|
| `accounts` | Tài khoản, vai trò, trạng thái hoạt động |
| `user_profiles` | Hồ sơ cá nhân (1–0..1 với tài khoản) |
| `auth_sessions` | Token phiên đăng nhập |
| `rooms` | Tầng, sức chứa, thiết bị, loại khóa, cờ phòng đặc biệt |
| `bookings` | Lượt đặt phòng, PIN tạm (nhúng), thông tin nhận khóa, sự kiện ra vào |
| `pin_permissions` | Quyền tự tạo PIN theo (người dùng, phòng) |
| `managed_smart_locks` | Khóa được quản lý và phòng được gắn |
| `maintenance_records` | Lịch bảo trì |
| `maintenance_requests` | Yêu cầu bảo trì từ người dùng |
| `notifications` | Thông báo theo tài khoản |
| `app_configuration` | Một bản ghi cấu hình quy định |

Quan hệ là logic qua khóa chuỗi, không có khóa ngoại. Thỏa thuận nhận khóa, người được ủy quyền,
lịch sử đổi phòng và sự kiện SmartLock lưu dạng JSON trong `bookings`. Chuỗi đặt lặp tuần không có
bảng riêng, các lượt được gom bằng `recurring_series_id`.

### 18a. State – Booking

Ảnh: `figures/18a_state_booking.png`

Lượt đặt bắt đầu ở `PENDING` (cần duyệt) hoặc trực tiếp `APPROVED` (tự duyệt).

- `PENDING` → `APPROVED` (Admin duyệt), `REJECTED` (Admin từ chối), `CANCELLED` (User hủy).
- `APPROVED` → `CANCELLED` (hủy trước hạn, mặc định 30 phút trước giờ bắt đầu; PIN bị thu hồi),
  `NO_SHOW` (Admin ghi nhận vắng mặt), hoặc kết thúc khi hết giờ.
- Bên trong `APPROVED`: chờ sử dụng → đã check-in → đã check-out.

Đổi phòng không làm thay đổi trạng thái.

### 18b. State – Mã PIN tạm

Ảnh: `figures/18b_state_ma_pin_tam.png`

Chưa có mã → đã tạo, chờ gửi → đã gửi tới khóa. Gửi lỗi chuyển sang *Lỗi gửi* và có thể thử lại.
Mã bị thu hồi khi lượt đặt bị hủy và hết hạn sau `validUntil`.

### 18c. State – Nhận khóa & bảo trì

Ảnh: `figures/18c_state_nhan_khoa_bao_tri.png`

- **Thỏa thuận nhận khóa** (phòng khóa cơ): `WAITING_ADMIN` và `WAITING_USER` luân phiên theo lượt đề
  xuất; bên đang được chờ đồng ý thì chuyển `AGREED`. Quản trị viên có thể hẹn trực tiếp để vào ngay
  `AGREED`.
- **Yêu cầu bảo trì**: `PENDING` → `SCHEDULED` (Admin lên lịch) hoặc `REJECTED` (Admin từ chối).
- **Trạng thái phòng**: `AVAILABLE` ↔ `MAINTENANCE` khi Quản trị viên tạm khóa hoặc mở lại.

### 19. API Specification

Ảnh: `figures/19_api_specification.png`

Bảng 51 endpoint REST dưới tiền tố `/api`, gồm nhóm, phương thức, đường dẫn, quyền, body và kết quả.
Dữ liệu dạng JSON; mọi yêu cầu cần header `Authorization: Bearer <token>`, trừ đăng nhập, đăng ký và
đặt lại mật khẩu. Lỗi trả về `{message}` với mã 400, 401 hoặc 403.

| Nhóm | Số endpoint |
|------|-------------|
| Auth, Accounts, Profile | 10 |
| Rooms, Config | 6 |
| Bookings, Pickup | 15 |
| Access (quyền PIN, check-in) | 6 |
| SmartLock | 4 |
| Maintenance | 7 |
| Notifications | 3 |

23 endpoint chỉ dành cho Quản trị viên, 12 endpoint mở cho mọi tài khoản đã đăng nhập; số còn lại
giới hạn cho chủ sở hữu dữ liệu hoặc theo ngữ cảnh.

### 20a. Threat Model – DFD

Ảnh: `figures/20a_threat_model_dfd.png`

Sơ đồ luồng dữ liệu mức 1 chia hệ thống thành bốn vùng tin cậy (nét đứt đỏ): thiết bị Android
(không tin cậy), Internet/đường hầm, máy chủ, đám mây IoT. Các tiến trình: P1 Mobile App, P2 OneIoTMqtt,
P3 Xác thực, P4 Đặt phòng, P5 Quyền & PIN, P6 Phòng/bảo trì/thông báo; các kho dữ liệu D1–D7. Luồng đỏ
cho thấy `/h2-console` truy cập được qua đường hầm mà không qua bộ lọc xác thực.

### 20b. Threat Model – STRIDE

Ảnh: `figures/20b_threat_model_stride.png`

Chín mối đe dọa rút ra từ mã nguồn, phân loại theo STRIDE:

| # | Mối đe dọa | Biện pháp | Mức |
|---|-----------|-----------|-----|
| T1 | Mật khẩu lưu dạng rõ | Băm BCrypt / Argon2 | Cao |
| T2 | H2 console công khai, không qua filter | Tắt ở môi trường thật | Cao |
| T3 | Không giới hạn số lần đăng nhập; mã khôi phục mặc định | Rate-limit; mã ngẫu nhiên | Cao |
| T4 | Token phiên không hết hạn | Thêm hạn, logout phía server | TB |
| T5 | Ứng dụng tự báo check-in, có thể giả mạo | Server xác thực sự kiện | TB |
| T6 | PIN lưu dạng rõ (server và thiết bị) | Lưu hash; mã hóa cục bộ | TB |
| T7 | URL đường hầm tạm, ghi cứng trong code | Tên miền cố định | TB |
| T8 | Dùng chung device ID với công cụ thử | Device ID riêng | Thấp |
| T9 | Chế độ cục bộ chỉ kiểm tra quy tắc ở client | Chỉ dùng để trình diễn | Thấp |

### 21. Chi tiết module App

Ảnh: `figures/21_chi_tiet_module_app.png`

Danh sách tệp chính của 11 module trong `src/modules`. Mọi module theo cùng một khuôn:

- `model/`: kiểu dữ liệu, không chứa logic;
- `services/`: đọc/ghi dữ liệu và quy tắc nghiệp vụ, mỗi hàm rẽ nhánh REST hoặc cục bộ;
- `screens/`, `components/`: giao diện React;
- `index.ts`: hàm và kiểu được công khai cho module khác.

Hạ tầng dùng chung nằm trong `src/core`; component giao diện dùng lại nằm trong `src/shared`.
