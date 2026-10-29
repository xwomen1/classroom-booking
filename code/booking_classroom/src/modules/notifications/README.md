# Module: Notifications

**Vai trò:** Admin và User.

## Chức năng con

- Thông báo yêu cầu booking mới cho Admin.
- Thông báo duyệt, từ chối, đổi phòng hoặc hủy cho User.
- Thông báo đề xuất và thống nhất lịch nhận khóa/thẻ.
- Thông báo bảo trì, ghi chú phòng, mã truy cập và điểm danh/vắng mặt.
- Màu thông báo phân theo ý nghĩa; banner ưu tiên chỉ hiện cho người nhận đang đăng nhập.

Việc lưu thông báo tôn trọng công tắc bật/tắt trong module `configuration`; app chưa có bộ lập lịch gửi nhắc tự động hay kênh push thời gian thực cho nhiều điện thoại.

**Hiện trạng:** đã có danh sách, bộ đếm chưa đọc, đánh dấu đã đọc và nhánh dữ liệu local/REST. Chưa có push thời gian thực giữa nhiều điện thoại khi server gửi thông báo; đổi tài khoản trên một máy không chứng minh tính năng này.
