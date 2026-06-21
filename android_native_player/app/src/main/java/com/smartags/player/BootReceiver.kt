package com.smartags.tvplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = KioskPrefs.prefs(context)
        val startOnBootEnabled = prefs.getBoolean(KioskPrefs.KEY_START_ON_BOOT, true)
        val kioskEnabled = prefs.getBoolean(KioskPrefs.KEY_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (!startOnBootEnabled && !kioskEnabled) {
            return
        }

        val action = intent.action
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            if (!recoveryActive) {
                KioskPolicyManager.enforce(context)
                KioskWatchdogReceiver.schedule(context)
            }
            if (kioskEnabled && !recoveryActive) {
                KioskGuardianService.start(context, "boot")
            }
            KioskGuardianStarter.launchPlayer(context, "boot")
        }
    }
}
