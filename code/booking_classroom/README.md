# booking_classroom

Ứng dụng React Native đặt phòng học/phòng họp. Bản hiện tại chạy toàn bộ nghiệp vụ trên một thiết bị bằng Async Storage; kết nối OneIoT chỉ dùng cho giao tiếp SmartLock.

## Chức năng đã triển khai

- Tài khoản demo `admin/1`, `user/2`; đăng ký, đăng nhập/đăng xuất, đổi/khôi phục mật khẩu, hồ sơ và thông báo.
- Tìm và đặt phòng trong một màn hình theo tầng, ngày giờ, sức chứa, thiết bị và loại khóa.
- Kiểm tra trùng phòng, trùng lịch User, thời gian bảo trì, thời hạn đặt trước và giới hạn booking.
- Admin duyệt/từ chối, đổi sang phòng đáp ứng tối thiểu loại khóa, sức chứa, thiết bị và thời gian.
- Lịch đặt phòng là màn chỉ đọc; thao tác hủy, truy cập và nhận khóa nằm trong Quản lý đặt phòng.
- User đang sử dụng phòng có thể gửi yêu cầu bảo trì kèm lý do. Admin nhận thông báo; tầng có yêu cầu tự mở, phòng và tầng được tô vàng; Admin có thể lên lịch xử lý hoặc từ chối.
- Với khóa cơ/thẻ từ, User đề xuất thời gian nhận trước. Admin chấp nhận hoặc đề xuất thời gian/địa điểm khác; User tiếp tục chấp nhận hoặc đề xuất lại đến khi thống nhất.
- Với khóa số, booking đã duyệt cấp quyền tạo mã theo đúng cặp User–phòng. Admin có thể tạo mã hộ hoặc thu hồi quyền.
- Admin gắn một SmartLock vào một phòng khóa số, dán token trong phiên và kiểm tra kết nối OneIoT.
- Module Android MQTT TLS dùng Tools Device ID làm danh tính kết nối, gửi `traitCreateTmpPasswordLock` tới SmartLock và lắng nghe bản tin SmartLock để ghi nhận check-in/check-out cho booking phù hợp.

Token OneIoT chỉ tồn tại trong RAM. App ngắt MQTT khi đăng xuất, chuyển nền hoặc đóng. Token không được lưu trong Async Storage hay repository.

## Chế độ local và server

Công tắc nằm tại `src/core/config/runtimeFlags.ts`:

```ts
export const ENABLE_REMOTE_SYNC = false;
```

- `false`: toàn bộ nghiệp vụ và đăng nhập chạy local, không cần booking server.
- `true`: bật nhánh REST API và gọi `REMOTE_API_BASE_URL`. URL Cloudflare mới từ nhánh `syncdata` đã được giữ sẵn trong file cấu hình.

Kết nối OneIoT độc lập với công tắc này. `../../tunghv3` là gateway tham khảo cũ và app không gọi tới gateway đó.

Backend mặc định dùng cơ sở dữ liệu local. Chỉ khi chạy booking server với profile `remote` thì H2 SSL và truststore từ nhánh `syncdata` mới được kích hoạt; xem [hướng dẫn booking-server](../booking-server/README.md).

## Clone và cài dependency

```powershell
git clone <URL_REPOSITORY>
cd <THU_MUC_REPOSITORY>\code\booking_classroom
npm ci
```

Repository không chứa APK, cache, `node_modules` hoặc kết quả build.

## Chạy Debug trên điện thoại Android

1. Bật **Developer options** và **USB debugging**.
2. Cắm cáp dữ liệu, mở khóa điện thoại và chọn **Allow USB debugging**.
3. Kiểm tra thiết bị:

```powershell
adb devices -l
```

Nếu hiện `unauthorized`, chạy:

```powershell
adb kill-server
adb start-server
adb devices -l
```

Sau đó chấp nhận lại hộp thoại trên điện thoại.

Mở Metro ở cửa sổ PowerShell thứ nhất:

```powershell
npm start
```

Ở cửa sổ thứ hai:

```powershell
adb reverse tcp:8081 tcp:8081
npm run android
```

Bản Debug tải JavaScript từ Metro. Sau khi rút/cắm lại cáp, chạy lại `adb reverse tcp:8081 tcp:8081` nếu app không tìm thấy Metro.

## Build APK Debug

Workspace có ký tự Unicode nên dùng script của dự án:

```powershell
npm run build:android:debug
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:8081 tcp:8081
```

APK được tạo tại `android/app/build/outputs/apk/debug/app-debug.apk` và bị Git bỏ qua.

## Build APK Release chạy độc lập

```powershell
npm run build:android:release
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
```

Bản Release chứa sẵn JavaScript nên sau khi cài không cần Metro, cáp USB hoặc máy tính. Có thể chép `app-release.apk` sang điện thoại Android khác để cài. Booking local không cần mạng; chức năng SmartLock cần Internet, token hợp lệ và phiên OneIoT đang kết nối.

## Kiểm tra source

```powershell
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

## Cấu trúc

```text
booking_classroom/
├── App.tsx
├── src/app/                    # App shell và dashboard
├── src/core/                   # Cấu hình, kiểu và hợp đồng dùng chung
├── src/shared/                 # Thành phần dùng lại
├── src/modules/
│   ├── auth/                   # Xác thực local/remote
│   ├── account_management/     # Quản lý tài khoản và quyền theo phòng
│   ├── room_management/        # Phòng, tầng, thiết bị và loại khóa
│   ├── booking/                # Tạo/duyệt/hủy/đổi phòng, nhận khóa, check-in/out
│   ├── access_control/         # Mật khẩu tạm thời và quyền vào phòng
│   ├── smart_lock/             # Gắn khóa và giao tiếp OneIoT
│   ├── schedule_maintenance/   # Yêu cầu, lịch và xử lý bảo trì
│   ├── profile/
│   ├── notifications/
│   └── configuration/
├── __tests__/                  # Kiểm thử nghiệp vụ
├── scripts/                    # Script build Windows Unicode
├── evidence/                   # Minh chứng đã kiểm tra trên thiết bị
└── android/                    # Dự án Android native
```

Phạm vi và quy tắc của từng module nằm trong `src/modules/README.md` và README của từng module.

## Giới hạn hiện tại

- Dữ liệu chưa đồng bộ giữa nhiều điện thoại.
- Check-in/check-out đã tích hợp theo bản tin OneIoT nhưng chưa được xác nhận đầu cuối bằng token và khóa thật.
- Bản Release dùng khóa ký demo của dự án; cần khóa ký riêng trước khi phát hành công khai.
