/**
 * nativeAlarm.ts — Native Android Alarm Service
 *
 * Bridge between the React Native reminder system and native Android AlarmManager.
 * Provides real alarm behavior identical to Google Clock on Android.
 *
 * Architecture:
 *   JS (RemindersContext/notifications.ts) → nativeAlarm.ts → AlarmManagerModule (Kotlin)
 *     → AlarmManager.setAlarmClock() → AlarmReceiver (BroadcastReceiver)
 *     → AlarmActivity (FullScreenIntent) → WakeLock + Screen ON + Over LockScreen
 *     → Main RN app launched → AlarmModal shown
 *
 * The BootReceiver re-schedules all alarms from SharedPreferences after reboot.
 * expo-notifications continues to handle popup/banner style reminders.
 */

import { Platform } from 'react-native';
import { Reminder, AppSettings } from '../types';

// ─── Platform guard ───────────────────────────────────────────────────────────
type AlarmModuleType = typeof import('../modules/alarm-manager');
let AlarmModule: AlarmModuleType | null = null;

if (Platform.OS === 'android') {
  try {
    AlarmModule = require('../modules/alarm-manager') as AlarmModuleType;
  } catch (e) {
    console.warn('[NativeAlarm] AlarmManager native module not available (expected in dev/web):', e);
    AlarmModule = null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NativeAlarmEntry {
  id: string;
  triggerTimeMs: number;
  title: string;
  body: string;
  priority: string;
  extra: string; // JSON string
}

export interface PendingAlarmPayload {
  reminderId: string;
  title: string;
  body: string;
  priority: string;
  extra: Record<string, any>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildAlarmTitle(reminder: Reminder): string {
  return `🔔 ${reminder.title}`;
}

function buildAlarmBody(reminder: Reminder): string {
  const desc = reminder.description?.trim();
  const priorityLabel =
    ({ high: '🔴 HIGH PRIORITY', medium: '🟡 MEDIUM PRIORITY', low: '🟢 LOW PRIORITY' } as any)[
      reminder.priority
    ] ?? '';
  const parts = [priorityLabel];
  if (desc) parts.push(desc);
  return parts.filter(Boolean).join('\n');
}

function buildAlarmId(reminderId: string, suffix = ''): string {
  return suffix ? `alarm-${reminderId}-${suffix}` : `alarm-${reminderId}`;
}

function getNextOccurrence(reminder: Reminder): Date | null {
  const base = new Date(reminder.dateTime);
  const now = new Date();
  let candidate = new Date(base);

  switch (reminder.repeat) {
    case 'daily':
      while (candidate <= now) candidate.setDate(candidate.getDate() + 1);
      return candidate;
    case 'weekly':
      while (candidate <= now) candidate.setDate(candidate.getDate() + 7);
      return candidate;
    case 'monthly': {
      const origDay = base.getDate();
      while (candidate <= now) {
        candidate.setDate(1);
        candidate.setMonth(candidate.getMonth() + 1);
        const lastDay = new Date(
          candidate.getFullYear(),
          candidate.getMonth() + 1,
          0
        ).getDate();
        candidate.setDate(Math.min(origDay, lastDay));
      }
      return candidate;
    }
    case 'yearly':
      while (candidate <= now) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    default:
      return null;
  }
}

// ─── Schedule a single native alarm ──────────────────────────────────────────
/**
 * Schedules a real Android AlarmManager alarm that fires regardless of:
 *   - App state (killed/background/foreground)
 *   - Screen state (off/on)
 *   - Lock screen state
 *   - Doze mode
 *   - Battery optimization
 */
export async function scheduleNativeAlarmForReminder(
  reminder: Reminder,
  settings: AppSettings
): Promise<void> {
  if (!AlarmModule) return;
  if (!settings.notificationEnabled) return;
  if (reminder.isCompleted || reminder.isArchived) return;

  const reminderDate = new Date(reminder.dateTime);
  const now = new Date();

  if (reminder.repeat === 'none' && reminderDate <= now) return;

  let triggerDate = reminderDate;
  if (reminder.repeat !== 'none' && reminderDate <= now) {
    const next = getNextOccurrence(reminder);
    if (!next) return;
    triggerDate = next;
  }

  const alarmId = buildAlarmId(reminder.id);
  const title = buildAlarmTitle(reminder);
  const body = buildAlarmBody(reminder);

  const extraData = {
    reminderId: reminder.id,
    reminderTitle: reminder.title,
    reminderBody: reminder.description?.trim() || '',
    type: 'fullscreen-reminder',
    priority: reminder.priority,
    repeat: reminder.repeat,
    notificationStyle: settings.notificationStyle,
  };

  try {
    await AlarmModule.scheduleNativeAlarm({
      id: alarmId,
      triggerTimeMs: triggerDate.getTime(),
      title,
      body,
      priority: reminder.priority,
      extra: JSON.stringify(extraData),
    });
    console.log(
      `[NativeAlarm] ✅ Scheduled: "${reminder.title}" at ${triggerDate.toLocaleString()} | id=${alarmId}`
    );
  } catch (e) {
    console.error(`[NativeAlarm] ❌ Schedule failed for "${reminder.title}":`, e);
  }
}

// ─── Cancel native alarms for a reminder ─────────────────────────────────────
export async function cancelNativeAlarmForReminder(reminderId: string): Promise<void> {
  if (!AlarmModule) return;
  const ids = [
    buildAlarmId(reminderId),
    buildAlarmId(reminderId, 'pre'),
    buildAlarmId(reminderId, 'snooze'),
  ];
  for (const id of ids) {
    try {
      await AlarmModule.cancelNativeAlarm(id);
    } catch (_) {}
  }
}

// ─── Reschedule ALL reminders with native alarms ──────────────────────────────
export async function rescheduleAllNativeAlarms(
  reminders: Reminder[],
  settings: AppSettings
): Promise<void> {
  if (!AlarmModule) return;
  if (!settings.notificationEnabled) return;

  const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
  const persistEntries: NativeAlarmEntry[] = [];

  for (const reminder of active) {
    const reminderDate = new Date(reminder.dateTime);
    const now = new Date();

    let triggerDate = reminderDate;
    if (reminder.repeat === 'none' && reminderDate <= now) continue;
    if (reminder.repeat !== 'none' && reminderDate <= now) {
      const next = getNextOccurrence(reminder);
      if (!next) continue;
      triggerDate = next;
    }

    const alarmId = buildAlarmId(reminder.id);
    const title = buildAlarmTitle(reminder);
    const body = buildAlarmBody(reminder);
    const extraData = {
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderBody: reminder.description?.trim() || '',
      type: 'fullscreen-reminder',
      priority: reminder.priority,
      repeat: reminder.repeat,
      notificationStyle: settings.notificationStyle,
    };

    const entry: NativeAlarmEntry = {
      id: alarmId,
      triggerTimeMs: triggerDate.getTime(),
      title,
      body,
      priority: reminder.priority,
      extra: JSON.stringify(extraData),
    };

    persistEntries.push(entry);

    try {
      await AlarmModule.scheduleNativeAlarm(entry);
    } catch (e) {
      console.error(`[NativeAlarm] Reschedule failed for ${reminder.id}:`, e);
    }
  }

  // Persist the full alarm list for BootReceiver restoration after reboot
  try {
    await AlarmModule.persistAlarms(persistEntries);
    console.log(
      `[NativeAlarm] ✅ Rescheduled & persisted ${persistEntries.length} native alarms`
    );
  } catch (e) {
    console.error('[NativeAlarm] Persist failed:', e);
  }
}

// ─── Read pending alarm from native SharedPreferences ────────────────────────
/**
 * Called on app startup/foreground to check if a native alarm fired.
 * The AlarmReceiver writes alarm data to SharedPreferences; AlarmActivity
 * also writes it. This function reads + clears it for one-shot consumption.
 *
 * Returns null if no pending alarm or if it is stale (> 60 seconds old).
 */
export async function getPendingNativeAlarm(): Promise<PendingAlarmPayload | null> {
  if (Platform.OS !== 'android' || !AlarmModule) return null;

  try {
    const result = await AlarmModule.getPendingAlarm();
    if (!result) return null;

    const alarmId = result.alarmId;
    // Extract reminderId from the alarmId format: "alarm-<reminderId>"
    const reminderId = alarmId.replace(/^alarm-/, '').replace(/-snooze$/, '').replace(/-pre$/, '');

    let extra: Record<string, any> = {};
    try {
      extra = JSON.parse(result.extra);
    } catch (_) {}

    const payload: PendingAlarmPayload = {
      reminderId: extra.reminderId || reminderId,
      title: result.title.replace(/^🔔\s*/, ''),
      body: result.body,
      priority: result.priority,
      extra,
    };

    console.log('[NativeAlarm] 🔔 Pending alarm found:', payload.reminderId);
    return payload;
  } catch (e) {
    console.error('[NativeAlarm] getPendingAlarm failed:', e);
    return null;
  }
}

// ─── Check exact alarm permission ────────────────────────────────────────────
export async function checkNativeExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AlarmModule) return true;
  try {
    return await AlarmModule.canScheduleExactAlarms();
  } catch {
    return true;
  }
}
