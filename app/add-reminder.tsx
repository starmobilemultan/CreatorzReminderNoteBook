import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, PRIORITIES, CATEGORIES, REMINDER_REPEAT_OPTIONS } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import { useReminders } from '../hooks/useReminders';
import { useAlert } from '@/template';

export default function AddReminderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTheme } = useSettings();
  const colors = COLORS[currentTheme];
  const { addReminder } = useReminders();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState('personal');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      showAlert('Missing Title', 'Please add a title for your reminder');
      return;
    }

    addReminder({
      title: title.trim(),
      description: description.trim(),
      dateTime: dateTime.toISOString(),
      priority,
      category,
      isCompleted: false,
      isArchived: false,
      isFavorite: false,
      repeat,
      tags,
    });

    router.back();
  };

  // Auto-save partial data on back press
  const handleBack = () => {
    if (title.trim()) {
      addReminder({
        title: title.trim(),
        description: description.trim(),
        dateTime: dateTime.toISOString(),
        priority,
        category,
        isCompleted: false,
        isArchived: false,
        isFavorite: false,
        repeat,
        tags,
      });
    }
    router.back();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateTime(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDateTime = new Date(dateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setDateTime(newDateTime);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <MaterialIcons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Reminder</Text>
        <Pressable onPress={handleSave} hitSlop={8}>
          <MaterialIcons name="check" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter reminder title"
        />

        <Input
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Add more details..."
          multiline
          style={{ minHeight: 80 }}
        />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Date & Time</Text>
          <View style={styles.dateTimeRow}>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeText, { color: colors.text }]}>
                {dateTime.toLocaleDateString()}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={[styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialIcons name="access-time" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeText, { color: colors.text }]}>
                {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={dateTime}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={dateTime}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Priority</Text>
          <View style={styles.optionsRow}>
            {PRIORITIES.map(p => (
              <Pressable
                key={p.id}
                onPress={() => setPriority(p.id as any)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: priority === p.id ? p.color : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: priority === p.id ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Category</Text>
          <View style={styles.optionsRow}>
            {CATEGORIES.map(c => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: category === c.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={c.icon as any}
                  size={20}
                  color={category === c.id ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: category === c.id ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Repeat</Text>
          <View style={styles.optionsRow}>
            {REMINDER_REPEAT_OPTIONS.map(r => (
              <Pressable
                key={r.id}
                onPress={() => setRepeat(r.id as any)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: repeat === r.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: repeat === r.id ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tags</Text>
          <View style={styles.tagsInputContainer}>
            <Input
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag..."
              onSubmitEditing={handleAddTag}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Pressable
              onPress={handleAddTag}
              style={[styles.addTagButton, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View
                  key={index}
                  style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <Text style={[styles.tagText, { color: colors.text }]}>#{tag}</Text>
                  <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={4}>
                    <MaterialIcons name="close" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginBottom: SPACING.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dateTimeText: {
    fontSize: TYPOGRAPHY.sizes.md,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  optionText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  tagsInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  tagText: {
    fontSize: TYPOGRAPHY.sizes.sm,
  },
});
