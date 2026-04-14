import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';
import { useReminders } from '../../hooks/useReminders';
import { useAlert } from '@/template';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  rescheduleAllNotifications,
  getScheduledNotifications,
  registerNotificationCategories,
  NOTIFICATION_CATEGORY_REMINDER,
  ensureAndroidChannels,
  setChannelVersion,
} from '../../services/notifications';
import {
  promptBatteryOptimization,
  promptFullScreenIntent,
  openExactAlarmSettings,
  checkNotificationPermission,
} from '../../services/permissions';
import {
  BUILT_IN_RINGTONES,
  getRingtoneById,
} from '../../services/ringtones';
import { RingtoneOption } from '../../types';

// ── Generic bottom-sheet picker modal ────────────────────────────────────────
function PickerModal({
  visible,
  title,
  description,
  onClose,
  colors,
  insets,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  colors: any;
  insets: any;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={pickerStyles.backdrop} />
      </TouchableWithoutFeedback>
      <View
        style={[
          pickerStyles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + SPACING.md,
          },
        ]}
      >
        <View style={[pickerStyles.header, { borderBottomColor: colors.border }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        {description ? (
          <Text style={[pickerStyles.desc, { color: colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    paddingTop: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  desc: {
    fontSize: TYPOGRAPHY.sizes.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    lineHeight: 20,
  },
});

// ── Option row inside a picker ────────────────────────────────────────────────
function PickerOption({
  label,
  description,
  icon,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  description?: string;
  icon?: string;
  selected: boolean;
  onSelect: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        optStyles.row,
        selected && { backgroundColor: colors.primary + '12' },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? (
        <MaterialIcons name={icon as any} size={22} color={selected ? colors.primary : colors.textSecondary} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[optStyles.label, { color: selected ? colors.primary : colors.text, fontWeight: selected ? '600' : '400' }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[optStyles.desc, { color: colors.textTertiary }]}>{description}</Text>
        ) : null}
      </View>
      {selected ? (
        <MaterialIcons name="check" size={20} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

const optStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  label: { fontSize: TYPOGRAPHY.sizes.md },
  desc: { fontSize: TYPOGRAPHY.sizes.xs, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme, settings, updateSettings } = useSettings();
  const { reminders } = useReminders();
  const colors = COLORS[currentTheme];
  const { showAlert } = useAlert();

  // ── Picker visibility ─────────────────────────────────────────────────────
  const [showRingtonePicker, setShowRingtonePicker] = useState(false);
  const [showAlertStylePicker, setShowAlertStylePicker] = useState(false);
  const [showPreTimePicker, setShowPreTimePicker] = useState(false);
  const [uploadingRingtone, setUploadingRingtone] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  // ── Derived display values ────────────────────────────────────────────────
  const notificationStyleLabel =
    ({ fullscreen: 'Full-Screen Alarm', popup: 'Popup Overlay', banner: 'Banner Only' } as any)[
      settings.notificationStyle ?? 'popup'
    ] ?? 'Popup Overlay';

  const preNotifyLabel = settings.preNotifyEnabled
    ? `${settings.preNotifyMinutes || 10} min before`
    : 'Disabled';

  const currentRingtone = getRingtoneById(
    settings.ringtoneId ?? 'classic_alarm',
    settings.customRingtones
  );

  // ── Notification toggles ──────────────────────────────────────────────────
  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        showAlert('Permission Required', 'Please enable notification permissions in your device settings.');
        return;
      }
    }
    updateSettings({ notificationEnabled: value });
    const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
    await rescheduleAllNotifications(active, { ...settings, notificationEnabled: value });
  };

  const handleToggleSound = async (value: boolean) => {
    const newSettings = { ...settings, soundEnabled: value };
    // Bump channel version so Android recreates channels with updated sound setting
    const cv = (value ? 2 : 1) + (settings.vibrationEnabled ? 0 : 10);
    setChannelVersion(cv);
    await ensureAndroidChannels(value, settings.vibrationEnabled);
    updateSettings({ soundEnabled: value });
    const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
    await rescheduleAllNotifications(active, newSettings);
  };

  const handleToggleVibration = async (value: boolean) => {
    const newSettings = { ...settings, vibrationEnabled: value };
    // Bump channel version so Android recreates channels with updated vibration setting
    const cv = (settings.soundEnabled ? 2 : 1) + (value ? 0 : 10);
    setChannelVersion(cv);
    await ensureAndroidChannels(settings.soundEnabled, value);
    updateSettings({ vibrationEnabled: value });
    const active = reminders.filter(r => !r.isCompleted && !r.isArchived);
    await rescheduleAllNotifications(active, newSettings);
  };

  // ── Ringtone preview ──────────────────────────────────────────────────────
  const stopPreview = useCallback(async () => {
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
      } catch (_) {}
      previewSoundRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const previewRingtone = useCallback(
    async (ringtone: RingtoneOption) => {
      await stopPreview();
      if (previewingId === ringtone.id) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: ringtone.uri },
          { shouldPlay: true, isLooping: false, volume: 1.0 }
        );
        previewSoundRef.current = sound;
        setPreviewingId(ringtone.id);
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) stopPreview();
        });
      } catch (err) {
        showAlert('Preview Failed', 'Could not play this ringtone on your device.');
      }
    },
    [previewingId, stopPreview]
  );

  const selectRingtone = useCallback(
    async (ringtone: RingtoneOption) => {
      await stopPreview();
      updateSettings({ ringtoneId: ringtone.id });
      setShowRingtonePicker(false);
    },
    [stopPreview, updateSettings]
  );

  // ── Upload custom ringtone ────────────────────────────────────────────────
  const handleUploadRingtone = async () => {
    try {
      setUploadingRingtone(true);
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const destDir = FileSystem.documentDirectory + 'ringtones/';
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const fileName = asset.name || `custom_ringtone_${Date.now()}.mp3`;
      const destUri = destDir + fileName;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });
      const newRingtone: RingtoneOption = {
        id: `custom_${Date.now()}`,
        label: fileName.replace(/\.[^/.]+$/, ''),
        uri: destUri,
        isBuiltIn: false,
        isCustom: true,
      };
      const existing = settings.customRingtones ?? [];
      updateSettings({ customRingtones: [...existing, newRingtone], ringtoneId: newRingtone.id });
      showAlert('Ringtone Added', `"${newRingtone.label}" is now your alarm ringtone.`);
    } catch {
      showAlert('Upload Failed', 'Could not import this audio file.');
    } finally {
      setUploadingRingtone(false);
    }
  };

  const handleDeleteCustomRingtone = (id: string) => {
    showAlert('Remove Ringtone?', 'This will remove it from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const custom = (settings.customRingtones ?? []).filter(r => r.id !== id);
          const newId = settings.ringtoneId === id ? 'classic_alarm' : settings.ringtoneId;
          updateSettings({ customRingtones: custom, ringtoneId: newId });
          const ringtone = (settings.customRingtones ?? []).find(r => r.id === id);
          if (ringtone?.uri) {
            try { await FileSystem.deleteAsync(ringtone.uri, { idempotent: true }); } catch (_) {}
          }
        },
      },
    ]);
  };

  // ── Test notification ─────────────────────────────────────────────────────
  const sendTestNotification = async () => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      showAlert('Permission Denied', 'Please enable notifications in device settings to test.');
      return;
    }
    await registerNotificationCategories();
    const isFullScreen = settings.notificationStyle === 'fullscreen';
    const isPopup = settings.notificationStyle === 'popup';
    const notifType = isFullScreen ? 'fullscreen-reminder' : isPopup ? 'popup-reminder' : 'banner-reminder';
    const androidExtras: Record<string, any> = {
      channelId: 'reminders-high',
      color: '#6366F1',
      priority: Notifications.AndroidNotificationPriority.MAX,
      ...(isFullScreen && { fullScreenIntent: true }),
    };
    if (settings.vibrationEnabled) androidExtras.vibrate = [0, 400, 200, 400];
    else androidExtras.vibrate = null;

    await Notifications.scheduleNotificationAsync({
      identifier: 'test-notification',
      content: {
        title: '🔔 Test Reminder',
        body: '🟣 MEDIUM PRIORITY\nThis is a test notification!',
        categoryIdentifier: NOTIFICATION_CATEGORY_REMINDER,
        sound: settings.soundEnabled ? 'default' : undefined,
        data: {
          reminderId: 'test',
          reminderTitle: 'Test Reminder',
          reminderBody: 'This is a test notification!',
          type: notifType,
          priority: 'medium',
          notificationStyle: settings.notificationStyle,
        },
        ...(Platform.OS === 'android' && androidExtras),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 5000),
      },
    });

    showAlert(
      'Test Sent',
      `A "${notificationStyleLabel}" notification arrives in 5 seconds.\nPut the app in background to see it.\nSound: ${settings.soundEnabled ? 'On' : 'Off'} · Vibration: ${settings.vibrationEnabled ? 'On' : 'Off'}`
    );
  };

  const showScheduledDebug = async () => {
    const list = await getScheduledNotifications();
    if (!list.length) {
      showAlert('Scheduled Notifications', 'No notifications are currently scheduled.');
      return;
    }
    const summary = list.slice(0, 6).map(n => {
      const trigger = n.trigger as any;
      const date = trigger?.value
        ? new Date(trigger.value * 1000).toLocaleString()
        : trigger?.date
        ? new Date(trigger.date).toLocaleString()
        : 'Repeating';
      return `• ${n.content.title ?? 'Untitled'}\n  ${date}`;
    }).join('\n\n');
    showAlert(`${list.length} Scheduled`, summary + (list.length > 6 ? `\n\n...and ${list.length - 6} more` : ''));
  };

  const handleRescheduleAll = async () => {
    await requestNotificationPermissions();
    await rescheduleAllNotifications(reminders, settings);
    const list = await getScheduledNotifications();
    showAlert('Rescheduled', `${list.length} notification(s) are now scheduled.`);
  };

  // ── PRE_NOTIFY time options ───────────────────────────────────────────────
  const PRE_TIME_OPTIONS = [
    { minutes: 5, label: '5 minutes' },
    { minutes: 10, label: '10 minutes' },
    { minutes: 15, label: '15 minutes' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 60, label: '1 hour' },
  ];

  // ── Alert style options ───────────────────────────────────────────────────
  const ALERT_STYLE_OPTIONS = [
    { id: 'banner', label: 'Banner Only', icon: 'notifications', description: 'Standard OS notification panel banner' },
    { id: 'popup', label: 'Popup Overlay', icon: 'picture-in-picture', description: 'Appears over current screen when due' },
    { id: 'fullscreen', label: 'Full-Screen Alarm', icon: 'fullscreen', description: 'Takes over screen + rings continuously until action' },
  ];

  const allRingtones = [...BUILT_IN_RINGTONES, ...(settings.customRingtones ?? [])];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <LinearGradient
          colors={['#818CF8', '#6366F1', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradientLine}
        />
        <View style={styles.headerBrandRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={['#818CF8', '#6366F1', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerAppNameGradient}
            >
              <Text style={styles.headerAppName}>Creatorz</Text>
            </LinearGradient>
            <Text style={[styles.headerAppSub, { color: colors.textSecondary }]}>Reminder & Notes</Text>
          </View>
          <Text style={[styles.headerVersionBadge, { backgroundColor: colors.primary + '15', color: colors.primary }]}>v6.5.0</Text>
        </View>
        <Text style={[styles.headerSettingsLabel, { color: colors.text }]}>Settings</Text>

        {/* ── Buy Me a Coffee CTA ── */}
        <Pressable
          onPress={() => router.push('/support')}
          style={({ pressed }) => [styles.coffeeBtn, { opacity: pressed ? 0.82 : 1 }]}
        >
          <LinearGradient
            colors={['#6366F1', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.coffeeBtnGradient}
          >
            <Text style={styles.coffeeBtnEmoji}>☕</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.coffeeBtnTitle}>Buy Me a Coffee</Text>
              <Text style={styles.coffeeBtnSub}>Support Moiz Creator ✨</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── THEME ─────────────────────────────────────────────────────── */}
        <SectionHeader title="Appearance" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="palette" size={24} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
            </View>
          </View>
          {/* 3-option segmented control */}
          <View style={[styles.themeSegmented, { backgroundColor: colors.surfaceSecondary, marginHorizontal: SPACING.md, marginBottom: SPACING.md }]}>
            {([
              { id: 'light', icon: 'light-mode', label: 'Light' },
              { id: 'dark', icon: 'dark-mode', label: 'Dark' },
              { id: 'auto', icon: 'brightness-auto', label: 'System' },
            ] as const).map(opt => {
              const isActive = (settings.theme ?? 'auto') === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => updateSettings({ theme: opt.id })}
                  style={({ pressed }) => [
                    styles.themeSegBtn,
                    isActive && { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
                    pressed && !isActive && { opacity: 0.65 },
                  ]}
                >
                  <MaterialIcons
                    name={opt.icon as any}
                    size={18}
                    color={isActive ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.themeSegLabel, { color: isActive ? '#fff' : colors.textSecondary, fontWeight: isActive ? '600' : '400' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── SECURITY ──────────────────────────────────────────────────── */}
        <SectionHeader title="Security" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="lock" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>App Lock</Text>
                <Text style={[styles.settingDesc2, { color: colors.textTertiary }]}>
                  Requires auth when app resumes from background
                </Text>
              </View>
            </View>
            <Switch
              value={settings.lockEnabled}
              onValueChange={value => {
                if (!value) {
                  showAlert('Disable App Lock?', 'Your app will no longer require authentication', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disable', style: 'destructive', onPress: () => updateSettings({ lockEnabled: false }) },
                  ]);
                } else {
                  router.push('/setup-security');
                }
              }}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={settings.lockEnabled ? colors.primary : colors.textTertiary}
            />
          </View>
        </View>

        {/* ── NOTIFICATIONS ─────────────────────────────────────────────── */}
        <SectionHeader title="Notifications" description="Controls whether reminders trigger alerts, sounds, and vibrations." colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SwitchRow icon="notifications" label="Enable Notifications" value={settings.notificationEnabled} onToggle={handleToggleNotifications} colors={colors} />
          <Divider colors={colors} />
          <SwitchRow icon="volume-up" label="Sound" description="Play sound when reminder fires" value={settings.soundEnabled} onToggle={handleToggleSound} colors={colors} disabled={!settings.notificationEnabled} />
          <Divider colors={colors} />
          <SwitchRow icon="vibration" label="Vibration" description="Vibrate when reminder fires" value={settings.vibrationEnabled} onToggle={handleToggleVibration} colors={colors} disabled={!settings.notificationEnabled} />
        </View>

        {/* ── ALARM RINGTONE ────────────────────────────────────────────── */}
        <SectionHeader title="Alarm Ringtone" description="Sound played during full-screen and popup alarms." colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PressRow
            icon="music-note"
            label="Ringtone"
            value={currentRingtone.label}
            disabled={!settings.notificationEnabled || !settings.soundEnabled}
            onPress={() => setShowRingtonePicker(true)}
            colors={colors}
          />
        </View>

        {/* ── ALERT STYLE ───────────────────────────────────────────────── */}
        <SectionHeader
          title="Reminder Alert Style"
          description={"Banner Only: standard OS notification\nPopup Overlay: appears over current screen\nFull-Screen Alarm: takes over screen + rings continuously"}
          colors={colors}
        />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PressRow
            icon="fullscreen"
            label="Alert Style"
            value={notificationStyleLabel}
            disabled={!settings.notificationEnabled}
            onPress={() => setShowAlertStylePicker(true)}
            colors={colors}
          />
          <Divider colors={colors} />
          <SwitchRow
            icon="alarm"
            label="High Priority → Full-Screen"
            description="Override to Full-Screen for HIGH priority reminders"
            value={settings.highPriorityFullscreen ?? true}
            onToggle={value => updateSettings({ highPriorityFullscreen: value } as any)}
            colors={colors}
            disabled={!settings.notificationEnabled}
          />
        </View>

        {/* ── PRE-REMINDER ──────────────────────────────────────────────── */}
        <SectionHeader title="Pre-Reminder (Early Alert)" description="Receive an advance notification before the actual reminder time." colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SwitchRow
            icon="notifications-active"
            label="Enable Pre-Reminder"
            value={settings.preNotifyEnabled ?? false}
            onToggle={value => updateSettings({ preNotifyEnabled: value } as any)}
            colors={colors}
            disabled={!settings.notificationEnabled}
          />
          <Divider colors={colors} />
          <PressRow
            icon="timer"
            label="Advance Notice Time"
            value={preNotifyLabel}
            disabled={!settings.notificationEnabled || !settings.preNotifyEnabled}
            onPress={() => setShowPreTimePicker(true)}
            colors={colors}
          />
        </View>

        {/* ── NOTIFICATION TOOLS ────────────────────────────────────────── */}
        <SectionHeader title="Notification Tools" description="Test and verify notification behavior on your device." colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PressRow icon="send" label="Send Test Notification" value="In 5 seconds" onPress={sendTestNotification} colors={colors} />
          <Divider colors={colors} />
          <PressRow icon="list" label="View Scheduled" value="" onPress={showScheduledDebug} colors={colors} />
          <Divider colors={colors} />
          <PressRow
            icon="refresh"
            label="Reschedule All Reminders"
            value={`${reminders.filter(r => !r.isCompleted && !r.isArchived).length} active`}
            onPress={handleRescheduleAll}
            colors={colors}
          />
        </View>

        {/* ── BATTERY OPTIMIZATION ──────────────────────────────────────── */}
        <SectionHeader
          title="Battery Optimization"
          description={"Required for reminders to fire when the app is completely closed. Tap the button below to open the exact settings screen."}
          colors={colors}
        />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <PressRow
            icon="battery-alert"
            label="Disable Battery Restriction"
            value="Open Settings"
            onPress={() =>
              promptBatteryOptimization(
                () => showAlert('Done', 'Battery restriction dialog opened. Select "Allow" or "Unrestricted" to ensure alarms fire on time.'),
                () => {}
              )
            }
            colors={colors}
          />
          <Divider colors={colors} />
          <Divider colors={colors} />
          <PressRow
            icon="alarm-on"
            label="Exact Alarm Permission"
            value="Open Settings"
            onPress={() => openExactAlarmSettings()}
            colors={colors}
          />
          <Divider colors={colors} />
          <PressRow
            icon="fullscreen"
            label="Full-Screen Alarm Permission"
            value="Android 14+ Required"
            onPress={() =>
              promptFullScreenIntent(
                () => showAlert('Done', 'Grant the permission on the settings screen that opened.'),
                () => {}
              )
            }
            colors={colors}
          />
        </View>

        {/* ── ABOUT ─────────────────────────────────────────────────────── */}
        <SectionHeader title="About" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="info" size={24} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>6.5.0</Text>
          </View>
          <Divider colors={colors} />
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="code" size={24} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Build</Text>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Production</Text>
          </View>
        </View>

      </ScrollView>

      {/* ════ ALERT STYLE PICKER ════ */}
      <PickerModal
        visible={showAlertStylePicker}
        title="Reminder Alert Style"
        description="How should reminders appear when they are due?"
        onClose={() => setShowAlertStylePicker(false)}
        colors={colors}
        insets={insets}
      >
        <View style={{ paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
          {ALERT_STYLE_OPTIONS.map(opt => (
            <PickerOption
              key={opt.id}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={(settings.notificationStyle ?? 'popup') === opt.id}
              onSelect={() => {
                updateSettings({ notificationStyle: opt.id as any });
                setShowAlertStylePicker(false);
              }}
              colors={colors}
            />
          ))}
        </View>
      </PickerModal>

      {/* ════ PRE-REMINDER TIME PICKER ════ */}
      <PickerModal
        visible={showPreTimePicker}
        title="Advance Notice Time"
        description="How early before the reminder should we notify you?"
        onClose={() => setShowPreTimePicker(false)}
        colors={colors}
        insets={insets}
      >
        <View style={{ paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
          {PRE_TIME_OPTIONS.map(opt => (
            <PickerOption
              key={opt.minutes}
              label={opt.label}
              selected={(settings.preNotifyMinutes ?? 10) === opt.minutes}
              onSelect={() => {
                updateSettings({ preNotifyMinutes: opt.minutes, preNotifyEnabled: true } as any);
                setShowPreTimePicker(false);
              }}
              colors={colors}
            />
          ))}
        </View>
      </PickerModal>

      {/* ════ RINGTONE PICKER ════ */}
      <Modal
        visible={showRingtonePicker}
        animationType="slide"
        transparent
        onRequestClose={() => { stopPreview(); setShowRingtonePicker(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { stopPreview(); setShowRingtonePicker(false); }}>
          <View style={pickerStyles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={[pickerStyles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={[pickerStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>Alarm Ringtone</Text>
            <Pressable onPress={() => { stopPreview(); setShowRingtonePicker(false); }} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm }}>
            <Text style={[styles.ringtoneGroupLabel, { color: colors.textTertiary }]}>BUILT-IN</Text>
            {BUILT_IN_RINGTONES.map(ringtone => (
              <RingtoneRow
                key={ringtone.id}
                ringtone={ringtone}
                isSelected={settings.ringtoneId === ringtone.id}
                isPreviewing={previewingId === ringtone.id}
                colors={colors}
                onSelect={() => selectRingtone(ringtone)}
                onPreview={() => previewRingtone(ringtone)}
              />
            ))}
            {(settings.customRingtones ?? []).length > 0 && (
              <>
                <Text style={[styles.ringtoneGroupLabel, { color: colors.textTertiary, marginTop: SPACING.md }]}>CUSTOM</Text>
                {(settings.customRingtones ?? []).map(ringtone => (
                  <RingtoneRow
                    key={ringtone.id}
                    ringtone={ringtone}
                    isSelected={settings.ringtoneId === ringtone.id}
                    isPreviewing={previewingId === ringtone.id}
                    colors={colors}
                    onSelect={() => selectRingtone(ringtone)}
                    onPreview={() => previewRingtone(ringtone)}
                    onDelete={() => handleDeleteCustomRingtone(ringtone.id)}
                  />
                ))}
              </>
            )}
            <Pressable
              onPress={handleUploadRingtone}
              disabled={uploadingRingtone}
              style={({ pressed }) => [styles.uploadRingtoneBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '12', opacity: pressed || uploadingRingtone ? 0.65 : 1 }]}
            >
              {uploadingRingtone
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <MaterialIcons name="upload-file" size={20} color={colors.primary} />}
              <Text style={[styles.uploadRingtoneTxt, { color: colors.primary }]}>
                {uploadingRingtone ? 'Importing…' : 'Upload Custom Ringtone'}
              </Text>
            </Pressable>
            <Text style={[styles.ringtoneHint, { color: colors.textTertiary }]}>Supported formats: MP3, M4A, WAV, OGG</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────
function SectionHeader({ title, description, colors }: { title: string; description?: string; colors: any }) {
  return (
    <View style={{ marginBottom: description ? 4 : SPACING.xs, marginTop: SPACING.md }}>
      <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>{description}</Text>
      ) : null}
    </View>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function SwitchRow({
  icon, label, description, value, onToggle, colors, disabled,
}: {
  icon: string; label: string; description?: string; value: boolean;
  onToggle: (v: boolean) => void; colors: any; disabled?: boolean;
}) {
  return (
    <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon as any} size={24} color={disabled ? colors.textTertiary : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: disabled ? colors.textTertiary : colors.text }]}>{label}</Text>
          {description ? <Text style={[styles.settingDesc2, { color: colors.textTertiary }]}>{description}</Text> : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value && !disabled ? colors.primary : colors.textTertiary}
      />
    </View>
  );
}

function PressRow({
  icon, label, description, value, onPress, colors, disabled,
}: {
  icon: string; label: string; description?: string; value: string;
  onPress: () => void; colors: any; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.settingItem, disabled && styles.settingItemDisabled, pressed && !disabled && { opacity: 0.6 }]}
    >
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon as any} size={24} color={disabled ? colors.textTertiary : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: disabled ? colors.textTertiary : colors.text }]}>{label}</Text>
          {description ? <Text style={[styles.settingDesc2, { color: colors.textTertiary }]}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.settingRight}>
        {value ? <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text> : null}
        <MaterialIcons name="chevron-right" size={24} color={disabled ? colors.textTertiary + '80' : colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function RingtoneRow({
  ringtone, isSelected, isPreviewing, colors, onSelect, onPreview, onDelete,
}: {
  ringtone: RingtoneOption; isSelected: boolean; isPreviewing: boolean;
  colors: any; onSelect: () => void; onPreview: () => void; onDelete?: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.ringtoneRow,
        isSelected && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
        !isSelected && { borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.ringtoneRadio, isSelected ? { borderColor: colors.primary, backgroundColor: colors.primary } : { borderColor: colors.border }]}>
        {isSelected && <MaterialIcons name="check" size={12} color="#fff" />}
      </View>
      <Text style={[styles.ringtoneRowLabel, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '600' : '400', flex: 1 }]}>
        {ringtone.label}
      </Text>
      <Pressable
        onPress={onPreview}
        hitSlop={8}
        style={({ pressed }) => [styles.ringtonePreviewBtn, { backgroundColor: isPreviewing ? colors.primary : colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
      >
        <MaterialIcons name={isPreviewing ? 'stop' : 'play-arrow'} size={16} color={isPreviewing ? '#fff' : colors.textSecondary} />
      </Pressable>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="delete-outline" size={18} color={colors.error} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerGradientLine: {
    height: 3,
    borderRadius: 2,
    marginBottom: SPACING.md,
    marginHorizontal: -SPACING.md,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerAppNameGradient: {
    borderRadius: 4,
    paddingHorizontal: 2,
    alignSelf: 'flex-start',
  },
  headerAppName: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerAppSub: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  headerVersionBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  headerSettingsLabel: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginTop: SPACING.xs,
  },
  coffeeBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.md,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  coffeeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    gap: SPACING.sm,
  },
  coffeeBtnEmoji: { fontSize: 22 },
  coffeeBtnTitle: {
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  coffeeBtnSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 1,
  },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: SPACING.md },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionDesc: { fontSize: TYPOGRAPHY.sizes.xs, lineHeight: 18, marginBottom: SPACING.sm },
  card: { borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.xs },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 56,
  },
  settingItemDisabled: { opacity: 0.45 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  settingLabel: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: TYPOGRAPHY.weights.medium },
  settingDesc2: { fontSize: TYPOGRAPHY.sizes.xs, marginTop: 2, lineHeight: 16 },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexShrink: 0 },
  settingValue: { fontSize: TYPOGRAPHY.sizes.sm },
  divider: { height: 1, marginLeft: SPACING.md + 24 + SPACING.md },
  // Theme segmented
  themeSegmented: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
    gap: 4,
  },
  themeSegBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  themeSegLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  // Ringtone
  ringtoneGroupLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  ringtoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  ringtoneRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  ringtoneRowLabel: { fontSize: TYPOGRAPHY.sizes.md },
  ringtonePreviewBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  uploadRingtoneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderStyle: 'dashed', marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  uploadRingtoneTxt: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.semibold },
  ringtoneHint: { fontSize: TYPOGRAPHY.sizes.xs, textAlign: 'center', marginBottom: SPACING.lg },
});
