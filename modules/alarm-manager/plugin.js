/**
 * plugin.js — Config Plugin implementation for creatorz-alarm-manager
 *
 * Uses the standard require('@expo/config-plugins') pattern identical to all
 * official Expo SDK plugins (expo-notifications, expo-local-authentication, etc.).
 *
 * @expo/config-plugins is a DIRECT dependency of the `expo` package and is
 * always available in node_modules when `expo` is installed. No custom path
 * resolution is needed or wanted — it causes more problems than it solves.
 */

'use strict';

const { withAndroidManifest, withAppBuildGradle, withSettingsGradle } =
  require('@expo/config-plugins');

// ─── withAlarmManagerManifest ────────────────────────────────────────────────
/**
 * Injects all required native Android components into AndroidManifest.xml:
 *   - AlarmReceiver        (BroadcastReceiver — fired by AlarmManager)
 *   - AlarmDismissReceiver (BroadcastReceiver — handles dismiss/snooze)
 *   - BootReceiver         (BroadcastReceiver — restores alarms after reboot)
 *   - AlarmActivity        (Activity — full-screen intent over lock screen)
 *   - AlarmForegroundService (Service — keeps CPU alive during alarm)
 * Also declares all required Android permissions.
 */
function withAlarmManagerManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // ── AlarmReceiver ──────────────────────────────────────────────────────
    if (!application.receiver) application.receiver = [];
    const hasAlarmReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmReceiver'
    );
    if (!hasAlarmReceiver) {
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmReceiver',
          'android:exported': 'false',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.creatorz.ALARM_FIRE' } }],
          },
        ],
      });
    }

    // ── AlarmDismissReceiver ───────────────────────────────────────────────
    const hasDismissReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmDismissReceiver'
    );
    if (!hasDismissReceiver) {
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmDismissReceiver',
          'android:exported': 'false',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.creatorz.ALARM_DISMISS' } }],
          },
        ],
      });
    }

    // ── BootReceiver ───────────────────────────────────────────────────────
    const hasBootReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.BootReceiver'
    );
    if (!hasBootReceiver) {
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.BootReceiver',
          'android:exported': 'true',
          'android:directBootAware': 'true',
          'android:enabled': 'true',
        },
        'intent-filter': [
          {
            $: { 'android:priority': '999' },
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'com.htc.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'android.intent.action.LOCKED_BOOT_COMPLETED' } },
            ],
          },
        ],
      });
    }

    // ── AlarmActivity (FullScreenIntent target) ────────────────────────────
    if (!application.activity) application.activity = [];
    const hasAlarmActivity = application.activity.some(
      (a) => a.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmActivity'
    );
    if (!hasAlarmActivity) {
      application.activity.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmActivity',
          'android:exported': 'false',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:taskAffinity': '',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleInstance',
          'android:directBootAware': 'true',
          'android:screenOrientation': 'portrait',
        },
      });
    }

    // ── AlarmForegroundService ─────────────────────────────────────────────
    if (!application.service) application.service = [];
    const hasForegroundService = application.service.some(
      (s) => s.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmForegroundService'
    );
    if (!hasForegroundService) {
      application.service.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
          'android:directBootAware': 'true',
        },
      });
    }

    // ── Permissions ────────────────────────────────────────────────────────
    const requiredPermissions = [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
      'android.permission.DISABLE_KEYGUARD',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_NOTIFICATION_POLICY',
      'android.permission.VIBRATE',
      'android.permission.REQUEST_SCHEDULE_EXACT_ALARM',
    ];

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const existingPerms = new Set(
      manifest.manifest['uses-permission'].map((p) => p.$?.['android:name'])
    );
    for (const perm of requiredPermissions) {
      if (!existingPerms.has(perm)) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return config;
  });
}

// ─── withAlarmManagerSettings ─────────────────────────────────────────────────
/**
 * Registers the local Gradle module in android/settings.gradle so Gradle
 * resolves :creatorz-alarm-manager during the build.
 */
function withAlarmManagerSettings(config) {
  return withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('creatorz-alarm-manager')) {
      config.modResults.contents =
        contents +
        [
          '',
          '// creatorz-alarm-manager — native Android alarm engine',
          "include ':creatorz-alarm-manager'",
          "project(':creatorz-alarm-manager').projectDir = new File(rootProject.projectDir, '../modules/alarm-manager/android')",
          '',
        ].join('\n');
    }
    return config;
  });
}

// ─── withAlarmManagerBuildGradle ──────────────────────────────────────────────
/**
 * Adds :creatorz-alarm-manager as an implementation dependency in
 * android/app/build.gradle so the Kotlin sources are compiled into the APK.
 */
function withAlarmManagerBuildGradle(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('creatorz-alarm-manager')) {
      config.modResults.contents = contents.replace(
        /(\bdependencies\s*\{)/,
        `$1\n    implementation project(':creatorz-alarm-manager')`
      );
    }
    return config;
  });
}

// ─── Main plugin export ───────────────────────────────────────────────────────
module.exports = function withCreatorzAlarmManager(config) {
  config = withAlarmManagerManifest(config);
  config = withAlarmManagerSettings(config);
  config = withAlarmManagerBuildGradle(config);
  return config;
};
