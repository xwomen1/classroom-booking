# Phân chia module nghiệp vụ

Mỗi thư mục con là một phạm vi có thể giao cho một thành viên phụ trách. Hiện có **11 module**. Bảng mô tả mã đã có; luồng local đã được kiểm tra trên một điện thoại, còn REST chưa được xác nhận đầu cuối với server công khai và nhiều máy.

| Module                 | Phạm vi chính                                              | Vai trò     | Trạng thái           | Người phụ trách |
| ---------------------- | ---------------------------------------------------------- | ----------- | -------------------- | --------------- |
| `auth`                 | Đăng ký, đăng nhập, đăng xuất, quên/đổi mật khẩu           | Chung       | Đã triển khai local  | Chưa phân công  |
| `account_management`   | CRUD, tìm kiếm và phân quyền tài khoản                     | Admin       | Đã triển khai local  | Chưa phân công  |
| `room_management`      | Tìm phòng; giao diện Admin quản lý phòng và bảo trì         | Admin, User | Đã có mã local/REST  | Chưa phân công  |
| `booking`              | Tạo/duyệt/hủy/đổi phòng, ghi chú, nhận khóa, no-show       | Admin, User | Đã có mã local/REST  | Chưa phân công  |
| `access_control`       | Quyền tạo mã theo phòng và mật khẩu tạm thời               | Admin, User | Đã có mã local/REST  | Chưa phân công  |
| `smart_lock`           | Gắn một khóa vào phòng, OneIoT và sự kiện ra/vào           | Admin, User | Đã có mã; IoT cần thử thật | Chưa phân công |
| `schedule_maintenance` | Dữ liệu, yêu cầu và business rule bảo trì                  | Admin, User | Đã triển khai local  | Chưa phân công  |
| `profile`              | Xem và sửa thông tin cá nhân                               | Chung       | Đã triển khai cục bộ | Chưa phân công  |
| `notifications`        | Thông báo theo sự kiện booking và hệ thống                 | Chung       | Đã có thông báo cục bộ | Chưa phân công  |
| `configuration`        | Thời gian đặt, hủy phòng và cấu hình thông báo             | Admin       | Đã triển khai local  | Chưa phân công  |
| `auto_approval`        | Tự động duyệt phòng thường; phòng đặc biệt chờ admin duyệt | Admin, User | Đã triển khai local + server | Chưa phân công  |

## Quy ước làm việc

1. Mỗi người sửa trong module được giao và mở pull request riêng.
2. Màn hình và module khác dùng hợp đồng được export qua `index.ts`; tránh import sâu vào tệp nội bộ của module khác. Khi cần phối hợp nghiệp vụ, gọi hàm công khai và không tạo phụ thuộc vòng.
3. Kiểu dữ liệu hoặc tiện ích kỹ thuật dùng chung đặt trong `src/core`; component giao diện dùng lại đặt trong `src/shared`. Không đưa quy tắc nghiệp vụ riêng của một module vào vùng dùng chung.
4. Không đánh dấu chức năng hoàn thành trong README trước khi đã có code và kiểm thử tương ứng.
5. Business rules của booking tập trung tại module `booking`; quy tắc cấp mã khóa nằm tại `access_control`. Quy tắc giao khoảng thời gian dùng chung với bảo trì ở `src/core/time/intervals.ts`.

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
