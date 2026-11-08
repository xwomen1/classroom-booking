# RoomHub — Đặt và quản lý phòng học, phòng họp

RoomHub là ứng dụng Android viết bằng React Native/TypeScript. Người dùng tìm và đặt phòng; quản trị viên duyệt yêu cầu, quản lý phòng, bảo trì và quyền tiếp cận. Dữ liệu có thể lưu trên điện thoại hoặc dùng API Java/Spring Boot.

**Để tải code, cài app và dùng thử trên điện thoại, làm lần lượt các bước 1–6 bên dưới.** Chọn chế độ **local** trong bước 3 để thử ứng dụng độc lập. Source trên `main` hiện bật **REST**, vì vậy cần đổi cấu hình trước khi build bản local.

- [Chuẩn bị máy tính](#1-chuẩn-bị-máy-tính)
- [Tải mã nguồn](#2-tải-mã-nguồn-và-cài-phụ-thuộc)
- [Chọn chế độ dữ liệu](#3-chọn-chế-độ-dữ-liệu-trước-khi-build)
- [Kết nối điện thoại](#4-kết-nối-điện-thoại-android)
- [Build và cài APK](#5-build-và-cài-apk-release)
- [Đăng nhập và sử dụng](#6-đăng-nhập-và-thử-luồng-đặt-phòng)
- [Chạy với backend](#7-chạy-app-với-backend-java)
- [Khắc phục lỗi](#8-các-lỗi-thường-gặp)
- [Phát triển, kiểm thử và tài liệu](#9-phát-triển-kiểm-thử-và-tài-liệu)

## 1. Chuẩn bị máy tính

| Thành phần | Cấu hình của dự án / việc cần chuẩn bị |
| --- | --- |
| Git | Dùng để tải repository. |
| Node.js và npm | `package.json` yêu cầu Node **từ 22.11.0**; dùng npm và `package-lock.json` của dự án. |
| JDK | **JDK 17**; đặt `JAVA_HOME` tới thư mục JDK và đưa thư mục `bin` của JDK vào `PATH`. |
| Android Studio / Android SDK | Trong SDK Manager, cài **Android SDK Platform 36**, **Build-Tools 36.0.0**, **Platform-Tools**, **Command-line Tools** và **NDK (Side by side) 27.1.12297006**. Chấp nhận các SDK license khi cài. |
| Đường dẫn Android SDK | Đặt `ANDROID_HOME` tới thư mục SDK và thêm `<SDK>/platform-tools` vào `PATH` để dùng `adb`. Nếu Gradle yêu cầu, cài thêm CMake trong SDK Tools. |
| Điện thoại | Android **7.0/API 24 trở lên**, cáp USB truyền dữ liệu, bật USB debugging theo bước 4. |
| Backend | Chỉ khi dùng chế độ REST: cài thêm Maven; backend dùng Java 17. |

Đường dẫn SDK thường gặp:

- Windows: `%LOCALAPPDATA%\Android\Sdk`.
- macOS: `~/Library/Android/sdk`.
- Linux: `~/Android/Sdk`, hoặc đường dẫn đã chọn khi cài Android Studio.

Nếu đã cài SDK ở nơi khác, dùng đúng đường dẫn trên máy. Sau khi thiết lập biến môi trường, mở terminal mới và kiểm tra:

- **Windows:** mở “Edit environment variables for your account”; đặt `JAVA_HOME` tới thư mục JDK 17 (không phải thư mục `bin`), `ANDROID_HOME` tới SDK, rồi thêm `%JAVA_HOME%\bin` và `%ANDROID_HOME%\platform-tools` vào `Path`.
- **macOS:** nếu JDK 17 đã được cài và SDK ở đường dẫn mặc định, có thể đặt cho terminal hiện tại:

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

- **Linux:** đặt hai biến tới thư mục JDK 17 và SDK thực tế trên máy; đưa `bin` của JDK và `platform-tools` của SDK vào `PATH`.

Kiểm tra các công cụ trước khi tải dependency:

```sh
node --version
npm --version
java -version
adb version
```

Lần build đầu cần Internet để tải Gradle, Android dependency và thư viện npm. Dự án đã có **Gradle wrapper 9.3.1**, không cần tự cài Gradle toàn hệ thống. Trên Windows nên đặt repo ở đường dẫn ngắn, không dấu, ví dụ `C:\Projects\classroom-booking`.

## 2. Tải mã nguồn và cài phụ thuộc

```sh
git clone --branch main https://github.com/xwomen1/classroom-booking.git
cd classroom-booking
```

Thư mục `classroom-booking/` vừa tải là **gốc repository**. Các đường dẫn `code/...` trong hướng dẫn tính từ đây.

Cài dependency của ứng dụng:

```sh
cd code/booking_classroom
npm ci
```

Giữ terminal ở `classroom-booking/code/booking_classroom/` để thực hiện các lệnh build/cài app bên dưới. Dùng `npm ci` để cài đúng phiên bản trong lockfile.

## 3. Chọn chế độ dữ liệu trước khi build

Mở tệp [code/booking_classroom/src/core/config/runtimeFlags.ts](code/booking_classroom/src/core/config/runtimeFlags.ts).

| Cách sử dụng | Cấu hình |
| --- | --- |
| Dùng thử trên một điện thoại, không cần server | `ENABLE_REMOTE_SYNC = false` — local bằng Async Storage. |
| Dùng dữ liệu từ backend Java | `ENABLE_REMOTE_SYNC = true` và đặt `REMOTE_API_BASE_URL` theo bước 7. |

**Cài bản local để bắt đầu:** chỉ sửa dòng công tắc trong tệp thành:

```ts
export const ENABLE_REMOTE_SYNC = false;
```

Với local, URL API không được dùng cho nghiệp vụ đặt phòng. App có sẵn dữ liệu mẫu và tài khoản thử nghiệm trên thiết bị.

Source trên `main` hiện để `true` và trỏ tới một URL tunnel thử nghiệm. Muốn dùng REST, tự chạy backend và đặt URL phù hợp; các bước cụ thể ở [bước 7](#7-chạy-app-với-backend-java).

**Sau mỗi lần đổi tệp cấu hình, build và cài lại APK Release.** Local và REST là hai nguồn dữ liệu riêng; đổi công tắc không tự chuyển dữ liệu giữa điện thoại và server. Kết nối OneIoT/SmartLock hoạt động độc lập với công tắc REST.

## 4. Kết nối điện thoại Android

1. Trên điện thoại, mở **Cài đặt → Thông tin điện thoại → Thông tin phần mềm**, chạm **Số hiệu bản tạo/Build number** bảy lần để bật tùy chọn nhà phát triển. Tên menu có thể khác tùy hãng.
2. Mở **Tùy chọn nhà phát triển**, bật **USB debugging/Gỡ lỗi USB**.
3. Nối điện thoại với máy tính bằng cáp truyền dữ liệu, mở khóa điện thoại và chấp nhận **Allow USB debugging/Cho phép gỡ lỗi USB**.
4. Trong terminal, kiểm tra:

```sh
adb devices -l
```

Thiết bị phải có trạng thái **`device`**. Nếu hiện `unauthorized`, chấp nhận hộp thoại trên điện thoại rồi kiểm tra lại. Nếu không thấy thiết bị, kiểm tra cáp/chế độ USB; trên Windows có thể cần USB driver của hãng.

Các lệnh sau giả định chỉ có một điện thoại/máy ảo kết nối. Nếu có nhiều thiết bị, dùng tùy chọn `adb -s` với mã thiết bị muốn cài.

## 5. Build và cài APK Release

Thực hiện từ `classroom-booking/code/booking_classroom/` sau khi hoàn tất cấu hình và `npm ci`.

### Windows — PowerShell

```powershell
npm run build:android:release
```

Script tự tạo JavaScript bundle và dùng ổ đĩa tạm `R:`, `S:`, `T:` hoặc `U:` để xử lý đường dẫn Windows. Cần ít nhất một ký tự ổ đĩa này còn trống.

### macOS / Linux — terminal

Script npm ở trên gọi PowerShell và `subst` của Windows. Với macOS/Linux, tạo bundle rồi dùng Gradle wrapper:

```sh
mkdir -p android/app/src/main/assets
node node_modules/react-native/cli.js bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android
sh ./gradlew assembleRelease
cd ..
```

**Bước tạo bundle là bắt buộc với cấu hình Release hiện tại.** `android/app/build.gradle` đã tắt tác vụ bundle tự động cho Release để dùng bundle do script tạo; chỉ chạy `assembleRelease` chưa tạo mới JavaScript bundle.

### Cài và mở ứng dụng

Sau khi build thành công, APK nằm tại:

```text
code/booking_classroom/android/app/build/outputs/apk/release/app-release.apk
```

Từ thư mục app, cài APK lên điện thoại:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.bookingclassroom/.MainActivity
```

Có thể mở bằng biểu tượng **RoomHub** trên điện thoại. `-r` cập nhật app và giữ dữ liệu đang có nếu chữ ký tương thích. Nếu Android hỏi quyền thông báo, chọn cho phép để thử thông báo hệ thống.

**Bản Release local chạy không cần Metro, backend hoặc cáp USB sau khi cài.** Có thể chép APK vừa build sang điện thoại khác, mở tệp APK và cấp quyền cài ứng dụng cho trình quản lý tệp khi Android yêu cầu. APK là đầu ra build, không lưu trong Git.

## 6. Đăng nhập và thử luồng đặt phòng

Tài khoản dữ liệu mẫu khi khởi tạo:

| Vai trò | Tên đăng nhập | Mật khẩu |
| --- | --- | --- |
| Quản trị viên | `admin` | `1` |
| Người dùng | `user` | `2` |

Nếu đã cài app và đổi tài khoản/cấu hình trước đó, việc cài đè giữ nguyên dữ liệu cũ. App cũng cho phép đăng ký tài khoản mới.

Thử một vòng đặt–duyệt phòng trên cùng điện thoại:

1. Đăng nhập **user**, mở **Tìm và đặt phòng**; chọn tầng, phòng trống, ngày và khoảng giờ, nhập mục đích rồi gửi yêu cầu.
2. Cấu hình ban đầu cho đặt trước **1–3 ngày**, tối đa **2 lượt đang hoạt động** mỗi user. Có thể chọn ngày mai; nếu quản trị viên đã đổi cấu hình, áp dụng giá trị hiện có.
3. Đăng xuất user, đăng nhập **admin**, mở danh sách yêu cầu đặt phòng và duyệt yêu cầu vừa tạo.
4. Đăng nhập lại user, mở **Đặt phòng của tôi** để kiểm tra trạng thái đã duyệt và thao tác phù hợp với loại khóa.

Mặc định tự động duyệt tắt. Nếu admin bật tự động duyệt, phòng thường được duyệt ngay khi yêu cầu hợp lệ; phòng đánh dấu cần duyệt vẫn chờ admin. Tài khoản, phòng, booking và cấu hình local được lưu trên chính điện thoại; một máy local khác có dữ liệu riêng.

### Các chức năng khác

- Admin quản lý tài khoản, phòng/bảo trì theo tầng, cấu hình quy tắc, nhận chìa và ghi nhận vắng mặt.
- User đặt lặp theo tuần, sửa/hủy theo điều kiện, trao đổi giờ nhận chìa, gửi ghi chú hoặc yêu cầu bảo trì; ghi chú và yêu cầu bảo trì là hai luồng riêng.
- Hồ sơ, mật khẩu và thông báo nằm trong nhóm chức năng tài khoản.
- Với phòng khóa số, quyền tạo PIN gắn với booking đã duyệt và đúng phòng. Tạo PIN trên app và gửi PIN tới khóa là các bước riêng.

### Khi cần thử SmartLock thật

Admin gắn khóa vào phòng phù hợp. Người có quyền nhập token OneIoT và kết nối trong phiên; app dùng module Android MQTT TLS để gửi mã tạm và nhận bản tin khóa. Token giữ trong RAM của phiên, ngắt khi đăng xuất/đưa app xuống nền. Không đưa token thật vào source hoặc tài liệu.

Để thử đặt và duyệt phòng local ở các bước trên, chưa cần kết nối khóa thật. Broker xác nhận nhận lệnh chưa có nghĩa khóa đã áp PIN; phần đầu cuối với khóa thật cần môi trường và minh chứng riêng.

## 7. Chạy app với backend Java

Phần này dành cho chế độ REST thay cho local. Backend mặc định dùng H2 file trên máy chạy server; không cần kích hoạt profile cơ sở dữ liệu từ xa để bắt đầu.

### 7.1. Mở backend

Mở terminal riêng tại **gốc repository**:

```sh
cd code/booking-server
java -version
mvn -version
mvn spring-boot:run
```

Giữ terminal này chạy. Server lắng nghe cổng **8080**, dữ liệu mặc định ở `code/booking-server/data/booking`. Tài khoản mẫu được khởi tạo trong backend khi chưa có.

### 7.2. Kết nối điện thoại qua cáp USB

Trong `code/booking_classroom/src/core/config/runtimeFlags.ts`, đặt:

```ts
export const ENABLE_REMOTE_SYNC = true;
export const REMOTE_API_BASE_URL = 'http://127.0.0.1:8080';
```

Chạy lệnh chuyển tiếp cổng trong terminal khác:

```sh
adb reverse tcp:8080 tcp:8080
```

Build và cài lại APK theo bước 5, rồi mở app. Kết nối REST theo cách này cần backend đang chạy và kết nối ADB; sau khi rút/cắm lại cáp hoặc khởi động lại thiết bị, kiểm tra/chạy lại `adb reverse`. APK Release vẫn không cần Metro.

### 7.3. Dùng Wi-Fi hoặc server có URL riêng

- Đặt điện thoại và máy chạy backend trên cùng mạng; lấy địa chỉ IPv4 LAN của máy chạy backend.
- Đổi `REMOTE_API_BASE_URL` thành địa chỉ máy đó với cổng 8080, ví dụ **`http://192.168.1.10:8080`**. Đây là ví dụ; thay bằng IP thực tế.
- Cho phép kết nối tới cổng 8080 trong firewall của máy chạy server, rồi build/cài lại APK.
- Nếu dùng server/tunnel bên ngoài, đặt URL đang hoạt động của môi trường đó. URL tunnel có sẵn trong source là địa chỉ thử nghiệm, không phải dịch vụ được bảo đảm luôn chạy.

Hai điện thoại muốn dùng chung dữ liệu nghiệp vụ phải cùng dùng chế độ REST và cùng backend. Chỉ đổi `false` thành `true` không tải các booking local trước đó lên server. Hướng dẫn H2 từ xa và các biến `BOOKING_DB_*` nằm tại [README backend](code/booking-server/README.md).

## 8. Các lỗi thường gặp

| Hiện tượng | Cách kiểm tra / xử lý |
| --- | --- |
| Không nhận `node`, `java` hoặc `adb` | Kiểm tra cài đặt, `JAVA_HOME`, `ANDROID_HOME`, `PATH`, rồi mở terminal mới. |
| `SDK location not found` | Đặt `ANDROID_HOME` đúng thư mục SDK; hoặc tạo `code/booking_classroom/android/local.properties` với `sdk.dir` trỏ tới SDK trên máy. Tệp cấu hình máy này được Git bỏ qua. |
| Thiếu SDK/Build-Tools/NDK hoặc license | Mở Android Studio → SDK Manager, cài đúng các phiên bản ở bước 1 và chấp nhận license. |
| `adb devices` hiện `unauthorized` | Mở khóa điện thoại, chấp nhận quyền USB debugging; thử rút/cắm lại cáp. |
| PowerShell báo không có ổ tạm trống | Giải phóng một ký tự ổ `R:`, `S:`, `T:` hoặc `U:` hoặc điều chỉnh môi trường ổ đĩa trước khi chạy script. |
| Không đăng nhập được, báo không kết nối máy chủ/timeout | Kiểm tra APK được build ở local hay REST. Local cần `false`; REST cần đúng URL, backend đang chạy và đường mạng/ADB reverse tương ứng. Đổi source xong phải build/cài lại Release. |
| Không tìm thấy JavaScript bundle hoặc app yêu cầu Metro ở bản Release | Tạo lại bundle và APK theo đầy đủ bước 5; kiểm tra đang cài `app-release.apk`, không phải `app-debug.apk`. |
| Cài đè báo `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Bản đang cài và APK mới khác chữ ký. Dùng bản cùng chữ ký; nếu chọn cài mới, sao lưu dữ liệu cần giữ trước vì gỡ app sẽ xóa dữ liệu local. |
| Bị từ chối đặt phòng | Kiểm tra ngày đặt trước, hạn mức, phòng/giờ trùng, bảo trì và khoảng giờ hợp lệ. Admin xem lại cấu hình đang áp dụng. |
| Dữ liệu khác nhau giữa các điện thoại | Kiểm tra có đang chạy local trên từng máy hay không; dùng cùng backend REST nếu muốn dùng chung dữ liệu. |

## 9. Phát triển, kiểm thử và tài liệu

### Chạy Debug với Metro

Từ thư mục app, mở terminal thứ nhất:

```sh
npm start
```

Trong terminal thứ hai, cũng tại thư mục app:

```sh
adb reverse tcp:8081 tcp:8081
npm run android
```

Debug cần Metro. Nếu dùng REST qua USB, giữ thêm chuyển tiếp cổng 8080 của backend. Hướng dẫn build Debug bằng script Windows ở [README ứng dụng](code/booking_classroom/README.md).

### Kiểm tra mã nguồn

Từ `code/booking_classroom/`, chạy lần lượt:

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npx jest --config quality-tests/jest.config.js --runInBand
```

Từ `code/booking-server/`:

```sh
mvn test
```

Phạm vi, dữ liệu và kết quả kiểm thử đã ghi nhận nằm trong [báo cáo kiểm thử](code/booking_classroom/quality-tests/BAO_CAO_KIEM_THU.md) và [biên bản thiết bị](code/booking_classroom/evidence/device-verification.txt).

### Bản đồ repository

| Vị trí | Nội dung |
| --- | --- |
| [code/booking_classroom](code/booking_classroom/) | App React Native, native Android, test và script build. |
| [code/booking-server](code/booking-server/) | Backend Java/Spring Boot, dữ liệu H2 và test tích hợp. |
| [Bản đồ module](code/booking_classroom/src/modules/README.md) | 11 module: auth, account_management, room_management, booking, auto_approval, access_control, smart_lock, schedule_maintenance, configuration, profile, notifications. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc source, trách nhiệm và liên kết giữa các phần. |
| [design](design/) | Source draw.io và sơ đồ thiết kế. |
| [Báo cáo ET4710](docs/reports/final/LTUD/DoAn.pdf) | PDF và source LaTeX trong thư mục LTUD. |
| [Poster ET4710](docs/poster/images/) | Ba phương án poster, gồm bản PNG và JPG. |
| [Báo cáo Lập trình nâng cao](docs/reports/final/LTNC/DoAn.pdf) | PDF và source trong thư mục LTNC. |
| [Ảnh chạy thử](code/booking_classroom/evidence/) | Minh chứng giao diện/thiết bị; ảnh trong báo cáo nằm cùng thư mục báo cáo. |
| [docs/project](docs/project/) | Đề xuất, workflow, hiện trạng, kế hoạch kiểm thử và tài liệu nghiệp vụ. |
| [gia_lap_smartlock](gia_lap_smartlock/) | Simulator SmartLock riêng; đọc README/quy tắc truy cập tại thư mục trước khi thao tác. |
| [oneIot_smartlock](oneIot_smartlock/) | Gateway HTTP–MQTT cũ, giữ để tham khảo; app hiện dùng native MQTT trực tiếp. |

Xem thêm [mục lục tài liệu](docs/README.md). Repository lưu source và tài liệu; `node_modules`, cache, database local, APK và thư mục build được Git bỏ qua.
