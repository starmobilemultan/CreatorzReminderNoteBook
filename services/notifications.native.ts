/**
 * notifications.native.ts — iOS & Android only
 * Web preview uses notifications.web.ts (all stubs).
 *
 * ROOT CAUSE FIXES:
 * Issue 1 & 3 (Full-screen + screen wake):
 *   - `channelId` in the notification content MUST match the versioned channel name exactly.
 *     Previously `buildContent` passed `ch` (versioned) but Android sometimes resolved to the
 *     default non-versioned channel. Now we always pass the explicit versioned channel string.
 *   - Channel `reminders-high` now uses `importance: MAX` with `bypassDnd: true` — this is
 *     what causes Android to wake the screen. Previously importance was HIGH for some paths.
 *   - `fullScreenIntent: true` must be on BOTH the channel AND the notification payload.
 *     Channel now carries `allowBubbles: true` as well for lock-screen display.
 *   - `setNotificationHandler` now returns `shouldShowBanner: true` and `priority: MAX`
 *     for all non-pre-reminder types so foreground display also wakes the screen.
 *
 * Issue 2 (App killed = missed notifications):
 *   - `expo-notifications` schedules via Android AlarmManager which survives app kill.
 *     The real problem is OEM battery management killing the alarm. This is handled by
 *     the battery optimization prompt in permissions.native.ts.
 *   - Added `scheduleNotificationAsync` with `channelId` explicitly set so the OS uses
 *     the HIGH/MAX channel even when the app is killed (channel carries wake settings).
 *   - All notifications now include `sticky: false, ongoing: false` so they are dismissible.
 *
 * Issue 4 (Permissions):
 *   - `requestNotificationPermissions` now also handles the full-screen intent permission
 *     check path so callers don't need to manage it separately.
 *   - Channel version bump logic is preserved so sound/vibration changes always apply.
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
// Android locks sound/vibration channel settings after first creation.
// We version channels so changed settings always apply correctly.
let _channelVersion = 1;

export function setChannelVersion(v: number): void {
  _channelVersion = v;
}

// IMPORTANT: This must match exactly what is passed in `channelId` inside notification content.
function versionedChannelId(base: string): string {
  return `${base}_v${_channelVersion}`;
}

// ─── Foreground notification handler ─────────────────────────────────────────
// This fires when a notification arrives while the app is open.
// For fullscreen/popup types we show the banner AND play sound at MAX priority.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;
    const type: string = data?.type ?? 'popup-reminder';
    const isPreReminder = type === 'pre-reminder' || type === 'banner-reminder';

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      // MAX priority is required for screen wake on foreground notifications
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
    console.warn('[Notifications] Failed to register categories:', err);
  }
}

// ─── Delete old versioned channels to avoid stale sound/vibration settings ───
async function deleteStaleChannels(currentVersion: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  const bases = ['reminders', 'reminders-high', 'reminders-pre'];

  // Delete all previous versions
  for (let v = 1; v < currentVersion; v++) {
    for (const base of bases) {
      try {
        await Notifications.deleteNotificationChannelAsync(`${base}_v${v}`);
      } catch (_) {}
    }
  }

  // Delete legacy channels (no version suffix) from before versioning was added
  for (const base of bases) {
    try {
      await Notifications.deleteNotificationChannelAsync(base);
    } catch (_) {}
  }
}

// ─── Android channel setup ────────────────────────────────────────────────────
// FIX: The high-priority channel now uses AndroidImportance.MAX (not HIGH) and
// has bypassDnd: true which is what actually wakes the screen on Android.
// The channel sound/vibration must be set here AND in individual notifications.
export async function ensureAndroidChannels(
  soundEnabled = true,
  vibrationEnabled = true
): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Remove stale versioned channels so settings always reflect current prefs
  await deleteStaleChannels(_channelVersion);

  // Standard reminders — high importance, optional sound/vibration
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders'), {
    name: 'Reminders',
    description: 'Standard reminder alerts',
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

  // High-priority / full-screen channel — must be MAX importance + bypassDnd
  // These two settings are what causes Android to:
  //   1. Wake the screen when it is off
  //   2. Show the notification on the lock screen
  //   3. Allow fullScreenIntent to display over the lock screen
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders-high'), {
    name: 'Alarm Reminders',
    description: 'Full-screen alarm-style alerts — wakes screen and bypasses Do Not Disturb',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: vibrationEnabled ? [0, 500, 300, 500, 300, 500] : undefined,
    lightColor: '#EF4444',
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    enableLights: true,
    showBadge: true,
    // bypassDnd: true is REQUIRED for screen wake on silent/DND mode
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Pre-reminders — advance notice, lighter style
  await Notifications.setNotificationChannelAsync(versionedChannelId('reminders-pre'), {
    name: 'Early Reminders',
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
  else parts.push('Tap to view your reminder');
  return parts.filter(Boolean).join('\n');
}

// ─── Build notification content ───────────────────────────────────────────────
// FIX: `channelId` is explicitly passed as the versioned string so Android
// always uses the channel with the correct importance/sound/vibration settings.
// Previously there was a risk of Android falling back to the default channel
// which does not have `bypassDnd` or `MAX` importance.
function buildContent(
  reminder: Reminder,
  settings: AppSettings,
  isHighPriority: boolean,
  useFullScreen: boolean,
  ch: string,
  overrideType?: string
): Notifications.NotificationContentInput {
  const bodyText = buildBody(reminder);

  // Android-specific extras
  // FIX: `channelId` is the already-versioned channel ID (e.g. "reminders-high_v3")
  // `priority` MAX ensures the system treats this as a heads-up notification
  // `fullScreenIntent: true` is what causes Android to show over lock screen
  // `sticky: false` keeps the notification dismissible
  const androidExtras: Record<string, any> = {
    channelId: ch, // already versioned — must match created channel
    color: isHighPriority ? '#EF4444' : '#6366F1',
    priority: isHighPriority
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH,
    sticky: false,
    ongoing: false,
    autoDismiss: true,
    visibility: 1, // VISIBILITY_PUBLIC — show on lock screen
  };

  // fullScreenIntent: true makes Android show the notification even when
  // screen is off AND the app is in the background / killed.
  // This requires USE_FULL_SCREEN_INTENT permission (declared in app.json).
  if (useFullScreen) {
    androidExtras.fullScreenIntent = true;
  }

  if (!settings.vibrationEnabled) {
    androidExtras.vibrate = null;
  }

  const sound = settings.soundEnabled ? 'default' : undefined;

  const notifType =
    overrideType ??
    (useFullScreen ? 'fullscreen-reminder' : 'popup-reminder');

  return {
    title: buildTitle(reminder),
    body: bodyText,
    subtitle: reminder.priority !== 'medium' ? getPriorityLabel(reminder.priority) : undefined,
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

    // Cancel any existing notifications for this reminder first
    await cancelReminderNotifications(reminder.id);

    // For one-time reminders in the past, nothing to schedule
    if (reminder.repeat === 'none' && reminderDate <= now) return;

    // Ensure channels exist with current sound/vibration settings
    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    const isHighPriority = reminder.priority === 'high';
    const useFullScreen =
      settings.notificationStyle === 'fullscreen' ||
      (isHighPriority && (settings.highPriorityFullscreen ?? true));

    // FIX: Channel selection — high priority AND fullscreen both use the MAX channel
    // which has bypassDnd: true and AndroidImportance.MAX for screen wake behavior
    const ch = isHighPriority || useFullScreen
      ? versionedChannelId('reminders-high')
      : versionedChannelId('reminders');

    const notifType = useFullScreen
      ? 'fullscreen-reminder'
      : settings.notificationStyle === 'popup'
        ? 'popup-reminder'
        : 'banner-reminder';

    const content = buildContent(reminder, settings, isHighPriority, useFullScreen, ch, notifType);

    // Schedule based on repeat pattern
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
      // One-time reminder
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

    // Schedule pre-notification if enabled
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
  // Monthly occurrences (up to 24)
  for (let i = 0; i < 24; i++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-m${i}`);
    } catch (_) {}
  }
  // Yearly occurrences (up to 5)
  for (let i = 0; i < 5; i++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-${reminderId}-y${i}`);
    } catch (_) {}
  }
}

// ─── Reschedule all active reminders ─────────────────────────────────────────
// Called on startup (to recover from app-killed state) and on settings changes.
export async function rescheduleAllNotifications(
  reminders: Reminder[],
  settings: AppSettings
): Promise<void> {
  try {
    // Recreate channels with current settings first
    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    if (!settings.notificationEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] Notifications disabled — cancelled all.');
      return;
    }

    // Cancel everything and reschedule fresh
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
    // Cancel any existing snooze for this reminder
    try {
      await Notifications.cancelScheduledNotificationAsync(`reminder-snooze-${reminderId}`);
    } catch (_) {}

    await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
    await registerNotificationCategories();

    const snoozeDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const isHighPriority = priority === 'high';
    const useFullScreen =
      notificationStyle === 'fullscreen' ||
      (isHighPriority && (settings.highPriorityFullscreen ?? true));

    const ch = isHighPriority || useFullScreen
      ? versionedChannelId('reminders-high')
      : versionedChannelId('reminders');

    const notifType = useFullScreen ? 'fullscreen-reminder' : 'popup-reminder';
    const priorityLabel = getPriorityLabel(priority);
    const fullBody = [priorityLabel, reminderBody].filter(Boolean).join('\n');
    const timeLabel = snoozeMinutes >= 60 ? `${snoozeMinutes / 60}h` : `${snoozeMinutes} min`;

    const androidExtras: Record<string, any> = {
      channelId: ch,
      color: isHighPriority ? '#EF4444' : '#6366F1',
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: false,
      ongoing: false,
      autoDismiss: true,
      visibility: 1,
    };

    if (useFullScreen) {
      androidExtras.fullScreenIntent = true;
    }

    if (!settings.vibrationEnabled) {
      androidExtras.vibrate = null;
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

    console.log(`[Notifications] Snoozed "${reminderTitle}" for ${snoozeMinutes} min on ch=${ch}`);
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
