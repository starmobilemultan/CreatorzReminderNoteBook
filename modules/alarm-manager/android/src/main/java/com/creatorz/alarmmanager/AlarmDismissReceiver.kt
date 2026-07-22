package com.creatorz.alarmmanager

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives the dismiss action from the notification or AlarmActivity.
 * Cancels the ongoing notification and releases the WakeLock.
 */
class AlarmDismissReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val alarmId = intent.getStringExtra("alarmId") ?: return
    Log.d("CreatorzAlarm", "🚫 AlarmDismissReceiver: dismissing $alarmId")

    // Cancel the notification
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.cancel(AlarmReceiver.ALARM_NOTIFICATION_TAG, alarmId.hashCode())

    // Release WakeLock
    AlarmReceiver.wakeLock?.let {
      if (it.isHeld) {
        it.release()
        Log.d("CreatorzAlarm", "🔓 WakeLock released by dismiss")
      }
    }
    AlarmReceiver.wakeLock = null

    // Clear pending alarm from prefs
    val prefs = context.getSharedPreferences("creatorz_pending_alarm", Context.MODE_PRIVATE)
    prefs.edit().clear().apply()
  }
}
