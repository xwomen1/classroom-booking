# booking_classroom

Ứng dụng React Native phục vụ đề tài đặt phòng học/phòng họp. Bản hiện tại triển khai toàn bộ luồng nghiệp vụ bằng dữ liệu local trên một điện thoại và phân quyền Admin/User.

README này dành cho thành viên phát triển: mô tả phần đã có, cách sửa/chạy kiểm tra code, cách xử lý lỗi môi trường và cách chia module. Hướng dẫn cài APK nhanh cho người chỉ cần sử dụng nằm tại [`../../README.md`](../../README.md).

## Chức năng đã có

- Tìm phòng bằng sơ đồ chữ U theo tầng 1–8; bộ chọn ngày, giờ bắt đầu và giờ kết thúc cuộn dọc; bản đồ phân màu phòng trống, đã đặt, bảo trì và phòng không khớp bộ lọc.
- User có thể đánh dấu phòng cùng khoảng thời gian trên sơ đồ. Màn Đặt phòng tự nhận lựa chọn này, đồng thời vẫn hỗ trợ nhập tên phòng và chọn từ danh sách gợi ý.
- Duyệt booking phòng khóa số tự cấp quyền `User + phòng`: User chỉ được tự tạo mật khẩu ở đúng phòng đã duyệt. Quản lý user chỉ thu hồi quyền theo phòng, không nâng User thành Admin toàn hệ thống.

- Tài khoản demo: Admin `admin/1`, User `user/2`; đăng ký, đăng nhập/đăng xuất, đổi và khôi phục mật khẩu bằng mã cục bộ, hồ sơ cá nhân và thông báo.
- Admin quản lý tài khoản: tìm kiếm, thêm User, khóa/mở, đặt lại mật khẩu, xóa và thu hồi quyền tự tạo mật khẩu theo từng phòng.
- Admin quản lý phòng: tìm kiếm, thêm/sửa/xóa, sức chứa, thiết bị, trạng thái và loại khóa.
- User tìm phòng trực quan theo tầng, ngày giờ, sức chứa, thiết bị và loại khóa; sơ đồ giữ vị trí phòng và hiển thị cả trạng thái trùng booking hoặc bảo trì.
- User gửi yêu cầu đặt phòng. Tầng dịch vụ kiểm tra ngày/giờ hợp lệ, khoảng đặt trước, phòng bảo trì, trùng phòng, trùng lịch User và giới hạn booking đang hoạt động.
- Admin duyệt/từ chối, đổi sang phòng khả dụng trước hạn và nhận thông báo thay đổi.
- `Lịch đặt phòng` chỉ đọc và phân nhóm sắp tới/đã dùng/đã đóng. `Quản lý đặt phòng` mới chứa thao tác rút/hủy, mã truy cập và ủy quyền nhận khóa.
- Phòng khóa mã số: duyệt booking tự cấp quyền cho User tại đúng phòng; Admin có thể tạo mã hộ hoặc thu hồi quyền phòng trong Quản lý user; thời gian đệm hiệu lực cấu hình được, mã bị thu hồi khi hủy/đổi phòng.
- Phòng khóa cơ/thẻ: Admin tạo lịch hẹn nhận khóa; User khai báo người nhận hộ và mã sinh viên/cán bộ.
- Admin xem lịch sử dụng, tạo/hủy lịch bảo trì và sửa các tham số đặt trước, giới hạn, hạn hủy, hạn đổi phòng, thời gian mã và thông báo.
- Toàn bộ dữ liệu trên được lưu bằng Async Storage và tiếp tục tồn tại sau khi tắt/mở ứng dụng.

Các luồng trên đã được chạy thử trực tiếp trên Samsung M21 (SM-M215F). Ảnh màn hình và biên bản kiểm tra nằm trong thư mục `evidence/`.

Hai tài khoản ban đầu được khai báo trong `src/modules/auth/model/demoAccounts.ts`. Tài khoản, hồ sơ, phòng, cấu hình, bảo trì, booking, quyền truy cập và thông báo đều được lưu cục bộ bằng Async Storage. Mã hiện chỉ mô phỏng trong app và chưa được gửi tới khóa thật. Dịch vụ Java, cơ sở dữ liệu máy chủ và đồng bộ nhiều thiết bị chưa được triển khai.

## Công nghệ và môi trường đã kiểm tra

- React Native `0.86.2`
- React `19.2.3`
- TypeScript `5.8.x`
- React Native Community CLI `20.1.0`
- Async Storage `3.1.1`
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

SHA-256 của bản hiện tại: `A4B1BFCAE01B6A863033A2C5960797FB0E36C5BCFC01517CC37D73E08E13A684`.

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
│   ├── room_management/     # Dữ liệu phòng mẫu và loại khóa
│   ├── booking/             # Tạo, duyệt, từ chối, xem và hủy booking
│   ├── access_control/      # Sinh và tính hiệu lực mã số tạm thời
│   ├── schedule_maintenance/# Lịch sử dụng và lịch bảo trì
│   ├── profile/             # Thông tin cá nhân
│   ├── notifications/       # Thông báo nghiệp vụ
│   └── configuration/       # Tham số và chính sách hệ thống
├── __tests__/auth.test.ts   # Kiểm tra đăng nhập, đăng ký và đổi mật khẩu
├── __tests__/booking.test.ts # Kiểm tra booking, phê duyệt và tạo mã
├── __tests__/businessRules.test.ts # Kiểm tra phân quyền và quy tắc liên module
├── scripts/build-debug.ps1  # Build khi đường dẫn Windows có ký tự Unicode
├── scripts/build-release.ps1 # Build APK độc lập khi đường dẫn có Unicode
├── evidence/                # Ảnh và kết quả kiểm tra trên Samsung M21
├── release/                 # APK độc lập đã build và mã SHA-256
└── android/                 # Dự án Android native do React Native tạo
```

Mỗi module có `README.md` ghi chức năng con, business rules, ranh giới và trạng thái. Thành viên chỉ nhận module được phân công; các phần dùng chung đưa vào `core` hoặc `shared`. Bảng phân công và cấu trúc con chuẩn nằm tại [`src/modules/README.md`](src/modules/README.md).
