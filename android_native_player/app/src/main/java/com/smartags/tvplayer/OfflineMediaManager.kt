package com.smartags.tvplayer

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.math.min

class OfflineMediaManager(
    private val context: Context,
    private val httpClient: OkHttpClient,
    private val onTelemetryChanged: (NativeDownloadSnapshot) -> Unit = {}
) {
    private val store = OfflineStateStore(context)
    private val cacheDir = File(context.filesDir, "media-cache").apply { mkdirs() }

    init {
        publishTelemetry("IDLE")
    }

    private fun normalizeChecksum(value: String?): String? {
        val text = value?.trim()?.lowercase() ?: return null
        return text.takeIf { it.isNotEmpty() && it != "null" }
    }

    suspend fun rememberScreenContent(content: JSONObject) = withContext(Dispatchers.IO) {
        store.putState(KEY_LAST_SCREEN_CONTENT, content.toString())
    }

    suspend fun loadRememberedScreenContent(): JSONObject? = withContext(Dispatchers.IO) {
        store.getState(KEY_LAST_SCREEN_CONTENT)?.let { runCatching { JSONObject(it) }.getOrNull() }
    }

    suspend fun rememberLastKnownGoodScreenContent(content: JSONObject) = withContext(Dispatchers.IO) {
        store.putState(KEY_LAST_KNOWN_GOOD_SCREEN_CONTENT, content.toString())
    }

    suspend fun loadLastKnownGoodScreenContent(): JSONObject? = withContext(Dispatchers.IO) {
        store.getState(KEY_LAST_KNOWN_GOOD_SCREEN_CONTENT)?.let { runCatching { JSONObject(it) }.getOrNull() }
    }

    suspend fun runStartupHealthCheck() = withContext(Dispatchers.IO) {
        cacheDir.mkdirs()
        val now = System.currentTimeMillis()
        store.listAssets().forEach { record ->
            val finalFile = File(record.localPath)
            val partFile = File(record.localPath + PARTIAL_SUFFIX)
            val isStalePartial = partFile.exists() && now - partFile.lastModified() > STALE_PARTIAL_FILE_MS
            val isStaleDownload = record.state == STATE_DOWNLOADING && now - record.updatedAt > STALE_DOWNLOAD_STATE_MS
            when {
                isStalePartial -> {
                    partFile.delete()
                    store.saveAsset(
                        record.copy(
                            state = STATE_FAILED,
                            bytesDownloaded = 0,
                            lastError = "Recovered stale partial download on startup",
                            updatedAt = now
                        )
                    )
                }
                isStaleDownload -> {
                    store.saveAsset(
                        record.copy(
                            state = STATE_FAILED,
                            lastError = "Recovered stale download state on startup",
                            updatedAt = now
                        )
                    )
                }
                record.state == STATE_READY && !finalFile.exists() -> {
                    store.saveAsset(
                        record.copy(
                            state = STATE_FAILED,
                            verifiedSize = null,
                            bytesDownloaded = 0,
                            lastError = "Missing cached file detected on startup",
                            updatedAt = now
                        )
                    )
                }
            }
        }
        publishTelemetry()
    }

    suspend fun syncAssets(mediaFiles: List<MediaFileModel>) = withContext(Dispatchers.IO) {
        val desired = mediaFiles.distinctBy { assetKey(it) }
        val now = System.currentTimeMillis()
        if (desired.isEmpty()) {
            publishTelemetry("SYNCED", 0, 0)
            pruneStaleAssetsInternal(emptySet())
            publishTelemetry("SYNCED")
            return@withContext
        }

        desired.forEach { media ->
            val finalFile = finalFileFor(media)
            val existing = store.getAsset(assetKey(media))
            // #region debug-point incoming-checksum-shape
            if (media.sha256.equals("null", ignoreCase = true) || media.sha256.equals("\"null\"", ignoreCase = true)) {
                NativeOpsLogger.log(
                    context,
                    "WARN",
                    "Incoming media checksum looks invalid",
                    JSONObject()
                        .put("mediaId", media.id)
                        .put("filename", media.filename)
                        .put("sha256", media.sha256)
                        .put("url", media.url)
                )
            }
            // #endregion
            store.saveAsset(
                (existing ?: offlineRecordFor(media, finalFile)).copy(
                    mediaId = media.id,
                    url = media.url,
                    mimeType = media.mimeType,
                    localPath = finalFile.absolutePath,
                    expectedSize = media.sizeBytes,
                    checksumSha256 = normalizeChecksum(media.sha256) ?: normalizeChecksum(existing?.checksumSha256),
                    lastSeenAt = now,
                    updatedAt = now
                )
            )
        }

        var completed = 0
        for (media in desired) {
            publishTelemetry(
                state = "DOWNLOADING",
                completed = completed,
                total = desired.size,
                currentFile = media.filename
            )
            if (ensureAvailableInternal(media, allowDownload = true)) {
                completed += 1
            }
        }

        pruneStaleAssetsInternal(desired.map { assetKey(it) }.toSet())
        val finalState = if (completed == desired.size) "SYNCED" else if (completed > 0) "PARTIAL" else "ERROR"
        publishTelemetry(finalState, completed, desired.size)
    }

    suspend fun ensureAvailable(media: MediaFileModel): Boolean = withContext(Dispatchers.IO) {
        publishTelemetry("DOWNLOADING", 0, 1, media.filename)
        val ok = ensureAvailableInternal(media, allowDownload = true)
        publishTelemetry(if (ok) "SYNCED" else "ERROR", if (ok) 1 else 0, 1, media.filename)
        ok
    }

    fun fileFor(media: MediaFileModel): File = finalFileFor(media)

    suspend fun clearAll() = withContext(Dispatchers.IO) {
        cacheDir.listFiles()?.forEach { it.deleteRecursively() }
        store.clearAll()
        cacheDir.mkdirs()
        publishTelemetry("CLEARED", 0, 0)
    }

    private suspend fun ensureAvailableInternal(media: MediaFileModel, allowDownload: Boolean): Boolean {
        val key = assetKey(media)
        val finalFile = finalFileFor(media)
        val existing = store.getAsset(key)
        if (existing != null && isRecordUsable(existing, finalFile)) {
            return true
        }

        if (!allowDownload) {
            return false
        }

        val maxAttempts = 4
        var attempt = 0
        while (attempt < maxAttempts) {
            attempt += 1
            val startTime = System.currentTimeMillis()
            val updatedRecord = (store.getAsset(key) ?: offlineRecordFor(media, finalFile)).copy(
                state = STATE_DOWNLOADING,
                retryCount = attempt - 1,
                lastSeenAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                lastError = null
            )
            store.saveAsset(updatedRecord)
            publishTelemetry(
                state = "DOWNLOADING",
                currentFile = media.filename,
                lastError = null
            )

            val result = downloadOnce(media, updatedRecord)
            if (result.success) {
                val expectedSha256 = normalizeChecksum(media.sha256)
                val actualSha256 = normalizeChecksum(result.checksumSha256)
                // #region debug-point checksum-compare
                if (expectedSha256 != null) {
                    NativeOpsLogger.log(
                        context,
                        "INFO",
                        "Checksum verification input",
                        JSONObject()
                            .put("mediaId", media.id)
                            .put("filename", media.filename)
                            .put("expectedSha256", expectedSha256)
                            .put("actualSha256", actualSha256)
                    )
                }
                // #endregion
                if (expectedSha256 != null && actualSha256 != expectedSha256) {
                    if (finalFile.exists()) {
                        finalFile.delete()
                    }
                    // #region debug-point checksum-mismatch
                    NativeOpsLogger.log(
                        context,
                        "ERROR",
                        "Checksum mismatch during download validation",
                        JSONObject()
                            .put("mediaId", media.id)
                            .put("filename", media.filename)
                            .put("expectedSha256", expectedSha256)
                            .put("actualSha256", actualSha256)
                    )
                    // #endregion
                    store.saveAsset(
                        (store.getAsset(key) ?: updatedRecord).copy(
                            state = STATE_FAILED,
                            lastError = "Checksum mismatch",
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                    publishTelemetry(state = "ERROR", currentFile = media.filename, lastError = "Checksum mismatch")
                    continue
                }

                val readyRecord = (store.getAsset(key) ?: updatedRecord).copy(
                    state = STATE_READY,
                    localPath = finalFile.absolutePath,
                    expectedSize = media.sizeBytes ?: result.totalBytes,
                    verifiedSize = finalFile.length(),
                    checksumSha256 = expectedSha256 ?: actualSha256,
                    bytesDownloaded = finalFile.length(),
                    totalBytes = media.sizeBytes ?: result.totalBytes ?: finalFile.length(),
                    lastVerifiedAt = System.currentTimeMillis(),
                    lastError = null,
                    updatedAt = System.currentTimeMillis()
                )
                store.saveAsset(readyRecord)
                publishTelemetry(state = "READY", currentFile = media.filename)
                return true
            }

            store.saveAsset(
                (store.getAsset(key) ?: updatedRecord).copy(
                    state = STATE_FAILED,
                    retryCount = attempt,
                    lastError = result.errorMessage ?: "Download failed",
                    updatedAt = System.currentTimeMillis()
                )
            )
            publishTelemetry(
                state = if (attempt < maxAttempts) "RETRYING" else "ERROR",
                currentFile = media.filename,
                lastError = result.errorMessage ?: "Download failed"
            )

            if (attempt < maxAttempts) {
                val backoffMs = min(30000L, 1000L shl (attempt - 1))
                val elapsed = System.currentTimeMillis() - startTime
                if (elapsed < backoffMs) {
                    delay(backoffMs - elapsed)
                }
            }
        }

        return false
    }

    private fun isRecordUsable(record: OfflineAssetRecord, finalFile: File): Boolean {
        if (record.state != STATE_READY || !finalFile.exists()) {
            return false
        }

        val expectedSize = record.expectedSize
        if (expectedSize != null && expectedSize > 0 && finalFile.length() != expectedSize) {
            finalFile.delete()
            store.saveAsset(
                record.copy(
                    state = STATE_FAILED,
                    verifiedSize = null,
                    lastError = "Size mismatch",
                    updatedAt = System.currentTimeMillis()
                )
            )
            return false
        }

        val checksum = normalizeChecksum(record.checksumSha256)
        val needsVerification = checksum != null && (
            record.lastVerifiedAt == null ||
                System.currentTimeMillis() - record.lastVerifiedAt > CHECKSUM_VERIFY_INTERVAL_MS
            )
        if (needsVerification) {
            val actual = sha256(finalFile)
            if (actual != checksum) {
                finalFile.delete()
                store.saveAsset(
                    record.copy(
                        state = STATE_FAILED,
                        verifiedSize = null,
                        lastError = "Checksum mismatch",
                        updatedAt = System.currentTimeMillis()
                    )
                )
                return false
            }
            store.saveAsset(
                record.copy(
                    verifiedSize = finalFile.length(),
                    lastVerifiedAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
        }

        return true
    }

    private fun downloadOnce(media: MediaFileModel, record: OfflineAssetRecord): DownloadAttemptResult {
        val finalFile = File(record.localPath)
        val partFile = partFileFor(media)
        partFile.parentFile?.mkdirs()

        var existingBytes = if (partFile.exists()) partFile.length() else 0L
        val requestBuilder = Request.Builder().url(media.url).get()
        if (existingBytes > 0) {
            requestBuilder.header("Range", "bytes=$existingBytes-")
        }

        val request = requestBuilder.build()
        return runCatching {
            httpClient.newBuilder()
                .readTimeout(DOWNLOAD_STALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .callTimeout(DOWNLOAD_CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .build()
                .newCall(request)
                .execute().use { response ->
                if (response.code == 416) {
                    partFile.delete()
                    existingBytes = 0L
                    return@use DownloadAttemptResult(success = false, errorMessage = "Range not satisfiable")
                }
                if (!response.isSuccessful && response.code != 206) {
                    return@use DownloadAttemptResult(success = false, errorMessage = "HTTP ${response.code}")
                }

                val resumed = response.code == 206 && existingBytes > 0
                if (!resumed && partFile.exists()) {
                    partFile.delete()
                    existingBytes = 0L
                }

                val body = response.body ?: return@use DownloadAttemptResult(success = false, errorMessage = "Empty body")
                val bodyLength = body.contentLength().takeIf { it >= 0 }
                val totalBytes = media.sizeBytes ?: when {
                    resumed && bodyLength != null -> existingBytes + bodyLength
                    bodyLength != null -> bodyLength
                    else -> null
                }

                RandomAccessFile(partFile, "rw").use { output ->
                    if (resumed) {
                        output.seek(existingBytes)
                    } else {
                        output.setLength(0)
                    }
                    var lastProgressAt = System.currentTimeMillis()
                    var lastPublishedAt = 0L
                    body.byteStream().use { input ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        while (true) {
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            lastProgressAt = System.currentTimeMillis()
                            val downloaded = output.length()
                            if (lastProgressAt - lastPublishedAt >= 1000L) {
                                val progressRecord = (store.getAsset(record.assetKey) ?: record).copy(
                                    state = STATE_DOWNLOADING,
                                    bytesDownloaded = downloaded,
                                    totalBytes = totalBytes,
                                    lastSeenAt = lastProgressAt,
                                    updatedAt = lastProgressAt,
                                    lastError = null
                                )
                                store.saveAsset(progressRecord)
                                publishTelemetry(
                                    state = "DOWNLOADING",
                                    currentFile = media.filename,
                                    total = store.listAssets().size,
                                    completed = store.listAssets().count { it.state == STATE_READY }
                                )
                                lastPublishedAt = lastProgressAt
                            }
                            if (System.currentTimeMillis() - lastProgressAt > DOWNLOAD_STALL_TIMEOUT_MS) {
                                return@use DownloadAttemptResult(success = false, totalBytes = totalBytes, errorMessage = "Download stalled")
                            }
                        }
                    }
                }

                val actualSize = partFile.length()
                if (totalBytes != null && totalBytes > 0 && actualSize != totalBytes) {
                    return@use DownloadAttemptResult(
                        success = false,
                        totalBytes = totalBytes,
                        errorMessage = "Incomplete download ($actualSize/$totalBytes)"
                    )
                }
                if (media.sizeBytes != null && media.sizeBytes > 0 && actualSize != media.sizeBytes) {
                    return@use DownloadAttemptResult(
                        success = false,
                        totalBytes = media.sizeBytes,
                        errorMessage = "Expected ${media.sizeBytes} bytes, got $actualSize"
                    )
                }

                if (finalFile.exists()) {
                    finalFile.delete()
                }
                if (!partFile.renameTo(finalFile)) {
                    return@use DownloadAttemptResult(success = false, errorMessage = "Failed to promote completed file")
                }

                DownloadAttemptResult(
                    success = true,
                    totalBytes = totalBytes ?: actualSize,
                    checksumSha256 = sha256(finalFile)
                )
            }
        }.getOrElse { error ->
            DownloadAttemptResult(success = false, errorMessage = error.message ?: "Download crashed")
        }
    }

    private fun pruneStaleAssetsInternal(activeKeys: Set<String>) {
        store.listAssets().forEach { record ->
            if (record.assetKey in activeKeys) return@forEach

            File(record.localPath).delete()
            File(record.localPath + PARTIAL_SUFFIX).delete()
            store.deleteAsset(record.assetKey)
        }
        publishTelemetry()
    }

    private fun publishTelemetry(
        state: String? = null,
        completed: Int? = null,
        total: Int? = null,
        currentFile: String? = null,
        lastError: String? = null
    ) {
        val assets = store.listAssets()
        val snapshot = NativeDownloadSnapshot(
            state = state ?: deriveOverallState(assets),
            completed = completed ?: assets.count { it.state == STATE_READY },
            total = total ?: assets.size,
            currentFile = currentFile,
            lastError = lastError ?: assets.firstOrNull { !it.lastError.isNullOrBlank() }?.lastError,
            cachedAssets = assets.map { asset ->
                NativeCachedAsset(
                    mediaId = asset.mediaId,
                    filename = File(asset.localPath).name,
                    state = asset.state,
                    bytesDownloaded = asset.bytesDownloaded,
                    totalBytes = asset.totalBytes,
                    checksumSha256 = asset.checksumSha256,
                    lastError = asset.lastError
                )
            },
            updatedAtMs = System.currentTimeMillis()
        )
        onTelemetryChanged(snapshot)
    }

    private fun deriveOverallState(assets: List<OfflineAssetRecord>): String {
        if (assets.isEmpty()) return "IDLE"
        return when {
            assets.any { it.state == STATE_DOWNLOADING } -> "DOWNLOADING"
            assets.any { it.state == STATE_FAILED } && assets.any { it.state == STATE_READY } -> "PARTIAL"
            assets.any { it.state == STATE_FAILED } -> "ERROR"
            assets.all { it.state == STATE_READY } -> "SYNCED"
            assets.any { it.state == STATE_PENDING } -> "PENDING"
            else -> "IDLE"
        }
    }

    private fun finalFileFor(media: MediaFileModel): File =
        File(cacheDir, "${assetKey(media)}${extensionFor(media)}")

    private fun partFileFor(media: MediaFileModel): File =
        File(cacheDir, "${assetKey(media)}${extensionFor(media)}$PARTIAL_SUFFIX")

    private fun extensionFor(media: MediaFileModel): String {
        val mime = media.mimeType.lowercase()
        return when {
            mime.contains("mp4") -> ".mp4"
            mime.contains("webm") -> ".webm"
            mime.contains("png") -> ".png"
            mime.contains("jpeg") || mime.contains("jpg") -> ".jpg"
            mime.contains("gif") -> ".gif"
            mime.contains("mpegurl") || mime.contains("m3u8") -> ".m3u8"
            else -> media.filename.substringAfterLast('.', "").takeIf { it.isNotBlank() }?.let { ".$it" } ?: ""
        }
    }

    private fun assetKey(media: MediaFileModel): String =
        "${media.id}_${shortHash(versionTokenFor(media))}"

    private fun versionTokenFor(media: MediaFileModel): String =
        listOf(
            media.id,
            media.url,
            media.updatedAt ?: "",
            media.sizeBytes?.toString() ?: "",
            media.sha256 ?: "",
            media.mimeType
        ).joinToString("|")

    private fun offlineRecordFor(media: MediaFileModel, finalFile: File): OfflineAssetRecord =
        OfflineAssetRecord(
            assetKey = assetKey(media),
            mediaId = media.id,
            versionToken = versionTokenFor(media),
            url = media.url,
            mimeType = media.mimeType,
            localPath = finalFile.absolutePath,
            state = STATE_PENDING,
            expectedSize = media.sizeBytes,
            verifiedSize = null,
            checksumSha256 = normalizeChecksum(media.sha256),
            retryCount = 0,
            lastError = null,
            lastSeenAt = System.currentTimeMillis(),
            bytesDownloaded = 0,
            totalBytes = media.sizeBytes,
            lastVerifiedAt = null,
            updatedAt = System.currentTimeMillis()
        )

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun shortHash(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(16)

    companion object {
        private const val KEY_LAST_SCREEN_CONTENT = "last_screen_content"
        private const val KEY_LAST_KNOWN_GOOD_SCREEN_CONTENT = "last_known_good_screen_content"
        private const val STATE_PENDING = "PENDING"
        private const val STATE_DOWNLOADING = "DOWNLOADING"
        private const val STATE_READY = "READY"
        private const val STATE_FAILED = "FAILED"
        private const val PARTIAL_SUFFIX = ".part"
        private const val CHECKSUM_VERIFY_INTERVAL_MS = 6 * 60 * 60 * 1000L
        private const val STALE_PARTIAL_FILE_MS = 20 * 60 * 1000L
        private const val STALE_DOWNLOAD_STATE_MS = 20 * 60 * 1000L
        private const val DOWNLOAD_STALL_TIMEOUT_MS = 45_000L
        private const val DOWNLOAD_CALL_TIMEOUT_MS = 2 * 60 * 1000L
    }
}

private data class OfflineAssetRecord(
    val assetKey: String,
    val mediaId: String,
    val versionToken: String,
    val url: String,
    val mimeType: String,
    val localPath: String,
    val state: String,
    val expectedSize: Long?,
    val verifiedSize: Long?,
    val checksumSha256: String?,
    val retryCount: Int,
    val lastError: String?,
    val lastSeenAt: Long,
    val bytesDownloaded: Long,
    val totalBytes: Long?,
    val lastVerifiedAt: Long?,
    val updatedAt: Long
)

private data class DownloadAttemptResult(
    val success: Boolean,
    val totalBytes: Long? = null,
    val checksumSha256: String? = null,
    val errorMessage: String? = null
)

private class OfflineStateStore(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE assets (
                asset_key TEXT PRIMARY KEY,
                media_id TEXT NOT NULL,
                version_token TEXT NOT NULL,
                url TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                local_path TEXT NOT NULL,
                state TEXT NOT NULL,
                expected_size INTEGER,
                verified_size INTEGER,
                checksum_sha256 TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                last_seen_at INTEGER NOT NULL,
                bytes_downloaded INTEGER NOT NULL DEFAULT 0,
                total_bytes INTEGER,
                last_verified_at INTEGER,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE state_entries (
                state_key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS assets")
        db.execSQL("DROP TABLE IF EXISTS state_entries")
        onCreate(db)
    }

    fun getAsset(assetKey: String): OfflineAssetRecord? =
        readableDatabase.query(
            "assets",
            null,
            "asset_key = ?",
            arrayOf(assetKey),
            null,
            null,
            null
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            cursor.toOfflineAssetRecord()
        }

    fun listAssets(): List<OfflineAssetRecord> =
        readableDatabase.query("assets", null, null, null, null, null, null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(cursor.toOfflineAssetRecord())
                }
            }
        }

    fun saveAsset(record: OfflineAssetRecord) {
        writableDatabase.replace("assets", null, record.toContentValues())
    }

    fun deleteAsset(assetKey: String) {
        writableDatabase.delete("assets", "asset_key = ?", arrayOf(assetKey))
    }

    fun putState(key: String, value: String) {
        writableDatabase.replace(
            "state_entries",
            null,
            ContentValues().apply {
                put("state_key", key)
                put("value", value)
                put("updated_at", System.currentTimeMillis())
            }
        )
    }

    fun getState(key: String): String? =
        readableDatabase.query(
            "state_entries",
            arrayOf("value"),
            "state_key = ?",
            arrayOf(key),
            null,
            null,
            null
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            cursor.getString(cursor.getColumnIndexOrThrow("value"))
        }

    fun clearAll() {
        writableDatabase.delete("assets", null, null)
        writableDatabase.delete("state_entries", null, null)
    }

    private fun OfflineAssetRecord.toContentValues() = ContentValues().apply {
        put("asset_key", assetKey)
        put("media_id", mediaId)
        put("version_token", versionToken)
        put("url", url)
        put("mime_type", mimeType)
        put("local_path", localPath)
        put("state", state)
        put("expected_size", expectedSize)
        put("verified_size", verifiedSize)
        put("checksum_sha256", checksumSha256)
        put("retry_count", retryCount)
        put("last_error", lastError)
        put("last_seen_at", lastSeenAt)
        put("bytes_downloaded", bytesDownloaded)
        put("total_bytes", totalBytes)
        put("last_verified_at", lastVerifiedAt)
        put("updated_at", updatedAt)
    }

    private fun android.database.Cursor.toOfflineAssetRecord() = OfflineAssetRecord(
        assetKey = getString(getColumnIndexOrThrow("asset_key")),
        mediaId = getString(getColumnIndexOrThrow("media_id")),
        versionToken = getString(getColumnIndexOrThrow("version_token")),
        url = getString(getColumnIndexOrThrow("url")),
        mimeType = getString(getColumnIndexOrThrow("mime_type")),
        localPath = getString(getColumnIndexOrThrow("local_path")),
        state = getString(getColumnIndexOrThrow("state")),
        expectedSize = getLongOrNull("expected_size"),
        verifiedSize = getLongOrNull("verified_size"),
        checksumSha256 = getStringOrNull(getColumnIndexOrThrow("checksum_sha256")),
        retryCount = getInt(getColumnIndexOrThrow("retry_count")),
        lastError = getStringOrNull(getColumnIndexOrThrow("last_error")),
        lastSeenAt = getLong(getColumnIndexOrThrow("last_seen_at")),
        bytesDownloaded = getLong(getColumnIndexOrThrow("bytes_downloaded")),
        totalBytes = getLongOrNull("total_bytes"),
        lastVerifiedAt = getLongOrNull("last_verified_at"),
        updatedAt = getLong(getColumnIndexOrThrow("updated_at"))
    )

    private fun android.database.Cursor.getLongOrNull(columnName: String): Long? {
        val index = getColumnIndexOrThrow(columnName)
        return if (isNull(index)) null else getLong(index)
    }

    private fun android.database.Cursor.getStringOrNull(index: Int): String? =
        if (isNull(index)) null else getString(index)

    companion object {
        private const val DB_NAME = "offline_state.db"
        private const val DB_VERSION = 1
    }
}
