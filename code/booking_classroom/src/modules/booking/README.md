# Module: Booking

**Người dùng:** Admin và User.

## Chức năng con của User

- Tìm phòng theo vị trí, ngày, khung giờ, sức chứa và thiết bị.
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

**Hiện trạng:** đã có MVP local gồm tạo yêu cầu, kiểm tra ngày 1--3 ngày, giới hạn hai yêu cầu, chống trùng phòng/User, danh sách booking, Admin duyệt/từ chối và User hủy. Chưa có tìm kiếm nâng cao, đổi phòng, giữ chỗ đồng thời hoặc server.
