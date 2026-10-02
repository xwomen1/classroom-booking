# Module: Access Control

Module xử lý quyền vào phòng sau khi booking được duyệt.

## Khóa mã số online

- Booking được duyệt cấp quyền cho User tự tạo mật khẩu tại đúng phòng khóa số.
- Admin có thể thu hồi quyền theo cặp User–phòng mà không đổi vai trò tài khoản.
- Mã gồm đúng 7 chữ số và có hiệu lực trong khoảng đệm trước/sau booking theo cấu hình.
- Mã bị thu hồi khi booking bị hủy hoặc đổi phòng.
- Mã được lưu và hiển thị local ngay cả khi OneIoT chưa kết nối.
- Nếu phòng đang gắn SmartLock, app gửi ngay khi đang online hoặc tự gửi hàng đợi sau lần kết nối kế tiếp qua cơ chế Tools/OneIoT.
- Lệnh dùng `traitCreateTmpPasswordLock`, ID mật khẩu riêng và mốc thời gian Unix lấy từ lịch booking; app không chờ phản hồi từ khóa.

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

**Hiện trạng:** logic local, thương lượng nhận khóa và bộ nhận bản tin đã được triển khai. Đã kiểm tra app kết nối OneIoT và phát thành công một mật khẩu đã xếp hàng; việc khóa thật nhận và áp dụng mã cần được quan sát trực tiếp trên thiết bị khóa.
