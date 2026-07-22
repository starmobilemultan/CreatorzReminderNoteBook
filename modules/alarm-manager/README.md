# Creatorz Alarm Manager — Native Android Module

This local Expo module provides real Android alarm behavior for the Creatorz app.

## Architecture

```
JS Layer (notifications.native.ts + nativeAlarm.ts)
    ↓
AlarmManagerModule.kt (Expo Module — Native API bridge)
    ↓
AlarmManager.setAlarmClock() ← REAL alarm, immune to Doze/Kill/Reboot
    ↓
AlarmReceiver.kt (BroadcastReceiver — fires at exact time)
    ↓
WakeLock.acquire() ← turns screen ON
    ↓
NotificationCompat.setFullScreenIntent() ← launches AlarmActivity
    ↓
AlarmActivity.kt (sets SHOW_WHEN_LOCKED + TURN_SCREEN_ON flags)
    ↓
Main RN Activity launched → AlarmModal rendered
    ↓
AlarmManagerModule.getPendingAlarm() ← RN reads alarm data
    ↓
AlarmModal shown with full-screen UI
```

## Alarm Reliability

| Scenario                    | expo-notifications | Native AlarmManager |
|-----------------------------|-------------------|---------------------|
| App in foreground           | ✅                | ✅                  |
| App in background           | ✅ (mostly)       | ✅                  |
| App killed                  | ❌                | ✅                  |
| Screen off / Doze mode      | ❌                | ✅                  |
| Battery optimization active | ❌                | ✅ (setAlarmClock)  |
| After device reboot         | ❌                | ✅ (BootReceiver)   |
| Over lock screen            | ❌ (unreliable)   | ✅ (WakeLock flags) |

## Key Android APIs Used

- `AlarmManager.setAlarmClock()` — highest priority, Doze-exempt, shows clock icon in status bar
- `PowerManager.FULL_WAKE_LOCK + ACQUIRE_CAUSES_WAKEUP` — turns screen on
- `NotificationCompat.setFullScreenIntent()` — the REAL fullScreenIntent API
- `Activity.setShowWhenLocked()` — shows over lock screen (API 27+)
- `Activity.setTurnScreenOn()` — turns screen on (API 27+)
- `BroadcastReceiver.RECEIVE_BOOT_COMPLETED` — restores alarms after reboot

## Files

```
modules/alarm-manager/
├── android/
│   ├── build.gradle                          # Gradle build config
│   └── src/main/java/com/creatorz/alarmmanager/
│       ├── AlarmManagerModule.kt             # Expo Module API (JS bridge)
│       ├── AlarmManagerPackage.kt            # Package registration
│       ├── AlarmReceiver.kt                  # BroadcastReceiver (alarm fires here)
│       ├── AlarmActivity.kt                  # Shows over lock screen
│       ├── AlarmDismissReceiver.kt           # Handles notification dismiss
│       └── BootReceiver.kt                   # Restores alarms after reboot
├── expo-module.config.json                   # Expo module configuration
├── index.ts                                  # JS API (Android)
├── index.web.ts                              # Web stub
├── package.json                              # Module package.json
└── plugin.js                                 # Config Plugin (injects AndroidManifest)
```

## Usage

```typescript
import { scheduleNativeAlarm, getPendingAlarm } from '../modules/alarm-manager';

// Schedule an alarm
await scheduleNativeAlarm({
  id: 'alarm-reminder-123',
  triggerTimeMs: Date.now() + 60_000, // 1 minute from now
  title: '🔔 Meeting in 5 minutes',
  body: '🔴 HIGH PRIORITY\nProject standup',
  priority: 'high',
  extra: JSON.stringify({ reminderId: '123', type: 'fullscreen-reminder' }),
});

// Check for pending alarm on app launch
const pending = await getPendingAlarm();
if (pending) {
  // Show AlarmModal
}
```

## Build Requirements

- Expo SDK 53+
- Android API 24+ (minSdkVersion)
- EAS Build (for native compilation)
- Prebuild required: `npx expo prebuild` or EAS Build handles this automatically

## Permissions Required

All declared in `plugin.js` and `app.json`:
- `USE_EXACT_ALARM` — Android 13+, no user prompt needed
- `SCHEDULE_EXACT_ALARM` — Android 12, user must grant in settings
- `RECEIVE_BOOT_COMPLETED` — automatic
- `WAKE_LOCK` — automatic
- `USE_FULL_SCREEN_INTENT` — Android 14+, user must grant in settings
- `POST_NOTIFICATIONS` — Android 13+, runtime prompt required
