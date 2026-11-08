# Minh chứng màn hình cấu hình trên Android

Sử dụng APK local đang cài trên Samsung SM-M215F. Đã kiểm tra định danh APK khớp bản local có trong hồ sơ kiểm thử; không build/cài lại.

- [Phần tham số](configuration-top.png), [cây giao diện](configuration-top.xml): đặt trước 0–3 ngày, hạn mức 2, hạn hủy/đổi 30 phút, đệm PIN 10 phút, ân hạn vắng mặt 15 phút.
- [Phần công tắc](configuration-bottom.png), [cây giao diện](configuration-bottom.xml): thông báo hoạt động đang bật, tự duyệt phòng thường đang tắt, nút Lưu quy định hiển thị.
- Công tắc tự duyệt chuyển bật/tắt đúng thao tác, được trả về trạng thái ban đầu; không bấm Lưu. Không tạo hoặc sửa booking; kết thúc đã đăng xuất.
- Ảnh PNG là ảnh chụp trực tiếp, không chỉnh nội dung. Hai ảnh được đưa vào Hình 4.4 để bao quát nội dung màn hình cuộn.

[Kết quả kiểm tra](verification.json); [trạng thái đăng xuất](final-login.xml). Đây là kiểm tra giao diện bổ sung; các kết quả unit, quality, H2 và D01–D06 giữ nguyên hồ sơ gốc.
