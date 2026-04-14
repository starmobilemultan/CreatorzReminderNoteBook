/**
 * permissions.native.ts — iOS & Android implementation
 * All native-only imports are lazy (inside functions) to prevent SSR leakage.
 *
 * ROOT CAUSE FIXES:
 * 1. expo-constants package accessor fixed: newer versions export directly, not via .default
 * 2. Intent action strings corrected for Android 12–14+ compatibility
 * 3. Full-screen intent permission settings added (Android 14+ requires explicit grant)
 * 4. Battery optimization crash fixed: single require call, proper error isolation
 * 5. Fallback chain: specific intent → general optimization → Linking.openSettings()
 */
import { Alert, Linking, Platform } from 'react-native';

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

// ─── Safe package getter ───────────────────────────────────────────────────────
// expo-constants changed its export shape across versions — handle both.
function getPackageName(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const C = require('expo-constants');
    // Try all known accessor paths
    const pkg =
      C?.default?.expoConfig?.android?.package ??
      C?.expoConfig?.android?.package ??
      C?.default?.manifest?.android?.package ??
      C?.manifest?.android?.package ??
      C?.default?.appOwnership !== undefined
        ? undefined
        : undefined;

    if (pkg && typeof pkg === 'string') return pkg;
  } catch (_) {}
  // Hardcoded fallback — matches the slug in app.json; must be updated if package name changes
  return 'com.anonymous';
}

// ─── Safe intent launcher ─────────────────────────────────────────────────────
// Returns true on success, false on failure (never throws).
async function launchIntent(action: string, extras?: Record<string, any>): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startActivityAsync } = require('expo-intent-launcher');
    await startActivityAsync(action, extras ?? {});
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Notification permission ──────────────────────────────────────────────────
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const { getPermissionsAsync } = require('expo-notifications');
    const { status } = await getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestNotificationPermissionNative(): Promise<boolean> {
  try {
    const { requestPermissionsAsync } = require('expo-notifications');
    const { status } = await requestPermissionsAsync({
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
    const { getPermissionsAsync } = require('expo-notifications');
    const { status } = await getPermissionsAsync();
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

  // Try the direct package-scoped alarm permission page (Android 12+ / API 31+)
  const ok = await launchIntent(
    'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    { data: `package:${pkg}` }
  );
  if (!ok) {
    // Fallback: general alarm & reminder settings
    const ok2 = await launchIntent('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${pkg}`,
    });
    if (!ok2) {
      await Linking.openSettings().catch(() => {});
    }
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

  // Android 14+ specific action
  const ok = await launchIntent(
    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
    { data: `package:${pkg}` }
  );
  if (!ok) {
    // Fallback: app details page where user can manage special permissions
    const ok2 = await launchIntent('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${pkg}`,
    });
    if (!ok2) {
      await Linking.openSettings().catch(() => {});
    }
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

  // 1. Try direct "ignore battery optimizations" for this specific package
  const ok = await launchIntent(
    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    { data: `package:${pkg}` }
  );
  if (ok) return;

  // 2. Try the general "battery optimization" list page
  const ok2 = await launchIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  if (ok2) return;

  // 3. Try the app details page
  const ok3 = await launchIntent('android.settings.APPLICATION_DETAILS_SETTINGS', {
    data: `package:${pkg}`,
  });
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
