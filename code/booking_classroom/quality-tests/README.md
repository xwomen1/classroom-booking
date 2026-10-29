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
| `integration/` | `oneIoTNativeBridge`: kết nối OneIoT tới native module `OneIoTMqtt` bằng mock. `remoteApiContract`: đối chiếu request của app với sáu controller Java ở `booking-server/src/main/java/com/bookingclassroom/server/api/`. `endToEndWorkflows`: luồng nhiều module từ đặt phòng tới check-in/check-out. |
| `BAO_CAO_KIEM_THU.md` | Báo cáo kết quả kiểm thử. |

## Quy ước

- Thời gian được đóng băng ở Thứ Năm 2030-01-10 08:00 (giờ máy) để luật theo ngày giờ cho kết quả ổn định. Test giao diện dùng thời gian thật.
- Mỗi test gọi `resetStorage()` trước khi chạy.
- `isRemoteApiEnabled()` luôn là `false` khi `NODE_ENV=test`. Test hợp đồng API tạm đổi `NODE_ENV` và thay `fetch` bằng server giả.
- `testTimeout` là 30 giây vì lần chạy đầu (chưa có cache) Jest phải transform các module React Native.

## Hai lỗi đã sửa

Ngày 27/10/2026, đã xác nhận và sửa hai lỗi: phòng mẫu xuất hiện lại sau khi xóa (`unit/roomRepository.quality.ts`) và đăng ký thất bại khi bỏ trống mã khôi phục (`component/authScreens.quality.tsx`). Hai ca từng dùng `test.failing` nay là test bình thường. Sau refactor ngày 28/10, bộ kiểm thử có 17 tệp và 398 ca đạt khi chạy lại. Các ca dùng mock/H2 không xác nhận server công khai hoặc khóa thật.
