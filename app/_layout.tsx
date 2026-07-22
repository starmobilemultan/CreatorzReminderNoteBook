import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { NotesProvider } from '../contexts/NotesContext';
import { RemindersProvider } from '../contexts/RemindersContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { useSettings } from '../hooks/useSettings';
import { useReminders } from '../hooks/useReminders';
import { useEffect, useRef, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  rescheduleAllNotifications,
  registerNotificationCategories,
  snoozeReminder,
  ensureAndroidChannels,
  setChannelVersion,
} from '../services/notifications';
import { runStartupPermissionCheck } from '../services/permissions';
import { AlarmModal, AlarmPayload } from '../components/reminders/AlarmModal';
import { getPendingNativeAlarm } from '../services/nativeAlarm';

// ─── Extract clean payload from an expo-notifications notification ────────────
function extractPayload(
  notification: Notifications.Notification
): AlarmPayload | null {
  const data = notification.request.content.data as any;
  const reminderId: string | undefined = data?.reminderId;
  if (!reminderId) return null;

  const rawTitle = notification.request.content.title ?? 'Reminder';
  const title = rawTitle
    .replace(/^🔔\s*/, '')
    .replace(/^⏰\s*(Pre-Reminder:\s*)?/, '');

  const type: string = data?.type ?? 'popup-reminder';
  const resolvedType: 'fullscreen-reminder' | 'popup-reminder' =
    type === 'fullscreen-reminder' ? 'fullscreen-reminder' : 'popup-reminder';

  return {
    reminderId,
    title,
    body: (data?.reminderBody as string) ?? '',
    type: resolvedType,
    priority: (data?.priority as string) ?? 'medium',
    notificationStyle: (data?.notificationStyle as string) ?? 'popup',
  };
}

// ─── Convert PendingNativeAlarm to AlarmPayload ───────────────────────────────
async function readPendingNativeAlarm(): Promise<AlarmPayload | null> {
  try {
    const pending = await getPendingNativeAlarm();
    if (!pending || !pending.reminderId) return null;
    return {
      reminderId: pending.reminderId,
      title: pending.title,
      body: pending.body,
      type: 'fullscreen-reminder',
      priority: pending.priority ?? 'medium',
      notificationStyle: 'fullscreen',
    };
  } catch {
    return null;
  }
}

// ─── Inner layout: has access to all contexts ─────────────────────────────────
function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { settings, isLocked, lock } = useSettings();
  const { reminders, toggleComplete } = useReminders();

  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [alarmVisible, setAlarmVisible] = useState(false);
  const [alarmPayload, setAlarmPayload] = useState<AlarmPayload | null>(null);

  const appState = useRef(AppState.currentState);
  const notifReceivedRef = useRef<Notifications.EventSubscription | null>(null);
  const notifResponseRef = useRef<Notifications.EventSubscription | null>(null);
  // Track last shown reminderId to avoid duplicate modals
  const lastShownReminderRef = useRef<string | null>(null);
  const modalShowTimeRef = useRef<number>(0);

  // Allow navigation after navigator mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsNavigationReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── Helper: show alarm modal (deduplicates rapid-fire events) ────────────
  const showAlarmModal = useCallback((payload: AlarmPayload) => {
    const now = Date.now();
    if (
      lastShownReminderRef.current === payload.reminderId &&
      now - modalShowTimeRef.current < 3000
    ) {
      return;
    }
    lastShownReminderRef.current = payload.reminderId;
    modalShowTimeRef.current = now;
    setAlarmPayload(payload);
    setAlarmVisible(true);
  }, []);

  // ── Init: permissions + reschedule + handle cold-launch notification ──────
  useEffect(() => {
    if (!settings.onboardingCompleted) return;
    const init = async () => {
      const cv = (settings.soundEnabled ? 2 : 1) + (settings.vibrationEnabled ? 0 : 10);
      setChannelVersion(cv);

      await runStartupPermissionCheck();
      await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
      await registerNotificationCategories();

      if (reminders.length > 0) {
        await rescheduleAllNotifications(reminders, settings);
      }

      // ── Check for NATIVE alarm launch (AlarmActivity → AlarmManagerModule) ──
      // The native AlarmActivity writes alarm data to SharedPreferences AND
      // also passes it as a JS-accessible value. We check AsyncStorage here
      // because the native AlarmReceiver writes via our bridge.
      // Additionally check the React Native initial props / launch intent.
      try {
        const nativeAlarm = await readPendingNativeAlarm();
        if (nativeAlarm && nativeAlarm.reminderId) {
          setTimeout(() => showAlarmModal(nativeAlarm), 600);
          return; // Native alarm takes priority
        }
      } catch (_) {}

      // ── Check for expo-notifications cold launch (tap on notification) ──
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const payload = extractPayload(lastResponse.notification);
          if (payload) {
            setTimeout(() => showAlarmModal(payload), 800);
          }
        }
      } catch (_) {}

      // ── Check for fullScreenIntent launch (Android: app launched automatically) ──
      try {
        const initial = await (Notifications as any).getInitialNotificationAsync?.();
        if (initial) {
          const payload = extractPayload(initial);
          if (payload) {
            setTimeout(() => showAlarmModal(payload), 800);
          }
        }
      } catch (_) {}
    };
    init();
  }, [settings.onboardingCompleted]);

  // ── Reschedule when notification settings change ──────────────────────────
  useEffect(() => {
    if (!settings.onboardingCompleted) return;
    const cv = (settings.soundEnabled ? 2 : 1) + (settings.vibrationEnabled ? 0 : 10);
    setChannelVersion(cv);
    if (reminders.length === 0) return;
    rescheduleAllNotifications(reminders, settings).catch(() => {});
  }, [
    settings.notificationEnabled,
    settings.soundEnabled,
    settings.vibrationEnabled,
    settings.preNotifyEnabled,
    settings.preNotifyMinutes,
    settings.notificationStyle,
    settings.highPriorityFullscreen,
  ]);

  // ── Re-check when app comes to foreground ────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      if (wasBackground && next === 'active') {
        lock();

        // Check for pending native alarm when app resumes
        // (handles case where AlarmActivity was shown while app was backgrounded)
        try {
          const nativeAlarm = await readPendingNativeAlarm();
          if (nativeAlarm && nativeAlarm.reminderId) {
            showAlarmModal(nativeAlarm);
          }
        } catch (_) {}

        if (settings.onboardingCompleted && settings.notificationEnabled && reminders.length > 0) {
          rescheduleAllNotifications(reminders, settings).catch(() => {});
        }
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [reminders, settings, lock]);

  // ── Listen for native alarm events via NativeEventEmitter ────────────────
  // The Kotlin AlarmReceiver can emit an event if the app is already running
  // This is an optional enhancement — primarily handled by the modal checks above
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      // Check AsyncStorage periodically when app is active (polling fallback)
      const pollInterval = setInterval(async () => {
        if (AppState.currentState !== 'active') return;
        const nativeAlarm = await readPendingNativeAlarm();
        if (nativeAlarm && nativeAlarm.reminderId) {
          showAlarmModal(nativeAlarm);
        }
      }, 2000);
      return () => clearInterval(pollInterval);
    } catch (_) {}
  }, [showAlarmModal]);

  // ── Handle foreground expo-notification ──────────────────────────────────
  useEffect(() => {
    notifReceivedRef.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      const type: string = data?.type ?? 'popup-reminder';

      if (type !== 'popup-reminder' && type !== 'fullscreen-reminder') return;
      if (!data?.reminderId) return;

      const payload = extractPayload(notification);
      if (payload) showAlarmModal(payload);
    });

    return () => notifReceivedRef.current?.remove();
  }, [showAlarmModal]);

  // ── Handle notification tap (from system tray) ────────────────────────────
  useEffect(() => {
    notifResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      async response => {
        const payload = extractPayload(response.notification);
        if (!payload) return;

        const data = response.notification.request.content.data as any;
        const type: string = data?.type ?? 'popup-reminder';
        if (type === 'pre-reminder') return;

        showAlarmModal(payload);
      }
    );

    return () => notifResponseRef.current?.remove();
  }, [showAlarmModal]);

  // ── Navigation guards ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNavigationReady) return;
    const inAuthGroup = segments[0] === '(tabs)';
    if (!settings.onboardingCompleted) {
      router.replace('/onboarding');
    } else if (isLocked && inAuthGroup) {
      router.replace('/lock-screen');
    }
  }, [settings.onboardingCompleted, isLocked, segments, isNavigationReady]);

  // ── Alarm modal handlers ───────────────────────────────────────────────────
  const handleAlarmDone = useCallback(
    (reminderId: string) => {
      toggleComplete(reminderId);
      setAlarmVisible(false);
      lastShownReminderRef.current = null;
    },
    [toggleComplete]
  );

  const handleAlarmSnooze = useCallback(
    async (
      reminderId: string,
      title: string,
      body: string,
      minutes: number,
      priority: string,
      notifStyle: string
    ) => {
      await snoozeReminder(reminderId, title, body, minutes, settings, priority, notifStyle);
      setAlarmVisible(false);
      lastShownReminderRef.current = null;
    },
    [settings]
  );

  const handleAlarmDismiss = useCallback(() => {
    setAlarmVisible(false);
    lastShownReminderRef.current = null;
  }, []);

  const handleAlarmOpenDetail = useCallback(
    (reminderId: string) => {
      setAlarmVisible(false);
      lastShownReminderRef.current = null;
      setTimeout(() => {
        router.push({
          pathname: '/reminder-detail',
          params: { id: reminderId },
        });
      }, 150);
    },
    [router]
  );

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="setup-security" />
        <Stack.Screen name="lock-screen" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-note" options={{ presentation: 'modal' }} />
        <Stack.Screen name="note-detail" />
        <Stack.Screen name="add-reminder" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reminder-detail" />
        <Stack.Screen name="support" />
      </Stack>

      <AlarmModal
        visible={alarmVisible}
        payload={alarmPayload}
        onMarkDone={handleAlarmDone}
        onSnooze={handleAlarmSnooze}
        onDismiss={handleAlarmDismiss}
        onOpenDetail={handleAlarmOpenDetail}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <SettingsProvider>
          <NotesProvider>
            <RemindersProvider>
              <RootLayoutContent />
            </RemindersProvider>
          </NotesProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
