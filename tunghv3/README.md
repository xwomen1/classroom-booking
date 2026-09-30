# SmartLock gateway cho Booking Classroom

Gateway này đưa phần phát lệnh của `tools/smartlock_test_tool.py` vào luồng sử
dụng của app. App gọi HTTP tới gateway; gateway mã hóa mật khẩu và phát trait
`traitCreateTmpPasswordLock` lên OneIoT cho một SmartLock duy nhất.

## Chuẩn bị

1. Mở `gateway_config.py` và tự nhập token test vào `ONEIOT_TOKEN`.
2. Cài thư viện và chạy:

```powershell
cd final_project\tunghv3
python -m pip install -r requirements.txt
.\run_gateway.ps1
```

Gateway lắng nghe tại cổng `8135`. Điện thoại và máy tính cần ở cùng mạng Wi-Fi.
Trong màn hình **Quản lý khóa**, nhập địa chỉ IP của máy tính, ví dụ:

```text
http://192.168.1.10:8135
```

## API dùng bởi app

- `GET /api/lock/status`: trạng thái gateway và OneIoT.
- `POST /api/lock/temp-password`: tạo mật khẩu tạm thời trên khóa.

Gateway chỉ nhận lệnh cho khóa được khai báo trong `gateway_config.py`. Việc khóa
đang gắn với phòng nào được quản lý tại app; app chỉ gọi gateway khi phòng của
lượt đặt trùng với phòng đang gắn khóa.
