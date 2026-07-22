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

class AlarmManagerModule : Module() {

  companion object {
    const val PREFS_NAME = "creatorz_pending_alarm"
    const val PREFS_ALARMS = "creatorz_alarms"

    const val KEY_PENDING_ALARM_ID = "pending_alarm_id"
    const val KEY_PENDING_ALARM_TITLE = "pending_alarm_title"
    const val KEY_PENDING_ALARM_BODY = "pending_alarm_body"
    const val KEY_PENDING_ALARM_PRIORITY = "pending_alarm_priority"
    const val KEY_PENDING_ALARM_EXTRA = "pending_alarm_extra"
    const val KEY_PENDING_ALARM_TIME = "pending_alarm_time"

    // Stale alarm threshold: ignore alarms older than 60 seconds
    const val STALE_THRESHOLD_MS = 60_000L
  }

  override fun definition() = ModuleDefinition {
    Name("CreatorzAlarmManager")

    // ── scheduleNativeAlarm ─────────────────────────────────────────────────
    AsyncFunction("scheduleNativeAlarm") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val alarmId = params["id"] as? String ?: throw Exception("Missing alarm id")
      val triggerTimeMs = when (val t = params["triggerTimeMs"]) {
        is Double -> t.toLong()
        is Long -> t
        is Int -> t.toLong()
        else -> throw Exception("Invalid triggerTimeMs")
      }
      val title = params["title"] as? String ?: "Reminder"
      val body = params["body"] as? String ?: ""
      val priority = params["priority"] as? String ?: "medium"
      val extra = params["extra"] as? String ?: "{}"

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

      // setAlarmClock() — most reliable, shown in Android status bar, Doze-exempt
      val clockInfo = AlarmManager.AlarmClockInfo(triggerTimeMs, pendingIntent)
      alarmManager.setAlarmClock(clockInfo, pendingIntent)
      Log.d("CreatorzAlarm", "✅ setAlarmClock scheduled: $alarmId at $triggerTimeMs")
    }

    // ── cancelNativeAlarm ───────────────────────────────────────────────────
    AsyncFunction("cancelNativeAlarm") { alarmId: String ->
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
      val pendingIntent = PendingIntent.getBroadcast(context, alarmId.hashCode(), intent, flags)
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
      Log.d("CreatorzAlarm", "❌ Alarm cancelled: $alarmId")
    }

    // ── canScheduleExactAlarms ──────────────────────────────────────────────
    AsyncFunction("canScheduleExactAlarms") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.canScheduleExactAlarms()
      } else {
        true
      }
    }

    // ── persistAlarms (for BootReceiver restoration) ────────────────────────
    AsyncFunction("persistAlarms") { alarms: List<Map<String, Any>> ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences(PREFS_ALARMS, Context.MODE_PRIVATE)
      // Convert list to JSON string
      val jsonArray = org.json.JSONArray()
      for (alarm in alarms) {
        val obj = JSONObject()
        for ((k, v) in alarm) obj.put(k, v)
        jsonArray.put(obj)
      }
      prefs.edit().putString("alarms_data", jsonArray.toString()).apply()
      Log.d("CreatorzAlarm", "💾 ${alarms.size} alarms persisted for boot restore")
    }

    // ── getPendingAlarm (read by RN after alarm fires) ──────────────────────
    AsyncFunction("getPendingAlarm") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val alarmId = prefs.getString(KEY_PENDING_ALARM_ID, null)

      if (alarmId.isNullOrEmpty()) return@AsyncFunction null

      val timestamp = prefs.getLong(KEY_PENDING_ALARM_TIME, 0L)
      val now = System.currentTimeMillis()

      // Discard stale alarms (older than 60 seconds)
      if (now - timestamp > STALE_THRESHOLD_MS) {
        prefs.edit().clear().apply()
        return@AsyncFunction null
      }

      val result = JSONObject().apply {
        put("alarmId", alarmId)
        put("title", prefs.getString(KEY_PENDING_ALARM_TITLE, "Reminder") ?: "Reminder")
        put("body", prefs.getString(KEY_PENDING_ALARM_BODY, "") ?: "")
        put("priority", prefs.getString(KEY_PENDING_ALARM_PRIORITY, "medium") ?: "medium")
        put("extra", prefs.getString(KEY_PENDING_ALARM_EXTRA, "{}") ?: "{}")
        put("timestamp", timestamp)
      }

      // Clear after reading — one-shot consumption
      prefs.edit().clear().apply()

      result.toString()
    }

    // ── clearPendingAlarm ───────────────────────────────────────────────────
    AsyncFunction("clearPendingAlarm") { ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().clear().apply()
    }
  }
}
