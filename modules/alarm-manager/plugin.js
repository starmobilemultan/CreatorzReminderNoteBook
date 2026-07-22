/**
 * plugin.js — Full Config Plugin implementation for creatorz-alarm-manager
 *
 * Resolves @expo/config-plugins from the project root node_modules (standard
 * EAS Build layout) with a fallback to local resolution. This makes the plugin
 * work both in local development and in EAS Cloud Build environments.
 */

// ─── Resolve @expo/config-plugins from project root ──────────────────────────
// EAS Build installs all dependencies at the project root. The local module's
// devDependency on @expo/config-plugins is only for type hints; at runtime we
// must resolve it from wherever Expo's own prebuild installed it.
let configPlugins;
try {
  // Try resolving from the project root (standard path in EAS Build)
  configPlugins = require('@expo/config-plugins');
} catch (e1) {
  try {
    // Fallback: resolve relative to this file's location
    const path = require('path');
    const resolved = require.resolve('@expo/config-plugins', {
      paths: [
        path.resolve(__dirname, '../../node_modules'),
        path.resolve(__dirname, '../../../node_modules'),
        path.resolve(__dirname),
      ],
    });
    configPlugins = require(resolved);
  } catch (e2) {
    throw new Error(
      `[creatorz-alarm-manager] Cannot resolve @expo/config-plugins.\n` +
      `Make sure @expo/config-plugins is installed in your project root:\n` +
      `  npx expo install @expo/config-plugins\n\n` +
      `Original error: ${e2.message}`
    );
  }
}

const { withAndroidManifest, withAppBuildGradle, withSettingsGradle } = configPlugins;

// ─── withAlarmManagerManifest ────────────────────────────────────────────────
/**
 * Injects all required native Android components into AndroidManifest.xml:
 *   - AlarmReceiver        (BroadcastReceiver — fired by AlarmManager)
 *   - AlarmDismissReceiver (BroadcastReceiver — handles dismiss/snooze actions)
 *   - BootReceiver         (BroadcastReceiver — restores alarms after reboot)
 *   - AlarmActivity        (Activity — full-screen intent over lock screen)
 *   - AlarmForegroundService (Service — keeps CPU alive during alarm)
 * Also ensures all required permissions are declared.
 */
function withAlarmManagerManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // ── AlarmReceiver ──────────────────────────────────────────────────────
    const hasAlarmReceiver = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmReceiver'
    );
    if (!hasAlarmReceiver) {
      if (!application.receiver) application.receiver = [];
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
    const hasDismissReceiver = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmDismissReceiver'
    );
    if (!hasDismissReceiver) {
      if (!application.receiver) application.receiver = [];
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
    const hasBootReceiver = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.BootReceiver'
    );
    if (!hasBootReceiver) {
      if (!application.receiver) application.receiver = [];
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
    const hasAlarmActivity = (application.activity || []).some(
      (a) => a.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmActivity'
    );
    if (!hasAlarmActivity) {
      if (!application.activity) application.activity = [];
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
    const hasForegroundService = (application.service || []).some(
      (s) => s.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmForegroundService'
    );
    if (!hasForegroundService) {
      if (!application.service) application.service = [];
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

    const existingPerms = new Set(
      (manifest.manifest['uses-permission'] || []).map((p) => p.$?.['android:name'])
    );

    for (const perm of requiredPermissions) {
      if (!existingPerms.has(perm)) {
        if (!manifest.manifest['uses-permission']) {
          manifest.manifest['uses-permission'] = [];
        }
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return config;
  });
}

// ─── withAlarmManagerSettings ─────────────────────────────────────────────────
/**
 * Registers the local Gradle module in android/settings.gradle so Gradle
 * knows the :creatorz-alarm-manager project path during build.
 */
function withAlarmManagerSettings(config) {
  return withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;
    const include = [
      ``,
      `// creatorz-alarm-manager — native Android alarm engine`,
      `include ':creatorz-alarm-manager'`,
      `project(':creatorz-alarm-manager').projectDir = new File(rootProject.projectDir, '../modules/alarm-manager/android')`,
    ].join('\n');

    if (!contents.includes('creatorz-alarm-manager')) {
      config.modResults.contents = contents + include + '\n';
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
    const dep = `    implementation project(':creatorz-alarm-manager')`;

    if (!contents.includes('creatorz-alarm-manager')) {
      // Insert as first line inside the dependencies {} block
      config.modResults.contents = contents.replace(
        /(\bdependencies\s*\{)/,
        `$1\n${dep}`
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
