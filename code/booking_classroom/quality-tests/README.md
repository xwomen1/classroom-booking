# quality-tests – Bộ kiểm thử chất lượng RoomHub

Bộ kiểm thử độc lập cho ứng dụng `code/booking_classroom`. Thư mục này có cấu hình Jest, mock Async Storage và helper riêng; không dùng `jest.config.js`, `jest.setup.js` hay các test trong `__tests__` của dự án.

## Chạy

Trong thư mục `code/booking_classroom` (sau `npm ci`):

```powershell
npx jest --config quality-tests/jest.config.js                              # toàn bộ
npx jest --config quality-tests/jest.config.js quality-tests/unit           # 1. logic nghiệp vụ
npx jest --config quality-tests/jest.config.js quality-tests/component      # 2. giao diện
npx jest --config quality-tests/jest.config.js quality-tests/integration    # 3. tích hợp
npx jest --config quality-tests/jest.config.js --coverage                   # kèm độ phủ (quality-tests/coverage/)
```

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `jest.config.js` | Cấu hình Jest riêng: chỉ nạp `*.quality.ts(x)` trong thư mục này. |
| `setup/asyncStorageMock.js` | Async Storage chạy trong bộ nhớ. |
| `support/testUtils.ts` | Đóng băng thời gian, tạo booking mẫu, render/bấm/nhập cho kiểm thử giao diện. |
| `unit/` | Service và model: luật đặt phòng, vòng đời booking, tài khoản, cấu hình, phòng, bảo trì, thông báo, mã PIN, SmartLock, `apiRequest`. |
| `component/` | Màn hình đăng nhập, đăng ký, đổi/quên mật khẩu, hồ sơ, quy định, quản lý tài khoản, lịch của tôi, `BookingTimePicker`, `PasswordInput`. |
| `integration/` | `oneIoTNativeBridge`: oneIoTClient ↔ native module `OneIoTMqtt` (mock). `remoteApiContract`: mọi request của app ở chế độ remote khớp một `@XxxMapping` trong `booking-server/.../ApiController.java` và ngược lại. `endToEndWorkflows`: luồng nhiều module từ đặt phòng tới check-in/check-out. |
| `BAO_CAO_KIEM_THU.md` | Báo cáo kết quả kiểm thử. |

## Quy ước

- Thời gian được đóng băng ở Thứ Năm 2030-01-10 08:00 (giờ máy) để luật theo ngày giờ cho kết quả ổn định. Test giao diện dùng thời gian thật.
- Mỗi test gọi `resetStorage()` trước khi chạy.
- `isRemoteApiEnabled()` luôn là `false` khi `NODE_ENV=test`. Test hợp đồng API tạm đổi `NODE_ENV` và thay `fetch` bằng server giả.
- `testTimeout` là 30 giây vì lần chạy đầu (chưa có cache) Jest phải transform các module React Native.

## Lỗi đã biết (đánh dấu `test.failing`)

Các test này mô tả hành vi đúng và hiện đang thất bại do lỗi trong code. Khi sửa lỗi, đổi `test.failing` thành `test`.

1. **Phòng demo đã xóa xuất hiện lại** (`unit/roomRepository.quality.ts`): `getRooms()` gộp lại mọi `DEMO_ROOMS` còn thiếu trong storage.
2. **Không thể đăng ký khi bỏ trống mã khôi phục** (`component/authScreens.quality.tsx`): màn hình gửi `''`, còn `registerAccount` chỉ bỏ qua kiểm tra khi giá trị là `undefined`.
