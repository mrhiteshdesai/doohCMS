package com.smartags.tvplayer

import android.content.Context
import android.content.Intent
import android.app.admin.DeviceAdminReceiver

class SmartagsDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        KioskPolicyManager.setBootReceiverEnabled(context, true)
        KioskGuardianStarter.launchPlayer(context, "device_admin_enabled")
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        KioskPolicyManager.setBootReceiverEnabled(context, true)
        KioskPolicyManager.enforce(context)
        KioskGuardianStarter.launchPlayer(context, "provisioning_complete")
    }
}
