# Module: Auto Approval

**Người dùng:** Admin cấu hình; User hưởng kết quả.

## Chức năng

- Công tắc chung **"Tự động duyệt phòng thường"** trong màn hình *Quy định đặt phòng* (`autoApprovalEnabled`, mặc định **tắt**).
- Mỗi phòng có thêm trường `requiresApproval` (chọn trong form *Quản lý phòng*):
  - **Phòng thường** (`false` hoặc chưa đặt): khi công tắc bật, yêu cầu hợp lệ được duyệt ngay lúc tạo.
  - **Phòng đặc biệt** (`true`): luôn chờ admin duyệt, giống luồng cũ.
- Booking tự duyệt có `status = APPROVED`, `reviewedBy = 'system'`, `autoApproved = true`.
- Sau khi tự duyệt: cấp quyền tự tạo mã cho phòng khóa số, gửi thông báo "Yêu cầu đã được tự động duyệt" cho người đặt và "Đặt phòng được tự động duyệt" cho admin.
- Chuỗi đặt lặp hằng tuần được duyệt cùng lúc mọi lượt.

## Business rules

| Công tắc chung | Loại phòng | Kết quả khi tạo yêu cầu |
| --- | --- | --- |
| Tắt | bất kỳ | `PENDING`, admin duyệt như cũ |
| Bật | Phòng thường | `APPROVED` ngay |
| Bật | Phòng đặc biệt | `PENDING`, admin duyệt như cũ |

Tự duyệt chỉ diễn ra **sau** khi `createBooking` đã kiểm tra đủ luật: định dạng ngày giờ, cửa sổ đặt trước, trùng lịch phòng, trùng lịch cá nhân, bảo trì, giới hạn số yêu cầu. Vì vậy một yêu cầu bị từ chối bởi luật thì vẫn bị từ chối, không có chuyện "tự duyệt vượt luật".

## Vị trí code

- `model/approvalPolicy.ts`: quyết định `AUTO` / `MANUAL` (hàm thuần, dễ test).
- `services/autoApprovalService.ts`: trường gắn vào booking và các bước sau duyệt.
- Điểm gọi duy nhất trong luồng cũ: cuối `createBooking` (`booking/services/bookingRepository.ts`).
- Server: `AutoApprovalPolicy.java` và `BookingService.createBooking` / `autoApprove`, cùng quy tắc như app.

**Hiện trạng:** đã triển khai cả local và server; test ở `__tests__/autoApproval.test.ts` và `RemoteSyncIntegrationTest.autoApprovesNormalRoomsAndKeepsSpecialRoomsForAdmin`.
