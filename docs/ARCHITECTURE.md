# Kiến trúc mã nguồn RoomHub

Tài liệu này mô tả cấu trúc đang có trên `main` và đề xuất hướng tách tiếp. Phần “hiện trạng” phản ánh mã nguồn hiện tại; cấu trúc backend theo module bên dưới là mục tiêu refactor, chưa phải trạng thái đã hoàn thành.

## Bản đồ repository

```text
.
├── code/
│   ├── booking_classroom/       # Frontend React Native cho Android
│   └── booking-server/          # Backend Java 17 / Spring Boot
├── docs/
│   ├── project/
│   │   ├── proposal/
│   │   ├── workflow/
│   │   ├── deployment/
│   │   ├── test-plan/
│   │   ├── assets/
│   │   └── references/
│   ├── reports/
│   │   ├── final/LTNC/          # Source và PDF báo cáo LTNC
│   │   ├── midterm/mid_LTUD/    # Source và PDF báo cáo giữa kỳ
│   │   └── exports/             # PDF xuất rời
│   └── ARCHITECTURE.md          # Bản đồ kiến trúc source
├── gia_lap_smartlock/           # Mô phỏng SmartLock
└── oneIot_smartlock/            # Gateway HTTP–MQTT cũ, để tham khảo
```

`code/` là nơi chứa source ứng dụng; `docs/` gom các tài liệu để thư mục gốc không trộn source với báo cáo. Các thư mục `gia_lap_smartlock/` và `oneIot_smartlock/` vẫn độc lập vì có hướng dẫn build và README riêng.

## Frontend di động

`code/booking_classroom` là ứng dụng React Native/TypeScript. `App.tsx` thiết lập vòng đời cấp ứng dụng; `src/app` ghép các màn hình theo vai trò. `src/modules` chia theo nghiệp vụ: xác thực, tài khoản, phòng, đặt phòng, bảo trì, quyền truy cập, khóa thông minh, thông báo, hồ sơ và cấu hình. Mỗi module hiện có thể chứa `screens`, `components`, `services` và `model`.

`src/core` giữ hạ tầng dùng chung như HTTP client, Async Storage, cấu hình chạy, kiểu dùng chung và tiện ích thời gian. `src/shared` chứa component giao diện dùng lại. Test hiện có ở `__tests__`; bộ kiểm thử chất lượng bổ sung nằm riêng tại `quality-tests` và có cấu hình Jest riêng.

Luồng dữ liệu hiện tại:

```text
Màn hình → repository/service của module → API client hoặc Async Storage
                         ↘ module nghiệp vụ khác
```

Repository thường tự chọn backend hoặc local theo cấu hình. Hiện một số module còn import trực tiếp service/model nội bộ của module khác; đây là điểm cần chuyển dần qua export công khai để giảm phụ thuộc. Quy tắc nghiệp vụ riêng phải ở module sở hữu; chỉ tiện ích tổng quát được nhiều module dùng mới thuộc `core`. Ví dụ, quy tắc hai khoảng thời gian có giao nhau hiện được dùng chung tại `src/core/time/intervals.ts`.

## Backend

`code/booking-server` là một ứng dụng Spring Boot đơn. `BookingServerApplication` khởi chạy server; API controller hiện được chia theo nhóm tại `api/auth`, `api/rooms`, `api/maintenance`, `api/bookings`, `api/access` và `api/notifications`. Các controller vẫn gọi `BookingService`; lớp này đang xử lý phần lớn nghiệp vụ. `Domain` còn gom entity và converter JPA; `security/RequestActor` đọc actor từ request, `SessionAuthFilter` xác thực phiên; `DataSeeder` tạo dữ liệu ban đầu. Cấu hình nằm trong `src/main/resources`, kiểm thử backend trong `src/test`.

Luồng hiện tại:

```text
HTTP request → feature controller → BookingService → EntityManager / Domain entities
```

Đây vẫn là điểm cần refactor lớn nhất: `BookingService` vượt 1.500 dòng và entity tập trung trong một tệp. Controller đã có ranh giới endpoint, nhưng chưa có application service riêng cho từng feature. Chưa nên di chuyển nghiệp vụ và entity cùng lúc vì đặt phòng, bảo trì, khóa và thông báo có quan hệ giao dịch với nhau.

## Hướng cấu trúc đích

Giữ frontend và backend là hai project độc lập dưới `code/`. Trong app, một module chỉ công khai API cần thiết qua `index.ts`; không import sâu vào nội bộ module khác, không tạo phụ thuộc vòng. Phân lớp gọn theo trách nhiệm: màn hình trình bày, use case điều phối nghiệp vụ, repository chọn nguồn dữ liệu, còn API/local data source thực hiện I/O. Không tạo layer hoặc abstraction chỉ để làm đẹp cấu trúc.

Với backend, tách dần theo feature, không chia package trước khi có trách nhiệm rõ:

```text
com.bookingclassroom.server
├── shared/                  # lỗi chung, cấu hình và tiện ích thật sự dùng chung
├── security/                # xác thực request và session
├── auth/                    # API, use case và persistence xác thực/tài khoản
├── rooms/                   # phòng và cấu hình phòng
├── bookings/                # vòng đời booking, lịch lặp, nhận/trả khóa, điểm danh
├── maintenance/             # lịch và yêu cầu bảo trì
├── access/                  # quyền PIN và tích hợp khóa
└── notifications/           # tạo và đọc thông báo
```

Mỗi feature chỉ có các lớp cần thiết, thường là controller/DTO, service nghiệp vụ và repository/entity. Quy tắc nghiệp vụ không nằm trong controller; transaction đặt ở use case ghi dữ liệu. Giao tiếp giữa feature qua service công khai, không truy cập repository nội bộ của nhau. Chia entity từ `Domain` theo feature khi đã tách nơi sử dụng và quan hệ JPA rõ.

## Thứ tự refactor và tiêu chí hoàn thành

1. Giữ nguyên API và hành vi; lập danh sách endpoint, entity, transaction và phụ thuộc chéo trước khi di chuyển.
2. Tách controller theo nhóm endpoint và DTO khỏi `BookingService`; kiểm tra hợp đồng request/response.
3. Chọn một feature có ranh giới rõ, tách service/repository/entity rồi mới áp dụng mẫu đó cho nhóm tiếp theo.
4. Trên app, thay import sâu giữa module bằng export công khai; tách màn hình hoặc repository lớn theo luồng độc lập, không đổi quy tắc nghiệp vụ đồng thời với di chuyển tệp.
5. Sau mỗi lát cắt, giữ test hiện tại chạy được, bổ sung kiểm tra hồi quy cho hợp đồng bị ảnh hưởng và cập nhật tài liệu module.

Refactor được xem là ổn khi mỗi lớp có một trách nhiệm dễ nêu, không còn phụ thuộc vòng, quy tắc giống nhau chỉ có một nơi định nghĩa, API không đổi ngoài chủ đích, và các test liên quan xác nhận hành vi trước/sau tương đương.

## Quy ước clean code

- Tên lớp/hàm thể hiện vai trò; hàm làm một việc và giới hạn tác dụng phụ.
- Tách quy tắc thuần khỏi I/O để có thể đọc và kiểm tra riêng.
- Không lặp quy tắc nghiệp vụ giữa frontend và backend như thể client là nguồn bảo đảm dữ liệu; server vẫn phải xác thực dữ liệu ghi.
- Tránh `Object`, `Map<String, ...>` và kiểu trả về thiếu cụ thể ở API khi DTO rõ ràng hơn.
- Không thêm abstraction, dependency hoặc thư mục rỗng nếu chưa giải quyết một nhu cầu thực tế.
- Tài liệu phải phân biệt tính năng đã có với cấu trúc đang đề xuất; không ghi trạng thái đồng bộ hoặc triển khai khác với cấu hình thật.
