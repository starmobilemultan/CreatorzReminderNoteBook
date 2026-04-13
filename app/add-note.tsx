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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, NOTE_COLORS, SHADOWS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import { useNotes } from '../hooks/useNotes';
import { useAlert } from '@/template';
import { ChecklistItem } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const { addNote } = useNotes();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('default');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);

  const toolbarAnim = useRef(new Animated.Value(0)).current;
  const colorPickerAnim = useRef(new Animated.Value(0)).current;

  const toggleToolbar = () => {
    const next = !showToolbar;
    setShowToolbar(next);
    Animated.spring(toolbarAnim, {
      toValue: next ? 1 : 0,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
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

  const doSave = () => {
    const hasContent = title.trim() || content.trim() || checklistItems.length > 0;
    if (!hasContent) return false;
    addNote({
      title: title.trim(),
      content: isChecklist ? '' : content.trim(),
      color: selectedColor,
      isPinned: false,
      isArchived: false,
      isTrashed: false,
      isFavorite: false,
      tags,
      hasChecklist: isChecklist,
      checklistItems: isChecklist ? checklistItems : [],
    });
    return true;
  };

  const handleSave = () => {
    const hasContent = title.trim() || content.trim() || checklistItems.length > 0;
    if (!hasContent) {
      showAlert('Empty Note', 'Please add a title or some content');
      return;
    }
    doSave();
    router.back();
  };

  const handleDiscard = () => {
    // Auto-save on back if there's content
    const hasContent = title.trim() || content.trim() || checklistItems.length > 0;
    if (hasContent) {
      doSave();
    }
    router.back();
  };

  const addChecklistItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false,
      };
      setChecklistItems(prev => [...prev, newItem]);
      setNewItemText('');
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(prev =>
      prev.map(item => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  };

  const getNoteColorBg = () => {
    if (selectedColor === 'default') return colors.background;
    const colorKey = `note${selectedColor.charAt(0).toUpperCase()}${selectedColor.slice(1)}` as keyof typeof colors;
    return (colors as any)[colorKey] || colors.background;
  };

  const toolbarSlide = toolbarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });
  const toolbarOpacity = toolbarAnim;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: getNoteColorBg() }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={handleDiscard} hitSlop={8} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setIsChecklist(!isChecklist)}
            hitSlop={8}
            style={[
              styles.headerBtn,
              isChecklist && { backgroundColor: colors.primary + '20', borderRadius: RADIUS.sm },
            ]}
          >
            <MaterialIcons
              name="check-box"
              size={24}
              color={isChecklist ? colors.primary : colors.textSecondary}
            />
          </Pressable>

          <Pressable onPress={toggleColorPicker} hitSlop={8} style={styles.headerBtn}>
            <View style={[
              styles.colorIndicator,
              {
                backgroundColor: selectedColor === 'default' ? colors.surface : getNoteColorBg(),
                borderColor: colors.border,
              }
            ]} />
          </Pressable>

          <Pressable onPress={toggleToolbar} hitSlop={8} style={styles.headerBtn}>
            <MaterialIcons
              name="more-vert"
              size={24}
              color={showToolbar ? colors.primary : colors.textSecondary}
            />
          </Pressable>

          <Pressable onPress={handleSave} hitSlop={8} style={styles.saveBtn}>
            <Text style={[styles.saveBtnText, { color: colors.primary }]}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Color Picker Dropdown */}
      {showColorPicker && (
        <Animated.View
          style={[
            styles.colorPickerBar,
            { backgroundColor: colors.surface, opacity: colorPickerAnim },
            SHADOWS.medium,
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
                  onPress={() => {
                    setSelectedColor(c.id);
                    toggleColorPicker();
                  }}
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

      {/* Toolbar dropdown */}
      {showToolbar && (
        <Animated.View
          style={[
            styles.toolbarDropdown,
            {
              backgroundColor: colors.surface,
              opacity: toolbarOpacity,
              transform: [{ translateY: toolbarSlide }],
            },
            SHADOWS.medium,
          ]}
        >
          <Pressable
            onPress={() => {
              setShowTagInput(!showTagInput);
              setShowToolbar(false);
            }}
            style={styles.toolbarItem}
          >
            <MaterialIcons name="label" size={20} color={colors.primary} />
            <Text style={[styles.toolbarItemText, { color: colors.text }]}>Add Tags</Text>
          </Pressable>
        </Animated.View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <TextInput
          style={[styles.titleInput, { color: colors.text }]}
          placeholder="Title"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          multiline
          returnKeyType="next"
        />

        {/* Content or Checklist */}
        {isChecklist ? (
          <View style={styles.checklistContainer}>
            {checklistItems.map(item => (
              <View key={item.id} style={styles.checklistRow}>
                <Pressable onPress={() => toggleChecklistItem(item.id)} hitSlop={8}>
                  <MaterialIcons
                    name={item.completed ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={item.completed ? colors.success : colors.textTertiary}
                  />
                </Pressable>
                <Text
                  style={[
                    styles.checklistText,
                    { color: item.completed ? colors.textTertiary : colors.text },
                    item.completed && styles.checklistDone,
                  ]}
                >
                  {item.text}
                </Text>
                <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}

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
          </View>
        ) : (
          <TextInput
            style={[styles.contentInput, { color: colors.text }]}
            placeholder="Start typing..."
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        )}

        {/* Tag Input */}
        {showTagInput && (
          <View style={styles.tagSection}>
            <Text style={[styles.tagSectionLabel, { color: colors.textTertiary }]}>Tags</Text>
            <View style={styles.tagInputRow}>
              <MaterialIcons name="label-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[styles.tagInput, { color: colors.text }]}
                placeholder="Add tag and press Enter..."
                placeholderTextColor={colors.textTertiary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                autoCapitalize="none"
              />
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((tag, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setTags(tags.filter(t => t !== tag))}
                    style={[styles.tagChip, { backgroundColor: colors.primary + '18' }]}
                  >
                    <Text style={[styles.tagChipText, { color: colors.primary }]}>#{tag}</Text>
                    <MaterialIcons name="close" size={12} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: getNoteColorBg(),
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + SPACING.sm,
          },
        ]}
      >
        <Pressable
          onPress={() => setShowTagInput(!showTagInput)}
          style={styles.bottomBarBtn}
        >
          <MaterialIcons
            name="label-outline"
            size={22}
            color={showTagInput ? colors.primary : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={() => setIsChecklist(!isChecklist)}
          style={styles.bottomBarBtn}
        >
          <MaterialIcons
            name="checklist"
            size={22}
            color={isChecklist ? colors.primary : colors.textSecondary}
          />
        </Pressable>

        <Pressable onPress={toggleColorPicker} style={styles.bottomBarBtn}>
          <MaterialIcons name="palette" size={22} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.bottomHint, { color: colors.textTertiary }]}>
          {isChecklist
            ? `${checklistItems.length} items`
            : `${content.length} chars`}
        </Text>
      </View>
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerBtn: {
    padding: SPACING.xs,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  colorIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  saveBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.semibold,
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
  toolbarDropdown: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  toolbarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  toolbarItemText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  titleInput: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.sm,
    minHeight: 44,
    includeFontPadding: false,
  },
  contentInput: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: TYPOGRAPHY.sizes.md * 1.7,
    minHeight: 160,
    includeFontPadding: false,
  },
  checklistContainer: {
    gap: SPACING.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
  },
  checklistText: {
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
  tagSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
  },
  tagSectionLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tagInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    includeFontPadding: false,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  tagChipText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  bottomBarBtn: {
    padding: SPACING.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.sizes.xs,
  },
});
