# Module: Authentication

**Vai trò:** Admin và User.

## Chức năng con

- Đăng ký.
- Đăng nhập và đăng xuất.
- Quên mật khẩu.
- Đổi mật khẩu.
- Xác định vai trò sau đăng nhập.

## Hiện trạng

- Đã có đăng nhập demo cục bộ: `admin/1` và `user/2`; màn hình đăng nhập không hiển thị sẵn hai thông tin này.
- Đã có đăng ký tài khoản User mới, khôi phục bằng mã cục bộ, đổi mật khẩu, đăng xuất và điều hướng theo vai trò.
- Ở chế độ local, tài khoản và mật khẩu được lưu trên thiết bị để phục vụ bản demo; khi bật REST, app gọi booking-server. Chuyển chế độ không tự chuyển tài khoản giữa hai kho.
- Mã khôi phục demo: `admin/111111`, `user/222222`; tài khoản cũ khác chưa có mã dùng giá trị di trú `000000`.

## Cấu trúc

- `model/`: kiểu và dữ liệu tài khoản của module.
- `services/`: logic xác thực.
- `screens/`: màn hình đăng nhập, đăng ký, quên và đổi mật khẩu.
- `index.ts`: API công khai của module.
