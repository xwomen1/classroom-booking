# Booking Classroom — Final Project

Thư mục này chứa tài liệu và source của một Booking App tích hợp cho đề tài đặt phòng học/phòng họp.

## Nội dung

- `du_an_dat_phong.tex/.pdf`: đề xuất dự án và phạm vi MVP.
- `workflow_booking_app.tex/.pdf`: kiến trúc, workflow và vòng đời booking.
- `hien_trang_trien_khai.tex/.pdf`: ghi nhận ngắn gọn những phần đã triển khai thực tế.
- `code/booking_classroom`: source React Native của ứng dụng.
- `code/booking_classroom/src/modules`: các module nghiệp vụ để phân công riêng cho từng thành viên.

Danh sách module, phạm vi và ô người phụ trách được ghi tại [`code/booking_classroom/src/modules/README.md`](code/booking_classroom/src/modules/README.md).

## Clone và cài bản dùng ngay

```powershell
git clone https://github.com/xwomen1/classroom-booking.git
cd classroom-booking
adb devices -l
adb install -r .\code\booking_classroom\release\booking_classroom-v1.0.apk
```

Sau khi lệnh cài báo `Success`, có thể mở `booking_classroom` trên điện thoại. Đây là bản Release độc lập nên sau khi cài xong có thể rút cáp và sử dụng mà không cần Metro hoặc máy tính.

Nếu không dùng ADB, gửi tệp `code/booking_classroom/release/booking_classroom-v1.0.apk` sang điện thoại, mở tệp và cho phép cài ứng dụng không rõ nguồn gốc khi Android yêu cầu.

Tài khoản demo:

- Quản trị viên: `admin` / `1`
- Người dùng: `user` / `2`

Ứng dụng cũng cho phép đăng ký tài khoản User mới, cập nhật hồ sơ, đổi mật khẩu và xem thông báo; dữ liệu được giữ lại trên thiết bị sau khi đóng ứng dụng.

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
