/**
 * notifications.native.ts — iOS & Android only
 * Web preview uses notifications.web.ts (all stubs).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder, AppSettings } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Channel versioning ───────────────────────────────────────────────────────
// Android locks channel settings after first creation; delete + recreate on change.
let _channelVersion = 1;

export function setChannelVersion(v: number) {
  _channelVersion = v;
}

function channelId(base: string): string {
  return `${base}_v${_channelVersion}`;
}

// ─── Foreground notification handler ─────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;
    const isPreReminder = data?.type === 'pre-reminder';
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isPreReminder
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// ─── Register notification categories ────────────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_REMINDER, []);
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_SNOOZE, []);
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_PRE, []);
  } catch (err) {
    console.error('[Notifications] Failed to register categories:', err);
  }
}

// ─── Delete old versioned channels ───────────────────────────────────────────
async function deleteOldChannels(currentVersion: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  const bases = ['reminders', 'reminders-high', 'reminders-pre'];
  for (let v = 1; v < currentVersion; v++) {
    for (const base of bases) {
      try { await Notifications.deleteNotificationChannelAsync(`${base}_v${v}`); } catch (_) {}
    }
  }
  // Also delete legacy channels without version suffix
  for (const base of bases) {
    try { await Notifications.deleteNotificationChannelAsync(base); } catch (_) {}
  }
}

// ─── Android channel setup ────────────────────────────────────────────────────
export async function ensureAndroidChannels(
  soundEnabled = true,
  vibrationEnabled = true
): Promise<void> {
  if (Platform.OS !== 'android') return;

  await deleteOldChannels(_channelVersion);

  await Notifications.setNotificationChannelAsync(channelId('reminders'), {
    name: 'Reminders',
    description: 'Scheduled reminder alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: vibrationEnabled ? [0, 400, 200, 400] : undefined,
    lightColor: '#6366F1',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: true,
    showBadge: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(channelId('reminders-high'), {
    name: 'High Priority Reminders',
    description: 'Alarm-style alerts that bypass Do Not Disturb and wake the screen',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: vibrationEnabled ? [0, 500, 300, 500, 300, 500] : undefined,
    lightColor: '#EF4444',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: true,
    showBadge: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(channelId('reminders-pre'), {
    name: 'Early Reminder Alerts',
    description: 'Advance notice before a reminder is due',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: vibrationEnabled ? [0, 200] : undefined,
    lightColor: '#10B981',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: false,
    showBadge: false,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─── Permission request ───────────────────────────────────────────────────────
export async function requestNotificationPermissions(
  soundEnabled = true,
  vibrationEnabled = true
): Promise<boolean> {
  try {
    await ensureAndroidChannels(soundEnabled, vibrationEnabled);
    await registerNotificationCategories();

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
        allowCriticalAlerts: true,
        provideAppNotificationSettings: true,
      },
    });

    return status === 'granted';
  } catch (err) {
    console.error('[Notifications] Permission request failed:', err);
    return false;
  }
}

export async function getNotificationPermissionStatus(): Promise<string> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? '';
}

function buildTitle(reminder: Reminder, isPreReminder = false): string {
  if (isPreReminder) return `⏰ Pre-Reminder: ${reminder.title}`;
  return `🔔 ${reminder.title}`;
}

function buildBody(reminder: Reminder, isPreReminder = false, preMinutesLabel = ''): string {
  const priorityLabel = getPriorityLabel(reminder.priority);
  const desc = reminder.description?.trim();

  if (isPreReminder) {
    const parts = [`Due in ${preMinutesLabel}`, priorityLabel];
    if (desc) parts.push(desc);
    return parts.filter(Boolean).join(' · ');
  }

  const parts = [priorityLabel];
  if (desc) parts.push(desc);
  if (!desc) parts.push('Tap to view your reminder');
  return parts.filter(Boolean).join('\n');
}

function buildContent(
  reminder: Reminder,
  settings: AppSettings,
  isHighPriority: boolean,
  useFullScreen: boolean,
  ch: string,
  overrideType?: string
): Notifications.NotificationContentInput {
  const bodyText = buildBody(reminder);

  const androidExtras: Record<string, any> = {
    channelId: ch,
    color: isHighPriority ? '#EF4444' : '#6366F1',
    priority: isHighPriority
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH,
    sticky: false,
    autoDismiss: true,
    ...(useFullScreen && { fullScreenIntent: true }),
  };

  if (!settings.vibrationEnabled) {
    androidExtras.vibrate = null;
  }

  const sound = settings.soundEnabled ? 'default' : undefined;

  return {
    title: buildTitle(reminder),
    body: bodyText,
    subtitle: reminder.priority !== 'medium' ? getPriorityLabel(reminder.priority) : undefined,
    sound,
    data: {
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderBody: reminder.description?.trim() || '',
      type: overrideType ?? (useFullScreen ? 'fullscreen-reminder' : 'popup-reminder'),
      priority: reminder.priority,
      repeat: reminder.repeat,
      notificationStyle: settings.notificationStyle,
    },
    ...(Platform.OS === 'android' && androidExtras),
  };
}

// ─── Monthly / yearly occurrence helpers ──────────────────────────────────────
function getMonthlyOccurrences(from: Date, count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const origDay = from.getDate();
  let candidate = new Date(from);
  let safetyLimit = 0;

  while (dates.length < count && safetyLimit < 300) {
    safetyLimit++;
    if (candidate > now) dates.push(new Date(candidate));
    candidate = new Date(candidate);
    const nextMonth = candidate.getMonth() + 1;
    candidate.setDate(1);
    candidate.setMonth(nextMonth);
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    candidate.setDate(Math.min(origDay, lastDay));
  }
  return dates;
}

function getYearlyOccurrences(from: Date, count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let candidate = new Date(from);
  while (dates.length < count) {
    if (candidate > now) dates.push(new Date(candidate));
    candidate = new Date(candidate);
    candidate.setFullYear(candidate.getFullYear() + 1);
    if (candidate.getFullYear() - now.getFullYear() > 20) break;
  }
  return dates;
}

// ─── Schedule a single reminder ───────────────────────────────────────────────
export async function scheduleReminderNotification(
  reminder: Reminder,
  settings: AppSettings
): Promise<void> {
  try {
    if (!settings.notificationEnabled) return;

    const reminderDate = new Date(reminder.dateTime);
    const now = new Date();

    await cancelReminderNotifications(reminder.id);
    if (reminder.repeat === 'none' && reminderDate <= now) return;

    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    const isHighPriority = reminder.priority === 'high';
    const useFullScreen =
      settings.notificationStyle === 'fullscreen' ||
      (isHighPriority && (settings.highPriorityFullscreen ?? true));

    const isPopup = settings.notificationStyle === 'popup' && !useFullScreen;
    const notifType = useFullScreen
      ? 'fullscreen-reminder'
      : isPopup ? 'popup-reminder' : 'banner-reminder';

    const ch = isHighPriority || useFullScreen
      ? channelId('reminders-high')
      : channelId('reminders');

    const content = buildContent(reminder, settings, isHighPriority, useFullScreen, ch, notifType);

    if (reminder.repeat === 'daily') {
      await Notifications.scheduleNotificationAsync({
        identifier: `reminder-${reminder.id}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: reminderDate.getHours(),
          minute: reminderDate.getMinutes(),
        },
      });
    } else if (reminder.repeat === 'weekly') {
      await Notifications.scheduleNotificationAsync({
        identifier: `reminder-${reminder.id}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: reminderDate.getDay() + 1,
          hour: reminderDate.getHours(),
          minute: reminderDate.getMinutes(),
        },
      });
    } else if (reminder.repeat === 'monthly') {
      const occurrences = getMonthlyOccurrences(reminderDate, 24);
      for (let i = 0; i < occurrences.length; i++) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}-m${i}`,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: occurrences[i] },
        });
      }
    } else if (reminder.repeat === 'yearly') {
      const occurrences = getYearlyOccurrences(reminderDate, 5);
      for (let i = 0; i < occurrences.length; i++) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}-y${i}`,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: occurrences[i] },
        });
      }
    } else {
      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}`,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
        });
      }
    }

    console.log(`[Notifications] ✅ "${reminder.title}" | style=${settings.notificationStyle} | repeat=${reminder.repeat} | ch=${ch}`);

    if (settings.preNotifyEnabled && (settings.preNotifyMinutes ?? 10) > 0) {
      await schedulePreNotification(reminder, settings, reminderDate);
    }
  } catch (err) {
    console.error(`[Notifications] Failed to schedule "${reminder.title}":`, err);
  }
}

async function schedulePreNotification(
  reminder: Reminder,
  settings: AppSettings,
  reminderDate: Date
): Promise<void> {
  try {
    const preMinutes = settings.preNotifyMinutes ?? 10;
    const now = new Date();
    const preDate = new Date(reminderDate.getTime() - preMinutes * 60 * 1000);
    if (preDate <= now) return;

    const minutesLabel = preMinutes >= 60 ? `${preMinutes / 60} hour` : `${preMinutes} min`;
    const preCh = channelId('reminders-pre');

    const preAndroid: Record<string, any> = {
      channelId: preCh,
      color: '#10B981',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
    if (!settings.vibrationEnabled) preAndroid.vibrate = null;

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-pre-${reminder.id}`,
      content: {
        title: buildTitle(reminder, true),
        body: buildBody(reminder, true, minutesLabel),
        sound: settings.soundEnabled ? 'default' : undefined,
        data: {
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          reminderBody: reminder.description?.trim() || '',
          type: 'pre-reminder',
          priority: reminder.priority,
        },
        ...(Platform.OS === 'android' && preAndroid),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: preDate },
    });
  } catch (err) {
    console.error('[Notifications] Pre-reminder failed:', err);
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  for (const id of [
    `reminder-${reminderId}`,
    `reminder-pre-${reminderId}`,
    `reminder-snooze-${reminderId}`,
  ]) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
  }
  for (let i = 0; i < 24; i++) {
    try { await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-m${i}`); } catch (_) {}
  }
  for (let i = 0; i < 5; i++) {
    try { await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-y${i}`); } catch (_) {}
  }
}

// ─── Reschedule all ───────────────────────────────────────────────────────────
export async function rescheduleAllNotifications(
  reminders: Reminder[],
  settings: AppSettings
): Promise<void> {
  try {
    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    if (!settings.notificationEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
    for (const reminder of active) {
      await scheduleReminderNotification(reminder, settings);
    }
    console.log(`[Notifications] ✅ Rescheduled ${active.length} reminders`);
  } catch (err) {
    console.error('[Notifications] rescheduleAll failed:', err);
  }
}

// ─── Snooze ───────────────────────────────────────────────────────────────────
export async function snoozeReminder(
  reminderId: string,
  reminderTitle: string,
  reminderBody: string,
  snoozeMinutes: number,
  settings: AppSettings,
  priority: string = 'medium',
  notificationStyle: string = 'popup'
): Promise<void> {
  try {
    try { await Notifications.cancelScheduledNotificationAsync(`reminder-snooze-${reminderId}`); } catch (_) {}

    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    const snoozeDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const isHighPriority = priority === 'high';
    const useFullScreen =
      notificationStyle === 'fullscreen' ||
      (isHighPriority && (settings.highPriorityFullscreen ?? true));

    const ch = isHighPriority || useFullScreen ? channelId('reminders-high') : channelId('reminders');
    const notifType = useFullScreen ? 'fullscreen-reminder' : 'popup-reminder';
    const priorityLabel = getPriorityLabel(priority);
    const fullBody = [priorityLabel, reminderBody].filter(Boolean).join('\n');

    const androidExtras: Record<string, any> = {
      channelId: ch,
      color: isHighPriority ? '#EF4444' : '#6366F1',
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: false,
      autoDismiss: true,
      ...(useFullScreen && { fullScreenIntent: true }),
    };
    if (!settings.vibrationEnabled) androidExtras.vibrate = null;

    const timeLabel = snoozeMinutes >= 60 ? `${snoozeMinutes / 60}h` : `${snoozeMinutes} min`;

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-snooze-${reminderId}`,
      content: {
        title: `🔔 ${reminderTitle}`,
        body: fullBody || 'Snoozed reminder — time is up!',
        subtitle: `Snoozed · ${timeLabel}`,
        sound: settings.soundEnabled ? 'default' : undefined,
        data: {
          reminderId,
          reminderTitle,
          reminderBody,
          type: notifType,
          priority,
          snoozed: true,
          notificationStyle,
        },
        ...(Platform.OS === 'android' && androidExtras),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: snoozeDate },
    });
  } catch (err) {
    console.error('[Notifications] Snooze failed:', err);
  }
}

// ─── Debug ────────────────────────────────────────────────────────────────────
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}
