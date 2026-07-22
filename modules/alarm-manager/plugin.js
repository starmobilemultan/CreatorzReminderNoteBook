// Expo Config Plugin for creatorz-alarm-manager
// Injects native Android components into AndroidManifest.xml via Expo Prebuild

const { withAndroidManifest, withAppBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

/**
 * Adds the AlarmManager module's native Android components to the app manifest:
 * - AlarmReceiver (BroadcastReceiver — receives AlarmManager broadcasts)
 * - AlarmActivity (Activity — shown as fullScreenIntent)
 * - AlarmDismissReceiver (BroadcastReceiver — handles notification dismiss)
 * - BootReceiver (BroadcastReceiver — restores alarms after reboot)
 */
function withAlarmManagerManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // ── AlarmReceiver ────────────────────────────────────────────────────────
    const alarmReceiverExists = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmReceiver'
    );
    if (!alarmReceiverExists) {
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

    // ── AlarmDismissReceiver ─────────────────────────────────────────────────
    const dismissReceiverExists = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmDismissReceiver'
    );
    if (!dismissReceiverExists) {
      if (!application.receiver) application.receiver = [];
      application.receiver.push({
        $: {
          'android:name': 'com.creatorz.alarmmanager.AlarmDismissReceiver',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.creatorz.ALARM_DISMISS' } }],
          },
        ],
      });
    }

    // ── BootReceiver ─────────────────────────────────────────────────────────
    const bootReceiverExists = (application.receiver || []).some(
      (r) => r.$?.['android:name'] === 'com.creatorz.alarmmanager.BootReceiver'
    );
    if (!bootReceiverExists) {
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
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'com.htc.intent.action.QUICKBOOT_POWERON' } },
            ],
            $: { 'android:priority': '999' },
          },
        ],
      });
    }

    // ── AlarmActivity ────────────────────────────────────────────────────────
    const alarmActivityExists = (application.activity || []).some(
      (a) => a.$?.['android:name'] === 'com.creatorz.alarmmanager.AlarmActivity'
    );
    if (!alarmActivityExists) {
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
        },
      });
    }

    // ── Ensure permissions are present ────────────────────────────────────────
    const requiredPermissions = [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.WAKE_LOCK',
      'android.permission.DISABLE_KEYGUARD',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_NOTIFICATION_POLICY',
      'android.permission.VIBRATE',
    ];

    const existingPermissions = new Set(
      (manifest.manifest['uses-permission'] || []).map((p) => p.$?.['android:name'])
    );

    for (const perm of requiredPermissions) {
      if (!existingPermissions.has(perm)) {
        if (!manifest.manifest['uses-permission']) {
          manifest.manifest['uses-permission'] = [];
        }
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return config;
  });
}

/**
 * Adds the local module to settings.gradle so Gradle knows about it.
 */
function withAlarmManagerSettings(config) {
  return withSettingsGradle(config, (config) => {
    const settingsGradle = config.modResults.contents;
    const includeStr = `include ':creatorz-alarm-manager'\nproject(':creatorz-alarm-manager').projectDir = new File(rootProject.projectDir, '../modules/alarm-manager/android')`;
    if (!settingsGradle.includes('creatorz-alarm-manager')) {
      config.modResults.contents = settingsGradle + '\n' + includeStr + '\n';
    }
    return config;
  });
}

/**
 * Adds the local module as a dependency to app/build.gradle.
 */
function withAlarmManagerBuildGradle(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    const dep = `    implementation project(':creatorz-alarm-manager')`;
    if (!buildGradle.includes('creatorz-alarm-manager')) {
      // Add just before the closing brace of dependencies {}
      config.modResults.contents = buildGradle.replace(
        /dependencies\s*\{/,
        `dependencies {\n${dep}`
      );
    }
    return config;
  });
}

module.exports = function withCreatorzAlarmManager(config) {
  config = withAlarmManagerManifest(config);
  config = withAlarmManagerSettings(config);
  config = withAlarmManagerBuildGradle(config);
  return config;
};
