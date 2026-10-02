package com.bookingclassroom

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

private const val CHANNEL_ID = "booking-priority"

class PriorityNotificationPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == PriorityNotificationModule.NAME) {
        PriorityNotificationModule(reactContext)
      } else {
        null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            PriorityNotificationModule.NAME to
                ReactModuleInfo(
                    name = PriorityNotificationModule.NAME,
                    className = PriorityNotificationModule.NAME,
                    canOverrideExistingModule = false,
                    needsEagerInit = false,
                    isCxxModule = false,
                    isTurboModule = false,
                ),
        )
      }
}

class PriorityNotificationModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod
  fun show(title: String, message: String, destination: String, tone: String, promise: Promise) {
    try {
      val context = reactApplicationContext
      if (
          Build.VERSION.SDK_INT >= 33 &&
              context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                  PackageManager.PERMISSION_GRANTED
      ) {
        promise.resolve(false)
        return
      }

      val manager = context.getSystemService(NotificationManager::class.java)
      ensureChannel(manager)
      if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
        promise.resolve(false)
        return
      }

      val openApp =
          Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (destination.isNotBlank()) {
              putExtra(OPEN_SCREEN, destination)
            }
          }
      val pendingIntent =
          PendingIntent.getActivity(
              context,
              destination.hashCode(),
              openApp,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
      val notification =
          NotificationCompat.Builder(context, CHANNEL_ID)
              .setSmallIcon(R.drawable.ic_stat_booking)
              .setContentTitle(title)
              .setContentText(message)
              .setStyle(NotificationCompat.BigTextStyle().bigText(message))
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .setCategory(NotificationCompat.CATEGORY_MESSAGE)
              .setColor(colorForTone(tone))
              .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
              .setAutoCancel(true)
              .setContentIntent(pendingIntent)
              .setDefaults(NotificationCompat.DEFAULT_ALL)
              .setVibrate(longArrayOf(0, 180, 80, 180))
              .build()

      NotificationManagerCompat.from(context)
          .notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("NOTIFY_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun consumeOpenScreen(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    val destination = activity?.intent?.getStringExtra(OPEN_SCREEN)
    if (!destination.isNullOrBlank()) {
      activity.intent?.removeExtra(OPEN_SCREEN)
    }
    promise.resolve(destination)
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val channel =
        NotificationChannel(
                CHANNEL_ID,
                "Thông báo ưu tiên",
                NotificationManager.IMPORTANCE_HIGH,
            )
            .apply {
              description =
                  "Hiện trên đầu màn hình khi có yêu cầu đặt phòng, duyệt, hủy hoặc đổi phòng."
              enableVibration(true)
              vibrationPattern = longArrayOf(0, 180, 80, 180)
              setShowBadge(true)
            }
    manager.createNotificationChannel(channel)
  }

  private fun colorForTone(tone: String): Int =
      when (tone) {
        "positive" -> Color.rgb(34, 134, 74)
        "negative" -> Color.rgb(180, 35, 24)
        "attention" -> Color.rgb(168, 103, 0)
        else -> Color.rgb(47, 111, 237)
      }

  companion object {
    const val NAME = "PriorityNotification"
    const val OPEN_SCREEN = "openScreen"
  }
}
