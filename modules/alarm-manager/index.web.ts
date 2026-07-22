/**
 * modules/alarm-manager/index.web.ts
 *
 * Web platform stub — all functions are no-ops on web.
 * The module is Android-only; web builds skip this module entirely.
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

export async function scheduleNativeAlarm(alarm: AlarmData): Promise<void> {
  console.warn('[Alarm] scheduleNativeAlarm is not available on web platform');
}

export async function cancelNativeAlarm(alarmId: string): Promise<void> {
  console.warn('[Alarm] cancelNativeAlarm is not available on web platform');
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  return false;
}

export async function persistAlarms(alarms: AlarmData[]): Promise<void> {
  console.warn('[Alarm] persistAlarms is not available on web platform');
}

export async function getPendingAlarm(): Promise<PendingAlarmResult | null> {
  return null;
}

export async function clearPendingAlarm(): Promise<void> {
  console.warn('[Alarm] clearPendingAlarm is not available on web platform');
}
