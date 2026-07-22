package com.creatorz.alarmmanager

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * BootReceiver — restores all alarms after the device reboots.
 *
 * Android cancels ALL AlarmManager alarms on reboot. This receiver listens
 * for BOOT_COMPLETED (and QUICKBOOT_POWERON on some OEMs) and reschedules
 * every alarm stored in SharedPreferences by the JS layer.
 *
 * Required permission: RECEIVE_BOOT_COMPLETED (added by config plugin)
 */
class BootReceiver : BroadcastReceiver() {
  companion object {
    private const val TAG = "CreatorzAlarm"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED &&
      action != "android.intent.action.QUICKBOOT_POWERON" &&
      action != "com.htc.intent.action.QUICKBOOT_POWERON"
    ) return

    Log.d(TAG, "📱 BootReceiver: device rebooted, restoring alarms...")

    val prefs = context.getSharedPreferences(AlarmManagerModule.PREFS_ALARMS, Context.MODE_PRIVATE)
    val alarmsJson = prefs.getString("alarms_data", "[]") ?: "[]"

    try {
      val alarms = JSONArray(alarmsJson)
      val now = System.currentTimeMillis()
      var restored = 0
      var skipped = 0

      for (i in 0 until alarms.length()) {
        val alarm = alarms.getJSONObject(i)
        val alarmId = alarm.getString("id")
        val triggerTimeMs = alarm.getLong("triggerTimeMs")
        val title = alarm.getString("title")
        val body = alarm.optString("body", "")
        val priority = alarm.optString("priority", "medium")
        val extra = alarm.optString("extra", "{}")

        // Skip alarms that are in the past (> 1 min ago)
        if (triggerTimeMs < now - 60_000) {
          Log.d(TAG, "⏭ Skipping past alarm: $alarmId (was ${(now - triggerTimeMs) / 1000}s ago)")
          skipped++
          continue
        }

        // Re-schedule via the same AlarmManager code path
        val fireIntent = Intent(context, AlarmReceiver::class.java).apply {
          action = "com.creatorz.ALARM_FIRE"
          putExtra("alarmId", alarmId)
          putExtra("title", title)
          putExtra("body", body)
          putExtra("priority", priority)
          putExtra("extra", extra)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(
          context, alarmId.hashCode(), fireIntent, flags
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          val clockInfo = AlarmManager.AlarmClockInfo(triggerTimeMs, pendingIntent)
          alarmManager.setAlarmClock(clockInfo, pendingIntent)
        } else {
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent)
        }

        restored++
        Log.d(TAG, "✅ Restored alarm: $alarmId at $triggerTimeMs")
      }

      Log.d(TAG, "📊 Boot restore complete: $restored restored, $skipped skipped")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Boot restore failed: ${e.message}", e)
    }
  }
}
