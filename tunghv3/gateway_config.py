"""Cấu hình cho gateway một SmartLock dùng bởi ứng dụng đặt phòng."""

ONEIOT_BROKER = "oneiot.com.vn"
ONEIOT_PORT = 2111
ONEIOT_CSE_ID = "/in-cse"

# Danh tính MQTT của tool/backend. Tự nhập token test trước khi chạy.
ONEIOT_DEVICE_ID = "Sf391c192-3997-4e6c-a31b-abffac140b4c"
ONEIOT_TOKEN = ""

# Khóa duy nhất được gateway quản lý.
SMARTLOCK_AE_ID = "Sdd6f3763-b655-43ad-87d0-3862be2a1201"
SMARTLOCK_DEVICE_ID = "Sdd6f3763-b655-43ad-87d0-3862be2a1201"
SMARTLOCK_DEVICE_NAME = "smartlock_0001"
SMARTLOCK_MODEL = "DLWA12"

HTTP_HOST = "0.0.0.0"
HTTP_PORT = 8135
VERIFY_TLS = False
MQTT_QOS = 1
