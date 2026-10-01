package com.bookingclassroom

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.time.Instant
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import org.json.JSONArray
import org.json.JSONObject

class OneIoTMqttPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == OneIoTMqttModule.NAME) OneIoTMqttModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            OneIoTMqttModule.NAME to
                ReactModuleInfo(
                    name = OneIoTMqttModule.NAME,
                    className = OneIoTMqttModule.NAME,
                    canOverrideExistingModule = false,
                    needsEagerInit = false,
                    isCxxModule = false,
                    isTurboModule = false,
                ),
        )
      }
}

class OneIoTMqttModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  private val executor = Executors.newSingleThreadExecutor()
  @Volatile private var mqttClient: SimpleMqttClient? = null
  @Volatile private var sessionToken: String? = null

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun connect(
      broker: String,
      port: Double,
      toolDeviceId: String,
      token: String,
      smartLockAeId: String,
      cseId: String,
      promise: Promise,
  ) {
    executor.execute {
      try {
        require(broker.isNotBlank()) { "Broker OneIoT không được để trống." }
        require(toolDeviceId.isNotBlank()) { "Tools Device ID không được để trống." }
        require(token.isNotBlank()) { "Token OneIoT không được để trống." }
        closeSession()
        require(smartLockAeId.isNotBlank()) { "SmartLock AE ID không được để trống." }
        require(cseId.isNotBlank()) { "OneIoT CSE ID không được để trống." }
        val candidate =
            SimpleMqttClient(
                broker.trim(),
                port.toInt(),
                toolDeviceId.trim(),
                token.trim(),
                smartLockAeId.trim(),
                cseId.trim(),
            ) { topic, payload -> emitSmartLockMessage(topic, payload) }
        candidate.connect()
        mqttClient = candidate
        sessionToken = token.trim()
        promise.resolve(connectionStatus(candidate))
      } catch (error: Exception) {
        closeSession()
        promise.reject("ONEIOT_CONNECT_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    executor.execute {
      closeSession()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(connectionStatus(mqttClient))
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  @ReactMethod
  fun createTemporaryPassword(
      cseId: String,
      smartLockDeviceId: String,
      smartLockDeviceName: String,
      roomId: String,
      roomName: String,
      code: String,
      passwordId: Double,
      startTime: Double,
      endTime: Double,
      promise: Promise,
  ) {
    executor.execute {
      try {
        val client = mqttClient
        val token = sessionToken
        check(client != null && client.isConnected && !token.isNullOrBlank()) {
          "Phiên app chưa kết nối OneIoT."
        }
        val numericPasswordId = passwordId.toInt()
        val numericStartTime = startTime.toLong()
        val numericEndTime = endTime.toLong()
        require(code.matches(Regex("\\d{4,12}"))) { "Mật khẩu phải gồm 4 đến 12 chữ số." }
        require(numericPasswordId in 1..255) { "passwordID phải nằm trong khoảng 1 đến 255." }
        require(numericStartTime < numericEndTime) { "Khoảng hiệu lực mật khẩu không hợp lệ." }

        val command =
            buildTemporaryPasswordCommand(
                toolDeviceId = client.clientId,
                token = token,
                cseId = cseId,
                smartLockDeviceId = smartLockDeviceId,
                smartLockDeviceName = smartLockDeviceName,
                code = code,
                passwordId = numericPasswordId,
                startTime = numericStartTime,
                endTime = numericEndTime,
            )
        val topic = "/oneM2M/req/${client.clientId}/${cseId.trim('/')}/json"
        client.publish(topic, command.payload.toByteArray(StandardCharsets.UTF_8))

        val result = Arguments.createMap()
        result.putBoolean("accepted", true)
        result.putString("trait", TEMP_PASSWORD_TRAIT)
        result.putString("requestId", command.recordId)
        result.putInt("passwordId", numericPasswordId)
        result.putString("publishedAt", Instant.now().toString())
        result.putString("roomId", roomId)
        result.putString("roomName", roomName)
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("ONEIOT_PUBLISH_FAILED", error.message, error)
      }
    }
  }

  override fun onHostResume() = Unit

  override fun onHostPause() {
    executor.execute { closeSession() }
  }

  override fun onHostDestroy() {
    executor.execute { closeSession() }
  }

  override fun invalidate() {
    closeSession()
    executor.shutdownNow()
    super.invalidate()
  }

  private fun connectionStatus(client: SimpleMqttClient?) =
      Arguments.createMap().apply {
        putBoolean("connected", client?.isConnected == true)
        if (client != null) {
          putString("broker", client.broker)
          putString("toolDeviceId", client.clientId)
        }
      }

  private fun emitSmartLockMessage(topic: String, payload: String) {
    val event = Arguments.createMap().apply {
      putString("topic", topic)
      putString("payload", payload)
      putString("receivedAt", Instant.now().toString())
    }
    try {
      reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(SMART_LOCK_EVENT, event)
    } catch (_: Exception) {
      // React context can disappear while Android is closing the app.
    }
  }

  @Synchronized
  private fun closeSession() {
    mqttClient?.disconnect()
    mqttClient = null
    sessionToken = null
  }

  companion object {
    const val NAME = "OneIoTMqtt"
    const val SMART_LOCK_EVENT = "OneIoTSmartLockEvent"
    private const val TEMP_PASSWORD_TRAIT = "traitCreateTmpPasswordLock"
  }
}

private data class BuiltCommand(val payload: String, val recordId: String)

private fun buildTemporaryPasswordCommand(
    toolDeviceId: String,
    token: String,
    cseId: String,
    smartLockDeviceId: String,
    smartLockDeviceName: String,
    code: String,
    passwordId: Int,
    startTime: Long,
    endTime: Long,
): BuiltCommand {
  val now = System.currentTimeMillis()
  val trait = "traitCreateTmpPasswordLock"
  val recordId = "$trait***${passwordId}_${now}***Internet"
  val encryptedPassword =
      encryptLockPassword(code, smartLockDeviceId, passwordId, startTime, endTime)

  val schedule =
      JSONObject()
          .put("statusOfDay", 1)
          .put("startTimeInDay", "00:00")
          .put("endTimeInDay", "23:59")
          .put("dayOfWeek", JSONArray(listOf(0, 1, 2, 3, 4, 5, 6)))
  val passwordEntry =
      JSONObject()
          .put("passwordID", passwordId)
          .put("usageCount", 0)
          .put("status", 0)
          .put("startTime", startTime.toString())
          .put("endTime", endTime.toString())
          .put("password", encryptedPassword)
          .put("schedule", schedule)
  val traitData =
      JSONObject()
          .put("deviceID", smartLockDeviceId)
          .put("trait", trait)
          .put("numPassword", 1)
          .put("passwordList", JSONArray().put(passwordEntry))
  val traitPayload =
      JSONObject()
          .put("typeMessage", "control")
          .put(
              "dataMessage",
              JSONObject()
                  .put("connectivityType", "wifi")
                  .put(
                      "properties",
                      JSONObject().put("command", "updateTrait").put("data", traitData),
                  ),
          )
          .put("requestID", recordId)
  val command =
      JSONObject()
          .put("commandId", "updateTraitLock")
          .put("name", "updateTraitLock")
          .put("data", traitPayload.toString())
          .put("commandType", "control")
          .put("recordId", recordId)
  val request =
      JSONObject()
          .put("fr", toolDeviceId)
          .put("op", 1)
          .put("rqi", "create_tmp_password_${passwordId}_$now")
          .put("to", "${cseId.trimEnd('/')}/in-name/$smartLockDeviceName/cnt_command")
          .put("ty", 4)
          .put("tkns", JSONArray().put(token))
          .put(
              "pc",
              JSONObject()
                  .put(
                      "m2m:cin",
                      JSONObject()
                          .put("cnf", "text/plains:0")
                          .put("con", command.toString()),
                  ),
          )
  return BuiltCommand(request.toString(), recordId)
}

private fun encryptLockPassword(
    password: String,
    deviceId: String,
    passwordId: Int,
    startTime: Long,
    endTime: Long,
): String {
  val key =
      MessageDigest.getInstance("SHA-256")
          .digest(("VNPTKEY" + deviceId).toByteArray(StandardCharsets.UTF_8))
  val nonce =
      MessageDigest.getInstance("MD5")
          .digest("$startTime$endTime$passwordId".toByteArray(StandardCharsets.UTF_8))
  val cipher = Cipher.getInstance("AES/CTR/NoPadding")
  cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(nonce))
  return cipher.doFinal(password.toByteArray(StandardCharsets.UTF_8)).joinToString("") {
    "%02X".format(it.toInt() and 0xFF)
  }
}

private class SimpleMqttClient(
    val broker: String,
    private val port: Int,
    val clientId: String,
    private val token: String,
    private val smartLockAeId: String,
    private val cseId: String,
    private val onMessage: (String, String) -> Unit,
) {
  private val connected = AtomicBoolean(false)
  private val packetId = AtomicInteger(1)
  private val writerLock = Any()
  private val pendingPublish = ConcurrentHashMap<Int, CompletableFuture<Unit>>()
  private val pendingSubscribe = ConcurrentHashMap<Int, CompletableFuture<Unit>>()
  private var socket: Socket? = null
  private var input: InputStream? = null
  private var output: OutputStream? = null
  private var heartbeat: ScheduledExecutorService? = null
  private var readerThread: Thread? = null

  val isConnected: Boolean
    get() = connected.get() && socket?.isClosed == false

  fun connect() {
    val sslSocket = createSocket(broker, port)
    sslSocket.soTimeout = 10_000
    sslSocket.startHandshake()
    socket = sslSocket
    input = sslSocket.inputStream
    output = sslSocket.outputStream
    sendConnectPacket()
    val response = readPacket(input ?: error("Không mở được luồng đọc MQTT."))
    if (response.type != 2 || response.body.size < 2) {
      throw IllegalStateException("OneIoT không trả về MQTT CONNACK hợp lệ.")
    }
    val returnCode = response.body[1].toInt() and 0xFF
    if (returnCode != 0) {
      throw IllegalStateException("OneIoT từ chối kết nối MQTT (rc=$returnCode).")
    }
    sslSocket.soTimeout = 0
    connected.set(true)
    startReader()
    subscribe(smartLockTopics())
    startHeartbeat()
  }

  private fun smartLockTopics(): List<String> {
    val cse = cseId.trim('/')
    return listOf(
        "/oneM2M/req/$smartLockAeId/$cse/json",
        "/oneM2M/req/$cse/$smartLockAeId/json",
        "/oneM2M/resp/$smartLockAeId/$cse/json",
        "/oneM2M/resp/$cse/$smartLockAeId/json",
    )
  }

  private fun subscribe(topics: List<String>) {
    check(isConnected) { "Kết nối OneIoT đã bị ngắt." }
    val id = nextPacketId()
    val body = ByteArrayOutputStream()
    body.write((id shr 8) and 0xFF)
    body.write(id and 0xFF)
    topics.distinct().forEach { topic ->
      writeMqttString(body, topic)
      body.write(1)
    }
    val acknowledged = CompletableFuture<Unit>()
    pendingSubscribe[id] = acknowledged
    try {
      sendPacket(0x82, body.toByteArray())
      acknowledged.get(8, TimeUnit.SECONDS)
    } catch (error: TimeoutException) {
      throw IllegalStateException("OneIoT không xác nhận đăng ký nhận bản tin SmartLock.", error)
    } finally {
      pendingSubscribe.remove(id)
    }
  }

  fun publish(topic: String, payload: ByteArray) {
    check(isConnected) { "Kết nối OneIoT đã bị ngắt." }
    val id = nextPacketId()
    val body = ByteArrayOutputStream()
    writeMqttString(body, topic)
    body.write((id shr 8) and 0xFF)
    body.write(id and 0xFF)
    body.write(payload)
    val acknowledged = CompletableFuture<Unit>()
    pendingPublish[id] = acknowledged
    try {
      sendPacket(0x32, body.toByteArray())
      acknowledged.get(8, TimeUnit.SECONDS)
    } catch (error: TimeoutException) {
      throw IllegalStateException("OneIoT không xác nhận bản tin MQTT trong thời gian chờ.", error)
    } finally {
      pendingPublish.remove(id)
    }
  }

  fun disconnect() {
    if (connected.getAndSet(false)) {
      try {
        synchronized(writerLock) {
          output?.write(byteArrayOf(0xE0.toByte(), 0x00))
          output?.flush()
        }
      } catch (_: Exception) {
      }
    }
    heartbeat?.shutdownNow()
    heartbeat = null
    try {
      socket?.close()
    } catch (_: Exception) {
    }
    socket = null
    input = null
    output = null
    pendingPublish.values.forEach {
      it.completeExceptionally(IllegalStateException("Kết nối OneIoT đã bị ngắt."))
    }
    pendingPublish.clear()
    pendingSubscribe.values.forEach {
      it.completeExceptionally(IllegalStateException("Kết nối OneIoT đã bị ngắt."))
    }
    pendingSubscribe.clear()
  }

  private fun startReader() {
    readerThread =
        Thread(
                {
                  try {
                    while (connected.get()) {
                      val packet = readPacket(input ?: break)
                      when (packet.type) {
                        3 -> handleIncomingPublish(packet)
                        4 -> if (packet.body.size >= 2) {
                          val id = packetIdentifier(packet.body)
                          pendingPublish.remove(id)?.complete(Unit)
                        }
                        9 -> if (packet.body.size >= 3) {
                          val id = packetIdentifier(packet.body)
                          val denied = packet.body.drop(2).any { (it.toInt() and 0xFF) == 0x80 }
                          val pending = pendingSubscribe.remove(id)
                          if (denied) pending?.completeExceptionally(
                              IllegalStateException("OneIoT từ chối quyền nghe bản tin SmartLock."),
                          ) else pending?.complete(Unit)
                        }
                      }
                    }
                  } catch (_: Exception) {
                    if (connected.get()) disconnect()
                  }
                },
                "oneiot-mqtt-reader",
            )
            .apply {
              isDaemon = true
              start()
            }
  }

  private fun handleIncomingPublish(packet: MqttPacket) {
    if (packet.body.size < 2) return
    val topicLength = ((packet.body[0].toInt() and 0xFF) shl 8) or (packet.body[1].toInt() and 0xFF)
    if (topicLength <= 0 || packet.body.size < 2 + topicLength) return
    var offset = 2
    val topic = String(packet.body, offset, topicLength, StandardCharsets.UTF_8)
    offset += topicLength
    val qos = (packet.header shr 1) and 0x03
    var incomingPacketId: Int? = null
    if (qos > 0) {
      if (packet.body.size < offset + 2) return
      incomingPacketId = ((packet.body[offset].toInt() and 0xFF) shl 8) or
          (packet.body[offset + 1].toInt() and 0xFF)
      offset += 2
    }
    val payload = String(packet.body, offset, packet.body.size - offset, StandardCharsets.UTF_8)
    onMessage(topic, payload)
    if (qos == 1 && incomingPacketId != null) {
      sendPacket(
          0x40,
          byteArrayOf(
              ((incomingPacketId shr 8) and 0xFF).toByte(),
              (incomingPacketId and 0xFF).toByte(),
          ),
      )
    }
  }

  private fun packetIdentifier(body: ByteArray): Int =
      ((body[0].toInt() and 0xFF) shl 8) or (body[1].toInt() and 0xFF)

  private fun startHeartbeat() {
    heartbeat =
        Executors.newSingleThreadScheduledExecutor().also { scheduler ->
          scheduler.scheduleAtFixedRate(
              {
                if (isConnected) {
                  try {
                    sendPacket(0xC0, byteArrayOf())
                  } catch (_: Exception) {
                    disconnect()
                  }
                }
              },
              20,
              20,
              TimeUnit.SECONDS,
          )
        }
  }

  private fun sendConnectPacket() {
    val body = ByteArrayOutputStream()
    writeMqttString(body, "MQTT")
    body.write(4)
    body.write(0xC0)
    body.write(0)
    body.write(30)
    writeMqttString(body, clientId)
    writeMqttString(body, clientId)
    writeMqttString(body, token)
    sendPacket(0x10, body.toByteArray())
  }

  private fun sendPacket(header: Int, body: ByteArray) {
    check(output != null) { "Kết nối MQTT chưa sẵn sàng." }
    synchronized(writerLock) {
      val target = output ?: error("Kết nối MQTT đã đóng.")
      target.write(header)
      target.write(encodeRemainingLength(body.size))
      target.write(body)
      target.flush()
    }
  }

  private fun nextPacketId(): Int =
      packetId.getAndUpdate { current -> if (current >= 65_535) 1 else current + 1 }

  companion object {
    private fun createSocket(host: String, port: Int): SSLSocket {
      val trustAll =
          arrayOf<TrustManager>(
              object : X509TrustManager {
                override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()

                override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) =
                    Unit

                override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) =
                    Unit
              },
          )
      val context = SSLContext.getInstance("TLS")
      context.init(null, trustAll, SecureRandom())
      return context.socketFactory.createSocket(host, port) as SSLSocket
    }

    private fun writeMqttString(output: ByteArrayOutputStream, value: String) {
      val bytes = value.toByteArray(StandardCharsets.UTF_8)
      require(bytes.size <= 65_535) { "Chuỗi MQTT quá dài." }
      output.write((bytes.size shr 8) and 0xFF)
      output.write(bytes.size and 0xFF)
      output.write(bytes)
    }

    private fun encodeRemainingLength(length: Int): ByteArray {
      var remaining = length
      val encoded = ByteArrayOutputStream()
      do {
        var digit = remaining % 128
        remaining /= 128
        if (remaining > 0) digit = digit or 0x80
        encoded.write(digit)
      } while (remaining > 0)
      return encoded.toByteArray()
    }

    private fun readPacket(input: InputStream): MqttPacket {
      val header = input.read()
      if (header < 0) throw EOFException("Kết nối MQTT đã đóng.")
      var multiplier = 1
      var remaining = 0
      var digit: Int
      do {
        digit = input.read()
        if (digit < 0) throw EOFException("Gói MQTT chưa hoàn chỉnh.")
        remaining += (digit and 0x7F) * multiplier
        multiplier *= 128
        if (multiplier > 128 * 128 * 128 * 128) {
          throw IllegalStateException("Độ dài gói MQTT không hợp lệ.")
        }
      } while ((digit and 0x80) != 0)
      val body = ByteArray(remaining)
      DataInputStream(input).readFully(body)
      return MqttPacket(header, header shr 4, body)
    }
  }
}

private data class MqttPacket(val header: Int, val type: Int, val body: ByteArray)
