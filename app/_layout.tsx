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

  // Allow navigation after navigator mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsNavigationReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── Init: permissions + reschedule + handle cold-launch notification ──────
  useEffect(() => {
    if (!settings.onboardingCompleted) return;
    const init = async () => {
      // Step 1: compute channel version from settings so channels reflect current prefs
      const cv = (settings.soundEnabled ? 2 : 1) + (settings.vibrationEnabled ? 0 : 10);
      setChannelVersion(cv);

      // Step 2: request all required permissions (notifications + exact alarm on Android 12+)
      await runStartupPermissionCheck();
      await ensureAndroidChannels(settings.soundEnabled, settings.vibrationEnabled);
      await registerNotificationCategories();

      // Step 3: reschedule reminders (catches any missed while app was killed)
      if (reminders.length > 0) {
        await rescheduleAllNotifications(reminders, settings);
      }

      // Step 4: Handle notification that cold-launched the app (killed state)
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data as any;
          const reminderId: string | undefined = data?.reminderId;
          if (reminderId) {
            const rawTitle = lastResponse.notification.request.content.title ?? 'Reminder';
            const title = rawTitle.replace(/^🔔\s*/, '').replace(/^⏰\s*(Pre-Reminder:\s*)?/, '');
            const reminderBody: string = (data?.reminderBody as string) ?? '';
            const priority: string = (data?.priority as string) ?? 'medium';
            const notifStyle: string = (data?.notificationStyle as string) ?? 'popup';
            const type: string = data?.type ?? 'popup-reminder';
            const resolvedType = type === 'pre-reminder' || type === 'banner-reminder' ? 'popup-reminder' : type;
            setAlarmPayload({
              reminderId,
              title,
              body: reminderBody,
              type: resolvedType,
              priority,
              notificationStyle: notifStyle,
            });
            setAlarmVisible(true);
          }
        }
      } catch (_) {}
    };
    init();
  }, [settings.onboardingCompleted]);

  // ── Reschedule when notification settings change ──────────────────────────
  // Also bump channel version so Android creates fresh channels with new sound/vibration
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

  // ── Re-check when app comes to foreground (lock + reschedule) ─────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      if (wasBackground && next === 'active') {
        // Lock on background resume — never during in-app navigation
        lock();
        if (settings.onboardingCompleted && settings.notificationEnabled && reminders.length > 0) {
          rescheduleAllNotifications(reminders, settings).catch(() => {});
        }
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [reminders, settings, lock]);

  // ── Handle foreground notification (show in-app alarm/popup modal) ────────
  useEffect(() => {
    notifReceivedRef.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      const type: string = data?.type ?? 'popup-reminder';

      // Show in-app modal only for popup/fullscreen types (not banner, not pre-reminder)
      if (
        (type === 'popup-reminder' || type === 'fullscreen-reminder') &&
        data?.reminderId
      ) {
        const bodyText =
          (data?.reminderBody as string) || notification.request.content.body || '';
        const payload: AlarmPayload = {
          reminderId: data.reminderId,
          title:
            notification.request.content.title
              ?.replace(/^🔔\s*/, '')
              .replace(/^⏰\s*(Pre-Reminder:\s*)?/, '') ?? 'Reminder',
          body: bodyText,
          type,
          priority: data.priority ?? 'medium',
          notificationStyle: (data.notificationStyle as string) ?? 'popup',
        };
        setAlarmPayload(payload);
        setAlarmVisible(true);
      }
    });

    return () => notifReceivedRef.current?.remove();
  }, []);

  // ── Handle notification tap (from notification drawer) ──────────────────
  // No action buttons exist in the drawer — every tap shows the in-app popup.
  useEffect(() => {
    notifResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      async response => {
        const data = response.notification.request.content.data as any;
        const reminderId: string | undefined = data?.reminderId;
        if (!reminderId) return;

        const rawTitle: string =
          response.notification.request.content.title ?? 'Reminder';
        const title = rawTitle
          .replace(/^🔔\s*/, '')
          .replace(/^⏰\s*(Pre-Reminder:\s*)?/, '');
        const reminderBody: string = (data?.reminderBody as string) ?? '';
        const priority: string = (data?.priority as string) ?? 'medium';
        const notifStyle: string = (data?.notificationStyle as string) ?? 'popup';
        const type: string = data?.type ?? 'popup-reminder';

        // Always show in-app popup — NEVER navigate directly into the app
        // The popup's arrow button lets users navigate to details if needed
        const resolvedType =
          type === 'pre-reminder' || type === 'banner-reminder'
            ? 'popup-reminder'
            : type;

        const payload: AlarmPayload = {
          reminderId,
          title,
          body: reminderBody,
          type: resolvedType,
          priority,
          notificationStyle: notifStyle,
        };
        setAlarmPayload(payload);
        setAlarmVisible(true);
      }
    );

    return () => notifResponseRef.current?.remove();
  }, [settings]);

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
    },
    [settings]
  );

  const handleAlarmDismiss = useCallback(() => {
    setAlarmVisible(false);
  }, []);

  const handleAlarmOpenDetail = useCallback(
    (reminderId: string) => {
      setAlarmVisible(false);
      // Small delay so the modal fully closes before navigation
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
