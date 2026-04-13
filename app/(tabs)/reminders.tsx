import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ReminderCard } from '../../components/reminders/ReminderCard';
import { EmptyState } from '../../components/layout/EmptyState';
import { FAB } from '../../components/ui/FAB';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, CATEGORIES } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';
import { useReminders } from '../../hooks/useReminders';
import { Reminder } from '../../types';

type FilterTab = 'today' | 'upcoming' | 'favorites' | 'completed' | 'all';

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const {
    reminders,
    toggleComplete,
    toggleFavorite,
    toggleArchive,
    deleteReminder,
    getTodayReminders,
    getOverdueReminders,
    getUpcomingReminders,
    getFavoriteReminders,
    getArchivedReminders,
  } = useReminders();

  const [activeTab, setActiveTab] = useState<FilterTab>('today');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showArchiveSection, setShowArchiveSection] = useState(false);
  const archiveAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const isMultiSelect = selectedIds.length > 0;

  const todayReminders = getTodayReminders();
  const overdueReminders = getOverdueReminders();
  const upcomingReminders = getUpcomingReminders().filter(
    r => !todayReminders.find(t => t.id === r.id) && !r.isCompleted
  );
  const completedReminders = reminders.filter(r => r.isCompleted && !r.isArchived);
  const favoriteReminders = getFavoriteReminders();
  const archivedReminders = getArchivedReminders();
  const allActive = reminders.filter(r => !r.isCompleted && !r.isArchived);

  const applyCategory = (list: Reminder[]) => {
    if (selectedCategory === 'all') return list;
    return list.filter(r => r.category === selectedCategory);
  };

  const getDisplayReminders = () => {
    switch (activeTab) {
      case 'today': return applyCategory([...overdueReminders, ...todayReminders]);
      case 'upcoming': return applyCategory(upcomingReminders);
      case 'favorites': return applyCategory(favoriteReminders);
      case 'completed': return applyCategory(completedReminders);
      case 'all': return applyCategory(allActive);
      default: return [];
    }
  };

  const displayReminders = getDisplayReminders();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  const clearSelection = () => setSelectedIds([]);

  const bulkComplete = () => {
    selectedIds.forEach(id => toggleComplete(id));
    clearSelection();
  };
  const bulkFavorite = () => {
    selectedIds.forEach(id => toggleFavorite(id));
    clearSelection();
  };
  const bulkArchive = () => {
    selectedIds.forEach(id => toggleArchive(id));
    clearSelection();
  };
  const bulkDelete = () => {
    selectedIds.forEach(id => deleteReminder(id));
    clearSelection();
  };

  const toggleArchiveSection = () => {
    const next = !showArchiveSection;
    setShowArchiveSection(next);
    Animated.spring(archiveAnim, {
      toValue: next ? 1 : 0,
      tension: 80, friction: 12, useNativeDriver: true,
    }).start();
  };

  const TABS: { id: FilterTab; label: string; count: number; color: string }[] = [
    { id: 'today', label: 'Today', count: todayReminders.length + overdueReminders.length, color: colors.primary },
    { id: 'upcoming', label: 'Upcoming', count: upcomingReminders.length, color: colors.success },
    { id: 'favorites', label: 'Starred', count: favoriteReminders.length, color: colors.warning },
    { id: 'completed', label: 'Done', count: completedReminders.length, color: colors.textTertiary },
    { id: 'all', label: 'All', count: allActive.length, color: colors.secondary },
  ];

  const ALL_CATEGORIES = [{ id: 'all', label: 'All', icon: 'apps' }, ...CATEGORIES];

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Multi-select top bar */}
      {isMultiSelect ? (
        <View
          style={[
            styles.multiSelectBar,
            { backgroundColor: colors.primary, paddingTop: insets.top + SPACING.sm },
          ]}
        >
          <Pressable onPress={clearSelection} hitSlop={8}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.multiSelectCount}>{selectedIds.length} selected</Text>
          <View style={styles.multiSelectActions}>
            <Pressable onPress={bulkComplete} hitSlop={8} style={styles.multiSelectBtn}>
              <MaterialIcons name="check-circle" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={bulkFavorite} hitSlop={8} style={styles.multiSelectBtn}>
              <MaterialIcons name="star" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={bulkArchive} hitSlop={8} style={styles.multiSelectBtn}>
              <MaterialIcons name="archive" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={bulkDelete} hitSlop={8} style={styles.multiSelectBtn}>
              <MaterialIcons name="delete" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.header,
            {
              paddingTop: insets.top + SPACING.sm,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>Reminders</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {overdueReminders.length > 0 && (
              <View style={[styles.statPill, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}>
                <View style={[styles.statDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.statLabel, { color: colors.error }]}>{overdueReminders.length} overdue</Text>
              </View>
            )}
            <View style={[styles.statPill, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
              <View style={[styles.statDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.statLabel, { color: colors.primary }]}>{todayReminders.length} today</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colors.success + '12', borderColor: colors.success + '30' }]}>
              <View style={[styles.statDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statLabel, { color: colors.success }]}>{upcomingReminders.length} upcoming</Text>
            </View>
          </View>

          {/* Status Tab bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarScroll}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    isActive && [styles.tabActive, { backgroundColor: tab.color + '15', borderColor: tab.color + '40' }],
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.tabLabel, { color: isActive ? tab.color : colors.textTertiary }]}>
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: isActive ? tab.color : colors.surfaceSecondary }]}>
                      <Text style={[styles.tabBadgeText, { color: isActive ? '#fff' : colors.textTertiary }]}>
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {ALL_CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: isActive ? colors.primary + '15' : colors.surface,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={13}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.categoryChipText, { color: isActive ? colors.primary : colors.textSecondary }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {displayReminders.length === 0 ? (
          <EmptyState
            image={require('../../assets/images/empty-reminders.png')}
            title={
              activeTab === 'completed' ? 'No Completed Tasks' :
              activeTab === 'favorites' ? 'No Starred Reminders' :
              activeTab === 'today' ? "You're All Caught Up!" : 'Nothing Here'
            }
            description={
              activeTab === 'today' ? 'No reminders for today. Great job!' :
              activeTab === 'favorites' ? 'Star reminders to find them quickly' :
              'Tap + to add a new reminder'
            }
          />
        ) : (
          <>
            {activeTab === 'today' && overdueReminders.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.error }]} />
                  <Text style={[styles.sectionTitle, { color: colors.error }]}>
                    OVERDUE ({applyCategory(overdueReminders).length})
                  </Text>
                </View>
                {applyCategory(overdueReminders).map(r => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    selected={selectedIds.includes(r.id)}
                    multiSelectMode={isMultiSelect}
                    onPress={() => isMultiSelect ? toggleSelect(r.id) : router.push(`/reminder-detail?id=${r.id}`)}
                    onLongPress={() => !isMultiSelect && setSelectedIds([r.id])}
                    onToggleComplete={() => toggleComplete(r.id)}
                    onToggleFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </View>
            )}

            {activeTab === 'today' && applyCategory(todayReminders).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                    TODAY ({applyCategory(todayReminders).length})
                  </Text>
                </View>
                {applyCategory(todayReminders).map(r => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    selected={selectedIds.includes(r.id)}
                    multiSelectMode={isMultiSelect}
                    onPress={() => isMultiSelect ? toggleSelect(r.id) : router.push(`/reminder-detail?id=${r.id}`)}
                    onLongPress={() => !isMultiSelect && setSelectedIds([r.id])}
                    onToggleComplete={() => toggleComplete(r.id)}
                    onToggleFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </View>
            )}

            {(activeTab !== 'today') && displayReminders.map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                selected={selectedIds.includes(r.id)}
                multiSelectMode={isMultiSelect}
                onPress={() => isMultiSelect ? toggleSelect(r.id) : router.push(`/reminder-detail?id=${r.id}`)}
                onLongPress={() => !isMultiSelect && setSelectedIds([r.id])}
                onToggleComplete={() => toggleComplete(r.id)}
                onToggleFavorite={() => toggleFavorite(r.id)}
              />
            ))}
          </>
        )}

        {/* Archive section - WhatsApp style hidden */}
        {archivedReminders.length > 0 && (
          <View style={styles.archiveSection}>
            <Pressable
              onPress={toggleArchiveSection}
              style={({ pressed }) => [
                styles.archiveToggleBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialIcons name="archive" size={18} color={colors.textTertiary} />
              <Text style={[styles.archiveToggleText, { color: colors.textSecondary }]}>
                Archived ({archivedReminders.length})
              </Text>
              <Animated.View
                style={{
                  transform: [{
                    rotate: archiveAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    })
                  }]
                }}
              >
                <MaterialIcons name="expand-more" size={20} color={colors.textTertiary} />
              </Animated.View>
            </Pressable>

            {showArchiveSection && (
              <Animated.View style={{ opacity: archiveAnim }}>
                {archivedReminders.map(r => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    selected={false}
                    multiSelectMode={false}
                    onPress={() => router.push(`/reminder-detail?id=${r.id}`)}
                    onLongPress={() => {}}
                    onToggleComplete={() => toggleComplete(r.id)}
                    onToggleFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </Animated.View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {!isMultiSelect && (
        <FAB icon="add" onPress={() => router.push('/add-reminder')} bottom={insets.bottom + 16} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  multiSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  multiSelectCount: {
    flex: 1,
    color: '#fff',
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  multiSelectActions: { flexDirection: 'row', gap: SPACING.xs },
  multiSelectBtn: {
    padding: SPACING.sm,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  tabBarScroll: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderWidth: 1 },
  tabLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: TYPOGRAPHY.weights.bold },
  categoryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  content: { flex: 1 },
  contentContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  section: { marginBottom: SPACING.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.8,
  },
  archiveSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  archiveToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  archiveToggleText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});
