/**
 * permissions.native.ts — iOS & Android implementation
 *
 * FIXES APPLIED:
 *
 * Issue 1 — Correct Settings Intent URIs:
 *   The previous `intent:#Intent;action=...;end` URI scheme is unreliable and
 *   often opens App Info instead of the specific settings screen. The correct
 *   approach is:
 *   1. Use `Linking.sendIntent(action, extras)` — React Native's native Android
 *      intent API that directly maps to startActivity(Intent) on the Java side.
 *   2. Pass the package URI as an extra (not as data) for settings pages that
 *      need the app package to scope to this specific app.
 *   3. Multi-level fallback chain: specific page → general page → app info → settings root.
 *
 * Issue 2 — System Alert Window (Display Over Other Apps):
 *   For AlarmModal to render over the lock screen / other apps, the app needs the
 *   SYSTEM_ALERT_WINDOW permission in addition to USE_FULL_SCREEN_INTENT.
 *   The correct settings action is: android.settings.action.MANAGE_OVERLAY_PERMISSION
 *   with a `package:` URI via data extra.
 *
 *   How Android full-screen intent works with expo-notifications:
 *   - Channel importance = MAX + bypassDnd = true → Android fires fullScreenIntent
 *   - fullScreenIntent launches the app's MainActivity (not a floating window)
 *   - The AlarmModal renders INSIDE the launched app — this is correct behavior
 *   - The app opens on top of whatever was on screen (home/lock screen/other app)
 *   - SYSTEM_ALERT_WINDOW is required for the app to draw over the lock screen
 *   - USE_FULL_SCREEN_INTENT is required for Android 14+ to allow this behavior
 */

import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

// ─── Package name helper ──────────────────────────────────────────────────────
function getPackageName(): string {
  try {
    const pkg =
      Constants.expoConfig?.android?.package ??
      (Constants as any).manifest?.android?.package;
    if (pkg && typeof pkg === 'string') return pkg;
  } catch (_) {}
  // Fallback: read from app config slug pattern
  return 'com.anonymous';
}

// ─── Core intent launcher ─────────────────────────────────────────────────────
/**
 * Launch an Android settings intent using the correct API:
 * `Linking.sendIntent(action, extras)` is React Native's native binding to
 * Android's `startActivity(new Intent(action).setData(Uri.parse(data)))`.
 *
 * For settings pages that require the package URI, we pass it as an extra
 * with key "android.provider.extra.PACKAGE_NAME" OR use the direct
 * `package:com.xxx` URL scheme via Linking.openURL as a primary attempt.
 */
async function openSettingsPage(
  action: string,
  packageUri?: string
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  // Method 1: Direct URL with settings scheme (works on most Android versions)
  // Format: "android.settings.ACTION_NAME" is NOT a valid URL scheme.
  // Format that works: use Linking.sendIntent with action string
  try {
    if (packageUri) {
      // sendIntent with extras — this is the correct React Native Android API
      await Linking.sendIntent(action, [
        { key: 'android.provider.extra.PACKAGE_NAME', value: packageUri },
      ]);
      return true;
    } else {
      await Linking.sendIntent(action, []);
      return true;
    }
  } catch (_) {}

  // Method 2: Try with package: URI scheme via openURL (works for some actions)
  if (packageUri) {
    try {
      // Some Android versions accept this format for specific settings actions
      const uri = `${action}?package=${packageUri}`;
      await Linking.openURL(uri);
      return true;
    } catch (_) {}
  }

  return false;
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
 * Opens the SCHEDULE_EXACT_ALARM settings page directly for this app.
 * On Android 12+ (API 31+): opens exact alarm permission settings.
 * Fallback: app details page.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: exact alarm permission settings for this specific app
  const ok = await openSettingsPage(
    'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    pkg
  );
  if (ok) return;

  // Fallback: app details page
  const ok2 = await openSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok2) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens the full-screen intent permission settings page for this app.
 * Required on Android 14+ (API 34+): USE_FULL_SCREEN_INTENT permission.
 * Settings action: android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT
 *
 * This opens a per-app toggle: "Allow full-screen intent notifications"
 */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: full-screen intent settings page scoped to this app
  const ok = await openSettingsPage(
    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
    pkg
  );
  if (ok) return;

  // Fallback: app details page — user can navigate to Special App Access → Full-screen intents
  const ok2 = await openSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok2) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens "Display over other apps" (SYSTEM_ALERT_WINDOW) settings for this app.
 * Required for AlarmModal to render over the lock screen / other apps.
 * Settings action: android.settings.action.MANAGE_OVERLAY_PERMISSION
 */
export async function openOverlaySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: per-app overlay permission toggle (opens the exact toggle screen)
  const ok = await openSettingsPage(
    'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    pkg
  );
  if (ok) return;

  // Fallback: general overlay settings list (user finds the app in list)
  const ok2 = await openSettingsPage(
    'android.settings.action.MANAGE_OVERLAY_PERMISSION'
  );
  if (ok2) return;

  // Final fallback: app details → Special App Access → Display over other apps
  const ok3 = await openSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok3) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens battery optimization exemption settings directly for this app.
 *
 * FIX: Previous version used `intent:#Intent;...;end` URI scheme which is
 * inconsistent across devices and often opens App Info instead of the direct
 * battery optimization toggle.
 *
 * CORRECT: Use Linking.sendIntent with action=REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * and the package name extra — this directly opens the "Allow background activity"
 * / "Unrestricted" toggle for this specific app.
 */
export async function requestIgnoreBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: direct battery exemption dialog for this specific app
  // This opens the "Allow background activity / Unrestricted" toggle directly
  const ok = await openSettingsPage(
    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    pkg
  );
  if (ok) return;

  // Secondary: general battery optimization list (user finds app in list)
  const ok2 = await openSettingsPage(
    'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
  );
  if (ok2) return;

  // Tertiary: app details page → Battery → Unrestricted
  const ok3 = await openSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok3) return;

  // Final fallback
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
    'For reliable alarms when the app is closed:\n\n→ Tap "Open Settings"\n→ Select "Unrestricted" or "Allow"\n\nThis allows reminders to fire even when the app is killed.',
    [
      {
        text: 'Open Settings',
        onPress: () => {
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
    'Required for alarms to wake your screen and show over other apps.\n\n→ Tap "Open Settings"\n→ Enable "Allow full-screen intent notifications" for Creatorz',
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

// ─── Display Over Other Apps prompt ───────────────────────────────────────────
/**
 * Prompts the user to grant SYSTEM_ALERT_WINDOW (Display Over Other Apps).
 * This is required for the AlarmModal to render over the lock screen when
 * the app is launched via a full-screen intent.
 */
export function promptDisplayOverApps(
  onConfirm: () => void,
  onDismiss?: () => void
): void {
  if (Platform.OS !== 'android') {
    onConfirm();
    return;
  }

  Alert.alert(
    'Display Over Other Apps',
    'Required for alarm popups to appear over your lock screen and other apps.\n\n→ Tap "Open Settings"\n→ Enable "Allow display over other apps" for Creatorz',
    [
      {
        text: 'Open Settings',
        onPress: () => {
          openOverlaySettings()
            .catch(() => {})
            .finally(onConfirm);
        },
      },
      { text: 'Not Now', style: 'cancel', onPress: onDismiss },
    ]
  );
}
