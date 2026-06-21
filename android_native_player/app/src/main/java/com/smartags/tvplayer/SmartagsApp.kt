package com.smartags.tvplayer

import android.app.Application
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Process
import kotlin.system.exitProcess

class SmartagsApp : Application() {
    override fun onCreate() {
        super.onCreate()
        KioskGuardianService.ensureNotificationChannel(this)
        NativeOpsLogger.log(this, "INFO", "Application created")
        installCrashHandler()

        val prefs = KioskPrefs.prefs(this)
        val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (prefs.getBoolean(KioskGuardianService.PREFS_KIOSK_ENABLED, false) && !recoveryActive) {
            KioskPolicyManager.enforce(this)
            KioskGuardianService.start(this, "app_create")
        }
    }

    private fun installCrashHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            NativeOpsLogger.log(
                this,
                "ERROR",
                "Uncaught exception",
                org.json.JSONObject()
                    .put("thread", thread.name)
                    .put("type", throwable.javaClass.simpleName)
                    .put("message", throwable.message ?: "")
            )
            val prefs = KioskPrefs.prefs(this)
            val kioskEnabled = prefs.getBoolean(KioskGuardianService.PREFS_KIOSK_ENABLED, false)
            if (kioskEnabled) {
                val now = System.currentTimeMillis()
                val last = prefs.getLong(PREF_LAST_CRASH_AT, 0L)
                val count = if (now - last <= CRASH_WINDOW_MS) {
                    prefs.getInt(PREF_CRASH_COUNT, 0) + 1
                } else {
                    1
                }

                val editor = prefs.edit()
                    .putLong(PREF_LAST_CRASH_AT, now)
                    .putInt(PREF_CRASH_COUNT, count)

                if (count >= MAX_CRASHES_BEFORE_RECOVERY) {
                    editor.putLong(PREF_RECOVERY_MODE_UNTIL, now + RECOVERY_WINDOW_MS)
                }
                editor.apply()

                scheduleRestart()
            }

            previous?.uncaughtException(thread, throwable)
                ?: run {
                    Process.killProcess(Process.myPid())
                    exitProcess(10)
                }
        }
    }

    private fun scheduleRestart() {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, KioskRestartReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            this,
            91_120,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + 2_500L,
            pending
        )
    }

    companion object {
        private const val PREF_LAST_CRASH_AT = "kiosk_last_crash_at"
        private const val PREF_CRASH_COUNT = "kiosk_crash_count"
        private const val PREF_RECOVERY_MODE_UNTIL = "kiosk_recovery_mode_until"
        private const val CRASH_WINDOW_MS = 120_000L
        private const val RECOVERY_WINDOW_MS = 15 * 60 * 1000L
        private const val MAX_CRASHES_BEFORE_RECOVERY = 3
    }
}
