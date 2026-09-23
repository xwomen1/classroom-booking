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

**Hiện trạng:** mới tạo khung, chưa triển khai code nghiệp vụ.
