package com.smartags.tvplayer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    private val prefsApiBase = KioskPrefs.KEY_API_BASE
    private val prefsToken = KioskPrefs.KEY_SCREEN_TOKEN
    private val prefsLastScreenId = KioskPrefs.KEY_SCREEN_ID
    private val prefsLastPairingCode = KioskPrefs.KEY_PAIRING_CODE
    private val prefsStartOnBoot = KioskPrefs.KEY_START_ON_BOOT
    private val prefsKioskEnabled = KioskPrefs.KEY_KIOSK_ENABLED
    private val prefsTechPin = KioskPrefs.KEY_TECH_PIN
    private val prefsTechUnlockedUntil = KioskPrefs.KEY_TECH_UNLOCKED_UNTIL
    private val prefsRecoveryModeUntil = KioskPrefs.KEY_RECOVERY_MODE_UNTIL
    private val prefsUnlockFailures = KioskPrefs.KEY_UNLOCK_FAILURES
    private val prefsUnlockLockedUntil = KioskPrefs.KEY_UNLOCK_LOCKED_UNTIL

    private lateinit var playbackStage: FrameLayout
    private lateinit var overlay: View
    private lateinit var titleText: TextView
    private lateinit var statusText: TextView
    private lateinit var apiBaseInput: EditText
    private lateinit var saveApiButton: Button
    private lateinit var pairingCodeText: TextView
    private lateinit var progress: ProgressBar

    private lateinit var settingsContainer: LinearLayout
    private lateinit var settingsDeviceOwner: TextView
    private lateinit var settingsAccessStatus: TextView
    private lateinit var settingsTechPin: EditText
    private lateinit var settingsUnlock: Button
    private lateinit var settingsChangePin: Button
    private lateinit var settingsStartOnBoot: SwitchCompat
    private lateinit var settingsKiosk: SwitchCompat
    private lateinit var settingsChangeApi: Button
    private lateinit var settingsClearCache: Button
    private lateinit var settingsRepair: Button
    private lateinit var settingsProvisioning: Button
    private lateinit var settingsRecovery: Button
    private lateinit var settingsExit: Button
    private lateinit var offlineManager: OfflineMediaManager

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private var heartbeatJob: Job? = null
    private var contentRefreshJob: Job? = null
    private var popFlushJob: Job? = null
    private var reliabilityJob: Job? = null

    private var apiBase: String? = null
    private var token: String? = null

    private var currentPlaylistId: String? = null
    private var currentPlaylistFingerprint: String? = null
    private var currentScreenContentJson: JSONObject? = null
    private var lastRecoveryAttemptAt: Long = 0L
    private var widgetRuntimeEnv: WidgetRuntimeEnv = WidgetRuntimeEnv()
    private var screenLocation: ScreenLocationModel? = null
    private val currentZoneMedia: MutableMap<String, String?> = mutableMapOf()
    private val zoneSessions: MutableMap<String, ZonePlaybackSession> = linkedMapOf()
    private val commandUpdates: MutableList<JSONObject> = mutableListOf()
    private var lastBackPressedAt: Long = 0
    private var recoveryTapCount: Int = 0
    private var lastRecoveryTapAt: Long = 0
    private val prefsPopQueue = KioskPrefs.KEY_POP_QUEUE
    private val popQueue: MutableList<JSONObject> = mutableListOf()
    private val telemetry by lazy { NativeTelemetryStore(this) }
    private val prefsLastKnownGoodFingerprint = "last_known_good_fingerprint"
    private val prefsQuarantinedMedia = "quarantined_media"
    private val appVersion: String by lazy {
        runCatching {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
        }.getOrDefault("unknown")
    }

    private fun prefs() = KioskPrefs.prefs(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playbackStage = findViewById(R.id.playback_stage)
        overlay = findViewById(R.id.overlay_container)
        titleText = findViewById(R.id.title_text)
        statusText = findViewById(R.id.status_text)
        apiBaseInput = findViewById(R.id.api_base_input)
        saveApiButton = findViewById(R.id.save_api_button)
        pairingCodeText = findViewById(R.id.pairing_code_text)
        progress = findViewById(R.id.progress)

        settingsContainer = findViewById(R.id.settings_container)
        settingsDeviceOwner = findViewById(R.id.settings_device_owner)
        settingsAccessStatus = findViewById(R.id.settings_access_status)
        settingsTechPin = findViewById(R.id.settings_tech_pin)
        settingsUnlock = findViewById(R.id.settings_unlock)
        settingsChangePin = findViewById(R.id.settings_change_pin)
        settingsStartOnBoot = findViewById(R.id.settings_start_on_boot)
        settingsKiosk = findViewById(R.id.settings_kiosk)
        settingsChangeApi = findViewById(R.id.settings_change_api)
        settingsClearCache = findViewById(R.id.settings_clear_cache)
        settingsRepair = findViewById(R.id.settings_repair)
        settingsProvisioning = findViewById(R.id.settings_provisioning)
        settingsRecovery = findViewById(R.id.settings_recovery)
        settingsExit = findViewById(R.id.settings_exit)
        offlineManager = OfflineMediaManager(this, http) { snapshot ->
            telemetry.updateDownloadSnapshot(snapshot)
        }

        val prefs = prefs()
        apiBase = prefs.getString(prefsApiBase, null)
        token = prefs.getString(prefsToken, null)
        loadPopQueue(prefs)
        ensureTechPin(prefs)
        cleanupQuarantinedMedia()

        titleText.text = "Smartags TV Player"
        apiBaseInput.setText(apiBase ?: "https://dooh.brandeagles.com/api")
        pairingCodeText.text = "Pairing Code: -"
        telemetry.markPlaybackState("STARTING")
        NativeOpsLogger.log(this, "INFO", "MainActivity created")

        saveApiButton.setOnClickListener {
            val base = normalizeApiBase(apiBaseInput.text?.toString())
            if (base == null) {
                Toast.makeText(this, "Invalid API base URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            apiBase = base
            prefs.edit().putString(prefsApiBase, base).apply()
            startOrPair(forceRepair = true)
        }

        settingsDeviceOwner.text = "Device Owner: ${if (isDeviceOwner()) "YES" else "NO"}"
        updateSettingsAccessUi()

        val startOnBootEnabled = prefs.getBoolean(prefsStartOnBoot, true)
        settingsStartOnBoot.isChecked = startOnBootEnabled
        setBootReceiverEnabled(startOnBootEnabled)

        val kioskEnabled = prefs.getBoolean(prefsKioskEnabled, false)
        settingsKiosk.isChecked = kioskEnabled
        if (kioskEnabled && !isRecoveryModeActive()) {
            applyKioskMode(true)
        } else {
            KioskGuardianService.stop(this)
            updateSettingsAccessUi()
        }

        settingsStartOnBoot.setOnCheckedChangeListener { _, isChecked ->
            if (!checkSettingsAccessOrToast()) {
                settingsStartOnBoot.isChecked = !isChecked
                return@setOnCheckedChangeListener
            }
            prefs.edit().putBoolean(prefsStartOnBoot, isChecked).apply()
            setBootReceiverEnabled(isChecked)
        }

        settingsKiosk.setOnCheckedChangeListener { _, isChecked ->
            if (!checkSettingsAccessOrToast()) {
                settingsKiosk.isChecked = !isChecked
                return@setOnCheckedChangeListener
            }
            applyKioskMode(isChecked)
        }

        settingsChangeApi.setOnClickListener {
            if (!checkSettingsAccessOrToast()) return@setOnClickListener
            settingsContainer.visibility = View.GONE
            showOverlay("Enter API base URL to continue", showPairing = true)
        }

        settingsClearCache.setOnClickListener {
            if (!checkSettingsAccessOrToast()) return@setOnClickListener
            appScope.launch {
                clearLocalMedia()
                Toast.makeText(this@MainActivity, "Offline cache cleared", Toast.LENGTH_SHORT).show()
                fetchAndPlay(force = true)
            }
        }

        settingsRepair.setOnClickListener {
            if (!checkSettingsAccessOrToast()) return@setOnClickListener
            settingsContainer.visibility = View.GONE
            rePair()
        }

        settingsProvisioning.setOnClickListener {
            showDeviceOwnerSetup()
        }

        settingsRecovery.setOnClickListener {
            showRecovery()
        }

        settingsUnlock.setOnClickListener {
            val prefsNow = prefs()
            val lockedUntil = prefsNow.getLong(prefsUnlockLockedUntil, 0L)
            if (lockedUntil > System.currentTimeMillis()) {
                val seconds = ((lockedUntil - System.currentTimeMillis()) / 1000L).coerceAtLeast(1L)
                Toast.makeText(this, "Unlock temporarily blocked for ${seconds}s", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val pin = prefsNow.getString(prefsTechPin, null).orEmpty()
            val entered = settingsTechPin.text?.toString()?.trim().orEmpty()
            if (pin.isBlank()) {
                Toast.makeText(this, "Set a technician PIN first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (entered.isBlank()) {
                Toast.makeText(this, "Enter technician PIN", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (entered != pin) {
                registerUnlockFailure(prefsNow)
                Toast.makeText(this, "Invalid PIN", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            clearUnlockFailures(prefsNow)
            val until = System.currentTimeMillis() + 10 * 60 * 1000L
            prefsNow.edit().putLong(prefsTechUnlockedUntil, until).apply()
            settingsTechPin.setText("")
            updateSettingsAccessUi()
            Toast.makeText(this, "Settings unlocked", Toast.LENGTH_SHORT).show()
        }

        settingsChangePin.setOnClickListener {
            val prefsNow = prefs()
            val kioskEnabled = prefsNow.getBoolean(prefsKioskEnabled, false)
            if (kioskEnabled && hasConfiguredTechPin() && !isSettingsUnlocked()) {
                Toast.makeText(this, "Unlock settings first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val entered = settingsTechPin.text?.toString()?.trim().orEmpty()
            if (entered.length < 6 || !entered.all(Char::isDigit)) {
                Toast.makeText(this, "PIN must be 6+ digits", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            prefsNow.edit().putString(prefsTechPin, entered).apply()
            settingsTechPin.setText("")
            clearUnlockFailures(prefsNow)
            updateSettingsAccessUi()
            Toast.makeText(this, "Technician PIN updated", Toast.LENGTH_SHORT).show()
        }

        settingsExit.setOnClickListener {
            if (!checkSettingsAccessOrToast()) return@setOnClickListener
            settingsKiosk.isChecked = false
            applyKioskMode(false)
            finish()
        }

        hideSystemUI()
        startReliabilityMonitor()
        appScope.launch { performStartupSequence(forceRepair = false) }
        if (isRecoveryModeActive()) {
            Toast.makeText(this, "Recovery mode active. Kiosk enforcement is temporarily relaxed.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        KioskRuntimeState.activityVisible = false
        heartbeatJob?.cancel()
        contentRefreshJob?.cancel()
        popFlushJob?.cancel()
        reliabilityJob?.cancel()
        clearStage()
    }

    override fun onStart() {
        super.onStart()
        KioskRuntimeState.activityVisible = true
    }

    override fun onResume() {
        super.onResume()
        KioskRuntimeState.activityVisible = true
        hideSystemUI()
        val kioskEnabled = prefs().getBoolean(prefsKioskEnabled, false)
        if (kioskEnabled && !isRecoveryModeActive()) {
            KioskGuardianService.start(this, "resume")
            applyKioskMode(true)
        } else if (!kioskEnabled) {
            applyKioskMode(false)
        } else {
            KioskGuardianService.stop(this)
        }
        updateSettingsAccessUi()
    }

    override fun onPause() {
        KioskRuntimeState.activityVisible = false
        super.onPause()
    }

    override fun onStop() {
        KioskRuntimeState.activityVisible = false
        if (prefs().getBoolean(prefsKioskEnabled, false) && !isRecoveryModeActive()) {
            KioskGuardianWorker.scheduleImmediate(this, "activity_stopped")
        }
        super.onStop()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    override fun onBackPressed() {
        if (settingsContainer.visibility == View.VISIBLE) {
            settingsContainer.visibility = View.GONE
            hideSystemUI()
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastBackPressedAt <= 450) {
            toggleSettings()
            lastBackPressedAt = 0
            return
        }
        lastBackPressedAt = now
        Toast.makeText(this, "Press back again for menu", Toast.LENGTH_SHORT).show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_F1) {
            registerRecoveryTap()
            toggleSettings()
            return true
        }
        if (event != null && event.isCtrlPressed && keyCode == KeyEvent.KEYCODE_M) {
            registerRecoveryTap()
            toggleSettings()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun toggleSettings() {
        settingsDeviceOwner.text = "Device Owner: ${if (isDeviceOwner()) "YES" else "NO"}"
        updateSettingsAccessUi()
        settingsContainer.visibility = if (settingsContainer.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        hideSystemUI()
    }

    private fun ensureTechPin(prefs: android.content.SharedPreferences) {
        if (prefs.getString(prefsTechPin, null) == "1234") {
            prefs.edit().remove(prefsTechPin).apply()
        }
    }

    private fun hasConfiguredTechPin(): Boolean =
        !prefs().getString(prefsTechPin, null).isNullOrBlank()

    private fun isStrongTechPin(): Boolean =
        prefs().getString(prefsTechPin, null).orEmpty().let { it.length >= 6 && it.all(Char::isDigit) }

    private fun isSettingsUnlocked(): Boolean {
        val prefs = prefs()
        val until = prefs.getLong(prefsTechUnlockedUntil, 0L)
        return System.currentTimeMillis() < until
    }

    private fun isRecoveryModeActive(): Boolean {
        val prefs = prefs()
        return prefs.getLong(prefsRecoveryModeUntil, 0L) > System.currentTimeMillis()
    }

    private fun enterRecoveryMode(minutes: Long = 15) {
        val prefs = prefs()
        prefs.edit().putLong(prefsRecoveryModeUntil, System.currentTimeMillis() + minutes * 60_000L).apply()
        KioskGuardianService.stop(this)
        KioskWatchdogReceiver.cancel(this)
        try {
            stopLockTask()
        } catch (_: Exception) {
        }
        updateSettingsAccessUi()
    }

    private fun clearRecoveryMode() {
        prefs().edit().remove(prefsRecoveryModeUntil).apply()
        updateSettingsAccessUi()
    }

    private fun registerUnlockFailure(prefs: android.content.SharedPreferences) {
        val failures = prefs.getInt(prefsUnlockFailures, 0) + 1
        val editor = prefs.edit().putInt(prefsUnlockFailures, failures)
        if (failures >= 5) {
            editor.putLong(prefsUnlockLockedUntil, System.currentTimeMillis() + 60_000L)
            editor.putInt(prefsUnlockFailures, 0)
        }
        editor.apply()
    }

    private fun clearUnlockFailures(prefs: android.content.SharedPreferences) {
        prefs.edit().remove(prefsUnlockFailures).remove(prefsUnlockLockedUntil).apply()
    }

    private fun updateSettingsAccessUi() {
        val kioskEnabled = prefs().getBoolean(prefsKioskEnabled, false)
        val unlocked = isSettingsUnlocked()
        val recoveryActive = isRecoveryModeActive()
        val accessText = when {
            recoveryActive -> "Access: Recovery Window"
            !kioskEnabled -> "Access: Open"
            unlocked -> "Access: Unlocked"
            !hasConfiguredTechPin() -> "Access: Locked (set technician PIN)"
            !isStrongTechPin() -> "Access: Locked (PIN must be 6+ digits)"
            else -> "Access: Locked"
        }
        settingsAccessStatus.text = accessText

        val allowControls = recoveryActive || !kioskEnabled || unlocked
        settingsStartOnBoot.isEnabled = allowControls
        settingsKiosk.isEnabled = allowControls
        settingsChangeApi.isEnabled = allowControls
        settingsClearCache.isEnabled = allowControls
        settingsRepair.isEnabled = allowControls
        settingsRecovery.isEnabled = allowControls
        settingsExit.isEnabled = allowControls
        settingsChangePin.isEnabled = !kioskEnabled || unlocked || !hasConfiguredTechPin()
    }

    private fun checkSettingsAccessOrToast(allowWhenNotDeviceOwner: Boolean = false): Boolean {
        val kioskEnabled = prefs().getBoolean(prefsKioskEnabled, false)
        if (isRecoveryModeActive()) return true
        if (!kioskEnabled) return true
        if (allowWhenNotDeviceOwner && !isDeviceOwner()) return true
        if (isSettingsUnlocked()) return true
        Toast.makeText(this, "Enter technician PIN to change settings", Toast.LENGTH_SHORT).show()
        return false
    }

    private fun registerRecoveryTap() {
        val now = System.currentTimeMillis()
        if (now - lastRecoveryTapAt > 2000) {
            recoveryTapCount = 0
        }
        lastRecoveryTapAt = now
        recoveryTapCount++
        if (recoveryTapCount >= 7) {
            recoveryTapCount = 0
            showRecovery()
        }
    }

    private fun showDeviceOwnerSetup() {
        val cmd = "adb shell dpm set-device-owner $packageName/.SmartagsDeviceAdminReceiver"
        val message = buildString {
            append("Device Owner enables a hardened kiosk:\n\n")
            append("1) Factory reset the device (required)\n")
            append("2) Enable USB debugging\n")
            append("3) Connect ADB\n")
            append("4) Run:\n\n")
            append(cmd)
            append("\n\n")
            append("After provisioning, the app auto-restores boot launch and kiosk policy enforcement.\n\n")
            append("Current status: ")
            append(if (isDeviceOwner()) "Device Owner is ACTIVE" else "Device Owner is NOT active")
        }
        AlertDialog.Builder(this)
            .setTitle("Device Owner Setup")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showRecovery() {
        val isOwner = isDeviceOwner()
        val prefs = prefs()
        val options = buildList {
            add(if (isRecoveryModeActive()) "Clear recovery mode" else "Enter 15-minute recovery mode")
            add("Disable kiosk mode")
            add("Clear pairing and re-pair")
            add("Reset technician unlock")
            if (isOwner) add("Clear HOME launcher lock")
        }
        AlertDialog.Builder(this)
            .setTitle("Recovery")
            .setItems(options.toTypedArray()) { _, which ->
                when (options[which]) {
                    "Enter 15-minute recovery mode" -> {
                        enterRecoveryMode(15)
                        Toast.makeText(this, "Recovery mode enabled for 15 minutes", Toast.LENGTH_SHORT).show()
                    }
                    "Clear recovery mode" -> {
                        clearRecoveryMode()
                        Toast.makeText(this, "Recovery mode cleared", Toast.LENGTH_SHORT).show()
                    }
                    "Disable kiosk mode" -> {
                        settingsKiosk.isChecked = false
                        applyKioskMode(false)
                        updateSettingsAccessUi()
                    }
                    "Clear pairing and re-pair" -> {
                        rePair()
                    }
                    "Reset technician unlock" -> {
                        prefs.edit()
                            .remove(prefsTechUnlockedUntil)
                            .remove(prefsUnlockFailures)
                            .remove(prefsUnlockLockedUntil)
                            .apply()
                        updateSettingsAccessUi()
                    }
                    "Clear HOME launcher lock" -> {
                        KioskPolicyManager.clearHomeLauncherLock(this)
                        updateSettingsAccessUi()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun startOrPair(forceRepair: Boolean) {
        val base = apiBase ?: normalizeApiBase(apiBaseInput.text?.toString())
        if (base == null) {
            showOverlay("Enter API base URL to continue", showPairing = true)
            return
        }

        apiBase = base
        val prefs = prefs()
        prefs.edit().putString(prefsApiBase, base).apply()

        val existingToken = if (forceRepair) null else prefs.getString(prefsToken, null)
        if (!existingToken.isNullOrBlank()) {
            token = existingToken
            appScope.launch { bootstrapWithToken(existingToken) }
        } else {
            token = null
            appScope.launch { pairDevice() }
        }
    }

    private suspend fun performStartupSequence(forceRepair: Boolean) {
        NativeOpsLogger.log(this, "INFO", "Running startup health checks")
        offlineManager.runStartupHealthCheck()
        restoreLastKnownGoodContent("startup", showStatus = false)
        startOrPair(forceRepair)
    }

    private suspend fun bootstrapWithToken(existingToken: String) {
        token = existingToken
        showOverlay("Connecting...", showPairing = false)
        val ok = fetchAndPlay(force = true)
        if (!ok) {
            prefs().edit().remove(prefsToken).apply()
            token = null
            pairDevice()
        }
    }

    private suspend fun pairDevice() {
        clearStage()
        telemetry.markPlaybackState("PAIRING")
        showOverlay("Registering device...", showPairing = false)
        val base = apiBase ?: return
        NativeOpsLogger.log(this, "INFO", "Starting device pairing", JSONObject().put("apiBase", base))

        val registerRes = httpPostJson("$base/player/register", JSONObject())
        if (registerRes == null) {
            NativeOpsLogger.log(this, "ERROR", "Device registration failed")
            showOverlay("Failed to register. Check network/API URL.", showPairing = true)
            return
        }

        val code = registerRes.optString("code", "")
        val screenId = registerRes.optString("screenId", "")
        if (code.isBlank()) {
            NativeOpsLogger.log(this, "ERROR", "Register returned invalid pairing code")
            showOverlay("Register returned invalid pairing code.", showPairing = true)
            return
        }

        val prefs = prefs()
        prefs.edit().putString(prefsLastPairingCode, code).putString(prefsLastScreenId, screenId).apply()
        pairingCodeText.text = "Pairing Code: $code"
        showOverlay("Waiting for pairing in dashboard...", showPairing = false)

        while (appScope.isActive) {
            val statusRes = httpGetJson("$base/player/status/$code", authToken = null)
            if (statusRes != null && statusRes.optString("status") == "PAIRED") {
                val newToken = statusRes.optString("token", "")
                if (newToken.isNotBlank()) {
                    NativeOpsLogger.log(this, "INFO", "Device paired successfully", JSONObject().put("screenId", screenId))
                    prefs.edit().putString(prefsToken, newToken).apply()
                    token = newToken
                    showOverlay("Paired. Syncing content...", showPairing = false)
                    fetchAndPlay(force = true)
                    return
                }
            }
            delay(3000)
        }
    }

    private suspend fun fetchAndPlay(force: Boolean = false, allowLastKnownGoodFallback: Boolean = true): Boolean {
        val base = apiBase ?: return false
        val auth = token ?: return false
        telemetry.markPlaybackState("SYNCING")

        val remoteContentJson = httpGetJson("$base/player/content", authToken = auth)
        if (remoteContentJson?.optString("message")?.contains("unauthorized", true) == true) return false

        val usingOfflineManifest = remoteContentJson == null
        val contentJson: JSONObject
        if (remoteContentJson != null) {
            offlineManager.rememberScreenContent(remoteContentJson)
            contentJson = remoteContentJson
            NativeOpsLogger.log(this, "INFO", "Fetched remote playlist manifest")
        } else {
            val cachedContentJson = offlineManager.loadRememberedScreenContent()
                ?: if (allowLastKnownGoodFallback) offlineManager.loadLastKnownGoodScreenContent() else null
                ?: return false
            contentJson = JSONObject(cachedContentJson.toString())
            NativeOpsLogger.log(this, "WARN", "Using cached playlist manifest")
        }

        currentScreenContentJson = JSONObject(contentJson.toString())
        val screenContent = parseScreenContent(contentJson, ::absoluteMediaUrl)
        val playlist = screenContent.playlist
        widgetRuntimeEnv = WidgetRuntimeEnv(
            weatherApiKey = screenContent.weatherApiKey,
            tenantNewsFeedUrls = screenContent.newsFeedUrls
        )
        screenLocation = screenContent.location

        if (playlist == null || playlist.zones.isEmpty()) {
            if (allowLastKnownGoodFallback && restoreLastKnownGoodContent("empty_or_invalid_playlist", showStatus = true)) {
                return true
            }
            currentPlaylistId = null
            currentPlaylistFingerprint = null
            telemetry.markPlaybackState("WAITING_FOR_CONTENT")
            telemetry.clearPlaybackErrors()
            clearStage()
            showOverlay("Waiting for content to be published...", showPairing = false)
            startHeartbeat()
            startContentRefresh()
            return true
        }

        val fingerprint = screenContentFingerprint(screenContent)
        currentPlaylistId = playlist.id

        if (!force && fingerprint == currentPlaylistFingerprint) {
            hideOverlay()
            telemetry.clearPlaybackErrors()
            startHeartbeat()
            startContentRefresh()
            return true
        }

        showOverlay(if (usingOfflineManifest) "Offline mode: using cached content..." else "Syncing playlist...", showPairing = false)
        val mediaToPrefetch = playlist.zones.flatMap { zone -> zone.items.mapNotNull { it.media } }.distinctBy { it.id }
        if (!usingOfflineManifest) {
            offlineManager.syncAssets(mediaToPrefetch)
        }

        currentPlaylistFingerprint = fingerprint
        playbackStage.post {
            renderPlaylist(playlist)
            hideOverlay()
        }
        startHeartbeat()
        startContentRefresh()
        return true
    }

    private suspend fun restoreLastKnownGoodContent(reason: String, showStatus: Boolean): Boolean {
        val fallbackJson = offlineManager.loadLastKnownGoodScreenContent() ?: return false
        val screenContent = parseScreenContent(fallbackJson, ::absoluteMediaUrl)
        val playlist = screenContent.playlist ?: return false
        if (playlist.zones.isEmpty()) return false

        currentScreenContentJson = JSONObject(fallbackJson.toString())
        widgetRuntimeEnv = WidgetRuntimeEnv(
            weatherApiKey = screenContent.weatherApiKey,
            tenantNewsFeedUrls = screenContent.newsFeedUrls
        )
        screenLocation = screenContent.location
        currentPlaylistId = playlist.id
        currentPlaylistFingerprint = screenContentFingerprint(screenContent)
        telemetry.markPlaybackState("RECOVERING")
        telemetry.clearPlaybackErrors()
        NativeOpsLogger.log(this, "WARN", "Restoring last known good content", JSONObject().put("reason", reason))
        if (showStatus) {
            showOverlay("Recovering with last known good playlist ($reason)...", showPairing = false)
        }
        playbackStage.post {
            renderPlaylist(playlist)
            hideOverlay()
        }
        startHeartbeat()
        startContentRefresh()
        return true
    }

    private fun renderPlaylist(playlist: PlaylistModel) {
        clearStage()
        currentZoneMedia.clear()

        playlist.zones.sortedBy { it.zIndex }.forEach { zone ->
            val session = ZonePlaybackSession(
                context = this,
                scope = appScope,
                httpClient = http,
                playlist = playlist,
                zone = zone,
                widgetEnv = widgetRuntimeEnv,
                screenLocation = screenLocation,
                ensureDownloaded = { media -> ensureDownloaded(media) },
                localFileFor = { media -> localFileFor(media) },
                isMediaQuarantined = { media -> quarantinedMediaReason(media) },
                onPlaybackStateChanged = { _, state, _ ->
                    telemetry.markPlaybackState(state)
                },
                onPlaybackProgress = { _, _ ->
                    telemetry.recordPlaybackProgress()
                },
                onActiveMedia = { zoneId, mediaId ->
                    currentZoneMedia[zoneId] = mediaId
                    telemetry.setZoneAsset(zoneId, mediaId)
                },
                onPlaybackIssue = { _, itemId, media, message, decoderError ->
                    telemetry.markPlaybackIssue(message, decoderError)
                    media?.takeIf { shouldQuarantineMedia(it, message, decoderError) }?.let {
                        quarantineMedia(it, decoderError ?: message)
                    }
                    queueCommandUpdate(itemId, "FAILED", message)
                },
                onPlaybackSuccess = { _, mediaId, playlistId ->
                    telemetry.markPlaybackSuccess(mediaId, playlistId)
                    rememberCurrentPlaylistAsKnownGood()
                },
                onProofOfPlay = { mediaId, playlistId, startedAtMs, durationSeconds ->
                    telemetry.markPlaybackSuccess(mediaId, playlistId)
                    enqueuePop(mediaId, playlistId, startedAtMs, durationSeconds)
                }
            )
            zoneSessions[zone.id] = session
            session.bindToStage(playbackStage)
            session.play()
        }
    }

    private fun clearStage() {
        zoneSessions.values.forEach { it.dispose(playbackStage) }
        zoneSessions.clear()
        playbackStage.removeAllViews()
    }

    private fun startHeartbeat() {
        if (heartbeatJob?.isActive == true) return
        heartbeatJob = appScope.launch {
            while (isActive) {
                val base = apiBase
                val auth = token
                if (!base.isNullOrBlank() && !auth.isNullOrBlank()) {
                    val payload = JSONObject()
                    val basePayload = telemetry.snapshot(
                        currentPlaylistId = currentPlaylistId,
                        apiBase = apiBase,
                        kioskEnabled = prefs().getBoolean(prefsKioskEnabled, false),
                        startOnBoot = prefs().getBoolean(prefsStartOnBoot, true),
                        isDeviceOwner = isDeviceOwner(),
                        deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
                        appVersion = appVersion
                    )
                    basePayload.keys().forEach { key ->
                        payload.put(key, basePayload.get(key))
                    }

                    val updates = synchronized(commandUpdates) {
                        if (commandUpdates.isEmpty()) null else JSONArray(commandUpdates.map { JSONObject(it.toString()) })
                    }
                    if (updates != null) {
                        payload.put("commandUpdates", updates)
                    }

                    val res = httpPostJson("$base/player/heartbeat", payload, authToken = auth)
                    if (res != null && updates != null) {
                        synchronized(commandUpdates) { commandUpdates.clear() }
                    }
                    res?.optJSONArray("commands")?.let { handleCommands(it) }
                }
                delay(30000)
            }
        }
        startPopFlush()
    }

    private fun startContentRefresh() {
        if (contentRefreshJob?.isActive == true) return
        contentRefreshJob = appScope.launch {
            while (isActive) {
                delay(60000)
                fetchAndPlay(force = false, allowLastKnownGoodFallback = true)
            }
        }
    }

    private fun startReliabilityMonitor() {
        if (reliabilityJob?.isActive == true) return
        reliabilityJob = appScope.launch {
            while (isActive) {
                delay(15_000L)
                runReliabilityChecks()
            }
        }
    }

    private suspend fun runReliabilityChecks() {
        val health = telemetry.healthSnapshot()
        val now = System.currentTimeMillis()
        val hasPlaylist = !currentPlaylistId.isNullOrBlank()
        val playbackStalled = hasPlaylist && (
            (health.playbackState in setOf("PLAYING", "BUFFERING", "ERROR", "SYNCING") && now - health.lastPlaybackProgressAtMs > PLAYBACK_STALL_TIMEOUT_MS) ||
                (health.lastSuccessfulPlaybackAtMs == null && now - health.playbackStateUpdatedAtMs > STARTUP_HEALTH_TIMEOUT_MS)
            )
        val downloadStalled = health.downloadState in setOf("DOWNLOADING", "RETRYING") &&
            now - health.downloadUpdatedAtMs > DOWNLOAD_HEALTH_TIMEOUT_MS

        when {
            downloadStalled -> performSelfHealing("stuck_download")
            playbackStalled -> performSelfHealing("stuck_playback")
        }
    }

    private suspend fun performSelfHealing(reason: String) {
        val now = System.currentTimeMillis()
        if (now - lastRecoveryAttemptAt < RECOVERY_COOLDOWN_MS) return
        lastRecoveryAttemptAt = now

        telemetry.markPlaybackState("RECOVERING")
        NativeOpsLogger.log(this, "WARN", "Self-healing triggered", JSONObject().put("reason", reason))
        showOverlay("Recovering player: $reason...", showPairing = false)
        clearStage()
        currentPlaylistFingerprint = null

        val recovered = fetchAndPlay(force = true, allowLastKnownGoodFallback = true) ||
            restoreLastKnownGoodContent(reason, showStatus = true)
        if (!recovered && !token.isNullOrBlank()) {
            rePair()
        }
    }

    private fun handleCommands(commands: JSONArray) {
        for (i in 0 until commands.length()) {
            val cmd = commands.optJSONObject(i) ?: continue
            val id = cmd.optString("id", "")
            val type = cmd.optString("type")
            val payload = cmd.optJSONObject("payload")

            if (id.isNotBlank()) {
                queueCommandUpdate(id, "PROCESSING", "Starting $type")
            }

            when (type) {
                "RELOAD", "PLAY_PLAYLIST" -> appScope.launch {
                    fetchAndPlay(force = true)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Reloaded")
                }
                "CLEAR_CACHE" -> appScope.launch {
                    clearLocalMedia()
                    fetchAndPlay(force = true)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Cache cleared")
                }
                "SNAPSHOT" -> appScope.launch {
                    val ok = uploadSnapshot()
                    if (id.isNotBlank()) {
                        queueCommandUpdate(id, if (ok) "COMPLETED" else "FAILED", if (ok) "Snapshot uploaded" else "Snapshot upload failed")
                    }
                }
                "EXPORT_SUPPORT_BUNDLE" -> appScope.launch {
                    val ok = exportSupportBundle()
                    if (id.isNotBlank()) {
                        queueCommandUpdate(
                            id,
                            if (ok) "COMPLETED" else "FAILED",
                            if (ok) "Support bundle uploaded" else "Support bundle upload failed"
                        )
                    }
                }
                "REBOOT", "REBOOT_APP" -> {
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "App restarted")
                    recreate()
                }
                "REBOOT_DEVICE" -> {
                    val rebooted = runCatching {
                        if (!isDeviceOwner() || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
                            false
                        } else {
                            val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
                            val admin = ComponentName(this, SmartagsDeviceAdminReceiver::class.java)
                            dpm.reboot(admin)
                            true
                        }
                    }.getOrDefault(false)
                    if (id.isNotBlank()) {
                        if (rebooted) {
                            queueCommandUpdate(id, "COMPLETED", "Device reboot requested")
                        } else {
                            queueCommandUpdate(id, "FAILED", "Device reboot requires Device Owner on Android 7+")
                        }
                    }
                }
                "SET_KIOSK" -> {
                    val enabled = payload?.optBoolean("enabled", false) ?: false
                    settingsKiosk.isChecked = enabled
                    applyKioskMode(enabled)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Kiosk set to $enabled")
                }
                "SET_START_ON_BOOT" -> {
                    val enabled = payload?.optBoolean("enabled", true) ?: true
                    settingsStartOnBoot.isChecked = enabled
                    setBootReceiverEnabled(enabled)
                    prefs().edit().putBoolean(prefsStartOnBoot, enabled).apply()
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Start on boot set to $enabled")
                }
                "ENTER_RECOVERY_MODE" -> {
                    val minutes = payload?.optLong("minutes", 15L)?.coerceIn(1L, 60L) ?: 15L
                    enterRecoveryMode(minutes)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Recovery mode enabled for ${minutes}m")
                }
                "CLEAR_RECOVERY_MODE" -> {
                    clearRecoveryMode()
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Recovery mode cleared")
                }
                "RESET_TECH_UNLOCK" -> {
                    prefs().edit()
                        .remove(prefsTechUnlockedUntil)
                        .remove(prefsUnlockFailures)
                        .remove(prefsUnlockLockedUntil)
                        .apply()
                    updateSettingsAccessUi()
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Technician unlock reset")
                }
                "CLEAR_HOME_LOCK" -> {
                    KioskPolicyManager.clearHomeLauncherLock(this)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "HOME launcher lock cleared")
                }
                "SET_API_BASE" -> {
                    val newBase = normalizeApiBase(payload?.optString("apiBase", null))
                    if (!newBase.isNullOrBlank()) {
                        prefs().edit().putString(prefsApiBase, newBase).apply()
                        apiBase = newBase
                        apiBaseInput.setText(newBase)
                        if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "API base updated")
                        rePair()
                    } else if (id.isNotBlank()) {
                        queueCommandUpdate(id, "FAILED", "Invalid apiBase")
                    }
                }
                else -> if (id.isNotBlank()) queueCommandUpdate(id, "FAILED", "Unknown command type: $type")
            }
        }
    }

    private suspend fun ensureDownloaded(media: MediaFileModel): Boolean = offlineManager.ensureAvailable(media)

    private fun localFileFor(media: MediaFileModel): File = offlineManager.fileFor(media)

    private suspend fun clearLocalMedia() {
        offlineManager.clearAll()
        currentPlaylistFingerprint = null
        synchronized(popQueue) {
            popQueue.clear()
        }
        prefs().edit().remove(prefsPopQueue).apply()
    }

    private fun absoluteMediaUrl(rawUrl: String): String {
        val url = rawUrl.trim()
        if (url.isBlank()) return ""
        if (url.startsWith("http://", true) || url.startsWith("https://", true)) return url

        val base = apiBase?.removeSuffix("/api") ?: return url
        return if (url.startsWith("/")) "$base$url" else "$base/$url"
    }

    private fun rePair() {
        val prefs = prefs()
        prefs.edit()
            .remove(prefsToken)
            .remove(prefsLastPairingCode)
            .remove(prefsLastScreenId)
            .apply()
        token = null
        currentPlaylistId = null
        currentPlaylistFingerprint = null
        heartbeatJob?.cancel()
        heartbeatJob = null
        contentRefreshJob?.cancel()
        contentRefreshJob = null
        clearStage()
        appScope.launch { pairDevice() }
    }

    private fun queueCommandUpdate(id: String, status: String, message: String) {
        synchronized(commandUpdates) {
            val obj = JSONObject()
            obj.put("id", id)
            obj.put("status", status)
            obj.put("message", message)
            commandUpdates.add(obj)
        }
        NativeOpsLogger.log(this, if (status == "FAILED") "ERROR" else "INFO", "Command update", JSONObject()
            .put("id", id)
            .put("status", status)
            .put("message", message))
    }

    private fun buildTelemetrySnapshot(): JSONObject = telemetry.snapshot(
        currentPlaylistId = currentPlaylistId,
        apiBase = apiBase,
        kioskEnabled = prefs().getBoolean(prefsKioskEnabled, false),
        startOnBoot = prefs().getBoolean(prefsStartOnBoot, true),
        isDeviceOwner = isDeviceOwner(),
        deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
        appVersion = appVersion
    )

    private fun rememberCurrentPlaylistAsKnownGood() {
        val content = currentScreenContentJson ?: return
        val fingerprint = currentPlaylistFingerprint ?: return
        if (prefs().getString(prefsLastKnownGoodFingerprint, null) == fingerprint) return
        val snapshot = JSONObject(content.toString())
        appScope.launch {
            offlineManager.rememberLastKnownGoodScreenContent(snapshot)
            prefs().edit().putString(prefsLastKnownGoodFingerprint, fingerprint).apply()
        }
    }

    private fun shouldQuarantineMedia(media: MediaFileModel, message: String, decoderError: String?): Boolean {
        if (message.contains("Missing media", true) || message.contains("Missing playable file", true)) {
            return false
        }
        val signal = listOfNotNull(decoderError, message).joinToString(" ")
        return signal.contains("decoder", true) ||
            signal.contains("unsupported", true) ||
            signal.contains("format", true) ||
            signal.contains("corrupt", true) ||
            signal.contains("quarantined_media", true)
    }

    private fun quarantineMedia(media: MediaFileModel, reason: String) {
        val prefs = prefs()
        val store = runCatching { JSONObject(prefs.getString(prefsQuarantinedMedia, "{}") ?: "{}") }.getOrDefault(JSONObject())
        store.put(
            mediaVersionToken(media),
            JSONObject().apply {
                put("reason", reason)
                put("until", System.currentTimeMillis() + MEDIA_QUARANTINE_MS)
            }
        )
        prefs.edit().putString(prefsQuarantinedMedia, store.toString()).apply()
    }

    private fun quarantinedMediaReason(media: MediaFileModel): String? {
        val prefs = prefs()
        val store = runCatching { JSONObject(prefs.getString(prefsQuarantinedMedia, "{}") ?: "{}") }.getOrDefault(JSONObject())
        val entry = store.optJSONObject(mediaVersionToken(media)) ?: return null
        val until = entry.optLong("until", 0L)
        return if (until > System.currentTimeMillis()) {
            entry.optString("reason").ifBlank { "temporary media quarantine" }
        } else {
            store.remove(mediaVersionToken(media))
            prefs.edit().putString(prefsQuarantinedMedia, store.toString()).apply()
            null
        }
    }

    private fun cleanupQuarantinedMedia() {
        val prefs = prefs()
        val store = runCatching { JSONObject(prefs.getString(prefsQuarantinedMedia, "{}") ?: "{}") }.getOrDefault(JSONObject())
        val keys = mutableListOf<String>()
        store.keys().forEach { key ->
            val until = store.optJSONObject(key)?.optLong("until", 0L) ?: 0L
            if (until <= System.currentTimeMillis()) {
                keys.add(key)
            }
        }
        if (keys.isNotEmpty()) {
            keys.forEach(store::remove)
            prefs.edit().putString(prefsQuarantinedMedia, store.toString()).apply()
        }
    }

    private suspend fun uploadSnapshot(): Boolean {
        val base = apiBase ?: return false
        val auth = token ?: return false
        val snapshotFile = withContext(Dispatchers.IO) {
            val bitmap = withContext(Dispatchers.Main) { captureSnapshotBitmap() } ?: return@withContext null
            val file = File(cacheDir, "latest_snapshot.jpg")
            runCatching {
                FileOutputStream(file).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
                }
                file
            }.getOrNull()
        } ?: return false

        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "snapshot",
                snapshotFile.name,
                snapshotFile.asRequestBody("image/jpeg".toMediaType())
            )
            .build()

        val req = Request.Builder()
            .url("$base/player/snapshot")
            .header("Authorization", "Bearer $auth")
            .post(body)
            .build()

        return runCatching {
            http.newCall(req).execute().use { it.isSuccessful }
        }.getOrDefault(false)
    }

    private suspend fun exportSupportBundle(): Boolean {
        val base = apiBase ?: return false
        val auth = token ?: return false
        NativeOpsLogger.log(this, "INFO", "Exporting support bundle")
        return SupportBundleManager.exportAndUpload(
            context = this,
            httpClient = http,
            apiBase = base,
            authToken = auth,
            telemetrySnapshot = buildTelemetrySnapshot(),
            runtimeHealth = telemetry.healthSnapshot(),
            currentScreenContent = currentScreenContentJson?.let { JSONObject(it.toString()) },
            currentPlaylistId = currentPlaylistId,
            currentPlaylistFingerprint = currentPlaylistFingerprint,
            currentZoneMedia = currentZoneMedia.toMap(),
            currentScreenId = prefs().getString(prefsLastScreenId, null),
            appVersion = appVersion
        ).also { ok ->
            NativeOpsLogger.log(this, if (ok) "INFO" else "ERROR", if (ok) "Support bundle uploaded" else "Support bundle upload failed")
        }
    }

    private fun captureSnapshotBitmap(): Bitmap? {
        val target = if (playbackStage.width > 0 && playbackStage.height > 0) playbackStage else window.decorView.rootView
        val width = target.width.takeIf { it > 0 } ?: return null
        val height = target.height.takeIf { it > 0 } ?: return null
        return runCatching {
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { bitmap ->
                val canvas = Canvas(bitmap)
                target.draw(canvas)
            }
        }.getOrNull()
    }

    private fun isDeviceOwner(): Boolean {
        return KioskPolicyManager.isDeviceOwner(this)
    }

    private fun setBootReceiverEnabled(enabled: Boolean) {
        KioskPolicyManager.setBootReceiverEnabled(this, enabled)
    }

    private fun applyKioskMode(enabled: Boolean) {
        val prefs = prefs()
        prefs.edit().putBoolean(prefsKioskEnabled, enabled).apply()

        if (enabled) {
            if (!isDeviceOwner()) {
                prefs.edit().putBoolean(prefsKioskEnabled, false).apply()
                settingsKiosk.isChecked = false
                Toast.makeText(this, "Enterprise kiosk requires Device Owner provisioning", Toast.LENGTH_LONG).show()
                updateSettingsAccessUi()
                return
            }
            if (!hasConfiguredTechPin() || !isStrongTechPin()) {
                prefs.edit().putBoolean(prefsKioskEnabled, false).apply()
                settingsKiosk.isChecked = false
                Toast.makeText(this, "Set a 6+ digit technician PIN before enabling kiosk", Toast.LENGTH_LONG).show()
                updateSettingsAccessUi()
                return
            }
            if (isRecoveryModeActive()) {
                clearRecoveryMode()
            }
            try {
                val enforced = KioskPolicyManager.enforce(this)
                if (!enforced) {
                    throw IllegalStateException("Device Owner provisioning missing")
                }
                settingsStartOnBoot.isChecked = true
                startLockTask()
                KioskGuardianService.start(this, "enable_kiosk")
            } catch (_: Exception) {
                prefs.edit().putBoolean(prefsKioskEnabled, false).apply()
                settingsKiosk.isChecked = false
                Toast.makeText(this, "Unable to enforce kiosk policy on this device", Toast.LENGTH_LONG).show()
            }
        } else {
            try {
                stopLockTask()
            } catch (_: Exception) {
            }
            KioskPolicyManager.relax(this)
            KioskGuardianService.stop(this)
        }
        hideSystemUI()
        updateSettingsAccessUi()
    }

    private fun normalizeApiBase(raw: String?): String? {
        val input = raw?.trim().orEmpty()
        if (input.isBlank()) return null
        val withScheme = if (input.startsWith("http://", true) || input.startsWith("https://", true)) input else "https://$input"
        val uri = runCatching { android.net.Uri.parse(withScheme) }.getOrNull() ?: return null
        val host = uri.host ?: return null
        val scheme = uri.scheme ?: "https"
        val port = if (uri.port != -1) ":${uri.port}" else ""
        val path = uri.path?.trimEnd('/') ?: ""
        val normalizedPath = if (path.endsWith("/api")) path else if (path.isBlank()) "/api" else "$path/api"
        return "$scheme://$host$port$normalizedPath"
    }

    private fun showOverlay(message: String, showPairing: Boolean) {
        overlay.visibility = View.VISIBLE
        statusText.text = message
        apiBaseInput.visibility = if (showPairing) View.VISIBLE else View.GONE
        saveApiButton.visibility = if (showPairing) View.VISIBLE else View.GONE
        progress.visibility = View.VISIBLE
    }

    private fun hideOverlay() {
        overlay.visibility = View.GONE
    }

    private fun httpGetJson(url: String, authToken: String?): JSONObject? {
        val req = Request.Builder()
            .url(url)
            .apply { if (!authToken.isNullOrBlank()) header("Authorization", "Bearer $authToken") }
            .get()
            .build()

        return runCatching {
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return null
                val body = res.body?.string() ?: return null
                JSONObject(body)
            }
        }.getOrNull()
    }

    private fun httpPostJson(url: String, json: JSONObject, authToken: String? = null): JSONObject? {
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url(url)
            .apply { if (!authToken.isNullOrBlank()) header("Authorization", "Bearer $authToken") }
            .post(body)
            .build()

        return runCatching {
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return null
                val text = res.body?.string() ?: return null
                JSONObject(text)
            }
        }.getOrNull()
    }

    private fun loadPopQueue(prefs: android.content.SharedPreferences) {
        val raw = prefs.getString(prefsPopQueue, null) ?: return
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return
        synchronized(popQueue) {
            popQueue.clear()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                popQueue.add(obj)
            }
        }
    }

    private fun persistPopQueue() {
        val snapshot = synchronized(popQueue) { JSONArray(popQueue.map { JSONObject(it.toString()) }) }
        prefs().edit().putString(prefsPopQueue, snapshot.toString()).apply()
    }

    private fun enqueuePop(mediaId: String, playlistId: String?, startedAtMs: Long, durationSeconds: Int) {
        val entry = JSONObject().apply {
            put("mediaId", mediaId)
            put("playlistId", playlistId ?: JSONObject.NULL)
            put("startedAt", Instant.ofEpochMilli(startedAtMs).toString())
            put("duration", durationSeconds)
        }
        synchronized(popQueue) {
            popQueue.add(entry)
            while (popQueue.size > 500) {
                popQueue.removeAt(0)
            }
        }
        persistPopQueue()
    }

    private fun startPopFlush() {
        if (popFlushJob?.isActive == true) return
        popFlushJob = appScope.launch {
            while (isActive) {
                flushPop()
                delay(60000)
            }
        }
    }

    private suspend fun flushPop() {
        val base = apiBase ?: return
        val auth = token ?: return
        val batch = synchronized(popQueue) {
            if (popQueue.isEmpty()) null else JSONArray(popQueue.map { JSONObject(it.toString()) })
        } ?: return

        val payload = JSONObject().apply { put("logs", batch) }
        val res = httpPostJson("$base/player/pop", payload, authToken = auth)
        if (res != null) {
            synchronized(popQueue) { popQueue.clear() }
            persistPopQueue()
        }
    }

    private fun playlistFingerprint(playlist: PlaylistModel): String =
        buildString {
            append(playlist.id)
            append('|')
            playlist.zones.sortedBy { it.zIndex }.forEach { zone ->
                append(zone.id).append(':').append(zone.x).append(':').append(zone.y).append(':').append(zone.width).append(':').append(zone.height).append(':').append(zone.zIndex)
                zone.items.sortedBy { it.order }.forEach { item ->
                    append('|').append(item.id).append(':').append(item.order).append(':').append(item.duration)
                        .append(':').append(item.media?.let(::mediaVersionToken) ?: "")
                        .append(':').append(item.widget?.id ?: "")
                        .append(':').append(item.widget?.type ?: "")
                        .append(':').append(item.widget?.config?.toString() ?: "")
                }
                append("||")
            }
        }

    private fun mediaVersionToken(media: MediaFileModel): String =
        listOf(
            media.id,
            media.url,
            media.updatedAt ?: "",
            media.sizeBytes?.toString() ?: "",
            media.sha256 ?: "",
            media.mimeType
        ).joinToString("|")

    private fun screenContentFingerprint(content: ScreenContentModel): String =
        buildString {
            append(content.playlist?.let(::playlistFingerprint) ?: "NO_PLAYLIST")
            append("|weatherKey=").append(content.weatherApiKey ?: "")
            append("|news=").append(content.newsFeedUrls.joinToString(","))
            append("|location=").append(content.location?.name ?: "")
            append('|').append(content.location?.latitude ?: "")
            append('|').append(content.location?.longitude ?: "")
        }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }

    companion object {
        private const val PLAYBACK_STALL_TIMEOUT_MS = 90_000L
        private const val DOWNLOAD_HEALTH_TIMEOUT_MS = 90_000L
        private const val STARTUP_HEALTH_TIMEOUT_MS = 120_000L
        private const val RECOVERY_COOLDOWN_MS = 45_000L
        private const val MEDIA_QUARANTINE_MS = 12 * 60 * 60 * 1000L
    }
}
