# booking_classroom

Ứng dụng React Native phục vụ đề tài đặt phòng học/phòng họp. Bản hiện tại tập trung vào luồng đăng nhập cục bộ và điều hướng giao diện theo vai trò.

## Chức năng đã có

- Đăng nhập bằng hai tài khoản demo:
  - Quản trị viên: `admin` / `1`
  - Người dùng: `user` / `2`
- Hiển thị dashboard khác nhau cho chế độ quản trị viên và người dùng.
- Báo lỗi khi thiếu hoặc sai thông tin đăng nhập.
- Đăng xuất để quay về màn hình đăng nhập.

Các luồng trên đã được chạy thử trực tiếp trên Samsung M21 (SM-M215F). Ảnh màn hình và biên bản kiểm tra nằm trong thư mục `evidence/`.

Tài khoản đang được khai báo cục bộ trong `src/auth.ts` để demo trên một điện thoại. Không dùng cách này cho tài khoản thật. Dịch vụ Java, cơ sở dữ liệu và xác thực qua server chưa được triển khai.

## Công nghệ và môi trường đã kiểm tra

- React Native `0.86.2`
- React `19.2.3`
- TypeScript `5.8.x`
- React Native Community CLI `20.1.0`
- Node.js `22.23.2`
- Microsoft OpenJDK `17.0.20`
- Android SDK/Platform Tools và smartphone Android thật

## Clone và cài dependency

```powershell
git clone <URL_REPOSITORY>
cd <THU_MUC_REPOSITORY>\code\booking_classroom
npm ci
```

Nếu repository chỉ chứa riêng source ứng dụng, vào trực tiếp thư mục vừa clone rồi chạy `npm ci`.

## Chuẩn bị điện thoại Android

1. Bật **Developer options** và **USB debugging** trên điện thoại.
2. Cắm cáp có truyền dữ liệu, mở khóa điện thoại và chấp nhận **Allow USB debugging**.
3. Kiểm tra kết nối:

```powershell
adb devices -l
```

Thiết bị phải có trạng thái `device`. Nếu hiện `unauthorized`, rút/cắm lại cáp hoặc chạy:

```powershell
adb kill-server
adb start-server
adb devices -l
```

Sau đó chấp nhận lại hộp thoại cấp quyền trên điện thoại.

## Chạy bản Debug trên điện thoại

Mở PowerShell thứ nhất tại thư mục dự án:

```powershell
npm start
```

Giữ Metro hoạt động. Mở PowerShell thứ hai tại cùng thư mục:

```powershell
adb reverse tcp:8081 tcp:8081
npm run android
```

Bản Debug cần kết nối Metro để tải JavaScript. Sau khi rút và cắm lại cáp, chạy lại `adb reverse tcp:8081 tcp:8081` nếu ứng dụng không kết nối được Metro.

Nếu `npm run android` lỗi do đường dẫn có ký tự tiếng Việt, dùng quy trình build và nạp thủ công ở mục kế tiếp.

## Build và nạp APK Debug thủ công

Vì đường dẫn workspace hiện có ký tự tiếng Việt, hãy dùng script kèm dự án. Script ánh xạ tạm một ổ đĩa không dấu, build xong rồi tự gỡ ánh xạ:

```powershell
npm run build:android:debug
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:8081 tcp:8081
```

Nếu clone dự án vào đường dẫn chỉ có ký tự ASCII, có thể build trực tiếp:

```powershell
cd android
.\gradlew.bat assembleDebug
cd ..
```

APK được tạo tại:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Build APK chạy độc lập và cài sang máy khác

Bản Release đóng gói JavaScript trong APK nên không cần Metro, cáp USB hoặc máy tính sau khi đã cài đặt:

```powershell
npm run build:android:release
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
```

APK độc lập được tạo tại:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Một bản đã build sẵn nằm tại:

```text
release/booking_classroom-v1.0.apk
```

Cài bản có sẵn qua ADB:

```powershell
adb install -r .\release\booking_classroom-v1.0.apk
```

Để cài trên điện thoại khác, gửi tệp `release/booking_classroom-v1.0.apk` sang máy đó, cho phép cài ứng dụng không rõ nguồn gốc khi Android yêu cầu, rồi mở APK để cài. Hai tài khoản demo tiếp tục hoạt động hoàn toàn cục bộ và không cần mạng.

Bản Release đã được kiểm tra bằng cách xóa `adb reverse`, tắt hẳn ứng dụng rồi mở lại trên Samsung M21. Cả hai chế độ `admin/1` và `user/2` hoạt động khi Metro không chạy.

Bản Release hiện được ký bằng khóa demo của dự án để phục vụ kiểm thử môn học. Trước khi phát hành công khai hoặc đưa lên cửa hàng ứng dụng cần tạo khóa ký riêng và giữ khóa đó để ký các bản cập nhật sau.

## Kiểm tra source

```powershell
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

## Cấu trúc chính

```text
booking_classroom/
├── App.tsx                  # Ghép luồng màn hình cấp ứng dụng
├── src/app/                 # App shell và dashboard demo hiện tại
├── src/core/                # Kiểu dữ liệu, hợp đồng dùng chung
├── src/shared/              # Thành phần dùng lại giữa nhiều module
├── src/modules/             # Các module nghiệp vụ độc lập
│   ├── auth/                # Xác thực; phần đăng nhập demo đã có
│   ├── account_management/  # Quản lý tài khoản và phân quyền
│   ├── room_management/     # Phòng, thiết bị, trạng thái, loại khóa
│   ├── booking/             # Tìm, đặt, duyệt, hủy và đổi phòng
│   ├── access_control/      # Khóa cơ/thẻ từ và mã số tạm thời
│   ├── schedule_maintenance/# Lịch sử dụng và lịch bảo trì
│   ├── profile/             # Thông tin cá nhân
│   ├── notifications/       # Thông báo nghiệp vụ
│   └── configuration/       # Tham số và chính sách hệ thống
├── __tests__/auth.test.ts   # Kiểm tra hai tài khoản và trường hợp sai
├── scripts/build-debug.ps1  # Build khi đường dẫn Windows có ký tự Unicode
├── scripts/build-release.ps1 # Build APK độc lập khi đường dẫn có Unicode
├── evidence/                # Ảnh và kết quả kiểm tra trên Samsung M21
├── release/                 # APK độc lập đã build và mã SHA-256
└── android/                 # Dự án Android native do React Native tạo
```

Mỗi module có `README.md` ghi chức năng con, business rules, ranh giới và trạng thái. Thành viên chỉ nhận module được phân công; các phần dùng chung đưa vào `core` hoặc `shared`.

## Phạm vi tiếp theo

- Tạo chức năng quản lý phòng cho quản trị viên.
- Tạo tra cứu và đặt phòng cho người dùng.
- Xây dựng dịch vụ Java và cơ sở dữ liệu.
- Chuyển xác thực và phân quyền từ dữ liệu cục bộ sang server.
- Bổ sung kiểm thử trên thiết bị và bản Release chạy độc lập.
