export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isFavorite: boolean;
  tags: string[];
  hasChecklist: boolean;
  checklistItems?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  linkedReminderId?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ReminderHistoryEntry {
  id: string;
  reminderId: string;
  event: 'completed' | 'missed' | 'snoozed' | 'dismissed';
  timestamp: string;
  note?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  isCompleted: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  linkedNoteId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  nextOccurrence?: string;
  history?: ReminderHistoryEntry[];
}

export interface RingtoneOption {
  id: string;
  label: string;
  uri: string; // remote URL or local file URI
  isBuiltIn: boolean;
  isCustom?: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  lockEnabled: boolean;
  lockType: 'fingerprint' | 'pin' | 'both';
  pin?: string;
  notificationEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onboardingCompleted: boolean;
  // Notification style preferences
  notificationStyle: 'fullscreen' | 'popup' | 'banner';
  preNotifyEnabled: boolean;
  preNotifyMinutes: number;
  highPriorityFullscreen: boolean;
  // Ringtone
  ringtoneId: string;
  customRingtones?: RingtoneOption[];
}

export type ThemeMode = 'light' | 'dark';
