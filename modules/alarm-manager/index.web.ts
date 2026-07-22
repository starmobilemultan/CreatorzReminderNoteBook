/**
 * modules/alarm-manager/index.web.ts
 *
 * Web stubs — native AlarmManager is Android-only.
 * Metro automatically picks this file when bundling for web.
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
export async function canScheduleExactAlarms(): Promise<boolean> { return true; }
export async function persistAlarms(_alarms: AlarmData[]): Promise<void> {}
export async function getPendingAlarm(): Promise<PendingAlarmResult | null> { return null; }
export async function clearPendingAlarm(): Promise<void> {}
