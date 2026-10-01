# Module: Schedule & Maintenance

**Người dùng:** Admin và User.

## Chức năng

- User đang trong thời gian sử dụng một booking đã duyệt được gửi yêu cầu bảo trì cho chính phòng đó và phải nhập lý do.
- Mỗi booking chỉ có một yêu cầu bảo trì đang chờ.
- Admin nhận thông báo khi có yêu cầu mới.
- Tầng có yêu cầu đang chờ được tự động mở và tô vàng; phòng liên quan cũng được tô vàng.
- Admin có thể chọn yêu cầu để điền sẵn phòng/lý do, lên lịch bảo trì hoặc từ chối.
- Khi lên lịch xử lý hoặc từ chối, yêu cầu được đóng và User nhận thông báo.
- Lịch bảo trì chặn booking mới bị trùng; không cho tạo lịch đè lên booking đã duyệt.

**Hiện trạng:** đã có repository và giao diện local cho yêu cầu, thông báo, đánh dấu tầng/phòng, tạo/hủy lịch và xử lý yêu cầu.
