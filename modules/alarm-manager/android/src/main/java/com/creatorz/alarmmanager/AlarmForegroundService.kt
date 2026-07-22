package com.creatorz.alarmmanager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * AlarmForegroundService — keeps the CPU alive during alarm display
 * 
 * When an alarm fires on Android 8+, we must run a foreground service to:
 *   1. Keep the CPU from sleeping (doze/sleep prevention)
 *   2. Display a persistent notification (required by Android 8+)
 *   3. Ensure the full-screen intent reaches the user
 */
class AlarmForegroundService : Service() {
  companion object {
    private const val TAG = "CreatorzAlarm"
    private const val NOTIFICATION_ID = 9999
    private const val CHANNEL_ID = "creatorz_alarm_service"

    const val EXTRA_TITLE = "alarm_title"
    const val EXTRA_BODY = "alarm_body"
  }

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "🚀 AlarmForegroundService.onCreate")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: ""

    Log.d(TAG, "📢 AlarmForegroundService.onStartCommand: $title")

    // Create notification channel (Android 8+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Alarm Notifications",
        NotificationManager.IMPORTANCE_MAX
      ).apply {
        description = "High-priority alarm notifications"
        enableVibration(true)
        setShowBadge(true)
      }
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }

    // Build notification
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .build()

    // Start foreground service
    startForeground(NOTIFICATION_ID, notification)

    Log.d(TAG, "✅ AlarmForegroundService running in foreground")

    // Stop after 10 minutes (alarm should be handled by then)
    Thread {
      Thread.sleep(10 * 60 * 1000) // 10 minutes
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      Log.d(TAG, "⏱ AlarmForegroundService stopped after timeout")
    }.start()

    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    Log.d(TAG, "🔚 AlarmForegroundService.onDestroy")
  }

  override fun onBind(intent: Intent?) = null
}
