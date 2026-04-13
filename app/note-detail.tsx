import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, NOTE_COLORS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import { useNotes } from '../hooks/useNotes';
import { useAlert } from '@/template';
import { ChecklistItem } from '../types';

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const { showAlert } = useAlert();
  const {
    notes,
    updateNote,
    togglePin,
    toggleArchive,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
  } = useNotes();

  const note = notes.find(n => n.id === id);

  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    note?.checklistItems || []
  );
  const [newItemText, setNewItemText] = useState('');
  const [selectedColor, setSelectedColor] = useState(note?.color || 'default');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const colorPickerAnim = useRef(new Animated.Value(0)).current;
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const scheduleAutoSave = useCallback(
    (newTitle: string, newContent: string, newItems: ChecklistItem[], newColor: string) => {
      setIsDirty(true);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (note) {
          updateNote(note.id, {
            title: newTitle,
            content: note.hasChecklist ? '' : newContent,
            checklistItems: note.hasChecklist ? newItems : [],
            color: newColor,
          });
          setIsDirty(false);
        }
      }, 800);
    },
    [note, updateNote]
  );

  const handleTitleChange = (text: string) => {
    setTitle(text);
    scheduleAutoSave(text, content, checklistItems, selectedColor);
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    scheduleAutoSave(title, text, checklistItems, selectedColor);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    scheduleAutoSave(title, content, checklistItems, color);
    setShowColorPicker(false);
    Animated.timing(colorPickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const toggleColorPicker = () => {
    const next = !showColorPicker;
    setShowColorPicker(next);
    Animated.spring(colorPickerAnim, {
      toValue: next ? 1 : 0,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const saveAndGoBack = () => {
    if (note) {
      updateNote(note.id, {
        title,
        content: note.hasChecklist ? '' : content,
        checklistItems: note.hasChecklist ? checklistItems : [],
        color: selectedColor,
      });
    }
    router.back();
  };

  const handleDelete = () => {
    if (note?.isTrashed) {
      showAlert('Delete Permanently?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            permanentDelete(note.id);
            router.back();
          },
        },
      ]);
    } else if (note) {
      moveToTrash(note.id);
      router.back();
    }
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = checklistItems.map(i =>
      i.id === itemId ? { ...i, completed: !i.completed } : i
    );
    setChecklistItems(updated);
    scheduleAutoSave(title, content, updated, selectedColor);
  };

  const removeChecklistItem = (itemId: string) => {
    const updated = checklistItems.filter(i => i.id !== itemId);
    setChecklistItems(updated);
    scheduleAutoSave(title, content, updated, selectedColor);
  };

  const addChecklistItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false,
      };
      const updated = [...checklistItems, newItem];
      setChecklistItems(updated);
      setNewItemText('');
      scheduleAutoSave(title, content, updated, selectedColor);
    }
  };

  if (!note) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Note not found</Text>
      </View>
    );
  }

  const getNoteColorBg = () => {
    if (selectedColor === 'default') return colors.background;
    const colorKey = `note${selectedColor.charAt(0).toUpperCase()}${selectedColor.slice(1)}` as keyof typeof colors;
    return (colors as any)[colorKey] || colors.background;
  };

  const isReadOnly = note.isTrashed || note.isArchived;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: getNoteColorBg() }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={saveAndGoBack} hitSlop={8} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          {isDirty && (
            <Text style={[styles.savingText, { color: colors.textTertiary }]}>Saving...</Text>
          )}
        </View>

        <View style={styles.headerActions}>
          {!isReadOnly && (
            <>
              <Pressable onPress={() => togglePin(note.id)} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons
                  name={note.isPinned ? 'push-pin' : 'push-pin'}
                  size={22}
                  color={note.isPinned ? colors.primary : colors.textSecondary}
                />
              </Pressable>
              <Pressable onPress={toggleColorPicker} hitSlop={8} style={styles.headerBtn}>
                <View
                  style={[
                    styles.colorIndicator,
                    {
                      backgroundColor: getNoteColorBg(),
                      borderColor: colors.border,
                    },
                  ]}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  toggleArchive(note.id);
                  router.back();
                }}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <MaterialIcons
                  name={note.isArchived ? 'unarchive' : 'archive'}
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>
            </>
          )}
          {isReadOnly && (
            <Pressable
              onPress={() => {
                if (note.isTrashed) restoreFromTrash(note.id);
                else toggleArchive(note.id);
                router.back();
              }}
              hitSlop={8}
              style={styles.headerBtn}
            >
              <MaterialIcons name="restore" size={22} color={colors.success} />
            </Pressable>
          )}
          <Pressable onPress={handleDelete} hitSlop={8} style={styles.headerBtn}>
            <MaterialIcons
              name="delete-outline"
              size={22}
              color={colors.error}
            />
          </Pressable>
        </View>
      </View>

      {/* Color Picker */}
      {showColorPicker && (
        <Animated.View
          style={[
            styles.colorPickerBar,
            { backgroundColor: colors.surface, opacity: colorPickerAnim },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorsRow}
          >
            {NOTE_COLORS.map(c => {
              const colorKey =
                c.id === 'default'
                  ? 'surface'
                  : (`note${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}` as keyof typeof colors);
              const bgColor = (colors as any)[colorKey] || colors.surface;
              const isSelected = selectedColor === c.id;

              return (
                <Pressable
                  key={c.id}
                  onPress={() => handleColorChange(c.id)}
                  style={({ pressed }) => [
                    styles.colorDot,
                    {
                      backgroundColor: bgColor,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2.5 : 1.5,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {isSelected && (
                    <MaterialIcons name="check" size={14} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Note status badges */}
        {(note.isTrashed || note.isArchived) && (
          <View
            style={[
              styles.statusBanner,
              { backgroundColor: note.isTrashed ? colors.error + '18' : colors.info + '18' },
            ]}
          >
            <MaterialIcons
              name={note.isTrashed ? 'delete' : 'archive'}
              size={16}
              color={note.isTrashed ? colors.error : colors.info}
            />
            <Text
              style={[
                styles.statusText,
                { color: note.isTrashed ? colors.error : colors.info },
              ]}
            >
              {note.isTrashed ? 'In Trash · Tap restore to recover' : 'Archived'}
            </Text>
          </View>
        )}

        {/* Title */}
        {isReadOnly ? (
          <Text style={[styles.titleReadOnly, { color: colors.text }]}>{note.title || 'Untitled'}</Text>
        ) : (
          <TextInput
            style={[styles.titleInput, { color: colors.text }]}
            placeholder="Title"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={handleTitleChange}
            multiline
            editable={!isReadOnly}
          />
        )}

        {/* Content / Checklist */}
        {note.hasChecklist ? (
          <View style={styles.checklistContainer}>
            {checklistItems.map(item => (
              <View key={item.id} style={styles.checklistRow}>
                <Pressable
                  onPress={() => !isReadOnly && toggleChecklistItem(item.id)}
                  hitSlop={8}
                >
                  <MaterialIcons
                    name={item.completed ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={item.completed ? colors.success : colors.textTertiary}
                  />
                </Pressable>
                <Text
                  style={[
                    styles.checklistItemText,
                    { color: item.completed ? colors.textTertiary : colors.text },
                    item.completed && styles.checklistDone,
                  ]}
                >
                  {item.text}
                </Text>
                {!isReadOnly && (
                  <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
                    <MaterialIcons name="close" size={16} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>
            ))}

            {!isReadOnly && (
              <View style={styles.addItemRow}>
                <MaterialIcons name="add" size={22} color={colors.textTertiary} />
                <TextInput
                  style={[styles.addItemInput, { color: colors.text }]}
                  placeholder="List item"
                  placeholderTextColor={colors.textTertiary}
                  value={newItemText}
                  onChangeText={setNewItemText}
                  onSubmitEditing={addChecklistItem}
                  returnKeyType="done"
                />
              </View>
            )}
          </View>
        ) : isReadOnly ? (
          <Text style={[styles.contentReadOnly, { color: colors.textSecondary }]}>
            {note.content}
          </Text>
        ) : (
          <TextInput
            style={[styles.contentInput, { color: colors.text }]}
            placeholder="Start typing..."
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={handleContentChange}
            multiline
            textAlignVertical="top"
          />
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {note.tags.map((tag, i) => (
              <View key={i} style={[styles.tagChip, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.tagChipText, { color: colors.primary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Timestamps */}
        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
          Edited {new Date(note.updatedAt).toLocaleDateString([], {
            year: 'numeric', month: 'short', day: 'numeric',
          })}{' '}
          {new Date(note.updatedAt).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerBtn: {
    padding: SPACING.xs,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  savingText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  colorPickerBar: {
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  colorsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  titleInput: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.sm,
    minHeight: 44,
    includeFontPadding: false,
  },
  titleReadOnly: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.sm,
  },
  contentInput: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * 1.7,
    minHeight: 160,
    includeFontPadding: false,
  },
  contentReadOnly: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * 1.7,
  },
  checklistContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
  },
  checklistItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * 1.5,
  },
  checklistDone: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
  },
  addItemInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    includeFontPadding: false,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  tagChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  tagChipText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  timestamp: {
    fontSize: 11,
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
});
