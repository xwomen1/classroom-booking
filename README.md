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

Ứng dụng đã có đầy đủ luồng local cho hai vai trò: quản lý tài khoản, phòng, lịch bảo trì và cấu hình; tìm và đặt phòng; duyệt, từ chối, đổi phòng, hủy; lịch xem riêng với màn quản lý booking; hẹn/ủy quyền nhận khóa; tạo mật khẩu tạm thời và thông báo. Dữ liệu được giữ lại trên một thiết bị sau khi đóng ứng dụng.

Bản hiện tại có sơ đồ chữ U cho tầng 1–8, hiển thị trực quan phòng trống/đã đặt/bảo trì theo khoảng thời gian. User có thể đánh dấu phòng trên sơ đồ rồi mở chức năng Đặt phòng để dùng lại phòng và thời gian đã chọn. Khi Admin duyệt booking của phòng khóa số, User được cấp quyền tự tạo mật khẩu riêng cho đúng phòng đó; Admin có thể thu hồi quyền theo từng phòng trong Quản lý user.

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
