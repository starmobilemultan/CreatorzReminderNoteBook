package com.creatorz.alarmmanager

import expo.modules.kotlin.modules.Module

/**
 * AlarmManagerPackage — Expo Modules Kotlin Package registration
 *
 * This class implements expo.modules.kotlin.Package and exposes all modules
 * that this package provides. Expo's module autolinker discovers this class
 * automatically and calls createModules() at app initialization.
 *
 * This is the standard pattern for all Expo SDK 53 local modules.
 */
class AlarmManagerPackage : expo.modules.kotlin.Package {
  override fun createModules(): List<Module> = listOf(AlarmManagerModule())
}
