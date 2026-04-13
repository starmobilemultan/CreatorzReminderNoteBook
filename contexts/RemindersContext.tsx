import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Reminder, AppSettings, ReminderHistoryEntry } from '../types';
import {
  loadReminders,
  saveReminders,
  loadSettings,
  appendReminderHistoryEntry,
  loadReminderHistory,
} from '../services/storage';
import {
  scheduleReminderNotification,
  cancelReminderNotifications,
  requestNotificationPermissions,
  rescheduleAllNotifications,
} from '../services/notifications';

interface RemindersContextType {
  reminders: Reminder[];
  history: ReminderHistoryEntry[];
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  toggleComplete: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  getReminderById: (id: string) => Reminder | undefined;
  getUpcomingReminders: () => Reminder[];
  getOverdueReminders: () => Reminder[];
  getTodayReminders: () => Reminder[];
  getFavoriteReminders: () => Reminder[];
  getArchivedReminders: () => Reminder[];
  getHistoryForReminder: (id: string) => ReminderHistoryEntry[];
  isLoading: boolean;
}

export const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

// ─── Compute next occurrence date for a repeating reminder ───────────────────
function computeNextOccurrence(reminder: Reminder): Date | null {
  if (reminder.repeat === 'none') return null;
  const base = new Date(reminder.dateTime);
  const now = new Date();
  let candidate = new Date(base);

  switch (reminder.repeat) {
    case 'daily':
      while (candidate <= now) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    case 'weekly':
      while (candidate <= now) {
        candidate.setDate(candidate.getDate() + 7);
      }
      return candidate;
    case 'monthly': {
      const origDay = base.getDate();
      while (candidate <= now) {
        candidate.setDate(1);
        candidate.setMonth(candidate.getMonth() + 1);
        const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
        candidate.setDate(Math.min(origDay, lastDay));
      }
      return candidate;
    }
    case 'yearly':
      while (candidate <= now) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }
      return candidate;
    default:
      return null;
  }
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<ReminderHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const settingsRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Persist reminders whenever they change
  const isFirstSave = useRef(true);
  useEffect(() => {
    if (isLoading) return;
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    saveReminders(reminders);
  }, [reminders, isLoading]);

  const loadInitialData = async () => {
    try {
      const [loadedReminders, settings, loadedHistory] = await Promise.all([
        loadReminders(),
        loadSettings(),
        loadReminderHistory(),
      ]);

      const migrated: Reminder[] = loadedReminders.map((r: any) => ({
        isFavorite: false,
        isArchived: false,
        history: [],
        ...r,
      }));

      if (settings) {
        settingsRef.current = settings;
      }

      setReminders(migrated);
      setHistory(loadedHistory);

      await requestNotificationPermissions();

      if (settings?.notificationEnabled && migrated.length > 0) {
        await rescheduleAllNotifications(migrated, settings);
      }
    } catch (error) {
      console.error('[RemindersContext] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSettings = async (): Promise<AppSettings | null> => {
    try {
      const s = await loadSettings();
      if (s) settingsRef.current = s;
      return settingsRef.current;
    } catch {
      return settingsRef.current;
    }
  };

  const scheduleIfActive = async (reminder: Reminder) => {
    try {
      const settings = await refreshSettings();
      if (!settings) return;
      if (!reminder.isCompleted && !reminder.isArchived) {
        await scheduleReminderNotification(reminder, settings);
      } else {
        await cancelReminderNotifications(reminder.id);
      }
    } catch (err) {
      console.error('[RemindersContext] Scheduling error:', err);
    }
  };

  const addHistoryEntry = async (
    reminderId: string,
    event: ReminderHistoryEntry['event'],
    note?: string
  ) => {
    const entry: ReminderHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      reminderId,
      event,
      timestamp: new Date().toISOString(),
      note,
    };
    await appendReminderHistoryEntry(entry);
    setHistory(prev => [entry, ...prev].slice(0, 500));
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const addReminder = (reminderData: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newReminder: Reminder = {
      isFavorite: false,
      isArchived: false,
      history: [],
      ...reminderData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    setReminders(prev => [newReminder, ...prev]);
    scheduleIfActive(newReminder);
  };

  const updateReminder = (id: string, updates: Partial<Reminder>) => {
    setReminders(prev =>
      prev.map(reminder => {
        if (reminder.id !== id) return reminder;
        const updated: Reminder = {
          ...reminder,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        scheduleIfActive(updated);
        return updated;
      })
    );
  };

  const deleteReminder = (id: string) => {
    cancelReminderNotifications(id).catch(() => {});
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  // ─── Toggle Complete — handles repeat reminders correctly ─────────────────
  const toggleComplete = (id: string) => {
    setReminders(prev =>
      prev.map(reminder => {
        if (reminder.id !== id) return reminder;
        const nowCompleting = !reminder.isCompleted;
        const now = new Date().toISOString();

        if (nowCompleting) {
          // Log completion in history
          addHistoryEntry(id, 'completed');

          // If it's a repeating reminder: don't mark isCompleted permanently.
          // Instead, advance dateTime to the next occurrence so it fires again.
          if (reminder.repeat !== 'none') {
            const next = computeNextOccurrence(reminder);
            if (next) {
              // Advance the reminder date to next occurrence; keep isCompleted=false
              const advanced: Reminder = {
                ...reminder,
                dateTime: next.toISOString(),
                nextOccurrence: next.toISOString(),
                isCompleted: false,
                updatedAt: now,
              };
              // Re-schedule for the next occurrence
              scheduleIfActive(advanced);
              return advanced;
            }
          }

          // Non-repeat or no next occurrence — mark as completed, cancel notification
          cancelReminderNotifications(id).catch(() => {});
          return { ...reminder, isCompleted: true, updatedAt: now };
        } else {
          // Un-completing
          const uncompleted: Reminder = {
            ...reminder,
            isCompleted: false,
            updatedAt: now,
          };
          scheduleIfActive(uncompleted);
          return uncompleted;
        }
      })
    );
  };

  const toggleFavorite = (id: string) => {
    setReminders(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, isFavorite: !r.isFavorite, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const toggleArchive = (id: string) => {
    setReminders(prev =>
      prev.map(reminder => {
        if (reminder.id !== id) return reminder;
        const updated: Reminder = {
          ...reminder,
          isArchived: !reminder.isArchived,
          updatedAt: new Date().toISOString(),
        };
        if (updated.isArchived) {
          cancelReminderNotifications(id).catch(() => {});
        } else {
          scheduleIfActive(updated);
        }
        return updated;
      })
    );
  };

  // ─── Queries ───────────────────────────────────────────────────────────────

  const getReminderById = (id: string) => reminders.find(r => r.id === id);

  const getUpcomingReminders = (): Reminder[] => {
    const now = new Date();
    return reminders
      .filter(r => !r.isCompleted && !r.isArchived && new Date(r.dateTime) > now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  };

  const getOverdueReminders = (): Reminder[] => {
    const now = new Date();
    return reminders
      .filter(r => !r.isCompleted && !r.isArchived && new Date(r.dateTime) < now)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  };

  const getTodayReminders = (): Reminder[] => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return reminders
      .filter(r => {
        const d = new Date(r.dateTime);
        return !r.isArchived && d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  };

  const getFavoriteReminders = () => reminders.filter(r => r.isFavorite && !r.isArchived);
  const getArchivedReminders = () => reminders.filter(r => r.isArchived);

  const getHistoryForReminder = (id: string): ReminderHistoryEntry[] =>
    history.filter(h => h.reminderId === id);

  return (
    <RemindersContext.Provider
      value={{
        reminders,
        history,
        addReminder,
        updateReminder,
        deleteReminder,
        toggleComplete,
        toggleFavorite,
        toggleArchive,
        getReminderById,
        getUpcomingReminders,
        getOverdueReminders,
        getTodayReminders,
        getFavoriteReminders,
        getArchivedReminders,
        getHistoryForReminder,
        isLoading,
      }}
    >
      {children}
    </RemindersContext.Provider>
  );
}
