/**
 * permissions.native.ts — iOS & Android implementation
 * Uses expo-intent-launcher (native-only) for direct settings navigation.
 * All native-only imports are lazy (inside functions) to prevent SSR leakage.
 */
import { Alert, Linking, Platform } from 'react-native';

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestNotificationPermissionNative(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
        allowCriticalAlerts: true,
        provideAppNotificationSettings: true,
      },
    });
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function checkExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const IntentLauncher = require('expo-intent-launcher');
    const Constants = require('expo-constants');
    const pkg =
      Constants?.default?.expoConfig?.android?.package ??
      Constants?.expoConfig?.android?.package ??
      'com.anonymous';
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      { data: `package:${pkg}` }
    );
  } catch {
    await Linking.openSettings();
  }
}

export async function requestIgnoreBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const IntentLauncher = require('expo-intent-launcher');
    const Constants = require('expo-constants');
    const pkg =
      Constants?.default?.expoConfig?.android?.package ??
      Constants?.expoConfig?.android?.package ??
      'com.anonymous';
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${pkg}` }
    );
  } catch {
    try {
      const IntentLauncher = require('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
      );
    } catch {
      await Linking.openSettings();
    }
  }
}

export function isBatteryOptimizationCheckSupported(): boolean {
  return Platform.OS === 'android';
}

export async function openIOSNotificationSettings(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await Linking.openURL('app-settings:');
}

export async function runStartupPermissionCheck(): Promise<PermissionResult> {
  const result: PermissionResult = {
    notifications: false,
    exactAlarm: true,
    batteryOptimization: true,
  };

  result.notifications = await checkNotificationPermission();
  if (!result.notifications) {
    result.notifications = await requestNotificationPermissionNative();
  }

  if (Platform.OS === 'android') {
    result.exactAlarm = await checkExactAlarmPermission();
  }

  return result;
}

export function promptBatteryOptimization(
  onConfirm: () => void,
  onDismiss?: () => void
) {
  if (Platform.OS === 'ios') {
    Alert.alert(
      'Background Delivery (iOS)',
      'To ensure reminders arrive on time:\n\n1. Open Settings → Notifications → Creatorz\n2. Enable all alert types\n3. Settings → General → Background App Refresh → enable Creatorz',
      [
        {
          text: 'Open Settings',
          onPress: () => {
            openIOSNotificationSettings();
            onConfirm();
          },
        },
        { text: 'Later', style: 'cancel', onPress: onDismiss },
      ]
    );
    return;
  }

  Alert.alert(
    'Disable Battery Optimization',
    'For reliable alarms when the app is closed, tap "Allow" on the next screen to exempt Creatorz from battery restrictions.',
    [
      {
        text: 'Open Settings',
        onPress: async () => {
          await requestIgnoreBatteryOptimization();
          onConfirm();
        },
      },
      { text: 'Not Now', style: 'cancel', onPress: onDismiss },
    ]
  );
}
