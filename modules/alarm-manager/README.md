# Creatorz Alarm Manager

Expo SDK 53 local native module for real Android alarm behavior.

## Structure (Expo SDK 53)

```
modules/alarm-manager/
├── android/
│   ├── build.gradle          # expo-module-gradle-plugin (links :expo-modules-core as project)
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/com/creatorz/alarmmanager/
│           ├── AlarmManagerModule.kt   # Expo Module (Kotlin API)
│           ├── AlarmReceiver.kt
│           ├── AlarmActivity.kt
│           ├── AlarmForegroundService.kt
│           ├── AlarmDismissReceiver.kt
│           └── BootReceiver.kt
├── app.plugin.js               # Config plugin entry (app.json)
├── plugin.js                   # Manifest injection (receivers, services, permissions)
├── expo-module.config.json     # Autolinking: com.creatorz.alarmmanager.AlarmManagerModule
├── index.ts                    # JS bridge (requireNativeModule)
├── index.web.ts                # Web stubs
└── package.json
```

## Linking

The module is linked via root `package.json`:

```json
"creatorz-alarm-manager": "file:./modules/alarm-manager"
```

And registered as a config plugin in `app.json`:

```json
"plugins": ["./modules/alarm-manager"]
```

## EAS Build

Uses `expo-module-gradle-plugin` — resolves `expo-modules-core` from the Gradle project `:expo-modules-core` (not Maven). Compatible with EAS Cloud + pnpm.
