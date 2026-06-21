package com.smartags.tvplayer

import android.content.Context
import android.os.Build
import android.os.StatFs
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

data class NativeCachedAsset(
    val mediaId: String,
    val filename: String,
    val state: String,
    val bytesDownloaded: Long,
    val totalBytes: Long?,
    val checksumSha256: String?,
    val lastError: String?
)

data class NativeDownloadSnapshot(
    val state: String = "IDLE",
    val completed: Int = 0,
    val total: Int = 0,
    val currentFile: String? = null,
    val lastError: String? = null,
    val cachedAssets: List<NativeCachedAsset> = emptyList(),
    val updatedAtMs: Long = System.currentTimeMillis()
)

data class NativeRuntimeHealthSnapshot(
    val playbackState: String,
    val playbackStateUpdatedAtMs: Long,
    val lastPlaybackProgressAtMs: Long,
    val lastSuccessfulPlaybackAtMs: Long?,
    val downloadState: String,
    val downloadUpdatedAtMs: Long,
    val playbackError: String?,
    val decoderError: String?
)

class NativeTelemetryStore(private val context: Context) {
    private val lock = Any()
    private val zoneAssets: LinkedHashMap<String, String?> = linkedMapOf()
    private var playbackState: String = "IDLE"
    private var playbackStateUpdatedAtMs: Long = System.currentTimeMillis()
    private var playbackError: String? = null
    private var decoderError: String? = null
    private var lastSuccessfulPlaybackAt: String? = null
    private var lastSuccessfulPlaybackAtMs: Long? = null
    private var lastPlaybackProgressAtMs: Long = System.currentTimeMillis()
    private var lastSuccessfulAssetId: String? = null
    private var lastSuccessfulPlaylistId: String? = null
    private var downloadSnapshot: NativeDownloadSnapshot = NativeDownloadSnapshot()

    fun markPlaybackState(state: String) {
        synchronized(lock) {
            if (playbackState != state) {
                playbackStateUpdatedAtMs = System.currentTimeMillis()
            }
            playbackState = state
            if (state == "PLAYING" || state == "BUFFERING") {
                lastPlaybackProgressAtMs = System.currentTimeMillis()
            }
        }
    }

    fun setZoneAsset(zoneId: String, mediaId: String?) {
        synchronized(lock) {
            zoneAssets[zoneId] = mediaId
            if (mediaId != null) {
                playbackState = "PLAYING"
                playbackStateUpdatedAtMs = System.currentTimeMillis()
                lastPlaybackProgressAtMs = System.currentTimeMillis()
                playbackError = null
                decoderError = null
            } else if (zoneAssets.values.none { !it.isNullOrBlank() } && playbackState == "PLAYING") {
                playbackState = "IDLE"
                playbackStateUpdatedAtMs = System.currentTimeMillis()
            }
        }
    }

    fun recordPlaybackProgress() {
        synchronized(lock) {
            lastPlaybackProgressAtMs = System.currentTimeMillis()
        }
    }

    fun markPlaybackSuccess(mediaId: String?, playlistId: String?) {
        synchronized(lock) {
            val now = System.currentTimeMillis()
            lastSuccessfulPlaybackAt = Instant.ofEpochMilli(now).toString()
            lastSuccessfulPlaybackAtMs = now
            lastPlaybackProgressAtMs = now
            lastSuccessfulAssetId = mediaId
            lastSuccessfulPlaylistId = playlistId
            playbackState = if (mediaId.isNullOrBlank()) "IDLE" else "PLAYING"
            playbackStateUpdatedAtMs = now
            playbackError = null
            decoderError = null
        }
    }

    fun markPlaybackIssue(message: String, decoderMessage: String? = null) {
        synchronized(lock) {
            playbackState = "ERROR"
            playbackStateUpdatedAtMs = System.currentTimeMillis()
            playbackError = message
            if (!decoderMessage.isNullOrBlank()) {
                decoderError = decoderMessage
            }
        }
    }

    fun clearPlaybackErrors() {
        synchronized(lock) {
            playbackError = null
            decoderError = null
        }
    }

    fun updateDownloadSnapshot(snapshot: NativeDownloadSnapshot) {
        synchronized(lock) {
            downloadSnapshot = snapshot
        }
    }

    fun healthSnapshot(): NativeRuntimeHealthSnapshot = synchronized(lock) {
        NativeRuntimeHealthSnapshot(
            playbackState = playbackState,
            playbackStateUpdatedAtMs = playbackStateUpdatedAtMs,
            lastPlaybackProgressAtMs = lastPlaybackProgressAtMs,
            lastSuccessfulPlaybackAtMs = lastSuccessfulPlaybackAtMs,
            downloadState = downloadSnapshot.state,
            downloadUpdatedAtMs = downloadSnapshot.updatedAtMs,
            playbackError = playbackError,
            decoderError = decoderError
        )
    }

    fun snapshot(
        currentPlaylistId: String?,
        apiBase: String?,
        kioskEnabled: Boolean,
        startOnBoot: Boolean,
        isDeviceOwner: Boolean,
        deviceId: String?,
        appVersion: String?
    ): JSONObject {
        val stats = StatFs(context.filesDir.absolutePath)
        val runtime = Runtime.getRuntime()
        val freeStorageBytes = runCatching { stats.availableBytes }.getOrDefault(0L)
        val totalStorageBytes = runCatching { stats.totalBytes }.getOrDefault(0L)
        val usedMemoryBytes = runtime.totalMemory() - runtime.freeMemory()
        val totalMemoryBytes = runtime.maxMemory()

        val localDownloadSnapshot: NativeDownloadSnapshot
        val localPlaybackState: String
        val localPlaybackError: String?
        val localDecoderError: String?
        val localCurrentAssets: List<String>
        val localLastSuccessfulPlaybackAt: String?
        val localLastSuccessfulAssetId: String?
        val localLastSuccessfulPlaylistId: String?

        synchronized(lock) {
            localDownloadSnapshot = downloadSnapshot
            localPlaybackState = playbackState
            localPlaybackError = playbackError
            localDecoderError = decoderError
            localCurrentAssets = zoneAssets.values.filterNotNull().filter { it.isNotBlank() }
            localLastSuccessfulPlaybackAt = lastSuccessfulPlaybackAt
            localLastSuccessfulAssetId = lastSuccessfulAssetId
            localLastSuccessfulPlaylistId = lastSuccessfulPlaylistId
        }

        val playbackStateResolved = when {
            localCurrentAssets.isNotEmpty() && localPlaybackState != "ERROR" -> "PLAYING"
            localPlaybackState.isBlank() -> "IDLE"
            else -> localPlaybackState
        }

        return JSONObject().apply {
            put("platform", "android-tv-native")
            put("androidVersion", Build.VERSION.RELEASE ?: "")
            put("device", Build.MODEL ?: "")
            put("deviceId", deviceId ?: JSONObject.NULL)
            put("deviceOwner", isDeviceOwner)
            put("deviceOwnerState", if (isDeviceOwner) "DEVICE_OWNER" else "NOT_DEVICE_OWNER")
            put("currentPlaylistId", currentPlaylistId ?: localLastSuccessfulPlaylistId ?: JSONObject.NULL)
            put("currentMediaId", localCurrentAssets.firstOrNull() ?: JSONObject.NULL)
            put("currentMediaIds", JSONArray(localCurrentAssets))
            put("currentAssetId", localCurrentAssets.firstOrNull() ?: localLastSuccessfulAssetId ?: JSONObject.NULL)
            put("currentAssetIds", JSONArray(localCurrentAssets))
            put("playbackState", playbackStateResolved)
            put("downloadState", localDownloadSnapshot.state)
            put("downloadProgress", JSONObject().apply {
                put("status", localDownloadSnapshot.state)
                put("completed", localDownloadSnapshot.completed)
                put("total", localDownloadSnapshot.total)
                put("currentFile", localDownloadSnapshot.currentFile ?: JSONObject.NULL)
                put("lastError", localDownloadSnapshot.lastError ?: JSONObject.NULL)
            })
            put("cachedFiles", JSONArray(localDownloadSnapshot.cachedAssets.map { asset ->
                JSONObject().apply {
                    put("mediaId", asset.mediaId)
                    put("filename", asset.filename)
                    put("state", asset.state)
                    put("bytesDownloaded", asset.bytesDownloaded)
                    put("totalBytes", asset.totalBytes ?: JSONObject.NULL)
                    put("checksumSha256", asset.checksumSha256 ?: JSONObject.NULL)
                    put("lastError", asset.lastError ?: JSONObject.NULL)
                }
            }))
            put("lastSuccessfulPlaybackAt", localLastSuccessfulPlaybackAt ?: JSONObject.NULL)
            put("lastSuccessfulAssetId", localLastSuccessfulAssetId ?: JSONObject.NULL)
            put("playbackError", localPlaybackError ?: JSONObject.NULL)
            put("decoderError", localDecoderError ?: JSONObject.NULL)
            put("lastDownloadError", localDownloadSnapshot.lastError ?: JSONObject.NULL)
            put("freeStorageBytes", freeStorageBytes)
            put("totalStorageBytes", totalStorageBytes)
            put("memoryUsedBytes", usedMemoryBytes)
            put("memoryTotalBytes", totalMemoryBytes)
            put("kioskEnabled", kioskEnabled)
            put("startOnBoot", startOnBoot)
            put("apiBase", apiBase ?: JSONObject.NULL)
            put("appVersion", appVersion ?: JSONObject.NULL)
            put("lastTelemetryAt", Instant.now().toString())
        }
    }
}
