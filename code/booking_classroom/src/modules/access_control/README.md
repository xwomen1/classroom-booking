# Module: Access Control

Module xử lý quyền vào phòng sau khi booking được duyệt.

## Khóa mã số online

- Booking được duyệt cấp quyền cho User tự tạo mật khẩu tại đúng phòng khóa số.
- Admin có thể thu hồi quyền theo cặp User–phòng mà không đổi vai trò tài khoản.
- Mã gồm đúng 7 chữ số và có hiệu lực trong khoảng đệm trước/sau booking theo cấu hình.
- Bản ghi mã được đánh dấu thu hồi khi booking bị hủy, đổi phòng hoặc ghi nhận vắng mặt; chưa có bằng chứng mã đã bị xóa trên khóa thật.
- Mã được ghi vào booking ở nguồn dữ liệu đang chọn và có thể hiển thị khi chưa kết nối OneIoT. Ở chế độ local, dữ liệu nằm trên thiết bị; ở chế độ REST, app vẫn cần booking-server để lưu mã.
- Nếu phòng đang gắn SmartLock, app gửi ngay khi đang online hoặc tự gửi hàng đợi sau lần kết nối kế tiếp qua cơ chế Tools/OneIoT.
- Lệnh dùng `traitCreateTmpPasswordLock`, ID mật khẩu riêng và mốc thời gian Unix lấy từ lịch booking; app không chờ phản hồi từ khóa.

## Khóa cơ/thẻ từ

Luồng hẹn nhận chìa và ủy quyền được triển khai trong `src/modules/booking/services/bookingRepository.ts` và giao diện `booking/screens/MyBookingsScreen.tsx`, không nằm trong service PIN của module này.

- User là bên gửi đề xuất thời gian nhận khóa đầu tiên.
- Admin chấp nhận và bổ sung địa điểm hoặc gửi đề xuất thời gian/địa điểm khác.
- User có thể chấp nhận hoặc đề xuất lại; quy trình kết thúc khi hai bên thống nhất.
- User có thể ủy quyền người khác nhận hộ và cung cấp mã sinh viên/cán bộ.

## Check-in/check-out

Nhận bản tin nằm ở `src/modules/smart_lock/services/smartLockAccessEventService.ts`; cập nhật lượt đặt nằm ở `src/modules/booking/services/bookingRepository.ts`.

- App lắng nghe bản tin SmartLock theo topic và cấu trúc OneM2M của Tools.
- Sự kiện mở/check-in hợp lệ được gắn vào booking đã duyệt của đúng phòng.
- Các trait khóa/đóng cửa/check-out tương ứng được hỗ trợ để ghi nhận checkout.
- Token OneIoT chỉ giữ trong RAM và kết nối bị đóng khi app sang nền, đăng xuất hoặc đóng.

**Hiện trạng:** logic PIN local và nhánh REST có trong mã. Lượt trước từng kiểm tra app kết nối OneIoT và phát một mã đã xếp hàng; sau refactor mới kiểm tra tạo/hiển thị PIN bảy chữ số khi chưa kết nối. Việc khóa thật nhận và áp dụng mã chưa được quan sát trực tiếp.
