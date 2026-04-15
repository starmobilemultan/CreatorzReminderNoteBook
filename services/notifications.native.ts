/**
 * notifications.native.ts — iOS & Android only
 *
 * KEY ARCHITECTURE DECISIONS:
 *
 * POPUP vs FULLSCREEN separation:
 *   - POPUP: Uses `reminders` channel (HIGH importance, NO fullScreenIntent, NO bypassDnd)
 *     → Shows as a heads-up banner on top of whatever app is open
 *     → Does NOT bring the app to foreground automatically
 *     → User can dismiss or tap to open the app manually
 *
 *   - FULLSCREEN: Uses `reminders-high` channel (MAX importance, fullScreenIntent: true, bypassDnd: true)
 *     → Wakes the screen
 *     → Launches the app to foreground automatically (Android behavior for fullScreenIntent)
 *     → Shows our AlarmModal full-screen overlay
 *     → Works even when app is killed (AlarmManager + fullScreenIntent)
 *
 *   - BANNER: Uses `reminders` channel (HIGH importance)
 *     → Standard notification — no popup, no fullscreen
 *
 * HIGH PRIORITY reminders:
 *   - If notificationStyle = 'popup' and priority = 'high' AND highPriorityFullscreen = true
 *     → Upgraded to fullscreen-reminder
 *   - Otherwise high priority popup stays as popup (banner heads-up, does NOT open app)
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

/** Expose the current versioned channel IDs so callers can build correct notifications */
export function getPopupChannelId(): string {
  return versionedChannelId('reminders');
}

export function getAlarmChannelId(): string {
  return versionedChannelId('reminders-high');
}

// ─── Foreground notification handler ─────────────────────────────────────────
// When app is in foreground:
//   - fullscreen: show at MAX priority (AlarmModal will render)
//   - popup: show at HIGH priority as a banner (AlarmModal will render via received listener)
//   - banner/pre: show at HIGH priority only in system tray
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;
    const type: string = data?.type ?? 'popup-reminder';
    const isFullScreen = type === 'fullscreen-reminder';
    const isBannerOrPre = type === 'pre-reminder' || type === 'banner-reminder';

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isFullScreen
        ? Notifications.AndroidNotificationPriority.MAX
        : isBannerOrPre
          ? Notifications.AndroidNotificationPriority.DEFAULT
          : Notifications.AndroidNotificationPriority.HIGH,
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

  // Remove legacy non-versioned channels
  for (const base of bases) {
    try {
      await Notifications.deleteNotificationChannelAsync(base);
    } catch (_) {}
  }
}

// ─── Android channel setup ────────────────────────────────────────────────────
// TWO SEPARATE CHANNELS:
//   reminders        → POPUP & BANNER: HIGH importance, no bypassDnd, no fullScreenIntent
//   reminders-high   → FULLSCREEN: MAX importance, bypassDnd=true, fullScreenIntent fires here
export async function ensureAndroidChannels(
  soundEnabled = true,
  vibrationEnabled = true
): Promise<void> {
  if (Platform.OS !== 'android') return;

  await deleteStaleChannels(_channelVersion);

  // ── POPUP / BANNER channel (HIGH importance) ──────────────────────────────
  // HIGH importance = shows heads-up banner on top of current app
  // Does NOT wake screen, does NOT bypass DND, does NOT open the app
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders'), {
    name: 'Reminders',
    description: 'Popup and banner reminder alerts — appears as a heads-up banner',
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

  // ── FULLSCREEN / ALARM channel (MAX importance) ───────────────────────────
  // MAX importance = wakes screen, bypasses DND, allows fullScreenIntent
  // This channel is ONLY used for fullscreen-type reminders
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders-high'), {
    name: 'Alarm Reminders',
    description: 'Full-screen alarm alerts — wakes screen and bypasses Do Not Disturb',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: vibrationEnabled ? [0, 500, 300, 500, 300, 500] : undefined,
    lightColor: '#EF4444',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: true,
    showBadge: true,
    bypassDnd: true,          // ← REQUIRED: wakes screen even in DND/silent mode
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // ── PRE-REMINDER channel (DEFAULT importance) ─────────────────────────────
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

// ─── Determine if fullscreen should be used ───────────────────────────────────
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
// CRITICAL: popup notifications MUST NOT have fullScreenIntent=true
// popup → reminders channel (HIGH), no fullScreenIntent
// fullscreen → reminders-high channel (MAX), fullScreenIntent=true
function buildContent(
  reminder: Reminder,
  settings: AppSettings,
  notifType: 'fullscreen-reminder' | 'popup-reminder' | 'banner-reminder',
  ch: string
): Notifications.NotificationContentInput {
  const isFullScreen = notifType === 'fullscreen-reminder';
  const isHighPriority = reminder.priority === 'high';

  const androidExtras: Record<string, any> = {
    channelId: ch,
    color: isFullScreen ? '#EF4444' : '#6366F1',
    priority: isFullScreen
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH,
    sticky: false,
    ongoing: false,
    autoDismiss: true,
    visibility: 1, // VISIBILITY_PUBLIC — show on lock screen
  };

  // ONLY set fullScreenIntent for fullscreen type
  // DO NOT set it for popup — it would bring the app to foreground
  if (isFullScreen) {
    androidExtras.fullScreenIntent = true;
  }

  if (!settings.vibrationEnabled) {
    androidExtras.vibrate = null;
  } else if (isFullScreen) {
    androidExtras.vibrate = [0, 500, 300, 500, 300, 500];
  } else {
    androidExtras.vibrate = [0, 300, 200, 300];
  }

  const sound = settings.soundEnabled ? 'default' : undefined;

  return {
    title: buildTitle(reminder),
    body: buildBody(reminder),
    subtitle: isHighPriority ? getPriorityLabel(reminder.priority) : undefined,
    sound,
    data: {
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderBody: reminder.description?.trim() || '',
      type: notifType,
      priority: reminder.priority,
      repeat: reminder.repeat,
      notificationStyle: settings.notificationStyle,
    },
    ...(Platform.OS === 'android' ? androidExtras : {}),
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

    // Determine notification type
    const useFullScreen = shouldUseFullScreen(reminder, settings);
    let notifType: 'fullscreen-reminder' | 'popup-reminder' | 'banner-reminder';

    if (useFullScreen) {
      notifType = 'fullscreen-reminder';
    } else if (settings.notificationStyle === 'banner') {
      notifType = 'banner-reminder';
    } else {
      notifType = 'popup-reminder';
    }

    // Channel selection:
    // fullscreen → reminders-high (MAX, bypassDnd, fullScreenIntent)
    // popup/banner → reminders (HIGH, no fullScreenIntent)
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

    const preAndroid: Record<string, any> = {
      channelId: preCh,
      color: '#10B981',
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
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
        ...(Platform.OS === 'android' ? preAndroid : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: preDate,
      },
    });
  } catch (err) {
    console.warn('[Notifications] Pre-reminder scheduling failed:', err);
  }
}

// ─── Cancel all notifications for a reminder ──────────────────────────────────
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

    const androidExtras: Record<string, any> = {
      channelId: ch,
      color: useFullScreen ? '#EF4444' : '#6366F1',
      priority: useFullScreen
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
      sticky: false,
      ongoing: false,
      autoDismiss: true,
      visibility: 1,
    };

    if (useFullScreen) {
      androidExtras.fullScreenIntent = true;
      androidExtras.vibrate = settings.vibrationEnabled ? [0, 500, 300, 500, 300, 500] : null;
    } else {
      androidExtras.vibrate = settings.vibrationEnabled ? [0, 300, 200, 300] : null;
    }

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
        ...(Platform.OS === 'android' ? androidExtras : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeDate,
      },
    });

    console.log(`[Notifications] Snoozed "${reminderTitle}" for ${snoozeMinutes} min | type=${notifType} | ch=${ch}`);
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
/**
 * Schedules a test notification in 5 seconds using the CORRECT versioned channel.
 * Uses the popup channel (HIGH importance) for popup/banner styles so the user
 * sees a real heads-up banner, and the alarm channel (MAX) for fullscreen.
 */
export async function scheduleTestNotification(
  settings: AppSettings
): Promise<void> {
  await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
  await registerNotificationCategories();

  const isFullScreen = settings.notificationStyle === 'fullscreen';
  const notifType = isFullScreen ? 'fullscreen-reminder' : 'popup-reminder';

  // Use the correct versioned channel — this is the key fix
  const ch = isFullScreen ? versionedChannelId('reminders-high') : versionedChannelId('reminders');

  const androidExtras: Record<string, any> = {
    channelId: ch, // ← VERSIONED — matches the actual channel on device
    color: isFullScreen ? '#EF4444' : '#6366F1',
    priority: isFullScreen
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH,
    sticky: false,
    autoDismiss: true,
    visibility: 1,
  };

  if (isFullScreen) {
    androidExtras.fullScreenIntent = true;
    androidExtras.vibrate = settings.vibrationEnabled ? [0, 500, 300, 500, 300, 500] : null;
  } else {
    androidExtras.vibrate = settings.vibrationEnabled ? [0, 300, 200, 300] : null;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: 'test-notification-' + Date.now(),
    content: {
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
      ...(Platform.OS === 'android' ? androidExtras : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });
}
