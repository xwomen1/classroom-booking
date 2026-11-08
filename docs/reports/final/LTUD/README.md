# Báo cáo cuối kỳ ET4710 — RoomHub

Thư mục chứa báo cáo tổng kết ứng dụng RoomHub, mã nguồn LaTeX, sơ đồ và minh chứng thực nghiệm. Bản PDF hiện hành có **59 trang**, gồm **46 trang nội dung chính**.

## Tài liệu và minh chứng

| Vị trí | Nội dung |
| --- | --- |
| [DoAn.pdf](DoAn.pdf) | Báo cáo hoàn chỉnh để đọc hoặc in. |
| [DoAn.tex](DoAn.tex), [Chuong/](Chuong/) | Nguồn LaTeX: tóm tắt, sáu chương, tài liệu tham khảo và phụ lục. |
| [Thong_tin_nhom.tex](Thong_tin_nhom.tex) | Thành viên, phần việc, tỷ lệ đóng góp và cam kết của nhóm. |
| [Hinhve/](Hinhve/) | Ảnh giao diện Android, logo, chữ ký và sơ đồ minh họa. |
| [Nguồn sơ đồ](Hinhve/design/roomhub_bao_cao.drawio) | Bản Draw.io; các PDF vector được dùng trong báo cáo nằm cùng thư mục. |
| [Mẫu ET4710](ET4710_Template_Bao_cao_Nhom_Hoc_vien_React_Native.docx) | Mẫu báo cáo của học phần. |
| [Hồ sơ kiểm thử](minh_chung/kiem_thu/README.md) | Môi trường, dữ liệu, kết quả tự động, ảnh/XML và các ca Android. |
| [Giao diện cấu hình](minh_chung/giao_dien_cau_hinh/README.md) | Ảnh tham số đặt phòng và công tắc tự duyệt trên APK local. |
| [Đối chiếu ca kiểm thử](minh_chung/doi_chieu_ca_kiem_thu.md) | Ánh xạ các ca trong báo cáo tới tệp kiểm thử và hồ sơ kết quả. |
| [Thống kê Git](minh_chung/thong_ke_git.json), [script tái lập](minh_chung/thong_ke_git.py) | Số liệu quy thuộc mã nguồn và kiểm thử theo thành viên. |

Báo cáo trình bày 8 nhóm yêu cầu chức năng, 4 nhóm phi chức năng, 14 quy tắc nghiệp vụ, 13 use case và 24 nhóm ca kiểm thử. Phần triển khai giữ ánh xạ yêu cầu tới mã nguồn, ma trận kỹ thuật React Native, hai trích đoạn mã cốt lõi và truy vết luồng thực thi.

Hồ sơ kèm theo ghi nhận 50 ca app, 398 ca quality, 5 ca bổ sung quyền thông báo và 6 ca thao tác Android. Kết quả backend/H2 và nghiệm thu app–SmartLock được dẫn theo hồ sơ tương ứng. Dữ liệu gốc giữ nguyên điều kiện và phạm vi kiểm thử của từng bộ.

## Biên dịch PDF

Cần Times New Roman và Tectonic hoặc bộ công cụ XeLaTeX. Chạy tại thư mục này:

```sh
tectonic --keep-logs DoAn.tex
```

Tectonic tự chạy lại để cập nhật mục lục và tham chiếu. Nếu dùng XeLaTeX, biên dịch đủ lần để ổn định các danh mục.

Giữ nguyên vị trí `docs/reports/final/LTUD/` trong repository: hai trích đoạn mã được đọc trực tiếp từ ứng dụng qua đường dẫn tương đối. Ảnh PNG và sơ đồ PDF vector đi kèm là tài nguyên cần để biên dịch.

## Mã nguồn và cài đặt ứng dụng

- [README gốc repository](../../../../README.md): chuẩn bị môi trường, cấu hình local/REST, build và cài APK Android.
- [Ứng dụng React Native](../../../../code/booking_classroom/).
- [Backend Java/Spring Boot](../../../../code/booking-server/).
