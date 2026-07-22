/**
 * services/nativeAlarm.web.ts — Web stub for nativeAlarm service
 * Metro picks this file automatically on web builds.
 */
import { Reminder, AppSettings } from '../types';

export interface NativeAlarmEntry {
  id: string;
  triggerTimeMs: number;
  title: string;
  body: string;
  priority: string;
  extra: string;
}

export interface PendingAlarmPayload {
  reminderId: string;
  title: string;
  body: string;
  priority: string;
  extra: Record<string, any>;
}

export async function scheduleNativeAlarmForReminder(
  _reminder: Reminder,
  _settings: AppSettings
): Promise<void> {}

export async function cancelNativeAlarmForReminder(_reminderId: string): Promise<void> {}

export async function rescheduleAllNativeAlarms(
  _reminders: Reminder[],
  _settings: AppSettings
): Promise<void> {}

export async function getPendingNativeAlarm(): Promise<PendingAlarmPayload | null> {
  return null;
}

export async function checkNativeExactAlarmPermission(): Promise<boolean> {
  return false;
}
