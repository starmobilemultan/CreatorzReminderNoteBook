/**
 * permissions.web.ts — Web stubs
 * expo-intent-launcher is native-only; all functions are no-ops on web.
 */

export type PermissionResult = {
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimization: boolean;
};

export async function checkNotificationPermission(): Promise<boolean> {
  return false;
}

export async function requestNotificationPermissionNative(): Promise<boolean> {
  return false;
}

export async function checkExactAlarmPermission(): Promise<boolean> {
  return true;
}

export async function openExactAlarmSettings(): Promise<void> {}

export async function openFullScreenIntentSettings(): Promise<void> {}

export async function requestIgnoreBatteryOptimization(): Promise<void> {}

export function isBatteryOptimizationCheckSupported(): boolean {
  return false;
}

export async function openIOSNotificationSettings(): Promise<void> {}

export async function runStartupPermissionCheck(): Promise<PermissionResult> {
  return { notifications: false, exactAlarm: true, batteryOptimization: true };
}

export function promptBatteryOptimization(
  _onConfirm: () => void,
  _onDismiss?: () => void
): void {}

export function promptFullScreenIntent(
  onConfirm: () => void,
  _onDismiss?: () => void
): void {
  onConfirm();
}
