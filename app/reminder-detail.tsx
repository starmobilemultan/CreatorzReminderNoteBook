import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  PRIORITIES,
  CATEGORIES,
  REMINDER_REPEAT_OPTIONS,
  SHADOWS,
} from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import { useReminders } from '../hooks/useReminders';
import { useAlert } from '@/template';
import { ReminderHistoryEntry } from '../types';

// Priority display config
const PRIORITY_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  high: { label: 'HIGH PRIORITY', bgColor: '#EF444420', textColor: '#EF4444' },
  medium: { label: 'MEDIUM PRIORITY', bgColor: '#F59E0B20', textColor: '#F59E0B' },
  low: { label: 'LOW PRIORITY', bgColor: '#10B98120', textColor: '#10B981' },
};

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  completed: { icon: 'check-circle', color: '#10B981', label: 'Completed' },
  missed: { icon: 'error', color: '#EF4444', label: 'Missed' },
  snoozed: { icon: 'snooze', color: '#F59E0B', label: 'Snoozed' },
  dismissed: { icon: 'close', color: '#94A3B8', label: 'Dismissed' },
};

export default function ReminderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const { showAlert } = useAlert();
  const {
    reminders,
    deleteReminder,
    toggleComplete,
    toggleFavorite,
    toggleArchive,
    updateReminder,
    getHistoryForReminder,
  } = useReminders();

  const reminder = reminders.find(r => r.id === id);
  const reminderHistory = id ? getHistoryForReminder(id as string) : [];

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [editTitle, setEditTitle] = useState(reminder?.title || '');
  const [editDescription, setEditDescription] = useState(reminder?.description || '');
  const [editDateTime, setEditDateTime] = useState(
    reminder ? new Date(reminder.dateTime) : new Date()
  );
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>(
    reminder?.priority || 'medium'
  );
  const [editCategory, setEditCategory] = useState(reminder?.category || 'personal');
  const [editRepeat, setEditRepeat] = useState<
    'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  >(reminder?.repeat || 'none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const completionAnim = useRef(
    new Animated.Value(reminder?.isCompleted ? 1 : 0)
  ).current;

  if (!reminder) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: SPACING.md }}>Reminder not found</Text>
      </View>
    );
  }

  const priorityConf = PRIORITY_CONFIG[reminder.priority] ?? PRIORITY_CONFIG.medium;

  const handleToggleComplete = () => {
    const wasCompleted = reminder.isCompleted;
    toggleComplete(reminder.id);
    if (!wasCompleted) {
      Animated.sequence([
        Animated.spring(completionAnim, {
          toValue: 1.3,
          tension: 200,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(completionAnim, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.spring(completionAnim, {
        toValue: 0,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleDelete = () => {
    showAlert('Delete Reminder?', 'This reminder will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteReminder(reminder.id);
          router.back();
        },
      },
    ]);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) {
      showAlert('Missing Title', 'Please add a title for your reminder');
      return;
    }
    updateReminder(reminder.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      dateTime: editDateTime.toISOString(),
      priority: editPriority,
      category: editCategory,
      repeat: editRepeat,
    });
    setIsEditing(false);
  };

  const handleBack = () => {
    if (isEditing) {
      if (editTitle.trim()) {
        updateReminder(reminder.id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          dateTime: editDateTime.toISOString(),
          priority: editPriority,
          category: editCategory,
          repeat: editRepeat,
        });
      }
      setIsEditing(false);
    } else {
      router.back();
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setEditDateTime(selectedDate);
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDT = new Date(editDateTime);
      newDT.setHours(selectedTime.getHours());
      newDT.setMinutes(selectedTime.getMinutes());
      setEditDateTime(newDT);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatHistoryTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const isOverdue = !reminder.isCompleted && new Date(reminder.dateTime) < new Date();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={handleBack} hitSlop={8} style={styles.headerBtn}>
          <MaterialIcons
            name={isEditing ? 'close' : 'arrow-back'}
            size={26}
            color={colors.text}
          />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditing ? 'Edit Reminder' : 'Reminder'}
        </Text>

        <View style={styles.headerActions}>
          {isEditing ? (
            <Pressable onPress={handleSaveEdit} hitSlop={8} style={styles.headerBtn}>
              <MaterialIcons name="check" size={26} color={colors.primary} />
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => toggleFavorite(reminder.id)}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <MaterialIcons
                  name={reminder.isFavorite ? 'star' : 'star-border'}
                  size={24}
                  color={reminder.isFavorite ? colors.warning : colors.textSecondary}
                />
              </Pressable>
              <Pressable onPress={() => setIsEditing(true)} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons name="edit" size={22} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  toggleArchive(reminder.id);
                  router.back();
                }}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <MaterialIcons
                  name={reminder.isArchived ? 'unarchive' : 'archive'}
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons name="delete" size={22} color={colors.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Tab bar (Details / History) — only in view mode */}
      {!isEditing && (
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(['details', 'history'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabItem,
                activeTab === tab && [
                  styles.tabItemActive,
                  { borderBottomColor: colors.primary },
                ],
              ]}
            >
              <MaterialIcons
                name={tab === 'details' ? 'info-outline' : 'history'}
                size={16}
                color={activeTab === tab ? colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab ? colors.primary : colors.textTertiary,
                    fontWeight: activeTab === tab ? '600' : '400',
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {tab === 'history' && reminderHistory.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.tabBadgeText}>{reminderHistory.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isEditing ? (
          /* ===== EDIT MODE ===== */
          <View>
            <TextInput
              style={[
                styles.editTitleInput,
                { color: colors.text, borderBottomColor: colors.primary },
              ]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Reminder title"
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
            />
            <TextInput
              style={[
                styles.editDescInput,
                { color: colors.textSecondary, borderBottomColor: colors.border },
              ]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add description..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <Text style={[styles.editSectionLabel, { color: colors.textTertiary }]}>
              Date & Time
            </Text>
            <View style={styles.dateTimeRow}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.dateTimeBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>
                  {editDateTime.toLocaleDateString()}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={[
                  styles.dateTimeBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name="access-time" size={18} color={colors.primary} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>
                  {editDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={editDateTime}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={editDateTime}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            <Text style={[styles.editSectionLabel, { color: colors.textTertiary }]}>Priority</Text>
            <View style={styles.optionsRow}>
              {PRIORITIES.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => setEditPriority(p.id as any)}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: editPriority === p.id ? p.color : colors.surface,
                      borderColor: p.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: editPriority === p.id ? '#fff' : p.color },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.editSectionLabel, { color: colors.textTertiary }]}>Category</Text>
            <View style={styles.optionsRow}>
              {CATEGORIES.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => setEditCategory(c.id)}
                  style={[
                    styles.categoryBtn,
                    {
                      backgroundColor: editCategory === c.id ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={c.icon as any}
                    size={16}
                    color={editCategory === c.id ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      { color: editCategory === c.id ? '#fff' : colors.text },
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.editSectionLabel, { color: colors.textTertiary }]}>Repeat</Text>
            <View style={styles.optionsRow}>
              {REMINDER_REPEAT_OPTIONS.map(r => (
                <Pressable
                  key={r.id}
                  onPress={() => setEditRepeat(r.id as any)}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: editRepeat === r.id ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: editRepeat === r.id ? '#fff' : colors.text },
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : activeTab === 'history' ? (
          /* ===== HISTORY TAB ===== */
          <View>
            {reminderHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <MaterialIcons name="history" size={44} color={colors.textTertiary} />
                <Text style={[styles.emptyHistoryTitle, { color: colors.text }]}>
                  No History Yet
                </Text>
                <Text style={[styles.emptyHistoryDesc, { color: colors.textSecondary }]}>
                  Activity like completions, snoozes, and dismissals will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {reminderHistory.map((entry, index) => {
                  const conf = EVENT_CONFIG[entry.event] ?? EVENT_CONFIG.dismissed;
                  return (
                    <View key={entry.id} style={styles.historyItem}>
                      {/* Timeline line */}
                      {index < reminderHistory.length - 1 && (
                        <View
                          style={[styles.timelineLine, { backgroundColor: colors.border }]}
                        />
                      )}
                      <View
                        style={[
                          styles.historyDot,
                          { backgroundColor: conf.color + '20', borderColor: conf.color + '60' },
                        ]}
                      >
                        <MaterialIcons name={conf.icon as any} size={14} color={conf.color} />
                      </View>
                      <View style={styles.historyContent}>
                        <View
                          style={[
                            styles.historyEventBadge,
                            { backgroundColor: conf.color + '15' },
                          ]}
                        >
                          <Text style={[styles.historyEventLabel, { color: conf.color }]}>
                            {conf.label}
                          </Text>
                        </View>
                        <Text style={[styles.historyTime, { color: colors.textTertiary }]}>
                          {formatHistoryTime(entry.timestamp)}
                        </Text>
                        {entry.note ? (
                          <Text style={[styles.historyNote, { color: colors.textSecondary }]}>
                            {entry.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* ===== VIEW MODE — DETAILS TAB ===== */
          <>
            <View style={styles.statusRow}>
              {/* Priority badge */}
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: priorityConf.bgColor },
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: priorityConf.textColor },
                  ]}
                />
                <Text style={[styles.priorityText, { color: priorityConf.textColor }]}>
                  {priorityConf.label}
                </Text>
              </View>

              {reminder.repeat !== 'none' && (
                <View
                  style={[styles.repeatBadge, { backgroundColor: colors.info + '18' }]}
                >
                  <MaterialIcons name="repeat" size={12} color={colors.info} />
                  <Text style={[styles.badgeText, { color: colors.info }]}>
                    Repeats {reminder.repeat}
                  </Text>
                </View>
              )}

              {reminder.isArchived && (
                <View style={[styles.archivedBadge, { backgroundColor: colors.info + '18' }]}>
                  <MaterialIcons name="archive" size={12} color={colors.info} />
                  <Text style={[styles.badgeText, { color: colors.info }]}>Archived</Text>
                </View>
              )}

              {reminder.isFavorite && (
                <View
                  style={[styles.favoriteBadge, { backgroundColor: colors.warning + '18' }]}
                >
                  <MaterialIcons name="star" size={12} color={colors.warning} />
                  <Text style={[styles.badgeText, { color: colors.warning }]}>Starred</Text>
                </View>
              )}
            </View>

            {/* Title + complete button */}
            <View style={styles.titleRow}>
              <Pressable onPress={handleToggleComplete} style={styles.bigCheckBtn}>
                <Animated.View style={{ transform: [{ scale: completionAnim }] }}>
                  <MaterialIcons
                    name={
                      reminder.isCompleted ? 'check-circle' : 'radio-button-unchecked'
                    }
                    size={36}
                    color={reminder.isCompleted ? colors.success : colors.textTertiary}
                  />
                </Animated.View>
              </Pressable>
              <Text
                style={[
                  styles.title,
                  { color: reminder.isCompleted ? colors.textTertiary : colors.text },
                  reminder.isCompleted && styles.completedText,
                ]}
              >
                {reminder.title}
              </Text>
            </View>

            {/* Completion celebration */}
            {reminder.isCompleted && (
              <View
                style={[
                  styles.completionBanner,
                  {
                    backgroundColor: colors.success + '12',
                    borderColor: colors.success + '30',
                  },
                ]}
              >
                <MaterialIcons name="celebration" size={20} color={colors.success} />
                <Text style={[styles.completionBannerText, { color: colors.success }]}>
                  {reminder.repeat !== 'none'
                    ? 'Done! Next occurrence scheduled automatically.'
                    : 'Task completed! Great work.'}
                </Text>
              </View>
            )}

            {reminder.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {reminder.description}
              </Text>
            ) : null}

            {isOverdue && (
              <View
                style={[
                  styles.overdueBanner,
                  { backgroundColor: colors.error + '12', borderColor: colors.error + '30' },
                ]}
              >
                <MaterialIcons name="warning" size={16} color={colors.error} />
                <Text style={[styles.overdueBannerText, { color: colors.error }]}>
                  This reminder is overdue
                </Text>
              </View>
            )}

            <View
              style={[styles.detailsCard, { backgroundColor: colors.surface }, SHADOWS.small]}
            >
              <View style={styles.detailRow}>
                <MaterialIcons name="access-time" size={22} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Due</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDateTime(reminder.dateTime)}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <MaterialIcons name="repeat" size={22} color={colors.secondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Repeat</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {reminder.repeat === 'none'
                      ? 'Never'
                      : reminder.repeat.charAt(0).toUpperCase() + reminder.repeat.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <MaterialIcons name="category" size={22} color={colors.info} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Category</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {reminder.category.charAt(0).toUpperCase() + reminder.category.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {reminder.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tags</Text>
                <View style={styles.tagsContainer}>
                  {reminder.tags.map((tag, index) => (
                    <View
                      key={index}
                      style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Text style={[styles.tagText, { color: colors.text }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Quick history preview */}
            {reminderHistory.length > 0 && (
              <Pressable
                onPress={() => setActiveTab('history')}
                style={[
                  styles.historyPreview,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name="history" size={18} color={colors.primary} />
                <Text style={[styles.historyPreviewText, { color: colors.text }]}>
                  {reminderHistory.length} activity record
                  {reminderHistory.length !== 1 ? 's' : ''}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  headerBtn: {
    padding: SPACING.xs,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  // View mode
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeText: { fontSize: 11, fontWeight: TYPOGRAPHY.weights.semibold },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bigCheckBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    paddingTop: SPACING.xs,
  },
  completedText: { textDecorationLine: 'line-through', opacity: 0.5 },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  completionBannerText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.semibold, flex: 1 },
  description: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * TYPOGRAPHY.lineHeights.relaxed,
    marginBottom: SPACING.lg,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  overdueBannerText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.medium },
  detailsCard: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: TYPOGRAPHY.sizes.xs, marginBottom: 2 },
  detailValue: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: TYPOGRAPHY.weights.medium },
  divider: { height: 1, marginHorizontal: SPACING.md },
  tagsSection: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginBottom: SPACING.sm,
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  tagText: { fontSize: TYPOGRAPHY.sizes.sm },
  historyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  historyPreviewText: { flex: 1, fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.medium },
  // History tab
  emptyHistory: {
    alignItems: 'center',
    paddingTop: 60,
    gap: SPACING.md,
  },
  emptyHistoryTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  emptyHistoryDesc: {
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
  historyList: {
    paddingTop: SPACING.sm,
  },
  historyItem: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 30,
    width: 2,
    height: 30,
    borderRadius: 1,
  },
  historyDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  historyContent: {
    flex: 1,
    paddingTop: SPACING.xs,
    gap: 3,
  },
  historyEventBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  historyEventLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.4,
  },
  historyTime: { fontSize: TYPOGRAPHY.sizes.xs },
  historyNote: { fontSize: TYPOGRAPHY.sizes.xs, fontStyle: 'italic' },
  // Edit mode
  editTitleInput: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    borderBottomWidth: 2,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
    includeFontPadding: false,
  },
  editDescInput: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * 1.6,
    borderBottomWidth: 1,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.lg,
    minHeight: 60,
    includeFontPadding: false,
  },
  editSectionLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  dateTimeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dateTimeText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.medium },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  optionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  optionText: { fontSize: TYPOGRAPHY.sizes.sm, fontWeight: TYPOGRAPHY.weights.medium },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
});
