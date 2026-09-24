# Module: Room Management

**Người dùng chính:** Admin. Dữ liệu phòng được User tra cứu qua module `booking`.

## Chức năng con

- Thêm, sửa, xóa và tìm kiếm phòng.
- Quản lý vị trí, sức chứa và thiết bị trong phòng.
- Quản lý trạng thái phòng: sẵn sàng, đang sử dụng, bảo trì hoặc ngừng phục vụ.
- Khai báo loại khóa của phòng:
  - Khóa cơ/thẻ từ.
  - Khóa mã số có thể quản lý online.

## Ranh giới

- Lịch bảo trì thuộc module `schedule_maintenance`.
- Cấp khóa, thẻ hoặc mã số thuộc module `access_control`.

**Hiện trạng:** đã có dữ liệu local mẫu cho A101 dùng khóa mã số và B202 dùng khóa cơ/thẻ để phục vụ luồng demo booking. CRUD phòng cho Admin chưa được triển khai.
