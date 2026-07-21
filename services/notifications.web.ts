/**
 * notifications.web.ts — Web stubs (expo-notifications not supported on web)
 * Metro picks this file automatically when bundling for web.
 */
import { Reminder, AppSettings } from '../types';

export const NOTIFICATION_CATEGORY_REMINDER = 'REMINDER_ACTIONS';
export const NOTIFICATION_CATEGORY_SNOOZE = 'SNOOZE_ACTIONS';
export const NOTIFICATION_CATEGORY_PRE = 'PRE_REMINDER_ACTIONS';

export const ACTION_MARK_DONE = 'mark_done';
export const ACTION_SNOOZE_5 = 'snooze_5';
export const ACTION_SNOOZE_10 = 'snooze_10';
export const ACTION_SNOOZE_30 = 'snooze_30';

export const PRIORITY_LABELS: Record<string, string> = {
  high: '🔴 HIGH PRIORITY',
  medium: '🟡 MEDIUM PRIORITY',
  low: '🟢 LOW PRIORITY',
};

export function setChannelVersion(_v: number): void {}

export async function registerNotificationCategories(): Promise<void> {}

export async function ensureAndroidChannels(
  _soundEnabled?: boolean,
  _vibrationEnabled?: boolean
): Promise<void> {}

export async function requestNotificationPermissions(
  _soundEnabled?: boolean,
  _vibrationEnabled?: boolean
): Promise<boolean> {
  return false;
}

export async function getNotificationPermissionStatus(): Promise<string> {
  return 'denied';
}

export async function scheduleReminderNotification(
  _reminder: Reminder,
  _settings: AppSettings
): Promise<void> {}

export async function cancelReminderNotifications(_reminderId: string): Promise<void> {}

export async function rescheduleAllNotifications(
  _reminders: Reminder[],
  _settings: AppSettings
): Promise<void> {}

export async function snoozeReminder(
  _reminderId: string,
  _reminderTitle: string,
  _reminderBody: string,
  _snoozeMinutes: number,
  _settings: AppSettings,
  _priority?: string,
  _notificationStyle?: string
): Promise<void> {}

export function getPopupChannelId(): string { return 'reminders_v1'; }
export function getAlarmChannelId(): string { return 'reminders-high_v1'; }
export async function getScheduledNotifications(): Promise<any[]> { return []; }
export async function scheduleTestNotification(_settings: any): Promise<void> {}
