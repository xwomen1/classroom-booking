"""Test identity for the standalone SmartLock simulator."""

ONEIOT_BROKER = "oneiot.com.vn"
ONEIOT_PORT = 2111
ONEIOT_CSE_ID = "/in-cse"

# Same identity as create_device_for_tooltest / pairing bypass.
MQTT_DEVICE_ID = "Sdd6f3763-b655-43ad-87d0-3862be2a1201"
# Token mặc định để trống; người dùng dán token vào giao diện khi chạy.
MQTT_TOKEN = ""
SMARTLOCK_AE_ID = MQTT_DEVICE_ID
SMARTLOCK_DEVICE_ID = MQTT_DEVICE_ID
SMARTLOCK_DEVICE_NAME = "smartlock_0001"

SMARTLOCK_MODEL = "DLWA12"
SMARTLOCK_PID = "ohkef8ubxaaesh1i"
SMARTLOCK_HW_VERSION = "WoodenDoor04"
SIMULATOR_FIRMWARE_VERSION = "SIM-1.0.0"
SIMULATOR_MCU_VERSION = "SIM-MCU-1.0.0"

LOCAL_OTA_COMMAND_PORT = 8124
DEFAULT_PERMANENT_PASSWORD = "123456"
AUTO_RELOCK_SECONDS = 5
