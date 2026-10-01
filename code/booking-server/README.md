# booking-server

Backend Java/Spring Boot được merge từ nhánh `syncdata`. Server hỗ trợ cơ sở dữ liệu local và H2 SSL từ xa, nhưng mặc định luôn chạy local để phát triển không cần mạng.

## Chạy local mặc định

```powershell
cd code\booking-server
mvn spring-boot:run
```

Dữ liệu được lưu tại `data/booking`. Thư mục này bị Git bỏ qua.

## Bật cơ sở dữ liệu từ xa

Chỉ bật khi cần kiểm tra đồng bộ:

```powershell
mvn spring-boot:run -Dspring-boot.run.profiles=remote
```

Profile `remote` sử dụng cấu hình tại `src/main/resources/application-remote.properties` và chỉ khi đó mới nạp truststore H2 SSL. Có thể thay thông tin theo từng máy bằng biến môi trường:

- `BOOKING_DB_URL`
- `BOOKING_DB_USERNAME`
- `BOOKING_DB_PASSWORD`

Cũng có thể tạo `application-local.properties` ở thư mục chạy server để ghi đè cấu hình. Tệp này đã được `.gitignore` loại trừ.

## Bật đồng bộ trong ứng dụng

Server và app có hai công tắc độc lập. Sau khi server sẵn sàng, sửa `../booking_classroom/src/core/config/runtimeFlags.ts`:

```ts
export const ENABLE_REMOTE_SYNC = true;
```

Giữ `false` để app tiếp tục đăng nhập và chạy toàn bộ nghiệp vụ local mà không gọi mạng.
