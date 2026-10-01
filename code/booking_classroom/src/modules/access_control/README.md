# Module: Access Control

Module xử lý quyền vào phòng sau khi booking được duyệt.

## Khóa mã số online

- Booking được duyệt cấp quyền cho User tự tạo mật khẩu tại đúng phòng khóa số.
- Admin có thể thu hồi quyền theo cặp User–phòng mà không đổi vai trò tài khoản.
- Mã có hiệu lực trong khoảng đệm trước/sau booking theo cấu hình.
- Mã bị thu hồi khi booking bị hủy hoặc đổi phòng.
- Nếu phòng đang gắn SmartLock, app gửi lệnh tạo mật khẩu qua cơ chế Tools/OneIoT.

## Khóa cơ/thẻ từ

- User là bên gửi đề xuất thời gian nhận khóa đầu tiên.
- Admin chấp nhận và bổ sung địa điểm hoặc gửi đề xuất thời gian/địa điểm khác.
- User có thể chấp nhận hoặc đề xuất lại; quy trình kết thúc khi hai bên thống nhất.
- User có thể ủy quyền người khác nhận hộ và cung cấp mã sinh viên/cán bộ.

## Check-in/check-out

- App lắng nghe bản tin SmartLock theo topic và cấu trúc OneM2M của Tools.
- Sự kiện mở/check-in hợp lệ được gắn vào booking đã duyệt của đúng phòng.
- Các trait khóa/đóng cửa/check-out tương ứng được hỗ trợ để ghi nhận checkout.
- Token OneIoT chỉ giữ trong RAM và kết nối bị đóng khi app sang nền, đăng xuất hoặc đóng.

**Hiện trạng:** logic local, thương lượng nhận khóa và bộ nhận bản tin đã được triển khai. Kiểm thử đầu cuối với OneIoT/khóa thật chưa được thực hiện vì token do người dùng tự nhập.
