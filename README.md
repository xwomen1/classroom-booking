# Booking Classroom — Final Project

Ứng dụng đặt phòng học/phòng họp, chạy local trên một điện thoại và có phần giao tiếp trực tiếp với SmartLock qua OneIoT.

## Thành phần

- `code/booking_classroom`: ứng dụng React Native Android.
- `code/booking-server`: mã Java/Spring Boot từ nhánh `syncdata`; mặc định dùng H2 local, profile `remote` mới bật H2 SSL từ xa.
- `tunghv2`: chương trình giả lập SmartLock.
- `tunghv3`: gateway HTTP–MQTT cũ được giữ để tham khảo; app hiện kết nối OneIoT trực tiếp.
- `du_an_dat_phong.tex/.pdf`: đề xuất dự án.
- `workflow_booking_app.tex/.pdf`: workflow nghiệp vụ.
- `hien_trang_trien_khai.tex/.pdf`: hiện trạng triển khai đã kiểm tra.

Sơ đồ module và phạm vi từng phần nằm tại [`code/booking_classroom/src/modules/README.md`](code/booking_classroom/src/modules/README.md).

## Clone, build và cài ứng dụng

Repository chỉ lưu source cần thiết. APK, cache và thư mục build không được đưa lên Git; mỗi thành viên tự build sau khi clone.

```powershell
git clone https://github.com/xwomen1/classroom-booking.git
cd classroom-booking\code\booking_classroom
npm ci
npm run build:android:release
adb devices -l
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
```

Bản Release chạy độc lập sau khi cài, không cần Metro, cáp USB hoặc booking server. Có thể chép `app-release.apk` sang một máy Android khác và mở tệp để cài.

Tài khoản demo:

- Quản trị viên: `admin` / `1`
- Người dùng: `user` / `2`

Dữ liệu tài khoản, phòng, booking, bảo trì và cấu hình được lưu local bằng Async Storage. Token OneIoT chỉ giữ trong RAM của phiên kết nối và không được lưu vào Git hoặc bộ nhớ ứng dụng.

## Chức năng chính

- Đăng ký, đăng nhập, hồ sơ, đổi/khôi phục mật khẩu và thông báo.
- Tìm và đặt phòng theo tầng, ngày giờ, sức chứa, thiết bị và loại khóa.
- Có thể đặt lặp hàng tuần, theo dõi từng tuần, sửa các lượt đang chờ duyệt hoặc hủy các lượt tương lai trong chuỗi.
- Admin duyệt/từ chối, đổi phòng phù hợp và quản lý tài khoản. Quản lý phòng và bảo trì dùng chung một màn hình: chọn tầng, chọn phòng rồi sửa, xóa, lên lịch bảo trì hoặc xem lịch sử dụng.
- Admin quản lý điểm danh: xác nhận có mặt cho phòng dùng khóa cơ/thẻ từ và ghi nhận vắng mặt sau thời gian ân hạn khi chưa có check-in hợp lệ.
- User đang sử dụng phòng có thể gửi yêu cầu bảo trì kèm lý do; Admin nhận thông báo, thấy tầng/phòng được đánh dấu vàng và xử lý yêu cầu.
- Với khóa cơ/thẻ từ, User đề xuất giờ nhận khóa; Admin chấp nhận hoặc đề xuất giờ khác; hai bên trao đổi đến khi thống nhất.
- Với khóa số, User được cấp quyền theo đúng phòng đã duyệt để tạo mật khẩu tạm thời. User phải nhập token và kết nối OneIoT trong phiên trước khi gửi lệnh tạo mã.
- Admin gắn một SmartLock vào phòng, nhập token trong phiên và kết nối trực tiếp tới OneIoT bằng MQTT TLS. App gửi lệnh tạo mật khẩu và nhận bản tin SmartLock để ghi nhận check-in/check-out.

Chế độ local được điều khiển tại `code/booking_classroom/src/core/config/runtimeFlags.ts`:

```ts
export const ENABLE_REMOTE_SYNC = false;
```

Giữ giá trị `false` để dùng app mà không cần booking server.

URL Cloudflare và cấu hình cơ sở dữ liệu từ nhánh `syncdata` vẫn được giữ trong source. Cách bật server local hoặc profile database từ xa nằm tại [`code/booking-server/README.md`](code/booking-server/README.md).

## Phát triển và kiểm tra

Hướng dẫn Debug, ADB/Metro, build trên đường dẫn Windows có Unicode và các lệnh kiểm tra source nằm tại [`code/booking_classroom/README.md`](code/booking_classroom/README.md).
