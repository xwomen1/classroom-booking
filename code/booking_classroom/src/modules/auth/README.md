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
- Đã có đăng xuất và điều hướng giao diện theo vai trò.
- Các chức năng còn lại mới nằm trong phạm vi dự kiến.

## Cấu trúc

- `model/`: kiểu và dữ liệu tài khoản của module.
- `services/`: logic xác thực.
- `screens/`: giao diện đăng nhập và các màn hình xác thực sau này.
- `index.ts`: API công khai của module.
