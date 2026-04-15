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

// ─── Extract clean payload from a notification ────────────────────────────────
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
  // Normalize: pre-reminder and banner become popup in the in-app modal
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
    // Prevent duplicate for same reminder within 3 seconds
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

      // Handle cold launch: app opened by tapping a notification
      // This covers: user tapped notification while app was killed
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const payload = extractPayload(lastResponse.notification);
          if (payload) {
            // Small delay to let navigation settle
            setTimeout(() => showAlarmModal(payload), 800);
          }
        }
      } catch (_) {}

      // Handle cold launch via fullScreenIntent (app launched automatically, no tap)
      // getInitialNotificationAsync captures this case on Android
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
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      if (wasBackground && next === 'active') {
        lock();
        if (settings.onboardingCompleted && settings.notificationEnabled && reminders.length > 0) {
          rescheduleAllNotifications(reminders, settings).catch(() => {});
        }
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [reminders, settings, lock]);

  // ── Handle foreground notification ────────────────────────────────────────
  // POPUP: Show in-app AlarmModal (system heads-up banner is also shown by the OS)
  // FULLSCREEN: Show in-app AlarmModal full-screen variant
  // BANNER/PRE: Do NOT show modal — system notification is enough
  useEffect(() => {
    notifReceivedRef.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      const type: string = data?.type ?? 'popup-reminder';

      // Only show in-app modal for popup and fullscreen types
      if (type !== 'popup-reminder' && type !== 'fullscreen-reminder') return;
      if (!data?.reminderId) return;

      const payload = extractPayload(notification);
      if (payload) showAlarmModal(payload);
    });

    return () => notifReceivedRef.current?.remove();
  }, [showAlarmModal]);

  // ── Handle notification tap (from system tray) ────────────────────────────
  // User tapped a notification from the system notification drawer.
  // For POPUP: Show the in-app AlarmModal popup variant (app was brought to foreground by tap)
  // For FULLSCREEN: Show full-screen variant
  // For BANNER: Show popup variant (banner notifications don't have our modal)
  useEffect(() => {
    notifResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      async response => {
        const payload = extractPayload(response.notification);
        if (!payload) return;

        // For banner-type taps, show as popup in the app
        const data = response.notification.request.content.data as any;
        const type: string = data?.type ?? 'popup-reminder';
        if (type === 'pre-reminder') {
          // Pre-reminders on tap just open the app — no modal needed
          return;
        }

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
