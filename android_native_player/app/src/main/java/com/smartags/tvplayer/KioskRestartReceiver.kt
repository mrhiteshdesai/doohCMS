package com.smartags.tvplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class KioskRestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = KioskPrefs.prefs(context)
        val kioskEnabled = prefs.getBoolean(KioskGuardianService.PREFS_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (!kioskEnabled) return

        if (!recoveryActive) {
            KioskPolicyManager.enforce(context)
            KioskGuardianService.start(context, "restart_receiver")
        }
        KioskGuardianStarter.launchPlayer(context, "restart_receiver")
    }
}
