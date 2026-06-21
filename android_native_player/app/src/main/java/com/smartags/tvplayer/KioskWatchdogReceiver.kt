package com.smartags.tvplayer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock

class KioskWatchdogReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = KioskPrefs.prefs(context)
        val kioskEnabled = prefs.getBoolean(KioskPrefs.KEY_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (!kioskEnabled || recoveryActive) {
            cancel(context)
            return
        }

        schedule(context)
        KioskPolicyManager.enforce(context)
        KioskGuardianService.start(context, "alarm_watchdog")
        KioskGuardianStarter.launchPlayer(context, "alarm_watchdog")
    }

    companion object {
        private const val REQUEST_CODE = 91042
        private const val INTERVAL_MS = 60_000L

        fun schedule(context: Context) {
            val prefs = KioskPrefs.prefs(context)
            val kioskEnabled = prefs.getBoolean(KioskPrefs.KEY_KIOSK_ENABLED, false)
            val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
            if (!kioskEnabled || recoveryActive) return

            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = pendingIntent(context)
            val triggerAt = SystemClock.elapsedRealtime() + INTERVAL_MS
            alarm.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
        }

        fun cancel(context: Context) {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarm.cancel(pendingIntent(context))
        }

        private fun pendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, KioskWatchdogReceiver::class.java)
            return PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
