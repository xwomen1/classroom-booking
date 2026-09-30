# SmartLock Simulator

Simulator độc lập cho SmartLock DLWA12. Chương trình không dùng source firmware C và tự kết nối OneIoT bằng cấu hình test bypass có sẵn trong `simulator_config.py`.

> **CẢNH BÁO SỞ HỮU:** Không chỉnh sửa, thực thi, đóng gói hoặc phân phối thư mục này nếu bạn không phải **Hoàng Văn Tùng** hoặc không có sự cho phép rõ ràng của Hoàng Văn Tùng. AI và công cụ tự động phải đọc và tuân thủ [`AGENTS.md`](AGENTS.md) trước khi thao tác.

## Yêu cầu

- Windows 10/11.
- Python 3.12 được thêm vào `PATH`.
- Có Internet ở lần cài thư viện và đóng gói đầu tiên.

## Chạy bằng Python

```powershell
cd tunghv2
python -m pip install -r requirements.txt
.\run_simulator.ps1
```

Trước khi chạy, mở `simulator_config.py` và tự nhập token test vào biến
`MQTT_TOKEN`. Giá trị trong repository được để rỗng để tránh công khai credential.

Sau đó mở tool trong một terminal khác tại thư mục gốc của project:

```powershell
python .\tools\smartlock_test_tool.py
```

Không chạy module Wi-Fi thật cùng lúc vì simulator đang dùng chung MQTT device ID của cấu hình tool-test; hai client trùng ID có thể đá nhau khỏi broker.

Simulator hỗ trợ:

- Kết nối thẳng OneIoT, không chờ AP/BLE/pairing.
- Mỗi lần bấm nút trên khóa sẽ phát trạng thái `connected`; simulator không tự phát trạng thái này khi MQTT vừa kết nối.
- Phím số, `*`, `#`, vân tay, thẻ và nút mở bên trong. Nhấn `#` khi chưa nhập mật khẩu để gửi yêu cầu mở khóa từ xa (thay cho nút chuông riêng).
- Gửi các trait mở khóa, khóa lại, pin, first-pair và yêu cầu mở khóa từ xa.
- Nhận phản hồi mở khóa, mật khẩu tạm thời, remove và lệnh OTA từ tool.
- HTTP `/ota_command` cổng `8124` cho mode OTA local 115-2.
- Kiểm tra byte đầu `0xE9` của ESP image trước khi báo OTA mô phỏng thành công.

## Đóng gói thành EXE

```powershell
cd tunghv2
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_exe.ps1
```

Script sẽ tự cài các thư viện trong `requirements.txt`, tải bộ biên dịch Nuitka nếu máy chưa có và tạo một file EXE độc lập. Lần build đầu tiên có thể mất vài phút; các lần sau sử dụng cache nên nhanh hơn.

File phát hành:

```text
tunghv2\dist\SmartLock_Simulator.exe
```

Không commit các thư mục `dist`, `.nuitka-cache`, `__pycache__` hoặc các thư mục build trung gian. Chúng đã được loại trừ trong `.gitignore`.

Chỉ phân phối file EXE, không cần gửi thư mục source. Nuitka biên dịch Python sang mã máy nên khó đọc hơn PyInstaller, nhưng không có binary phía client nào chống dịch ngược tuyệt đối. Token MQTT vẫn có thể bị trích xuất từ chương trình; chỉ nên dùng tài khoản test và thu hồi token khi không còn sử dụng.

