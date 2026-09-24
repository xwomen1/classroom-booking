# Module: Access Control

Module xử lý cách User nhận quyền vào phòng sau khi booking được duyệt.

## Khóa mã số online

- Admin tạo mật khẩu tạm thời hoặc cho phép User tự tạo sau khi duyệt.
- Mã dùng được từ 10 phút trước giờ bắt đầu đến 10 phút sau giờ kết thúc.
- Gắn mã với booking và thu hồi khi hết hiệu lực hoặc booking bị hủy.

## Khóa cơ/thẻ từ

- Admin tạo lịch hẹn lấy khóa/thẻ sau khi duyệt.
- User có thể ủy quyền người khác nhận hộ.
- Người nhận hộ phải xuất trình thẻ sinh viên theo quy định.

**Hiện trạng:** đã có MVP local sinh mã 6 chữ số cho booking đã duyệt ở phòng khóa số. Admin có thể tạo mã hoặc cấp quyền để đúng User đặt phòng tự tạo. Mã có hiệu lực trước/sau 10 phút, hiển thị cho Admin và đúng User, đồng thời bị thu hồi khi User hủy. Chưa tích hợp khóa thật hoặc dịch vụ online.
