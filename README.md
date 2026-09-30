# Booking Classroom — Final Project

Thư mục này chứa tài liệu và source của một Booking App tích hợp cho đề tài đặt phòng học/phòng họp.

## Nội dung

- `du_an_dat_phong.tex/.pdf`: đề xuất dự án và phạm vi MVP.
- `workflow_booking_app.tex/.pdf`: kiến trúc, workflow và vòng đời booking.
- `hien_trang_trien_khai.tex/.pdf`: ghi nhận ngắn gọn những phần đã triển khai thực tế.
- `code/booking_classroom`: source React Native của ứng dụng.
- `code/booking-server`: source Java/Spring Boot được giữ lại cho giai đoạn đồng bộ sau; bản hiện tại đang tắt kết nối bằng cờ cấu hình.
- `tunghv3`: gateway HTTP--MQTT để app gửi lệnh tới một SmartLock OneIoT.
- `code/booking_classroom/src/modules`: các module nghiệp vụ để phân công riêng cho từng thành viên.

Danh sách module, phạm vi và ô người phụ trách được ghi tại [`code/booking_classroom/src/modules/README.md`](code/booking_classroom/src/modules/README.md).

## Clone và cài bản dùng ngay

```powershell
git clone https://github.com/xwomen1/classroom-booking.git
cd classroom-booking
adb devices -l
adb install -r .\code\booking_classroom\release\booking_classroom-v1.0.apk
```

Sau khi lệnh cài báo `Success`, có thể mở `booking_classroom` trên điện thoại. Bản Release không cần Metro, cáp USB hoặc booking server. Tài khoản, phòng và booking được lưu local trên điện thoại; riêng chức năng gửi mật khẩu xuống khóa cần máy chạy gateway `tunghv3`.

Công tắc đồng bộ nằm tại `code/booking_classroom/src/core/config/runtimeFlags.ts`. Giữ `ENABLE_REMOTE_SYNC = false` để chạy local; chỉ đổi thành `true` và sửa `REMOTE_API_BASE_URL` khi nhóm bắt đầu triển khai booking server.

Nếu không dùng ADB, gửi tệp `code/booking_classroom/release/booking_classroom-v1.0.apk` sang điện thoại, mở tệp và cho phép cài ứng dụng không rõ nguồn gốc khi Android yêu cầu.

Tài khoản demo:

- Quản trị viên: `admin` / `1`
- Người dùng: `user` / `2`

Ứng dụng có luồng hai vai trò: quản lý tài khoản, phòng, lịch bảo trì và cấu hình; tìm và đặt phòng; duyệt, từ chối, đổi phòng; lịch xem riêng với màn quản lý booking; hẹn/ủy quyền nhận khóa; tạo mật khẩu tạm thời và thông báo.

Bản hiện tại có chức năng gộp \"Tìm và đặt phòng\": sơ đồ chữ U cho tầng 1–8 hiển thị phòng trống/đã đặt/bảo trì theo khoảng thời gian; User chọn phòng, nhập mục đích và gửi yêu cầu ngay trên cùng màn hình. Khi Admin duyệt booking của phòng khóa số, User được cấp quyền tự tạo mật khẩu riêng cho đúng phòng đó; Admin có thể thu hồi quyền theo từng phòng trong Quản lý user.

Admin có thêm **Quản lý khóa** để gắn một SmartLock duy nhất vào một phòng khóa số. Chỉ booking của phòng đang gắn khóa mới được gửi `traitCreateTmpPasswordLock` qua gateway `tunghv3`.

## Dành cho thành viên phát triển

Hướng dẫn cài dependency, chạy Debug, xử lý lỗi ADB/Metro, build khi đường dẫn có ký tự tiếng Việt, kiểm tra source và sơ đồ module nằm tại [`code/booking_classroom/README.md`](code/booking_classroom/README.md).

Quy trình bắt đầu nhanh:

```powershell
cd code\booking_classroom
npm ci
npm start
```

Trong PowerShell khác:

```powershell
adb reverse tcp:8081 tcp:8081
npm run android
```

Bản Release hiện tại đã được kiểm tra độc lập trên Samsung M21 khi Metro không chạy và không có `adb reverse`.
