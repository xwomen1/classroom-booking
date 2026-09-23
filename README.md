# Booking Classroom — Final Project

Thư mục này chứa tài liệu và source của một Booking App tích hợp cho đề tài đặt phòng học/phòng họp.

## Nội dung

- `du_an_dat_phong.tex/.pdf`: đề xuất dự án và phạm vi MVP.
- `workflow_booking_app.tex/.pdf`: kiến trúc, workflow và vòng đời booking.
- `hien_trang_trien_khai.tex/.pdf`: ghi nhận ngắn gọn những phần đã triển khai thực tế.
- `code/booking_classroom`: source React Native của ứng dụng.
- `code/booking_classroom/src/modules`: các module nghiệp vụ để phân công riêng cho từng thành viên.

Danh sách module, phạm vi và ô người phụ trách được ghi tại [`code/booking_classroom/src/modules/README.md`](code/booking_classroom/src/modules/README.md).

## Chạy ứng dụng

Xem hướng dẫn đầy đủ tại [`code/booking_classroom/README.md`](code/booking_classroom/README.md).

Chạy bản Debug để phát triển:

```powershell
git clone https://github.com/xwomen1/classroom-booking.git
cd classroom-booking\code\booking_classroom
npm ci
npm start
```

Trong PowerShell khác:

```powershell
adb reverse tcp:8081 tcp:8081
npm run android
```

Tài khoản demo: `admin/1` và `user/2`.

Bản hiện tại đã được build, cài và kiểm tra độc lập trên Samsung M21 khi Metro không chạy và không có `adb reverse`. APK có thể gửi trực tiếp sang máy Android khác nằm tại `code/booking_classroom/release/booking_classroom-v1.0.apk`.
