package com.smartags.tvplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class KioskGuardianService : Service() {
    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = KioskPrefs.prefs(this)
        val kioskEnabled = prefs.getBoolean(PREFS_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (!kioskEnabled || recoveryActive) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            KioskGuardianWorker.cancel(this)
            KioskWatchdogReceiver.cancel(this)
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        KioskPolicyManager.enforce(this)
        KioskGuardianWorker.schedule(this)
        KioskWatchdogReceiver.schedule(this)
        if (!KioskRuntimeState.activityVisible) {
            KioskGuardianStarter.launchPlayer(this, reason = "service_start")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        val prefs = KioskPrefs.prefs(this)
        val kioskEnabled = prefs.getBoolean(PREFS_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (kioskEnabled && !recoveryActive) {
            KioskGuardianWorker.scheduleImmediate(this, "service_destroyed")
            KioskWatchdogReceiver.schedule(this)
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = KioskPrefs.prefs(this)
        val kioskEnabled = prefs.getBoolean(PREFS_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (kioskEnabled && !recoveryActive) {
            KioskGuardianWorker.scheduleImmediate(this, "task_removed")
            KioskWatchdogReceiver.schedule(this)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            91_110,
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("guardian_open", true)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Smartags Kiosk Active")
            .setContentText("Protecting signage session and relaunching if interrupted")
            .setSmallIcon(android.R.drawable.sym_def_app_icon)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    companion object {
        const val PREFS_NAME = "SmartagsTvPlayer"
        const val PREFS_KIOSK_ENABLED = "kiosk_enabled"
        const val PREFS_RECOVERY_MODE_UNTIL = "kiosk_recovery_mode_until"
        private const val CHANNEL_ID = "smartags_kiosk_guardian"
        private const val NOTIFICATION_ID = 91_109

        fun start(context: Context, reason: String = "manual") {
            val prefs = KioskPrefs.prefs(context)
            if (prefs.getLong(PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()) {
                stop(context)
                return
            }
            val intent = Intent(context, KioskGuardianService::class.java).putExtra("reason", reason)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            KioskGuardianWorker.schedule(context)
            KioskWatchdogReceiver.schedule(context)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, KioskGuardianService::class.java))
            KioskGuardianWorker.cancel(context)
            KioskWatchdogReceiver.cancel(context)
        }

        fun ensureNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Smartags Kiosk Guardian",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the signage kiosk process alive"
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }
    }
}

class KioskGuardianWorker(
    appContext: Context,
    workerParams: androidx.work.WorkerParameters
) : androidx.work.CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val prefs = KioskPrefs.prefs(applicationContext)
        val kioskEnabled = prefs.getBoolean(KioskGuardianService.PREFS_KIOSK_ENABLED, false)
        val recoveryActive = prefs.getLong(KioskGuardianService.PREFS_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()
        if (!kioskEnabled || recoveryActive) {
            cancel(applicationContext)
            return Result.success()
        }
        KioskPolicyManager.enforce(applicationContext)
        if (!KioskRuntimeState.activityVisible) {
            KioskGuardianStarter.launchPlayer(applicationContext, reason = inputData.getString("reason") ?: "worker")
        }
        return Result.success()
    }

    companion object {
        private const val UNIQUE_PERIODIC_NAME = "smartags_kiosk_guardian_periodic"
        private const val UNIQUE_IMMEDIATE_NAME = "smartags_kiosk_guardian_immediate"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<KioskGuardianWorker>(15, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }

        fun scheduleImmediate(context: Context, reason: String) {
            val request = OneTimeWorkRequestBuilder<KioskGuardianWorker>()
                .setInputData(androidx.work.workDataOf("reason" to reason))
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_IMMEDIATE_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_IMMEDIATE_NAME)
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_NAME)
        }
    }
}

object KioskGuardianStarter {
    fun launchPlayer(context: Context, reason: String) {
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            putExtra("guardian_reason", reason)
        }
        runCatching { context.startActivity(launch) }
    }
}

object KioskRuntimeState {
    @Volatile
    var activityVisible: Boolean = false
}
