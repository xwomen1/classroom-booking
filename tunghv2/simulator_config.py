"""Test identity for the standalone SmartLock simulator."""

ONEIOT_BROKER = "oneiot.com.vn"
ONEIOT_PORT = 2111
ONEIOT_CSE_ID = "/in-cse"

# Same identity as create_device_for_tooltest / pairing bypass.
MQTT_DEVICE_ID = "S3073a30b-e5c0-4370-a186-643ed93efb09"
# Token mặc định để trống; người dùng dán token vào giao diện khi chạy.
MQTT_TOKEN = ""
SMARTLOCK_AE_ID = "S0a92253e-6f4b-472e-86a8-e25a3853cd11"
SMARTLOCK_DEVICE_ID = MQTT_DEVICE_ID
SMARTLOCK_DEVICE_NAME = "SMARTLOCK_device_55132471"
SMARTLOCK_APP_NAME = "main-smartlock_dev2"

SMARTLOCK_MODEL = "DLWA12"
SMARTLOCK_PID = "ohkef8ubxaaesh1i"
SMARTLOCK_HW_VERSION = "WoodenDoor04"
SIMULATOR_FIRMWARE_VERSION = "SIM-1.0.0"
SIMULATOR_MCU_VERSION = "SIM-MCU-1.0.0"

LOCAL_OTA_COMMAND_PORT = 8124
DEFAULT_PERMANENT_PASSWORD = "123456"
AUTO_RELOCK_SECONDS = 5
REMOTE_UNLOCK_COUNTDOWN_SECONDS = 60

# Matches the current firmware rule for DLWA12.
IGNORE_SET_KEY_FOR_NO_CODE = True
