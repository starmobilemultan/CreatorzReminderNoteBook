/**
 * modules/alarm-manager/index.ts
 *
 * JavaScript bridge to the native CreatorzAlarmManager Kotlin module.
 * Uses expo-modules-core's requireNativeModule to load the native module.
 *
 * All functions are no-ops / stubs when running on non-Android platforms
 * (handled by metro resolving index.web.ts for web).
 */
import { requireNativeModule } from 'expo-modules-core';

export interface AlarmData {
  id: string;
  triggerTimeMs: number;
  title: string;
  body: string;
  priority: string;
  extra: string; // JSON string
}

export interface PendingAlarmResult {
  alarmId: string;
  title: string;
  body: string;
  priority: string;
  extra: string; // JSON string
  timestamp: number;
}

const AlarmManagerNative = requireNativeModule('CreatorzAlarmManager');

/**
 * Schedule a real Android AlarmManager alarm.
 * Uses setAlarmClock() which is Doze-exempt and shown in the Android status bar.
 */
export async function scheduleNativeAlarm(alarm: AlarmData): Promise<void> {
  return AlarmManagerNative.scheduleNativeAlarm({
    id: alarm.id,
    triggerTimeMs: alarm.triggerTimeMs,
    title: alarm.title,
    body: alarm.body,
    priority: alarm.priority,
    extra: alarm.extra,
  });
}

/**
 * Cancel a scheduled alarm by its ID.
 */
export async function cancelNativeAlarm(alarmId: string): Promise<void> {
  return AlarmManagerNative.cancelNativeAlarm(alarmId);
}

/**
 * Check whether the app can schedule exact alarms (Android 12+ requirement).
 * Returns true on Android < 12 where no special permission is needed.
 */
export async function canScheduleExactAlarms(): Promise<boolean> {
  return AlarmManagerNative.canScheduleExactAlarms();
}

/**
 * Persist the full alarm list to SharedPreferences so BootReceiver can
 * restore all alarms after a device reboot.
 */
export async function persistAlarms(alarms: AlarmData[]): Promise<void> {
  // Pass as a plain JS array — expo-modules-core serializes it to List<Map<String,Any>>
  return AlarmManagerNative.persistAlarms(
    alarms.map(a => ({
      id: a.id,
      triggerTimeMs: a.triggerTimeMs,
      title: a.title,
      body: a.body,
      priority: a.priority,
      extra: a.extra,
    }))
  );
}

/**
 * Returns the alarm that fired and launched the app (via AlarmActivity).
 * The result is a JSON string parsed into PendingAlarmResult.
 * Returns null if no pending alarm exists or it is stale (> 60 seconds old).
 * The pending alarm is automatically cleared after reading (one-shot).
 */
export async function getPendingAlarm(): Promise<PendingAlarmResult | null> {
  try {
    const result: string | null = await AlarmManagerNative.getPendingAlarm();
    if (!result) return null;
    return JSON.parse(result) as PendingAlarmResult;
  } catch {
    return null;
  }
}

/**
 * Manually clear the pending alarm SharedPreferences entry.
 */
export async function clearPendingAlarm(): Promise<void> {
  return AlarmManagerNative.clearPendingAlarm();
}
