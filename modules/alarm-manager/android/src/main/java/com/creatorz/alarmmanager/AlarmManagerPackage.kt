package com.creatorz.alarmmanager

import expo.modules.core.BasePackage

/**
 * AlarmManagerPackage — registers the AlarmManagerModule with Expo
 * 
 * Expo SDK 53 automatically discovers and loads this via expo-modules-autolinking.
 * The package's createExportedModules() method is called during module registration.
 */
class AlarmManagerPackage : BasePackage() {
  override fun createExportedModules(context: expo.modules.core.ModuleRegistry) =
    listOf(AlarmManagerModule())
}
