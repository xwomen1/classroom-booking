# Module: Booking

**Người dùng:** Admin và User.

## Chức năng của User

- Tìm và đặt phòng theo tầng, ngày/giờ, sức chứa, thiết bị và loại khóa.
- Xem lịch đặt phòng và quản lý yêu cầu đang hoạt động.
- Hủy yêu cầu theo chính sách.
- Với khóa cơ/thẻ từ: đề xuất giờ nhận khóa, chấp nhận đề xuất của Admin hoặc gửi lại một thời gian khác; có thể ủy quyền người nhận hộ.
- Với khóa số: tạo mật khẩu khi có quyền trên đúng phòng.
- Khi đang sử dụng phòng: gửi yêu cầu bảo trì kèm lý do.
- Xem thời điểm check-in/check-out do bản tin SmartLock ghi nhận.

## Chức năng của Admin

- Duyệt hoặc từ chối yêu cầu.
- Đổi sang phòng khả dụng đáp ứng tối thiểu loại khóa, sức chứa và thiết bị.
- Với khóa cơ/thẻ từ: chấp nhận thời gian User đề xuất hoặc gửi thời gian/địa điểm khác.
- Tạo mật khẩu hộ cho phòng khóa số và xử lý quyền theo phòng.
- Nhận thông báo yêu cầu bảo trì.

## Business rules

- Không đặt khi trùng thời gian hoặc phòng đang bảo trì.
- Chỉ đặt trong khoảng thời gian cấu hình; mặc định trước ít nhất 1 ngày và không quá 3 ngày.
- Một User không có hai booking chồng lấn; tổng yêu cầu chờ và phòng sắp sử dụng không vượt quá giới hạn cấu hình.
- Admin chỉ đổi phòng trước thời điểm bắt đầu ít nhất số phút đã cấu hình.
- Trao đổi nhận khóa dừng khi một bên chấp nhận đề xuất của bên kia.
- Check-in/check-out chỉ gắn vào booking đã duyệt, đúng phòng đang gắn SmartLock và nằm trong cửa sổ thời gian truy cập.

**Hiện trạng:** các luồng trên chạy local. Đồng bộ nhiều thiết bị cần server ở giai đoạn sau; bản tin SmartLock thật cần người dùng kiểm tra với token và thiết bị hợp lệ.
