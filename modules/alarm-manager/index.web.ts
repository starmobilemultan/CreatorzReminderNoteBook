/**
 * modules/alarm-manager/index.web.ts
 * Web stub — the native AlarmManager module is Android-only.
 * Metro picks this file on web builds automatically.
 */

export interface AlarmData {
  id: string;
  triggerTimeMs: number;
  title: string;
  body: string;
  priority: string;
  extra: string;
}

export interface PendingAlarmResult {
  alarmId: string;
  title: string;
  body: string;
  priority: string;
  extra: string;
  timestamp: number;
}

export async function scheduleNativeAlarm(_alarm: AlarmData): Promise<void> {}
export async function cancelNativeAlarm(_alarmId: string): Promise<void> {}
export async function cancelAllNativeAlarms(_alarmIds: string[]): Promise<void> {}
export async function canScheduleExactAlarms(): Promise<boolean> { return false; }
export async function persistAlarms(_alarms: AlarmData[]): Promise<void> {}
export async function getPersistedAlarms(): Promise<AlarmData[]> { return []; }
export async function getPendingAlarm(): Promise<PendingAlarmResult | null> { return null; }
export async function clearPendingAlarm(): Promise<void> {}
