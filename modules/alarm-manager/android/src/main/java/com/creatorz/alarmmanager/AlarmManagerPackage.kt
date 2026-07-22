package com.creatorz.alarmmanager

import expo.modules.kotlin.modules.Module

class AlarmManagerPackage : expo.modules.kotlin.Package {
  override fun createModules(): List<Module> = listOf(AlarmManagerModule())
}
