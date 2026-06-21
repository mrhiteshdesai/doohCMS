package com.smartags.tvplayer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build

object KioskPolicyManager {
    fun isDeviceOwner(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(context.packageName)
    }

    fun isRecoveryModeActive(context: Context): Boolean =
        KioskPrefs.prefs(context).getLong(KioskPrefs.KEY_RECOVERY_MODE_UNTIL, 0L) > System.currentTimeMillis()

    fun setBootReceiverEnabled(context: Context, enabled: Boolean) {
        val component = ComponentName(context, BootReceiver::class.java)
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        context.packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
    }

    fun enforce(context: Context): Boolean {
        if (!isDeviceOwner(context)) return false

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, SmartagsDeviceAdminReceiver::class.java)
        dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
        }
        setAsHomeLauncher(context, dpm, admin, true)
        setKioskLauncherEnabled(context, true)
        runCatching { dpm.setStatusBarDisabled(admin, true) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            runCatching { dpm.setKeyguardDisabled(admin, true) }
        }
        KioskPrefs.prefs(context).edit().putBoolean(KioskPrefs.KEY_START_ON_BOOT, true).apply()
        setBootReceiverEnabled(context, true)
        return true
    }

    fun relax(context: Context) {
        runCatching {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, SmartagsDeviceAdminReceiver::class.java)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                setAsHomeLauncher(context, dpm, admin, false)
                setKioskLauncherEnabled(context, false)
                dpm.setLockTaskPackages(admin, emptyArray())
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    dpm.setLockTaskFeatures(
                        admin,
                        DevicePolicyManager.LOCK_TASK_FEATURE_HOME or
                            DevicePolicyManager.LOCK_TASK_FEATURE_OVERVIEW or
                            DevicePolicyManager.LOCK_TASK_FEATURE_NOTIFICATIONS or
                            DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO or
                            DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS
                    )
                }
                runCatching { dpm.setStatusBarDisabled(admin, false) }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    runCatching { dpm.setKeyguardDisabled(admin, false) }
                }
            }
        }
    }

    fun clearHomeLauncherLock(context: Context) {
        runCatching {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, SmartagsDeviceAdminReceiver::class.java)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                dpm.clearPackagePersistentPreferredActivities(admin, context.packageName)
                dpm.setLockTaskPackages(admin, emptyArray())
            }
        }
        setKioskLauncherEnabled(context, false)
    }

    private fun setKioskLauncherEnabled(context: Context, enabled: Boolean) {
        val component = ComponentName(context, "${context.packageName}.KioskLauncher")
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        context.packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
    }

    private fun setAsHomeLauncher(
        context: Context,
        dpm: DevicePolicyManager,
        admin: ComponentName,
        enabled: Boolean
    ) {
        if (enabled) {
            val filter = IntentFilter(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addCategory(Intent.CATEGORY_DEFAULT)
            }
            val activity = ComponentName(context, "${context.packageName}.KioskLauncher")
            dpm.addPersistentPreferredActivity(admin, filter, activity)
        } else {
            dpm.clearPackagePersistentPreferredActivities(admin, context.packageName)
        }
    }
}
