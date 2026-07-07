/**
 * notifications.native.ts — iOS & Android only
 *
 * HOW ANDROID FULL-SCREEN INTENT ACTUALLY WORKS IN EXPO:
 *
 * In expo-notifications (managed workflow), full-screen intent is triggered
 * EXCLUSIVELY by the NOTIFICATION CHANNEL configuration, NOT by any content field.
 *
 * The content object does NOT have a `fullScreenIntent` property in the
 * NotificationContentInput type. Setting `content.fullScreenIntent = true`
 * does nothing — it's just ignored data. (Previous implementations incorrectly
 * relied on this non-existent field.)
 *
 * WHAT ACTUALLY TRIGGERS FULL-SCREEN INTENT:
 *   1. Channel importance = AndroidImportance.MAX  ← required
 *   2. Channel bypassDnd = true                    ← required
 *   3. USE_FULL_SCREEN_INTENT permission granted   ← required on Android 14+
 *   4. App is NOT battery-optimized                ← required for background
 *   5. SYSTEM_ALERT_WINDOW permission granted      ← required to show over lock
 *
 * When all of the above are met, Android automatically calls setFullScreenIntent()
 * on the notification and launches the app's MainActivity. Our app then shows
 * the AlarmModal over the current screen / lock screen.
 *
 * POPUP vs FULLSCREEN channel separation:
 *   - POPUP: reminders channel (HIGH importance, NO bypassDnd)
 *     → Heads-up banner on top of current app, does NOT launch app
 *   - FULLSCREEN: reminders-high channel (MAX importance, bypassDnd=true)
 *     → Wakes screen, launches app via fullScreenIntent, AlarmModal renders
 *   - BANNER: reminders channel (HIGH importance, no modal)
 *
 * HIGH PRIORITY reminders:
 *   notificationStyle='popup' + priority='high' + highPriorityFullscreen=true
 *   → Upgraded to fullscreen-reminder (uses reminders-high channel)
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
let _channelVersion = 1;

export function setChannelVersion(v: number): void {
  _channelVersion = v;
}

function versionedChannelId(base: string): string {
  return `${base}_v${_channelVersion}`;
}

export function getPopupChannelId(): string {
  return versionedChannelId('reminders');
}

export function getAlarmChannelId(): string {
  return versionedChannelId('reminders-high');
}

// ─── Foreground notification handler ─────────────────────────────────────────
// Wrapped in a function (not top-level) to prevent module crash at load time.
function registerNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[Notifications] setNotificationHandler failed:', err);
  }
}

// Register on first import (safe — wrapped in try/catch)
try { registerNotificationHandler(); } catch (_) {}

// ─── Register notification categories ────────────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_REMINDER, []);
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_SNOOZE, []);
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_PRE, []);
  } catch (err) {
    console.warn('[Notifications] Failed to register categories:', err);
  }
}

// ─── Delete stale versioned channels ─────────────────────────────────────────
async function deleteStaleChannels(currentVersion: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  const bases = ['reminders', 'reminders-high', 'reminders-pre', 'reminders-popup'];

  for (let v = 1; v < currentVersion; v++) {
    for (const base of bases) {
      try {
        await Notifications.deleteNotificationChannelAsync(`${base}_v${v}`);
      } catch (_) {}
    }
  }

  // Also delete any non-versioned legacy channels
  for (const base of bases) {
    try {
      await Notifications.deleteNotificationChannelAsync(base);
    } catch (_) {}
  }
}

// ─── Android channel setup ────────────────────────────────────────────────────
export async function ensureAndroidChannels(
  soundEnabled = true,
  vibrationEnabled = true
): Promise<void> {
  if (Platform.OS !== 'android') return;

  registerNotificationHandler();
  await deleteStaleChannels(_channelVersion);

  // ── POPUP / BANNER channel ──────────────────────────────────────────────────
  // HIGH importance → shows heads-up banner over current app.
  // bypassDnd=false → respects Do Not Disturb.
  // Does NOT trigger fullScreenIntent → app is NOT launched automatically.
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders'), {
    name: 'Reminders',
    description: 'Popup and banner reminder alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: vibrationEnabled ? [0, 300, 200, 300] : undefined,
    lightColor: '#6366F1',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: true,
    showBadge: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // ── FULLSCREEN / ALARM channel ──────────────────────────────────────────────
  // MAX importance + bypassDnd=true → THIS is what triggers fullScreenIntent.
  // Android automatically calls setFullScreenIntent() for MAX+bypassDnd channels.
  // The app's MainActivity launches → AlarmModal renders over lock screen.
  // REQUIRES: USE_FULL_SCREEN_INTENT permission (Android 14+)
  //           SYSTEM_ALERT_WINDOW permission (for drawing over lock screen)
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders-high'), {
    name: 'Alarm Reminders',
    description: 'Full-screen alarms — wakes screen, bypasses Do Not Disturb',
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

  // ── PRE-REMINDER channel ────────────────────────────────────────────────────
  // DEFAULT importance → standard notification bar item, no heads-up banner.
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders-pre'), {
    name: 'Early Reminders',
    description: 'Advance notice before a reminder is due',
    importance: Notifications.AndroidImportance.DEFAULT,
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
  else parts.push('Tap to open your reminder');
  return parts.filter(Boolean).join('\n');
}

function shouldUseFullScreen(reminder: Reminder, settings: AppSettings): boolean {
  if (settings.notificationStyle === 'fullscreen') return true;
  if (
    reminder.priority === 'high' &&
    (settings.highPriorityFullscreen ?? true) &&
    settings.notificationStyle !== 'banner'
  ) {
    return true;
  }
  return false;
}

// ─── Build notification content ───────────────────────────────────────────────
// IMPORTANT: There is NO `fullScreenIntent` property in expo-notifications
// NotificationContentInput. Do NOT set it on content — it does nothing.
// Full-screen intent behavior comes entirely from the channel (MAX + bypassDnd).
function buildContent(
  reminder: Reminder,
  settings: AppSettings,
  notifType: 'fullscreen-reminder' | 'popup-reminder' | 'banner-reminder',
  ch: string
): Notifications.NotificationContentInput {
  const isFullScreen = notifType === 'fullscreen-reminder';
  const isHighPriority = reminder.priority === 'high';

  const content: any = {
    title: buildTitle(reminder),
    body: buildBody(reminder),
    subtitle: isHighPriority ? getPriorityLabel(reminder.priority) : undefined,
    sound: settings.soundEnabled ? 'default' : undefined,
    data: {
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderBody: reminder.description?.trim() || '',
      type: notifType,
      priority: reminder.priority,
      repeat: reminder.repeat,
      notificationStyle: settings.notificationStyle,
    },
  };

  if (Platform.OS === 'android') {
    // channelId — MUST be the versioned channel ID created by ensureAndroidChannels
    // For fullscreen: reminders-high_vN (MAX+bypassDnd → triggers fullScreenIntent)
    // For popup/banner: reminders_vN (HIGH → heads-up banner only)
    content.channelId = ch;

    content.color = isFullScreen ? '#EF4444' : '#6366F1';

    content.priority = isFullScreen
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH;

    content.lockscreenVisibility = Notifications.AndroidNotificationVisibility.PUBLIC;
    content.autoDismiss = true;
    content.sticky = false;
    content.ongoing = false;

    content.vibrationPattern = !settings.vibrationEnabled
      ? null
      : isFullScreen
        ? [0, 500, 300, 500, 300, 500]
        : [0, 300, 200, 300];
  }

  return content as Notifications.NotificationContentInput;
}

// ─── Monthly / yearly occurrence helpers ─────────────────────────────────────
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

    const useFullScreen = shouldUseFullScreen(reminder, settings);
    let notifType: 'fullscreen-reminder' | 'popup-reminder' | 'banner-reminder';

    if (useFullScreen) {
      notifType = 'fullscreen-reminder';
    } else if (settings.notificationStyle === 'banner') {
      notifType = 'banner-reminder';
    } else {
      notifType = 'popup-reminder';
    }

    const ch = notifType === 'fullscreen-reminder'
      ? versionedChannelId('reminders-high')
      : versionedChannelId('reminders');

    const content = buildContent(reminder, settings, notifType, ch);

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
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: occurrences[i],
          },
        });
      }
    } else if (reminder.repeat === 'yearly') {
      const occurrences = getYearlyOccurrences(reminderDate, 5);
      for (let i = 0; i < occurrences.length; i++) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}-y${i}`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: occurrences[i],
          },
        });
      }
    } else {
      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }
    }

    console.log(
      `[Notifications] ✅ "${reminder.title}" | type=${notifType} | ch=${ch} | repeat=${reminder.repeat}`
    );

    if (settings.preNotifyEnabled && (settings.preNotifyMinutes ?? 10) > 0) {
      await schedulePreNotification(reminder, settings, reminderDate);
    }
  } catch (err) {
    console.error(`[Notifications] Failed to schedule "${reminder.title}":`, err);
  }
}

// ─── Pre-reminder notification ────────────────────────────────────────────────
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
    const preCh = versionedChannelId('reminders-pre');

    const preContent: any = {
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
    };

    if (Platform.OS === 'android') {
      preContent.channelId = preCh;
      preContent.color = '#10B981';
      preContent.priority = Notifications.AndroidNotificationPriority.DEFAULT;
      preContent.lockscreenVisibility = Notifications.AndroidNotificationVisibility.PUBLIC;
      preContent.autoDismiss = true;
      if (!settings.vibrationEnabled) {
        preContent.vibrationPattern = null;
      }
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-pre-${reminder.id}`,
      content: preContent,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: preDate,
      },
    });
  } catch (err) {
    console.warn('[Notifications] Pre-reminder scheduling failed:', err);
  }
}

// ─── Cancel all notifications for a reminder ─────────────────────────────────
export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  const ids = [
    `reminder-${reminderId}`,
    `reminder-pre-${reminderId}`,
    `reminder-snooze-${reminderId}`,
  ];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (_) {}
  }
  for (let i = 0; i < 24; i++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-m${i}`);
    } catch (_) {}
  }
  for (let i = 0; i < 5; i++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-y${i}`);
    } catch (_) {}
  }
}

// ─── Reschedule all active reminders ─────────────────────────────────────────
export async function rescheduleAllNotifications(
  reminders: Reminder[],
  settings: AppSettings
): Promise<void> {
  try {
    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    if (!settings.notificationEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] Notifications disabled — cancelled all.');
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
    for (const reminder of active) {
      await scheduleReminderNotification(reminder, settings);
    }

    console.log(`[Notifications] ✅ Rescheduled ${active.length} active reminders.`);
  } catch (err) {
    console.error('[Notifications] rescheduleAll failed:', err);
  }
}

// ─── Snooze a reminder ────────────────────────────────────────────────────────
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
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-snooze-${reminderId}`);
    } catch (_) {}

    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    const snoozeDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const isHighPriority = priority === 'high';
    const useFullScreen =
      notificationStyle === 'fullscreen' ||
      (isHighPriority && (settings.highPriorityFullscreen ?? true) && notificationStyle !== 'banner');

    const notifType: 'fullscreen-reminder' | 'popup-reminder' = useFullScreen
      ? 'fullscreen-reminder'
      : 'popup-reminder';

    const ch = useFullScreen
      ? versionedChannelId('reminders-high')
      : versionedChannelId('reminders');

    const priorityLabel = getPriorityLabel(priority);
    const fullBody = [priorityLabel, reminderBody].filter(Boolean).join('\n');
    const timeLabel = snoozeMinutes >= 60 ? `${snoozeMinutes / 60}h` : `${snoozeMinutes} min`;

    const snoozeContent: any = {
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
    };

    if (Platform.OS === 'android') {
      snoozeContent.channelId = ch;
      snoozeContent.color = useFullScreen ? '#EF4444' : '#6366F1';
      snoozeContent.priority = useFullScreen
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH;
      snoozeContent.lockscreenVisibility = Notifications.AndroidNotificationVisibility.PUBLIC;
      snoozeContent.autoDismiss = true;
      snoozeContent.sticky = false;
      snoozeContent.ongoing = false;
      snoozeContent.vibrationPattern = settings.vibrationEnabled
        ? (useFullScreen ? [0, 500, 300, 500, 300, 500] : [0, 300, 200, 300])
        : null;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-snooze-${reminderId}`,
      content: snoozeContent,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeDate,
      },
    });

    console.log(
      `[Notifications] Snoozed "${reminderTitle}" for ${snoozeMinutes} min | type=${notifType} | ch=${ch}`
    );
  } catch (err) {
    console.error('[Notifications] Snooze failed:', err);
  }
}

// ─── Debug helper ─────────────────────────────────────────────────────────────
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

// ─── Test notification ────────────────────────────────────────────────────────
export async function scheduleTestNotification(settings: AppSettings): Promise<void> {
  await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
  await registerNotificationCategories();

  const isFullScreen = settings.notificationStyle === 'fullscreen';
  const notifType = isFullScreen ? 'fullscreen-reminder' : 'popup-reminder';
  const ch = isFullScreen
    ? versionedChannelId('reminders-high')
    : versionedChannelId('reminders');

  const testContent: any = {
    title: '🔔 Test Reminder',
    body: '🟡 MEDIUM PRIORITY\nThis is a test — your notifications are working!',
    sound: settings.soundEnabled ? 'default' : undefined,
    data: {
      reminderId: 'test-' + Date.now(),
      reminderTitle: 'Test Reminder',
      reminderBody: 'This is a test notification!',
      type: notifType,
      priority: 'medium',
      notificationStyle: settings.notificationStyle,
    },
  };

  if (Platform.OS === 'android') {
    testContent.channelId = ch;
    testContent.color = isFullScreen ? '#EF4444' : '#6366F1';
    testContent.priority = isFullScreen
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH;
    testContent.lockscreenVisibility = Notifications.AndroidNotificationVisibility.PUBLIC;
    testContent.autoDismiss = true;
    testContent.sticky = false;
    testContent.vibrationPattern = settings.vibrationEnabled
      ? (isFullScreen ? [0, 500, 300, 500, 300, 500] : [0, 300, 200, 300])
      : null;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: 'test-notification-' + Date.now(),
    content: testContent,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}
