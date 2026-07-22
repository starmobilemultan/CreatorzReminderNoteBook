package com.creatorz.alarmmanager

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import org.json.JSONArray

class AlarmManagerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CreatorzAlarmManager")

    AsyncFunction("scheduleAlarm") { alarmId: String, triggerTimeMs: Double, title: String, body: String, priority: String, extra: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val triggerMs = triggerTimeMs.toLong()

      val intent = Intent(context, AlarmReceiver::class.java).apply {
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

      val requestCode = alarmId.hashCode()
      val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        val clockInfo = AlarmManager.AlarmClockInfo(triggerMs, pendingIntent)
        alarmManager.setAlarmClock(clockInfo, pendingIntent)
        Log.d("CreatorzAlarm", "✅ setAlarmClock scheduled: $alarmId at $triggerMs")
      } else {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
      }
    }

    AsyncFunction("cancelAlarm") { alarmId: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val intent = Intent(context, AlarmReceiver::class.java).apply {
        action = "com.creatorz.ALARM_FIRE"
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }

      val requestCode = alarmId.hashCode()
      val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
      Log.d("CreatorzAlarm", "❌ Alarm cancelled: $alarmId")
    }

    AsyncFunction("cancelAllAlarms") { alarmIds: List<String> ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      for (alarmId in alarmIds) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
          action = "com.creatorz.ALARM_FIRE"
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(context, alarmId.hashCode(), intent, flags)
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
      }
      Log.d("CreatorzAlarm", "❌ Cancelled ${alarmIds.size} alarms")
    }

    AsyncFunction("canScheduleExactAlarms") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.canScheduleExactAlarms()
      } else {
        true
      }
    }

    // Store alarm list for BootReceiver restoration
    AsyncFunction("persistAlarms") { alarmsJson: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences("creatorz_alarms", Context.MODE_PRIVATE)
      prefs.edit().putString("alarms_data", alarmsJson).apply()
      Log.d("CreatorzAlarm", "💾 Alarms persisted")
    }

    AsyncFunction("getPersistedAlarms") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences("creatorz_alarms", Context.MODE_PRIVATE)
      prefs.getString("alarms_data", "[]") ?: "[]"
    }

    // ── Pending Alarm: written by AlarmReceiver when alarm fires ─────────────
    // React Native polls this to show the AlarmModal when app opens from alarm
    AsyncFunction("getPendingAlarm") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences("creatorz_pending_alarm", Context.MODE_PRIVATE)
      val alarmId = prefs.getString("pending_alarm_id", null)
      if (alarmId == null || alarmId.isEmpty()) {
        return@AsyncFunction null
      }

      val timestamp = prefs.getLong("pending_alarm_time", 0L)
      val now = System.currentTimeMillis()

      // Only return if within 60 seconds (fresh alarm)
      if (now - timestamp > 60_000L) {
        prefs.edit().clear().apply()
        return@AsyncFunction null
      }

      val result = JSONObject().apply {
        put("alarmId", alarmId)
        put("title", prefs.getString("pending_alarm_title", "Reminder") ?: "Reminder")
        put("body", prefs.getString("pending_alarm_body", "") ?: "")
        put("priority", prefs.getString("pending_alarm_priority", "medium") ?: "medium")
        put("extra", prefs.getString("pending_alarm_extra", "{}") ?: "{}")
        put("timestamp", timestamp)
      }

      // Clear after reading
      prefs.edit().clear().apply()

      result.toString()
    }

    // ── Clear pending alarm (called after modal is shown) ─────────────────────
    AsyncFunction("clearPendingAlarm") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences("creatorz_pending_alarm", Context.MODE_PRIVATE)
      prefs.edit().clear().apply()
    }
  }
}
