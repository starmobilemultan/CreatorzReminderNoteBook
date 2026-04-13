import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NoteCard } from '../../components/notes/NoteCard';
import { NoteQuickActions } from '../../components/notes/NoteQuickActions';
import { EmptyState } from '../../components/layout/EmptyState';
import { FAB } from '../../components/ui/FAB';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { useSettings } from '../../hooks/useSettings';
import { useNotes } from '../../hooks/useNotes';
import { Note } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'pinned' | 'checklist' | 'tagged' | 'favorites';

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const { notes, togglePin, toggleArchive, toggleFavorite, moveToTrash, updateNote } = useNotes();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [isGridView, setIsGridView] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [quickActionsNote, setQuickActionsNote] = useState<Note | null>(null);
  const [showArchiveSection, setShowArchiveSection] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isMultiSelect = selectedIds.length > 0;

  const searchWidth = useRef(new Animated.Value(SCREEN_WIDTH - SPACING.md * 2 - 48)).current;
  const archiveAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const activeNotes = notes.filter(note => !note.isArchived && !note.isTrashed);
  const archivedNotes = notes.filter(note => note.isArchived && !note.isTrashed);

  const filteredNotes = activeNotes.filter(note => {
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      selectedFilter === 'all' ||
      (selectedFilter === 'pinned' && note.isPinned) ||
      (selectedFilter === 'checklist' && note.hasChecklist) ||
      (selectedFilter === 'tagged' && note.tags.length > 0) ||
      (selectedFilter === 'favorites' && note.isFavorite);

    return matchesSearch && matchesFilter;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const regularNotes = filteredNotes.filter(n => !n.isPinned);

  const handleSearchFocus = () => {
    setSearchFocused(true);
    Animated.spring(searchWidth, {
      toValue: SCREEN_WIDTH - SPACING.md * 2,
      tension: 100, friction: 10, useNativeDriver: false,
    }).start();
  };

  const handleSearchBlur = () => {
    if (!searchQuery) {
      setSearchFocused(false);
      Animated.spring(searchWidth, {
        toValue: SCREEN_WIDTH - SPACING.md * 2 - 48,
        tension: 100, friction: 10, useNativeDriver: false,
      }).start();
    }
  };

  const toggleArchiveSection = () => {
    const next = !showArchiveSection;
    setShowArchiveSection(next);
    Animated.spring(archiveAnim, {
      toValue: next ? 1 : 0,
      tension: 80, friction: 12, useNativeDriver: true,
    }).start();
  };

  const handleNotePress = (note: Note) => {
    if (isMultiSelect) {
      toggleSelect(note.id);
    } else {
      router.push(`/note-detail?id=${note.id}`);
    }
  };

  const handleNoteLongPress = (note: Note) => {
    if (!isMultiSelect) {
      setSelectedIds([note.id]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const bulkArchive = () => {
    selectedIds.forEach(id => toggleArchive(id));
    clearSelection();
  };

  const bulkDelete = () => {
    selectedIds.forEach(id => moveToTrash(id));
    clearSelection();
  };

  const bulkFavorite = () => {
    selectedIds.forEach(id => toggleFavorite(id));
    clearSelection();
  };

  const getQuickActions = (note: Note) => [
    {
      icon: note.isPinned ? ('push-pin' as const) : ('push-pin' as const),
      label: note.isPinned ? 'Unpin' : 'Pin',
      color: colors.primary,
      onPress: () => togglePin(note.id),
    },
    {
      icon: 'star' as const,
      label: note.isFavorite ? 'Unfav' : 'Favorite',
      color: colors.warning,
      onPress: () => toggleFavorite(note.id),
    },
    {
      icon: 'archive' as const,
      label: 'Archive',
      color: colors.info,
      onPress: () => toggleArchive(note.id),
    },
    {
      icon: 'delete-outline' as const,
      label: 'Delete',
      danger: true,
      onPress: () => moveToTrash(note.id),
    },
  ];

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  const FILTERS: { id: FilterType; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'notes' },
    { id: 'favorites', label: 'Favorites', icon: 'star' },
    { id: 'pinned', label: 'Pinned', icon: 'push-pin' },
    { id: 'checklist', label: 'Lists', icon: 'check-box' },
    { id: 'tagged', label: 'Tagged', icon: 'label' },
  ];

  const renderMasonryNotes = (noteList: Note[]) => {
    if (!isGridView) {
      return noteList.map(note => (
        <NoteCard
          key={note.id}
          note={note}
          selected={selectedIds.includes(note.id)}
          multiSelectMode={isMultiSelect}
          onPress={() => handleNotePress(note)}
          onLongPress={() => handleNoteLongPress(note)}
          onSwipeRight={() => toggleArchive(note.id)}
          onSwipeLeft={() => moveToTrash(note.id)}
        />
      ));
    }

    const leftColumn: Note[] = [];
    const rightColumn: Note[] = [];
    noteList.forEach((note, index) => {
      if (index % 2 === 0) leftColumn.push(note);
      else rightColumn.push(note);
    });

    return (
      <View style={styles.masonryRow}>
        <View style={styles.masonryColumn}>
          {leftColumn.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              selected={selectedIds.includes(note.id)}
              multiSelectMode={isMultiSelect}
              onPress={() => handleNotePress(note)}
              onLongPress={() => handleNoteLongPress(note)}
            />
          ))}
        </View>
        <View style={styles.masonryColumn}>
          {rightColumn.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              selected={selectedIds.includes(note.id)}
              multiSelectMode={isMultiSelect}
              onPress={() => handleNotePress(note)}
              onLongPress={() => handleNoteLongPress(note)}
            />
          ))}
        </View>
      </View>
    );
  };

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
        /* Normal Animated Header */
        <Animated.View
          style={[
            styles.header,
            {
              paddingTop: insets.top + SPACING.sm,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <View style={styles.topRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
            <View style={styles.topActions}>
              <Pressable
                onPress={() => setIsGridView(!isGridView)}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.surface },
                  SHADOWS.small,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <MaterialIcons
                  name={isGridView ? 'view-list' : 'grid-view'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <Animated.View
              style={[
                styles.searchBar,
                {
                  backgroundColor: colors.surface,
                  borderColor: searchFocused ? colors.primary : colors.border,
                  width: searchWidth,
                },
                SHADOWS.small,
              ]}
            >
              <MaterialIcons
                name="search"
                size={20}
                color={searchFocused ? colors.primary : colors.textTertiary}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search notes..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </Animated.View>
            {searchFocused && (
              <Pressable
                onPress={() => { setSearchQuery(''); setSearchFocused(false); }}
                style={styles.cancelSearchBtn}
              >
                <Text style={[styles.cancelSearchText, { color: colors.primary }]}>Cancel</Text>
              </Pressable>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map(f => {
              const isActive = selectedFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setSelectedFilter(f.id)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surface,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                    SHADOWS.small,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialIcons
                    name={f.icon as any}
                    size={14}
                    color={isActive ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterText,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {/* Notes List */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {filteredNotes.length === 0 ? (
          <EmptyState
            image={require('../../assets/images/empty-notes.png')}
            title={searchQuery ? 'No notes found' : selectedFilter === 'favorites' ? 'No Favorites Yet' : 'Create Your First Note'}
            description={
              searchQuery
                ? 'Try different keywords'
                : selectedFilter === 'favorites'
                ? 'Star notes to find them here'
                : 'Tap + to capture your thoughts instantly'
            }
          />
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="push-pin" size={13} color={colors.textTertiary} />
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>PINNED</Text>
                </View>
                {renderMasonryNotes(pinnedNotes)}
              </View>
            )}

            {regularNotes.length > 0 && (
              <View style={styles.section}>
                {pinnedNotes.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="notes" size={13} color={colors.textTertiary} />
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>OTHERS</Text>
                  </View>
                )}
                {renderMasonryNotes(regularNotes)}
              </View>
            )}
          </>
        )}

        {/* WhatsApp-style Archive Section — hidden at bottom */}
        {archivedNotes.length > 0 && (
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
                Archived ({archivedNotes.length})
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
              <Animated.View
                style={{
                  opacity: archiveAnim,
                  transform: [{ scaleY: archiveAnim }],
                }}
              >
                <View style={[styles.archiveHint, { backgroundColor: colors.info + '10' }]}>
                  <MaterialIcons name="info-outline" size={14} color={colors.info} />
                  <Text style={[styles.archiveHintText, { color: colors.info }]}>
                    Swipe right on a note to archive it
                  </Text>
                </View>
                {archivedNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    selected={false}
                    multiSelectMode={false}
                    onPress={() => router.push(`/note-detail?id=${note.id}`)}
                    onLongPress={() => setQuickActionsNote(note)}
                    onSwipeRight={() => toggleArchive(note.id)}
                  />
                ))}
              </Animated.View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {!isMultiSelect && (
        <FAB icon="add" onPress={() => router.push('/add-note')} bottom={insets.bottom + 16} />
      )}

      {/* Quick Actions Bottom Sheet */}
      {quickActionsNote && (
        <NoteQuickActions
          visible={!!quickActionsNote}
          onClose={() => setQuickActionsNote(null)}
          actions={getQuickActions(quickActionsNote)}
          noteColor={quickActionsNote.color}
          onColorChange={(color) => {
            updateNote(quickActionsNote.id, { color });
            setQuickActionsNote(null);
          }}
          showColorPicker
        />
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
  multiSelectActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: -0.5,
  },
  topActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    includeFontPadding: false,
  },
  cancelSearchBtn: { paddingHorizontal: SPACING.xs },
  cancelSearchText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    borderRadius: RADIUS.full,
    gap: 5,
    borderWidth: 1,
  },
  filterText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  content: { flex: 1 },
  contentContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  section: { marginBottom: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.8,
  },
  masonryRow: { flexDirection: 'row', gap: SPACING.md },
  masonryColumn: { flex: 1 },
  archiveSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
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
  archiveHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
  },
  archiveHintText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});
