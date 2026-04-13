import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Reminder, AppSettings, ReminderHistoryEntry } from '../types';

const KEYS = {
  NOTES: '@creatorz_notes',
  REMINDERS: '@creatorz_reminders',
  SETTINGS: '@creatorz_settings',
  TAGS: '@creatorz_tags',
  REMINDER_HISTORY: '@creatorz_reminder_history',
};

// Notes
export const saveNotes = async (notes: Note[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes:', error);
    throw error;
  }
};

export const loadNotes = async (): Promise<Note[]> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.NOTES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
};

// Reminders
export const saveReminders = async (reminders: Reminder[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  } catch (error) {
    console.error('Error saving reminders:', error);
    throw error;
  }
};

export const loadReminders = async (): Promise<Reminder[]> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.REMINDERS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading reminders:', error);
    return [];
  }
};

// Settings
export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const loadSettings = async (): Promise<AppSettings | null> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
};

// Reminder History
export const saveReminderHistory = async (history: ReminderHistoryEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.REMINDER_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving reminder history:', error);
  }
};

export const loadReminderHistory = async (): Promise<ReminderHistoryEntry[]> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.REMINDER_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading reminder history:', error);
    return [];
  }
};

export const appendReminderHistoryEntry = async (entry: ReminderHistoryEntry): Promise<void> => {
  try {
    const existing = await loadReminderHistory();
    // Keep last 500 entries
    const updated = [entry, ...existing].slice(0, 500);
    await saveReminderHistory(updated);
  } catch (error) {
    console.error('Error appending reminder history:', error);
  }
};

// Tags
export const saveTags = async (tags: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
  } catch (error) {
    console.error('Error saving tags:', error);
    throw error;
  }
};

export const loadTags = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.TAGS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading tags:', error);
    return [];
  }
};

export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      KEYS.NOTES,
      KEYS.REMINDERS,
      KEYS.TAGS,
      KEYS.REMINDER_HISTORY,
    ]);
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
