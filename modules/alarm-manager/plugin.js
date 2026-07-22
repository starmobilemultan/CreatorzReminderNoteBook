/**
 * plugin.js — Config Plugin implementation for creatorz-alarm-manager
 * 
 * Expo SDK 53 compatible — injects all required native components and permissions
 * into AndroidManifest.xml during the prebuild phase.
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

// ─── withAlarmManagerManifest ────────────────────────────────────────────────
/**
 * Injects all required native Android components into AndroidManifest.xml:
 *   - AlarmReceiver        (BroadcastReceiver — fired by AlarmManager)
 *   - AlarmDismissReceiver (BroadcastReceiver — handles dismiss/snooze)
 *   - BootReceiver         (BroadcastReceiver — restores alarms after reboot)
 *   - AlarmActivity        (Activity — full-screen intent over lock screen)
 *   - AlarmForegroundService (Service — keeps CPU alive during alarm)
 *
 * Also declares all required Android permissions:
 *   - SCHEDULE_EXACT_ALARM (Android 12+)
 *   - RECEIVE_BOOT_COMPLETED
 *   - WAKE_LOCK
 */
function withAlarmManagerManifest(config) {
  return withAndroidManifest(config, function(config) {
    var manifest = config.modResults;
    var application = manifest.manifest.application && manifest.manifest.application[0];
    if (!application) return config;

    // ── Permissions ────────────────────────────────────────────────────────────
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    var permissions = manifest.manifest['uses-permission'];

    function addPermissionIfMissing(name) {
      if (!permissions.some(function(p) { return p.$['android:name'] === name; })) {
        permissions.push({ $: { 'android:name': name } });
      }
    }

    addPermissionIfMissing('android.permission.SCHEDULE_EXACT_ALARM');
    addPermissionIfMissing('android.permission.RECEIVE_BOOT_COMPLETED');
    addPermissionIfMissing('android.permission.WAKE_LOCK');
    addPermissionIfMissing('android.permission.POST_NOTIFICATIONS');
    addPermissionIfMissing('android.permission.FOREGROUND_SERVICE');
    addPermissionIfMissing('android.permission.FOREGROUND_SERVICE_SPECIAL_USE');

    // ── Receivers ──────────────────────────────────────────────────────────────
    if (!application.receiver) application.receiver = [];
    var receivers = application.receiver;

    // AlarmReceiver
    function hasReceiver(name) {
      return receivers.some(function(r) {
        return r.$['android:name'] === 'com.creatorz.alarmmanager.' + name;
      });
    }

    if (!hasReceiver('AlarmReceiver')) {
      receivers.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmReceiver',
          'android:exported': 'false'
        }
      });
    }

    // AlarmDismissReceiver
    if (!hasReceiver('AlarmDismissReceiver')) {
      receivers.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmDismissReceiver',
          'android:exported': 'false'
        }
      });
    }

    // BootReceiver (must have BOOT_COMPLETED intent-filter)
    if (!hasReceiver('BootReceiver')) {
      receivers.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.BootReceiver',
          'android:exported': 'true'
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }]
          }
        ]
      });
    }

    // ── Activities ─────────────────────────────────────────────────────────────
    if (!application.activity) application.activity = [];
    var activities = application.activity;

    function hasActivity(name) {
      return activities.some(function(a) {
        return a.$['android:name'] === 'com.creatorz.alarmmanager.' + name;
      });
    }

    // AlarmActivity (full-screen intent, shown over lock screen)
    if (!hasActivity('AlarmActivity')) {
      activities.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmActivity',
          'android:exported': 'true',
          'android:theme': '@android:style/Theme.NoTitleBar.Fullscreen'
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.creatorz.ALARM_ACTIVITY' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }]
          }
        ]
      });
    }

    // ── Services ───────────────────────────────────────────────────────────────
    if (!application.service) application.service = [];
    var services = application.service;

    function hasService(name) {
      return services.some(function(s) {
        return s.$['android:name'] === 'com.creatorz.alarmmanager.' + name;
      });
    }

    // AlarmForegroundService
    if (!hasService('AlarmForegroundService')) {
      services.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse'
        }
      });
    }

    return config;
  });
}

// ─── Module Export ────────────────────────────────────────────────────────────
module.exports = function withAlarmManager(config) {
  return withAlarmManagerManifest(config);
};
