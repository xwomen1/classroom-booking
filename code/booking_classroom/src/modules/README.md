# Phân chia module nghiệp vụ

Mỗi thư mục con là một phạm vi có thể giao cho một thành viên phụ trách.

| Module                 | Phạm vi chính                                              | Vai trò     | Trạng thái           | Người phụ trách |
| ---------------------- | ---------------------------------------------------------- | ----------- | -------------------- | --------------- |
| `auth`                 | Đăng ký, đăng nhập, đăng xuất, quên/đổi mật khẩu           | Chung       | Đã triển khai local  | Chưa phân công  |
| `account_management`   | CRUD, tìm kiếm và phân quyền tài khoản                     | Admin       | Đã triển khai local  | Chưa phân công  |
| `room_management`      | CRUD, tìm kiếm phòng, thiết bị và trạng thái               | Admin       | Đã triển khai local  | Chưa phân công  |
| `booking`              | Tìm phòng, tạo và quản lý yêu cầu, duyệt/từ chối/đổi phòng | Admin, User | Đã triển khai local  | Chưa phân công  |
| `access_control`       | Khóa cơ/thẻ từ, lịch lấy khóa, mã số tạm thời              | Admin, User | Đã triển khai local  | Chưa phân công  |
| `schedule_maintenance` | Lịch sử dụng phòng và lịch bảo trì                         | Admin       | Đã triển khai local  | Chưa phân công  |
| `profile`              | Xem và sửa thông tin cá nhân                               | Chung       | Đã triển khai cục bộ | Chưa phân công  |
| `notifications`        | Thông báo theo sự kiện booking và hệ thống                 | Chung       | Đã có thông báo cục bộ | Chưa phân công  |
| `configuration`        | Thời gian đặt, hủy phòng và cấu hình thông báo             | Admin       | Đã triển khai local  | Chưa phân công  |

## Quy ước làm việc

1. Mỗi người sửa trong module được giao và mở pull request riêng.
2. Màn hình dùng API qua `index.ts`; các service có thể import trực tiếp repository của module khác để tránh vòng phụ thuộc với phần giao diện.
3. Kiểu dữ liệu hoặc tiện ích dùng chung đặt trong `src/core` hoặc `src/shared`.
4. Không đánh dấu chức năng hoàn thành trong README trước khi đã có code và kiểm thử tương ứng.
5. Business rules của booking được tập trung tại module `booking`; quy tắc cấp mã khóa nằm tại `access_control`.

## Cấu trúc con chuẩn của mỗi module

```text
<module>/
├── screens/       # Màn hình React Native của module
├── components/    # Component chỉ dùng trong module
├── services/      # Use case, gọi API và xử lý nghiệp vụ
├── model/         # Kiểu dữ liệu và model của module
├── __tests__/     # Kiểm thử riêng của module
└── README.md      # Phạm vi, business rules và trạng thái
```

Các tệp `.gitkeep` chỉ có tác dụng giữ thư mục rỗng trên Git; xóa chúng khi thư mục đã có code thật.
