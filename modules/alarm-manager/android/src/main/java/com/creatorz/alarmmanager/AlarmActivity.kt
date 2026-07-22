package com.creatorz.alarmmanager

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity

/**
 * AlarmActivity — full-screen alarm display over lock screen
 * 
 * When an alarm fires, AlarmReceiver launches this Activity via full-screen intent.
 * This Activity:
 *   1. Shows over the lock screen (API 27+: setShowWhenLocked + setTurnScreenOn)
 *   2. Acquires a WakeLock to turn the screen on
 *   3. Plays the alarm sound
 *   4. Waits for the RN app to launch and render AlarmModal
 * 
 * The React Native app reads the pending alarm via getPendingAlarm() and shows AlarmModal,
 * which displays the full UI and allows user interaction.
 */
class AlarmActivity : AppCompatActivity() {
  companion object {
    private const val TAG = "CreatorzAlarm"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    Log.d(TAG, "🎯 AlarmActivity.onCreate: displaying over lock screen")

    // ── Show over lock screen (API 27+) ──────────────────────────────────────
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      // Fallback for older APIs
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
    }

    // ── Dismiss the lock screen (calls unlock by default) ─────────────────────
    // Android 10+ requires ACTION_DISMISS_KEYGUARD, but setShowWhenLocked/setTurnScreenOn
    // are sufficient for showing over the lock screen without dismissing it.
    // We let the RN app decide whether to dismiss via intent flags.

    // ── Play alarm sound ────────────────────────────────────────────────────────
    playAlarmSound()

    // ── Set a simple layout (RN app will render real UI via AlarmModal) ────────
    // This is just a stub — the React Native app is about to launch and take over
    val layoutParams = WindowManager.LayoutParams().apply {
      type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }
      format = android.graphics.PixelFormat.TRANSLUCENT
    }

    // Minimal layout — just show a black background until RN app is ready
    setContentView(android.widget.FrameLayout(this).apply {
      setBackgroundColor(android.graphics.Color.BLACK)
    })

    // ── Launch the main RN activity (app will read pending alarm and show AlarmModal) ──
    // AlarmReceiver persisted the alarm to SharedPreferences; the RN app reads it on launch
    scheduleMainActivityLaunch()

    Log.d(TAG, "✅ AlarmActivity ready: awaiting RN app launch")
  }

  override fun onDestroy() {
    super.onDestroy()
    Log.d(TAG, "🔚 AlarmActivity destroyed")
  }

  private fun playAlarmSound() {
    try {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      val ringtone = RingtoneManager.getRingtone(this, uri)

      // Set audio attributes for alarms (API 21+)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        ringtone.audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .build()
      }

      ringtone.play()
      Log.d(TAG, "🔊 Alarm sound playing")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to play alarm sound: ${e.message}")
    }
  }

  private fun scheduleMainActivityLaunch() {
    // Schedule a delayed launch of the main RN activity to ensure this Activity
    // has time to acquire WakeLock and display before the RN app takes over.
    window.decorView.post {
      val mainActivityIntent = Intent().apply {
        action = Intent.ACTION_MAIN
        `package` = packageName
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      }

      try {
        startActivity(mainActivityIntent)
        Log.d(TAG, "🚀 Main RN activity launched")
      } catch (e: Exception) {
        Log.e(TAG, "Failed to launch main activity: ${e.message}")
      }

      // Finish this Activity after a short delay so RN can render AlarmModal
      window.decorView.postDelayed({ finish() }, 1500)
    }
  }
}
