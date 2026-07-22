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

export async function scheduleNativeAlarm(alarm: AlarmData): Promise<void> {
  return AlarmManagerNative.scheduleAlarm(
    alarm.id,
    alarm.triggerTimeMs,
    alarm.title,
    alarm.body,
    alarm.priority,
    alarm.extra
  );
}

export async function cancelNativeAlarm(alarmId: string): Promise<void> {
  return AlarmManagerNative.cancelAlarm(alarmId);
}

export async function cancelAllNativeAlarms(alarmIds: string[]): Promise<void> {
  if (alarmIds.length === 0) return;
  return AlarmManagerNative.cancelAllAlarms(alarmIds);
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  return AlarmManagerNative.canScheduleExactAlarms();
}

export async function persistAlarms(alarms: AlarmData[]): Promise<void> {
  return AlarmManagerNative.persistAlarms(JSON.stringify(alarms));
}

export async function getPersistedAlarms(): Promise<AlarmData[]> {
  const json: string = await AlarmManagerNative.getPersistedAlarms();
  try {
    return JSON.parse(json) as AlarmData[];
  } catch {
    return [];
  }
}

/**
 * Returns the alarm that fired and launched the app (via AlarmActivity).
 * Returns null if no pending alarm exists or it is stale (> 60 seconds old).
 * Automatically clears the pending alarm after reading.
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

export async function clearPendingAlarm(): Promise<void> {
  return AlarmManagerNative.clearPendingAlarm();
}
