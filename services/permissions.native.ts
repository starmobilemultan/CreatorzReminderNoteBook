
/**
 * permissions.native.ts — iOS & Android implementation
 * Uses only React Native's built-in Linking API (no expo-intent-launcher)
 * so no extra native module is required.
 *
 * Android settings pages are opened via the intent:// URI scheme which
 * React Native's Linking.openURL() handles natively on Android.
 */
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants'; // Import Constants directly
import * as Notifications from 'expo-notifications'; // Import Notifications directly

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

// ─── Safe package getter ───────────────────────────────────────────────────────
function getPackageName(): string {
  try {
    // Access expoConfig directly from the imported Constants
    const pkg =
      Constants.expoConfig?.android?.package ??
      Constants.manifest?.android?.package; // manifest is deprecated but kept for older SDKs
    if (pkg && typeof pkg === 'string') return pkg;
  } catch (_) {}
  return 'com.anonymous';
}

// ─── Build Android intent URI ──────────────────────────────────────────────────
// Format: intent:#Intent;action=<action>;data=<data>;end
// This is the standard way to fire Android Settings intents via Linking.openURL.
function buildIntentUri(action: string, data?: string): string {
  let uri = `intent:#Intent;action=${action}`;
  if (data) uri += `;data=${encodeURIComponent(data)}`;
  uri += ';end';
  return uri;
}

// ─── Safe intent launcher via Linking ─────────────────────────────────────────
// Returns true on success, false on failure (never throws).
async function launchIntent(action: string, data?: string): Promise<boolean> {
  try {
    const uri = buildIntentUri(action, data);
    const supported = await Linking.canOpenURL(uri).catch(() => true); // assume true on failure
    if (supported) {
      await Linking.openURL(uri);
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

// ─── Notification permission ──────────────────────────────────────────────────
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestNotificationPermissionNative(): Promise<boolean> {
  try {
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

// ─── Exact alarm permission ───────────────────────────────────────────────────
export async function checkExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return true;
  }
}

/**
 * Opens the SCHEDULE_EXACT_ALARM settings page.
 * Action differs by API level but expo handles the routing via the intent.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  const ok = await launchIntent(
    'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    `package:${pkg}`
  );
  if (!ok) {
    const ok2 = await launchIntent(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      `package:${pkg}`
    );
    if (!ok2) await Linking.openSettings().catch(() => {});
  }
}

/**
 * Opens the full-screen intent permission settings page.
 * Required on Android 14+ (API 34+) where USE_FULL_SCREEN_INTENT must be
 * explicitly granted by the user in Special App Access.
 */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  const ok = await launchIntent(
    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
    `package:${pkg}`
  );
  if (!ok) {
    const ok2 = await launchIntent(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      `package:${pkg}`
    );
    if (!ok2) await Linking.openSettings().catch(() => {});
  }
}

/**
 * Opens battery optimization exemption settings.
 * FIX: Previous version crashed because pkg was undefined + nested require calls.
 * Now: single require at top, correct Constants accessor, proper fallback chain.
 */
export async function requestIgnoreBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // 1. Direct battery optimization exemption for this package
  const ok = await launchIntent(
    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    `package:${pkg}`
  );
  if (ok) return;

  // 2. General battery optimization list
  const ok2 = await launchIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  if (ok2) return;

  // 3. App details page
  const ok3 = await launchIntent(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    `package:${pkg}`
  );
  if (ok3) return;

  // 4. Final fallback
  await Linking.openSettings().catch(() => {});
}

export function isBatteryOptimizationCheckSupported(): boolean {
  return Platform.OS === 'android';
}

export async function openIOSNotificationSettings(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await Linking.openURL('app-settings:').catch(() => Linking.openSettings());
}

// ─── Startup permission check ─────────────────────────────────────────────────
export async function runStartupPermissionCheck(): Promise<PermissionResult> {
  const result: PermissionResult = {
    notifications: false,
    exactAlarm: true,
    batteryOptimization: true,
  };

  // 1. Notification permission
  result.notifications = await checkNotificationPermission();
  if (!result.notifications) {
    result.notifications = await requestNotificationPermissionNative();
  }

  // 2. Exact alarm (Android only)
  if (Platform.OS === 'android') {
    result.exactAlarm = await checkExactAlarmPermission();
  }

  return result;
}

// ─── Battery optimization prompt ──────────────────────────────────────────────
export function promptBatteryOptimization(
  onConfirm: () => void,
  onDismiss?: () => void
): void {
  if (Platform.OS === 'ios') {
    Alert.alert(
      'Background Delivery (iOS)',
      'To ensure reminders arrive on time:\n\n1. Open Settings → Notifications → Creatorz\n2. Enable all alert types\n3. Settings → General → Background App Refresh → enable Creatorz',
      [
        {
          text: 'Open Settings',
          onPress: () => {
            openIOSNotificationSettings().finally(onConfirm);
          },
        },
        { text: 'Later', style: 'cancel', onPress: onDismiss },
      ]
    );
    return;
  }

  Alert.alert(
    'Disable Battery Optimization',
    'For reliable alarms when the app is closed, tap "Allow" on the next screen to exempt Creatorz from battery restrictions.\n\nThis is required for reminders to fire when the app is killed.',
    [
      {
        text: 'Open Settings',
        onPress: () => {
          // Fire and forget — do NOT await inside onPress (causes ANR on some devices)
          requestIgnoreBatteryOptimization()
            .catch(() => {})
            .finally(onConfirm);
        },
      },
      { text: 'Not Now', style: 'cancel', onPress: onDismiss },
    ]
  );
}

// ─── Full-screen intent permission prompt ─────────────────────────────────────
export function promptFullScreenIntent(
  onConfirm: () => void,
  onDismiss?: () => void
): void {
  if (Platform.OS !== 'android') {
    onConfirm();
    return;
  }

  Alert.alert(
    'Full-Screen Alarm Permission',
    'On Android 14+, full-screen alarms require an extra permission.\n\nTap "Open Settings" → enable "Display over other apps" or "Use full-screen intent" for Creatorz.',
    [
      {
        text: 'Open Settings',
        onPress: () => {
          openFullScreenIntentSettings()
            .catch(() => {})
            .finally(onConfirm);
        },
      },
      { text: 'Not Now', style: 'cancel', onPress: onDismiss },
    ]
  );
}
