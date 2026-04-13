import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Reminder } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface ReminderCardProps {
  reminder: Reminder;
  onPress: () => void;
  onLongPress: () => void;
  onToggleComplete: () => void;
  onToggleFavorite?: () => void;
  selected?: boolean;
  multiSelectMode?: boolean;
}

export function ReminderCard({
  reminder,
  onPress,
  onLongPress,
  onToggleComplete,
  onToggleFavorite,
  selected = false,
  multiSelectMode = false,
}: ReminderCardProps) {
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];

  const checkAnim = useRef(new Animated.Value(reminder.isCompleted ? 1 : 0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;
  // Strong completion burst anim
  const completionBurst = useRef(new Animated.Value(0)).current;
  const completionOpacity = useRef(new Animated.Value(0)).current;
  const prevCompleted = useRef(reminder.isCompleted);

  React.useEffect(() => {
    Animated.spring(mountAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  React.useEffect(() => {
    // Animate check in/out
    Animated.spring(checkAnim, {
      toValue: reminder.isCompleted ? 1 : 0,
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Show strong feedback burst only when marking complete (not uncomplete)
    if (reminder.isCompleted && !prevCompleted.current) {
      completionBurst.setValue(0);
      completionOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(completionBurst, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(completionOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCompleted.current = reminder.isCompleted;
  }, [reminder.isCompleted]);

  const getPriorityColor = () => {
    switch (reminder.priority) {
      case 'high': return colors.priorityHigh;
      case 'medium': return colors.priorityMedium;
      case 'low': return colors.priorityLow;
      default: return colors.textTertiary;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reminderDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (reminderDate.getTime() === today.getTime()) return `Today · ${timeStr}`;
    if (reminderDate.getTime() === tomorrow.getTime()) return `Tomorrow · ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`;
  };

  const isOverdue = !reminder.isCompleted && new Date(reminder.dateTime) < new Date();
  const priorityColor = getPriorityColor();

  const handlePressIn = useCallback(() => {
    Animated.spring(cardScale, { toValue: 0.97, tension: 300, friction: 10, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(cardScale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }).start();
  }, []);

  const checkScale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.4, 1] });
  const checkRotate = checkAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Completion burst ring scale/opacity
  const burstScale = completionBurst.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: mountAnim,
          transform: [{ scale: Animated.multiply(mountAnim, cardScale) }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={350}
        style={[
          styles.card,
          {
            backgroundColor: selected
              ? colors.primary + '18'
              : reminder.isCompleted
              ? colors.surface
              : colors.surface,
            borderLeftColor: selected
              ? colors.primary
              : isOverdue
              ? colors.error
              : priorityColor,
          },
          SHADOWS.small,
          selected && { borderColor: colors.primary, borderWidth: 1.5 },
        ]}
      >
        {/* Priority accent bar */}
        <View
          style={[
            styles.priorityBar,
            {
              backgroundColor: selected
                ? colors.primary
                : isOverdue
                ? colors.error
                : priorityColor,
            },
          ]}
        />

        {/* Checkbox with burst animation */}
        <View style={styles.checkboxArea}>
          <Pressable
            onPress={multiSelectMode ? onPress : onToggleComplete}
            hitSlop={8}
            style={styles.checkboxWrapper}
          >
            <Animated.View
              style={{
                transform: [
                  { scale: multiSelectMode ? 1 : checkScale },
                  { rotate: multiSelectMode ? '0deg' : checkRotate },
                ],
              }}
            >
              {multiSelectMode ? (
                <MaterialIcons
                  name={selected ? 'check-circle' : 'radio-button-unchecked'}
                  size={26}
                  color={selected ? colors.primary : colors.textTertiary}
                />
              ) : (
                <MaterialIcons
                  name={reminder.isCompleted ? 'check-circle' : 'radio-button-unchecked'}
                  size={26}
                  color={reminder.isCompleted ? colors.success : colors.textTertiary}
                />
              )}
            </Animated.View>

            {/* Burst ring on completion */}
            {!multiSelectMode && (
              <Animated.View
                style={[
                  styles.burstRing,
                  {
                    borderColor: colors.success,
                    transform: [{ scale: burstScale }],
                    opacity: completionOpacity,
                  },
                ]}
              />
            )}
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                {
                  color: reminder.isCompleted ? colors.textTertiary : colors.text,
                  textDecorationLine: reminder.isCompleted ? 'line-through' : 'none',
                  opacity: reminder.isCompleted ? 0.6 : 1,
                },
              ]}
              numberOfLines={2}
            >
              {reminder.title}
            </Text>

            {/* Favorite star */}
            {onToggleFavorite && (
              <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.starBtn}>
                <MaterialIcons
                  name={reminder.isFavorite ? 'star' : 'star-border'}
                  size={18}
                  color={reminder.isFavorite ? colors.warning : colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          {reminder.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {reminder.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.timeChip}>
              <MaterialIcons
                name="access-time"
                size={12}
                color={isOverdue ? colors.error : colors.textTertiary}
              />
              <Text style={[styles.timeText, { color: isOverdue ? colors.error : colors.textTertiary }]}>
                {formatDateTime(reminder.dateTime)}
              </Text>
            </View>

            <View style={[styles.categoryChip, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                {reminder.category}
              </Text>
            </View>

            {reminder.repeat !== 'none' && (
              <View style={[styles.repeatChip, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="repeat" size={12} color={colors.primary} />
                <Text style={[styles.repeatText, { color: colors.primary }]}>{reminder.repeat}</Text>
              </View>
            )}

            {reminder.priority === 'high' && (
              <View style={[styles.priorityChip, { backgroundColor: colors.priorityHigh + '18' }]}>
                <MaterialIcons name="priority-high" size={10} color={colors.priorityHigh} />
                <Text style={[styles.priorityChipText, { color: colors.priorityHigh }]}>High</Text>
              </View>
            )}
          </View>

          {isOverdue && !reminder.isCompleted && (
            <View style={[styles.overdueChip, { backgroundColor: colors.error + '18' }]}>
              <MaterialIcons name="warning" size={12} color={colors.error} />
              <Text style={[styles.overdueText, { color: colors.error }]}>Overdue</Text>
            </View>
          )}
        </View>

        {/* Priority dot */}
        <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
      </Pressable>

      {/* Completion glow effect */}
      {reminder.isCompleted && (
        <Animated.View
          style={[
            styles.completionGlow,
            { backgroundColor: colors.success + '08' },
          ]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    paddingLeft: SPACING.sm,
  },
  priorityBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  checkboxArea: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  checkboxWrapper: {
    paddingTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  burstRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    top: 0,
    left: 0,
  },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    lineHeight: TYPOGRAPHY.sizes.md * TYPOGRAPHY.lineHeights.normal,
  },
  starBtn: {
    padding: 2,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.sm,
    lineHeight: TYPOGRAPHY.sizes.sm * TYPOGRAPHY.lineHeights.relaxed,
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: { fontSize: 11, fontWeight: '500' },
  categoryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryText: {
    fontSize: 11,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  repeatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  repeatText: {
    fontSize: 11,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  priorityChipText: { fontSize: 10, fontWeight: '600' },
  overdueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  overdueText: { fontSize: 11, fontWeight: '600' },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.sm,
  },
  completionGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.md,
  },
});
