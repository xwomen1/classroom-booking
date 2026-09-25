# Module: Booking

**Người dùng:** Admin và User.

## Chức năng con của User

- Tìm phòng trên sơ đồ chữ U theo tầng, ngày, khung giờ, sức chứa và thiết bị.
- Đánh dấu phòng trên sơ đồ để chuyển phòng và thời gian đã chọn sang màn Đặt phòng.
- Đặt phòng với ngày/giờ và mục đích sử dụng.
- Xem lịch sắp tới, đã sử dụng và đã hủy.
- Xem trạng thái, hủy yêu cầu và ủy quyền người lấy thẻ hộ.

## Chức năng con của Admin

- Duyệt hoặc từ chối yêu cầu mượn phòng.
- Đổi phòng khi phòng đã đặt cần dùng cho mục đích cấp thiết hơn.
- Chuyển yêu cầu đã duyệt sang quy trình cấp quyền vào phòng của module `access_control`.

## Business rules

- Không cho đặt nếu trùng thời gian hoặc phòng đang bảo trì.
- Chỉ đặt trước ít nhất 1 ngày và không quá 3 ngày.
- Một User không được đặt hai phòng có thời gian chồng lấn.
- Tổng số yêu cầu đang chờ và phòng sắp sử dụng của một User không vượt quá 2.
- Khi User A đang thao tác đặt phòng X, User B không được đồng thời thao tác phòng đó trong cùng phiên giữ chỗ.
- Admin chỉ được đổi phòng trước thời điểm bắt đầu ít nhất 30 phút.
- User được phép hủy phòng theo chính sách cấu hình.

**Hiện trạng:** đã có luồng local tạo, duyệt/từ chối, hủy theo hạn cấu hình, đổi phòng, lịch chỉ đọc, màn quản lý thao tác riêng, chống trùng phòng/User/bảo trì và giới hạn booking. Một thiết bị xử lý tuần tự; khóa đồng thời nhiều thiết bị cần server ở giai đoạn sau.
