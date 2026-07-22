/**
 * plugin.js — Config Plugin implementation for creatorz-alarm-manager
 *
 * RESOLUTION STRATEGY (pnpm + EAS Build + GitHub Actions compatible):
 *
 * With pnpm's strict dependency isolation, @expo/config-plugins (a transitive
 * dep of `expo`) is NOT importable via a plain require() from a local module
 * subdirectory. It lives in the pnpm store as a dep of expo, not as a hoisted
 * root dep.
 *
 * We resolve it through a chain of known locations:
 *   1. Relative to `expo` package root (most reliable on EAS Build + pnpm)
 *   2. Relative to current file's parent directories (npm/yarn hoisting)
 *   3. Plain require — works when hoisted (npm, yarn classic)
 *
 * This is identical to how @expo/prebuild-config resolves config-plugins.
 */

'use strict';

var path = require('path');

function resolveConfigPlugins() {
  var candidates = [];

  // Strategy 1: resolve via expo's known package root
  // On pnpm, @expo/config-plugins lives alongside expo in the pnpm store
  try {
    var expoRoot = path.dirname(require.resolve('expo/package.json'));
    candidates.push(expoRoot);
    candidates.push(path.join(expoRoot, 'node_modules'));
  } catch (_) {}

  // Strategy 2: walk up from this file (works with npm/yarn hoisting)
  var dir = __dirname;
  for (var i = 0; i < 6; i++) {
    candidates.push(dir);
    var parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Strategy 3: try process.cwd() — the project root on EAS Build
  candidates.push(process.cwd());
  candidates.push(path.join(process.cwd(), 'node_modules'));

  // Attempt resolution with all candidate paths
  for (var j = 0; j < candidates.length; j++) {
    try {
      var resolved = require.resolve('@expo/config-plugins', { paths: [candidates[j]] });
      return require(resolved);
    } catch (_) {}
  }

  // Final fallback: plain require (npm/yarn hoisted)
  return require('@expo/config-plugins');
}

var configPlugins = resolveConfigPlugins();
var withAndroidManifest = configPlugins.withAndroidManifest;
var withAppBuildGradle = configPlugins.withAppBuildGradle;
var withSettingsGradle = configPlugins.withSettingsGradle;

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
  return withAndroidManifest(config, function(config) {
    var manifest = config.modResults;
    var application = manifest.manifest.application && manifest.manifest.application[0];
    if (!application) return config;

    // ── AlarmReceiver ──────────────────────────────────────────────────────
    if (!application.receiver) application.receiver = [];
    var hasAlarmReceiver = application.receiver.some(function(r) {
      return r.$ && r.$['android:name'] === 'com.creatorz.alarmmanager.AlarmReceiver';
    });
    if (!hasAlarmReceiver) {
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmReceiver',
          'android:exported': 'false',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'com.creatorz.ALARM_FIRE' } }] },
        ],
      });
    }

    // ── AlarmDismissReceiver ───────────────────────────────────────────────
    var hasDismissReceiver = application.receiver.some(function(r) {
      return r.$ && r.$['android:name'] === 'com.creatorz.alarmmanager.AlarmDismissReceiver';
    });
    if (!hasDismissReceiver) {
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmDismissReceiver',
          'android:exported': 'false',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'com.creatorz.ALARM_DISMISS' } }] },
        ],
      });
    }

    // ── BootReceiver ───────────────────────────────────────────────────────
    var hasBootReceiver = application.receiver.some(function(r) {
      return r.$ && r.$['android:name'] === 'com.creatorz.alarmmanager.BootReceiver';
    });
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
    var hasAlarmActivity = application.activity.some(function(a) {
      return a.$ && a.$['android:name'] === 'com.creatorz.alarmmanager.AlarmActivity';
    });
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
    var hasForegroundService = application.service.some(function(s) {
      return s.$ && s.$['android:name'] === 'com.creatorz.alarmmanager.AlarmForegroundService';
    });
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
    var requiredPermissions = [
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

    var existingPerms = {};
    manifest.manifest['uses-permission'].forEach(function(p) {
      if (p.$ && p.$['android:name']) existingPerms[p.$['android:name']] = true;
    });

    for (var i = 0; i < requiredPermissions.length; i++) {
      if (!existingPerms[requiredPermissions[i]]) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': requiredPermissions[i] } });
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
  return withSettingsGradle(config, function(config) {
    var contents = config.modResults.contents;
    if (contents.indexOf('creatorz-alarm-manager') === -1) {
      config.modResults.contents =
        contents +
        '\n' +
        '// creatorz-alarm-manager — native Android alarm engine\n' +
        "include ':creatorz-alarm-manager'\n" +
        "project(':creatorz-alarm-manager').projectDir = new File(rootProject.projectDir, '../modules/alarm-manager/android')\n";
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
  return withAppBuildGradle(config, function(config) {
    var contents = config.modResults.contents;
    if (contents.indexOf('creatorz-alarm-manager') === -1) {
      config.modResults.contents = contents.replace(
        /(\bdependencies\s*\{)/,
        '$1\n    implementation project(\':creatorz-alarm-manager\')'
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
