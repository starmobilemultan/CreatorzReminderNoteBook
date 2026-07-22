/**
 * permissions.native.ts — iOS & Android implementation
 *
 * ROOT CAUSE FIXES (v2):
 *
 * FIX 1 — Correct package name (was returning 'com.anonymous'):
 *   Previous `getPackageName()` read from `Constants.expoConfig?.android?.package`
 *   but `app.json` has NO `android.package` field — so it always returned
 *   'com.anonymous'. Android then opened the wrong app's settings or nothing.
 *   CORRECT: Use `Application.applicationId` from `expo-application` which
 *   returns the ACTUAL runtime package name installed on the device.
 *
 * FIX 2 — Correct intent data URI format (sendIntent was wrong API):
 *   `Linking.sendIntent(action, extras)` adds key-value extras to the Intent
 *   but does NOT set the Intent DATA URI. All Android settings actions that
 *   open per-app toggles require the package as DATA URI:
 *     Intent.setData(Uri.parse("package:com.xxx"))
 *   The correct way from React Native is `Linking.openURL()` with the
 *   Android intent URI format:
 *     "android-app://settings#Intent;action=ACTION;data=package:COM.XXX;end"
 *   OR the simpler direct format that works on most devices:
 *     Use `Linking.sendIntent` for the action, then separately openURL the
 *     package: URI (but this doesn't work for these settings either).
 *
 *   ACTUAL WORKING FIX:
 *   Android intent URI format accepted by Linking.openURL():
 *     intent:#Intent;action=android.settings.FOO;data=package%3Acom.xxx;end
 *   The `data=` field in intent:// URI sets Intent.setData() — this is what
 *   Android needs to open the per-app settings page directly.
 *
 * FIX 3 — Full-screen intent behavior clarification:
 *   In Expo managed workflow, a MAX importance channel + bypassDnd=true triggers
 *   Android's fullScreenIntent automatically. The app launches via MainActivity
 *   which then renders the AlarmModal. This IS the correct behavior.
 *   SYSTEM_ALERT_WINDOW (Display Over Other Apps) is needed for the modal to
 *   draw over the lock screen after the app is launched.
 */

import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

// ─── Package name helper (FIXED) ─────────────────────────────────────────────
/**
 * Returns the ACTUAL runtime package name of the installed app.
 * Uses expo-application which reads from the native PackageManager at runtime.
 * This is reliable regardless of what's in app.json.
 */
function getPackageName(): string {
  try {
    // Application.applicationId returns the actual Android package name at runtime
    const appId = Application.applicationId;
    if (appId && typeof appId === 'string' && appId.length > 3) {
      return appId;
    }
  } catch (_) {}

  // Should never reach here on Android, but safe fallback
  return 'com.anonymous';
}

// ─── Core intent launcher (FIXED) ────────────────────────────────────────────
/**
 * Opens an Android settings page using the intent:// URI format.
 *
 * The intent:// URI format is the only way from React Native to set BOTH
 * the action AND the data URI on an Android Intent. `Linking.sendIntent()`
 * only supports extras (key-value), NOT the data URI which these settings
 * pages require.
 *
 * Format: intent:#Intent;action=ACTION_NAME;data=ENCODED_DATA;end
 * The data field uses URL encoding: "package:com.xxx" → "package%3Acom.xxx"
 */
async function openAndroidSettingsPage(
  action: string,
  packageName?: string
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  // Build the intent URI with the package as data URI (encoded colon)
  const encodedPkg = packageName ? `package%3A${packageName}` : null;

  // Method 1: intent:// URI with data — directly sets Intent.setData()
  if (encodedPkg) {
    try {
      const intentUri = `intent:#Intent;action=${action};data=${encodedPkg};end`;
      await Linking.openURL(intentUri);
      return true;
    } catch (_) {}
  } else {
    try {
      const intentUri = `intent:#Intent;action=${action};end`;
      await Linking.openURL(intentUri);
      return true;
    } catch (_) {}
  }

  // Method 2: Linking.sendIntent with package as extra (fallback — some devices accept this)
  if (packageName) {
    try {
      await Linking.sendIntent(action, [
        { key: 'android.provider.extra.PACKAGE_NAME', value: packageName },
      ]);
      return true;
    } catch (_) {}
  } else {
    try {
      await Linking.sendIntent(action, []);
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
    // Check via native AlarmManager (Android 12+)
    if (Platform.OS === 'android') {
      try {
        const { checkNativeExactAlarmPermission } = require('./nativeAlarm');
        return await checkNativeExactAlarmPermission();
      } catch (_) {}
    }
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return true;
  }
}

/**
 * Opens SCHEDULE_EXACT_ALARM settings for this specific app.
 * Android 12+ (API 31+): Opens exact alarm permission toggle for this app.
 *
 * Intent: action=android.settings.REQUEST_SCHEDULE_EXACT_ALARM, data=package:COM.XXX
 * This opens the per-app toggle: "Allow setting exact alarms"
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  const ok = await openAndroidSettingsPage(
    'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    pkg
  );
  if (ok) return;

  // Fallback: app details page
  const ok2 = await openAndroidSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok2) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens full-screen intent permission settings for this specific app.
 * Android 14+ (API 34+): Opens the "Allow full-screen intent notifications" toggle.
 *
 * Intent: action=android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT, data=package:COM.XXX
 * This shows the EXACT per-app toggle for USE_FULL_SCREEN_INTENT permission.
 */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  const ok = await openAndroidSettingsPage(
    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
    pkg
  );
  if (ok) return;

  // Fallback: app details → user navigates to Special App Access → Full-screen intents
  const ok2 = await openAndroidSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok2) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens "Display over other apps" (SYSTEM_ALERT_WINDOW) settings for this app.
 * Required for AlarmModal to render over lock screen / other apps.
 *
 * Intent: action=android.settings.action.MANAGE_OVERLAY_PERMISSION, data=package:COM.XXX
 * This shows the EXACT per-app "Allow display over other apps" toggle.
 */
export async function openOverlaySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: per-app overlay toggle (exact screen with ON/OFF toggle)
  const ok = await openAndroidSettingsPage(
    'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    pkg
  );
  if (ok) return;

  // Fallback: general overlay list (user finds app)
  const ok2 = await openAndroidSettingsPage(
    'android.settings.action.MANAGE_OVERLAY_PERMISSION'
  );
  if (ok2) return;

  // Final fallback: app details
  const ok3 = await openAndroidSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok3) return;

  await Linking.openSettings().catch(() => {});
}

/**
 * Opens battery optimization exemption settings for this specific app.
 *
 * Intent: action=android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, data=package:COM.XXX
 * This opens a system dialog: "Allow [App] to always run in background? / Unrestricted"
 * directly for this app — NOT the full list.
 */
export async function requestIgnoreBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = getPackageName();

  // Primary: direct battery exemption dialog for this app
  const ok = await openAndroidSettingsPage(
    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    pkg
  );
  if (ok) return;

  // Secondary: battery optimization settings list
  const ok2 = await openAndroidSettingsPage(
    'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
  );
  if (ok2) return;

  // Tertiary: app details page → Battery → Unrestricted
  const ok3 = await openAndroidSettingsPage(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg
  );
  if (ok3) return;

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

  result.notifications = await checkNotificationPermission();
  if (!result.notifications) {
    result.notifications = await requestNotificationPermissionNative();
  }

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
    'For reliable alarms when the app is closed:\n\n→ Tap "Open Settings"\n→ Select "Unrestricted" or tap "Allow"\n\nThis allows Creatorz reminders to fire even when the app is killed.',
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
    'Required on Android 14+ for alarms to wake your screen.\n\n→ Tap "Open Settings"\n→ Find Creatorz in the list\n→ Enable "Allow full-screen intent notifications"',
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
    'Required for alarm popups to appear over your lock screen and other apps.\n\n→ Tap "Open Settings"\n→ Find Creatorz\n→ Enable "Allow display over other apps"',
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
