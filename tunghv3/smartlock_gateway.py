from __future__ import annotations

import hashlib
import json
import ssl
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import gateway_config as cfg


def compact_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def topic_device_to_backend(uid: str) -> str:
    return f"/oneM2M/req/{uid}/{cfg.ONEIOT_CSE_ID.strip('/')}/json"


def topic_backend_to_device(uid: str) -> str:
    return f"/oneM2M/req{cfg.ONEIOT_CSE_ID}/{uid}/json"


def topic_device_response(uid: str) -> str:
    return f"/oneM2M/resp/{uid}/{cfg.ONEIOT_CSE_ID.strip('/')}/json"


def topic_cse_response(uid: str) -> str:
    return f"/oneM2M/resp{cfg.ONEIOT_CSE_ID}/{uid}/json"


def parse_nested_json(value):
    current = value
    for _ in range(5):
        if not isinstance(current, str):
            break
        text = current.strip()
        if not text or text[0] not in "[{":
            break
        try:
            current = json.loads(text)
        except json.JSONDecodeError:
            break
    return current


def walk_json(value):
    value = parse_nested_json(value)
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def find_trait(root):
    for node in walk_json(root):
        if isinstance(node, dict) and node.get("trait"):
            return str(node["trait"]), node
    return None, None


def encrypt_lock_password(
    plain_password: str,
    device_id: str,
    password_id: int,
    start_time: int,
    end_time: int,
) -> str:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    key = hashlib.sha256(("VNPTKEY" + device_id).encode("utf-8")).digest()
    nonce = hashlib.md5(f"{start_time}{end_time}{password_id}".encode("utf-8")).digest()
    encryptor = Cipher(algorithms.AES(key), modes.CTR(nonce)).encryptor()
    encrypted = encryptor.update(plain_password.encode("utf-8")) + encryptor.finalize()
    return encrypted.hex().upper()


def build_temp_password_payload(
    code: str,
    password_id: int,
    start_time: int,
    end_time: int,
):
    now_ms = int(time.time() * 1000)
    trait = "traitCreateTmpPasswordLock"
    record_id = f"{trait}***{password_id}_{now_ms}***Internet"
    request_id = f"create_tmp_password***{password_id}_{now_ms}***Internet"
    encrypted = encrypt_lock_password(
        code,
        cfg.SMARTLOCK_DEVICE_ID,
        password_id,
        start_time,
        end_time,
    )
    password_entry = {
        "passwordID": password_id,
        "usageCount": 0,
        "status": 0,
        "startTime": str(start_time),
        "endTime": str(end_time),
        "password": encrypted,
        "schedule": {
            "statusOfDay": 1,
            "startTimeInDay": "00:00",
            "endTimeInDay": "23:59",
            "dayOfWeek": [0, 1, 2, 3, 4, 5, 6],
        },
    }
    trait_payload = {
        "typeMessage": "control",
        "dataMessage": {
            "connectivityType": "wifi",
            "properties": {
                "command": "updateTrait",
                "data": {
                    "deviceID": cfg.SMARTLOCK_DEVICE_ID,
                    "trait": trait,
                    "numPassword": 1,
                    "passwordList": [password_entry],
                },
            },
        },
        "requestID": record_id,
    }
    command = {
        "commandId": "updateTraitLock",
        "name": "updateTraitLock",
        "data": compact_json(trait_payload),
        "commandType": "control",
        "recordId": record_id,
    }
    request = {
        "fr": cfg.ONEIOT_DEVICE_ID,
        "op": 1,
        "rqi": f"create_tmp_password_{password_id}_{now_ms}",
        "to": f"{cfg.ONEIOT_CSE_ID}/in-name/{cfg.SMARTLOCK_DEVICE_NAME}/cnt_command",
        "ty": 4,
        "tkns": [cfg.ONEIOT_TOKEN],
        "pc": {
            "m2m:cin": {
                "cnf": "text/plains:0",
                "con": compact_json(command),
            }
        },
    }
    return trait, request_id, request


class SmartLockGateway:
    def __init__(self):
        self.client = None
        self.mqtt = None
        self.connected = False
        self.last_error = None
        self.last_command = None
        self.last_response = None
        self.lock = threading.Lock()

    @property
    def configured(self) -> bool:
        return bool(cfg.ONEIOT_DEVICE_ID and cfg.ONEIOT_TOKEN)

    def start(self):
        if not self.configured:
            self.last_error = "Chưa nhập ONEIOT_TOKEN trong gateway_config.py."
            return
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            self.last_error = "Thiếu paho-mqtt. Hãy cài requirements.txt."
            return
        self.mqtt = mqtt
        try:
            client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id=cfg.ONEIOT_DEVICE_ID,
                clean_session=False,
                protocol=mqtt.MQTTv311,
            )
        except (AttributeError, TypeError):
            client = mqtt.Client(
                client_id=cfg.ONEIOT_DEVICE_ID,
                clean_session=False,
                protocol=mqtt.MQTTv311,
            )
        client.username_pw_set(cfg.ONEIOT_DEVICE_ID, cfg.ONEIOT_TOKEN)
        if cfg.VERIFY_TLS:
            client.tls_set()
        else:
            client.tls_set(cert_reqs=ssl.CERT_NONE)
            client.tls_insecure_set(True)
        client.reconnect_delay_set(min_delay=1, max_delay=20)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        self.client = client
        client.connect_async(cfg.ONEIOT_BROKER, cfg.ONEIOT_PORT, keepalive=30)
        client.loop_start()

    @staticmethod
    def _reason_code(reason_code) -> int:
        return int(getattr(reason_code, "value", reason_code))

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        code = self._reason_code(reason_code)
        with self.lock:
            self.connected = code == 0
            self.last_error = None if code == 0 else f"OneIoT từ chối kết nối, rc={code}."
        if code != 0:
            return
        topics = {
            topic_device_to_backend(cfg.SMARTLOCK_AE_ID),
            topic_backend_to_device(cfg.SMARTLOCK_AE_ID),
            topic_device_response(cfg.SMARTLOCK_AE_ID),
            topic_cse_response(cfg.SMARTLOCK_AE_ID),
            topic_device_response(cfg.ONEIOT_DEVICE_ID),
            topic_cse_response(cfg.ONEIOT_DEVICE_ID),
        }
        for topic in topics:
            client.subscribe(topic, qos=cfg.MQTT_QOS)

    def _on_disconnect(self, client, userdata, *args):
        with self.lock:
            self.connected = False
            self.last_error = "Mất kết nối OneIoT; gateway đang tự kết nối lại."

    def _on_message(self, client, userdata, message):
        try:
            root = json.loads(message.payload.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            return
        trait, data = find_trait(root)
        if trait and trait.startswith("traitResponse"):
            with self.lock:
                self.last_response = {
                    "trait": trait,
                    "receivedAt": iso_now(),
                    "data": data,
                }

    def status(self):
        with self.lock:
            return {
                "connected": self.connected,
                "configured": self.configured,
                "lock": {
                    "aeId": cfg.SMARTLOCK_AE_ID,
                    "deviceId": cfg.SMARTLOCK_DEVICE_ID,
                    "deviceName": cfg.SMARTLOCK_DEVICE_NAME,
                    "model": cfg.SMARTLOCK_MODEL,
                },
                "lastCommand": self.last_command,
                "lastResponse": self.last_response,
                "error": self.last_error,
            }

    def publish_temp_password(self, body):
        if not self.configured:
            raise RuntimeError("Chưa nhập ONEIOT_TOKEN trong gateway_config.py.")
        if not self.connected or not self.client:
            raise RuntimeError("Gateway chưa kết nối OneIoT.")
        code = str(body.get("code", "")).strip()
        if not code.isdigit() or not 4 <= len(code) <= 12:
            raise ValueError("Mật khẩu phải gồm 4 đến 12 chữ số.")
        try:
            password_id = int(body.get("passwordId"))
            start_time = int(body.get("startTime"))
            end_time = int(body.get("endTime"))
        except (TypeError, ValueError) as exc:
            raise ValueError("passwordId, startTime và endTime phải là số nguyên.") from exc
        if not 1 <= password_id <= 255:
            raise ValueError("passwordId phải nằm trong khoảng 1 đến 255.")
        if start_time >= end_time:
            raise ValueError("Khoảng hiệu lực mật khẩu không hợp lệ.")
        trait, request_id, payload = build_temp_password_payload(
            code, password_id, start_time, end_time
        )
        topic = topic_device_to_backend(cfg.ONEIOT_DEVICE_ID)
        info = self.client.publish(topic, compact_json(payload), qos=cfg.MQTT_QOS, retain=False)
        if info.rc != self.mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(f"MQTT không nhận lệnh publish, rc={info.rc}.")
        info.wait_for_publish(timeout=5)
        published_at = iso_now()
        with self.lock:
            self.last_command = {
                "trait": trait,
                "passwordId": password_id,
                "roomId": body.get("roomId"),
                "roomName": body.get("roomName"),
                "requestId": request_id,
                "publishedAt": published_at,
            }
        return {
            "accepted": True,
            "trait": trait,
            "requestId": request_id,
            "passwordId": password_id,
            "publishedAt": published_at,
        }

    def stop(self):
        if self.client:
            self.client.disconnect()
            self.client.loop_stop()


def make_handler(gateway: SmartLockGateway):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, payload):
            body = compact_json(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self._send(204, {})

        def do_GET(self):
            if self.path in ("/health", "/api/lock/status"):
                self._send(200, gateway.status())
                return
            self._send(404, {"error": "Không tìm thấy API."})

        def do_POST(self):
            if self.path != "/api/lock/temp-password":
                self._send(404, {"error": "Không tìm thấy API."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                self._send(202, gateway.publish_temp_password(body))
            except ValueError as error:
                self._send(400, {"error": str(error)})
            except RuntimeError as error:
                self._send(503, {"error": str(error)})
            except Exception as error:
                self._send(500, {"error": f"Gateway gặp lỗi: {error}"})

        def log_message(self, message_format, *args):
            print("[HTTP] " + (message_format % args))

    return Handler


def main():
    gateway = SmartLockGateway()
    gateway.start()
    server = ThreadingHTTPServer(
        (cfg.HTTP_HOST, cfg.HTTP_PORT),
        make_handler(gateway),
    )
    print(f"SmartLock gateway: http://0.0.0.0:{cfg.HTTP_PORT}")
    if not gateway.configured:
        print("Chưa nhập ONEIOT_TOKEN; HTTP vẫn chạy để app hiển thị trạng thái cấu hình.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        gateway.stop()


if __name__ == "__main__":
    main()
