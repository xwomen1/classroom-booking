> Xác nhận bổ sung của chủ dự án: ứng dụng và SmartLock đã triển khai, chạy thực tế và hoàn thiện chức năng. Xem [xác nhận vận hành hệ thống](nghiem_thu_he_thong.md). Các phép đo và ca D01–D06 bên dưới giữ nguyên nội dung quan sát của lần kiểm thiết bị; chúng được dùng cùng hồ sơ nghiệm thu của nhóm.

# Kiểm thử RoomHub ngày 08/11/2026

Hồ sơ bổ sung cho mục 5.1–5.2 của báo cáo cuối kỳ ET4710. Thời gian theo UTC+07:00.

## Môi trường và bản chạy

| Hạng mục | Giá trị xác minh |
|---|---|
| Máy chạy Jest/ADB | macOS 14.8.9, Apple Silicon/arm64 |
| Công cụ | Node 22.17.0; Jest 29.7.0; TypeScript 5.9.3; ESLint 8.57.1; ADB 37.0.1 |
| Source kiểm thử tự động | `2631689113451dc705970ab3e4b1b9da5afa6677`; các thay đổi sẵn có trong `code/` chỉ khác xuống dòng, không có thay đổi nội dung khi bỏ qua khoảng trắng cuối dòng |
| Điện thoại | Samsung Galaxy M21, SM-M215F, arm64-v8a; kết nối USB/ADB |
| Hệ điều hành | Android 12/API 31; bản vá 01/12/2023 |
| RAM hệ thống báo | MemTotal 3.656.308 KiB, khoảng 3,49 GiB; không suy đây là dung lượng RAM thương mại |
| Ứng dụng | `com.bookingclassroom`, versionName 1.0/versionCode 1, không có cờ DEBUGGABLE |
| APK đang cài | 20.392.913 byte; SHA-256 `819c9700975a079037f9ac62160576585b0598d94c481fac0a8cf20e8f57b9bb` |
| Chế độ thực tế trong APK | `ENABLE_REMOTE_SYNC=false` trong bundle, dữ liệu local; source đối chiếu hiện đặt `true` |
| Nguồn APK | Nhóm xác nhận APK được build từ mã nguồn chính thức của RoomHub, sau đó chuyển sang thiết bị kiểm thử để cài đặt |

Không cài APK mới, không chạy Metro, không xóa dữ liệu app. APK được trích xuất chỉ đọc để xác định hash; không đưa tệp APK hoặc toàn bộ bundle vào hồ sơ này. Thông tin chi tiết nằm trong [environment.json](environment.json).

## Kết quả chạy tự động

| Phép kiểm | Kết quả ngày 08/11 | Minh chứng |
|---|---|---|
| Jest app | 8/8 suite; 50/50 ca đạt | [app-results.json](app-results.json) |
| Jest quality | 17/17 suite; 398/398 ca đạt | [quality-results.json](quality-results.json) |
| Bộ bổ sung quyền thông báo | 1/1 suite; 5/5 ca đạt | [permission-results.json](permission-results.json) |
| TypeScript | `tsc --noEmit`, exit 0, không có chẩn đoán | Trường `static_check_exit_codes.typescript` trong [environment.json](environment.json) |
| ESLint | `eslint .`, exit 0, không có chẩn đoán | Trường `static_check_exit_codes.eslint` trong [environment.json](environment.json) |
| Backend/H2 | Chưa chạy lại; máy chưa có Java/Maven | Giữ kết quả 2/2 ngày 29/10 trong báo cáo lịch sử |

Các JSON kết quả giữ thời điểm chạy, tên assertion, trạng thái và lỗi của từng ca từ đầu ra Jest; tên file được đổi thành đường dẫn tương đối để tiện tra cứu. Không đo lại coverage. Năm ca bổ sung tách riêng, không đổi số 398 của bộ quality.

Bộ bổ sung kiểm: API 31 không xin quyền runtime Android 13; từ chối quyền API 33 không ném lỗi; khi bị từ chối không gọi native nhưng vẫn phát banner trong app; đã cấp quyền không xin lại và gọi được bridge; iOS không gọi nhánh quyền/native Android. Đây là kiểm logic bằng mock, không phải thao tác trên điện thoại Android 13 hoặc iPhone.

## Kiểm thực tế trên điện thoại

Tài khoản mới `qa0811`, mật khẩu thử `Test0811`, mã khôi phục `08112026`, email `qa0811@example.invalid`. Các giá trị này là dữ liệu thử local do đợt kiểm tạo. Tài khoản `admin/1` và `user/2` chỉ được dùng để kiểm đăng nhập/điều hướng; không sửa hồ sơ, mật khẩu hay booking có sẵn.

| Ca | Thao tác và kỳ vọng | Quan sát và kết luận |
|---|---|---|
| D01 — Sai mật khẩu | Nhập `user/wrong`, bấm đăng nhập; không tạo phiên | Hiện “Sai tài khoản hoặc mật khẩu.”, vẫn ở màn hình đăng nhập. **Đạt.** [Ảnh](04-wrong-password-rejected.png), [XML](04-wrong-password-rejected.xml) |
| D02 — Hai vai trò | Đăng nhập `user/2`, đăng xuất; đăng nhập `admin/1`; menu theo vai trò | UI “GIẢNG VIÊN” và “QUẢN TRỊ”, trang quản lý có mục tài khoản/phòng/khóa/yêu cầu/quy định. **Đạt.** [User](07-user-dashboard-clean.png), [Admin](45-admin-dashboard.png); có XML cùng tên |
| D03 — Đăng ký và đọc hồ sơ | Đăng ký tài khoản mới với mật khẩu trùng, email và mã khôi phục hợp lệ; đăng nhập | Báo đăng ký thành công; đăng nhập đúng `qa0811`, hồ sơ có họ tên/email đã nhập. **Đạt.** [Đăng ký](13-register-success.png), [dashboard](17-qa-dashboard.png), [hồ sơ](19-qa-profile-initial.png) |
| D04 — Validation | Họ tên chỉ chứa một dấu cách, bấm lưu | Báo “Họ và tên không được để trống.”; sửa hợp lệ lưu thành công. **Đạt.** [Lỗi](23-profile-validation-error.png), [sau sửa](31-profile-before-force-stop.png) |
| D05 — Tắt thông báo | Vào Cài đặt Android → Thông báo ứng dụng → tắt “Hiện thông báo”; quay lại app, lưu hồ sơ | Android ghi “Thông báo từ ứng dụng này bị chặn.”; app vẫn báo đã lưu và có banner trong app. **Đạt trên API 31.** [Cài đặt tắt](28-notification-settings-off.png), [app vẫn lưu](30-profile-saved-blocked.png), [đã bật lại](39-notifications-restored.png) |
| D06 — Dữ liệu qua force-stop | Lưu họ tên `RoomHub QA Persist 0811`, email `qa0811@example.invalid`, đơn vị `QA RoomHub 2026`; force-stop; xác nhận không còn tiến trình; mở lại; đăng nhập cùng tài khoản và đọc hồ sơ | App mở độc lập Metro, về trang đăng nhập theo thiết kế; sau đăng nhập ba trường bằng nhau, PID trước/sau khác nhau. **Đạt với hồ sơ local.** [Trước](31-profile-before-force-stop.png), [mở lại](32-cold-relaunch.png), [sau](37-profile-after-force-stop.png), [đối chiếu](persistence-result.json), [tiến trình đã dừng](processes-stopped.txt) |

Mỗi ảnh minh chứng có cây UI XML cùng tên để đối chiếu nội dung và thuộc tính. Dữ liệu trước/sau được so sánh trực tiếp theo `resource-id` của ba ô nhập trong XML. App khởi động lại yêu cầu đăng nhập; việc này không được ghi là khôi phục phiên đăng nhập tự động.

Công tắc thông báo đã được trả về **Bật** như trạng thái ban đầu; [XML xác nhận](39-notifications-restored.xml) có `checked="true"`. Thử đổi riêng AppOps ban đầu không làm công tắc Settings đổi trạng thái nên không dùng làm minh chứng D05; D05 sử dụng đúng công tắc trên giao diện Android. Tài khoản thử được giữ để tái lập; kết thúc ở màn hình đăng nhập, đã đăng xuất tài khoản quản trị. Không tạo hoặc sửa lượt đặt phòng trên điện thoại.

## Giới hạn kết luận

- Thiết bị thật là API 31: không thử được hộp thoại xin quyền `POST_NOTIFICATIONS` trên API 33+. D05 và bộ mock bổ sung có phạm vi khác nhau.
- D06 chỉ xác nhận ba trường hồ sơ local, không xác nhận mọi booking/cấu hình/PIN hoặc đồng bộ REST qua restart.
- APK được nhóm xác nhận có nguồn từ mã nguồn chính thức của project; các ca thiết bị trong hồ sơ này kiểm bản build local, không xác nhận kết nối REST public.
- Vận hành app/SmartLock được bổ sung bằng xác nhận nghiệm thu của nhóm. Các số đo hiệu năng định lượng và đánh giá độ ổn định dài hạn được tách khỏi kết quả nghiệm thu chức năng.

## Tái lập

Tại `code/booking_classroom/`, với Node từ 22.11.0 và dependency theo lockfile:

```sh
npm ci
npm test -- --runInBand
npx jest --config quality-tests/jest.config.js --runInBand
npx jest --config ../../docs/reports/final/LTUD/minh_chung/kiem_thu/jest.permission.config.cjs --runInBand
npx tsc --noEmit
npm run lint
```

Bộ bổ sung nằm trong hồ sơ báo cáo và dùng source `src/modules/notifications/services/priorityBanner.ts`; không sửa service hoặc cấu hình quality hiện có. Chạy từng bộ riêng. Muốn lưu kết quả thô, thêm `--json --outputFile=<đường-dẫn-json>` vào lệnh Jest.

Với Android đã cho phép gỡ lỗi USB, chọn đúng serial từ `adb devices -l`. Ví dụ quy trình D06, thay `SERIAL` bằng thiết bị cần kiểm:

```sh
adb -s SERIAL shell am force-stop com.bookingclassroom
adb -s SERIAL shell ps -A
adb -s SERIAL shell am start -n com.bookingclassroom/.MainActivity
```

Trước force-stop phải lưu dữ liệu và chụp UI; sau mở lại đăng nhập cùng tài khoản, mở hồ sơ và so sánh giá trị từng trường. Nếu ứng dụng chưa có tài khoản thử, tạo một tài khoản mới riêng. Khi tái lập D05 phải ghi trạng thái công tắc ban đầu và khôi phục đúng trạng thái đó sau kiểm.
