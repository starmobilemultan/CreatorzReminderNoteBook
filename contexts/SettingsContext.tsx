import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppSettings, ThemeMode } from '../types';
import { loadSettings, saveSettings } from '../services/storage';
import { rescheduleAllNotifications, requestNotificationPermissions } from '../services/notifications';
import { loadReminders } from '../services/storage';
import { DEFAULT_RINGTONE_ID } from '../services/ringtones';
import { Appearance } from 'react-native';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  currentTheme: ThemeMode;
  isLocked: boolean;
  unlock: () => void;
  lock: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'auto',
  lockEnabled: false,
  lockType: 'both',
  notificationEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  onboardingCompleted: false,
  notificationStyle: 'popup',
  preNotifyEnabled: false,
  preNotifyMinutes: 10,
  highPriorityFullscreen: true,
  ringtoneId: DEFAULT_RINGTONE_ID,
  customRingtones: [],
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('light');
  const [isLocked, setIsLocked] = useState(false);

  const prevNotifSettings = useRef<string>('');
  const isInitialized = useRef(false);

  useEffect(() => {
    loadInitialSettings();

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSettings(prev => {
        if (prev.theme === 'auto') {
          setCurrentTheme(colorScheme === 'dark' ? 'dark' : 'light');
        }
        return prev;
      });
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (settings.theme === 'auto') {
      const systemTheme = Appearance.getColorScheme();
      setCurrentTheme(systemTheme === 'dark' ? 'dark' : 'light');
    } else {
      setCurrentTheme(settings.theme as ThemeMode);
    }
  }, [settings.theme]);

  useEffect(() => {
    if (!isInitialized.current) return;

    saveSettings(settings);

    // NOTE: Do NOT set isLocked here — lock only triggers on app resume,
    // not on every settings change (would interrupt customisation flow).

    const notifKey = JSON.stringify({
      notificationEnabled: settings.notificationEnabled,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      notificationStyle: settings.notificationStyle,
      preNotifyEnabled: settings.preNotifyEnabled,
      preNotifyMinutes: settings.preNotifyMinutes,
      highPriorityFullscreen: settings.highPriorityFullscreen,
    });

    if (prevNotifSettings.current && prevNotifSettings.current !== notifKey) {
      (async () => {
        try {
          await requestNotificationPermissions();
          const reminders = await loadReminders();
          const activeReminders = reminders.filter(r => !r.isCompleted && !r.isArchived);
          await rescheduleAllNotifications(activeReminders, settings);
        } catch (err) {
          console.error('[SettingsContext] Reschedule on settings change failed:', err);
        }
      })();
    }

    prevNotifSettings.current = notifKey;
  }, [settings]);

  const loadInitialSettings = async () => {
    try {
      const loadedSettings = await loadSettings();
      if (loadedSettings) {
        const merged: AppSettings = {
          ...defaultSettings,
          ...loadedSettings,
          ringtoneId: loadedSettings.ringtoneId ?? DEFAULT_RINGTONE_ID,
          customRingtones: loadedSettings.customRingtones ?? [],
        };
        setSettings(merged);
        if (merged.lockEnabled) {
          setIsLocked(true);
        }
        prevNotifSettings.current = JSON.stringify({
          notificationEnabled: merged.notificationEnabled,
          soundEnabled: merged.soundEnabled,
          vibrationEnabled: merged.vibrationEnabled,
          notificationStyle: merged.notificationStyle,
          preNotifyEnabled: merged.preNotifyEnabled,
          preNotifyMinutes: merged.preNotifyMinutes,
          highPriorityFullscreen: merged.highPriorityFullscreen,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isInitialized.current = true;
    }
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const unlock = () => setIsLocked(false);
  const lock = () => {
    if (settings.lockEnabled) setIsLocked(true);
  };

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, currentTheme, isLocked, unlock, lock }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
