# Báo cáo kiểm thử RoomHub – nhánh feature/auto-approval

Người thực hiện: DungFS · Ngày: 25/10/2026 · Cập nhật: 29/10/2026

## Tổng quan

Tôi đã xây dựng một bộ kiểm thử độc lập cho ứng dụng React Native `code/booking_classroom`, đặt trong thư mục riêng `quality-tests/`, gồm 3 nhóm: unit, component và integration. Ở lần chạy lại ngày 29/10/2026 trên nhánh `feature/auto-approval` (đã gộp nhánh refactor và nhánh `tunghv-final-task`), toàn bộ 398 test đều đạt (398/398) và bộ test phủ 68,8% số dòng code trong `src/`. Cả 2 lỗi mà bộ test phát hiện ở lần chạy đầu (25/10) đều đã được sửa.

| Mục | Giá trị |
| --- | --- |
| Repository | [xwomen1/classroom-booking](https://github.com/xwomen1/classroom-booking) |
| Nhánh | [feature/auto-approval](https://github.com/xwomen1/classroom-booking/tree/feature/auto-approval) (bộ test được tạo ở nhánh `test/quality-suite`) |
| Thư mục | `code/booking_classroom/quality-tests/` (cấu hình Jest, mock và helper riêng) |
| Công cụ | Jest 29 + `@react-native/jest-preset`, `react-test-renderer` 19.2.3 |
| Số test | 398 test trong 17 file |
| Kết quả | 17/17 suite, 398/398 test đạt |
| Kiểm tra tĩnh | `eslint` 0 lỗi, `tsc --noEmit` 0 lỗi |

Kết quả theo nhóm:

| Nhóm | File | Test | Đạt | Còn `test.failing` |
| --- | --- | --- | --- | --- |
| 1. Unit – logic nghiệp vụ | 10 | 259 | 259 | 0 |
| 2. Component – giao diện | 4 | 58 | 58 | 0 |
| 3. Integration – tích hợp | 3 | 81 | 81 | 0 |
| **Tổng** | **17** | **398** | **398** | **0** |

Thay đổi so với lần chạy 25/10/2026 (392 test):

| Thay đổi | Chi tiết |
| --- | --- |
| +6 test | Ghi nhận tình trạng phòng (`reportRoomObservation`): 2 unit, 1 component, 2 integration; banner thông báo chỉ hiện cho tài khoản đang đăng nhập: 1 unit |
| 2 lỗi đã sửa | 2 test `test.failing` đã chuyển thành `test` thường và đều đạt (xem mục "Lỗi phát hiện và lưu ý") |
| Màn hình đăng nhập | Không còn hiển thị tài khoản dùng thử; test được đổi sang kiểm tra điều này |
| Hợp đồng API | Server tách `ApiController.java` thành 6 controller theo tính năng; test đọc toàn bộ `server/api/*/…Controller.java` |
| Cấu hình | Bổ sung trường `autoApprovalEnabled` của module tự động duyệt vào dữ liệu test |

Cách chạy, trong thư mục `code/booking_classroom`:

```
npm ci
npx jest --config quality-tests/jest.config.js                            # toàn bộ
npx jest --config quality-tests/jest.config.js quality-tests/unit         # nhóm 1
npx jest --config quality-tests/jest.config.js quality-tests/component    # nhóm 2
npx jest --config quality-tests/jest.config.js quality-tests/integration  # nhóm 3
npx jest --config quality-tests/jest.config.js --coverage                 # kèm độ phủ
```

Quy ước chung: thời gian được cố định ở Thứ Năm 2030-01-10 08:00 (giờ máy) để các luật theo ngày giờ cho kết quả ổn định; Async Storage được thay bằng kho trong bộ nhớ và xóa sạch trước mỗi test.

## Nhóm 1 – Unit test (logic nghiệp vụ)

Cả 259 test unit trong 10 file đều đạt. Nhóm này gọi trực tiếp các hàm service/model, không qua giao diện, để kiểm tra từng luật nghiệp vụ và các ca biên. Thư mục: `quality-tests/unit/`.

| File test | Function được test | Các ca kiểm thử chính | Số test | Kết quả |
| --- | --- | --- | --- | --- |
| `bookingRules.quality.ts` | `createBooking`, `getBookings`, `getBookingsForUser`, `getRoomOccupancy`, `getBookingTimeCategory`, `isBookingStillActive`, `toLocalDateTime`, `meetsReplacementRoomRequirements` | Sai định dạng ngày/giờ, ngày không tồn tại (30/02), giờ bắt đầu ≥ kết thúc; cửa sổ đặt trước 0/1/2/3/4 ngày và qua ranh giới tháng; hai lượt liền kề không bị tính là trùng, 4 kiểu chồng lấn bị chặn; trùng lịch cá nhân; giới hạn 2 yêu cầu đang hoạt động; phòng bảo trì/không tồn tại; admin không được đặt; số tuần lặp không hợp lệ, giới hạn 8 tuần, lặp qua năm mới, chuỗi bị từ chối trọn gói khi một tuần trùng | 48 | 48/48 đạt |
| `bookingLifecycle.quality.ts` | `reviewBooking`, `reviewRecurringSeries`, `cancelBooking`, `updatePendingRecurringBookings`, `cancelFutureRecurringBookings`, `changeBookingRoom`, `setPickupDelegate`, `scheduleKeyPickup`, `proposeKeyPickup`, `acceptKeyPickupProposal`, `confirmBookingCheckIn`, `confirmBookingNoShow`, `recordSmartLockAccessEvent`, `reportRoomObservation` | Chỉ admin được duyệt; không duyệt lượt đã hết giờ, trùng bảo trì hoặc trùng lượt đã duyệt; duyệt phòng PIN thì cấp quyền tạo mã; hạn hủy 30 phút (đúng ngưỡng vẫn hủy được); hủy thì thu hồi PIN; đổi phòng sai loại khóa, thiếu sức chứa, thiếu thiết bị, quá hạn; thương lượng nhận khóa theo lượt; check-in thủ công chỉ trong giờ dùng; vắng mặt đúng ngưỡng 15 phút; sự kiện SmartLock ngoài khung ±10 phút bị bỏ qua; ghi nhận tình trạng phòng gửi cho admin mà không tạo yêu cầu bảo trì, bắt buộc có nội dung, đúng người đặt và lượt đã duyệt đang trong giờ dùng | 40 | 40/40 đạt |
| `accountRepository.quality.ts` | `getAccounts`, `authenticate`, `registerAccount`, `assertAccountRole`, `createManagedAccount`, `updateManagedAccount`, `deleteManagedAccount`, `resetPasswordWithRecoveryCode`, `changePassword` | Khởi tạo 2 tài khoản demo, bổ sung dữ liệu cũ; chuẩn hóa tên đăng nhập; tài khoản bị khóa không đăng nhập được; 7 ca tên/mật khẩu/mã khôi phục sai; admin không tự khóa/tự xóa; không xóa tài khoản còn booking đang hoạt động; đặt lại và đổi mật khẩu | 21 | 21/21 đạt |
| `configurationAndProfile.quality.ts` | `getConfiguration`, `saveConfiguration`, `getProfile`, `saveProfile` | Giá trị mặc định và gộp dữ liệu thiếu; 21 ca số âm/số thập phân/NaN; tối thiểu > tối đa; giới hạn 0 yêu cầu; chỉ admin được lưu; hồ sơ mặc định theo vai trò, lưu riêng từng người | 28 | 28/28 đạt |
| `roomRepository.quality.ts` | `getRooms`, `getRoomById`, `createRoom`, `updateRoom`, `deleteRoom`, `searchRooms`, các hàm trong `roomFilters` (`roomMeetsMinCapacity`, `roomHasAllEquipment`, `toggleEquipment`, `equipmentChoices`, `floorMapSlot`, `matchesRoomQuery`…) | 56 phòng demo (8 tầng × 7); suy ra tầng từ địa chỉ với dữ liệu cũ; chuẩn hóa tên/thiết bị; 7 ca dữ liệu phòng sai; trùng tên; không xóa phòng còn booking; phòng demo đã xóa không xuất hiện lại; lọc kết hợp tầng + sức chứa + thiết bị + loại khóa | 25 | 25/25 đạt |
| `maintenanceRepository.quality.ts` | `periodsOverlap`, `hasMaintenanceConflict`, `createMaintenance`, `cancelMaintenance`, `requestRoomMaintenance`, `rejectMaintenanceRequest`, `scheduleMaintenanceFromRequest`, `getMaintenanceRecords`, `getMaintenanceRequests` | Ranh giới chồng lấn; lịch bảo trì đã hủy không chặn; không bảo trì đè lượt đã duyệt; chỉ người đang dùng phòng được báo sự cố, mỗi lượt 1 yêu cầu chờ; lên lịch phải đúng phòng | 14 | 14/14 đạt |
| `notifications.quality.ts` | `getNotifications`, `addNotification`, `markAllNotificationsRead`, `getUnreadCount`, `presentPriorityNotification`, `subscribePriorityBanners`, `subscribePriorityBannerOpen`, `openPriorityBanner`, `getNotificationTone` | Thông báo chào mừng tạo 1 lần; thêm mới lên đầu, tự gán màu; tắt thông báo thì không lưu; tách theo người dùng; banner chỉ hiện cho tài khoản đang đăng nhập; banner lỗi không làm mất thông báo; 10 ca phân loại màu tích cực/tiêu cực/cần xem/trung tính | 19 | 19/19 đạt |
| `accessControl.quality.ts` | `grantRoomPinPermission`, `revokeRoomPinPermission`, `hasRoomPinPermission`, `getRoomPinPermissions`, `grantUserPinPermission`, `createTemporaryPin`, `getPinDisplayStatus` | Chỉ cấp quyền cho phòng khóa số; cấp lại dùng lại bản ghi; quyền tách theo người + phòng; 7 ca không được tạo PIN; PIN đúng 7 chữ số, hiệu lực từ giờ bắt đầu − đệm đến giờ kết thúc + đệm; không tạo 2 PIN; số thứ tự mật khẩu quay vòng 255 → 1; trạng thái Chờ/Hiệu lực/Hết hạn/Thu hồi | 17 | 17/17 đạt |
| `smartLock.quality.ts` | `getManagedSmartLock`, `assignSmartLockToRoom`, `unassignSmartLock`, `getSmartLockForRoom`, `reserveSmartLockPasswordId`, `parseSmartLockAccessEvent`, `handleOneIoTSmartLockMessage` | Khởi tạo khóa mặc định, chuyển đổi ID cũ; chỉ gắn vào phòng khóa số; 8 trait mở khóa = check-in, 6 trait khóa = check-out; bóc vỏ oneM2M và JSON lồng nhiều lớp; timestamp giây/mili giây/ISO; 5 ca bản tin rác; bỏ qua thiết bị lạ | 34 | 34/34 đạt |
| `apiClient.quality.ts` | `apiRequest`, `setApiToken`, `clearApiSession`, `isRemoteApiEnabled` | Ghép URL; header JSON và Bearer token; HTTP 204, body rỗng; thông báo lỗi từ server; HTTP 401 xóa phiên; JSON hỏng; mất mạng; timeout 12 giây | 13 | 13/13 đạt |
| **Tổng** | | | **259** | **259/259 đạt** |

## Nhóm 2 – Component test (giao diện)

Cả 58 test giao diện trong 4 file đều đạt. Màn hình được render bằng `react-test-renderer`; test nhập liệu, bấm nút như người dùng, rồi kiểm tra cả nội dung hiển thị lẫn dữ liệu đã lưu. Thư mục: `quality-tests/component/`.

| File test | Màn hình / component | Hành vi được test | Số test | Kết quả |
| --- | --- | --- | --- | --- |
| `authScreens.quality.tsx` | `LoginScreen` | Báo lỗi khi thiếu trường hoặc sai mật khẩu; đăng nhập admin và user (kể cả tên có khoảng trắng/chữ hoa) trả đúng vai trò; chuyển sang Đăng ký/Quên mật khẩu và quay lại; không để lộ tài khoản dùng thử trên màn hình | 6 | 6/6 đạt |
| | `RegistrationScreen` | 6 ca lỗi (thiếu trường, email sai, mật khẩu ngắn, mã khôi phục ngắn, nhập lại không khớp, tên đã tồn tại); đăng ký thành công tạo tài khoản + hồ sơ + thông báo; đăng ký được khi bỏ trống mã khôi phục | 8 | 8/8 đạt |
| | `ChangePasswordScreen` | 4 ca lỗi (thiếu, ngắn, không khớp, sai mật khẩu hiện tại); đổi thành công và xóa form; nút quay lại | 6 | 6/6 đạt |
| | `ForgotPasswordScreen` | Mật khẩu không khớp; sai mã khôi phục; đặt lại thành công và đăng nhập được bằng mật khẩu mới | 3 | 3/3 đạt |
| `profileAndConfigurationScreens.quality.tsx` | `ProfileScreen` | Tải hồ sơ đã lưu; bắt buộc họ tên, kiểm tra email; cắt khoảng trắng khi lưu; avatar lấy chữ cái đầu | 4 | 4/4 đạt |
| | `ConfigurationScreen` | Hiển thị cấu hình đã lưu; tự loại ký tự không phải số; báo lỗi "tối thiểu > tối đa" và không lưu; user thường bị từ chối; lưu số và công tắc thông báo | 5 | 5/5 đạt |
| `accountManagementScreen.quality.tsx` | `AccountManagementScreen` | Chỉ liệt kê tài khoản user; thêm giảng viên (có báo lỗi); tìm theo tên; khóa/mở khóa; đặt mật khẩu 1234; xóa tài khoản; hiển thị và thu hồi quyền tạo mã theo phòng | 7 | 7/7 đạt |
| `bookingComponents.quality.tsx` | `BookingTimePicker`, `TIME_OPTIONS`, `buildDateOptions` | Khung giờ 07:00–21:00 mỗi 30 phút; danh sách ngày đúng cửa sổ; hiển thị dd/mm và dòng tóm tắt; cột giờ kết thúc chỉ có giờ sau giờ bắt đầu; chọn giờ bắt đầu ≥ giờ kết thúc thì tự đẩy giờ kết thúc lên 30 phút | 7 | 7/7 đạt |
| | `PasswordInput` | iOS dùng ô mật khẩu gốc; Android hiện dấu • và xử lý 5 kiểu sửa (thêm, xóa, xóa hết, dán, chèn giữa) | 7 | 7/7 đạt |
| | `MyBookingsScreen` | Chỉ hiện booking của mình, đúng nhãn nút theo trạng thái; rút yêu cầu; tạo mật khẩu tạm (mã ẩn mặc định, báo chờ OneIoT); hủy chuỗi phải xác nhận qua hộp thoại; gửi ghi nhận tình trạng phòng mà không tạo yêu cầu bảo trì | 5 | 5/5 đạt |
| **Tổng** | | | **58** | **58/58 đạt** |

## Nhóm 3 – Integration test (tích hợp)

Cả 81 test tích hợp trong 3 file đều đạt. Đáng chú ý: cả 51 endpoint trong 6 controller của booking-server đều khớp với request app gửi đi, theo cả hai chiều. Thư mục: `quality-tests/integration/`.

### oneIoTNativeBridge.quality.ts – 11/11 đạt

Kiểm tra `oneIoTClient` nói chuyện đúng với native module Android `OneIoTMqtt`; module này được thay bằng mock nên không cần thiết bị thật.

| Function | Ca kiểm thử | Số test | Kết quả |
| --- | --- | --- | --- |
| `connectOneIoT` | Truyền broker, cổng, ID Tools, token đã cắt khoảng trắng; token rỗng bị chặn trước khi gọi native; bọc lỗi TLS; báo không hỗ trợ trên iOS hoặc khi thiếu module | 5 | 5/5 đạt |
| `getOneIoTConnectionStatus`, `disconnectOneIoT`, `sendTemporaryPasswordToOneIoT` | Chế độ test luôn offline và giả lập lệnh; trạng thái/ngắt kết nối đi qua native; lệnh `traitCreateTmpPasswordLock` gửi đúng thứ tự 9 tham số; bọc lỗi gửi | 4 | 4/4 đạt |
| `subscribeOneIoTSmartLockMessages` | Chuyển tiếp sự kiện MQTT tới listener và dừng khi hủy đăng ký; không làm gì trong môi trường test | 2 | 2/2 đạt |

### remoteApiContract.quality.ts – 62/62 đạt

Kiểm tra hợp đồng giữa app và booking-server khi bật `ENABLE_REMOTE_SYNC`. Test gọi 51 hàm service ở chế độ remote với `fetch` giả lập, ghi lại method + đường dẫn của mọi request, rồi đối chiếu với các `@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping` đọc trực tiếp từ các controller trong `booking-server/src/main/java/com/bookingclassroom/server/api/` (`access`, `auth`, `bookings`, `maintenance`, `notifications`, `rooms`).

| Nội dung | Function được test | Số test | Kết quả |
| --- | --- | --- | --- |
| Bề mặt API của server | Các controller khai báo ≥ 45 endpoint, tất cả nằm dưới `/api/` | 1 | Đạt (đọc được 51 endpoint) |
| Mỗi request của app có endpoint tương ứng | 51 hàm: xác thực và tài khoản (8), hồ sơ (2), phòng (4), cấu hình (2), bảo trì (7), booking (18), quyền PIN (3), thông báo (3), SmartLock (4) | 51 | 51/51 đạt |
| Mọi endpoint của server đều được app dùng | Không có endpoint thừa | 1 | Đạt (0 endpoint không dùng) |
| Phiên và dữ liệu gửi đi | `authenticate` lưu Bearer token cho request sau; sai mật khẩu trả `null`; `registerAccount` mở phiên; mã chuỗi được URL-encode; `createRoom` chuẩn hóa và kiểm tra trước khi gửi; ghi nhận tình trạng phòng gửi riêng tới `POST /api/bookings/{id}/room-observation`, không đi qua bảo trì; `updateBooking` từ chối ghi local; lỗi 409 của server hiển thị đúng thông báo | 9 | 9/9 đạt |

### endToEndWorkflows.quality.ts – 8/8 đạt

Các luồng nhiều bước đi qua đúng những service mà màn hình gọi; chỉ tầng MQTT của OneIoT được giả lập.

| Luồng | Các bước và điều kiểm tra | Kết quả |
| --- | --- | --- |
| Phòng khóa số trọn vòng | Đăng nhập → đặt phòng → admin duyệt → có quyền tạo mã → tạo PIN khi offline → kết nối OneIoT gửi đúng mã và khung giờ → không gửi lại lần hai → SmartLock báo mở/khóa ghi check-in/check-out → không thể đánh dấu vắng mặt | Đạt |
| Gửi PIN lỗi rồi gửi lại | Lần 1 báo `failed: 1` và lưu lỗi "MQTT timeout"; lần 2 gửi thành công, xóa lỗi | Đạt |
| Không gửi PIN không hợp lệ | Chưa kết nối thì báo lỗi; mã đã thu hồi bị bỏ qua; mã hết hạn đếm là `skipped` | Đạt |
| Thu hồi quyền phòng | Giảng viên không tự tạo mã được nữa và nhận thông báo thu hồi | Đạt |
| Đổi phòng khẩn cấp | PIN cũ bị thu hồi; có quyền ở phòng mới; phòng mới chưa gắn SmartLock nên không cấp mã; sự kiện mở khóa phòng cũ không còn khớp | Đạt |
| Phòng khóa cơ | Không cấp quyền PIN; user đề xuất giờ nhận khóa → admin đề xuất lại → user đồng ý; admin xác nhận có mặt | Đạt |
| Vắng mặt giải phóng khung giờ | Sau 15 phút ghi nhận vắng mặt; người khác đặt và được duyệt cùng khung giờ | Đạt |
| Báo sự cố → bảo trì | User báo sự cố khi đang dùng phòng → admin lên lịch → phòng bị chặn đặt trong giờ bảo trì; không thể bảo trì đè lượt đã duyệt | Đạt |

## Độ phủ code

Bộ test phủ 68,8% số dòng code trong `src/` (1.432/2.081 dòng, đo bằng `jest --coverage` với cấu hình `quality-tests/jest.config.js`). Trong 25 file mà bộ test nhắm tới, 22 file đạt từ 90% trở lên. 3 file dưới 90% là `priorityBanner.ts` (phần thông báo native Android), `MyBookingsScreen.tsx` (màn hình lớn, nhiều nhánh nhận khóa và ủy quyền) và `ConfigurationScreen.tsx`. Module tự động duyệt mới (`auto_approval`) và các màn hình quản trị phòng, SmartLock, duyệt booking chưa nằm trong phạm vi của bộ test.

| File | Độ phủ dòng (%) |
| --- | --- |
| `priorityBanner.ts` | 43,6 |
| `MyBookingsScreen.tsx` | 65,2 |
| `ConfigurationScreen.tsx` | 68,8 |
| `LoginScreen.tsx` | 91,4 |
| `temporaryPinService.ts` | 91,8 |
| `bookingRepository.ts` | 93,7 |
| `AccountManagementScreen.tsx` | 94,6 |
| `smartLockAccessEventService.ts` | 95,5 |
| `client.ts` | 96,4 |
| `oneIoTClient.ts` | 96,6 |
| `ProfileScreen.tsx` | 96,7 |
| `notificationRepository.ts` | 96,8 |
| `accountRepository.ts` | 98,2 |
| `BookingTimePicker.tsx` | 100 |
| `ChangePasswordScreen.tsx` | 100 |
| `configurationRepository.ts` | 100 |
| `ForgotPasswordScreen.tsx` | 100 |
| `maintenanceRepository.ts` | 100 |
| `PasswordInput.tsx` | 100 |
| `profileRepository.ts` | 100 |
| `RegistrationScreen.tsx` | 100 |
| `roomFilters.ts` | 100 |
| `roomPinPermissionRepository.ts` | 100 |
| `roomRepository.ts` | 100 |
| `smartLockRepository.ts` | 100 |

## Lỗi phát hiện và lưu ý

Ở lần chạy đầu (25/10/2026), bộ test của tôi phát hiện 2 lỗi thật trong code app, mỗi lỗi được ghi nhận bằng một test `test.failing`. Cả 2 lỗi đã được sửa; test tương ứng đã chuyển thành `test` thường và đạt ở lần chạy lại 29/10/2026.

| # | Lỗi | Vị trí code | Cách tái hiện | Test bảo vệ | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| 1 | Phòng demo đã xóa xuất hiện lại | `getRooms()` trong `room_management/services/roomRepository.ts` gộp lại mọi `DEMO_ROOMS` còn thiếu trong storage | Admin xóa phòng 101: storage còn 55 phòng, nhưng lần đọc sau `getRooms()` trả 56 phòng, có cả phòng 101 | `unit/roomRepository.quality.ts` – "a deleted demo room stays deleted" | Đã sửa |
| 2 | Không đăng ký được khi bỏ trống "Mã khôi phục", dù ô này ghi là không bắt buộc | `RegistrationScreen.tsx` gửi chuỗi rỗng `''`; `registerAccount` chỉ bỏ qua kiểm tra khi giá trị là `undefined` | Điền tên + mật khẩu, để trống mã khôi phục → báo "Mã khôi phục cần ít nhất 4 ký tự." | `component/authScreens.quality.tsx` – "registers without the optional recovery code" | Đã sửa |

Lưu ý về cấu hình: trên nhánh này, `ENABLE_REMOTE_SYNC = true` và trỏ tới một URL trycloudflare, trong khi README của app khuyên giữ `false` để chạy local. Test hợp đồng API (`remoteApiContract.quality.ts`) cần cờ này là `true`: nếu đổi thành `false` trên máy, 59 test của file đó sẽ báo lỗi vì app không gửi request nào.
