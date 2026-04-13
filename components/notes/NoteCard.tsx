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
import { Note, ChecklistItem } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  onSwipeRight?: () => void; // archive
  onSwipeLeft?: () => void;  // trash
  onQuickAction?: (action: 'pin' | 'archive' | 'delete' | 'color') => void;
  selected?: boolean;
  multiSelectMode?: boolean;
}

export function NoteCard({
  note,
  onPress,
  onLongPress,
  onSwipeRight,
  onSwipeLeft,
  onQuickAction,
  selected = false,
  multiSelectMode = false,
}: NoteCardProps) {
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];

  const translateX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;
  const isSwipping = useRef(false);

  React.useEffect(() => {
    Animated.spring(mountAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const getNoteColor = () => {
    if (note.color === 'default') return colors.surface;
    const colorKey = `note${note.color.charAt(0).toUpperCase()}${note.color.slice(1)}` as keyof typeof colors;
    return (colors as any)[colorKey] || colors.surface;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderGrant: () => {
        isSwipping.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        isSwipping.current = false;
        if (gestureState.dx > SWIPE_THRESHOLD && onSwipeRight) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onSwipeRight();
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD && onSwipeLeft) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onSwipeLeft();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(cardScale, {
      toValue: 0.97,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(cardScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const swipeOpacity = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.3, 0, SCREEN_WIDTH * 0.3],
    outputRange: [0.7, 1, 0.7],
    extrapolate: 'clamp',
  });

  const archiveIndicatorOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const deleteIndicatorOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const noteColor = getNoteColor();

  const completedItems = note.checklistItems?.filter(i => i.completed).length ?? 0;
  const totalItems = note.checklistItems?.length ?? 0;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: mountAnim,
          transform: [
            { scale: Animated.multiply(mountAnim, cardScale) },
          ],
        },
      ]}
    >
      {/* Swipe indicators */}
      {(onSwipeRight || onSwipeLeft) && (
        <>
          <Animated.View
            style={[
              styles.swipeIndicator,
              styles.swipeRight,
              { backgroundColor: colors.success, opacity: archiveIndicatorOpacity },
            ]}
          >
            <MaterialIcons name="archive" size={24} color="#fff" />
            <Text style={styles.swipeText}>Archive</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.swipeIndicator,
              styles.swipeLeft,
              { backgroundColor: colors.error, opacity: deleteIndicatorOpacity },
            ]}
          >
            <MaterialIcons name="delete" size={24} color="#fff" />
            <Text style={styles.swipeText}>Delete</Text>
          </Animated.View>
        </>
      )}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          {
            transform: [{ translateX }],
            opacity: swipeOpacity,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (!isSwipping.current) onPress();
          }}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={400}
          style={[
            styles.card,
            { backgroundColor: selected ? colors.primary + '18' : noteColor },
            SHADOWS.small,
            note.isPinned && [styles.pinnedCard, { borderColor: colors.primary + '40' }],
            selected && { borderColor: colors.primary, borderWidth: 2 },
          ]}
        >
          {/* Multi-select indicator */}
          {multiSelectMode && (
            <View style={styles.selectIndicator}>
              <MaterialIcons
                name={selected ? 'check-circle' : 'radio-button-unchecked'}
                size={18}
                color={selected ? colors.primary : colors.textTertiary}
              />
            </View>
          )}
          {/* Top row: pin + title + favorite */}
          <View style={styles.header}>
            {note.isPinned && (
              <MaterialIcons
                name="push-pin"
                size={14}
                color={colors.primary}
                style={styles.pinIcon}
              />
            )}
            {note.title ? (
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={2}
              >
                {note.title}
              </Text>
            ) : null}
            {note.isFavorite && (
              <MaterialIcons name="star" size={13} color={colors.warning} />
            )}
          </View>

          {/* Checklist preview */}
          {note.hasChecklist && note.checklistItems && note.checklistItems.length > 0 ? (
            <View style={styles.checklistPreview}>
              {note.checklistItems.slice(0, 4).map((item: ChecklistItem) => (
                <View key={item.id} style={styles.checklistRow}>
                  <MaterialIcons
                    name={item.completed ? 'check-box' : 'check-box-outline-blank'}
                    size={14}
                    color={item.completed ? colors.success : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.checklistText,
                      { color: item.completed ? colors.textTertiary : colors.textSecondary },
                      item.completed && styles.checklistDone,
                    ]}
                    numberOfLines={1}
                  >
                    {item.text}
                  </Text>
                </View>
              ))}
              {note.checklistItems.length > 4 && (
                <Text style={[styles.moreItems, { color: colors.textTertiary }]}>
                  +{note.checklistItems.length - 4} more items
                </Text>
              )}
              <View style={styles.checklistProgress}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.success,
                        width: totalItems > 0 ? `${(completedItems / totalItems) * 100}%` : '0%',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                  {completedItems}/{totalItems}
                </Text>
              </View>
            </View>
          ) : note.content ? (
            <Text
              style={[styles.content, { color: colors.textSecondary }]}
              numberOfLines={6}
            >
              {note.content}
            </Text>
          ) : null}

          {/* Tags */}
          {note.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {note.tags.slice(0, 2).map((tag, index) => (
                <View
                  key={index}
                  style={[styles.tag, { backgroundColor: colors.primary + '18' }]}
                >
                  <Text style={[styles.tagText, { color: colors.primary }]} numberOfLines={1}>
                    #{tag}
                  </Text>
                </View>
              ))}
              {note.tags.length > 2 && (
                <Text style={[styles.moreTagsText, { color: colors.textTertiary }]}>
                  +{note.tags.length - 2}
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              {formatDate(note.updatedAt)}
            </Text>
            <View style={styles.footerIcons}>
              {note.hasChecklist && !note.checklistItems?.length && (
                <MaterialIcons name="check-box" size={14} color={colors.textTertiary} />
              )}
              {note.linkedReminderId && (
                <MaterialIcons name="notifications" size={14} color={colors.primary} />
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
    position: 'relative',
  },
  swipeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    gap: 4,
  },
  swipeRight: {
    left: 0,
  },
  swipeLeft: {
    right: 0,
  },
  swipeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  pinnedCard: {
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  pinIcon: {
    marginRight: SPACING.xs,
    marginTop: 3,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
    lineHeight: TYPOGRAPHY.sizes.md * TYPOGRAPHY.lineHeights.normal,
  },
  content: {
    fontSize: TYPOGRAPHY.sizes.sm,
    lineHeight: TYPOGRAPHY.sizes.sm * TYPOGRAPHY.lineHeights.relaxed,
    marginBottom: SPACING.sm,
  },
  checklistPreview: {
    marginBottom: SPACING.sm,
    gap: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    flex: 1,
  },
  checklistDone: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  moreItems: {
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: 2,
  },
  checklistProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
    alignItems: 'center',
    gap: 4,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    maxWidth: 90,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
  },
  selectIndicator: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    zIndex: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  date: {
    fontSize: 10,
  },
  footerIcons: {
    flexDirection: 'row',
    gap: 4,
  },
});
