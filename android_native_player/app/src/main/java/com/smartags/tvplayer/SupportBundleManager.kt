package com.smartags.tvplayer

import android.content.Context
import android.os.Build
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.time.Instant
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object SupportBundleManager {
    suspend fun exportAndUpload(
        context: Context,
        httpClient: OkHttpClient,
        apiBase: String,
        authToken: String,
        telemetrySnapshot: JSONObject,
        runtimeHealth: NativeRuntimeHealthSnapshot,
        currentScreenContent: JSONObject?,
        currentPlaylistId: String?,
        currentPlaylistFingerprint: String?,
        currentZoneMedia: Map<String, String?>,
        currentScreenId: String?,
        appVersion: String
    ): Boolean {
        val bundleFile = buildBundle(
            context = context,
            telemetrySnapshot = telemetrySnapshot,
            runtimeHealth = runtimeHealth,
            currentScreenContent = currentScreenContent,
            currentPlaylistId = currentPlaylistId,
            currentPlaylistFingerprint = currentPlaylistFingerprint,
            currentZoneMedia = currentZoneMedia,
            currentScreenId = currentScreenId,
            appVersion = appVersion
        ) ?: return false

        return uploadBundle(httpClient, apiBase, authToken, bundleFile)
    }

    private fun buildBundle(
        context: Context,
        telemetrySnapshot: JSONObject,
        runtimeHealth: NativeRuntimeHealthSnapshot,
        currentScreenContent: JSONObject?,
        currentPlaylistId: String?,
        currentPlaylistFingerprint: String?,
        currentZoneMedia: Map<String, String?>,
        currentScreenId: String?,
        appVersion: String
    ): File? = runCatching {
        val bundlesDir = File(context.cacheDir, "support-bundles").apply { mkdirs() }
        val bundleFile = File(bundlesDir, "support-bundle-${System.currentTimeMillis()}.zip")
        ZipOutputStream(FileOutputStream(bundleFile)).use { zip ->
            writeJsonEntry(
                zip,
                "bundle/metadata.json",
                JSONObject().apply {
                    put("generatedAt", Instant.now().toString())
                    put("appVersion", appVersion)
                    put("screenId", currentScreenId ?: JSONObject.NULL)
                    put("androidVersion", Build.VERSION.RELEASE ?: "")
                    put("device", Build.MODEL ?: "")
                }
            )
            writeJsonEntry(zip, "bundle/telemetry.json", telemetrySnapshot)
            writeJsonEntry(
                zip,
                "bundle/runtime-health.json",
                JSONObject().apply {
                    put("playbackState", runtimeHealth.playbackState)
                    put("playbackStateUpdatedAtMs", runtimeHealth.playbackStateUpdatedAtMs)
                    put("lastPlaybackProgressAtMs", runtimeHealth.lastPlaybackProgressAtMs)
                    put("lastSuccessfulPlaybackAtMs", runtimeHealth.lastSuccessfulPlaybackAtMs ?: JSONObject.NULL)
                    put("downloadState", runtimeHealth.downloadState)
                    put("downloadUpdatedAtMs", runtimeHealth.downloadUpdatedAtMs)
                    put("playbackError", runtimeHealth.playbackError ?: JSONObject.NULL)
                    put("decoderError", runtimeHealth.decoderError ?: JSONObject.NULL)
                }
            )
            writeJsonEntry(
                zip,
                "bundle/player-state.json",
                JSONObject().apply {
                    put("currentPlaylistId", currentPlaylistId ?: JSONObject.NULL)
                    put("currentPlaylistFingerprint", currentPlaylistFingerprint ?: JSONObject.NULL)
                    put("currentZoneMedia", JSONObject(currentZoneMedia))
                    put("currentScreenContent", currentScreenContent ?: JSONObject.NULL)
                }
            )
            writeJsonEntry(zip, "bundle/preferences.json", buildPrefsSnapshot(context))
            copyIfExists(zip, context.getDatabasePath("offline_state.db"), "bundle/offline_state.db")
            copyIfExists(zip, NativeOpsLogger.logFile(context), "bundle/native_ops.log")
        }
        bundleFile
    }.getOrNull()

    private fun buildPrefsSnapshot(context: Context): JSONObject {
        val prefs = KioskPrefs.prefs(context)
        val all = prefs.all
        val json = JSONObject()
        all.forEach { (key, value) ->
            json.put(
                key,
                when {
                    key.contains("token", true) -> redact(value?.toString())
                    key.contains("pin", true) -> "***redacted***"
                    value is Set<*> -> JSONArray(value.toList())
                    value == null -> JSONObject.NULL
                    else -> value
                }
            )
        }
        return json
    }

    private fun redact(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        return if (raw.length <= 8) "***redacted***" else "${raw.take(4)}...${raw.takeLast(4)}"
    }

    private fun copyIfExists(zip: ZipOutputStream, file: File, entryName: String) {
        if (!file.exists()) return
        zip.putNextEntry(ZipEntry(entryName))
        FileInputStream(file).use { input -> input.copyTo(zip) }
        zip.closeEntry()
    }

    private fun writeJsonEntry(zip: ZipOutputStream, entryName: String, value: JSONObject) {
        zip.putNextEntry(ZipEntry(entryName))
        zip.write(value.toString(2).toByteArray(Charsets.UTF_8))
        zip.closeEntry()
    }

    private fun uploadBundle(
        httpClient: OkHttpClient,
        apiBase: String,
        authToken: String,
        bundleFile: File
    ): Boolean = runCatching {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "bundle",
                bundleFile.name,
                bundleFile.asRequestBody("application/zip".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url("$apiBase/player/support-bundle")
            .header("Authorization", "Bearer $authToken")
            .post(body)
            .build()

        httpClient.newCall(request).execute().use { response -> response.isSuccessful }
    }.getOrDefault(false)
}
