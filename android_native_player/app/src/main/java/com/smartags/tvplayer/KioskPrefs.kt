package com.smartags.tvplayer

import android.content.Context
import android.content.SharedPreferences
import android.os.Build

object KioskPrefs {
    const val PREFS_NAME = "SmartagsTvPlayer"
    const val KEY_API_BASE = "api_base"
    const val KEY_SCREEN_TOKEN = "screen_token"
    const val KEY_SCREEN_ID = "screen_id"
    const val KEY_PAIRING_CODE = "pairing_code"
    const val KEY_START_ON_BOOT = "start_on_boot"
    const val KEY_KIOSK_ENABLED = "kiosk_enabled"
    const val KEY_TECH_PIN = "tech_pin"
    const val KEY_TECH_UNLOCKED_UNTIL = "tech_unlocked_until"
    const val KEY_RECOVERY_MODE_UNTIL = "kiosk_recovery_mode_until"
    const val KEY_UNLOCK_FAILURES = "tech_unlock_failures"
    const val KEY_UNLOCK_LOCKED_UNTIL = "tech_unlock_locked_until"
    const val KEY_POP_QUEUE = "pop_queue"
    const val KEY_PENDING_OTA_COMMAND_ID = "pending_ota_command_id"
    const val KEY_PENDING_OTA_TARGET_VERSION = "pending_ota_target_version"
    const val KEY_PENDING_OTA_TARGET_CODE = "pending_ota_target_code"

    fun prefs(context: Context): SharedPreferences =
        storageContext(context).getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun storageContext(context: Context): Context {
        val appContext = context.applicationContext
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return appContext
        }

        val deviceContext = appContext.createDeviceProtectedStorageContext()
        runCatching {
            deviceContext.moveSharedPreferencesFrom(appContext, PREFS_NAME)
        }
        return deviceContext
    }
}
