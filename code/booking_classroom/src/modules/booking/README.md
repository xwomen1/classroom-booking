# Module: Booking

**Người dùng:** Admin và User.

## Chức năng của User

- Tìm và đặt phòng theo tầng, ngày/giờ, sức chứa, thiết bị và loại khóa.
- Xem lịch đặt phòng và quản lý yêu cầu đang hoạt động.
- Hủy yêu cầu theo chính sách.
- Với khóa cơ/thẻ từ: đề xuất giờ nhận khóa, chấp nhận đề xuất của Admin hoặc gửi lại một thời gian khác; có thể ủy quyền người nhận hộ.
- Với khóa số: tạo mật khẩu khi có quyền trên đúng phòng.
- Khi đang sử dụng phòng: gửi yêu cầu bảo trì kèm lý do.
- Khi đang sử dụng phòng: gửi ghi chú về thiếu đồ dùng hoặc điều cần lưu ý cho Admin; ghi chú chỉ tạo thông báo, không tạo yêu cầu bảo trì.
- Xem thời điểm check-in/check-out do bản tin SmartLock ghi nhận.

## Chức năng của Admin

- Duyệt hoặc từ chối yêu cầu.
- Có thể bật duyệt tự động cho phòng thường tại cấu hình; phòng đặc biệt vẫn được duyệt thủ công.
- Đổi sang phòng khả dụng đáp ứng tối thiểu loại khóa, sức chứa và thiết bị.
- Với khóa cơ/thẻ từ: chấp nhận thời gian User đề xuất hoặc gửi thời gian/địa điểm khác.
- Tạo mật khẩu hộ cho phòng khóa số và xử lý quyền theo phòng.
- Nhận thông báo yêu cầu bảo trì.
- Nhận ghi chú về phòng trong mục thông báo.

## Business rules

- Không đặt khi trùng thời gian hoặc phòng đang bảo trì.
- Duyệt tự động chỉ áp dụng sau khi yêu cầu vượt qua toàn bộ quy tắc đặt phòng; công tắc mặc định tắt.
- Chỉ đặt trong khoảng thời gian cấu hình; mặc định trước ít nhất 1 ngày và không quá 3 ngày.
- Một User không có hai booking chồng lấn; tổng yêu cầu chờ và phòng sắp sử dụng không vượt quá giới hạn cấu hình.
- Admin chỉ đổi phòng trước thời điểm bắt đầu ít nhất số phút đã cấu hình.
- Trao đổi nhận khóa dừng khi một bên chấp nhận đề xuất của bên kia.
- Check-in/check-out chỉ gắn vào booking đã duyệt, đúng phòng đang gắn SmartLock và nằm trong cửa sổ thời gian truy cập.

**Hiện trạng:** luồng local đã được thử trên một điện thoại. Nhánh REST và API Java có mã và kiểm thử với H2 trong RAM, nhưng chưa được xác nhận đầu cuối với server công khai hoặc nhiều điện thoại. Đổi cờ local/REST không tự đồng bộ dữ liệu; bản tin SmartLock thật cần kiểm tra bằng token và thiết bị hợp lệ.
