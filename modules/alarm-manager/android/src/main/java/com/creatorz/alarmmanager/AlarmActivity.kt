package com.creatorz.alarmmanager

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager

/**
 * AlarmActivity — shown as a full-screen overlay when the alarm fires.
 *
 * This Activity is launched by the full-screen intent in the notification.
 * It turns on the screen, shows over the lock screen, and broadcasts the
 * alarm data to the React Native layer via a local broadcast which
 * app/_layout.tsx picks up through expo-notifications listener already wired.
 *
 * The actual alarm UI is rendered by the existing React Native AlarmModal
 * in the main app. This Activity just ensures the app is in the foreground
 * with screen on / over lock screen flags set.
 */
class AlarmActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.d("CreatorzAlarm", "🚨 AlarmActivity.onCreate")

    // Turn on screen / show over lock screen
    turnOnScreen()

    val alarmId = intent.getStringExtra("alarmId") ?: ""
    val title = intent.getStringExtra("title") ?: "Reminder"
    val body = intent.getStringExtra("body") ?: ""
    val priority = intent.getStringExtra("priority") ?: "medium"
    val extra = intent.getStringExtra("extra") ?: "{}"

    Log.d("CreatorzAlarm", "AlarmActivity: alarmId=$alarmId title=$title priority=$priority")

    // Store alarm data in SharedPreferences so React Native can pick it up
    val prefs = getSharedPreferences("creatorz_pending_alarm", Context.MODE_PRIVATE)
    prefs.edit()
      .putString("pending_alarm_id", alarmId)
      .putString("pending_alarm_title", title)
      .putString("pending_alarm_body", body)
      .putString("pending_alarm_priority", priority)
      .putString("pending_alarm_extra", extra)
      .putLong("pending_alarm_time", System.currentTimeMillis())
      .apply()

    // Launch the main React Native activity to bring the app to foreground
    val mainIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      putExtra("alarmId", alarmId)
      putExtra("alarmTitle", title)
      putExtra("alarmBody", body)
      putExtra("alarmPriority", priority)
      putExtra("alarmExtra", extra)
      putExtra("fromNativeAlarm", true)
    }

    if (mainIntent != null) {
      startActivity(mainIntent)
    }

    // Finish this thin activity — the RN app takes over
    finish()
  }

  private fun turnOnScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      // Android 8.1+ — use Activity API (more reliable)
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      // Legacy window flags
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
      )
    }
  }
}
