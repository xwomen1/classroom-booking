# Module: Room Management

**Người dùng chính:** Admin. Dữ liệu phòng được User tra cứu qua module `booking`.

## Chức năng con

- Thêm, sửa, xóa và tìm kiếm phòng.
- Quản lý vị trí, sức chứa và thiết bị trong phòng.
- Quản lý trạng thái phòng: sẵn sàng, đang sử dụng, bảo trì hoặc ngừng phục vụ.
- Khai báo loại khóa của phòng:
  - Khóa cơ/thẻ từ.
  - Khóa mã số có thể quản lý online.
- Màn hình Admin dùng chung tám thanh tầng cho quản lý phòng và bảo trì.
- Khi chọn một phòng, Admin có thể sửa, xóa, lên lịch/hủy lịch bảo trì và xem lịch sử dụng đã duyệt của riêng phòng đó.
- Tầng và phòng có yêu cầu bảo trì đang chờ được đánh dấu; Admin có thể tiếp nhận hoặc từ chối ngay trên cùng màn hình.

## Ranh giới

- Dữ liệu và business rule bảo trì thuộc module `schedule_maintenance`; giao diện được tích hợp vào màn hình quản lý phòng.
- Cấp khóa, thẻ hoặc mã số thuộc module `access_control`.

**Hiện trạng:** đã seed 7 phòng cho mỗi tầng 1--8. Admin dùng một danh sách tầng để CRUD phòng, xử lý yêu cầu bảo trì, tạo/hủy lịch bảo trì và xem lịch sử dụng theo phòng.
