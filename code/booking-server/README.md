# booking-server

Backend Java/Spring Boot đồng bộ tài khoản, hồ sơ, phòng, cấu hình, booking, bảo trì, quyền tạo PIN, SmartLock và thông báo. Server hỗ trợ H2 local và H2 SSL từ xa; mặc định chạy local để phát triển không cần Internet.

## Chạy local mặc định

```powershell
cd code\booking-server
mvn spring-boot:run
```

Dữ liệu được lưu tại `data/booking`. Thư mục này bị Git bỏ qua.

Muốn mỗi lần chạy có một database sạch trong RAM để kiểm thử:

```powershell
mvn spring-boot:run "-Dspring-boot.run.arguments=--spring.datasource.url=jdbc:h2:mem:bookingtest;DB_CLOSE_DELAY=-1"
```

Nếu Maven báo không tìm thấy class khi project nằm trong đường dẫn Windows có dấu, ánh xạ thư mục `classroom-booking` sang một ổ đĩa ASCII rồi chạy lại, ví dụ:

```powershell
subst Q: "C:\duong-dan\toi\classroom-booking"
cd Q:\code\booking-server
mvn spring-boot:run
```

## Bật cơ sở dữ liệu từ xa

Chỉ bật khi cần kiểm tra database H2 SSL:

```powershell
mvn spring-boot:run -Dspring-boot.run.profiles=remote
```

Profile `remote` sử dụng cấu hình tại `src/main/resources/application-remote.properties`. Có thể thay thông tin theo từng máy bằng biến môi trường:

- `BOOKING_DB_URL`
- `BOOKING_DB_USERNAME`
- `BOOKING_DB_PASSWORD`

Cũng có thể tạo `application-local.properties` ở thư mục chạy server để ghi đè cấu hình. Tệp này đã được `.gitignore` loại trừ.

## Bật đồng bộ trong ứng dụng

Server và app có cấu hình độc lập. Source ứng dụng tại `../booking_classroom/src/core/config/runtimeFlags.ts` hiện đã để:

```ts
export const ENABLE_REMOTE_SYNC = true;
```

`REMOTE_API_BASE_URL` trong source hiện là một URL tunnel thử nghiệm; kiểm tra server còn hoạt động và đặt lại URL cho môi trường đang chạy. Nếu đổi URL sang `http://127.0.0.1:8080` để gọi server trên máy tính qua điện thoại đang nối ADB, chuyển tiếp cổng trước khi mở app:

```powershell
adb reverse tcp:8080 tcp:8080
```

Để app chạy hoàn toàn local, đổi cờ thành `false` trong bản build. Hai nhánh local và REST không tự đồng bộ dữ liệu cho nhau khi đổi cờ; test H2 trong RAM cũng không thay thế kiểm thử server công khai hoặc nhiều điện thoại.

## Kiểm thử tích hợp

```powershell
mvn test
```

Test dùng H2 trong RAM và kiểm tra đăng nhập, hồ sơ, đặt phòng lặp, duyệt chuỗi, tạo/cập nhật PIN, giới hạn dữ liệu booking theo từng tài khoản và duyệt tự động. Trường cấu hình hoặc loại phòng mới nếu bị client cũ bỏ qua trong yêu cầu cập nhật sẽ giữ giá trị hiện có. Mỗi ca tích hợp khởi tạo lại H2 để không dùng dữ liệu của ca trước.
