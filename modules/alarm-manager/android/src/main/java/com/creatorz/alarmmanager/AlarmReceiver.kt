package com.creatorz.alarmmanager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {
  companion object {
    const val CHANNEL_ID_ALARM = "creatorz_alarm_channel"
    const val ALARM_NOTIFICATION_TAG = "creatorz_alarm"
    const val WAKELOCK_TAG = "creatorz:AlarmWakeLock"

    // Global WakeLock holder so AlarmActivity can release it
    var wakeLock: PowerManager.WakeLock? = null
  }

  override fun onReceive(context: Context, intent: Intent) {
    Log.d("CreatorzAlarm", "🔔 AlarmReceiver.onReceive: ${intent.action}")

    val alarmId = intent.getStringExtra("alarmId") ?: "unknown"
    val title = intent.getStringExtra("title") ?: "Reminder"
    val body = intent.getStringExtra("body") ?: ""
    val priority = intent.getStringExtra("priority") ?: "medium"
    val extra = intent.getStringExtra("extra") ?: "{}"

    // 1. Acquire WakeLock — keeps CPU alive during alarm display
    acquireWakeLock(context)

    // 2. Ensure notification channel exists
    createAlarmChannel(context)

    // 3. Launch AlarmActivity via Full-Screen Intent
    launchAlarmActivity(context, alarmId, title, body, priority, extra)

    Log.d("CreatorzAlarm", "✅ Alarm fired: $alarmId | priority=$priority")
  }

  private fun acquireWakeLock(context: Context) {
    try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      // Release any existing wakelock first
      wakeLock?.let { if (it.isHeld) it.release() }
      // Acquire new one — 60 second timeout for safety
      wakeLock = pm.newWakeLock(
        PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
        WAKELOCK_TAG
      ).also { wl ->
        wl.acquire(60_000L) // auto-releases after 60s
      }
      Log.d("CreatorzAlarm", "🔒 WakeLock acquired")
    } catch (e: Exception) {
      Log.e("CreatorzAlarm", "❌ WakeLock acquisition failed: ${e.message}")
    }
  }

  private fun createAlarmChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID_ALARM) != null) return

    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    val audioAttr = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    val channel = NotificationChannel(
      CHANNEL_ID_ALARM,
      "Alarm Reminders",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Full-screen alarm notifications for Creatorz reminders"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 500, 300, 500, 300, 500)
      enableLights(true)
      lightColor = 0xFFEF4444.toInt()
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(alarmSound, audioAttr)
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
    Log.d("CreatorzAlarm", "📢 Alarm notification channel created")
  }

  private fun launchAlarmActivity(
    context: Context,
    alarmId: String,
    title: String,
    body: String,
    priority: String,
    extra: String
  ) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    // Intent to launch AlarmActivity (full-screen)
    val alarmActivityIntent = Intent(context, AlarmActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      addFlags(Intent.FLAG_ACTIVITY_NO_USER_ACTION)
      putExtra("alarmId", alarmId)
      putExtra("title", title)
      putExtra("body", body)
      putExtra("priority", priority)
      putExtra("extra", extra)
    }

    val fullScreenFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }

    val fullScreenPendingIntent = PendingIntent.getActivity(
      context,
      alarmId.hashCode() + 1000, // offset to avoid collision with AlarmManager PendingIntent
      alarmActivityIntent,
      fullScreenFlags
    )

    // Also create a tap intent (notification drawer tap → open app)
    val mainIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      putExtra("alarmId", alarmId)
      putExtra("fromAlarmNotification", true)
    }
    val tapPendingIntent = if (mainIntent != null) {
      PendingIntent.getActivity(context, alarmId.hashCode() + 2000, mainIntent, fullScreenFlags)
    } else fullScreenPendingIntent

    val accentColor = if (priority == "high") 0xFFEF4444.toInt() else 0xFF6366F1.toInt()

    val notification = NotificationCompat.Builder(context, CHANNEL_ID_ALARM)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(body.ifEmpty { "Tap to view your reminder" })
      .setColor(accentColor)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(false)
      .setOngoing(true) // persistent until dismissed
      .setFullScreenIntent(fullScreenPendingIntent, true) // ← THE key API
      .setContentIntent(tapPendingIntent)
      .setVibrate(longArrayOf(0, 500, 300, 500, 300, 500))
      .setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      )
      .setDeleteIntent(buildDismissPendingIntent(context, alarmId))
      .build()

    // Fire the notification — fullScreenIntent causes Android to launch AlarmActivity
    val notifId = alarmId.hashCode()
    nm.notify(ALARM_NOTIFICATION_TAG, notifId, notification)
    Log.d("CreatorzAlarm", "🔔 Notification fired with fullScreenIntent: notifId=$notifId")
  }

  private fun buildDismissPendingIntent(context: Context, alarmId: String): PendingIntent {
    val dismissIntent = Intent(context, AlarmDismissReceiver::class.java).apply {
      action = "com.creatorz.ALARM_DISMISS"
      putExtra("alarmId", alarmId)
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getBroadcast(context, alarmId.hashCode() + 3000, dismissIntent, flags)
  }
}
