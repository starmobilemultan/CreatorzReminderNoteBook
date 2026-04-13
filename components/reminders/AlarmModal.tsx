import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Modal,
  Platform,
  Vibration,
  AppState,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';
import { getRingtoneById } from '../../services/ringtones';

export interface AlarmPayload {
  reminderId: string;
  title: string;
  body: string;
  type: 'fullscreen-reminder' | 'popup-reminder' | 'banner-reminder' | string;
  priority?: string;
  notificationStyle?: string;
}

interface Props {
  visible: boolean;
  payload: AlarmPayload | null;
  onMarkDone: (reminderId: string) => void;
  onSnooze: (
    reminderId: string,
    title: string,
    body: string,
    minutes: number,
    priority: string,
    notificationStyle: string
  ) => void;
  onDismiss: () => void;
  onOpenDetail?: (reminderId: string) => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'HIGH PRIORITY', color: '#EF4444' },
  medium: { label: 'MEDIUM PRIORITY', color: '#F59E0B' },
  low: { label: 'LOW PRIORITY', color: '#10B981' },
};

const SNOOZE_DURATIONS = [
  { minutes: 5, label: '5 min' },
  { minutes: 10, label: '10 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
];

export function AlarmModal({ visible, payload, onMarkDone, onSnooze, onDismiss, onOpenDetail }: Props) {
  const { currentTheme, settings } = useSettings();
  const colors = COLORS[currentTheme];

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vibration
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Popup snooze picker state
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);

  const isFullScreen = payload?.type === 'fullscreen-reminder';
  const isPopup = payload?.type === 'popup-reminder';
  const shouldShow = visible && payload && (isFullScreen || isPopup);

  const priority = payload?.priority ?? 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  const isHighPriority = priority === 'high';
  const accentColor = isHighPriority ? colors.error : colors.primary;

  // ── Audio helpers ────────────────────────────────────────────────────────
  const loadAndPlaySound = useCallback(async () => {
    if (!settings.soundEnabled) return;
    try {
      // Configure audio session for alarm behavior
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const ringtone = getRingtoneById(
        settings.ringtoneId ?? 'classic_alarm',
        settings.customRingtones
      );

      const { sound } = await Audio.Sound.createAsync(
        { uri: ringtone.uri },
        {
          shouldPlay: true,
          isLooping: true,     // ← loops indefinitely until stopped
          volume: 1.0,
        }
      );
      soundRef.current = sound;
    } catch (err) {
      console.warn('[AlarmModal] Audio load failed:', err);
    }
  }, [settings.soundEnabled, settings.ringtoneId, settings.customRingtones]);

  const stopSound = useCallback(async () => {
    if (audioLoopTimerRef.current) {
      clearTimeout(audioLoopTimerRef.current);
      audioLoopTimerRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
    }
    // Restore normal audio mode
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (_) {}
  }, []);

  const stopAlarm = useCallback(async () => {
    // Stop vibration
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if (Platform.OS !== 'web') Vibration.cancel();

    // Stop pulse animation
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }

    // Stop audio
    await stopSound();
  }, [stopSound]);

  // ── Start continuous vibration ───────────────────────────────────────────
  const startContinuousVibration = useCallback(() => {
    if (!settings.vibrationEnabled || Platform.OS === 'web') return;

    const pattern = isHighPriority
      ? [0, 600, 400, 600, 400, 600]
      : [0, 400, 300, 400];

    Vibration.vibrate(pattern);
    vibrationIntervalRef.current = setInterval(() => {
      Vibration.vibrate(pattern);
    }, isHighPriority ? 4000 : 3500);
  }, [settings.vibrationEnabled, isHighPriority]);

  // ── Main effect: start/stop alarm on visibility ──────────────────────────
  useEffect(() => {
    if (visible && shouldShow) {
      setShowSnoozePicker(false);

      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 160,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (isFullScreen) {
        // Continuous pulsing ring
        pulseLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.22, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
          ])
        );
        pulseLoopRef.current.start();

        startContinuousVibration();
        loadAndPlaySound(); // ← looping audio starts here
      } else if (isPopup) {
        if (settings.vibrationEnabled && Platform.OS !== 'web') {
          Vibration.vibrate([0, 200, 100, 200]);
        }
        if (settings.soundEnabled) {
          loadAndPlaySound();
        }
      }
    } else {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      pulseAnim.setValue(1);
      stopAlarm();
    }

    return () => {
      stopAlarm();
    };
  }, [visible, isFullScreen, isPopup]);

  // Stop when app backgrounds
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && visible && isFullScreen) {
        stopAlarm();
      }
    });
    return () => sub.remove();
  }, [visible, isFullScreen, stopAlarm]);

  if (!payload || !shouldShow) return null;

  // ── Action handlers ──────────────────────────────────────────────────────
  const handleDone = async () => {
    await stopAlarm();
    onMarkDone(payload.reminderId);
  };

  const handleSnooze = async (minutes: number) => {
    await stopAlarm();
    setShowSnoozePicker(false);
    onSnooze(
      payload.reminderId,
      payload.title,
      payload.body,
      minutes,
      payload.priority ?? 'medium',
      payload.notificationStyle ?? 'popup'
    );
  };

  const handleDismiss = async () => {
    await stopAlarm();
    setShowSnoozePicker(false);
    onDismiss();
  };

  const handleOpenDetail = async () => {
    await stopAlarm();
    setShowSnoozePicker(false);
    onDismiss();
    if (payload && onOpenDetail) {
      onOpenDetail(payload.reminderId);
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // FULL-SCREEN ALARM
  // ════════════════════════════════════════════════════════════════════
  if (isFullScreen) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        transparent={false}
        onRequestClose={handleDismiss}
      >
        <View
          style={[
            styles.fullScreenBg,
            { backgroundColor: isHighPriority ? '#180008' : '#070018' },
          ]}
        >
          {/* Pulsing rings */}
          <Animated.View
            style={[
              styles.pulseRingOuter,
              { borderColor: accentColor + '35', transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRingInner,
              {
                borderColor: accentColor + '60',
                transform: [
                  {
                    scale: Animated.multiply(pulseAnim, new Animated.Value(0.85)),
                  },
                ],
              },
            ]}
          />

          {/* Alarm icon */}
          <View
            style={[
              styles.alarmIconWrap,
              { backgroundColor: accentColor + '25', borderColor: accentColor + '70' },
            ]}
          >
            <MaterialIcons name="alarm" size={60} color={accentColor} />
          </View>

          {/* Clock */}
          <Text style={styles.alarmTime}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {/* Priority badge */}
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor: priorityConfig.color + '25',
                borderColor: priorityConfig.color,
              },
            ]}
          >
            <View style={[styles.priorityDot, { backgroundColor: priorityConfig.color }]} />
            <Text style={[styles.priorityBadgeText, { color: priorityConfig.color }]}>
              {priorityConfig.label}
            </Text>
          </View>

          {/* Title & body */}
          <Text style={styles.alarmTitle} numberOfLines={3}>
            {payload.title}
          </Text>
          {payload.body ? (
            <Text style={styles.alarmBody} numberOfLines={2}>
              {payload.body}
            </Text>
          ) : null}

          {/* Snooze picker (full-screen) */}
          {showSnoozePicker ? (
            <View style={styles.fsSnoozePickerWrap}>
              <Text style={styles.fsSnoozePickerTitle}>Snooze for…</Text>
              <View style={styles.fsSnoozeGrid}>
                {SNOOZE_DURATIONS.map(({ minutes, label }) => (
                  <Pressable
                    key={minutes}
                    onPress={() => handleSnooze(minutes)}
                    style={({ pressed }) => [
                      styles.fsSnoozeOptionBtn,
                      {
                        borderColor: accentColor + '70',
                        backgroundColor: accentColor + '15',
                        opacity: pressed ? 0.65 : 1,
                      },
                    ]}
                  >
                    <MaterialIcons name="snooze" size={14} color={accentColor} />
                    <Text style={[styles.fsSnoozeOptionText, { color: '#fff' }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setShowSnoozePicker(false)}
                style={styles.fsSnoozeCancelBtn}
              >
                <Text style={styles.fsSnoozeCancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Snooze button */}
              <Pressable
                onPress={() => setShowSnoozePicker(true)}
                style={({ pressed }) => [
                  styles.fsSnoozeMainBtn,
                  {
                    borderColor: 'rgba(255,255,255,0.35)',
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <MaterialIcons name="snooze" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.fsSnoozeMainText}>Snooze</Text>
              </Pressable>

              {/* Done button */}
              <Pressable
                onPress={handleDone}
                style={({ pressed }) => [
                  styles.doneBtn,
                  { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialIcons name="check-circle" size={26} color="#fff" />
                <Text style={styles.doneBtnText}>Mark as Done</Text>
              </Pressable>

              {/* Dismiss */}
              <Pressable onPress={handleDismiss} style={styles.dismissLink}>
                <Text style={styles.dismissLinkText}>Dismiss</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // POPUP OVERLAY
  // ════════════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.popupOverlay} onPress={handleDismiss}>
        <Animated.View
          style={[
            styles.popupCard,
            {
              backgroundColor: colors.surface,
              borderColor: accentColor + '55',
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Colored top bar */}
          <View style={[styles.popupTopBar, { backgroundColor: accentColor }]}>
            <MaterialIcons name="alarm" size={16} color="#fff" />
            <Text style={styles.popupTopBarLabel}>REMINDER</Text>
            <View
              style={[
                styles.popupPriorityChip,
                { backgroundColor: 'rgba(255,255,255,0.25)' },
              ]}
            >
              <Text style={styles.popupPriorityText}>{priorityConfig.label}</Text>
            </View>
            {/* Arrow — opens Reminder Details */}
            {onOpenDetail ? (
              <Pressable
                onPress={handleOpenDetail}
                hitSlop={12}
                style={styles.popupDetailBtn}
              >
                <MaterialIcons name="open-in-new" size={17} color="rgba(255,255,255,0.85)" />
              </Pressable>
            ) : null}
            <Pressable onPress={handleDismiss} hitSlop={12} style={styles.popupCloseBtn}>
              <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>

          {/* Content row */}
          <View style={styles.popupContent}>
            <View style={[styles.popupIconWrap, { backgroundColor: accentColor + '18' }]}>
              <MaterialIcons name="notifications-active" size={28} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.popupTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {payload.title}
              </Text>
              {payload.body ? (
                <Text
                  style={[styles.popupBody, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {payload.body}
                </Text>
              ) : null}
              <Text style={[styles.popupTime, { color: colors.textTertiary }]}>
                {new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={[styles.popupActions, { borderTopColor: colors.border }]}>
            {showSnoozePicker ? (
              /* ── Snooze duration picker ─────────────────────────────── */
              <View>
                <Text style={[styles.popupSnoozeTitle, { color: colors.textSecondary }]}>
                  Snooze for…
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.popupSnoozeScrollContent}
                >
                  {SNOOZE_DURATIONS.map(({ minutes, label }) => (
                    <Pressable
                      key={minutes}
                      onPress={() => handleSnooze(minutes)}
                      style={({ pressed }) => [
                        styles.popupSnoozeDurationBtn,
                        {
                          backgroundColor: accentColor,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.popupSnoozeDurationText}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  onPress={() => setShowSnoozePicker(false)}
                  style={styles.popupSnoozeBack}
                >
                  <MaterialIcons name="arrow-back" size={14} color={colors.textTertiary} />
                  <Text style={[styles.popupSnoozeBackText, { color: colors.textTertiary }]}>
                    Back
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* ── Default: Snooze + Done ─────────────────────────────── */
              <View style={styles.popupDefaultActions}>
                <Pressable
                  onPress={() => setShowSnoozePicker(true)}
                  style={({ pressed }) => [
                    styles.popupSnoozeBtn,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MaterialIcons name="snooze" size={17} color={colors.textSecondary} />
                  <Text style={[styles.popupSnoozeBtnText, { color: colors.text }]}>
                    Snooze
                  </Text>
                  <MaterialIcons
                    name="expand-more"
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>

                <Pressable
                  onPress={handleDone}
                  style={({ pressed }) => [
                    styles.popupDoneBtn,
                    { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.popupDoneTxt}>Mark Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── Full-screen ────────────────────────────────────────────────────────────
  fullScreenBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
  },
  pulseRingInner: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
  },
  alarmIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  alarmTime: {
    fontSize: 56,
    fontWeight: '200',
    letterSpacing: -2,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  alarmTitle: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: SPACING.xs,
  },
  alarmBody: {
    fontSize: TYPOGRAPHY.sizes.md,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  // Full-screen snooze picker
  fsSnoozePickerWrap: {
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  fsSnoozePickerTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    letterSpacing: 0.5,
  },
  fsSnoozeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  fsSnoozeOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  fsSnoozeOptionText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  fsSnoozeCancelBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  fsSnoozeCancelText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  // Full-screen main snooze button
  fsSnoozeMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    width: '100%',
    marginTop: SPACING.md,
  },
  fsSnoozeMainText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 4,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    width: '100%',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  dismissLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dismissLinkText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: TYPOGRAPHY.sizes.sm,
  },

  // ── Popup ──────────────────────────────────────────────────────────────────
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  popupCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  popupTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  popupTopBarLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  popupPriorityChip: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  popupPriorityText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  popupDetailBtn: { padding: 2, marginLeft: 2 },
  popupCloseBtn: { padding: 2 },
  popupContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  popupIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  popupTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    lineHeight: 22,
    marginBottom: 2,
  },
  popupBody: {
    fontSize: TYPOGRAPHY.sizes.sm,
    lineHeight: 19,
    marginBottom: 4,
  },
  popupTime: { fontSize: TYPOGRAPHY.sizes.xs },
  popupActions: {
    borderTopWidth: 1,
    padding: SPACING.md,
  },
  // Default action row (Snooze + Done)
  popupDefaultActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  popupSnoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  popupSnoozeBtnText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  popupDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    flex: 1.4,
    minHeight: 44,
  },
  popupDoneTxt: {
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  // Snooze picker
  popupSnoozeTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  popupSnoozeScrollContent: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  popupSnoozeDurationBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupSnoozeDurationText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  popupSnoozeBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  popupSnoozeBackText: {
    fontSize: TYPOGRAPHY.sizes.xs,
  },
});
