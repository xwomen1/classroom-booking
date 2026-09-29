from __future__ import annotations

import hashlib
import json
import queue
import socket
import ssl
import threading
import time
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import tkinter as tk
from tkinter import messagebox, ttk

import simulator_config as cfg


def now_ms() -> int:
    return int(time.time() * 1000)


def compact_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def detect_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def parse_json_string(value):
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
    value = parse_json_string(value)
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def extract_trait_data(root):
    for node in walk_json(root):
        if not isinstance(node, dict):
            continue
        dm = node.get("dataMessage")
        if isinstance(dm, dict):
            prop = dm.get("properties")
            data = prop.get("data") if isinstance(prop, dict) else None
            data = parse_json_string(data)
            if isinstance(data, dict) and data.get("trait"):
                return data, node
        if node.get("trait"):
            return node, node
    return None, None


def find_first_value(root, key):
    for node in walk_json(root):
        if isinstance(node, dict) and key in node:
            return node[key]
    return None


def decrypt_lock_password(encrypted, device_id, password_id, start_time, end_time):
    if not encrypted:
        return None
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    except ImportError:
        return None
    try:
        ciphertext = bytes.fromhex(str(encrypted).strip())
        key = hashlib.sha256(("VNPTKEY" + str(device_id)).encode()).digest()
        nonce = hashlib.md5(
            f"{start_time}{end_time}{int(password_id)}".encode()
        ).digest()
        decryptor = Cipher(algorithms.AES(key), modes.CTR(nonce)).decryptor()
        return (decryptor.update(ciphertext) + decryptor.finalize()).decode()
    except (ValueError, UnicodeDecodeError, TypeError):
        return None


@dataclass
class TempPassword:
    password_id: int
    plain: str
    start_time: str
    end_time: str

    def is_valid_now(self) -> bool:
        current = int(time.time())
        try:
            start = int(self.start_time)
        except (TypeError, ValueError):
            start = 0
        if str(self.end_time) == "9999":
            end = 2**31 - 1
        else:
            try:
                end = int(self.end_time)
            except (TypeError, ValueError):
                end = 0
        return start <= current <= end


class OneIoTBridge:
    def __init__(self, event_queue: queue.Queue):
        self.events = event_queue
        self.client = None
        self.connected = False
        self.local_ip = detect_local_ip()
        self.firmware_version = cfg.SIMULATOR_FIRMWARE_VERSION
        self.publish_topic = (
            f"/oneM2M/req/{cfg.SMARTLOCK_AE_ID}/"
            f"{cfg.ONEIOT_CSE_ID.strip('/')}/json"
        )
        self.command_topic = (
            f"/oneM2M/req{cfg.ONEIOT_CSE_ID}/{cfg.SMARTLOCK_AE_ID}/json"
        )
        self.response_topics = (
            f"/oneM2M/resp/{cfg.SMARTLOCK_AE_ID}/"
            f"{cfg.ONEIOT_CSE_ID.strip('/')}/json",
            f"/oneM2M/resp{cfg.ONEIOT_CSE_ID}/{cfg.SMARTLOCK_AE_ID}/json",
        )

    def emit(self, kind, payload=None):
        self.events.put((kind, payload))

    def log(self, text):
        self.emit("log", text)

    def start(self):
        if not cfg.MQTT_TOKEN:
            self.log(
                "Thiếu SMARTLOCK_MQTT_TOKEN. Hãy cấu hình biến môi trường trước khi chạy."
            )
            self.emit("cloud", False)
            return

        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            self.log("Thiếu paho-mqtt. Chạy: pip install -r tunghv/requirements.txt")
            self.emit("cloud", False)
            return

        try:
            self.client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id=cfg.MQTT_DEVICE_ID,
                clean_session=False,
                protocol=mqtt.MQTTv311,
            )
        except (AttributeError, TypeError):
            self.client = mqtt.Client(
                client_id=cfg.MQTT_DEVICE_ID,
                clean_session=False,
                protocol=mqtt.MQTTv311,
            )

        self.client.username_pw_set(cfg.MQTT_DEVICE_ID, cfg.MQTT_TOKEN)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE)
        self.client.tls_insecure_set(True)
        self.client.reconnect_delay_set(min_delay=1, max_delay=20)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.log(
            f"Kết nối bypass OneIoT {cfg.ONEIOT_BROKER}:{cfg.ONEIOT_PORT} "
            f"với {cfg.MQTT_DEVICE_ID}"
        )
        self.client.connect_async(cfg.ONEIOT_BROKER, cfg.ONEIOT_PORT, keepalive=30)
        self.client.loop_start()

    def stop(self):
        if self.client:
            try:
                self.client.disconnect()
                self.client.loop_stop()
            except Exception:
                pass

    @staticmethod
    def _reason_code_value(reason_code):
        return int(getattr(reason_code, "value", reason_code))

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        rc = self._reason_code_value(reason_code)
        if rc != 0:
            self.connected = False
            self.emit("cloud", False)
            self.log(f"OneIoT từ chối kết nối, rc={rc}")
            return
        self.connected = True
        client.subscribe(self.command_topic, qos=1)
        for topic in self.response_topics:
            client.subscribe(topic, qos=1)
        self.emit("cloud", True)
        self.log(f"Đã kết nối OneIoT; nghe lệnh tại {self.command_topic}")

    def _on_disconnect(self, client, userdata, *args):
        self.connected = False
        self.emit("cloud", False)
        self.log("Mất kết nối OneIoT; MQTT sẽ tự kết nối lại")

    def _on_message(self, client, userdata, message):
        text = message.payload.decode("utf-8", errors="replace")
        try:
            root = json.loads(text)
        except json.JSONDecodeError:
            self.log(f"RX không phải JSON: {text[:180]}")
            return
        if message.topic in self.response_topics:
            rsc = root.get("rsc") if isinstance(root, dict) else None
            if rsc is not None:
                self.log(f"OneIoT ACK rsc={rsc}, rqi={root.get('rqi', '')}")
            return

        self.log(f"Nhận lệnh từ tool/OneIoT: {text[:260]}")
        command_id = find_first_value(root, "commandId")
        if command_id == "requestUpdateGateway":
            resource = find_first_value(root, "Resource")
            if resource:
                self.emit("ota", {"url": str(resource), "root": root})
            else:
                self.publish_ota_error(root)
            return

        data, _ = extract_trait_data(root)
        if data:
            self.emit("command", {"data": data, "root": root})

    def _publish_content(self, container, content):
        if not self.connected or not self.client:
            self.log("Không thể TX: MQTT chưa kết nối")
            return False
        rqi = f"sim_{int(time.time() * 1000)}_{time.perf_counter_ns() % 100000}"
        request = {
            "fr": cfg.SMARTLOCK_AE_ID,
            "op": 1,
            "rqi": rqi,
            "to": (
                f"{cfg.ONEIOT_CSE_ID}/in-name/"
                f"{cfg.SMARTLOCK_DEVICE_NAME}/{container}"
            ),
            "ty": 4,
            "tkns": [cfg.MQTT_TOKEN],
            "pc": {
                "m2m:cin": {
                    "cnf": "text/plains:0",
                    "con": compact_json(content),
                }
            },
        }
        info = self.client.publish(
            self.publish_topic, compact_json(request), qos=1, retain=False
        )
        ok = getattr(info, "rc", 1) == 0
        self.log(f"TX {container}: {compact_json(content)[:280]}")
        return ok

    def publish_trait(self, trait, value=None, **fields):
        data = {
            "deviceID": cfg.SMARTLOCK_DEVICE_ID,
            "trait": trait,
        }
        if value is not None:
            data["value"] = value
        data.update(fields)
        data.setdefault("timeStamp", now_ms())
        inner = {
            "typeMessage": "updateData",
            "dataMessage": {
                "connectivityType": "wifi",
                "properties": {
                    "command": "updateTrait",
                    "data": data,
                },
            },
            "requestID": f"simLock***{now_ms()}***Internet",
        }
        return self._publish_content("cnt_telemetry", inner)

    def publish_connected(self):
        content = {
            "deviceId": cfg.SMARTLOCK_DEVICE_ID,
            "deviceName": cfg.SMARTLOCK_DEVICE_NAME,
            "status": "connected",
            "resetFactory": 0,
            "macWifi": "02:00:00:00:00:12",
            "serial": "SIMULATOR-DLWA12",
            "pid": cfg.SMARTLOCK_PID,
            "model": cfg.SMARTLOCK_MODEL,
            "versionHW": cfg.SMARTLOCK_HW_VERSION,
            "ipLocal": self.local_ip,
            "wlanSsid": "SIMULATOR_BYPASS",
            "wifiSignal": 4,
            "timezone": 7,
            "firmwareVersion": self.firmware_version,
            "firmwareVersionMCU": cfg.SIMULATOR_MCU_VERSION,
            "buildTime": time.strftime("%Y-%m-%d"),
            "lockFeatures": {
                "fingerUnlock": 1,
                "passwordUnlock": 1,
                "cardUnlock": 1,
                "remoteUnlock": 1,
                "remoteUnlockApp": 1,
                "activityHistory": 1,
                "unlockHistory": 1,
                "alert": 1,
                "tempPassword": 1,
            },
        }
        return self._publish_content("cnt_device_status", content)

    def publish_first_pair(self):
        return self.publish_trait(
            "traitFirstPair",
            True,
            deviceName=cfg.SMARTLOCK_DEVICE_NAME,
        )

    def publish_temp_password_response(self, action, password_ids, result=0):
        traits = {
            "create": "traitResponseCreateTmpPassword",
            "delete": "traitResponseDeleteTmpPassword",
            "update": "traitResponseUpdateTmpPassword",
        }
        results = [
            {
                "passwordID": pid - 900 if pid > 900 else pid,
                "result": result,
            }
            for pid in password_ids
        ]
        return self.publish_trait(
            traits[action],
            None,
            numPassword=len(results),
            passwordResultList=results,
        )

    def publish_remove_response(self):
        return self.publish_trait("traitResponseRemoveSmartLock", None, result=0)

    def publish_ota_error(self, root=None):
        response_data = {
            "requestID": "",
            "status": "success",
            "typeMessage": "updateFirmware",
            "dataMessage": {
                "properties": {
                    "command": "responseDownload",
                    "data": "error",
                }
            },
        }
        outer = {
            "commandId": find_first_value(root or {}, "commandId")
            or "requestUpdateGateway",
            "name": find_first_value(root or {}, "name") or "requestUpdateGateway",
            "commandType": find_first_value(root or {}, "commandType")
            or "updateFirmware",
            "recordId": find_first_value(root or {}, "recordId") or "",
            "status": "5",
            "responseData": compact_json(response_data),
        }
        return self._publish_content("cnt_command", outer)


class LocalOtaServer:
    def __init__(self, event_queue):
        self.events = event_queue
        self.server = None
        self.thread = None

    def start(self):
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path != "/ota_command":
                    self.send_error(404)
                    return
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    root = json.loads(self.rfile.read(length).decode("utf-8"))
                    resource = find_first_value(root, "Resource")
                    if not resource:
                        raise ValueError("Bản tin OTA không có Resource")
                    owner.events.put(("ota", {"url": str(resource), "root": root}))
                    body = b'{"accepted":true}'
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except Exception as exc:
                    body = compact_json({"accepted": False, "error": str(exc)}).encode()
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)

            def log_message(self, fmt, *args):
                owner.events.put(("log", "HTTP 8124: " + (fmt % args)))

        try:
            self.server = ThreadingHTTPServer(
                ("0.0.0.0", cfg.LOCAL_OTA_COMMAND_PORT), Handler
            )
        except OSError as exc:
            self.events.put(("log", f"Không mở được HTTP 8124: {exc}"))
            return
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.events.put(
            ("log", f"Local OTA server: http://{detect_local_ip()}:8124/ota_command")
        )

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()


class SmartLockSimulatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("VNPT SmartLock Simulator - DLWA12")
        self.root.geometry("1080x820")
        self.root.minsize(960, 720)
        self.events = queue.Queue()
        self.bridge = OneIoTBridge(self.events)
        self.local_server = LocalOtaServer(self.events)
        self.locked = True
        self.input_digits = ""
        self.permanent_password = cfg.DEFAULT_PERMANENT_PASSWORD
        self.temp_passwords: dict[int, TempPassword] = {}
        self.relock_job = None
        self.remote_job = None
        self.remote_seconds = 0
        self.ota_running = False

        self.cloud_text = tk.StringVar(value="OneIoT: đang kết nối")
        self.lock_text = tk.StringVar(value="ĐÃ KHÓA")
        self.screen_text = tk.StringVar(value="READY")
        self.battery_value = tk.IntVar(value=80)
        self.ota_progress = tk.DoubleVar(value=0)

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.after(80, self._drain_events)
        self.bridge.start()
        self.local_server.start()

    def _build_ui(self):
        self.root.configure(bg="#111827")
        container = tk.Frame(self.root, bg="#111827")
        container.pack(fill="both", expand=True, padx=18, pady=18)

        lock_panel = tk.Frame(container, bg="#0b0f19", bd=2, relief="ridge")
        lock_panel.pack(side="left", fill="y", padx=(0, 16))
        lock_panel.configure(width=390)
        lock_panel.pack_propagate(False)

        tk.Label(
            lock_panel,
            text="VNPT\nSMART LOCK",
            font=("Segoe UI", 18, "bold"),
            fg="#e5e7eb",
            bg="#0b0f19",
        ).pack(pady=(18, 8))

        display = tk.Frame(lock_panel, bg="#071b23", bd=2, relief="sunken")
        display.pack(fill="x", padx=36, pady=8)
        tk.Label(
            display,
            textvariable=self.lock_text,
            font=("Consolas", 17, "bold"),
            fg="#22d3ee",
            bg="#071b23",
        ).pack(pady=(10, 2))
        tk.Label(
            display,
            textvariable=self.screen_text,
            font=("Consolas", 12),
            fg="#a7f3d0",
            bg="#071b23",
        ).pack(pady=(0, 10))

        keypad = tk.Frame(lock_panel, bg="#0b0f19")
        keypad.pack(pady=10)
        keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]
        for index, key in enumerate(keys):
            button = tk.Button(
                keypad,
                text=key,
                width=6,
                height=2,
                font=("Segoe UI", 13, "bold"),
                bg="#1f2937",
                fg="white",
                activebackground="#334155",
                activeforeground="white",
                command=lambda value=key: self.handle_local_button(self.key_press, value),
            )
            button.grid(row=index // 3, column=index % 3, padx=7, pady=6)

        finger = tk.Button(
            lock_panel,
            text="◎  VÂN TAY",
            font=("Segoe UI", 12, "bold"),
            bg="#153c3c",
            fg="#99f6e4",
            activebackground="#115e59",
            command=lambda: self.handle_local_button(self.unlock_fingerprint),
        )
        finger.pack(fill="x", padx=68, pady=(6, 10))

        actions = tk.Frame(lock_panel, bg="#0b0f19")
        actions.pack(pady=4)
        for column, (text, command) in enumerate(
            [
                ("THẺ", self.unlock_card),
                ("MỞ TRONG", self.unlock_inside),
            ]
        ):
            tk.Button(
                actions,
                text=text,
                width=10,
                height=2,
                command=lambda action=command: self.handle_local_button(action),
                bg="#374151",
                fg="white",
            ).grid(row=0, column=column, padx=4)

        handle = tk.Canvas(lock_panel, width=250, height=70, bg="#0b0f19", highlightthickness=0)
        handle.pack(pady=8)
        handle.create_oval(18, 12, 72, 66, fill="#6b7280", outline="#d1d5db", width=2)
        handle.create_rectangle(45, 27, 220, 51, fill="#9ca3af", outline="#e5e7eb", width=2)

        bottom = tk.Frame(lock_panel, bg="#0b0f19")
        bottom.pack(fill="x", padx=22, pady=(2, 16))
        tk.Button(
            bottom,
            text="PAIR/FIRSTPAIR",
            command=lambda: self.handle_local_button(self.first_pair),
            bg="#1d4ed8",
            fg="white",
        ).pack(side="left", expand=True, fill="x", padx=3)
        tk.Button(
            bottom,
            text="RESET",
            command=lambda: self.handle_local_button(self.reset_factory),
            bg="#991b1b",
            fg="white",
        ).pack(side="left", expand=True, fill="x", padx=3)

        right = tk.Frame(container, bg="#111827")
        right.pack(side="left", fill="both", expand=True)

        status_box = ttk.LabelFrame(right, text="Trạng thái simulator")
        status_box.pack(fill="x", pady=(0, 10))
        ttk.Label(status_box, textvariable=self.cloud_text).grid(row=0, column=0, sticky="w", padx=10, pady=6)
        ttk.Label(status_box, text=f"AE_ID: {cfg.SMARTLOCK_AE_ID}").grid(row=1, column=0, sticky="w", padx=10)
        ttk.Label(status_box, text=f"Device: {cfg.SMARTLOCK_DEVICE_ID}").grid(row=2, column=0, sticky="w", padx=10)
        ttk.Label(status_box, text=f"Model: {cfg.SMARTLOCK_MODEL} | Bypass pairing: ON").grid(row=3, column=0, sticky="w", padx=10, pady=(0, 6))

        controls = ttk.LabelFrame(right, text="Điều khiển mô phỏng")
        controls.pack(fill="x", pady=(0, 10))
        ttk.Button(
            controls,
            text="Khóa ngay",
            command=lambda: self.handle_local_button(self.lock_now),
        ).grid(row=0, column=0, columnspan=3, padx=8, pady=8, sticky="ew")
        ttk.Label(controls, text="Pin:").grid(row=1, column=0, sticky="e", padx=4)
        ttk.Spinbox(controls, from_=0, to=100, textvariable=self.battery_value, width=8).grid(row=1, column=1, sticky="w")
        ttk.Button(
            controls,
            text="Gửi pin",
            command=lambda: self.handle_local_button(self.send_battery),
        ).grid(row=1, column=2, padx=8, pady=8, sticky="ew")
        for column in range(3):
            controls.columnconfigure(column, weight=1)

        ota_box = ttk.LabelFrame(right, text="OTA mô phỏng")
        ota_box.pack(fill="x", pady=(0, 10))
        ttk.Progressbar(ota_box, variable=self.ota_progress, maximum=100).pack(fill="x", padx=10, pady=8)
        ttk.Label(ota_box, text=f"HTTP command: {detect_local_ip()}:{cfg.LOCAL_OTA_COMMAND_PORT}/ota_command").pack(anchor="w", padx=10, pady=(0, 8))

        pwd_box = ttk.LabelFrame(right, text="Mật khẩu tạm thời đang lưu")
        pwd_box.pack(fill="x", pady=(0, 10))
        self.password_tree = ttk.Treeview(pwd_box, columns=("id", "password", "end"), show="headings", height=4)
        self.password_tree.heading("id", text="ID")
        self.password_tree.heading("password", text="Password")
        self.password_tree.heading("end", text="End time")
        self.password_tree.column("id", width=70, anchor="center")
        self.password_tree.column("password", width=130, anchor="center")
        self.password_tree.column("end", width=160, anchor="center")
        self.password_tree.pack(fill="x", padx=8, pady=8)

        log_box = ttk.LabelFrame(right, text="Log giao tiếp")
        log_box.pack(fill="both", expand=True)
        self.log_text = tk.Text(log_box, height=14, bg="#020617", fg="#d1fae5", insertbackground="white", font=("Consolas", 9), wrap="word")
        self.log_text.pack(fill="both", expand=True, padx=6, pady=6)

    def log(self, text):
        stamp = time.strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{stamp}] {text}\n")
        self.log_text.see("end")

    def _drain_events(self):
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "log":
                    self.log(payload)
                elif kind == "cloud":
                    self.cloud_text.set("OneIoT: CONNECTED" if payload else "OneIoT: DISCONNECTED")
                elif kind == "command":
                    self.handle_cloud_command(payload)
                elif kind == "ota":
                    self.start_ota(payload)
                elif kind == "ota_progress":
                    self.ota_progress.set(payload)
                elif kind == "ota_done":
                    self.finish_ota(payload)
        except queue.Empty:
            pass
        self.root.after(80, self._drain_events)

    def handle_local_button(self, action, *args):
        self.bridge.publish_connected()
        return action(*args)

    def key_press(self, key):
        if key == "*":
            self.input_digits = ""
            self.screen_text.set("READY")
            return
        if key == "#":
            if self.input_digits:
                self.validate_password()
            else:
                self.start_remote_unlock_request()
            return
        if len(self.input_digits) < 12:
            self.input_digits += key
            self.screen_text.set("●" * len(self.input_digits))

    def validate_password(self):
        entered = self.input_digits
        self.input_digits = ""
        self.screen_text.set("CHECK...")
        if entered == self.permanent_password:
            self.bridge.publish_trait("traitUnlockPassword", 1)
            self.unlock("Mật khẩu cố định")
            return
        for record in self.temp_passwords.values():
            if entered == record.plain and record.is_valid_now():
                self.bridge.publish_trait("traitUnlockTempPwd", record.password_id)
                self.unlock(f"Mật khẩu tạm ID={record.password_id}")
                return
        self.screen_text.set("SAI MẬT KHẨU")
        self.bridge.publish_trait("traitAlertLock", 1)
        self.log("Từ chối mật khẩu không hợp lệ")

    def unlock(self, reason):
        self.locked = False
        self.lock_text.set("ĐÃ MỞ")
        self.screen_text.set(reason.upper())
        self.log(f"Mở khóa: {reason}")
        if self.relock_job:
            self.root.after_cancel(self.relock_job)
        self.relock_job = self.root.after(cfg.AUTO_RELOCK_SECONDS * 1000, self.lock_now)

    def lock_now(self):
        self.locked = True
        self.lock_text.set("ĐÃ KHÓA")
        self.screen_text.set("READY")
        self.bridge.publish_trait("traitLocked", 2)
        self.log("Khóa đã đóng")

    def unlock_fingerprint(self):
        self.bridge.publish_trait("traitUnlockFinger", 1)
        self.unlock("Vân tay ID=1")

    def unlock_card(self):
        self.bridge.publish_trait("traitUnlockCard", 1)
        self.unlock("Thẻ ID=1")

    def unlock_inside(self):
        self.bridge.publish_trait("traitUnlockInside", 1)
        self.unlock("Nút mở phía trong")

    def send_battery(self):
        value = max(0, min(100, int(self.battery_value.get())))
        self.bridge.publish_trait("traitBatteryLevel", value)

    def start_remote_unlock_request(self):
        if self.remote_job:
            self.root.after_cancel(self.remote_job)
        self.remote_seconds = cfg.REMOTE_UNLOCK_COUNTDOWN_SECONDS
        self._remote_tick()

    def _remote_tick(self):
        if self.remote_seconds < 0:
            self.remote_job = None
            self.screen_text.set("REMOTE TIMEOUT")
            return
        self.bridge.publish_trait("traitUnlockRequest", self.remote_seconds)
        self.screen_text.set(f"REMOTE {self.remote_seconds}s")
        self.remote_seconds -= 1
        self.remote_job = self.root.after(1000, self._remote_tick)

    def stop_remote_request(self):
        if self.remote_job:
            self.root.after_cancel(self.remote_job)
            self.remote_job = None

    def first_pair(self):
        self.bridge.publish_first_pair()
        self.log("Đã phát traitFirstPair; kết nối cloud vẫn giữ do bypass")

    def reset_factory(self):
        if not messagebox.askyesno("Reset", "Xóa dữ liệu mô phỏng và phát traitUnlinkSmartLock?"):
            return
        self.temp_passwords.clear()
        self.permanent_password = cfg.DEFAULT_PERMANENT_PASSWORD
        self.refresh_password_tree()
        self.bridge.publish_trait("traitUnlinkSmartLock")
        self.log("Reset dữ liệu; bypass vẫn tự kết nối OneIoT")

    def handle_cloud_command(self, packet):
        data = packet["data"]
        trait = str(data.get("trait", ""))
        self.log(f"Xử lý trait từ tool: {trait}")
        if trait == "traitReplyUnlockRequest":
            accepted = int(data.get("value", 1)) == 0
            self.stop_remote_request()
            if accepted:
                self.bridge.publish_trait("traitResponseUnlockStatus", 0)
                self.unlock("Tool chấp nhận mở từ xa")
            else:
                self.bridge.publish_trait("traitResponseUnlockStatus", 1)
                self.screen_text.set("REMOTE REJECT")
            return
        if trait == "traitSetKeyForNoCode":
            if cfg.IGNORE_SET_KEY_FOR_NO_CODE and cfg.SMARTLOCK_MODEL == "DLWA12":
                self.log("DLWA12 bỏ qua traitSetKeyForNoCode giống firmware hiện tại")
                return
            password_id = int(data.get("passwordID", 1))
            plain = decrypt_lock_password(
                data.get("password"),
                data.get("deviceID", cfg.SMARTLOCK_DEVICE_ID),
                password_id,
                data.get("startTime", "0"),
                data.get("endTime", "9999"),
            )
            if plain:
                self.permanent_password = plain
                self.bridge.publish_trait(
                    "traitResponseSetKeyForNoCode",
                    None,
                    passwordID=password_id,
                    result=0,
                )
            return
        action_by_trait = {
            "traitCreateTmpPasswordLock": "create",
            "traitDeleteTmpPasswordLock": "delete",
            "traitUpdateTmpPasswordLock": "update",
        }
        if trait in action_by_trait:
            self.handle_temp_password(action_by_trait[trait], data)
            return
        if trait == "traitRemoveSmartLock":
            self.temp_passwords.clear()
            self.refresh_password_tree()
            self.bridge.publish_remove_response()
            self.log("Đã mô phỏng remove; bypass cloud vẫn hoạt động")
            return
        if trait == "traitForceUpdateOTA":
            resource = data.get("Resource") or data.get("url")
            if resource:
                self.start_ota({"url": str(resource), "root": packet.get("root", {})})

    def handle_temp_password(self, action, data):
        entries = data.get("passwordList") or data.get("passwords") or []
        if not isinstance(entries, list):
            entries = []
        handled_ids = []
        for item in entries:
            try:
                password_id = int(item.get("passwordID", item.get("passwordId")))
            except (TypeError, ValueError):
                continue
            handled_ids.append(password_id)
            if action == "delete":
                self.temp_passwords.pop(password_id, None)
                continue
            start_time = str(item.get("startTime", "0"))
            end_time = str(item.get("endTime", "9999"))
            plain = decrypt_lock_password(
                item.get("password"),
                item.get("deviceID", data.get("deviceID", cfg.SMARTLOCK_DEVICE_ID)),
                password_id,
                start_time,
                end_time,
            )
            if plain:
                self.temp_passwords[password_id] = TempPassword(
                    password_id, plain, start_time, end_time
                )
            else:
                self.log(f"Không giải mã được mật khẩu ID={password_id}")
        self.refresh_password_tree()
        self.bridge.publish_temp_password_response(action, handled_ids, result=0)

    def refresh_password_tree(self):
        for item in self.password_tree.get_children():
            self.password_tree.delete(item)
        for record in sorted(self.temp_passwords.values(), key=lambda value: value.password_id):
            self.password_tree.insert(
                "", "end", values=(record.password_id, record.plain, record.end_time)
            )

    def start_ota(self, packet):
        if self.ota_running:
            self.log("Bỏ qua lệnh OTA mới vì OTA mô phỏng đang chạy")
            return
        self.ota_running = True
        self.ota_progress.set(0)
        url = packet["url"]
        self.log(f"Bắt đầu OTA mô phỏng: {url}")

        def worker():
            try:
                context = ssl._create_unverified_context()
                request = urllib.request.Request(url, headers={"User-Agent": "SmartLock-Simulator/1.0"})
                with urllib.request.urlopen(request, timeout=30, context=context) as response:
                    total = int(response.headers.get("Content-Length", "0") or 0)
                    received = 0
                    first_byte = None
                    while True:
                        chunk = response.read(64 * 1024)
                        if not chunk:
                            break
                        if first_byte is None:
                            first_byte = chunk[0]
                        received += len(chunk)
                        if total:
                            self.events.put(("ota_progress", min(99, received * 100 / total)))
                if first_byte != 0xE9 or received < 1024:
                    raise ValueError("File không phải ESP firmware .bin hợp lệ")
                self.events.put(("ota_done", {"ok": True, "bytes": received, "root": packet.get("root", {})}))
            except Exception as exc:
                self.events.put(("ota_done", {"ok": False, "error": str(exc), "root": packet.get("root", {})}))

        threading.Thread(target=worker, daemon=True).start()

    def finish_ota(self, result):
        self.ota_running = False
        if not result.get("ok"):
            self.ota_progress.set(0)
            self.log(f"OTA thất bại: {result.get('error')}")
            self.bridge.publish_ota_error(result.get("root"))
            return
        self.ota_progress.set(100)
        parts = self.bridge.firmware_version.rsplit(".", 1)
        try:
            self.bridge.firmware_version = f"{parts[0]}.{int(parts[1]) + 1}"
        except (IndexError, ValueError):
            self.bridge.firmware_version = f"SIM-{now_ms()}"
        self.log(
            f"OTA mô phỏng thành công ({result.get('bytes')} byte); "
            f"version mới={self.bridge.firmware_version}"
        )
        self.screen_text.set("OTA SUCCESS")

    def close(self):
        self.stop_remote_request()
        self.local_server.stop()
        self.bridge.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    SmartLockSimulatorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()

