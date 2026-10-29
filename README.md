# Booking Classroom — Final Project

Ứng dụng đặt phòng học/phòng họp, hỗ trợ dữ liệu cục bộ hoặc trao đổi với backend và giao tiếp trực tiếp với SmartLock qua OneIoT.

## Thành phần

- `code/booking_classroom`: ứng dụng React Native Android.
- `code/booking-server`: Java/Spring Boot API; mặc định dùng H2 local, profile `remote` mới bật H2 SSL từ xa.
- `gia_lap_smartlock`: chương trình giả lập SmartLock.
- `oneIot_smartlock`: gateway HTTP–MQTT cũ được giữ để tham khảo; app hiện kết nối OneIoT trực tiếp.
- `docs/project`: đề xuất, workflow, hiện trạng triển khai, kế hoạch kiểm thử, hình và tài liệu nguồn.
- `docs/reports`: báo cáo giữa kỳ, báo cáo cuối kỳ và bản PDF xuất.
- `docs/ARCHITECTURE.md`: cấu trúc source hiện tại và hướng refactor.

Sơ đồ module và phạm vi từng phần nằm tại [`code/booking_classroom/src/modules/README.md`](code/booking_classroom/src/modules/README.md).

Kiến trúc hiện tại, ranh giới frontend/backend và hướng refactor được mô tả tại [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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

Bản Release cài và khởi chạy không cần Metro hoặc cáp USB. Với cấu hình hiện tại, các thao tác dữ liệu cần backend; chuyển ứng dụng sang chế độ local nếu cần trình diễn độc lập. Có thể chép `app-release.apk` sang một máy Android khác để cài.

Tài khoản demo:

- Quản trị viên: `admin` / `1`
- Người dùng: `user` / `2`

Ở chế độ local, dữ liệu tài khoản, phòng, đặt phòng, bảo trì và cấu hình được lưu trên thiết bị bằng Async Storage; chế độ này không tự đồng bộ lại với backend. Khi dùng backend, dữ liệu nghiệp vụ được lưu phía server. Token OneIoT chỉ giữ trong RAM của phiên kết nối.

## Chức năng chính

- Đăng ký, đăng nhập, hồ sơ, đổi/khôi phục mật khẩu và thông báo.
- Tìm và đặt phòng theo tầng, ngày giờ, sức chứa, thiết bị và loại khóa.
- Có thể đặt lặp hàng tuần, theo dõi từng tuần, sửa các lượt đang chờ duyệt hoặc hủy các lượt tương lai trong chuỗi.
- Admin duyệt/từ chối, đổi phòng phù hợp và quản lý tài khoản. Quản lý phòng và bảo trì dùng chung một màn hình: chọn tầng, chọn phòng rồi sửa, xóa, lên lịch bảo trì hoặc xem lịch sử dụng.
- Admin quản lý điểm danh: xác nhận có mặt cho phòng dùng khóa cơ/thẻ từ và ghi nhận vắng mặt sau thời gian ân hạn khi chưa có check-in hợp lệ.
- User đang sử dụng phòng có thể gửi yêu cầu bảo trì kèm lý do; Admin nhận thông báo, thấy tầng/phòng được đánh dấu vàng và xử lý yêu cầu.
- Với khóa cơ/thẻ từ, User đề xuất giờ nhận khóa; Admin chấp nhận hoặc đề xuất giờ khác; hai bên trao đổi đến khi thống nhất.
- Nếu Admin cho phép đặt cùng ngày, một khoảng đang diễn ra vẫn có thể được tạo và duyệt miễn là chưa qua giờ kết thúc và thỏa các quy tắc còn lại.
- Với khóa số, User được cấp quyền theo đúng phòng đã duyệt để tạo mật khẩu tạm thời gồm 7 chữ số. Mã được lưu và hiển thị ngay khi offline; app tự gửi các mã đang chờ sau khi kết nối OneIoT.
- Admin gắn một SmartLock vào phòng, nhập token trong phiên và kết nối trực tiếp tới OneIoT bằng MQTT TLS. App gửi `traitCreateTmpPasswordLock` theo thời gian booking, không chờ phản hồi từ khóa, và nhận bản tin SmartLock để ghi nhận check-in/check-out.

Chế độ dữ liệu được điều khiển tại `code/booking_classroom/src/core/config/runtimeFlags.ts`. Cấu hình hiện tại bật trao đổi với backend; có thể tắt để chạy độc lập bằng dữ liệu local:

```ts
export const ENABLE_REMOTE_SYNC = true;
```

Khi bật, ứng dụng cần backend ở địa chỉ cấu hình. Khi tắt, dữ liệu lưu trên thiết bị và không tự đồng bộ trở lại server.

URL phát triển mặc định là `http://127.0.0.1:8080`. Cách chạy H2 giả lập, nối điện thoại bằng `adb reverse` và bật profile database từ xa nằm tại [`code/booking-server/README.md`](code/booking-server/README.md).

## Phát triển và kiểm tra

Hướng dẫn Debug, ADB/Metro, build trên đường dẫn Windows có Unicode và các lệnh kiểm tra source nằm tại [`code/booking_classroom/README.md`](code/booking_classroom/README.md).

Tài liệu được phân nhóm tại [`docs/project`](docs/project/) và [`docs/reports`](docs/reports/); xem [mục lục tài liệu](docs/README.md).
