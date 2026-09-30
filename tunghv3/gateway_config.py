"""Cấu hình cho gateway một SmartLock dùng bởi ứng dụng đặt phòng."""

ONEIOT_BROKER = "oneiot.com.vn"
ONEIOT_PORT = 2111
ONEIOT_CSE_ID = "/in-cse"

# Danh tính MQTT của tool/backend. Tự nhập token test trước khi chạy.
ONEIOT_DEVICE_ID = "S0a92253e-6f4b-472e-86a8-e25a3853cd11"
ONEIOT_TOKEN = ""

# Khóa duy nhất được gateway quản lý.
SMARTLOCK_AE_ID = "S0a92253e-6f4b-472e-86a8-e25a3853cd11"
SMARTLOCK_DEVICE_ID = "S3073a30b-e5c0-4370-a186-643ed93efb09"
SMARTLOCK_DEVICE_NAME = "SMARTLOCK_device_55132471"
SMARTLOCK_MODEL = "DLWA12"

HTTP_HOST = "0.0.0.0"
HTTP_PORT = 8135
VERIFY_TLS = False
MQTT_QOS = 1
