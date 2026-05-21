package com.smartags.tvplayer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    private val prefsName = "SmartagsTvPlayer"
    private val prefsApiBase = "api_base"
    private val prefsToken = "screen_token"
    private val prefsLastScreenId = "screen_id"
    private val prefsLastPairingCode = "pairing_code"
    private val prefsStartOnBoot = "start_on_boot"
    private val prefsKioskEnabled = "kiosk_enabled"

    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var overlay: View
    private lateinit var titleText: TextView
    private lateinit var statusText: TextView
    private lateinit var apiBaseInput: EditText
    private lateinit var saveApiButton: Button
    private lateinit var pairingCodeText: TextView
    private lateinit var progress: ProgressBar

    private lateinit var settingsContainer: LinearLayout
    private lateinit var settingsDeviceOwner: TextView
    private lateinit var settingsStartOnBoot: SwitchCompat
    private lateinit var settingsKiosk: SwitchCompat
    private lateinit var settingsChangeApi: Button
    private lateinit var settingsClearCache: Button
    private lateinit var settingsRepair: Button
    private lateinit var settingsExit: Button

    private val appScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private lateinit var player: ExoPlayer
    private var heartbeatJob: Job? = null
    private var playbackJob: Job? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var apiBase: String? = null
    private var token: String? = null

    private var currentPlaylistId: String? = null
    private var currentMediaId: String? = null
    private var lastBackPressedAt: Long = 0
    private val commandUpdates: MutableList<JSONObject> = mutableListOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.player_view)
        imageView = findViewById(R.id.image_view)
        overlay = findViewById(R.id.overlay_container)
        titleText = findViewById(R.id.title_text)
        statusText = findViewById(R.id.status_text)
        apiBaseInput = findViewById(R.id.api_base_input)
        saveApiButton = findViewById(R.id.save_api_button)
        pairingCodeText = findViewById(R.id.pairing_code_text)
        progress = findViewById(R.id.progress)

        settingsContainer = findViewById(R.id.settings_container)
        settingsDeviceOwner = findViewById(R.id.settings_device_owner)
        settingsStartOnBoot = findViewById(R.id.settings_start_on_boot)
        settingsKiosk = findViewById(R.id.settings_kiosk)
        settingsChangeApi = findViewById(R.id.settings_change_api)
        settingsClearCache = findViewById(R.id.settings_clear_cache)
        settingsRepair = findViewById(R.id.settings_repair)
        settingsExit = findViewById(R.id.settings_exit)

        val prefs = getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        apiBase = prefs.getString(prefsApiBase, null)
        token = prefs.getString(prefsToken, null)

        apiBaseInput.setText(apiBase ?: "https://dooh.brandeagles.com/api")
        pairingCodeText.text = "Pairing Code: -"

        saveApiButton.setOnClickListener {
            val base = normalizeApiBase(apiBaseInput.text?.toString())
            if (base == null) {
                Toast.makeText(this, "Invalid API base URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            apiBase = base
            prefs.edit().putString(prefsApiBase, base).apply()
            startOrPair()
        }

        settingsDeviceOwner.text = "Device Owner: ${if (isDeviceOwner()) "YES" else "NO"}"

        val startOnBootEnabled = prefs.getBoolean(prefsStartOnBoot, true)
        settingsStartOnBoot.isChecked = startOnBootEnabled
        setBootReceiverEnabled(startOnBootEnabled)

        val kioskEnabled = prefs.getBoolean(prefsKioskEnabled, false)
        settingsKiosk.isChecked = kioskEnabled
        applyKioskMode(kioskEnabled)

        settingsStartOnBoot.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(prefsStartOnBoot, isChecked).apply()
            setBootReceiverEnabled(isChecked)
        }

        settingsKiosk.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(prefsKioskEnabled, isChecked).apply()
            applyKioskMode(isChecked)
        }

        settingsChangeApi.setOnClickListener {
            settingsContainer.visibility = View.GONE
            showOverlay("Enter API base URL to continue", showPairing = true)
        }

        settingsClearCache.setOnClickListener {
            clearLocalMedia()
            Toast.makeText(this, "Offline cache cleared", Toast.LENGTH_SHORT).show()
        }

        settingsRepair.setOnClickListener {
            settingsContainer.visibility = View.GONE
            rePair()
        }

        settingsExit.setOnClickListener {
            applyKioskMode(false)
            finish()
        }

        player = ExoPlayer.Builder(this).build()
        playerView.player = player
        playerView.useController = false
        player.addListener(object : Player.Listener {
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                statusText.text = "Playback error: ${error.errorCodeName}"
                overlay.visibility = View.VISIBLE
            }
        })

        hideSystemUI()
        startOrPair()
    }

    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob?.cancel()
        playbackJob?.cancel()
        player.release()
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
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
            toggleSettings()
            return true
        }
        if (event != null && event.isCtrlPressed && keyCode == KeyEvent.KEYCODE_M) {
            toggleSettings()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun toggleSettings() {
        settingsDeviceOwner.text = "Device Owner: ${if (isDeviceOwner()) "YES" else "NO"}"
        settingsContainer.visibility = if (settingsContainer.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        hideSystemUI()
    }

    private fun startOrPair() {
        val base = apiBase ?: normalizeApiBase(apiBaseInput.text?.toString())
        if (base == null) {
            showOverlay("Enter API base URL to continue", showPairing = true)
            return
        }

        apiBase = base
        val prefs = getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        prefs.edit().putString(prefsApiBase, base).apply()

        val existingToken = prefs.getString(prefsToken, null)
        if (!existingToken.isNullOrBlank()) {
            token = existingToken
            appScope.launch { bootstrapWithToken(existingToken) }
        } else {
            appScope.launch { pairDevice() }
        }
    }

    private suspend fun bootstrapWithToken(existingToken: String) {
        showOverlay("Connecting...", showPairing = false)
        val ok = fetchAndPlay()
        if (!ok) {
            getSharedPreferences(prefsName, Context.MODE_PRIVATE).edit().remove(prefsToken).apply()
            token = null
            pairDevice()
        }
    }

    private suspend fun pairDevice() {
        showOverlay("Registering device...", showPairing = false)
        val base = apiBase ?: return

        val registerRes = httpPostJson("$base/player/register", JSONObject())
        if (registerRes == null) {
            showOverlay("Failed to register. Check network/API URL.", showPairing = true)
            return
        }

        val code = registerRes.optString("code", "")
        val screenId = registerRes.optString("screenId", "")
        if (code.isBlank()) {
            showOverlay("Register returned invalid pairing code.", showPairing = true)
            return
        }

        val prefs = getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        prefs.edit().putString(prefsLastPairingCode, code).putString(prefsLastScreenId, screenId).apply()
        pairingCodeText.text = "Pairing Code: $code"

        showOverlay("Waiting for pairing in dashboard...", showPairing = false)

        while (appScope.isActive) {
            val statusRes = httpGetJson("$base/player/status/$code", authToken = null)
            if (statusRes != null && statusRes.optString("status") == "PAIRED") {
                val newToken = statusRes.optString("token", "")
                if (newToken.isNotBlank()) {
                    prefs.edit().putString(prefsToken, newToken).apply()
                    token = newToken
                    showOverlay("Paired. Syncing content...", showPairing = false)
                    fetchAndPlay()
                    return
                }
            }
            delay(3000)
        }
    }

    private suspend fun fetchAndPlay(): Boolean {
        val base = apiBase ?: return false
        val auth = token ?: return false

        val content = httpGetJson("$base/player/content", authToken = auth) ?: return false
        if (content.optString("message").contains("unauthorized", true)) return false

        val playlist = content.optJSONObject("playlist")
        if (playlist == null || playlist == JSONObject.NULL) {
            currentPlaylistId = null
            playbackJob?.cancel()
            showOverlay("Waiting for content to be published...", showPairing = false)
            startHeartbeat()
            return true
        }

        currentPlaylistId = playlist.optString("id", null)
        val zoneItems = extractPrimaryZoneItems(playlist)
        if (zoneItems.isEmpty()) {
            playbackJob?.cancel()
            showOverlay("Playlist has no items.", showPairing = false)
            startHeartbeat()
            return true
        }

        val mediaItems = zoneItems.mapNotNull { it.media }
        showOverlay("Downloading content...", showPairing = false)
        withContext(Dispatchers.IO) {
            for (m in mediaItems) {
                ensureDownloaded(m)
            }
        }

        overlay.visibility = View.GONE
        startHeartbeat()
        startPlaybackLoop(zoneItems)
        return true
    }

    private fun startPlaybackLoop(items: List<PlaylistItem>) {
        playbackJob?.cancel()
        playbackJob = appScope.launch {
            var idx = 0
            while (isActive) {
                val item = items[idx % items.size]
                val media = item.media
                if (media == null) {
                    delay((item.durationSeconds.coerceAtLeast(5) * 1000L))
                    idx++
                    continue
                }

                currentMediaId = media.id
                if (media.mimeType.startsWith("image/")) {
                    playImage(media, item.durationSeconds.coerceAtLeast(5))
                    idx++
                    continue
                }

                playVideo(media, item.durationSeconds)
                idx++
            }
        }
    }

    private suspend fun playImage(media: MediaFile, durationSeconds: Int) {
        val file = localFileFor(media)
        withContext(Dispatchers.IO) {
            if (!file.exists()) {
                ensureDownloaded(media)
            }
        }
        val bmp = withContext(Dispatchers.IO) {
            runCatching { android.graphics.BitmapFactory.decodeFile(file.absolutePath) }.getOrNull()
        }
        if (bmp == null) {
            delay(1000)
            return
        }

        player.stop()
        imageView.setImageBitmap(bmp)
        imageView.visibility = View.VISIBLE
        playerView.visibility = View.GONE
        delay(durationSeconds * 1000L)
    }

    private suspend fun playVideo(media: MediaFile, maxDurationSeconds: Int) {
        val file = localFileFor(media)
        withContext(Dispatchers.IO) {
            if (!file.exists()) {
                ensureDownloaded(media)
            }
        }

        imageView.visibility = View.GONE
        playerView.visibility = View.VISIBLE

        val uri = if (file.exists()) android.net.Uri.fromFile(file) else android.net.Uri.parse(media.url)
        val dataSourceFactory = DefaultDataSource.Factory(
            this,
            OkHttpDataSource.Factory(http)
        )

        val mediaItem = MediaItem.fromUri(uri)
        player.setMediaItem(mediaItem)
        player.setMediaSource(
            androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(dataSourceFactory).createMediaSource(mediaItem),
            true
        )
        player.prepare()
        player.playWhenReady = true

        if (maxDurationSeconds > 0) {
            delay(maxDurationSeconds * 1000L)
            player.stop()
            return
        }

        while (appScope.isActive && player.playbackState != Player.STATE_ENDED) {
            delay(250)
        }
        player.stop()
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = appScope.launch {
            while (isActive) {
                val base = apiBase
                val auth = token
                if (!base.isNullOrBlank() && !auth.isNullOrBlank()) {
                    val payload = JSONObject()
                    payload.put("platform", "android-tv")
                    payload.put("androidVersion", Build.VERSION.RELEASE ?: "")
                    payload.put("device", Build.MODEL ?: "")
                    payload.put("deviceId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
                    payload.put("currentPlaylistId", currentPlaylistId ?: JSONObject.NULL)
                    payload.put("currentMediaId", currentMediaId ?: JSONObject.NULL)
                    payload.put("kioskEnabled", getSharedPreferences(prefsName, Context.MODE_PRIVATE).getBoolean(prefsKioskEnabled, false))
                    payload.put("startOnBoot", getSharedPreferences(prefsName, Context.MODE_PRIVATE).getBoolean(prefsStartOnBoot, true))

                    val updates = synchronized(commandUpdates) {
                        if (commandUpdates.isEmpty()) null else JSONArray(commandUpdates.toList())
                    }
                    if (updates != null) {
                        payload.put("commandUpdates", updates)
                    }

                    val res = httpPostJson("$base/player/heartbeat", payload, authToken = auth)
                    if (res != null && updates != null) {
                        synchronized(commandUpdates) { commandUpdates.clear() }
                    }
                    val commands = res?.optJSONArray("commands")
                    if (commands != null) {
                        handleCommands(commands)
                    }
                }
                delay(30000)
            }
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

            when (cmd.optString("type")) {
                "RELOAD" -> appScope.launch {
                    fetchAndPlay()
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Reloaded")
                }
                "CLEAR_CACHE" -> appScope.launch {
                    clearLocalMedia()
                    fetchAndPlay()
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Cache cleared")
                }
                "REBOOT" -> {
                    mainHandler.post {
                        finish()
                        startActivity(intent)
                    }
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "App restarted")
                }
                "SET_KIOSK" -> {
                    val enabled = payload?.optBoolean("enabled", false) ?: false
                    getSharedPreferences(prefsName, Context.MODE_PRIVATE).edit().putBoolean(prefsKioskEnabled, enabled).apply()
                    settingsKiosk.isChecked = enabled
                    applyKioskMode(enabled)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Kiosk set to $enabled")
                }
                "SET_START_ON_BOOT" -> {
                    val enabled = payload?.optBoolean("enabled", true) ?: true
                    getSharedPreferences(prefsName, Context.MODE_PRIVATE).edit().putBoolean(prefsStartOnBoot, enabled).apply()
                    settingsStartOnBoot.isChecked = enabled
                    setBootReceiverEnabled(enabled)
                    if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "Start on boot set to $enabled")
                }
                "SET_API_BASE" -> {
                    val newBase = normalizeApiBase(payload?.optString("apiBase", null))
                    if (!newBase.isNullOrBlank()) {
                        getSharedPreferences(prefsName, Context.MODE_PRIVATE).edit().putString(prefsApiBase, newBase).apply()
                        apiBase = newBase
                        if (id.isNotBlank()) queueCommandUpdate(id, "COMPLETED", "API base updated")
                        appScope.launch { rePair() }
                    } else {
                        if (id.isNotBlank()) queueCommandUpdate(id, "FAILED", "Invalid apiBase")
                    }
                }
            }
        }
    }

    private fun extractPrimaryZoneItems(playlist: JSONObject): List<PlaylistItem> {
        val zones = playlist.optJSONArray("zones") ?: return emptyList()
        if (zones.length() == 0) return emptyList()

        val firstZone = zones.optJSONObject(0) ?: return emptyList()
        val items = firstZone.optJSONArray("items") ?: return emptyList()

        val out = ArrayList<PlaylistItem>(items.length())
        for (i in 0 until items.length()) {
            val it = items.optJSONObject(i) ?: continue
            val duration = it.optInt("duration", 10)
            val mediaJson = it.optJSONObject("media")
            val media = if (mediaJson != null) parseMedia(mediaJson) else null
            out.add(PlaylistItem(durationSeconds = duration, media = media))
        }
        return out
    }

    private fun parseMedia(mediaJson: JSONObject): MediaFile? {
        val id = mediaJson.optString("id", "")
        val url = absoluteMediaUrl(mediaJson.optString("url", ""))
        val mime = mediaJson.optString("mimeType", "")
        val filename = mediaJson.optString("filename", id)
        if (id.isBlank() || url.isBlank() || mime.isBlank()) return null
        return MediaFile(id = id, url = url, mimeType = mime, filename = filename)
    }

    private fun localFileFor(media: MediaFile): File {
        val dir = File(filesDir, "media")
        if (!dir.exists()) dir.mkdirs()

        val ext = when {
            media.mimeType.contains("mp4") -> ".mp4"
            media.mimeType.contains("webm") -> ".webm"
            media.mimeType.contains("png") -> ".png"
            media.mimeType.contains("jpeg") || media.mimeType.contains("jpg") -> ".jpg"
            else -> ""
        }
        return File(dir, "${media.id}$ext")
    }

    private fun ensureDownloaded(media: MediaFile) {
        val outFile = localFileFor(media)
        if (outFile.exists() && outFile.length() > 0) return

        val req = Request.Builder().url(media.url).get().build()
        val res = http.newCall(req).execute()
        if (!res.isSuccessful) {
            res.close()
            return
        }

        val body = res.body ?: run {
            res.close()
            return
        }

        outFile.parentFile?.mkdirs()
        FileOutputStream(outFile).use { fos ->
            body.byteStream().use { input ->
                input.copyTo(fos)
            }
        }
        res.close()
    }

    private fun clearLocalMedia() {
        val dir = File(filesDir, "media")
        if (!dir.exists()) return
        dir.listFiles()?.forEach { it.deleteRecursively() }
    }

    private fun absoluteMediaUrl(rawUrl: String): String {
        val url = rawUrl.trim()
        if (url.isBlank()) return ""
        if (url.startsWith("http://", true) || url.startsWith("https://", true)) return url

        val base = apiBase?.removeSuffix("/api") ?: return url
        return if (url.startsWith("/")) "$base$url" else "$base/$url"
    }

    private fun rePair() {
        val prefs = getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(prefsToken)
            .remove(prefsLastPairingCode)
            .remove(prefsLastScreenId)
            .apply()
        token = null
        currentPlaylistId = null
        currentMediaId = null
        playbackJob?.cancel()
        player.stop()
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
    }

    private fun isDeviceOwner(): Boolean {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(packageName)
    }

    private fun setBootReceiverEnabled(enabled: Boolean) {
        val component = ComponentName(this, BootReceiver::class.java)
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
    }

    private fun applyKioskMode(enabled: Boolean) {
        if (enabled) {
            try {
                val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
                val admin = ComponentName(this, SmartagsDeviceAdminReceiver::class.java)
                if (dpm.isDeviceOwnerApp(packageName)) {
                    dpm.setLockTaskPackages(admin, arrayOf(packageName))
                }
                startLockTask()
            } catch (_: Exception) {
                Toast.makeText(this, "Kiosk requires screen pinning or device owner", Toast.LENGTH_LONG).show()
            }
        } else {
            try {
                stopLockTask()
            } catch (_: Exception) {
            }
        }
        hideSystemUI()
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

    data class MediaFile(
        val id: String,
        val url: String,
        val mimeType: String,
        val filename: String
    )

    data class PlaylistItem(
        val durationSeconds: Int,
        val media: MediaFile?
    )
}
