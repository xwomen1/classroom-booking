# Module: Authentication

**Vai trò:** Admin và User.

## Chức năng con

- Đăng ký.
- Đăng nhập và đăng xuất.
- Quên mật khẩu.
- Đổi mật khẩu.
- Xác định vai trò sau đăng nhập.

## Hiện trạng

- Đã có đăng nhập demo cục bộ: `admin/1` và `user/2`.
- Đã có đăng ký tài khoản User mới, đổi mật khẩu, đăng xuất và điều hướng theo vai trò.
- Tài khoản và mật khẩu được lưu cục bộ để phục vụ bản demo.
- Quên mật khẩu chưa được triển khai.

## Cấu trúc

- `model/`: kiểu và dữ liệu tài khoản của module.
- `services/`: logic xác thực.
- `screens/`: giao diện đăng nhập và các màn hình xác thực sau này.
- `index.ts`: API công khai của module.
